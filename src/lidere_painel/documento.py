"""Monta o painel num documento HTML unico, autocontido, para `iframe srcdoc`.

Por que: o iframe do painel e sandbox sem allow-same-origin, entao nao manda o
token do usuario e nao consegue buscar arquivo protegido no servidor. Em vez de
servir arquivos, o host recebe UM documento com tudo embutido:

- `<link rel="stylesheet" href="x.css">` vira `<style>` com o conteudo;
- `url(...)` dentro de CSS vira data: URI (fonte, imagem);
- `<script src="x.js">` vira `<script>` inline;
- `src="x.png"` de imagem vira data: URI;
- um `<meta http-equiv="Content-Security-Policy">` no topo trava rede e frames.

So referencia LOCAL do pacote e resolvida. Referencia externa ja foi recusada na
validacao do pacote (`pacote.py`).
"""

from __future__ import annotations

import base64
import mimetypes
import posixpath
import re

from lidere_painel.pacote import Painel

__all__ = ["montar_documento", "CSP_DOCUMENTO"]

CSP_DOCUMENTO = (
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
    "img-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; "
    "frame-src 'none'; object-src 'none'; base-uri 'none'"
)

_RE_LINK_CSS = re.compile(r"<link\b[^>]*\brel=[\"']stylesheet[\"'][^>]*>", re.IGNORECASE)
_RE_HREF = re.compile(r"\bhref=[\"']([^\"']+)[\"']", re.IGNORECASE)
_RE_SCRIPT_SRC = re.compile(r"<script\b([^>]*)\bsrc=[\"']([^\"']+)[\"']([^>]*)>\s*</script>", re.IGNORECASE)
_RE_IMG_SRC = re.compile(r"(<img\b[^>]*\bsrc=)[\"']([^\"']+)[\"']", re.IGNORECASE)
_RE_CSS_URL = re.compile(r"url\(\s*([\"']?)([^\"')]+)\1\s*\)", re.IGNORECASE)
_RE_HEAD = re.compile(r"<head\b[^>]*>", re.IGNORECASE)
_RE_BODY_FIM = re.compile(r"</body\s*>", re.IGNORECASE)

# Injetado pelo HOST em todo documento, qualquer que seja a versao do runtime do pacote:
# mede a altura do conteudo e avisa o host, que ajusta o iframe. Assim painel publicado
# com runtime antigo tambem cresce junto com a pagina, sem segunda barra de rolagem.
_SCRIPT_ALTURA = """<script data-origem="host:altura">
(function () {
  var ultima = 0;
  function medir() {
    var altura = Math.ceil(Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0));
    if (Math.abs(altura - ultima) < 2) return;
    ultima = altura;
    window.parent.postMessage({ canal: "focco3i-painel", tipo: "altura", altura: altura }, "*");
  }
  if (window.ResizeObserver) new ResizeObserver(medir).observe(document.documentElement);
  window.addEventListener("load", medir);
  setTimeout(medir, 0);
})();
</script>"""


def _resolver(base: str, ref: str) -> str:
    ref = ref.split("#", 1)[0].split("?", 1)[0]
    return posixpath.normpath(posixpath.join(posixpath.dirname(base), ref)) if ref else ""


def _data_uri(nome: str, conteudo: bytes) -> str:
    tipo = mimetypes.guess_type(nome)[0] or "application/octet-stream"
    if nome.endswith(".woff2"):
        tipo = "font/woff2"
    elif nome.endswith(".woff"):
        tipo = "font/woff"
    return f"data:{tipo};base64,{base64.b64encode(conteudo).decode()}"


def _embutir_css(css: str, origem: str, arquivos: dict[str, bytes]) -> str:
    def trocar(m: re.Match[str]) -> str:
        ref = m.group(2).strip()
        if ref.startswith(("data:", "#")):
            return m.group(0)
        alvo = _resolver(origem, ref)
        if alvo in arquivos:
            return f'url("{_data_uri(alvo, arquivos[alvo])}")'
        return "url(about:blank)"

    return _RE_CSS_URL.sub(trocar, css)


def montar_documento(painel: Painel) -> str:
    arquivos = painel.arquivos
    html = arquivos["index.html"].decode("utf-8")

    def trocar_link(m: re.Match[str]) -> str:
        href = _RE_HREF.search(m.group(0))
        alvo = _resolver("index.html", href.group(1)) if href else ""
        if alvo not in arquivos:
            return ""
        css = _embutir_css(arquivos[alvo].decode("utf-8"), alvo, arquivos)
        return f"<style data-origem=\"{alvo}\">\n{css}\n</style>"

    # O JS embutido sai do HTML durante as demais trocas (estilo, imagem, </body>, <head>):
    # bibliotecas como xlsx e html2canvas tem esses textos dentro de strings, e mexer neles
    # quebra o script. Cada script vira um marcador e volta intacto no fim.
    scripts: list[str] = []

    def guardar(bloco: str) -> str:
        scripts.append(bloco)
        return f"\x00focco3i-script-{len(scripts) - 1}\x00"

    def trocar_script(m: re.Match[str]) -> str:
        alvo = _resolver("index.html", m.group(2))
        if alvo not in arquivos:
            return ""
        js = arquivos[alvo].decode("utf-8").replace("</script", "<\\/script")
        return guardar(f"<script{m.group(1)}{m.group(3)} data-origem=\"{alvo}\">\n{js}\n</script>")

    def trocar_img(m: re.Match[str]) -> str:
        ref = m.group(2)
        if ref.startswith("data:"):
            return m.group(0)
        alvo = _resolver("index.html", ref)
        return f'{m.group(1)}"{_data_uri(alvo, arquivos[alvo])}"' if alvo in arquivos else f'{m.group(1)}""'

    html = _RE_SCRIPT_SRC.sub(trocar_script, html)
    html = re.sub(r"(?is)<script\b[^>]*>.*?</script>", lambda m: guardar(m.group(0)), html)
    html = _RE_LINK_CSS.sub(trocar_link, html)
    html = _RE_IMG_SRC.sub(trocar_img, html)
    html = re.sub(
        r"(<style\b[^>]*>)(.*?)(</style>)",
        lambda m: m.group(1) + _embutir_css(m.group(2), "index.html", arquivos) + m.group(3),
        html,
        flags=re.IGNORECASE | re.DOTALL,
    )

    if _RE_BODY_FIM.search(html):
        html = _RE_BODY_FIM.sub(lambda m: _SCRIPT_ALTURA + m.group(0), html, count=1)
    else:
        html += _SCRIPT_ALTURA

    meta = f'<meta http-equiv="Content-Security-Policy" content="{CSP_DOCUMENTO}">'
    if _RE_HEAD.search(html):
        html = _RE_HEAD.sub(lambda m: m.group(0) + meta, html, count=1)
    else:
        html = meta + html
    return re.sub("\x00focco3i-script-(\\d+)\x00", lambda m: scripts[int(m.group(1))], html)

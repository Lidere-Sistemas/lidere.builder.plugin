---
name: instalar
description: Instala e confere o Lidere Builder no computador do usuário (Windows ou macOS): CLI lidere-painel com o Node embutido, login no portal pelo navegador, liberação dos comandos e conexão do MCP lidere-builder-f3i. Use na primeira vez, quando um comando lidere-painel não existir, ou quando o usuário pedir para conferir a instalação.
disable-model-invocation: false
---

# Instalar e conferir o Lidere Builder

Quem usa é gente de negócio, não de TI. **Você faz tudo**; o usuário só aprova e autoriza no navegador. Fale em português, curto, sem jargão (não diga uv, PATH, token, OAuth). Rode cada verificação e só avance quando ela passar.

**Qual shell:** no Windows sem Git Bash você está no PowerShell; com Git Bash ou no macOS, no Bash. Use os comandos da coluna certa. Nunca peça admin nem `sudo`: tudo instala na pasta do usuário.

| Passo | PowerShell (Windows) | Bash (macOS, Git Bash) |
|---|---|---|
| Pasta dos programas | `$env:USERPROFILE\.local\bin` | `~/.local/bin` |
| Tem uv? | `Test-Path "$env:USERPROFILE\.local\bin\uv.exe"` | `test -x ~/.local/bin/uv \|\| command -v uv` |
| Instalar uv | `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 \| iex"` | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Tem a CLI? | `Test-Path "$env:USERPROFILE\.local\bin\lidere-painel.exe"` | `test -x ~/.local/bin/lidere-painel` |

1. **Programa de apoio (uv).** Se faltar, instale com o comando da tabela. Ele não pede admin. Nesta sessão o app ainda não enxerga o programa novo pelo nome: chame **pelo caminho completo** da pasta dos programas até o fim da instalação.
2. **CLI do Lidere Builder** (já traz o Node junto, não instale Node à parte; não pede login):
   `<pasta dos programas>/uv tool install --force git+https://github.com/Lidere-Sistemas/lidere.builder.plugin@v0.3.1`
   Use exatamente essa versão (é a deste plugin); não instale da `main`.
   Se der erro de rede ou dizer que falta o `git`, peça ao usuário para instalar o Git (git-scm.com, opções padrão) e tente de novo.
3. **Liberar os comandos do dia a dia** (para não pedir aprovação a cada passo). Explique em uma frase e peça o ok. Depois acrescente, sem apagar nada do que já existe, em `~/.claude/settings.json` (no Windows, `%USERPROFILE%\.claude\settings.json`), dentro de `permissions.allow`, estas regras para cada comando `status`, `novo`, `servir`, `validar`, `empacotar`, `atualizar` e `parar`:
   ```json
   "Bash(lidere-painel status *)", "PowerShell(lidere-painel status *)",
   "Bash(lidere-painel novo *)", "PowerShell(lidere-painel novo *)",
   "Bash(lidere-painel servir *)", "PowerShell(lidere-painel servir *)",
   "Bash(lidere-painel validar *)", "PowerShell(lidere-painel validar *)",
   "Bash(lidere-painel empacotar *)", "PowerShell(lidere-painel empacotar *)",
   "Bash(lidere-painel atualizar *)", "PowerShell(lidere-painel atualizar *)",
   "Bash(lidere-painel parar*)", "PowerShell(lidere-painel parar*)"
   ```
   **Nunca** libere `publicar`, `entrar` nem `configurar`: publicar muda o que os outros veem no portal e os outros dois mexem no login. Esses continuam pedindo o ok do usuário a cada vez.
   Se o arquivo não existir, crie com `{"permissions": {"allow": [ ... ]}}`. Leia antes de editar; JSON inválido quebra as configurações do usuário.
4. **Login no portal pelo navegador** (o mesmo login do Claude, sem copiar nada):
   `<pasta dos programas>/lidere-painel entrar --mcp <endereço do MCP>`
   - O endereço do MCP é o que o usuário informou ao ativar o plugin (ex.: `https://mcp.empresa.com.br/mcp`). Se você não souber, pergunte: "qual o endereço do Lidere Builder que você recebeu da TI ou da Lidere?".
   - O navegador abre a tela "Autorizar" do portal. Diga ao usuário: "autorize no navegador e volte aqui".
   - Depois confira com `lidere-painel status`: deve mostrar o usuário e as áreas liberadas.
   - Sem áreas liberadas: quem libera é o administrador do portal, no perfil do usuário (MCP > as áreas que ele deve enxergar).
5. **Endereço do MCP no plugin.** Instalado pela tela de Plugins do app, o plugin pode ficar sem o endereço (o conector aparece com "Vincular" e não conecta). Confira:
   `claude plugin configure lidere-builder@lidere --json`
   - Se `mcp_url` estiver vazio, grave o endereço que o usuário recebeu (o mesmo do passo 4). PowerShell: `'{"mcp_url":"<endereço>"}' | claude plugin configure lidere-builder@lidere --values-stdin`; Bash: `echo '{"mcp_url":"<endereço>"}' | claude plugin configure lidere-builder@lidere --values-stdin`. Depois peça para fechar e abrir o app.
   - Se o comando `claude` não existir nesta máquina, oriente: digitar `/plugin` na conversa, abrir **lidere-builder** e preencher o endereço em **Configurar**.
6. **Conexão do Claude com o portal (MCP).** Chame a ferramenta `meus_escopos` do `lidere-builder-f3i`. Se ela pedir login, oriente o usuário a clicar no aviso de autenticação que o app mostra (no terminal, `/mcp` → `lidere-builder-f3i` → autenticar).
7. **Pré-visualização dentro do app.** Na pasta em que a sessão foi aberta, crie `.claude/launch.json` (se ainda não existir) para o painel abrir no navegador embutido do app:
   ```json
   {"version": "0.0.1", "configurations": [{"name": "painel", "url": "http://127.0.0.1:8765", "port": 8765}]}
   ```

No fim, diga em 2 linhas o que está pronto. Sugira fechar e abrir o Claude uma vez (para os comandos passarem a valer pelo nome) e pergunte: "Quer montar um painel agora? Diga qual pergunta do negócio ele deve responder."

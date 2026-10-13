# Lidere Builder

Plugin do Claude e CLI `lidere-painel` para montar **painéis vivos** sobre o ERP da sua empresa e publicar no portal Lidere, com governança: só leitura, escopos por perfil e auditoria.

Este repositório é só a distribuição do plugin. O conhecimento do ERP, as regras de SQL e a execução das consultas ficam no servidor MCP do seu portal, sob controle da sua empresa e da Lidere.

## Instalação (Windows ou macOS)

Pré-requisitos: o app do Claude e o Git (git-scm.com, opções padrão). Não precisa de admin nem de conta no GitHub.

1. **Cadastre o marketplace da Lidere** (uma vez por computador). No app do Claude (aba **Code**) o comando `/plugin` não existe, então use um dos dois caminhos:
   - **Terminal** (PowerShell no Windows, Terminal no macOS), se o comando `claude` existir:
     ```
     claude plugin marketplace add Lidere-Sistemas/lidere.builder.plugin
     claude plugin install lidere-builder@lidere
     ```
   - **Arquivo de configurações**, se só houver o app: abra `%USERPROFILE%\.claude\settings.json` (Windows) ou `~/.claude/settings.json` (macOS) e acrescente, sem apagar o que já existe:
     ```json
     "extraKnownMarketplaces": {
       "lidere": { "source": { "source": "github", "repo": "Lidere-Sistemas/lidere.builder.plugin" } }
     },
     "enabledPlugins": { "lidere-builder@lidere": true }
     ```
   Se aparecer *"its source doesn't match its extraKnownMarketplaces entry"*, já existe um marketplace `lidere` antigo: rode `claude plugin marketplace remove lidere` (ou corrija o `repo` no arquivo acima) e tente de novo.
2. **Feche e abra o app.** Numa sessão local da aba Code, clique em **+** › **Plugins**, confira o **lidere-builder** e informe o endereço do MCP do seu portal (a TI ou a Lidere passa, por exemplo `https://mcp.suaempresa.com.br/mcp`).
3. Peça: **"instala o Lidere Builder"**. O Claude instala a CLI, confere o endereço do MCP e faz o login no portal pelo navegador.
4. Peça o painel: **"monta um painel com ..."**.

**Atualizações:** a cada sessão o plugin confere se a CLI tem a mesma versão dele e, se não tiver, o Claude atualiza antes de montar qualquer painel. O portal recusa pacote gerado por versão antiga.

## Dados e privacidade

- A CLI guarda o login do portal em `~/.lidere-builder/config.json` (só o seu usuário lê). Para sair, apague o arquivo ou revogue o token no portal (MCP › Meus tokens do MCP).
- As consultas rodam no servidor do portal da sua empresa, só leitura, com escopos por perfil e auditoria por usuário.
- O resultado das consultas que você pede ao Claude é enviado à Anthropic, que processa como operadora conforme os termos do seu plano do Claude. Avalie isso na política de dados (LGPD) da sua empresa.
- A pré-visualização (`lidere-painel servir`) só escuta em `127.0.0.1` e só atende a própria página.

## Segurança

Achou uma vulnerabilidade? Veja [SECURITY.md](SECURITY.md).

## Suporte

Lidere Sistemas · contato@lideresistemas.com.br

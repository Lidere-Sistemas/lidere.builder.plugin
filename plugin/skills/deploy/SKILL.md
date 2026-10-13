---
name: deploy
description: Publica o painel da pasta atual (ou da pasta informada) direto no portal do cliente. Valida o contrato, roda cada consulta pela governança do portal, empacota e publica com o login do usuário. Se ele não puder publicar, gera o zip e abre a pasta para subir pela tela. Use quando o usuário disser deploy, publicar, sobe o painel, sobe pro portal, mandar para o portal.
---

# Deploy do painel no portal

1. Descubra a pasta do painel: a informada pelo usuário ou a pasta atual (precisa ter `painel.json`). Se houver mais de um painel e o usuário não disse qual, pergunte.
2. Confirme que ele viu a tela na pré-visualização e disse que terminou (o ciclo da skill `lidere-builder`). Se não viu, mostre antes com `lidere-painel servir <pasta>`.
3. Se o painel já foi publicado antes, suba a `versao` no `painel.json` (versão publicada é imutável). Na dúvida, confira no portal.
4. Rode:

   ```
   lidere-painel publicar <pasta>
   ```

   Ele valida o contrato, roda cada consulta pelo portal, empacota e publica. O portal confere de novo o guard, os escopos e a permissão do usuário ("Painéis > Cadastro de Painéis" para painel; "Programas Especiais > Cadastro de Programas" para programa).
5. Diga em uma linha o que foi publicado (nome, versão, novo ou atualizado) e mostre o link que o comando imprimiu, para o usuário clicar.

Se o portal recusar, mostre a mensagem como veio e explique o que fazer:
- **login expirado:** rode `lidere-painel entrar` (o endereço do MCP fica salvo) e tente de novo;
- **sem permissão de publicar:** gere o zip com `lidere-painel empacotar <pasta> --mostrar` (abre a pasta com o arquivo selecionado) e diga quem pode subir em Painéis > Cadastro de Painéis (programa, com entidades: Programas Especiais > Cadastro de Programas), ou que o administrador libera a permissão no perfil;
- **escopo faltando:** o administrador libera o escopo no perfil (MCP > Escopo: ...);
- **versão já publicada com outro conteúdo:** suba a versão no `painel.json`.

Nunca contorne uma recusa do portal.

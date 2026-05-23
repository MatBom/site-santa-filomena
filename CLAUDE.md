# CLAUDE.md — Flora Santa Filomena Site

## Papel: Orchestrator

Este projeto roda no modo **orquestrador com dois subagents**. Não edite código diretamente — delegue.

### Subagents

- **Frontend** (`subagent_type: general-purpose`)
  - Responsável: HTML, CSS, JS, layout, assets, ajustes visuais, build/deploy config.
  - Edita arquivos do projeto (`index.html`, `assets/`, `package.json`, `vercel.json`, etc).
  - Não roda validação visual — entrega e o orquestrador chama o QA.

- **QA** (`subagent_type: general-purpose`)
  - Responsável: validação via Playwright, screenshots, checagem de network/console, verificação de regressões.
  - Scripts vivem na raiz (`check-video.mjs`, `scroll-frames.mjs`, `raw-video.mjs`, `dims.mjs`).
  - Servidor local roda em `npx serve .` (porta dinâmica — pergunte ao orquestrador a porta ativa).
  - Reporta achados com evidência (screenshot, dump de estado), não interpreta especificação.

### Fluxo padrão

1. Usuário descreve o que quer mudar.
2. Orquestrador formula a tarefa, decide se é Frontend, QA ou ambos.
3. Spawna subagent com prompt self-contained (contexto, critério de aceite, restrições).
4. Recebe relatório do subagent, valida, e — se necessário — encadeia o próximo (ex.: Frontend mudou CSS → QA tira screenshot e reporta).
5. Orquestrador commita e faz push (subagents não tocam em git destrutivo sem confirmação).

### Restrições

- Não delegar `git push`, deploys, ou ações destrutivas — fica com o orquestrador.
- Subagents podem ler livremente; escrita só dentro do diretório do projeto.
- Antes de instalar pacote novo, orquestrador confirma com o usuário.

## Stack & contexto técnico

- Site estático em HTML/CSS/JS. Entrada: `index.html`.
- Hospedagem: Vercel (auto-deploy no push do main, repo `MatBom/site-santa-filomena`).
- Local dev: `npx serve .` (sem build).
- Vídeo de fundo: portrait 720x1280 em `assets/flora-bloom-scrub.mp4` (reencode com all-keyframes para scrub fluido). Original em `assets/flora-bloom.mp4`.
- Animação: GSAP + ScrollTrigger via CDN. `currentTime` do vídeo é scrubado pelo progresso do scroll.

## Memória persistente

Detalhes de preferências, decisões e contexto histórico ficam em
`C:\Users\User\.claude\projects\C--GitBI-Flora-Santa-Filomena-Site\memory\` (auto-injetadas em sessões futuras).

# Projeto Móveis Planejados — Esqueleto

Este diretório contém o sistema de projetos de móveis planejados, com API Node.js/Express, Agent IA via N8N, gerador paramétrico, viewer web híbrido Three.js e adaptadores para saídas técnicas. O orçamento permanece disponível como funcionalidade complementar.

Arquivos criados:
- agent-ia.js (esqueleto das ferramentas para o Agent IA)
- telegram-bot.js (esqueleto do bot com Telegraf)
- orcamento_moveis_schema.sql (schema PostgreSQL)
- n8n-workflows.json (workflows base)
- OrcamentosApp.jsx, Dashboard.jsx (componentes React de exemplo)
- .env.example, SETUP.md, EXEMPLOS_API.md

Instruções rápidas: veja SETUP.md e HYBRID_ARCHITECTURE.md.

A base híbrida está organizada em `hybrid-contract.js`, `api/hybrid-routes.js` e `public/hybrid-viewer.mjs`. A API central continua sendo a fonte de verdade; FreeCAD, Blender e nesting são registrados como jobs para workers externos, enquanto o viewer e a exportação GLB funcionam no navegador.

O conversor de rascunho usa `draft-converter.js`, `draft-vision.js` e `api/draft-routes.js`: recebe JSON de evidências ou imagem multipart, analisa família e componentes, extrai OCR e medidas explicitamente escritas quando um provedor multimodal está configurado, e exige confirmação das dimensões antes de converter. As rotas são `POST /api/drafts/analyze-image`, `POST /api/drafts/analyze` e `POST /api/drafts/convert`; o status visual está em `GET /api/drafts/vision/status` e a conversão incompleta retorna HTTP 422 com `validation.critical_missing`. A imagem não é convertida diretamente em CAD: ela gera uma proposta revisável.

Quando a chave OpenAI já estiver configurada no N8N, o fluxo recomendado não replica a credencial no backend: o Webhook do N8N recebe o binário no campo `image`, o nó OpenAI interpreta a imagem com saída JSON Schema, `n8n/normalize-draft-vision.js` monta o `draft_payload` e um HTTP Request envia esse JSON para `POST /api/drafts/analyze`. O schema reutilizável está em `n8n/draft-vision-schema.json` e o prompt em `n8n/draft-vision-prompt.md`. O blueprint `n8n-workflows.json` continua sendo descritivo, não um export nativo importável.

Scripts úteis:
- node apply_schema.js    # aplica orcamento_moveis_schema.sql usando variáveis do .env
- node seed_sample_data.js # insere dados de exemplo (executar após aplicar o schema)


# Projeto Móveis Planejados — Esqueleto

Este diretório contém um esqueleto inicial do sistema de orçamentos para móveis planejados (API Node.js, agent IA, bot Telegram, workflows n8n, componentes React).

Arquivos criados:
- agent-ia.js (esqueleto das ferramentas para o Agent IA)
- telegram-bot.js (esqueleto do bot com Telegraf)
- orcamento_moveis_schema.sql (schema PostgreSQL)
- n8n-workflows.json (workflows base)
- OrcamentosApp.jsx, Dashboard.jsx (componentes React de exemplo)
- .env.example, SETUP.md, EXEMPLOS_API.md

Instruções rápidas: veja SETUP.md

Scripts úteis:
- node apply_schema.js    # aplica orcamento_moveis_schema.sql usando variáveis do .env
- node seed_sample_data.js # insere dados de exemplo (executar após aplicar o schema)


# SETUP - Instruções rápidas para rodar o projeto localmente

Pré-requisitos:
- Node.js 16+
- PostgreSQL
- (Opcional) n8n, SketchUp para integrações

Passos:
1. Copie o arquivo .env.example para .env e preencha as variáveis.
2. Instale dependências do backend:
   npm install
3. Crie o banco e rode o schema:
   psql -U <user> -d <db> -f orcamento_moveis_schema.sql
4. Inicie a API:
   npm run start
5. (Frontend) Crie um app React ou copie os componentes OrcamentosApp.jsx e Dashboard.jsx para seu projeto React.
6. (n8n) Importe n8n-workflows.json como base para criar os workflows.

Observações:
- Os arquivos agent-ia.js e telegram-bot.js são esqueleto. Configure as chaves no .env para ativar o bot e a integração com a API de IA.

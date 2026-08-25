# Integração N8N — Móveis Planejados

## Estado do fluxo

O arquivo `../n8n-workflows.json` é um blueprint descritivo dos workflows, não um export nativo importável pelo N8N. Ele descreve cinco automações:

| Workflow | Gatilho | Objetivo |
|---|---|---|
| Bookipi Scraper | Cron diário às 22:00 | Extrair orçamentos e enviar o evento `orcamento-criado` |
| Notificar Cliente | Webhook `/webhook/orcamento-criado` | Personalizar mensagem, enviar Telegram e registrar log |
| Follow-up 7 dias | Cron diário às 09:00 | Buscar orçamentos enviados há mais de sete dias |
| Relatório Diário | Cron diário às 18:00 | Buscar dados do dia, calcular KPIs e notificar o administrador |
| Gerar Móveis | Webhook `/webhook/gerar-moveis` | Validar uma especificação, gerar BOM e enfileirar jobs FreeCAD/SketchUp |

## Fluxo que já pode ser executado

O workflow **Gerar Móveis** é o único que possui correspondência completa com as rotas de geração já implementadas:

1. O N8N recebe uma especificação JSON pelo webhook `/webhook/gerar-moveis`.
2. O N8N envia a especificação para `POST /api/generate/bom`.
3. O N8N envia a mesma especificação para `POST /api/generate/freecad`.
4. O N8N envia a mesma especificação para `POST /api/generate/sketchup`.
5. A API grava o BOM em CSV e os jobs em `saida_poc/freecad_jobs` e `saida_poc/sketchup_jobs`.

A rota `POST /api/cutlists` foi implementada na API Express e persiste o módulo, as peças, o cutlist e seus itens nas tabelas do schema combinado.

## Banco de dados

O schema combinado fornecido para esta integração está versionado em `../combined_schema.sql`. Ele reúne as tabelas comerciais (`clientes`, `orcamentos` e `orcamento_itens`), as tabelas de fabricação (`materiais`, `modulos`, `pecas`, `cutlists` e `cutlist_items`) e as tabelas Floorplanner.

O servidor não executa migrações automaticamente. Para preparar um banco vazio ou completar tabelas inexistentes, execute manualmente:

```bash
psql -U SEU_USUARIO -h localhost -p 5432 -d orcamentos_moveis -f combined_schema.sql
```

O comando usa `CREATE TABLE IF NOT EXISTS` e não deve ser executado sem confirmar o banco de destino. Nenhuma migração foi executada nesta tarefa.

## Variáveis necessárias

Configure no ambiente do N8N:

```dotenv
API_URL=http://127.0.0.1:8091
TELEGRAM_BOT_TOKEN=seu_token
```

`API_URL` deve apontar para a API Express (`api/server.js`) quando o workflow **Gerar Móveis** for utilizado. Se a API estiver rodando na porta padrão, use `http://127.0.0.1:8090`; para executar simultaneamente ao servidor web da raiz, use `PORT=8091`.

Não coloque tokens reais neste repositório. Use as credenciais próprias do N8N ou variáveis de ambiente protegidas.

## Validação

Antes de importar ou configurar um workflow, execute:

```bash
node n8n/validate-workflows.js
```

O comando verifica se o JSON é válido, lista os workflows, extrai os endpoints HTTP e aponta endpoints descritos no blueprint que não estão implementados nos servidores versionados.

## Pendências que exigem decisão

Os workflows comerciais ainda dependem de duas rotas que não existem atualmente: `POST /webhook/orcamento-criado` e `POST /api/logs`. As rotas `GET /api/orcamentos`, `GET /api/relatorios/dia` e `POST /api/cutlists` foram implementadas usando as tabelas existentes. A rota de logs continua pendente porque o schema fornecido não contém uma tabela de logs.

Além disso, os nós `Puppeteer`, `ExtractTable`, `Function` e `GerarMensagemClaude` estão descritos apenas por pseudocódigo no blueprint. Eles precisam ser configurados como nós nativos do N8N, com credenciais e scripts reais, antes de serem considerados workflows prontos para produção.

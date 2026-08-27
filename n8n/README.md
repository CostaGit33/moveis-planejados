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
API_URL=https://api.novaagencian8n.online
TELEGRAM_BOT_TOKEN=seu_token
```

`API_URL` deve apontar para a API Express (`api/server.js`) quando o workflow **Gerar Móveis** for utilizado. Em produção, use `https://api.novaagencian8n.online`. O webhook de entrada conversacional usado atualmente é `https://webhook.novaagencian8n.online/webhook/moveis-pedido`; os fluxos comerciais descritos no blueprint são legados e permanecem separados.

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

## Arquitetura híbrida do montador

O fluxo principal continua recebendo o pedido pelo Webhook e usando o Agent para interpretar linguagem natural. O orçamento permanece disponível, mas não é uma dependência da visualização ou da geração técnica.

Sequência recomendada:

```text
Webhook
  -> AI Agent
  -> Preparar Projeto
  -> POST /api/projetos/normalizar
  -> POST /api/hybrid/scene
  -> POST /api/orcamentos/calcular   (opcional nesta fase)
  -> POST /api/hybrid/jobs            (opcional por tipo)
  -> Montar Resposta
  -> Respond to Webhook
```

A rota `POST /api/hybrid/scene` recebe o projeto normalizado e devolve `project`, `parts` e `scene`. A cena usa milímetros, o sistema de coordenadas `x=largura,y=profundidade,z=altura` e materiais PBR básicos. Essa saída é consumida pelo viewer Three.js no navegador.

A rota `GET /api/hybrid/capabilities` informa os adaptadores disponíveis. O viewer web e o adaptador SketchUp estão disponíveis; FreeCAD, Blender e nesting ficam registrados como jobs até que existam workers externos para consumir os arquivos.

Para registrar uma geração técnica, use `POST /api/hybrid/jobs` com um corpo semelhante a:

```json
{
  "type": "freecad",
  "project": "={{ $json.projeto }}",
  "options": {
    "format": "step+techdraw"
  }
}
```

Os valores dinâmicos devem ser inseridos no modo Expression do N8N, sem colocar o objeto em aspas. Os tipos aceitos são `freecad`, `sketchup`, `blender` e `nesting`. O retorno `202` significa que o contrato foi registrado; não significa que um worker externo já executou o job.

O fluxo deve tratar orçamento, render e exportação como saídas independentes. Não se deve bloquear a cena 3D porque o PostgreSQL está indisponível, nem executar FreeCAD ou Blender a cada alteração de campo. O browser deve permanecer rápido e os workers devem ser acionados após confirmação ou solicitação de exportação.


## Conversor de rascunho de módulo

O conversor de rascunho trabalha em duas etapas e mantém a revisão humana antes da geração paramétrica. A versão atual também aceita imagem para gerar o draft intermediário automaticamente:

```text
Webhook `/webhook/rascunho-modulo`
  -> imagem + pedido
  -> POST `/api/drafts/analyze-image` (multipart, campo `image`)
  -> confirmar medidas e componentes
  -> POST `/api/drafts/analyze` (revalidação JSON)
  -> POST `/api/drafts/convert`
  -> POST `/api/hybrid/scene`
  -> BOM e jobs técnicos opcionais
  -> Respond to Webhook
```

`/api/drafts/analyze-image` recebe `multipart/form-data` com o arquivo no campo `image` e um campo textual opcional `pedido`. O backend mantém a imagem somente em memória, chama um provedor OpenAI-compatible multimodal, extrai OCR, dimensões explicitamente escritas e componentes com caixas em pixels, e devolve `draft_payload` para revisão. As dimensões extraídas da imagem permanecem como sugestões; não são confirmadas automaticamente.

Configure `VISION_API_BASE`, `VISION_API_KEY`, `VISION_MODEL` e opcionalmente `VISION_MAX_IMAGE_BYTES` no serviço da API. O status pode ser consultado em `GET /api/drafts/vision/status`. Sem as duas primeiras variáveis, a rota retorna HTTP 503 de forma explícita, sem tentar adivinhar parâmetros.

`/api/drafts/analyze` continua recebendo um draft JSON com `source`, `calibration`, `evidence`, `assumptions` e `open_questions`. Depois da revisão, a UI aplica as quatro medidas confirmadas manualmente, revalida o draft e habilita a conversão. `/api/drafts/convert` só converte quando largura, profundidade, altura e espessura da chapa estão preenchidas; caso contrário, retorna HTTP 422 com `validation.critical_missing`.

O arquivo `examples/rascunho-modulo-estante.json` continua sendo o fixture calibrado para testar o fluxo JSON sem depender do provedor visual. A imagem de produção segue o princípio `imagem -> evidências -> revisão -> projeto`, não uma conversão pixel-a-CAD sem supervisão.

O conversor não remove nem substitui o workflow `gerar-moveis`. O orçamento continua disponível como etapa opcional e o banco não é alterado.

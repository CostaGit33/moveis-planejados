# Integração N8N — Móveis Planejados

## Estado do fluxo

O arquivo `../n8n-workflows.json` é um blueprint descritivo dos workflows, não um export nativo importável pelo N8N. Ele descreve sete automações, incluindo o workflow híbrido de móveis e o conversor visual de rascunhos:

| Workflow | Gatilho | Objetivo |
|---|---|---|
| Bookipi Scraper | Cron diário às 22:00 | Extrair orçamentos e enviar o evento `orcamento-criado` |
| Notificar Cliente | Webhook `/webhook/orcamento-criado` | Personalizar mensagem, enviar Telegram e registrar log |
| Follow-up 7 dias | Cron diário às 09:00 | Buscar orçamentos enviados há mais de sete dias |
| Relatório Diário | Cron diário às 18:00 | Buscar dados do dia, calcular KPIs e notificar o administrador |
| Gerar Móveis | Webhook `/webhook/gerar-moveis` | Validar uma especificação, gerar BOM e enfileirar jobs FreeCAD/SketchUp |
| Converter Rascunho de Módulo | Webhook `/webhook/rascunho-modulo` | Usar OpenAI no N8N para interpretar imagem, revisar evidências e converter projeto híbrido |

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

O conversor trabalha em duas etapas e mantém a revisão humana antes da geração paramétrica. Como a credencial OpenAI já está configurada no N8N, o desenho recomendado é **N8N interpretar a imagem** e a API de móveis apenas normalizar, validar e converter o JSON de evidências. Assim, a chave não precisa ser copiada para o EasyPanel, para o frontend ou para o GitHub.

```text
Webhook `/webhook/rascunho-modulo`
  -> OpenAI: Text / Generate a Model Response
       imagem binária + pedido
       saída JSON Schema
  -> Code: Montar Draft de Evidências
       n8n/normalize-draft-vision.js
  -> POST `/api/drafts/analyze`
  -> revisão humana: medidas e componentes
  -> POST `/api/drafts/convert`
  -> POST `/api/hybrid/scene`
  -> BOM e jobs técnicos opcionais
  -> Respond to Webhook
```

No nó **Webhook**, use `POST`, o caminho `rascunho-modulo`, a resposta **Using Respond to Webhook Node** e a opção **Binary Property** com o nome `image`. O webhook de produção do N8N deve ser publicado/ativado; a URL de teste só funciona enquanto o N8N está escutando o evento de teste.

No nó **OpenAI**, selecione a credencial já existente no N8N. Para obter saída estruturada, prefira `Resource: Text`, `Operation: Generate a Model Response`, uma mensagem `Text` com as instruções técnicas e uma mensagem `Image` usando o binário `image`. Se a sua versão do N8N mostrar a opção, selecione `Output Format: JSON Schema` e use o conteúdo de `n8n/draft-vision-schema.json`. Escolha um modelo da sua conta com capacidade de visão. Não use apenas o nó de texto que recebe uma string vazia e não conecte um `Structured Output Parser` sem primeiro fornecer o conteúdo produzido pelo nó OpenAI.

As instruções da mensagem devem ser equivalentes a: analisar o desenho ou foto como rascunho de móvel planejado; retornar somente o schema; copiar OCR legível; preencher medidas apenas quando houver cota explicitamente escrita; usar `null` para medidas ausentes; registrar componentes visíveis com `kind`, `box_px`, `confidence`, `status` e `notes`; e nunca deduzir escala pela perspectiva. O arquivo `n8n/draft-vision-schema.json` é a fonte versionada do formato e `n8n/normalize-draft-vision.js` transforma as variações de saída do nó em `draft_payload`.

No HTTP Request **Analisar Rascunho JSON**, use `POST`, `Content-Type: JSON` e o corpo no modo Expression, sem aspas ao redor do objeto:

```text
={{ $json.draft_payload }}
```

A URL deve ser `={{ $env.API_URL }}/api/drafts/analyze`, com `API_URL=https://api.novaagencian8n.online` no ambiente do N8N. O retorno contém `draft.proposal.module`, `draft.evidence` e `validation`. Faça a revisão humana dos componentes e das quatro medidas críticas antes de chamar `/api/drafts/convert`.

Após a revisão, o corpo do HTTP Request de conversão deve ser o draft revisado, por exemplo `={{ $json }}` quando o item atual já for o draft, ou `={{ $json.draft_payload }}` quando a revisão tiver alterado esse objeto. A conversão só é aceita com largura, profundidade, altura e espessura da chapa válidas; caso contrário, a API retorna HTTP 422 com `validation.critical_missing`.

A rota `POST /api/drafts/analyze-image` continua disponível para uso direto pela interface web quando o serviço da API tiver um provedor próprio configurado. Ela não é necessária para este workflow N8N, porque neste desenho a imagem é interpretada pelo nó OpenAI do N8N. Não configure `VISION_API_KEY` no backend apenas para reutilizar a chave do N8N; são ambientes separados.

O arquivo `examples/rascunho-modulo-estante.json` continua sendo o fixture calibrado para testar o fluxo JSON sem consumir créditos. A imagem de produção segue o princípio `imagem -> evidências -> revisão -> projeto`, não uma conversão pixel-a-CAD sem supervisão. O conversor não remove nem substitui o workflow `gerar-moveis`, o orçamento continua opcional e o banco não é alterado.

### Versão antiga do N8N

Se a instalação não tiver `Generate a Model Response` ou suporte a mensagem `Image`, use o nó `OpenAI -> Image -> Analyze Image` com a mesma credencial e o binário `image` para obter descrição/OCR. Nesse caso, a saída pode não ser JSON Schema; acrescente um segundo nó `OpenAI -> Text` ou um parser estruturado para transformar a descrição em exatamente o formato de `n8n/draft-vision-schema.json` antes do nó `Montar Draft de Evidências`. Não envie a descrição livre diretamente para `/api/drafts/analyze`, pois a API exige evidências estruturadas.

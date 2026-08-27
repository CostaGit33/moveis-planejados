# Diagnóstico do workflow visual no N8N

## Estado observado

O workflow `Conversor de Rascunho - OpenAI` foi publicado no N8N e contém a sequência Webhook -> Analyze image -> Montar Draft de Evidências -> HTTP Request -> Respond to Webhook.

O teste de produção POST `/webhook/rascunho-modulo` retornou HTTP 200 sem corpo, mas a execução 261 falhou no nó `Analyze image` com: `The item has no binary field 'image' [item 0]`.

A execução confirma que o problema ocorre antes do OpenAI e não na API de móveis. O Webhook mostra método POST, resposta `Using 'Respond to Webhook' Node`, opção `Field Name for Binary Data` com valor `image` e URL de produção `https://webhook.novaagencian8n.online/webhook/rascunho-modulo`. Após a correção, o fluxo passou pelo OpenAI e retornou JSON completo.

## Documentação confirmada

A documentação oficial do N8N informa que a opção do Webhook para receber arquivo é `Binary Property`, que grava o arquivo no nome de propriedade binária configurado. A operação OpenAI `Analyze Image` usa `Binary File(s)` e exige que o `Input Data Field Name` corresponda ao nome dessa propriedade.

Referências:

- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/
- https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-langchain.openai/image-operations/

## Correção aplicada

A configuração efetivamente publicada foi ajustada para que o nó OpenAI leia `image0,image1`, propriedades criadas pelo Webhook para os dois arquivos enviados no campo multipart `image`. O Code node foi sincronizado com o adaptador versionado, incluindo parsing de `content[0].text`/`output_text`, remoção do fence Markdown, combinação de componentes aninhados, suporte a `box`/`box_px` e preservação de `null` para medidas ausentes.

O Analyze image passou a usar **Length of Description (Max Tokens) = 2000**, evitando o truncamento observado com o valor padrão de 300.

Não há medidas confirmadas nas imagens neste registro. Qualquer dimensão legível deverá permanecer como sugestão até confirmação humana.

## Imagens recebidas para o próximo teste

- `/home/ubuntu/upload/IMG-20260824-WA0028.jpg`: rascunho de ambiente em U com janela, espelho e gaveteiro central.
- `/home/ubuntu/upload/IMG-20260824-WA0023.jpg`: módulo vertical com laterais, prateleiras e divisórias internas.

As imagens não foram alteradas nem sobrescritas.

## Execução 267 após publicação de múltiplas propriedades

A execução de produção `267` foi concluída com sucesso em 7,61 s e recebeu os dois binários no nó `Analyze image`: `image0` correspondeu a `IMG-20260824-WA0028.jpg` e `image1` a `IMG-20260824-WA0023.jpg`. O nó OpenAI retornou conteúdo de visão para as duas imagens, mas sua resposta livre veio como um objeto com `view` em formato de array; cada entrada continha `description` e `components`. Esse formato não obedecia ao formato plano esperado pelo adaptador antigo, que procurava apenas `vision.components` no nível superior. Por isso a execução terminou com HTTP 200, mas com `draft.evidence=[]`, `source.filename=null` e uma proposta genérica.

A correção necessária no Code node é normalizar a saída real `content[0].text`/`output_text`, remover o fence Markdown, aceitar `view`/`views` como coleção de análises, elevar e combinar os componentes aninhados em `draft.evidence`, e preservar os nomes `image0` e `image1` em `draft.source`. Medidas não presentes no texto das imagens continuam nulas e com `calibration.status=needs_confirmation`.

## Causa raiz confirmada em 27/08/2026

O Webhook de teste recebeu o arquivo quando chamado pelo host `https://webhook.novaagencian8n.online/webhook-test/rascunho-modulo`. A saída visual do nó mostrou o binário com a propriedade `image0` e o arquivo `IMG-20260824-WA0028.jpg`.

A documentação oficial e a discussão da equipe N8N confirmam que, quando a opção **Binary Property / Field Name for Binary Data** está habilitada, o valor configurado vira um prefixo e o N8N acrescenta um índice para arquivos multipart. Portanto, com o valor `image`, a propriedade efetiva é `image0`, não `image`. Isso explica exatamente o erro do nó OpenAI: `The item has no binary field 'image'`.

A URL de teste exibida no editor foi `https://painel.novaagencian8.online/webhook-test/rascunho-modulo`, mas esse host retornou 404 mesmo durante a escuta. O mesmo caminho no host de webhooks `webhook.novaagencian8n.online` retornou 200 e disparou a execução de teste. A URL de produção continua sendo `https://webhook.novaagencian8n.online/webhook/rascunho-modulo`.

A documentação do nó OpenAI Analyze Image descreve `Binary File(s)` como o nome da propriedade binária que contém a imagem. A correção mínima para um arquivo é alterar `Input Data Field Name` de `image` para `image0`. Para múltiplos arquivos, o fluxo deverá preservar e analisar `image0` e `image1` ou processar os itens separadamente; não presumir que uma única propriedade conterá as duas imagens.

Fontes consultadas:

- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/
- https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-langchain.openai/image-operations
- https://community.n8n.io/t/webhook-accepting-multipart-data-from-form-loses-name-of-binary-data-input-files/15945
- https://community.n8n.io/t/multiple-files-in-one-field-for-form-multipart-data-in-an-http-request/31302

## Observações visuais das imagens anexadas

### IMG-20260824-WA0028.jpg

A imagem é um rascunho manual em perspectiva de um ambiente/mobiliário em formato de U. Observam-se dois conjuntos laterais, um trecho posterior central e um vão central identificado como `Janela`. Há a anotação manuscrita `Espelho` abaixo da janela e uma indicação próxima ao piso que parece mencionar `sapateiro`, mas a escrita está parcialmente ambígua. O desenho mostra prateleiras e divisões laterais, um conjunto de gavetas no lado esquerdo e um conjunto frontal/direito abaixo da janela. Também aparecem módulos superiores rasos no trecho posterior, com divisórias verticais. Não há cotas legíveis suficientes para calibrar a escala; os números de telefone/documentos ao fundo não são especificação do móvel.

### IMG-20260824-WA0023.jpg

A imagem é um rascunho manual em perspectiva de um módulo vertical independente, aberto na frente, com duas laterais, tampo superior e base inferior. O interior possui vários níveis horizontais de prateleiras e divisões verticais intermediárias. Visualmente, há ao menos quatro vãos/prateleiras principais empilhados, mas a separação entre prateleira, divisor e frente de gaveta deve ser confirmada. Não há cotas, espessura de chapa ou escala legível. A imagem deve gerar uma proposta de família `estante` ou `armario_aberto`, não uma peça pronta para fabricação.

### Limites de interpretação

As anotações `Janela`, `Espelho` e a possível indicação de `sapateiro` são evidências textuais/visuais, não medidas. As proporções da perspectiva não podem ser convertidas em milímetros sem uma dimensão de referência confirmada pelo usuário. A primeira imagem representa um ambiente com módulos, enquanto a segunda representa um módulo separado; não se deve fundi-los em uma única caixa cúbica.

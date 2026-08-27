# Checklist de evolução — Móveis Planejados

**Atualizado em:** 27 de agosto de 2026
**Branch:** `main`
**Estado do Git:** limpa e sincronizada com `origin/main`
**Último commit:** `b525694 — Connect N8N OpenAI vision to draft converter`

## 1. Visão executiva

O projeto já possui uma base própria de montador paramétrico híbrido. Ele não depende do Floorplanner. A API Express centraliza o projeto JSON, o frontend gera a cena 3D no navegador, o N8N interpreta pedidos e pode usar a credencial OpenAI existente para interpretar imagens, e os adaptadores técnicos ficam desacoplados como jobs.

O principal fluxo que está pronto em código é:

```text
Imagem ou rascunho JSON
  -> interpretação visual no N8N ou na rota visual direta
  -> evidências estruturadas
  -> revisão de medidas e componentes
  -> projeto JSON paramétrico
  -> BOM e cena híbrida
  -> viewer Three.js e exportação GLB
```

A parte que ainda impede considerar o fluxo operacional completo é a configuração efetiva dos nós no seu N8N e a execução de um teste público com a sua credencial OpenAI. O repositório contém o blueprint, o prompt, o schema e o script do nó Code, mas o blueprint não é um export nativo que possa ser ativado automaticamente na sua conta sem o ID da credencial e sem acesso ao editor do N8N.

## 2. O que já está confirmado e funcional

| Item | Estado | Evidência ou observação |
|---|---:|---|
| Repositório GitHub | `[x]` | `main` sincronizada com `origin/main` |
| API Express consolidada | `[x]` | `api/server.js` é a entrada de produção; o `server.js` da raiz foi preservado como legado/local |
| API pública | `[x]` | `https://api.novaagencian8n.online/` |
| Health check | `[x]` | `/health` validado publicamente |
| Fluxo existente do N8N | `[x]` | Webhook de pedido, Agent e rotas de normalização preservados |
| Contrato híbrido | `[x]` | `hybrid-contract.js`, versão `schema_version: 1.1` |
| Viewer Three.js | `[x]` | Viewer próprio, com eixo `x=largura`, `y=profundidade`, `z=altura` |
| Móvel montado | `[x]` | Laterais, tampo, base, fundo, prateleiras, portas, gavetas, frentes, puxadores, pés e componentes separados |
| Correção do painel traseiro | `[x]` | Fundo reposicionado no lado posterior real; proteção adicionada ao teste híbrido |
| Cena híbrida | `[x]` | `POST /api/hybrid/scene` devolve projeto, peças e nós da cena |
| Exportação GLB | `[x]` | Exportação da cena atual pelo navegador |
| Jobs técnicos | `[x]` | Rotas e contratos para FreeCAD, SketchUp, Blender e nesting; execução ainda depende de workers externos |
| BOM/cutlist | `[x]` | Código existente preservado e integrado ao fluxo híbrido |
| Orçamento | `[x]` | Preservado como etapa complementar, fora do foco do montador |
| Conversor JSON de rascunho | `[x]` | `draft-converter.js` e rotas `analyze`/`convert` |
| Fixture paramétrico | `[x]` | `examples/rascunho-modulo-estante.json` |
| Bloqueio de segurança | `[x]` | Conversão incompleta retorna HTTP 422 quando faltam dimensões críticas |
| Upload direto de imagem | `[x]` | `POST /api/drafts/analyze-image`, com upload em memória e limite configurável |
| OCR e evidências visuais | `[x]` | Contrato para texto, componentes, caixas em pixels, confiança e perguntas |
| Editor de evidências no frontend | `[x]` | Permite classificar componentes e recalcular contadores paramétricos |
| Confirmação manual | `[x]` | Largura, profundidade, altura e espessura permanecem sujeitas à confirmação |
| Integração OpenAI no N8N | `[x]` | Blueprint, schema, prompt e script Code versionados no repositório |
| Credencial OpenAI | `[x]` | Já existe no N8N, segundo a configuração informada pelo usuário; não foi copiada para o código |
| Skill reutilizável | `[x]` | `moveis-draft-converter`, validada com `quick_validate.py` |
| Banco de dados | `[x]` | Nenhuma alteração de schema ou migração foi executada nesta etapa |
| Testes | `[x]` | `npm run check`, `npm test` e testes do adaptador N8N passaram |

## 3. O que está quase pronto

| Item | Estado | O que falta para fechar |
|---|---:|---|
| Workflow de imagem no N8N | `[~]` | Criar ou ajustar os nós no editor, selecionar a credencial OpenAI existente, ativar o workflow e executar uma chamada real |
| Entrada multipart no N8N | `[~]` | Configurar o Webhook com `Binary Property=image` e confirmar o nome do binário na execução |
| Saída estruturada OpenAI | `[~]` | Selecionar modelo com visão e colar `n8n/draft-vision-schema.json` em `Output Format: JSON Schema` |
| Ponte para a API | `[~]` | Colar `n8n/normalize-draft-vision.js` no nó Code e configurar o HTTP Request para enviar `={{ $json.draft_payload }}` |
| Revisão dentro do N8N | `[~]` | O blueprint descreve a revisão, mas o mecanismo operacional ainda deve ser escolhido: revisão pelo Studio web ou formulário/espera no N8N |
| Teste público de imagem | `[~]` | Executar uma chamada real no webhook de produção usando uma imagem e observar o retorno do projeto |
| Rota direta de visão da API | `[~]` | Só é necessária se a interface web for analisar a imagem sem passar pelo N8N; nesse caso, configurar um provedor no backend |
| Proteção do webhook | `[~]` | Definir Header Auth, Basic Auth ou JWT no Webhook de produção antes de uso público, caso o endpoint não esteja protegido por outra camada |
| Persistência da imagem original | `[~]` | Atualmente a imagem é mantida em memória durante a análise; armazenamento histórico ainda não foi implementado |

## 4. O que precisa ser finalizado

### 4.1 Configuração real no N8N

A sequência mínima para fechar o primeiro fluxo é criar os seguintes nós reais no workflow `Converter Rascunho de Módulo`:

| Ordem | Nó | Configuração obrigatória |
|---:|---|---|
| 1 | Webhook | `POST`, caminho `rascunho-modulo`, resposta `Using Respond to Webhook Node`, `Binary Property=image` |
| 2 | OpenAI | Credencial já existente, `Text -> Generate a Model Response`, modelo com visão, mensagem de imagem usando o binário `image`, saída JSON Schema |
| 3 | Code | Conteúdo de `n8n/normalize-draft-vision.js` |
| 4 | HTTP Request | `POST {{ $env.API_URL }}/api/drafts/analyze`, corpo JSON `={{ $json.draft_payload }}` |
| 5 | Revisão | Studio web ou mecanismo real de aprovação no N8N |
| 6 | HTTP Request | `POST {{ $env.API_URL }}/api/drafts/convert` com o draft revisado |
| 7 | HTTP Request | `POST {{ $env.API_URL }}/api/hybrid/scene` com o projeto convertido |
| 8 | Respond to Webhook | Retornar o primeiro item JSON |

A variável do N8N deve ser `API_URL=https://api.novaagencian8n.online`. A chave OpenAI não deve ser colocada em `API_URL`, no JSON do workflow ou no repositório.

### 4.2 Teste de ponta a ponta

O teste mínimo deve comprovar que uma imagem enviada ao webhook produz evidências, que o usuário consegue revisar componentes, que as quatro medidas críticas são confirmadas e que a conversão cria um módulo que aparece no viewer. O retorno não deve ser considerado fabricação pronta; ele é uma proposta paramétrica revisável.

### 4.3 Mecanismo de aprovação

A revisão é uma parte funcional, não um detalhe opcional. O modelo pode identificar uma prateleira como divisória ou ler uma cota de forma incorreta. Por isso, o fluxo deve impedir `/api/drafts/convert` até que os quatro campos críticos estejam preenchidos e os componentes ambíguos tenham sido classificados.

A decisão recomendada para a primeira versão é usar o Studio web já existente para a revisão visual. O N8N pode retornar ou encaminhar o `draft` ao operador, e o Studio envia a versão confirmada para a conversão. Um formulário interativo dentro do próprio N8N pode ser adicionado depois, mas não deve ser improvisado como um nó conceitual sem persistência da aprovação.

### 4.4 Workers técnicos

As rotas de jobs já registram solicitações, mas ainda não executam FreeCAD, Blender ou nesting em workers reais. O próximo avanço de fabricação exige um worker externo que consuma o job, gere o arquivo técnico, atualize o status por `PATCH` e registre artefatos. O viewer web e a exportação GLB não dependem dessa etapa.

## 5. Próximos passos na ordem correta

| Fase | Ação | Resultado esperado |
|---:|---|---|
| 1 | Configurar os nós reais no N8N com a credencial OpenAI existente | Imagem recebida como binário e resposta JSON estruturada |
| 2 | Ativar o workflow e testar o webhook de produção | Execução visível na aba de execuções do N8N |
| 3 | Conferir `/api/drafts/analyze` | `draft.evidence`, OCR, perguntas e `validation` retornados |
| 4 | Revisar medidas e componentes no Studio | Sem `unknown` não resolvido e quatro dimensões críticas confirmadas |
| 5 | Executar `/api/drafts/convert` | Projeto `schema_version: 1.1` com módulo paramétrico |
| 6 | Executar `/api/hybrid/scene` | Cena com componentes separados e viewer atualizado |
| 7 | Exportar GLB e revisar a montagem | Arquivo visual para conferência, sem substituir validação técnica |
| 8 | Criar o primeiro worker técnico | Job FreeCAD ou Blender processado fora do container web |
| 9 | Adicionar testes de regressão com mais famílias | Portas, gavetas, closet, módulos inferiores e composição em L |
| 10 | Evoluir para multi-módulo e ambiente | Projeto com vários módulos, paredes, aberturas e posicionamento |

## 6. Avanços esperados por horizonte

| Horizonte | Avanço | Critério de conclusão |
|---|---|---|
| Agora | Uma imagem vira um draft estruturado no N8N | OCR/evidências aparecem e a análise não retorna texto livre vazio |
| Próximo | Draft visual vira módulo paramétrico revisável | Medidas confirmadas, contadores coerentes e viewer com peças separadas |
| Curto prazo | Fluxo visual confiável para famílias de móveis | Testes com armário aberto, portas, gavetas e closet |
| Médio prazo | Composição de ambiente | Vários módulos, paredes, aberturas, planta 2D e posicionamento |
| Médio prazo | Saída técnica real | Worker FreeCAD/Blender, arquivos técnicos e status de job |
| Posterior | Fabricação assistida | Regras de usinagem, ferragens, nesting e validação de interferências |

## 7. Limitações atuais que devem permanecer explícitas

A imagem não fornece escala real por si só. O sistema não deve transformar proporções visuais em milímetros. Medidas só podem ser preenchidas automaticamente quando uma cota estiver legível e associada ao desenho; nos demais casos, o operador deve confirmar os valores.

O fluxo atual também não é uma conversão automática de foto para CAD. Ele produz evidências e uma proposta paramétrica. A fabricação exige validação humana, regras de montagem e, posteriormente, workers técnicos.

A credencial OpenAI do N8N não é visível nem reutilizável automaticamente pelo container da API. A integração correta é N8N usar a credencial e enviar o resultado estruturado para a API. A rota direta `/api/drafts/analyze-image` permanece como alternativa independente e exige uma credencial configurada no backend, caso seja utilizada.

A imagem é processada em memória na rota direta. Não existe ainda um repositório histórico de imagens, versionamento de revisões ou trilha de aprovação persistida no banco. Implementar isso exigirá decisão explícita sobre armazenamento e schema, e não deve ser feito silenciosamente.

## 8. Critério para considerar o projeto pronto para a próxima evolução

O próximo marco deve ser considerado concluído somente quando uma imagem real for enviada pelo Webhook do N8N, o modelo OpenAI retornar JSON no schema, o operador classificar as evidências, confirmar as quatro dimensões, a API aceitar a conversão, o viewer mostrar o módulo separado em componentes e a execução ficar registrada sem expor a credencial.

Depois desse marco, a prioridade técnica recomendada é **multi-módulo e worker técnico**, não geração automática sem revisão. O caminho mais seguro é aumentar a capacidade paramétrica gradualmente, mantendo o projeto JSON central como fonte única da verdade.

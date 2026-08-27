# Avaliação técnica: rascunhos para móveis e ambientes paramétricos

**Projeto:** Móveis Planejados
**Objetivo:** avaliar a possibilidade de reproduzir móveis e ambientes a partir de rascunhos, desenhos de referência e imagens, convertendo o resultado em um projeto paramétrico editável.

## 1. Conclusão executiva

A ideia é tecnicamente viável e está alinhada com a arquitetura híbrida já iniciada. Entretanto, o produto não deve tentar transformar qualquer imagem diretamente em um arquivo de fabricação. O caminho robusto é tratar a imagem como **evidência de projeto**, gerar uma proposta paramétrica com níveis de confiança e solicitar confirmação humana para as medidas que não podem ser deduzidas com segurança.

A divisão recomendada é:

> **Imagem ou rascunho → interpretação assistida → rascunho paramétrico revisável → projeto 3D → documentação de fabricação.**

O ponto mais importante é separar três coisas que hoje estão misturadas: a intenção visual do cliente, a geometria estimada e as medidas confirmadas. Uma fotografia renderizada pode indicar que existe um armário, uma torre, uma gaveta ou uma prateleira, mas não fornece, sozinha, escala confiável, espessura da chapa, profundidade real, ferragens ou condições da parede.

Portanto, o sistema deve ser **semi-automático**: a inteligência propõe e organiza; o usuário confirma as medidas críticas; o motor paramétrico constrói a versão consistente.

## 2. O que os exemplos demonstram

| Tipo de referência | O que pode ser extraído | O que não deve ser presumido |
|---|---|---|
| Render ou foto de móvel aberto | Corpo, laterais, tampo, base, nichos, prateleiras, portas, gavetas, pés e linguagem visual | Medidas reais, espessura, profundidade oculta, ferragens e tolerâncias |
| Desenho técnico limpo | Relação entre divisórias, vãos, prateleiras e painéis; contagem aproximada de componentes | Escala absoluta sem uma medida de referência |
| Rascunho manual de ambiente | Layout linear, em L ou em U; posição aproximada de janela, espelho, sapateira, portas e módulos | Texto manuscrito parcialmente ilegível, medidas em perspectiva e alinhamentos exatos |
| Esboço manual de um módulo | Intenção de divisão interna, quantidade de vãos, prateleiras e possíveis portas | Dimensões de cada componente, sistema construtivo e sequência de montagem |

Os exemplos enviados formam um conjunto útil porque cobrem quatro níveis diferentes: um módulo isolado, um armário com divisões repetidas, um ambiente completo desenhado à mão e um esboço de marcenaria mais conceitual. Isso indica que o montador precisa aceitar **mais de um tipo de entrada**, e não apenas uma imagem única.

### 2.1. O armário aberto com prateleiras

O desenho frontal em perspectiva apresenta um corpo vertical com duas laterais, tampo, base, painel traseiro, prateleiras horizontais e divisórias verticais. Esse exemplo é o mais simples para o primeiro conversor, porque a geometria é regular e as repetições são evidentes.

A conversão paramétrica pode começar com um módulo do tipo `estante` ou `armario_aberto`, com parâmetros para quantidade de vãos, quantidade de prateleiras, largura das colunas, espessura da chapa e existência de fundo. A imagem permite propor a topologia do móvel, mas uma dimensão conhecida ainda é necessária para produzir uma escala real.

### 2.2. O closet renderizado

A imagem renderizada mostra um ambiente composto por vários módulos, prateleiras, gaveteiros, cabideiros, painéis laterais e um elemento central. Ela é valiosa para reconhecer **famílias de componentes** e a organização do ambiente, mas não deve ser usada como fonte única de medidas.

Para esse caso, o sistema deve gerar vários módulos independentes, com tipos como `torre_roupas`, `gaveteiro`, `cabideiro`, `prateleira` e `painel_lateral`. O ambiente precisa ser modelado antes dos móveis, incluindo paredes, vãos e circulação. O projeto não deve ser representado como um único móvel gigante.

### 2.3. O rascunho do ambiente em U ou L

O desenho manual do ambiente contém informação de maior valor para o produto: há uma intenção de layout, módulos nos lados, um elemento central e anotações de elementos como janela, espelho e sapateira. Esse tipo de entrada exige interpretação de planta ou perspectiva, identificação dos limites do ambiente e confirmação de cada medida relevante.

A leitura automática deve produzir candidatos, não decisões definitivas. Por exemplo, o sistema pode identificar três trechos de mobiliário e uma janela provável, mas deve marcar a posição da janela, a profundidade dos módulos e a largura da circulação como itens a confirmar.

### 2.4. O esboço de módulo com divisórias

O desenho a lápis do módulo mostra um corpo vertical, diversas prateleiras e divisórias internas. É uma boa entrada para testar a reprodução da intenção de marcenaria. O sistema consegue reconhecer que existem níveis horizontais e separações verticais, mas não deve inferir automaticamente se cada vão terá porta, gaveta, nicho aberto ou apenas prateleira.

A melhor experiência é apresentar uma camada de revisão: o usuário clica em cada vão e escolhe `nicho`, `porta`, `gaveta`, `cabideiro` ou `prateleira`. Essa pequena confirmação produz muito mais confiabilidade do que tentar adivinhar todos os acabamentos a partir do desenho.

## 3. Viabilidade por nível de precisão

| Nível | Resultado | Viabilidade |
|---|---|---|
| 0 — Referência visual | Identificar estilo, tipo de móvel e componentes prováveis | Alta |
| 1 — Rascunho paramétrico | Gerar um módulo ou ambiente aproximado, editável no viewer | Alta |
| 2 — Projeto calibrado | Gerar medidas coerentes a partir de uma ou mais dimensões conhecidas | Alta, com confirmação |
| 3 — Lista de peças | Gerar BOM e cutlist coerentes com regras de fabricação | Alta para famílias conhecidas |
| 4 — Fabricação sem revisão | Produzir arquivos finais sem conferência humana | Não recomendada |

A primeira versão deve ter como objetivo o **nível 1**, avançando para o nível 2 quando o usuário fornecer pelo menos uma dimensão de referência. O nível 3 já é suportado parcialmente pelo gerador atual, mas precisa receber uma descrição mais completa da composição. O nível 4 não deve ser prometido para imagens ambíguas.

## 4. O que deve ser automático e o que precisa de confirmação

### 4.1. Automação adequada

O sistema pode sugerir o tipo de layout, detectar linhas horizontais e verticais, contar prateleiras aparentes, localizar possíveis laterais e tampo, reconhecer gavetas e portas quando há frentes bem desenhadas, agrupar componentes repetidos e gerar uma primeira estrutura de módulos.

Também pode normalizar unidades, aplicar espessuras padrão, criar identificadores, calcular posições relativas e alimentar o viewer com uma cena paramétrica. Essas tarefas são compatíveis com o contrato central já existente.

### 4.2. Confirmação obrigatória

O usuário deve confirmar a escala, pelo menos uma medida real, profundidade, pé-direito, espessura da chapa, recuos, posição de portas e janelas, altura de bancadas, tipo de abertura, quantidade real de gavetas, sistema de corrediça, dobradiças, folgas e qualquer interferência arquitetônica.

A regra de segurança deve ser explícita: **uma imagem pode sugerir uma geometria, mas não pode confirmar uma medida que não esteja informada ou calibrada**.

## 5. Lacunas do projeto atual

O projeto já possui bons fundamentos: o `furniture-builder.js` gera peças para módulos individuais; o `hybrid-contract.js` possui unidade em milímetros, materiais PBR, fabricação e nós de cena; o viewer Three.js já mostra uma montagem com laterais, tampo, base, fundo, prateleiras, portas, gavetas e ferragens; e a API híbrida já registra cenas e jobs.

Para reproduzir os exemplos enviados, ainda faltam os seguintes blocos:

| Lacuna | Impacto |
|---|---|
| Entrada de imagem ou rascunho | Não existe um fluxo de ingestão e análise de referência |
| Contrato de evidência | O projeto não registra qual imagem originou cada componente nem o nível de confiança |
| Revisão humana | Não há tela para corrigir vãos, medidas, paredes, janelas e classificações |
| Ambiente multi-módulo | A interface atual é centrada em um módulo principal; os exemplos exigem vários módulos coordenados |
| Tipos de composição | Ainda faltam famílias específicas para estante, closet, torre, cabideiro, gaveteiro, nicho e canto |
| Layout em L/U | Falta um modelo próprio para trechos de parede, cantos, folgas e módulos orientados |
| Componentes por vão | Portas, gavetas, prateleiras e cabideiros precisam ser definidos por compartimento, não somente por contagem global |
| Aberturas arquitetônicas | Janela, porta, espelho e passagem devem ser obstáculos do ambiente |
| Calibração de escala | É preciso converter pixels ou proporções do desenho para milímetros usando uma medida conhecida |
| Geração técnica por família | O BOM atual é bom para módulos básicos, mas ainda não conhece todos os sistemas de montagem e ferragens |

Essas lacunas não invalidam a arquitetura atual. Elas indicam que o próximo passo não é aumentar o número de caixas 3D, mas criar uma camada intermediária de **rascunho interpretado e revisável**.

## 6. Contrato recomendado para rascunhos

O projeto final deve continuar sendo a fonte de verdade, mas deve receber uma camada anterior chamada `draft`. Um formato conceitual seria:

```json
{
  "draft": {
    "id": "DRAFT-001",
    "source": {
      "type": "image",
      "filename": "rascunho-closet.jpg",
      "view": "perspectiva",
      "width_px": 1152,
      "height_px": 1536
    },
    "calibration": {
      "status": "needs_confirmation",
      "reference_dimension": null,
      "reference_value_mm": null
    },
    "evidence": [
      {
        "id": "EVID-001",
        "kind": "horizontal_shelf",
        "box_px": { "x": 120, "y": 340, "width": 640, "height": 20 },
        "confidence": 0.91,
        "status": "proposed"
      }
    ],
    "assumptions": [],
    "open_questions": [
      "Qual é a largura total do móvel?",
      "Qual é a profundidade?",
      "As divisões são nichos abertos ou possuem portas?"
    ]
  },
  "project": {
    "schema_version": "1.1",
    "unidade": "mm",
    "ambiente": {},
    "paredes": [],
    "aberturas": [],
    "modulos": []
  }
}
```

O campo `evidence` é importante porque permite explicar por que um componente foi criado. O campo `confidence` impede que uma inferência seja confundida com medida confirmada. O campo `open_questions` transforma a incerteza em uma tarefa objetiva para o usuário.

## 7. Pipeline híbrido recomendado

### Etapa 1 — Entrada

O usuário envia uma ou mais imagens e, opcionalmente, uma descrição textual. O sistema deve aceitar foto de papel, desenho limpo, render de referência e imagem de ambiente.

### Etapa 2 — Preparação

A imagem é rotacionada, recortada e normalizada. Texto manuscrito deve ser extraído quando possível, mas qualquer trecho ilegível deve ser marcado como ilegível, não preenchido por aproximação silenciosa.

### Etapa 3 — Interpretação

Um componente de visão/OCR propõe elementos: paredes, vãos, módulos, prateleiras, portas, gavetas, cabideiros, espelhos e equipamentos. Cada proposta recebe caixa, tipo, confiança e ligação com a evidência original.

### Etapa 4 — Calibração

O usuário informa uma medida conhecida, como largura total, altura do móvel ou largura de uma porta. O sistema calcula a escala apenas para a região compatível e avisa quando a perspectiva impede uma calibração confiável.

### Etapa 5 — Revisão

O usuário ajusta paredes, cantos, módulos e componentes no viewer. Os campos críticos devem aparecer como perguntas simples, por exemplo: `Profundidade do módulo`, `Espessura da chapa`, `Quantidade de portas` e `A posição indicada é janela ou nicho?`.

### Etapa 6 — Geração paramétrica

A resposta revisada é convertida em `project`, com módulos posicionados em milímetros. O gerador de peças produz BOM e cutlist; o viewer produz a cena montada; e os workers técnicos recebem jobs opcionais.

### Etapa 7 — Saídas

As saídas devem ser separadas: JSON do projeto, cena GLB, lista de peças, desenho técnico, arquivo de corte e render. Nenhuma saída deve substituir o JSON central.

## 8. Famílias de móveis que devem ser priorizadas

A prioridade recomendada é começar por famílias regulares e repetíveis:

| Ordem | Família | Parâmetros principais |
|---|---|---|
| 1 | Estante/armário aberto | colunas, linhas, prateleiras, fundo, divisórias |
| 2 | Gaveteiro | quantidade de gavetas, altura das frentes, corrediças, recuos |
| 3 | Torre de closet | módulos laterais, cabideiro, prateleiras, gavetas |
| 4 | Armário com portas | quantidade de portas, folgas, dobradiças, sentido de abertura |
| 5 | Trecho linear | largura do trecho, módulos adjacentes, alinhamento |
| 6 | Composição em L | dois trechos, canto, orientação, módulo de canto |
| 7 | Composição em U | três trechos, dois cantos, circulação e aberturas |

A família deve controlar não apenas a aparência, mas também as regras de fabricação. Um `gaveteiro` não pode ser apenas uma caixa com quatro frentes desenhadas; precisa produzir componentes internos compatíveis e reservar espaço para o sistema de corrediça escolhido.

## 9. Parâmetros mínimos do montador

### Ambiente

```json
{
  "largura": 3200,
  "profundidade": 2800,
  "pe_direito": 2700,
  "paredes": [],
  "aberturas": [],
  "circulacao_minima": 800
}
```

### Módulo

```json
{
  "id": "MOD-001",
  "tipo": "torre_closet",
  "x": 0,
  "y": 0,
  "z": 0,
  "largura": 600,
  "profundidade": 600,
  "altura": 2400,
  "espessura_chapa": 18,
  "material": "mdf_areia",
  "componentes": []
}
```

### Composição interna

```json
{
  "componentes": [
    {
      "tipo": "prateleira",
      "id": "COMP-001",
      "z": 720,
      "largura": 564,
      "profundidade": 582,
      "quantidade": 1,
      "status_medida": "confirmada"
    },
    {
      "tipo": "divisoria_vertical",
      "id": "COMP-002",
      "x": 300,
      "altura": 684,
      "status_medida": "proposta"
    }
  ]
}
```

### Incerteza e revisão

Cada parâmetro derivado do rascunho deve poder conter:

```json
{
  "valor": 600,
  "unidade": "mm",
  "origem": "usuario",
  "confianca": 1,
  "status": "confirmada"
}
```

Os estados mínimos são `proposta`, `confirmada`, `corrigida` e `bloqueada`. Um job de fabricação não deve ser liberado quando houver parâmetros críticos em `proposta`.

## 10. Arquitetura de implementação no projeto atual

A evolução mais simples e robusta é manter o que já existe e acrescentar uma camada de rascunho:

```text
Upload / N8N
    ↓
Draft Interpreter
    ↓
Draft Review JSON
    ↓
Project JSON central
    ├── Viewer Three.js
    ├── BOM / cutlist
    ├── Export GLB
    ├── FreeCAD job
    ├── SketchUp job
    └── Blender render job
```

No backend, a primeira entrega deveria criar um módulo de contrato e duas rotas novas:

```text
POST /api/drafts/analyze
POST /api/drafts/convert
```

`/api/drafts/analyze` receberia uma referência e devolveria propostas com evidências e perguntas. `/api/drafts/convert` receberia o rascunho revisado e devolveria um `project` válido. Essas rotas não devem chamar FreeCAD, Blender ou SketchUp diretamente; devem preparar o JSON e, quando solicitado, registrar jobs.

No frontend, a primeira tela nova deveria ter três áreas: imagem de referência, painel de perguntas e viewer 3D. O usuário precisa conseguir alternar entre `sobreposição do rascunho`, `proposta paramétrica` e `móvel montado`.

No N8N, o fluxo pode continuar usando o Agent para interpretar texto, mas a imagem deve entrar em um ramo próprio:

```text
Webhook
  ↓
AI Agent — pedido textual
  ↓
Draft Interpreter — imagem e evidências
  ↓
Preparar Projeto
  ↓
Normalizar Projeto API
  ↓
Cena híbrida
  ├── BOM/orçamento opcional
  ├── Job FreeCAD opcional
  ├── Job SketchUp opcional
  └── Job Blender opcional
  ↓
Respond to Webhook
```

O orçamento permanece disponível como etapa opcional, conforme a decisão anterior, mas não deve controlar a criação geométrica.

## 11. Riscos técnicos

O maior risco é a falsa precisão: o sistema pode produzir um modelo visualmente convincente com medidas erradas. Para evitar isso, toda dimensão não fornecida deve ser marcada como estimada ou pendente.

Outro risco é confundir perspectiva com planta. Uma foto ou render em perspectiva não permite medir todos os eixos sem pontos de fuga, referência métrica e hipóteses sobre profundidade. O produto deve apresentar um aviso de calibração, não esconder a limitação.

Também existe o risco de interpretar mobiliário de referência como projeto do cliente. Uma imagem de inspiração deve gerar estilo e composição sugerida, enquanto um rascunho com medidas deve gerar geometria calibrável. Os dois casos precisam ter modos de entrada diferentes.

Por fim, a geração de peças não deve ser liberada apenas porque o viewer ficou bonito. Antes de produção, o projeto precisa passar por validações de interferência, vãos mínimos, espessuras, folgas, orientação do veio e compatibilidade das ferragens.

## 12. Recomendação objetiva

O projeto deve avançar em três incrementos, nesta ordem:

1. **MVP de rascunho de módulo:** aceitar uma imagem de estante ou armário aberto, criar propostas de laterais, tampo, base, fundo, prateleiras e divisórias, pedir uma medida conhecida e gerar o móvel no viewer.

2. **MVP de composição de ambiente:** aceitar o rascunho do closet, criar vários módulos, paredes e aberturas, permitir ajuste de layout linear/L/U e gerar a cena montada.

3. **Conversão técnica controlada:** após confirmação, gerar BOM, cutlist, GLB, desenho técnico e jobs de FreeCAD/SketchUp/Blender, bloqueando a fabricação quando ainda existirem medidas críticas não confirmadas.

A conclusão é positiva: **o montador próprio pode reproduzir os exemplos, mas deve reproduzir primeiro a estrutura paramétrica e não a aparência final**. A aparência vem depois, como renderização da mesma estrutura. Essa abordagem evita que o sistema produza imagens bonitas de móveis que não podem ser construídos.

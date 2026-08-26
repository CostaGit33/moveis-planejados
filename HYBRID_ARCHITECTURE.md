# Arquitetura híbrida — Móveis Planejados

## Princípio

O projeto usa um único modelo JSON normalizado como fonte de verdade. A mesma estrutura alimenta o viewer web, a lista de peças, o SketchUp, os jobs FreeCAD, os jobs Blender e o nesting. Nenhum renderizador externo deve recalcular as regras de fabricação por conta própria.

O orçamento permanece no projeto e nas rotas atuais, mas não é requisito para abrir a cena, editar o módulo ou registrar um job técnico.

## Camadas

| Camada | Responsabilidade | Estado atual |
|---|---|---|
| Entrada/N8N | Receber pedido e interpretar linguagem natural | Existente no fluxo N8N |
| API central | Normalizar projeto e preservar compatibilidade | Express em `api/server.js` |
| Contrato híbrido | Adicionar `schema_version`, fabricação, render e cena | `hybrid-contract.js` |
| Gerador de peças | Transformar módulos em peças e cutlist | `furniture-builder.js` |
| Viewer web | Visualizar a cena e módulos com interação orbital | Three.js local em `public/hybrid-viewer.mjs` |
| SketchUp | Gerar Ruby para adaptação externa | Existente em `sketchup-generator-v2.js` |
| FreeCAD | Registrar job técnico para worker externo | Fila `hybrid_jobs`, worker ainda necessário |
| Blender | Registrar job de preview/render final | Fila `hybrid_jobs`, worker ainda necessário |
| Nesting | Registrar job de aproveitamento de chapa | Fila `hybrid_jobs`, engine ainda necessário |

## Contrato de projeto

Os projetos continuam aceitando os campos existentes, como `unidade`, `ambiente`, `paredes`, `modulos`, `material`, `portas`, `gavetas` e `prateleiras`. A versão `1.1` acrescenta campos compatíveis:

```json
{
  "schema_version": "1.1",
  "unidade": "mm",
  "fabricacao": {
    "unidade": "mm",
    "kerf": 3,
    "margem": 10,
    "rotacao_permitida": true,
    "veio": "preservar"
  },
  "render": {
    "engine": "three",
    "pipeline": "glb-compatível",
    "materiais": "pbr"
  }
}
```

O contrato utiliza `x` para largura, `y` para profundidade e `z` para altura. As medidas do domínio continuam em milímetros; o viewer converte internamente para metros para renderização.

## Endpoints híbridos

| Método | Endpoint | Objetivo | Resultado |
|---|---|---|---|
| `GET` | `/api/hybrid/capabilities` | Informar adaptadores e formatos | Capacidades e status |
| `POST` | `/api/hybrid/scene` | Enriquecer o projeto e gerar a cena interna | `project`, `parts` e `scene` |
| `POST` | `/api/hybrid/jobs` | Registrar job para worker | HTTP `202` e `job_id` |
| `GET` | `/api/hybrid/jobs/:jobId` | Consultar job | Estado e entrada do job |
| `PATCH` | `/api/hybrid/jobs/:jobId` | Atualizar execução/artefatos | Estado atualizado |

Os tipos de job aceitos são `freecad`, `sketchup`, `blender` e `nesting`. O retorno `worker_status: waiting_worker` é intencional: a API registra o contrato, mas não finge que FreeCAD, Blender ou nesting estão instalados no container Express.

## Fluxo de execução

```text
Pedido do cliente
      ↓
N8N + Agent
      ↓
POST /api/projetos/normalizar
      ↓
POST /api/hybrid/scene
      ├── Viewer Three.js no navegador
      ├── Gerador de peças/cutlist
      ├── POST /api/hybrid/jobs { type: freecad }
      ├── POST /api/hybrid/jobs { type: blender }
      └── POST /api/hybrid/jobs { type: nesting }
```

O viewer não depende do PostgreSQL e os workers não devem ser executados a cada tecla digitada. A interface pode atualizar a cena localmente; os jobs devem ser criados após salvar, confirmar ou solicitar exportação.

## Worker externo

Um worker real deve observar ou receber os jobs, alterar o estado para `running`, gerar artefatos, publicar os arquivos em armazenamento apropriado e atualizar o job para `completed` ou `failed` usando `PATCH /api/hybrid/jobs/:jobId`.

O contrato mínimo de atualização é:

```json
{
  "status": "completed",
  "worker_status": "completed",
  "artifacts": [
    { "type": "dxf", "path": "freecad/MOD-001.dxf" },
    { "type": "png", "path": "blender/preview.png" }
  ]
}
```

O container atual do EasyPanel continua sendo a API Express. A instalação e a operação de FreeCAD, Blender e um engine de nesting devem ocorrer em workers separados quando essa etapa for ativada em produção. Nenhuma alteração de banco foi feita para implementar essa fundação.

## Validação realizada

A fundação foi validada com `npm run check`, `npm test`, parsing do `projeto_base.json`, carregamento HTTP do asset Three.js e abertura do viewer local. O teste automatizado cobre capacidades, geração de cena, criação de job e atualização de job.

# SETUP - Instruções rápidas para rodar o projeto localmente

Pré-requisitos:
- Node.js 16+
- PostgreSQL (necessário para `/api/orcamentos`, `/api/relatorios/dia` e `/api/cutlists`)
- (Opcional) n8n, SketchUp e FreeCAD para as integrações

## 1. Configurar ambiente

Copie `.env.example` para `.env` e preencha as variáveis do PostgreSQL.

A API consolidada usa `PORT=8090` por padrão. Se alterar a porta, atualize também `API_URL` para que os workflows/n8n apontem para o mesmo endereço.

## 2. Instalar dependências

Na raiz do projeto:

```bash
npm install
```

O `npm start` usa `api/server.js`, portanto não é necessário iniciar o `server.js` antigo separadamente.

## 3. Criar o banco

Use o schema consolidado, que contém as tabelas de móveis, cutlists, clientes, orçamentos e Floorplanner:

```bash
psql -U <user> -d <db> -f combined_schema.sql
```

Também é possível usar `node apply_schema.js` depois de conferir as variáveis do `.env`.

## 4. Validar a sintaxe

```bash
npm run check
```

Esse comando verifica a API consolidada, rotas, builder e frontend JavaScript.

## 5. Iniciar

```bash
npm start
```

Teste:

```bash
curl http://localhost:8090/health
```

A resposta esperada contém `status: "ok"`.

## 6. Endpoints principais

- `GET /health`
- `GET /api/fluxo`
- `POST /api/agent/interpretar`
- `POST /api/projetos/normalizar`
- `POST /api/orcamentos/calcular`
- `POST /api/fluxo/simular`
- `POST /api/generate/bom`
- `POST /api/generate/freecad`
- `POST /api/generate/sketchup`
- `POST /api/cutlists`
- `GET /api/orcamentos`
- `GET /api/relatorios/dia`
- `POST /webhook/gerar-moveis`

## Docker

O `Dockerfile` inicia diretamente a API consolidada com `node api/server.js` e expõe a porta 80 dentro do container. O provedor de hospedagem deve encaminhar a porta pública para essa porta do container.

## Observações

- `agent-ia.js` e `telegram-bot.js` continuam sendo esqueletos e não são iniciados automaticamente pelo servidor.
- O workflow `n8n-workflows.json` é uma especificação de referência; ele não é um export nativo do n8n.
- FreeCAD e SketchUp são enfileirados como jobs e precisam de um worker/plugin no ambiente que execute esses arquivos.

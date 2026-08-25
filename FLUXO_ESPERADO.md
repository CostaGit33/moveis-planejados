# Ligacoes do fluxo esperado

Este arquivo documenta as ligacoes criadas no MVP local a partir das conversas e imagens analisadas.

## Objetivo

Conectar, de forma executavel e local, o fluxo esperado do projeto Moveis Planejados:

```text
Telegram / Chat
  -> Agent IA
  -> n8n
  -> API Central
  -> Motor 2D/3D
  -> Orcamento
  -> Dashboard / Relatorio
```

Nesta etapa, as integracoes sao simuladas localmente. Nenhuma credencial foi criada, nenhum banco foi alterado e nenhuma API externa e chamada.

## Endpoints locais criados

### `GET /api/fluxo`

Retorna o mapa das etapas do fluxo esperado.

### `POST /api/agent/interpretar`

Recebe:

```json
{
  "pedido": "Quero uma cozinha em L de 3,20m x 2,80m com pia e cooktop"
}
```

Retorna uma interpretacao local simples com ambiente, layout, medidas, itens e material preferido.

### `POST /api/projetos/normalizar`

Recebe pedido e/ou interpretacao e retorna o projeto no JSON central.

### `POST /api/orcamentos/calcular`

Recebe um projeto e retorna:

- lista de pecas;
- area estimada de MDF;
- ferragens;
- mao de obra;
- total estimado.

### `POST /api/fluxo/simular`

Executa o fluxo completo em uma chamada:

1. recebe pedido;
2. interpreta como Agent IA;
3. marca comando como validado pelo n8n;
4. normaliza projeto na API central;
5. gera pecas para motor 2D/3D;
6. calcula orcamento;
7. retorna payload para dashboard.

## Interface

A tela principal em `public/index.html` agora possui:

- botao `Simular Fluxo`;
- bloco `Fluxo Esperado`;
- visualizacao das etapas conectadas;
- payload JSON do fluxo completo.

## Como executar

```powershell
npm start
```

Depois abra:

```text
http://127.0.0.1:8090
```

## Proxima evolucao

Trocar os conectores simulados por conectores reais, etapa por etapa:

- Telegram Bot real;
- Agent IA com provedor configuravel;
- n8n com webhook;
- PostgreSQL para persistencia;
- exportacao PDF;
- integracao futura com Floorplanner, SketchUp ou FreeCAD.

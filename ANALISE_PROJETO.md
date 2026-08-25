# Analise inicial do projeto

Data: 2026-08-25

## Arquivos analisados

### Textos

- `moveis.txt`
- `conversa-inicial.txt`
- `conversa-claude-ia.txt`
- `README_POC.md`
- `saida_poc/relatorio.md`

### Imagens

- `imagem_1.png`
- `imagem_2.png`
- `imagem_3.png`
- `imagem_4.png`

As imagens originais tinham nomes longos com acentos e espacos. Foram criadas copias com nomes simples para facilitar leitura e uso no projeto.

## Diagnostico geral

O material aponta para um sistema maior dividido em duas frentes:

1. Sistema de projeto de moveis planejados com IA.
2. Sistema de orcamentos inteligentes com automacao comercial.

Essas duas frentes devem compartilhar uma mesma API central e um mesmo banco de dados. A decisao tecnica mais importante e tratar o JSON do projeto como fonte unica da verdade, e nao depender de uma ferramenta externa como nucleo do produto.

## Frente 1: Projeto de moveis planejados

### Objetivo

Transformar uma solicitacao em linguagem natural, como:

> Quero uma cozinha em L de 3,20 m x 2,80 m com pia, cooktop, torre quente, geladeira e armarios madeira/cinza.

em:

- planta 2D;
- visualizacao 3D;
- modelo tecnico;
- lista de materiais;
- orcamento;
- relatorio/PDF para aprovacao.

### Fluxo alvo

```text
Cliente
  -> Telegram / Chat
  -> Agent IA
  -> n8n
  -> API Node.js
  -> Modelo central JSON
  -> Motor 2D/3D
  -> Orcamento / PDF / Dashboard
```

### Ferramentas avaliadas

- Floorplanner: melhor para planta, editor visual e apresentacao rapida.
- SketchUp: forte para modelagem detalhada e extensao Ruby.
- FreeCAD: forte para parametrizacao aberta e geracao tecnica.
- Blender: melhor como motor de render.
- Three.js: melhor para visualizacao web propria no longo prazo.
- Revit: poderoso, mas pesado para iniciar.

### Conclusao tecnica

Para o MVP, o caminho mais seguro e continuar com um motor proprio simples em JSON + visualizacao local em Three.js/Canvas, e depois conectar motores externos quando o modelo central estiver estavel.

## Frente 2: Orcamentos inteligentes

### Objetivo

Criar uma interface alternativa melhorada ao processo atual com Bookipi/Promob Plus, usando automacao, IA e dashboard.

### Fluxo alvo

```text
Usuario no Telegram
  -> Agent IA
  -> n8n
  -> API Node.js/Express
  -> PostgreSQL
  -> Dashboard React
```

### Funcoes principais

- criar cliente;
- criar orcamento;
- listar clientes;
- listar orcamentos;
- obter orcamento;
- atualizar status/desconto;
- analisar cliente;
- gerar relatorio;
- follow-up automatico;
- notificacoes via Telegram;
- exportacao Excel/PDF.

### Endpoints sugeridos

```text
GET    /api/clientes
POST   /api/clientes
GET    /api/orcamentos
POST   /api/orcamentos
GET    /api/orcamentos/:id
PUT    /api/orcamentos/:id
POST   /api/orcamentos/:id/itens
DELETE /api/orcamentos/:id/itens/:item_id
POST   /webhook/orcamento-criado
```

## Analise das imagens

### `imagem_1.png`

Mostra um MVP gratuito e simples, sem APIs oficiais complexas:

- Telegram como entrada;
- Agent IA interpreta pedido;
- gerador de planta 2D com Canvas;
- render 3D simples com Three.js/WebGL;
- saidas PNG e JSON;
- lista de itens;
- limitacoes claras.

Essa imagem e a melhor referencia para o MVP imediato.

### `imagem_2.png`

Mostra o fluxo completo simulado:

- cliente;
- Agent IA;
- n8n + API;
- Floorplanner;
- SketchUp;
- renders realistas.

Essa imagem representa a evolucao com integracoes externas.

### `imagem_3.png`

Mostra a arquitetura mais completa para moveis planejados:

- API central como fonte unica da verdade;
- integracoes com Floorplanner, SketchUp, Blender, Orcamento API e PDF;
- geracao de planta 2D, visao 3D, modelo tecnico, render, lista de materiais e relatorio.

Essa imagem e a melhor referencia para a arquitetura final.

### `imagem_4.png`

Mostra o sistema de orcamentos inteligentes:

- Telegram;
- Agent IA com ferramentas;
- n8n;
- API Node.js/Express;
- PostgreSQL;
- dashboard React com metricas;
- integracoes com Gmail, Bookipi, Claude API, Excel e Telegram.

Essa imagem representa a frente comercial/operacional do sistema.

## Estado pratico atual

Ja existe um POC funcional criado nesta pasta:

- `projeto_base.json`: modelo central;
- `gerar_poc.py`: gerador tecnico;
- `saida_poc/modelo.obj`: modelo 3D simples;
- `saida_poc/lista_pecas.csv`: lista de pecas;
- `visualizador_obj.html`: visualizador local;
- servidor local na porta `8080`.

O POC atual valida:

- leitura de JSON;
- criacao de parede;
- criacao de modulo inferior 600 x 600 x 720 mm;
- decomposicao em pecas;
- geracao de OBJ/MTL;
- visualizacao local no navegador.

## Lacunas antes do MVP real

1. Definir schema definitivo do projeto.
2. Criar catalogo de modulos.
3. Adicionar precificacao.
4. Criar UI para editar medidas.
5. Criar API local em Node.js.
6. Persistir clientes/projetos/orcamentos.
7. Gerar PDF ou relatorio visual.
8. Separar motores:
   - motor 2D;
   - motor 3D simples;
   - motor de lista de pecas;
   - motor de orcamento.

## Recomendacao de proximo passo

O proximo passo mais direto e transformar o POC atual em um MVP local com interface:

1. tela de entrada do pedido;
2. formulario com medidas;
3. geracao do JSON central;
4. preview 2D;
5. preview 3D;
6. lista de pecas;
7. valor estimado;
8. botao para exportar relatorio.

Esse MVP pode ser feito sem Floorplanner, SketchUp ou FreeCAD no primeiro momento. Depois, o mesmo JSON central pode alimentar essas integracoes.

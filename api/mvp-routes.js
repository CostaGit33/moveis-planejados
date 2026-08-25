function parsePedido(pedido) {
  const texto = String(pedido || "").toLowerCase();
  const dimensoes = texto.match(/(\d+[,.]?\d*)\s*(?:m|metros?)\s*x\s*(\d+[,.]?\d*)\s*(?:m|metros?)/);
  const largura = dimensoes ? Math.round(Number(dimensoes[1].replace(",", ".")) * 1000) : 3200;
  const profundidade = dimensoes ? Math.round(Number(dimensoes[2].replace(",", ".")) * 1000) : 800;
  return {
    ambiente: texto.includes("cozinha") ? "cozinha" : "ambiente planejado",
    layout: texto.includes(" l ") || texto.includes("em l") ? "L" : "linear",
    largura,
    profundidade,
    itens: {
      pia: texto.includes("pia"),
      cooktop: texto.includes("cooktop"),
      torre_quente: texto.includes("torre"),
      geladeira: texto.includes("geladeira"),
      bancada: texto.includes("bancada"),
      armario_inferior: texto.includes("armario") || texto.includes("armário")
    },
    material_preferido: texto.includes("cinza") ? "mdf_cinza" : texto.includes("carvalho") || texto.includes("madeira") ? "mdf_carvalho" : "mdf_areia"
  };
}

const fluxoEsperado = [
  ["telegram", "Telegram / Chat", "Entrada conversacional do cliente", "Mensagem em linguagem natural", "Pedido bruto"],
  ["agent-ia", "Agent IA", "Interpreta pedido e gera dados estruturados", "Pedido bruto", "Intenção, medidas, itens e preferências"],
  ["n8n", "n8n", "Orquestra etapas e chama APIs", "Dados interpretados", "Comando validado para API central"],
  ["api-central", "API Central", "Fonte única da verdade do projeto", "Comando validado", "Projeto JSON normalizado"],
  ["motor-2d-3d", "Motor 2D/3D", "Gera planta, visualização e modelo técnico", "Projeto JSON", "Planta 2D, 3D simples e lista de peças"],
  ["orcamento", "Orçamento", "Calcula estimativa comercial", "Lista de peças e materiais", "Valor estimado e resumo para aprovação"],
  ["dashboard", "Dashboard / Relatório", "Apresenta resultado para gestão e aprovação", "Projeto, imagens e orçamento", "Visão operacional do projeto"]
].map(([id, nome, papel, entrada, saida]) => ({ id, nome, papel, entrada, saida }));

function normalizarProjeto(dados) {
  const interpretacao = dados.interpretacao || parsePedido(dados.pedido);
  return {
    unidade: "mm",
    pedido: dados.pedido || "",
    ambiente: { nome: "Projeto gerado pelo fluxo local", largura: interpretacao.largura, profundidade: interpretacao.profundidade, pe_direito: 2700 },
    paredes: [{ id: "PAREDE-001", nome: "Parede principal", x: 0, y: 0, z: 0, largura: interpretacao.largura, espessura: 120, altura: 2700, material: "alvenaria_branca" }],
    modulos: [{ id: "MOD-001", tipo: "armario_inferior", nome: "Armario inferior", x: 300, y: 120, z: 0, largura: 600, profundidade: 600, altura: 720, espessura_chapa: 18, material: interpretacao.material_preferido, portas: 2, gavetas: interpretacao.itens && interpretacao.itens.gavetas ? 4 : 0 }]
  };
}

function projectParts(project) {
  return (project.modulos || []).flatMap((module) => {
    const { x, y, z, largura: w, profundidade: d, altura: h, espessura_chapa: t, material } = module;
    const base = module.id;
    return [
      { id: `${base}-LAT-E`, nome: "Lateral esquerda", x, y, z, largura: t, profundidade: d, altura: h, material },
      { id: `${base}-LAT-D`, nome: "Lateral direita", x: x + w - t, y, z, largura: t, profundidade: d, altura: h, material },
      { id: `${base}-BASE`, nome: "Base", x, y, z, largura: w, profundidade: d, altura: t, material },
      { id: `${base}-TOPO`, nome: "Topo", x, y, z: z + h - t, largura: w, profundidade: d, altura: t, material },
      { id: `${base}-FUNDO`, nome: "Fundo", x, y: y + d - t, z, largura: w, profundidade: t, altura: h, material }
    ];
  });
}

function areaPecaM2(part) {
  const faces = [part.largura * part.profundidade, part.largura * part.altura, part.profundidade * part.altura];
  return (2 * faces.reduce((total, area) => total + area, 0)) / 1000000;
}

function calcularOrcamento(project) {
  const precos = { mdf_areia: 135, mdf_cinza: 128, mdf_carvalho: 155 };
  const pecas = projectParts(project);
  const areaMdf = pecas.reduce((total, part) => total + areaPecaM2(part), 0);
  const material = project.modulos[0] ? project.modulos[0].material : "mdf_areia";
  const valorMdf = areaMdf * (precos[material] || precos.mdf_areia) * 1.18;
  const ferragens = 180;
  const maoDeObra = 450;
  return { moeda: "BRL", area_mdf_m2: Number(areaMdf.toFixed(2)), valor_mdf: Number(valorMdf.toFixed(2)), ferragens, mao_de_obra: maoDeObra, total: Number((valorMdf + ferragens + maoDeObra).toFixed(2)) };
}

function registerMvpRoutes(app) {
  app.get("/api/fluxo", (req, res) => res.json({ fluxo: fluxoEsperado }));
  app.post("/api/agent/interpretar", (req, res) => res.json({ pedido: req.body.pedido || "", interpretacao: parsePedido(req.body.pedido) }));
  app.post("/api/projetos/normalizar", (req, res) => res.json({ projeto: normalizarProjeto(req.body || {}) }));
  app.post("/api/orcamentos/calcular", (req, res) => {
    const projeto = req.body.projeto || normalizarProjeto(req.body || {});
    res.json({ pecas: projectParts(projeto), orcamento: calcularOrcamento(projeto) });
  });
  app.post("/api/fluxo/simular", (req, res) => {
    const pedido = req.body.pedido || "";
    const interpretacao = parsePedido(pedido);
    const projeto = normalizarProjeto({ pedido, interpretacao });
    const pecas = projectParts(projeto);
    res.json({ etapas: fluxoEsperado, telegram: { pedido }, agent_ia: { interpretacao }, n8n: { status: "comando_validado", destino: "/api/projetos/normalizar" }, api_central: { projeto }, motor_2d_3d: { pecas, saidas: ["planta_2d_canvas", "visao_3d_canvas"] }, orcamento: calcularOrcamento(projeto), dashboard: { status: "pronto_para_validacao" } });
  });
}

module.exports = { registerMvpRoutes };

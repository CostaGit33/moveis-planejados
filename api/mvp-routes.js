const path = require('path');
const { generateParts } = require(path.join('..', 'furniture-builder'));

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

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildProjectModules(interpretacao) {
  const ambienteLargura = positiveNumber(interpretacao.largura, 3200);
  const ambienteProfundidade = positiveNumber(interpretacao.profundidade, 800);
  const itens = interpretacao.itens && typeof interpretacao.itens === "object" ? interpretacao.itens : {};
  const material = interpretacao.material_preferido || "mdf_areia";
  const requested = Array.isArray(interpretacao.modulos) ? interpretacao.modulos : [];

  // Mantém um módulo padrão quando o Agent ainda não detalhou módulos,
  // mas usa as medidas e recursos que já foram identificados no pedido.
  const source = requested.length > 0 ? requested : [{
    tipo: itens.pia ? "balcao_pia" : "armario_inferior",
    nome: itens.pia ? "Balcão para pia" : "Armário inferior",
    largura: 600,
    profundidade: Math.min(600, ambienteProfundidade),
    altura: 720,
    portas: itens.gavetas ? 0 : 2,
    gavetas: Number(itens.gavetas || 0),
    prateleiras: Number(itens.prateleiras || 0),
    material
  }];

  return source.map((module, index) => {
    const largura = Math.min(positiveNumber(module.largura, 600), ambienteLargura);
    const profundidade = Math.min(positiveNumber(module.profundidade, 600), ambienteProfundidade);
    const altura = positiveNumber(module.altura, 720);
    const id = module.id || `MOD-${String(index + 1).padStart(3, "0")}`;
    const xDefault = 300 + index * (largura + 20);
    const yDefault = interpretacao.layout === "L" && index > 0
      ? 120 + (index - 1) * (profundidade + 20)
      : 120;

    return {
      id,
      tipo: module.tipo || "armario_inferior",
      nome: module.nome || `Módulo ${index + 1}`,
      x: positiveNumber(module.x, xDefault),
      y: positiveNumber(module.y, yDefault),
      z: Number(module.z || 0),
      largura,
      profundidade,
      altura,
      espessura_chapa: positiveNumber(module.espessura_chapa || module.espessura, 18),
      material: module.material || material,
      portas: Math.max(0, Number(module.portas || 0)),
      gavetas: Math.max(0, Number(module.gavetas || 0)),
      prateleiras: Math.max(0, Number(module.prateleiras || 0)),
      parametros: module.parametros && typeof module.parametros === "object" ? module.parametros : {}
    };
  });
}

function normalizarProjeto(dados) {
  const interpretacao = dados.interpretacao || parsePedido(dados.pedido);
  const largura = positiveNumber(interpretacao.largura, 3200);
  const profundidade = positiveNumber(interpretacao.profundidade, 800);
  const peDireito = positiveNumber(interpretacao.altura, 2700);
  return {
    unidade: "mm",
    pedido: dados.pedido || "",
    ambiente: { nome: "Projeto gerado pelo fluxo local", largura, profundidade, pe_direito: peDireito },
    paredes: [{ id: "PAREDE-001", nome: "Parede principal", x: 0, y: 0, z: 0, largura, espessura: 120, altura: peDireito, material: "alvenaria_branca" }],
    modulos: buildProjectModules(interpretacao)
  };
}

function projectParts(project) {
  return (project.modulos || []).flatMap((module) => {
    const generated = generateParts({
      ...module,
      espessura: module.espessura_chapa
    });
    return generated.map((piece, index) => ({
      ...piece,
      id: `${module.id}-PECA-${String(index + 1).padStart(2, "0")}`,
      modulo_id: module.id,
      x: module.x,
      y: module.y,
      z: module.z
    }));
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

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 8090);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".obj": "text/plain; charset=utf-8",
  ".mtl": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

const fluxoEsperado = [
  {
    id: "telegram",
    nome: "Telegram / Chat",
    papel: "Entrada conversacional do cliente",
    entrada: "Mensagem em linguagem natural",
    saida: "Pedido bruto"
  },
  {
    id: "agent-ia",
    nome: "Agent IA",
    papel: "Interpreta pedido e gera dados estruturados",
    entrada: "Pedido bruto",
    saida: "Intencao, medidas, itens e preferencias"
  },
  {
    id: "n8n",
    nome: "n8n",
    papel: "Orquestra etapas e chama APIs",
    entrada: "Dados interpretados",
    saida: "Comando validado para API central"
  },
  {
    id: "api-central",
    nome: "API Central",
    papel: "Fonte unica da verdade do projeto",
    entrada: "Comando validado",
    saida: "Projeto JSON normalizado"
  },
  {
    id: "motor-2d-3d",
    nome: "Motor 2D/3D",
    papel: "Gera planta, visualizacao e modelo tecnico",
    entrada: "Projeto JSON",
    saida: "Planta 2D, 3D simples e lista de pecas"
  },
  {
    id: "orcamento",
    nome: "Orcamento",
    papel: "Calcula estimativa comercial",
    entrada: "Lista de pecas e materiais",
    saida: "Valor estimado e resumo para aprovacao"
  },
  {
    id: "dashboard",
    nome: "Dashboard / Relatorio",
    papel: "Apresenta resultado para gestao e aprovacao",
    entrada: "Projeto, imagens e orcamento",
    saida: "Visao operacional do projeto"
  }
];

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Payload muito grande"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function jsonResponse(req, res, status, data) {
  send(req, res, status, JSON.stringify(data, null, 2), "application/json; charset=utf-8");
}

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
    material_preferido: texto.includes("cinza")
      ? "mdf_cinza"
      : texto.includes("carvalho") || texto.includes("madeira")
        ? "mdf_carvalho"
        : "mdf_areia"
  };
}

function normalizarProjeto(dados) {
  const interpretacao = dados.interpretacao || parsePedido(dados.pedido);
  return {
    unidade: "mm",
    pedido: dados.pedido || "",
    ambiente: {
      nome: "Projeto gerado pelo fluxo local",
      largura: interpretacao.largura,
      profundidade: interpretacao.profundidade,
      pe_direito: 2700
    },
    paredes: [
      {
        id: "PAREDE-001",
        nome: "Parede principal",
        x: 0,
        y: 0,
        z: 0,
        largura: interpretacao.largura,
        espessura: 120,
        altura: 2700,
        material: "alvenaria_branca"
      }
    ],
    modulos: [
      {
        id: "MOD-001",
        tipo: "armario_inferior",
        nome: "Armario inferior",
        x: 300,
        y: 120,
        z: 0,
        largura: 600,
        profundidade: 600,
        altura: 720,
        espessura_chapa: 18,
        material: interpretacao.material_preferido,
        portas: 2,
        gavetas: interpretacao.itens && interpretacao.itens.gavetas ? 4 : 0
      }
    ]
  };
}

function pecasDoProjeto(project) {
  return project.modulos.flatMap((module) => {
    const x = module.x;
    const y = module.y;
    const z = module.z;
    const w = module.largura;
    const d = module.profundidade;
    const h = module.altura;
    const t = module.espessura_chapa;
    const material = module.material;
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
  const faces = [
    part.largura * part.profundidade,
    part.largura * part.altura,
    part.profundidade * part.altura
  ];
  return (2 * faces.reduce((total, area) => total + area, 0)) / 1000000;
}

function calcularOrcamento(project) {
  const precos = {
    mdf_areia: 135,
    mdf_cinza: 128,
    mdf_carvalho: 155
  };
  const pecas = pecasDoProjeto(project);
  const areaMdf = pecas.reduce((total, part) => total + areaPecaM2(part), 0);
  const material = project.modulos[0] ? project.modulos[0].material : "mdf_areia";
  const valorMdf = areaMdf * (precos[material] || precos.mdf_areia) * 1.18;
  const ferragens = 180;
  const maoDeObra = 450;

  return {
    moeda: "BRL",
    area_mdf_m2: Number(areaMdf.toFixed(2)),
    valor_mdf: Number(valorMdf.toFixed(2)),
    ferragens,
    mao_de_obra: maoDeObra,
    total: Number((valorMdf + ferragens + maoDeObra).toFixed(2))
  };
}

async function handleApi(req, res) {
  const urlPath = decodeURIComponent((req.url || "").split("?")[0]);

  if (req.method === "GET" && urlPath === "/api/fluxo") {
    jsonResponse(req, res, 200, { fluxo: fluxoEsperado });
    return true;
  }

  if (req.method === "POST" && urlPath === "/api/agent/interpretar") {
    try {
      const body = await readJsonBody(req);
      jsonResponse(req, res, 200, { pedido: body.pedido || "", interpretacao: parsePedido(body.pedido) });
    } catch (error) {
      jsonResponse(req, res, 400, { erro: "JSON invalido" });
    }
    return true;
  }

  if (req.method === "POST" && urlPath === "/api/projetos/normalizar") {
    try {
      const body = await readJsonBody(req);
      jsonResponse(req, res, 200, { projeto: normalizarProjeto(body) });
    } catch (error) {
      jsonResponse(req, res, 400, { erro: "JSON invalido" });
    }
    return true;
  }

  if (req.method === "POST" && urlPath === "/api/orcamentos/calcular") {
    try {
      const body = await readJsonBody(req);
      const projeto = body.projeto || normalizarProjeto(body);
      jsonResponse(req, res, 200, { pecas: pecasDoProjeto(projeto), orcamento: calcularOrcamento(projeto) });
    } catch (error) {
      jsonResponse(req, res, 400, { erro: "JSON invalido" });
    }
    return true;
  }

  if (req.method === "POST" && urlPath === "/api/fluxo/simular") {
    try {
      const body = await readJsonBody(req);
      const interpretacao = parsePedido(body.pedido);
      const projeto = normalizarProjeto({ pedido: body.pedido, interpretacao });
      const pecas = pecasDoProjeto(projeto);
      const orcamento = calcularOrcamento(projeto);
      jsonResponse(req, res, 200, {
        etapas: fluxoEsperado,
        telegram: { pedido: body.pedido || "" },
        agent_ia: { interpretacao },
        n8n: { status: "comando_validado", destino: "/api/projetos/normalizar" },
        api_central: { projeto },
        motor_2d_3d: { pecas, saidas: ["planta_2d_canvas", "visao_3d_canvas"] },
        orcamento,
        dashboard: { status: "pronto_para_validacao" }
      });
    } catch (error) {
      jsonResponse(req, res, 400, { erro: "JSON invalido" });
    }
    return true;
  }

  // Endpoint: gerar BOM/cutlist a partir de spec JSON
  if (req.method === "POST" && urlPath === "/api/generate/bom") {
    try {
      const body = await readJsonBody(req);
      const spec = body.spec || body;
      const furnitureBuilder = require('./furniture-builder');
      const outDir = path.join(ROOT, 'saida_poc');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const results = furnitureBuilder.generateFromSpec(spec, { outDir });
      // salvar spec para auditoria
      const specPath = path.join(outDir, `spec_${Date.now()}.json`);
      fs.writeFileSync(specPath, JSON.stringify(spec, null, 2), 'utf8');
      jsonResponse(req, res, 201, { ok: true, results, specPath });
    } catch (err) {
      jsonResponse(req, res, 500, { erro: String(err) });
    }
    return true;
  }

  // Endpoint: enfileirar job FreeCAD (salva spec e retorna job info)
  if (req.method === "POST" && urlPath === "/api/generate/freecad") {
    try {
      const body = await readJsonBody(req);
      const spec = body.spec || body;
      const jobsDir = path.join(ROOT, 'saida_poc', 'freecad_jobs');
      if (!fs.existsSync(jobsDir)) fs.mkdirSync(jobsDir, { recursive: true });
      const jobFile = path.join(jobsDir, `spec_${Date.now()}.json`);
      fs.writeFileSync(jobFile, JSON.stringify(spec, null, 2), 'utf8');
      // Nota: execução do FreeCAD deve ocorrer em host com FreeCAD instalado (worker/cron)
      jsonResponse(req, res, 202, { ok: true, job: jobFile });
    } catch (err) {
      jsonResponse(req, res, 500, { erro: String(err) });
    }
    return true;
  }

  // Endpoint: enfileirar job SketchUp (salva spec para plugin ler)
  if (req.method === "POST" && urlPath === "/api/generate/sketchup") {
    try {
      const body = await readJsonBody(req);
      const spec = body.spec || body;
      const jobsDir = path.join(ROOT, 'saida_poc', 'sketchup_jobs');
      if (!fs.existsSync(jobsDir)) fs.mkdirSync(jobsDir, { recursive: true });
      const jobFile = path.join(jobsDir, `spec_${Date.now()}.json`);
      fs.writeFileSync(jobFile, JSON.stringify(spec, null, 2), 'utf8');
      // O plugin SketchUp (armario_builder.rb) pode monitorar essa pasta e processar novos arquivos
      jsonResponse(req, res, 202, { ok: true, job: jobFile });
    } catch (err) {
      jsonResponse(req, res, 500, { erro: String(err) });
    }
    return true;
  }

  // Webhook n8n para gerar móveis (encaminha para geração de BOM e jobs)
  if (req.method === "POST" && urlPath === "/webhook/gerar-moveis") {
    try {
      const body = await readJsonBody(req);
      // padrão esperado: { spec: { ... } }
      const spec = body.spec || body;
      // gerar BOM imediato
      const furnitureBuilder = require('./furniture-builder');
      const outDir = path.join(ROOT, 'saida_poc');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const bomResults = furnitureBuilder.generateFromSpec(spec, { outDir });
      // enfileirar jobs para FreeCAD e SketchUp
      const freecadDir = path.join(outDir, 'freecad_jobs');
      const sketchupDir = path.join(outDir, 'sketchup_jobs');
      if (!fs.existsSync(freecadDir)) fs.mkdirSync(freecadDir, { recursive: true });
      if (!fs.existsSync(sketchupDir)) fs.mkdirSync(sketchupDir, { recursive: true });
      const freecadJob = path.join(freecadDir, `spec_${Date.now()}.json`);
      const sketchupJob = path.join(sketchupDir, `spec_${Date.now()}.json`);
      fs.writeFileSync(freecadJob, JSON.stringify(spec, null, 2), 'utf8');
      fs.writeFileSync(sketchupJob, JSON.stringify(spec, null, 2), 'utf8');

      jsonResponse(req, res, 201, { ok: true, bomResults, freecadJob, sketchupJob });
    } catch (err) {
      jsonResponse(req, res, 500, { erro: String(err) });
    }
    return true;
  }

  return false;
}


function resolveRequestPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]);

  if (cleanPath === "/" || cleanPath === "/index.html") {
    return path.join(PUBLIC_DIR, "index.html");
  }

  if (cleanPath.startsWith("/public/")) {
    return path.join(ROOT, cleanPath);
  }

  if (cleanPath.startsWith("/saida_poc/")) {
    return path.join(ROOT, cleanPath);
  }

  if (cleanPath === "/projeto_base.json") {
    return path.join(ROOT, "projeto_base.json");
  }

  return path.join(PUBLIC_DIR, cleanPath);
}

function isInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function send(req, res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(body);
}

const server = http.createServer((req, res) => {
  handleApi(req, res).then((handled) => {
    if (handled) {
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      send(req, res, 405, "Metodo nao permitido");
      return;
    }

    const filePath = resolveRequestPath(req.url || "/");
    const allowed =
      isInside(filePath, PUBLIC_DIR) ||
      isInside(filePath, path.join(ROOT, "saida_poc")) ||
      filePath === path.join(ROOT, "projeto_base.json");

    if (!allowed) {
      send(req, res, 403, "Acesso negado");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        send(req, res, error.code === "ENOENT" ? 404 : 500, "Arquivo nao encontrado");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      send(req, res, 200, data, MIME_TYPES[ext] || "application/octet-stream");
    });
  }).catch(() => {
    jsonResponse(req, res, 500, { erro: "Falha interna no servidor" });
  });
});

server.listen(PORT, () => {
  console.log(`MVP Moveis Planejados: http://127.0.0.1:${PORT}`);
});

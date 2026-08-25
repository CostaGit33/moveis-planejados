const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const fields = {
  pedido: document.getElementById("pedido"),
  ambienteLargura: document.getElementById("ambienteLargura"),
  ambienteProfundidade: document.getElementById("ambienteProfundidade"),
  peDireito: document.getElementById("peDireito"),
  paredeEspessura: document.getElementById("paredeEspessura"),
  moduloTipo: document.getElementById("moduloTipo"),
  material: document.getElementById("material"),
  moduloX: document.getElementById("moduloX"),
  moduloY: document.getElementById("moduloY"),
  moduloLargura: document.getElementById("moduloLargura"),
  moduloProfundidade: document.getElementById("moduloProfundidade"),
  moduloAltura: document.getElementById("moduloAltura"),
  chapa: document.getElementById("chapa")
};

const materials = {
  mdf_areia: { nome: "MDF Areia", color: "#b8895d", precoM2: 135 },
  mdf_cinza: { nome: "MDF Cinza", color: "#6b7280", precoM2: 128 },
  mdf_carvalho: { nome: "MDF Carvalho", color: "#a16d3a", precoM2: 155 },
  alvenaria_branca: { nome: "Alvenaria branca", color: "#e5e7eb", precoM2: 0 }
};

function numberValue(id) {
  return Number(fields[id].value || 0);
}

function buildProject() {
  return {
    unidade: "mm",
    pedido: fields.pedido.value.trim(),
    ambiente: {
      nome: "Cozinha MVP",
      largura: numberValue("ambienteLargura"),
      profundidade: numberValue("ambienteProfundidade"),
      pe_direito: numberValue("peDireito")
    },
    paredes: [
      {
        id: "PAREDE-001",
        nome: "Parede principal",
        x: 0,
        y: 0,
        z: 0,
        largura: numberValue("ambienteLargura"),
        espessura: numberValue("paredeEspessura"),
        altura: numberValue("peDireito"),
        material: "alvenaria_branca"
      }
    ],
    modulos: [
      {
        id: "MOD-001",
        tipo: fields.moduloTipo.value,
        nome: "Armario inferior",
        x: numberValue("moduloX"),
        y: numberValue("moduloY"),
        z: 0,
        largura: numberValue("moduloLargura"),
        profundidade: numberValue("moduloProfundidade"),
        altura: numberValue("moduloAltura"),
        espessura_chapa: numberValue("chapa"),
        material: fields.material.value,
        portas: 2,
        gavetas: 0
      }
    ]
  };
}

function cabinetParts(module) {
  const { x, y, z, largura: w, profundidade: d, altura: h, espessura_chapa: t, material } = module;
  const base = module.id;
  return [
    { id: `${base}-LAT-E`, nome: "Lateral esquerda", x, y, z, largura: t, profundidade: d, altura: h, material },
    { id: `${base}-LAT-D`, nome: "Lateral direita", x: x + w - t, y, z, largura: t, profundidade: d, altura: h, material },
    { id: `${base}-BASE`, nome: "Base", x, y, z, largura: w, profundidade: d, altura: t, material },
    { id: `${base}-TOPO`, nome: "Topo", x, y, z: z + h - t, largura: w, profundidade: d, altura: t, material },
    { id: `${base}-FUNDO`, nome: "Fundo", x, y: y + d - t, z, largura: w, profundidade: t, altura: h, material }
  ];
}

function allParts(project) {
  return project.modulos.flatMap((module) => cabinetParts(module));
}

function partAreaM2(part) {
  const faces = [
    part.largura * part.profundidade,
    part.largura * part.altura,
    part.profundidade * part.altura
  ];
  return (2 * faces.reduce((total, area) => total + area, 0)) / 1000000;
}

function draw2d(project) {
  const canvas = document.getElementById("planta2d");
  const ctx = canvas.getContext("2d");
  const pad = 48;
  const w = canvas.width;
  const h = canvas.height;
  const roomW = project.ambiente.largura;
  const roomD = Math.max(project.ambiente.profundidade, 800);
  const scale = Math.min((w - pad * 2) / roomW, (h - pad * 2) / roomD);
  const originX = pad;
  const originY = pad;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "#d7dee8";
  ctx.lineWidth = 1;
  for (let x = originX; x <= originX + roomW * scale; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, originY);
    ctx.lineTo(x, originY + roomD * scale);
    ctx.stroke();
  }
  for (let y = originY; y <= originY + roomD * scale; y += 40) {
    ctx.beginPath();
    ctx.moveTo(originX, y);
    ctx.lineTo(originX + roomW * scale, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 8;
  ctx.strokeRect(originX, originY, roomW * scale, roomD * scale);

  for (const module of project.modulos) {
    ctx.fillStyle = materials[module.material].color;
    ctx.strokeStyle = "#1f2933";
    ctx.lineWidth = 2;
    ctx.fillRect(originX + module.x * scale, originY + module.y * scale, module.largura * scale, module.profundidade * scale);
    ctx.strokeRect(originX + module.x * scale, originY + module.y * scale, module.largura * scale, module.profundidade * scale);
  }

  ctx.fillStyle = "#1f2933";
  ctx.font = "15px Arial";
  ctx.fillText(`${(roomW / 1000).toFixed(2)} m`, originX + roomW * scale / 2 - 24, originY - 16);
  ctx.save();
  ctx.translate(originX + roomW * scale + 20, originY + roomD * scale / 2 + 24);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`${(project.ambiente.profundidade / 1000).toFixed(2)} m`, 0, 0);
  ctx.restore();
}

function drawBox(ctx, x, y, width, height, depth, color) {
  const dx = depth * 0.42;
  const dy = -depth * 0.28;

  ctx.fillStyle = color;
  ctx.strokeStyle = "#1f2933";
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width + dx, y + dy);
  ctx.lineTo(x + dx, y + dy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + width, y);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x + width + dx, y + height + dy);
  ctx.lineTo(x + width + dx, y + dy);
  ctx.closePath();
  ctx.fillStyle = shade(color, -18);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.fillStyle = shade(color, 8);
  ctx.fill();
  ctx.stroke();
}

function shade(hex, amount) {
  const value = hex.replace("#", "");
  const number = parseInt(value, 16);
  const r = Math.max(0, Math.min(255, (number >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((number >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (number & 255) + amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function draw3d(project) {
  const canvas = document.getElementById("visao3d");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#eef2f5";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(70, 58, 560, 250);
  ctx.strokeStyle = "#cbd5e1";
  ctx.strokeRect(70, 58, 560, 250);

  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.moveTo(70, 308);
  ctx.lineTo(630, 308);
  ctx.lineTo(690, 374);
  ctx.lineTo(18, 374);
  ctx.closePath();
  ctx.fill();

  for (const module of project.modulos) {
    const width = Math.max(90, module.largura * 0.24);
    const height = Math.max(80, module.altura * 0.24);
    const depth = Math.max(70, module.profundidade * 0.18);
    const x = 150 + module.x * 0.1;
    const y = 298 - height;
    drawBox(ctx, x, y, width, height, depth, materials[module.material].color);
  }
}

function renderTable(parts) {
  const body = document.getElementById("pecasBody");
  body.innerHTML = "";
  for (const part of parts) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${part.nome}</td>
      <td>${part.largura} x ${part.profundidade} x ${part.altura} mm</td>
      <td>${materials[part.material].nome}</td>
    `;
    body.appendChild(row);
  }
}

function renderSummary(project, parts) {
  const material = materials[project.modulos[0].material];
  const area = parts.reduce((total, part) => total + partAreaM2(part), 0);
  const hardware = 180;
  const labor = 450;
  const wasteFactor = 1.18;
  const total = area * material.precoM2 * wasteFactor + hardware + labor;

  document.getElementById("areaMdf").textContent = `${area.toFixed(2)} m2`;
  document.getElementById("valorEstimado").textContent = money.format(total);
  document.getElementById("dimensoesResumo").textContent = `${project.ambiente.largura} x ${project.ambiente.profundidade} mm`;
}

function applyProject(project) {
  const module = project.modulos[0];
  fields.ambienteLargura.value = project.ambiente.largura;
  fields.ambienteProfundidade.value = project.ambiente.profundidade;
  fields.peDireito.value = project.ambiente.pe_direito;
  fields.paredeEspessura.value = project.paredes[0].espessura;
  fields.material.value = module.material;
  fields.moduloX.value = module.x;
  fields.moduloY.value = module.y;
  fields.moduloLargura.value = module.largura;
  fields.moduloProfundidade.value = module.profundidade;
  fields.moduloAltura.value = module.altura;
  fields.chapa.value = module.espessura_chapa;
}

function renderFlowSteps(steps, activeIds = []) {
  const grid = document.getElementById("flowGrid");
  grid.innerHTML = "";

  for (const step of steps) {
    const item = document.createElement("article");
    item.className = `flow-step ${activeIds.includes(step.id) ? "active" : ""}`;
    item.innerHTML = `
      <strong>${step.nome}</strong>
      <span>${step.papel}</span>
      <span>Entrada: ${step.entrada}</span>
      <span>Saida: ${step.saida}</span>
    `;
    grid.appendChild(item);
  }
}

async function loadFlowMap() {
  const response = await fetch("/api/fluxo");
  const data = await response.json();
  renderFlowSteps(data.fluxo || []);
}

async function simulateFlow() {
  const flowStatus = document.getElementById("flowStatus");
  const flowPayload = document.getElementById("flowPayload");
  flowStatus.textContent = "Executando...";

  const response = await fetch("/api/fluxo/simular", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pedido: fields.pedido.value.trim() })
  });
  const data = await response.json();

  if (!response.ok) {
    flowStatus.textContent = "Falha no fluxo";
    flowPayload.textContent = JSON.stringify(data, null, 2);
    return;
  }

  if (data.api_central && data.api_central.projeto) {
    applyProject(data.api_central.projeto);
    render();
  }

  renderFlowSteps(data.etapas || [], [
    "telegram",
    "agent-ia",
    "n8n",
    "api-central",
    "motor-2d-3d",
    "orcamento",
    "dashboard"
  ]);
  flowStatus.textContent = "Fluxo simulado com sucesso";
  flowPayload.textContent = JSON.stringify(data, null, 2);
}

function render() {
  const project = buildProject();
  const parts = allParts(project);
  draw2d(project);
  draw3d(project);
  renderTable(parts);
  renderSummary(project, parts);
}

function downloadJson() {
  const project = buildProject();
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "projeto_moveis_mvp.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function loadBaseProject() {
  const response = await fetch("/projeto_base.json");
  const project = await response.json();
  applyProject(project);
  render();
}

for (const field of Object.values(fields)) {
  field.addEventListener("input", render);
  field.addEventListener("change", render);
}

document.getElementById("exportJson").addEventListener("click", downloadJson);
document.getElementById("loadBase").addEventListener("click", loadBaseProject);
document.getElementById("simulateFlow").addEventListener("click", simulateFlow);

render();
loadFlowMap();

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
  chapa: document.getElementById("chapa"),
  moduloPortas: document.getElementById("moduloPortas"),
  moduloGavetas: document.getElementById("moduloGavetas"),
  moduloPrateleiras: document.getElementById("moduloPrateleiras")
};

const materials = {
  mdf_areia: { nome: "MDF Areia", color: "#b8895d", precoM2: 135 },
  mdf_cinza: { nome: "MDF Cinza", color: "#6b7280", precoM2: 128 },
  mdf_carvalho: { nome: "MDF Carvalho", color: "#a16d3a", precoM2: 155 },
  alvenaria_branca: { nome: "Alvenaria branca", color: "#e5e7eb", precoM2: 0 }
};

const evidenceKindLabels = {
  unknown: "Não classificado",
  side: "Lateral",
  top: "Tampo",
  base: "Base",
  back: "Fundo",
  shelf: "Prateleira",
  vertical_divider: "Divisória vertical",
  door: "Porta",
  drawer: "Gaveta",
  drawer_front: "Frente de gaveta",
  hanger: "Cabideiro",
  foot: "Pé",
  mirror: "Espelho",
  wall: "Parede",
  window: "Janela",
  door_opening: "Abertura de porta"
};

const evidenceKindOptions = Object.entries(evidenceKindLabels)
  .filter(([kind]) => !["wall", "window", "door_opening", "mirror"].includes(kind));

let currentProject = null;
let currentParts = [];
const draftState = { payload: null, analysis: null, previewUrl: null };

function numberValue(id) {
  const value = Number(fields[id]?.value || 0);
  return Number.isFinite(value) ? value : 0;
}

function buildProject() {
  return {
    schema_version: "1.1",
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
        nome: fields.moduloTipo.options[fields.moduloTipo.selectedIndex]?.text || "Módulo principal",
        x: numberValue("moduloX"),
        y: numberValue("moduloY"),
        z: 0,
        largura: numberValue("moduloLargura"),
        profundidade: numberValue("moduloProfundidade"),
        altura: numberValue("moduloAltura"),
        espessura_chapa: numberValue("chapa"),
        material: fields.material.value,
        portas: numberValue("moduloPortas"),
        gavetas: numberValue("moduloGavetas"),
        prateleiras: numberValue("moduloPrateleiras")
      }
    ],
    materiais: {
      alvenaria_branca: {
        nome: "Alvenaria branca",
        pbr: { base_color: "#eae8df", roughness: 0.88, metallic: 0 }
      },
      mdf_areia: {
        nome: "MDF Areia",
        pbr: { base_color: "#b8895d", roughness: 0.62, metallic: 0 }
      },
      mdf_cinza: {
        nome: "MDF Cinza",
        pbr: { base_color: "#6b7280", roughness: 0.62, metallic: 0 }
      },
      mdf_carvalho: {
        nome: "MDF Carvalho",
        pbr: { base_color: "#a16d3a", roughness: 0.56, metallic: 0 }
      }
    },
    fabricacao: {
      unidade: "mm",
      kerf: 3,
      margem: 10,
      rotacao_permitida: true,
      veio: "preservar"
    },
    render: {
      engine: "three",
      pipeline: "glb-compatível",
      materiais: "pbr"
    }
  };
}

function fallbackMaterial(key) {
  return materials[key] || { nome: key || "Material não informado", color: "#a9b3aa", precoM2: 135 };
}

function safeCount(value) {
  const parsed = Number(value || 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function cabinetParts(module) {
  const w = Number(module.largura || 0);
  const d = Number(module.profundidade || 0);
  const h = Number(module.altura || 0);
  const t = Number(module.espessura_chapa || module.espessura || 18);
  const gap = 2;
  const parts = [];
  const innerWidth = w - (t * 2);
  const innerDepth = d - t;

  if (![w, d, h, t].every((value) => Number.isFinite(value) && value > 0)) return parts;

  const add = (nome, data) => parts.push({
    id: `${module.id}-${parts.length + 1}`,
    modulo_id: module.id,
    nome,
    material: module.material,
    ...data
  });

  add("Painel Traseiro", { largura: w, profundidade: t, altura: h - t, espessura: t, quantidade: 1 });
  add("Lateral", { largura: d - t, profundidade: t, altura: h, espessura: t, quantidade: 2 });
  add("Tampo", { largura: w, profundidade: d, altura: t, espessura: t, quantidade: 1 });
  add("Base", { largura: w, profundidade: d, altura: t, espessura: t, quantidade: 1 });

  const shelves = safeCount(module.prateleiras);
  if (shelves) add("Prateleira", { largura: innerWidth, profundidade: innerDepth, altura: t, espessura: t, quantidade: shelves });

  const doors = safeCount(module.portas);
  if (doors) {
    add("Porta", {
      largura: Number(((w - gap * (doors + 1)) / doors).toFixed(2)),
      profundidade: t,
      altura: Number((h - gap * 2).toFixed(2)),
      espessura: t,
      quantidade: doors
    });
  }

  const drawers = safeCount(module.gavetas);
  if (drawers) {
    const frontHeight = (h - gap * (drawers + 1)) / drawers;
    add("Frente de Gaveta", {
      largura: Number((w - gap * 2).toFixed(2)),
      profundidade: t,
      altura: Number(frontHeight.toFixed(2)),
      espessura: t,
      quantidade: drawers
    });
    add("Lateral de Gaveta", {
      largura: Math.max(innerDepth - t, t),
      profundidade: t,
      altura: Math.max(frontHeight - t, t),
      espessura: t,
      quantidade: drawers * 2
    });
    add("Fundo de Gaveta", {
      largura: innerWidth,
      profundidade: Math.max(innerDepth - t, t),
      altura: t,
      espessura: t,
      quantidade: drawers
    });
  }

  return parts;
}

function allParts(project) {
  return (project.modulos || []).flatMap((module) => cabinetParts(module));
}

function partAreaM2(part) {
  const largura = Number(part.largura || 0);
  const profundidade = Number(part.profundidade || 0);
  const altura = Number(part.altura || 0);
  const quantidade = Number(part.quantidade || 1);
  if (![largura, profundidade, altura, quantidade].every(Number.isFinite)) return 0;
  const faces = [largura * profundidade, largura * altura, profundidade * altura];
  return (2 * faces.reduce((total, area) => total + area, 0) * quantidade) / 1000000;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function draw2d(project) {
  const canvas = document.getElementById("planta2d");
  const ctx = canvas.getContext("2d");
  const pad = 54;
  const width = canvas.width;
  const height = canvas.height;
  const roomW = Math.max(Number(project.ambiente?.largura || 1), 1);
  const roomD = Math.max(Number(project.ambiente?.profundidade || 1), 600);
  const scale = Math.min((width - pad * 2) / roomW, (height - pad * 2) / roomD);
  const originX = pad;
  const originY = pad;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#faf8f3";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#e4ddd2";
  ctx.lineWidth = 1;
  const grid = Math.max(20, Math.round(200 * scale));
  for (let x = originX; x <= originX + roomW * scale; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, originY);
    ctx.lineTo(x, originY + roomD * scale);
    ctx.stroke();
  }
  for (let y = originY; y <= originY + roomD * scale; y += grid) {
    ctx.beginPath();
    ctx.moveTo(originX, y);
    ctx.lineTo(originX + roomW * scale, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#eee8de";
  ctx.fillRect(originX, originY, roomW * scale, roomD * scale);
  ctx.strokeStyle = "#26302b";
  ctx.lineWidth = 7;
  ctx.strokeRect(originX, originY, roomW * scale, roomD * scale);

  for (const module of project.modulos || []) {
    const material = fallbackMaterial(module.material);
    const x = originX + Number(module.x || 0) * scale;
    const y = originY + Number(module.y || 0) * scale;
    const w = Number(module.largura || 0) * scale;
    const d = Number(module.profundidade || 0) * scale;
    ctx.fillStyle = material.color;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(x, y, w, d);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#4b392d";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, d);
    ctx.fillStyle = "#fffaf3";
    ctx.font = "600 11px Inter, Arial";
    ctx.fillText(module.nome || module.tipo || "Módulo", x + 6, y + 16);
  }

  ctx.fillStyle = "#59655d";
  ctx.font = "600 12px Inter, Arial";
  ctx.fillText(`${(roomW / 1000).toFixed(2)} m`, originX + roomW * scale / 2 - 22, originY - 17);
  ctx.save();
  ctx.translate(originX + roomW * scale + 22, originY + roomD * scale / 2 + 20);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`${(roomD / 1000).toFixed(2)} m`, 0, 0);
  ctx.restore();
}

function drawBox(ctx, x, y, width, height, depth, color) {
  const dx = depth * 0.42;
  const dy = -depth * 0.28;
  ctx.fillStyle = color;
  ctx.strokeStyle = "#4b392d";
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
  const value = String(hex || "#a9b3aa").replace("#", "");
  const number = parseInt(value, 16);
  if (Number.isNaN(number)) return hex;
  const r = Math.max(0, Math.min(255, (number >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((number >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (number & 255) + amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function draw3d(project) {
  const canvas = document.getElementById("visao3d");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f1ede5";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#e8e1d6";
  ctx.fillRect(72, 56, 650, 300);
  ctx.strokeStyle = "#d2c7b9";
  ctx.strokeRect(72, 56, 650, 300);

  ctx.fillStyle = "#fffaf3";
  ctx.beginPath();
  ctx.moveTo(72, 356);
  ctx.lineTo(722, 356);
  ctx.lineTo(790, 430);
  ctx.lineTo(8, 430);
  ctx.closePath();
  ctx.fill();

  for (const module of project.modulos || []) {
    const material = fallbackMaterial(module.material);
    const width = Math.max(92, Number(module.largura || 0) * 0.22);
    const height = Math.max(80, Number(module.altura || 0) * 0.26);
    const depth = Math.max(70, Number(module.profundidade || 0) * 0.18);
    const x = 142 + Number(module.x || 0) * 0.1;
    const y = 348 - height;
    drawBox(ctx, x, y, width, height, depth, material.color);
  }
}

function renderTable(parts) {
  const body = document.getElementById("pecasBody");
  body.innerHTML = "";
  const grouped = new Map();
  for (const part of parts) {
    const key = [part.nome, part.largura, part.profundidade, part.altura, part.material].join("|");
    const current = grouped.get(key);
    if (current) current.quantidade += Number(part.quantidade || 1);
    else grouped.set(key, { ...part, quantidade: Number(part.quantidade || 1) });
  }

  for (const part of grouped.values()) {
    const row = document.createElement("tr");
    const material = fallbackMaterial(part.material);
    const measure = [part.largura, part.profundidade, part.altura].filter((value) => value !== undefined && value !== null && value !== "").join(" × ");
    row.innerHTML = `
      <td>${escapeHtml(part.nome)}</td>
      <td>${escapeHtml(measure)} mm</td>
      <td>${escapeHtml(part.quantidade)}</td>
      <td>${escapeHtml(material.nome)}</td>
    `;
    body.appendChild(row);
  }

  document.getElementById("partsCount").textContent = `${grouped.size} grupos`;
  document.getElementById("summaryPieces").textContent = `${parts.reduce((total, part) => total + Number(part.quantidade || 1), 0)}`;
}

function renderSummary(project, parts) {
  const module = project.modulos?.[0];
  if (!module) return;
  const material = fallbackMaterial(module.material);
  const area = parts.reduce((total, part) => total + partAreaM2(part), 0);
  const total = area * material.precoM2 * 1.18 + 180 + 450;
  document.getElementById("areaMdf").textContent = `${area.toFixed(2).replace(".", ",")} m²`;
  document.getElementById("valorEstimado").textContent = money.format(total);
  document.getElementById("dimensoesResumo").textContent = `${project.ambiente.largura} × ${project.ambiente.profundidade} mm`;
}

function applyProject(project) {
  const module = project.modulos?.[0];
  if (!module) return;
  fields.pedido.value = project.pedido || fields.pedido.value;
  fields.ambienteLargura.value = project.ambiente?.largura || "";
  fields.ambienteProfundidade.value = project.ambiente?.profundidade || "";
  fields.peDireito.value = project.ambiente?.pe_direito || "";
  fields.paredeEspessura.value = project.paredes?.[0]?.espessura || "";
  fields.moduloTipo.value = module.tipo || "armario_inferior";
  fields.material.value = module.material || "mdf_areia";
  fields.moduloX.value = module.x ?? 0;
  fields.moduloY.value = module.y ?? 0;
  fields.moduloLargura.value = module.largura || "";
  fields.moduloProfundidade.value = module.profundidade || "";
  fields.moduloAltura.value = module.altura || "";
  fields.chapa.value = module.espessura_chapa || 18;
  fields.moduloPortas.value = module.portas || 0;
  fields.moduloGavetas.value = module.gavetas || 0;
  fields.moduloPrateleiras.value = module.prateleiras || 0;
}

function render(project = buildProject(), parts = null) {
  currentProject = project;
  currentParts = parts || allParts(project);
  draw2d(project);
  draw3d(project);
  renderTable(currentParts);
  renderSummary(project, currentParts);
  if (window.hybridViewer?.renderProject) {
    window.hybridViewer.renderProject(project, currentParts);
  }
}

function renderFlowSteps(steps, activeIds = []) {
  const grid = document.getElementById("flowGrid");
  grid.innerHTML = "";
  for (const step of steps) {
    const item = document.createElement("article");
    item.className = `flow-step ${activeIds.includes(step.id) ? "active" : ""}`;
    item.innerHTML = `
      <strong>${escapeHtml(step.nome)}</strong>
      <span>${escapeHtml(step.papel)}</span>
      <span>Entrada: ${escapeHtml(step.entrada)}</span>
      <span>Saída: ${escapeHtml(step.saida)}</span>
    `;
    grid.appendChild(item);
  }
}

function setStatus(text, type = "") {
  const status = document.getElementById("generationStatus");
  status.textContent = text;
  status.dataset.type = type;
}

function setApiStatus(text, online = false) {
  document.getElementById("apiStatus").textContent = text;
  const dot = document.getElementById("apiDot");
  dot.className = `status-dot ${online ? "online" : "offline"}`;
}

function setButtonsDisabled(disabled) {
  document.querySelectorAll("button").forEach((button) => { button.disabled = disabled; });
}

async function loadFlowMap() {
  try {
    const response = await fetch("/api/fluxo");
    if (!response.ok) throw new Error("API indisponível");
    const data = await response.json();
    renderFlowSteps(data.fluxo || []);
    setApiStatus("API online", true);
  } catch (error) {
    setApiStatus("API offline", false);
    document.getElementById("flowStatus").textContent = "Não foi possível carregar o fluxo";
  }
}

function setDraftStatus(text, type = '') {
  const status = document.getElementById('draftStatus');
  if (!status) return;
  status.textContent = text;
  status.dataset.type = type;
}

function renderDraftEvidenceEditor(analysis) {
  const editor = document.getElementById('draftEvidenceEditor');
  const rows = document.getElementById('draftEvidenceRows');
  if (!editor || !rows) return;
  const evidence = analysis.draft?.evidence || [];
  editor.hidden = evidence.length === 0;
  rows.innerHTML = '';
  for (const item of evidence) {
    const row = document.createElement('div');
    row.className = 'draft-evidence-row';
    row.dataset.evidenceId = item.id;

    const heading = document.createElement('span');
    heading.className = 'draft-evidence-id';
    heading.textContent = `${item.id} · ${Math.round(Number(item.confidence || 0) * 100)}%`;

    const kind = document.createElement('select');
    kind.className = 'draft-evidence-kind';
    kind.setAttribute('aria-label', `Classificação de ${item.id}`);
    for (const [value, label] of evidenceKindOptions) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      kind.appendChild(option);
    }
    kind.value = evidenceKindLabels[item.kind] ? item.kind : 'unknown';

    const status = document.createElement('select');
    status.className = 'draft-evidence-status';
    status.setAttribute('aria-label', `Status de ${item.id}`);
    for (const [value, label] of [['observed', 'Observado'], ['proposed', 'Proposto'], ['needs_confirmation', 'Confirmar'], ['rejected', 'Rejeitado']]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      status.appendChild(option);
    }
    status.value = item.status || 'proposed';

    const notes = document.createElement('small');
    notes.textContent = item.notes || 'Sem observação adicional.';
    row.append(heading, kind, status, notes);
    rows.appendChild(row);
  }
}

function renderDraftReview(analysis) {
  const review = document.getElementById('draftReview');
  const family = document.getElementById('draftFamily');
  const level = document.getElementById('draftLevel');
  const componentCount = document.getElementById('draftComponents');
  const questionCount = document.getElementById('draftQuestionsCount');
  const questions = document.getElementById('draftQuestions');
  const convertButton = document.getElementById('convertDraft');
  const visionInfo = document.getElementById('draftVisionInfo');
  const visionDescription = document.getElementById('draftVisionDescription');
  const ocrText = document.getElementById('draftOcrText');
  const applyMeasurementsButton = document.getElementById('applyDraftMeasurements');
  if (!review || !analysis) return;

  const proposal = analysis.draft?.proposal || {};
  const validation = analysis.validation || {};
  renderDraftEvidenceEditor(analysis);
  const openQuestions = validation.critical_missing?.length
    ? [...(analysis.draft?.open_questions || []), `Campos críticos ausentes: ${validation.critical_missing.join(', ')}`]
    : (analysis.draft?.open_questions || []);
  family.textContent = proposal.family?.nome || 'Família não identificada';
  level.textContent = validation.level || 'draft';
  componentCount.textContent = proposal.module?.componentes?.length || 0;
  questionCount.textContent = openQuestions.length;
  questions.innerHTML = openQuestions.length
    ? openQuestions.map((question) => `<li>${escapeHtml(question)}</li>`).join('')
    : '<li>Nenhuma questão crítica pendente.</li>';
  convertButton.disabled = Boolean(validation.critical_missing?.length || validation.errors?.length);
  if (visionInfo) {
    const vision = analysis.vision;
    visionInfo.hidden = !vision;
    if (vision) {
      if (visionDescription) visionDescription.textContent = vision.description || 'Nenhuma descrição adicional foi retornada.';
      if (ocrText) ocrText.textContent = (vision.ocr_text || []).join('\\n') || 'Nenhum texto legível foi encontrado.';
      const dimensions = vision.dimensions || {};
      for (const [id, key] of [
        ['draftSuggestedWidth', 'width_mm'],
        ['draftSuggestedDepth', 'depth_mm'],
        ['draftSuggestedHeight', 'height_mm'],
        ['draftSuggestedThickness', 'board_thickness_mm']
      ]) {
        const input = document.getElementById(id);
        if (input) input.value = dimensions[key] ?? '';
      }
      if (applyMeasurementsButton) applyMeasurementsButton.disabled = false;
    } else if (applyMeasurementsButton) {
      applyMeasurementsButton.disabled = true;
    }
  }
  review.hidden = false;
  setDraftStatus(
    convertButton.disabled
      ? 'Rascunho analisado; confirme as dimensões críticas antes de converter.'
      : 'Rascunho analisado; proposta pronta para conversão.',
    convertButton.disabled ? 'loading' : 'success'
  );
}

async function analyzeDraftPayload(payload, options = {}) {
  const response = await fetch('/api/drafts/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível analisar o rascunho.');
  draftState.payload = payload;
  const preservedVision = options.preserveVision ? draftState.analysis?.vision : null;
  draftState.analysis = preservedVision ? { ...data, vision: preservedVision } : data;
  const visibleAnalysis = draftState.analysis;
  if (visibleAnalysis.draft?.proposal?.module) {
    applyDraftModuleToFields(
      { draft: { module: visibleAnalysis.draft.proposal.module }, pedido: payload.pedido },
      { clearMissing: Boolean(options.clearMissing) }
    );
  }
  renderDraftReview(visibleAnalysis);
  return visibleAnalysis;
}

function applyDraftModuleToFields(payload, options = {}) {
  const module = payload.draft?.module;
  if (!module) return;
  const clearMissing = Boolean(options.clearMissing);
  if (module.tipo) fields.moduloTipo.value = module.tipo;
  if (module.material) fields.material.value = module.material;
  for (const [field, key] of [
    ['moduloX', 'x'],
    ['moduloY', 'y'],
    ['moduloLargura', 'largura'],
    ['moduloProfundidade', 'profundidade'],
    ['moduloAltura', 'altura'],
    ['chapa', 'espessura_chapa'],
    ['moduloPortas', 'portas'],
    ['moduloGavetas', 'gavetas'],
    ['moduloPrateleiras', 'prateleiras']
  ]) {
    if (module[key] !== undefined && module[key] !== null) fields[field].value = module[key];
    else if (clearMissing && ['moduloLargura', 'moduloProfundidade', 'moduloAltura', 'chapa'].includes(field)) fields[field].value = '';
  }
  if (payload.ambiente) {
    for (const [field, key] of [
      ['ambienteLargura', 'largura'],
      ['ambienteProfundidade', 'profundidade'],
      ['peDireito', 'pe_direito']
    ]) {
      if (payload.ambiente[key] !== undefined && payload.ambiente[key] !== null) fields[field].value = payload.ambiente[key];
    }
  }
  if (payload.pedido) fields.pedido.value = payload.pedido;
  render();
}

async function loadDraftFixture() {
  try {
    const response = await fetch('/examples/rascunho-modulo-estante.json');
    if (!response.ok) throw new Error('Não foi possível carregar o JSON de teste.');
    const payload = await response.json();
    applyDraftModuleToFields(payload);
    await analyzeDraftPayload(payload);
  } catch (error) {
    setDraftStatus(error.message, 'error');
  }
}

function isImageFile(file) {
  return Boolean(file && (file.type?.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name || '')));
}

function previewDraftFile(file) {
  const previewBox = document.getElementById('draftImagePreview');
  const preview = document.getElementById('draftPreview');
  if (!previewBox || !preview) return;
  if (draftState.previewUrl) URL.revokeObjectURL(draftState.previewUrl);
  draftState.previewUrl = null;
  if (isImageFile(file)) {
    draftState.previewUrl = URL.createObjectURL(file);
    preview.src = draftState.previewUrl;
    previewBox.hidden = false;
  } else {
    preview.removeAttribute('src');
    previewBox.hidden = true;
  }
}

async function analyzeImageFromFile(file) {
  const formData = new FormData();
  formData.append('image', file, file.name);
  formData.append('pedido', fields.pedido.value.trim());
  setDraftStatus('Enviando imagem para interpretação visual...', 'loading');
  const response = await fetch('/api/drafts/analyze-image', {
    method: 'POST',
    body: formData
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível interpretar a imagem.');
  if (!data.draft_payload) throw new Error('A API não retornou o draft intermediário para revisão.');
  draftState.payload = data.draft_payload;
  draftState.analysis = data;
  applyDraftModuleToFields(data.draft_payload, { clearMissing: true });
  renderDraftReview(data);
  setDraftStatus('Imagem interpretada; confirme as medidas sugeridas antes de converter.', 'loading');
  return data;
}

async function analyzeDraftFromFile() {
  const file = document.getElementById('draftFile')?.files?.[0];
  if (!file) return setDraftStatus('Selecione uma imagem ou JSON de rascunho.', 'error');
  try {
    previewDraftFile(file);
    if (isImageFile(file)) {
      await analyzeImageFromFile(file);
      return;
    }
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      throw new Error('Formato não suportado. Use JPEG, PNG, WebP ou JSON de evidências.');
    }
    const payload = JSON.parse(await file.text());
    applyDraftModuleToFields(payload);
    await analyzeDraftPayload(payload);
  } catch (error) {
    setDraftStatus(error.message || 'Arquivo de rascunho inválido.', 'error');
  }
}

async function applyDraftEvidence() {
  if (!draftState.payload?.draft?.evidence?.length) return setDraftStatus('Analise uma imagem ou JSON com evidências antes de classificar componentes.', 'error');
  const payload = JSON.parse(JSON.stringify(draftState.payload));
  const rows = [...document.querySelectorAll('#draftEvidenceRows [data-evidence-id]')];
  const revisions = new Map(rows.map((row) => [row.dataset.evidenceId, {
    kind: row.querySelector('.draft-evidence-kind')?.value || 'unknown',
    status: row.querySelector('.draft-evidence-status')?.value || 'proposed'
  }]));
  payload.draft.evidence = payload.draft.evidence.map((item) => ({
    ...item,
    ...(revisions.get(item.id) || {})
  }));
  if (payload.draft.module) {
    delete payload.draft.module.componentes;
    delete payload.draft.module.portas;
    delete payload.draft.module.gavetas;
    delete payload.draft.module.prateleiras;
  }
  try {
    setDraftStatus('Recalculando família e parâmetros dos componentes...', 'loading');
    await analyzeDraftPayload(payload, { preserveVision: true });
    setDraftStatus('Componentes revisados e parâmetros atualizados.', 'success');
  } catch (error) {
    setDraftStatus(error.message, 'error');
  }
}

async function applyDraftMeasurements() {
  if (!draftState.payload?.draft?.module) return setDraftStatus('Analise uma imagem antes de confirmar medidas.', 'error');
  const values = {
    largura: Number(document.getElementById('draftSuggestedWidth')?.value),
    profundidade: Number(document.getElementById('draftSuggestedDepth')?.value),
    altura: Number(document.getElementById('draftSuggestedHeight')?.value),
    espessura_chapa: Number(document.getElementById('draftSuggestedThickness')?.value)
  };
  if (!Object.values(values).every((value) => Number.isFinite(value) && value > 0)) {
    return setDraftStatus('Informe largura, profundidade, altura e espessura válidas para confirmar.', 'error');
  }
  const payload = JSON.parse(JSON.stringify(draftState.payload));
  payload.draft.module = { ...payload.draft.module, ...values };
  payload.draft.calibration = {
    status: 'calibrated',
    reference_dimension: 'usuario_confirmacao',
    reference_value_mm: values.largura,
    scale_px_per_mm: null
  };
  payload.draft.assumptions = [
    ...(payload.draft.assumptions || []),
    'As quatro dimensões críticas foram confirmadas manualmente pelo usuário antes da conversão.'
  ];
  payload.draft.open_questions = (payload.draft.open_questions || []).filter((question) => !/largura|profundidade|altura|espessura/i.test(question));
  try {
    setDraftStatus('Validando as medidas confirmadas...', 'loading');
    await analyzeDraftPayload(payload, { preserveVision: true });
    setDraftStatus('Medidas confirmadas; proposta pronta para conversão.', 'success');
  } catch (error) {
    setDraftStatus(error.message, 'error');
  }
}

async function convertDraft() {
  if (!draftState.payload) return setDraftStatus('Analise um rascunho antes de converter.', 'error');
  const convertButton = document.getElementById('convertDraft');
  convertButton.disabled = true;
  setDraftStatus('Convertendo rascunho em projeto paramétrico...', 'loading');
  try {
    const response = await fetch('/api/drafts/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draftState.payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível converter o rascunho.');
    applyProject(data.project);
    render(data.project, data.parts || null);
    document.getElementById('flowPayload').textContent = JSON.stringify(data, null, 2);
    document.getElementById('statusProjeto').textContent = 'Projeto convertido do rascunho';
    setDraftStatus('Projeto paramétrico convertido com sucesso.', 'success');
    setStatus('Rascunho convertido; cena híbrida atualizada.', 'success');
  } catch (error) {
    setDraftStatus(error.message, 'error');
    setStatus(error.message, 'error');
  } finally {
    convertButton.disabled = Boolean(draftState.analysis?.validation?.critical_missing?.length);
  }
}

async function simulateFlow() {
  const flowStatus = document.getElementById("flowStatus");
  const flowPayload = document.getElementById("flowPayload");
  const pedido = fields.pedido.value.trim();
  if (!pedido) return setStatus("Informe um pedido antes de simular.", "error");

  setButtonsDisabled(true);
  flowStatus.textContent = "Executando simulação...";
  setStatus("Executando o fluxo completo na API...", "loading");

  try {
    const response = await fetch("/api/fluxo/simular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido })
    });
    const data = await response.json();
    flowPayload.textContent = JSON.stringify(data, null, 2);
    if (!response.ok) throw new Error(data.error || "Falha no fluxo");

    if (data.api_central?.projeto) {
      applyProject(data.api_central.projeto);
      render(data.api_central.projeto, data.motor_2d_3d?.pecas || null);
    }
    renderFlowSteps(data.etapas || [], ["telegram", "agent-ia", "n8n", "api-central", "motor-2d-3d", "orcamento", "dashboard"]);
    flowStatus.textContent = "Fluxo simulado com sucesso";
    setStatus("Simulação concluída.", "success");
    setApiStatus("API online", true);
  } catch (error) {
    flowStatus.textContent = "Falha no fluxo";
    setStatus(error.message, "error");
    setApiStatus("Erro na API", false);
  } finally {
    setButtonsDisabled(false);
  }
}

async function generateBom() {
  const project = buildProject();
  const module = project.modulos[0];
  const flowPayload = document.getElementById("flowPayload");
  setButtonsDisabled(true);
  setStatus("Gerando lista de peças no servidor...", "loading");

  try {
    const response = await fetch("/api/generate/bom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(module)
    });
    const data = await response.json();
    flowPayload.textContent = JSON.stringify(data, null, 2);
    if (!response.ok) throw new Error(data.error || "Não foi possível gerar o BOM");

    const parts = (data.results || []).flatMap((result) => result.parts || []);
    let renderProject = project;
    let renderParts = parts.length ? parts : null;
    let hybridSceneReady = false;

    try {
      const sceneResponse = await fetch("/api/hybrid/scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, parts })
      });
      const sceneData = await sceneResponse.json();
      if (!sceneResponse.ok) throw new Error(sceneData.error || "Não foi possível preparar a cena híbrida");
      renderProject = sceneData.project || project;
      renderParts = sceneData.parts || renderParts;
      hybridSceneReady = true;
      flowPayload.textContent = JSON.stringify({ bom: data, hybrid_scene: sceneData }, null, 2);
    } catch (sceneError) {
      flowPayload.textContent = JSON.stringify({ bom: data, hybrid_scene_error: sceneError.message }, null, 2);
      setStatus("BOM gerado; cena híbrida indisponível, usando preview local.", "error");
    }

    render(renderProject, renderParts);
    document.getElementById("statusProjeto").textContent = "BOM e cena híbrida gerados no servidor";
    if (hybridSceneReady) {
      setStatus("Projeto, lista de peças e cena híbrida gerados com sucesso.", "success");
    }
    setApiStatus("API online", true);
  } catch (error) {
    setStatus(error.message, "error");
    setApiStatus("Erro na API", false);
  } finally {
    setButtonsDisabled(false);
  }
}

function downloadJson() {
  const project = currentProject || buildProject();
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "projeto_moveis.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function downloadGlb() {
  if (!window.hybridViewer?.exportGlb) {
    return setStatus("O viewer híbrido ainda está inicializando.", "error");
  }

  setStatus("Preparando arquivo GLB...", "loading");
  try {
    const result = await window.hybridViewer.exportGlb();
    const blob = new Blob([result], { type: "model/gltf-binary" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "projeto_moveis.glb";
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Arquivo GLB exportado com sucesso.", "success");
  } catch (error) {
    setStatus(error.message || "Não foi possível exportar o GLB.", "error");
  }
}

async function loadBaseProject() {
  try {
    const response = await fetch("/projeto_base.json");
    if (!response.ok) throw new Error("Não foi possível carregar o projeto base.");
    const project = await response.json();
    applyProject(project);
    render(project);
    setStatus("Projeto base carregado.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

for (const field of Object.values(fields)) {
  field.addEventListener("input", () => render());
  field.addEventListener("change", () => render());
}

document.getElementById("generateProject").addEventListener("click", generateBom);
document.getElementById("exportJson").addEventListener("click", downloadJson);
document.getElementById("exportGlb").addEventListener("click", downloadGlb);
document.getElementById("loadBase").addEventListener("click", loadBaseProject);
document.getElementById("simulateFlow").addEventListener("click", simulateFlow);
document.getElementById("analyzeDraft").addEventListener("click", analyzeDraftFromFile);
document.getElementById("loadDraftFixture").addEventListener("click", loadDraftFixture);
document.getElementById("convertDraft").addEventListener("click", convertDraft);
document.getElementById("applyDraftMeasurements").addEventListener("click", applyDraftMeasurements);
document.getElementById("applyDraftEvidence").addEventListener("click", applyDraftEvidence);
document.getElementById("draftFile").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  previewDraftFile(file);
  if (isImageFile(file)) setDraftStatus('Imagem pronta para análise visual.', 'loading');
  else if (file) setDraftStatus('JSON pronto para análise.', 'loading');
});

window.addEventListener("hybrid-viewer-ready", () => {
  if (currentProject) window.hybridViewer.renderProject(currentProject, currentParts);
});

render();
loadFlowMap();

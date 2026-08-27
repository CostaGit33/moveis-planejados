// Cole este código em um nó Code do N8N após o nó OpenAI de análise de imagem.
// Entrada: item do OpenAI com texto JSON e, opcionalmente, dados do Webhook.
// Saída: um item com `draft_payload` pronto para POST /api/drafts/analyze.
// O Webhook pode materializar campos repetidos como image0, image1, ... .

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function parseModelJson(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  const text = String(value || '').trim();
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const parseJsonText = (candidate) => {
    let parsed = JSON.parse(candidate);
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    return parsed;
  };
  try {
    return parseJsonText(clean);
  } catch (error) {
    const relaxed = clean.replace(/\\n/g, '\n');
    try {
      return parseJsonText(relaxed);
    } catch (relaxedError) {
      const start = relaxed.indexOf('{');
      const end = relaxed.lastIndexOf('}');
      if (start >= 0 && end > start) return parseJsonText(relaxed.slice(start, end + 1));
      throw new Error('O nó OpenAI não retornou JSON válido para evidências visuais.');
    }
  }
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textOrNull(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function listOfStrings(value) {
  if (Array.isArray(value)) return value.map(String).map((value) => value.trim()).filter(Boolean);
  const text = textOrNull(value);
  if (!text) return [];
  return text.split(/\r?\n|\s*;\s*/).map((value) => value.trim()).filter(Boolean);
}

function firstArray(source, keys) {
  for (const key of keys) {
    if (Array.isArray(source?.[key])) return source[key];
  }
  return [];
}

function deriveLayout(description, explicitLayout) {
  if (textOrNull(explicitLayout)) return String(explicitLayout).trim();
  const text = String(description || '').toLowerCase();
  if (/closet|ambiente/.test(text) && /formato\s+u|em\s+u|\bu\b/.test(text)) return 'U';
  if (/formato\s+l|em\s+l|\bl\b/.test(text)) return 'L';
  return null;
}

function meaningfulModule(value) {
  const module = asObject(value);
  if (!Object.keys(module).length) return false;
  if (['largura', 'profundidade', 'altura', 'espessura_chapa', 'portas', 'gavetas', 'prateleiras'].some((key) => {
    const number = numberOrNull(module[key]);
    return number !== null && number > 0;
  })) return true;
  if (Array.isArray(module.componentes) && module.componentes.length) return true;
  if (Array.isArray(module.components) && module.components.length) return true;
  if (Array.isArray(module.evidencia_ids) && module.evidencia_ids.length) return true;
  return Object.keys(asObject(module.parametros)).length > 0;
}

function deriveIdentification(vision, description, ocrText, family) {
  const provided = asObject(vision.identification || vision.identificacao);
  if (provided.type || provided.label || provided.nome) {
    return {
      type: textOrNull(provided.type) || textOrNull(family.tipo) || 'unknown',
      label: textOrNull(provided.label || provided.nome) || textOrNull(family.nome) || 'Não identificado',
      confidence: numberOrNull(provided.confidence),
      alternatives: Array.isArray(provided.alternatives) ? provided.alternatives : []
    };
  }
  const text = `${description || ''} ${ocrText.join(' ')}`.toLowerCase();
  if (/closet|vesti[aá]rio|walk[- ]?in/.test(text)) {
    return { type: 'closet', label: /formato\s+u|em\s+u/.test(text) ? 'Closet em U' : 'Closet', confidence: 0.62, alternatives: [] };
  }
  if (/estante|prateleira|nicho|divis[oó]ria/.test(text)) {
    return { type: 'armario_aberto', label: 'Móvel aberto com nichos', confidence: 0.58, alternatives: [] };
  }
  if (/gaveta|gaveteiro/.test(text)) {
    return { type: 'gaveteiro', label: 'Gaveteiro', confidence: 0.58, alternatives: [] };
  }
  if (/porta|portas/.test(text)) {
    return { type: 'armario_com_portas', label: 'Armário com portas', confidence: 0.55, alternatives: [] };
  }
  return { type: textOrNull(family.tipo) || 'unknown', label: textOrNull(family.nome) || 'Não identificado', confidence: null, alternatives: [] };
}

function outputTextFrom(value, depth = 0) {
  if (depth > 8 || value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const text = outputTextFrom(entry, depth + 1);
      if (text) return text;
    }
    return null;
  }
  if (typeof value !== 'object') return null;

  const priority = ['output_text', 'text', 'content', 'response', 'output', 'message', 'data'];
  for (const key of priority) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      const text = outputTextFrom(value[key], depth + 1);
      if (text) return text;
    }
  }
  return null;
}

function unwrapIndexedItem(value) {
  const object = asObject(value);
  const keys = Object.keys(object);
  if (keys.length > 0 && keys.every((key) => /^\d+$/.test(key))) {
    return object[keys[0]] || {};
  }
  return value;
}

function modelOutput(item) {
  const json = unwrapIndexedItem(item.json);
  return outputTextFrom(json) || asObject(json);
}

function binaryEntries(item) {
  const binary = asObject(item?.binary);
  return Object.entries(binary).filter(([, value]) => value && typeof value === 'object');
}

function imageBinaryEntries(item) {
  const entries = binaryEntries(item);
  const imageEntries = entries.filter(([name]) => /^image\d*$/.test(name) || name === 'data');
  return imageEntries.length ? imageEntries : entries;
}

function sourceFrom(item, body, vision) {
  const files = imageBinaryEntries(item);
  const primary = files.find(([name]) => name === 'image0') || files.find(([name]) => name === 'image') || files[0];
  const primaryBinary = primary?.[1] || {};
  return {
    type: 'image',
    filename: primaryBinary.fileName || body.filename || null,
    binary_properties: files.map(([name]) => name),
    filenames: files.map(([, value]) => value.fileName).filter(Boolean),
    view: textOrNull(vision.view) || 'unknown',
    width_px: numberOrNull(vision.image_width_px),
    height_px: numberOrNull(vision.image_height_px)
  };
}

const input = $input.first();
let webhookItem = null;
for (const nodeName of ['Receber Rascunho', 'Webhook']) {
  try {
    webhookItem = $(nodeName).first();
    if (webhookItem) break;
  } catch (error) {
    // O helper não existe fora do runtime do N8N; usa o item atual no teste local.
  }
}
const sourceItem = webhookItem || input;
const body = asObject(sourceItem.json?.body || sourceItem.json?.request || input.json?.body || input.json?.request || input.json);
const vision = parseModelJson(modelOutput(input));
const viewAnalyses = Array.isArray(vision.view)
  ? vision.view
  : Array.isArray(vision.views)
    ? vision.views
    : [];
const components = firstArray(vision, ['components', 'componentes', 'elements', 'visual_elements', 'features', 'parts', 'evidence'])
  .concat(viewAnalyses.flatMap((view) => firstArray(view, ['components', 'componentes', 'elements', 'visual_elements', 'features', 'parts', 'evidence'])));
const ocrText = [
  ...listOfStrings(vision.ocr_text),
  ...viewAnalyses.flatMap((view) => listOfStrings(view?.ocr_text))
].slice(0, 100);
const dimensions = asObject(vision.dimensions || viewAnalyses.find((view) => view?.dimensions)?.dimensions);
const dimensionValue = (name) => {
  const values = [dimensions[name], ...viewAnalyses.map((view) => view?.dimensions?.[name])];
  return values.find((value) => value !== null && value !== undefined && value !== '') ?? null;
};
const combinedDescription = textOrNull(vision.description || vision.summary || vision.analysis)
  || viewAnalyses.map((view) => textOrNull(view?.description || view?.summary)).filter(Boolean).join(' | ')
  || null;
const proposal = asObject(vision.proposal);
const composition = asObject(vision.composition || proposal.composition);
const proposedModuleCandidates = Array.isArray(vision.modules)
  ? vision.modules
  : Array.isArray(vision.modulos)
    ? vision.modulos
    : Array.isArray(proposal.modules)
      ? proposal.modules
      : (vision.module || proposal.module ? [vision.module || proposal.module] : []);
const proposedModules = proposedModuleCandidates.filter(meaningfulModule);
const proposedModule = proposedModules[0] || null;
let family = asObject(vision.family || vision.familia || proposal.family || proposal.familia);
if (!Object.keys(family).length) family = { tipo: 'unknown', nome: 'Não identificado' };
const identification = deriveIdentification(vision, combinedDescription, ocrText, family);
if (family.tipo === 'unknown' && identification.type !== 'unknown') {
  family = { tipo: identification.type, nome: identification.label, confidence: identification.confidence };
}
const derivedLayout = deriveLayout(combinedDescription, vision.layout || composition.layout);
const requestedId = body.id || input.json?.id || `DRAFT-N8N-${Date.now()}`;

const draftPayload = {
  pedido: String(body.pedido || input.json?.pedido || '').trim(),
  draft: {
    id: requestedId,
    source: sourceFrom(sourceItem, body, vision),
    description: combinedDescription,
    identification: {
      type: textOrNull(identification.type) || textOrNull(family.tipo) || 'unknown',
      label: textOrNull(identification.label) || textOrNull(family.nome) || 'Não identificado',
      confidence: numberOrNull(identification.confidence) ?? numberOrNull(family.confidence),
      alternatives: Array.isArray(identification.alternatives) ? identification.alternatives : [],
      observed_geometry: textOrNull(identification.observed_geometry)
    },
    observations: [
      ...listOfStrings(vision.observations),
      ...viewAnalyses.flatMap((view) => listOfStrings(view?.observations))
    ].slice(0, 100),
    calibration: {
      status: 'needs_confirmation',
      reference_dimension: dimensions.reference_dimension || null,
      reference_value_mm: numberOrNull(dimensionValue('reference_value_mm')),
      
      scale_px_per_mm: null
    },
    ocr_text: ocrText,
    visual_measurements: {
      width_mm: numberOrNull(dimensionValue('width_mm')),
      depth_mm: numberOrNull(dimensionValue('depth_mm')),
      height_mm: numberOrNull(dimensionValue('height_mm')),
      board_thickness_mm: numberOrNull(dimensionValue('board_thickness_mm'))
    },
    composition: {
      ...composition,
      layout: derivedLayout,
      description: textOrNull(composition.description) || combinedDescription || ''
    },
    module: proposedModule,
    modules: proposedModules,
    proposal: {
      family,
      module: proposedModule,
      modules: proposedModules,
      composition
    },
    evidence: components.slice(0, 100).map((component, index) => ({
      id: component.id || `VISION-EVID-${String(index + 1).padStart(3, '0')}`,
      kind: component.kind || 'unknown',
      box_px: asObject(component.box_px || component.box),
      confidence: numberOrNull(component.confidence) ?? numberOrNull(component.box_px?.confidence) ?? numberOrNull(component.box?.confidence) ?? 0,
      status: ['observed', 'proposed', 'needs_confirmation', 'rejected'].includes(component.status) ? component.status : 'proposed',
      notes: String(component.notes || '').trim(),
      label: textOrNull(component.label),
      description: textOrNull(component.description),
      module_id: component.module_id ? String(component.module_id) : null,
      posicao: asObject(component.posicao),
      dimensoes: asObject(component.dimensoes)
    })),
    assumptions: [
      'A interpretação foi realizada no N8N usando a credencial OpenAI configurada no workflow.',
      'Dimensões sem cota legível permanecem nulas e exigem confirmação humana.',
      ...(Array.isArray(vision.assumptions) ? vision.assumptions.map(String) : listOfStrings(vision.assumptions))
    ],
    open_questions: [
      ...(Array.isArray(vision.open_questions) ? vision.open_questions.map(String) : listOfStrings(vision.open_questions)),
      'Confirme largura, profundidade, altura e espessura da chapa antes da conversão.'
    ]
  }
};

return [{ json: { draft_payload: draftPayload } }];


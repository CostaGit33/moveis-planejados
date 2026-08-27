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
  try {
    return JSON.parse(clean);
  } catch (error) {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
    throw new Error('O nó OpenAI não retornou JSON válido para evidências visuais.');
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

function modelOutput(item) {
  const json = asObject(item.json);
  return outputTextFrom(json) || json;
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
    view: ['front', 'perspective', 'side', 'top', 'plan', 'unknown'].includes(vision.view) ? vision.view : 'unknown',
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
const components = Array.isArray(vision.components)
  ? vision.components
  : viewAnalyses.flatMap((view) => Array.isArray(view?.components) ? view.components : []);
const ocrText = [
  ...listOfStrings(vision.ocr_text),
  ...viewAnalyses.flatMap((view) => listOfStrings(view?.ocr_text))
].slice(0, 100);
const dimensions = asObject(vision.dimensions || viewAnalyses.find((view) => view?.dimensions)?.dimensions);
const dimensionValue = (name) => {
  const values = [dimensions[name], ...viewAnalyses.map((view) => view?.dimensions?.[name])];
  return values.find((value) => value !== null && value !== undefined && value !== '') ?? null;
};
const combinedDescription = textOrNull(vision.description)
  || viewAnalyses.map((view) => textOrNull(view?.description)).filter(Boolean).join(' | ')
  || null;
const requestedId = body.id || input.json?.id || `DRAFT-N8N-${Date.now()}`;

const draftPayload = {
  pedido: String(body.pedido || input.json?.pedido || '').trim(),
  draft: {
    id: requestedId,
    source: sourceFrom(sourceItem, body, vision),
    description: combinedDescription,
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
    evidence: components.slice(0, 100).map((component, index) => ({
      id: component.id || `VISION-EVID-${String(index + 1).padStart(3, '0')}`,
      kind: component.kind || 'unknown',
      box_px: asObject(component.box_px || component.box),
      confidence: numberOrNull(component.confidence) ?? numberOrNull(component.box_px?.confidence) ?? numberOrNull(component.box?.confidence) ?? 0,
      status: ['observed', 'proposed', 'needs_confirmation', 'rejected'].includes(component.status) ? component.status : 'proposed',
      notes: String(component.notes || '').trim()
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


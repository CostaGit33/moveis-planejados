// Cole este código em um nó Code do N8N após o nó OpenAI de análise de imagem.
// Entrada: item do OpenAI com texto JSON e, opcionalmente, dados do Webhook.
// Saída: um item com `draft_payload` pronto para POST /api/drafts/analyze.

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function parseModelJson(value) {
  if (value && typeof value === 'object') return value;
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

function modelOutput(item) {
  const json = asObject(item.json);
  return json.output_text
    || json.text
    || json.content
    || json.response
    || json.output?.text
    || json.message?.content
    || json.data?.output_text
    || json.data?.text
    || json;
}

function sourceFrom(item, body, vision) {
  const binary = item.binary?.image || item.binary?.data || {};
  return {
    type: 'image',
    filename: binary.fileName || body.filename || null,
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
const components = Array.isArray(vision.components) ? vision.components : [];
const ocrText = Array.isArray(vision.ocr_text) ? vision.ocr_text.map(String).filter(Boolean) : [];
const dimensions = asObject(vision.dimensions);
const requestedId = body.id || input.json?.id || `DRAFT-N8N-${Date.now()}`;

const draftPayload = {
  pedido: String(body.pedido || input.json?.pedido || '').trim(),
  draft: {
    id: requestedId,
    source: sourceFrom(sourceItem, body, vision),
    calibration: {
      status: 'needs_confirmation',
      reference_dimension: dimensions.reference_dimension || null,
      reference_value_mm: numberOrNull(dimensions.reference_value_mm),
      scale_px_per_mm: null
    },
    ocr_text: ocrText.slice(0, 100),
    visual_measurements: {
      width_mm: numberOrNull(dimensions.width_mm),
      depth_mm: numberOrNull(dimensions.depth_mm),
      height_mm: numberOrNull(dimensions.height_mm),
      board_thickness_mm: numberOrNull(dimensions.board_thickness_mm)
    },
    evidence: components.slice(0, 100).map((component, index) => ({
      id: component.id || `VISION-EVID-${String(index + 1).padStart(3, '0')}`,
      kind: component.kind || 'unknown',
      box_px: asObject(component.box_px),
      confidence: numberOrNull(component.confidence) ?? 0,
      status: ['observed', 'proposed', 'needs_confirmation', 'rejected'].includes(component.status) ? component.status : 'proposed',
      notes: String(component.notes || '').trim()
    })),
    assumptions: [
      'A interpretação foi realizada no N8N usando a credencial OpenAI configurada no workflow.',
      'Dimensões sem cota legível permanecem nulas e exigem confirmação humana.',
      ...(Array.isArray(vision.assumptions) ? vision.assumptions.map(String) : [])
    ],
    open_questions: [
      ...(Array.isArray(vision.open_questions) ? vision.open_questions.map(String) : []),
      'Confirme largura, profundidade, altura e espessura da chapa antes da conversão.'
    ]
  }
};

return [{ json: { draft_payload: draftPayload } }];

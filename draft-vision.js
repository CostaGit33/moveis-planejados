const sizeOf = require('image-size');

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_KINDS = new Set([
  'side',
  'top',
  'base',
  'back',
  'shelf',
  'vertical_divider',
  'door',
  'drawer',
  'drawer_front',
  'hanger',
  'foot',
  'mirror',
  'unknown'
]);
const DEFAULT_MODEL = 'gemini-3-flash-preview';
const DEFAULT_MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const VISION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    view: { type: 'string', enum: ['front', 'perspective', 'side', 'top', 'plan', 'unknown'] },
    description: { type: 'string' },
    ocr_text: {
      type: 'array',
      items: { type: 'string' }
    },
    dimensions: {
      type: 'object',
      additionalProperties: false,
      properties: {
        width_mm: { type: ['number', 'null'] },
        depth_mm: { type: ['number', 'null'] },
        height_mm: { type: ['number', 'null'] },
        board_thickness_mm: { type: ['number', 'null'] },
        reference_dimension: { type: ['string', 'null'] },
        reference_value_mm: { type: ['number', 'null'] }
      },
      required: ['width_mm', 'depth_mm', 'height_mm', 'board_thickness_mm', 'reference_dimension', 'reference_value_mm']
    },
    components: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: {
            type: 'string',
            enum: Array.from(ALLOWED_KINDS)
          },
          box_px: {
            type: 'object',
            additionalProperties: false,
            properties: {
              x: { type: ['number', 'null'] },
              y: { type: ['number', 'null'] },
              width: { type: ['number', 'null'] },
              height: { type: ['number', 'null'] }
            },
            required: ['x', 'y', 'width', 'height']
          },
          confidence: { type: 'number' },
          status: { type: 'string', enum: ['observed', 'proposed', 'needs_confirmation', 'rejected'] },
          notes: { type: 'string' }
        },
        required: ['kind', 'box_px', 'confidence', 'status', 'notes']
      }
    },
    assumptions: {
      type: 'array',
      items: { type: 'string' }
    },
    open_questions: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['view', 'description', 'ocr_text', 'dimensions', 'components', 'assumptions', 'open_questions']
};

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeBaseUrl(value) {
  const base = String(value || '').trim().replace(/\/+$/, '');
  if (!base) return '';
  return /\/v1$/i.test(base) ? base : `${base}/v1`;
}

function getVisionConfig(env = process.env) {
  const baseUrl = normalizeBaseUrl(env.VISION_API_BASE || env.OPENAI_API_BASE);
  const apiKey = String(env.VISION_API_KEY || env.OPENAI_API_KEY || '').trim();
  const model = String(env.VISION_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const maxImageBytes = Number(env.VISION_MAX_IMAGE_BYTES || DEFAULT_MAX_IMAGE_BYTES);
  return {
    enabled: Boolean(baseUrl && apiKey),
    baseUrl,
    apiKey,
    model,
    maxImageBytes: Number.isFinite(maxImageBytes) && maxImageBytes > 0 ? maxImageBytes : DEFAULT_MAX_IMAGE_BYTES
  };
}

function visionStatus(env = process.env) {
  const config = getVisionConfig(env);
  return {
    enabled: config.enabled,
    model: config.model,
    max_image_bytes: config.maxImageBytes
  };
}

function assertImageFile(file, maxImageBytes = DEFAULT_MAX_IMAGE_BYTES) {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    const error = new Error('Envie um arquivo de imagem nos formatos JPEG, PNG ou WebP.');
    error.code = 'VISION_IMAGE_REQUIRED';
    throw error;
  }
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    const error = new Error('Formato de imagem não suportado. Use JPEG, PNG ou WebP.');
    error.code = 'VISION_IMAGE_TYPE';
    throw error;
  }
  if (file.size > maxImageBytes) {
    const error = new Error(`A imagem excede o limite de ${Math.round(maxImageBytes / 1024 / 1024)} MB.`);
    error.code = 'VISION_IMAGE_TOO_LARGE';
    throw error;
  }
  let dimensions;
  try {
    dimensions = sizeOf(file.buffer);
  } catch (error) {
    const invalid = new Error('Não foi possível ler as dimensões da imagem enviada.');
    invalid.code = 'VISION_IMAGE_INVALID';
    throw invalid;
  }
  if (!dimensions.width || !dimensions.height) {
    const error = new Error('A imagem não possui dimensões válidas.');
    error.code = 'VISION_IMAGE_INVALID';
    throw error;
  }
  return { width: dimensions.width, height: dimensions.height };
}

function buildPrompt({ pedido = '', width, height }) {
  return `Analise a imagem anexada como um interpretador técnico de rascunhos de móveis planejados.

Pedido opcional do usuário: ${pedido || '(não informado)'}
Dimensões reais em pixels: ${width} x ${height}.

Retorne somente o JSON do schema solicitado. Não escreva markdown.

Regras obrigatórias:
1. Extraia todo texto legível da imagem em ocr_text, preservando unidades e números exatamente como aparecem.
2. Só preencha width_mm, depth_mm, height_mm, board_thickness_mm ou reference_value_mm quando a medida estiver explicitamente escrita e associada a um componente. Caso contrário, use null.
3. Nunca deduza escala, profundidade, espessura ou medidas reais a partir de perspectiva, proporção visual ou conhecimento de marcenaria.
4. Identifique apenas componentes visíveis ou claramente desenhados. Não invente portas, gavetas, ferragens ou divisórias ocultas.
5. Para cada componente, forneça uma caixa aproximada em pixels dentro da imagem, tipo permitido, confiança entre 0 e 1, status observado/proposed/needs_confirmation e uma nota curta.
6. Use status proposed ou needs_confirmation quando houver ambiguidade. A análise visual nunca confirma medidas por si só.
7. Se a imagem for de ambiente, registre paredes, janela, espelho ou abertura quando visíveis, mas priorize o módulo de móvel que possa ser convertido nesta primeira versão.
8. Liste perguntas objetivas para as informações necessárias à conversão segura, incluindo as quatro dimensões críticas quando não estiverem explícitas: largura, profundidade, altura e espessura da chapa.`;
}

function extractMessageContent(data) {
  const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
  const content = choice?.message?.content;
  if (Array.isArray(content)) {
    return content.map((part) => part?.text || '').join('');
  }
  return typeof content === 'string' ? content : '';
}

function parseJsonContent(content) {
  const text = String(content || '').trim();
  const withoutFence = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(withoutFence);
  } catch (error) {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(withoutFence.slice(start, end + 1));
    const parseError = new Error('O interpretador visual não retornou JSON válido.');
    parseError.code = 'VISION_INVALID_OUTPUT';
    throw parseError;
  }
}

function normalizeVisionResult(value, imageDimensions) {
  const input = asObject(value);
  const rawDimensions = asObject(input.dimensions);
  const components = Array.isArray(input.components) ? input.components : [];
  const ocrText = Array.isArray(input.ocr_text) ? input.ocr_text.map(String).filter(Boolean) : [];
  const width = imageDimensions.width;
  const height = imageDimensions.height;
  return {
    view: ['front', 'perspective', 'side', 'top', 'plan', 'unknown'].includes(input.view) ? input.view : 'unknown',
    description: String(input.description || '').trim(),
    ocr_text: ocrText.slice(0, 100),
    dimensions: {
      width_mm: asNumberOrNull(rawDimensions.width_mm),
      depth_mm: asNumberOrNull(rawDimensions.depth_mm),
      height_mm: asNumberOrNull(rawDimensions.height_mm),
      board_thickness_mm: asNumberOrNull(rawDimensions.board_thickness_mm),
      reference_dimension: rawDimensions.reference_dimension ? String(rawDimensions.reference_dimension) : null,
      reference_value_mm: asNumberOrNull(rawDimensions.reference_value_mm)
    },
    components: components.slice(0, 100).map((item, index) => {
      const source = asObject(item);
      const box = asObject(source.box_px);
      const x = asNumberOrNull(box.x);
      const y = asNumberOrNull(box.y);
      const boxWidth = asNumberOrNull(box.width);
      const boxHeight = asNumberOrNull(box.height);
      return {
        id: `VISION-EVID-${String(index + 1).padStart(3, '0')}`,
        kind: ALLOWED_KINDS.has(source.kind) ? source.kind : 'unknown',
        box_px: {
          x: x === null ? null : clamp(x, 0, width),
          y: y === null ? null : clamp(y, 0, height),
          width: boxWidth === null ? null : clamp(boxWidth, 0, width),
          height: boxHeight === null ? null : clamp(boxHeight, 0, height)
        },
        confidence: clamp(asNumberOrNull(source.confidence) ?? 0, 0, 1),
        status: ['observed', 'proposed', 'needs_confirmation', 'rejected'].includes(source.status) ? source.status : 'proposed',
        notes: String(source.notes || '').trim()
      };
    }),
    assumptions: Array.isArray(input.assumptions) ? input.assumptions.map(String).filter(Boolean).slice(0, 100) : [],
    open_questions: Array.isArray(input.open_questions) ? input.open_questions.map(String).filter(Boolean).slice(0, 100) : []
  };
}

async function callVisionModel({ file, pedido = '', env = process.env }) {
  const config = getVisionConfig(env);
  if (!config.enabled) {
    const error = new Error('Interpretador visual não configurado. Defina VISION_API_BASE e VISION_API_KEY na API.');
    error.code = 'VISION_NOT_CONFIGURED';
    throw error;
  }
  const imageDimensions = assertImageFile(file, config.maxImageBytes);
  const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
  const body = {
    model: config.model,
    messages: [
      { role: 'system', content: 'Você é um extrator visual conservador para móveis planejados. Responda apenas no schema JSON.' },
      {
        role: 'user',
        content: [
          { type: 'text', text: buildPrompt({ pedido, ...imageDimensions }) },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } }
        ]
      }
    ],
    response_format: /^gemini/i.test(config.model)
      ? { type: 'json_object' }
      : {
        type: 'json_schema',
        json_schema: {
          name: 'draft_vision_evidence',
          strict: true,
          schema: VISION_SCHEMA
        }
      }
  };
  if (/^gpt-5(?:[.-]|$)/i.test(config.model)) {
    body.max_completion_tokens = 5000;
  } else {
    body.max_tokens = 5000;
  }

  let response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    const upstream = new Error('Não foi possível conectar ao interpretador visual.');
    upstream.code = 'VISION_UPSTREAM_UNAVAILABLE';
    upstream.cause = error;
    throw upstream;
  }
  const responseText = await response.text();
  let responseData = {};
  try {
    responseData = responseText ? JSON.parse(responseText) : {};
  } catch (error) {
    responseData = {};
  }
  if (!response.ok) {
    const upstream = new Error('O interpretador visual recusou a imagem.');
    upstream.code = 'VISION_UPSTREAM_ERROR';
    upstream.status = response.status;
    upstream.detail = String(responseData?.error?.message || '').slice(0, 500);
    throw upstream;
  }
  const content = extractMessageContent(responseData);
  const parsed = parseJsonContent(content);
  return {
    ...normalizeVisionResult(parsed, imageDimensions),
    model: config.model,
    image_dimensions: imageDimensions
  };
}

function buildDraftPayloadFromVision({ file, pedido = '', vision, id }) {
  const dimensions = vision.dimensions;
  const hasExplicitDimension = [dimensions.width_mm, dimensions.depth_mm, dimensions.height_mm, dimensions.board_thickness_mm]
    .some((value) => value !== null);
  const assumptions = [
    'A interpretação visual foi gerada por um modelo multimodal e precisa de revisão humana.',
    ...(hasExplicitDimension ? ['As medidas preenchidas foram encontradas como texto ou anotação na imagem; confirme antes da conversão.'] : ['Nenhuma dimensão crítica foi confirmada pela imagem.'])
  ];
  return {
    pedido: String(pedido || 'Conversão assistida de imagem'),
    draft: {
      id: id || `DRAFT-VISION-${Date.now()}`,
      source: {
        type: 'image',
        filename: file.originalname || 'rascunho-imagem',
        view: vision.view,
        width_px: vision.image_dimensions.width,
        height_px: vision.image_dimensions.height
      },
      calibration: {
        status: 'needs_confirmation',
        reference_dimension: dimensions.reference_dimension,
        reference_value_mm: dimensions.reference_value_mm,
        scale_px_per_mm: null
      },
      evidence: vision.components,
      ocr_text: vision.ocr_text,
      visual_measurements: { ...dimensions },
      assumptions: [...assumptions, ...vision.assumptions],
      open_questions: vision.open_questions,
      module: {
        id: `MOD-${id || 'VISION-001'}`,
        tipo: null,
        nome: 'Módulo interpretado da imagem',
        x: 0,
        y: 0,
        z: 0,
        largura: null,
        profundidade: null,
        altura: null,
        espessura_chapa: null,
        material: 'mdf_areia'
      }
    }
  };
}

module.exports = {
  ALLOWED_MIME_TYPES,
  VISION_SCHEMA,
  getVisionConfig,
  visionStatus,
  assertImageFile,
  callVisionModel,
  buildDraftPayloadFromVision,
  normalizeVisionResult
};

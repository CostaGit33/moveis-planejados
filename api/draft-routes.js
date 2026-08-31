const multer = require('multer');
const { analyzeDraft, convertDraftToProject } = require('../draft-converter');
const { callVisionModel, buildDraftPayloadFromVision, getVisionConfig, visionStatus, getN8nWebhookConfig } = require('../draft-vision');
const { enrichProject, projectToScene } = require('../hybrid-contract');
const { projectParts } = require('./hybrid-routes');

function uploadErrorResponse(error) {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return { status: 413, body: { ok: false, code: 'VISION_IMAGE_TOO_LARGE', error: 'A imagem excede o limite configurado para análise.' } };
  }
  if (error?.code === 'LIMIT_UNEXPECTED_FILE') {
    return { status: 400, body: { ok: false, code: 'VISION_IMAGE_FIELD', error: 'Envie a imagem no campo multipart chamado image.' } };
  }
  return { status: 400, body: { ok: false, code: error?.code || 'VISION_UPLOAD_ERROR', error: error?.message || 'Não foi possível receber a imagem.' } };
}

function responseJsonOrNull(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch (error) {
    return null;
  }
}

function n8nProxyError(message, code, status, detail) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  if (detail) error.detail = String(detail).slice(0, 500);
  return error;
}

function normalizeN8nDraftResponse(value, pedido) {
  const body = Array.isArray(value) ? value[0] : value;
  if (!body || typeof body !== 'object') {
    throw n8nProxyError('O workflow N8N não retornou um objeto JSON.', 'N8N_INVALID_OUTPUT', 502);
  }

  const payload = body.draft_payload?.draft
    ? body.draft_payload
    : body.draft
      ? { pedido: body.pedido || pedido || '', draft: body.draft }
      : null;

  const imageBase64 = typeof body.imagem_base64 === 'string' && body.imagem_base64.trim()
    ? body.imagem_base64.trim()
    : null;
  const imageUrl = typeof body.image_url === 'string' && body.image_url.trim()
    ? body.image_url.trim()
    : null;
  const hasImage = Boolean(imageBase64 || imageUrl);

  if (!payload?.draft && !hasImage) {
    throw n8nProxyError('O workflow N8N não retornou draft_payload nem imagem final.', 'N8N_INVALID_OUTPUT', 502);
  }

  return {
    payload,
    body,
    image: hasImage ? {
      image_url: imageUrl,
      imagem_base64: imageBase64,
      mimeType: body.arquivo?.mimeType || 'image/png',
      nome: body.arquivo?.nome || (imageBase64 ? `cena-${body.runId || 'gerada'}.png` : null),
      codigo: body.codigo || 'IMAGE_GENERATED',
      etapa: body.etapa || 'imagem_gerada',
      runId: body.runId || null,
      referencia_visual_utilizada: body.referencia_visual_utilizada !== false,
      identificacao_movel: body.identificacao_movel || null,
      especificacao_tecnica: body.especificacao_tecnica || null,
      image_prompt: body.image_prompt || null
    } : null
  };
}

async function callN8nDraftWebhook({ file, files = [], pedido = '', id, env = process.env }) {
  const config = getN8nWebhookConfig(env);
  if (!config.enabled) {
    throw n8nProxyError('O analisador N8N não está configurado.', 'N8N_NOT_CONFIGURED', 503);
  }
  const receivedFiles = Array.isArray(files) && files.length ? files : (file ? [file] : []);
  if (!receivedFiles.length || !receivedFiles.every((item) => Buffer.isBuffer(item?.buffer))) {
    throw n8nProxyError('Envie um arquivo de imagem para o workflow N8N.', 'VISION_IMAGE_REQUIRED', 400);
  }
  if (typeof FormData !== 'function' || typeof Blob !== 'function') {
    throw n8nProxyError('O runtime da API não oferece suporte a multipart para o webhook N8N.', 'N8N_RUNTIME_UNSUPPORTED', 503);
  }

  const formData = new FormData();
  // O workflow publicado lê image0,image1. Para uma seleção única, repetir o
  // mesmo arquivo mantém o contrato do workflow sem expor a credencial ao browser.
  const filesForWorkflow = receivedFiles.length === 1 ? [receivedFiles[0], receivedFiles[0]] : receivedFiles.slice(0, 2);
  for (const item of filesForWorkflow) {
    formData.append('image', new Blob([item.buffer], { type: item.mimetype }), item.originalname || 'rascunho-imagem');
  }
  if (pedido) formData.append('pedido', String(pedido));
  if (id) formData.append('id', String(id));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  let response;
  try {
    response = await fetch(config.webhookUrl, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw n8nProxyError('O workflow N8N excedeu o tempo limite de análise.', 'N8N_TIMEOUT', 504);
    }
    throw n8nProxyError('Não foi possível conectar ao workflow N8N.', 'N8N_UNAVAILABLE', 502, error.message);
  } finally {
    clearTimeout(timer);
  }

  const responseText = await response.text();
  const body = responseJsonOrNull(responseText);
  if (!response.ok) {
    throw n8nProxyError('O workflow N8N recusou a imagem.', 'N8N_UPSTREAM_ERROR', 502, body?.message || body?.error || responseText);
  }
  if (!body) {
    throw n8nProxyError('O workflow N8N retornou uma resposta que não é JSON.', 'N8N_INVALID_OUTPUT', 502);
  }
  return normalizeN8nDraftResponse(body, pedido);
}

function buildN8nAnalysis({ payload, body, pedido }) {
  const result = analyzeDraft(payload);
  const draft = result.draft;
  const normalizedPayload = {
    ...payload,
    pedido: payload.pedido || pedido || '',
    draft: {
      ...payload.draft,
      ...draft,
      module: draft.proposal.module,
      proposal: draft.proposal
    }
  };
  const visualMeasurements = draft.visual_measurements || {};
  return {
    ok: true,
    ...result,
    draft_payload: normalizedPayload,
    vision: {
      model: body.vision?.model || 'n8n-openai',
      image_dimensions: {
        width: draft.source.width_px,
        height: draft.source.height_px
      },
      description: draft.description || body.vision?.description || '',
      ocr_text: draft.ocr_text || body.vision?.ocr_text || [],
      dimensions: visualMeasurements
    }
  };
}

function registerDraftRoutes(app) {
  const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: getVisionConfig().maxImageBytes,
      files: 2,
      fields: 4
    }
  });

  function uploadSingleImage(req, res, next) {
    imageUpload.single('image')(req, res, (error) => {
      if (!error) return next();
      const response = uploadErrorResponse(error);
      return res.status(response.status).json(response.body);
    });
  }

  function uploadImages(req, res, next) {
    imageUpload.array('image', 2)(req, res, (error) => {
      if (!error) return next();
      const response = uploadErrorResponse(error);
      return res.status(response.status).json(response.body);
    });
  }

  app.get('/api/drafts/vision/status', (req, res) => {
    res.json({ ok: true, ...visionStatus() });
  });

  app.get('/api/drafts/n8n/status', (req, res) => {
    const config = getN8nWebhookConfig();
    return res.json({
      ok: true,
      enabled: config.enabled,
      transport: 'n8n-webhook',
      timeout_ms: config.timeoutMs
    });
  });

  app.post('/api/drafts/analyze-image-n8n', uploadImages, async (req, res) => {
    try {
      const result = await callN8nDraftWebhook({
        files: req.files,
        pedido: req.body?.pedido,
        id: req.body?.id,
        env: process.env
      });

      if (result.image) {
        const imageDataUrl = result.image.imagem_base64
          ? (result.image.imagem_base64.startsWith('data:')
            ? result.image.imagem_base64
            : `data:${result.image.mimeType};base64,${result.image.imagem_base64}`)
          : null;
        return res.json({
          ok: true,
          image_result: {
            ...result.image,
            image_data_url: imageDataUrl
          }
        });
      }

      return res.json(buildN8nAnalysis({ payload: result.payload, body: result.body, pedido: req.body?.pedido }));
    } catch (error) {
      console.error('POST /api/drafts/analyze-image-n8n error', error.code || error.message);
      const status = ['N8N_NOT_CONFIGURED', 'N8N_RUNTIME_UNSUPPORTED'].includes(error.code)
        ? 503
        : ['N8N_UNAVAILABLE', 'N8N_TIMEOUT', 'N8N_UPSTREAM_ERROR', 'N8N_INVALID_OUTPUT'].includes(error.code)
          ? (error.code === 'N8N_TIMEOUT' ? 504 : 502)
          : 400;
      return res.status(status).json({
        ok: false,
        code: error.code || 'N8N_ERROR',
        error: error.message || 'Não foi possível analisar a imagem no N8N.',
        ...(error.detail ? { detail: error.detail } : {})
      });
    }
  });

  app.post('/api/drafts/analyze-image', uploadSingleImage, async (req, res) => {
    try {
      const vision = await callVisionModel({
        file: req.file,
        pedido: req.body?.pedido,
        env: process.env
      });
      const payload = buildDraftPayloadFromVision({
        file: req.file,
        pedido: req.body?.pedido,
        id: req.body?.id,
        vision
      });
      const result = analyzeDraft(payload);
      return res.json({
        ok: true,
        ...result,
        draft_payload: payload,
        vision: {
          model: vision.model,
          image_dimensions: vision.image_dimensions,
          description: vision.description,
          ocr_text: vision.ocr_text,
          dimensions: vision.dimensions
        }
      });
    } catch (error) {
      console.error('POST /api/drafts/analyze-image error', error.code || error.message);
      const status = error.code === 'VISION_NOT_CONFIGURED'
        ? 503
        : error.code?.startsWith('VISION_UPSTREAM') || error.code === 'VISION_INVALID_OUTPUT'
          ? 502
          : 400;
      return res.status(status).json({
        ok: false,
        code: error.code || 'VISION_ERROR',
        error: error.message || 'Não foi possível analisar a imagem.'
      });
    }
  });

  app.post('/api/drafts/analyze', (req, res) => {
    try {
      const result = analyzeDraft(req.body || {});
      return res.json({ ok: true, ...result });
    } catch (error) {
      console.error('POST /api/drafts/analyze error', error.code || error.message);
      return res.status(400).json({ ok: false, error: error.message || String(error) });
    }
  });

  app.post('/api/drafts/convert', (req, res) => {
    try {
      const result = convertDraftToProject(req.body || {});
      const project = enrichProject(result.project);
      const parts = projectParts(project);
      const scene = projectToScene(project, parts);
      return res.json({
        ok: true,
        draft: result.draft,
        validation: result.validation,
        project,
        parts,
        scene
      });
    } catch (error) {
      console.error('POST /api/drafts/convert error', error.code || error.message);
      if (error.code === 'DRAFT_INCOMPLETE') {
        return res.status(422).json({ ok: false, error: error.message, validation: error.validation });
      }
      return res.status(400).json({ ok: false, error: error.message || String(error) });
    }
  });
}
module.exports = { registerDraftRoutes, callN8nDraftWebhook, buildN8nAnalysis };

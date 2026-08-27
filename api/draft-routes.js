const multer = require('multer');
const { analyzeDraft, convertDraftToProject } = require('../draft-converter');
const { callVisionModel, buildDraftPayloadFromVision, getVisionConfig, visionStatus } = require('../draft-vision');
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

function registerDraftRoutes(app) {
  const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: getVisionConfig().maxImageBytes,
      files: 1,
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

  app.get('/api/drafts/vision/status', (req, res) => {
    res.json({ ok: true, ...visionStatus() });
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
module.exports = { registerDraftRoutes };

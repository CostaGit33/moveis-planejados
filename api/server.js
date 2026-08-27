require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { generateFromSpec } = require('../furniture-builder');
const { saveSketchupRuby } = require('../sketchup-generator-v2');
const { registerN8nRoutes } = require('./n8n-routes');
const { registerMvpRoutes } = require('./mvp-routes');
const { registerHybridRoutes } = require('./hybrid-routes');
const { registerDraftRoutes } = require('./draft-routes');

const PORT = Number(process.env.PORT || 8090);
const OUT_DIR = process.env.OUT_DIR || path.join(process.cwd(), 'saida_poc');
const FREECAD_JOBS = path.join(OUT_DIR, 'freecad_jobs');
const SKETCHUP_JOBS = path.join(OUT_DIR, 'sketchup_jobs');

function ensureDirs() {
  [OUT_DIR, FREECAD_JOBS, SKETCHUP_JOBS].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

// --- server ---
function publicUrl(req, relativePath) {
  const configured = process.env.PUBLIC_API_URL || process.env.API_URL;
  if (configured) return `${configured.replace(/\/$/, '')}/${relativePath.replace(/^\//, '')}`;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.get('host');
  return `${protocol}://${host}/${relativePath.replace(/^\//, '')}`;
}

function validateSpec(spec) {
  const modules = Array.isArray(spec) ? spec : [spec];
  if (!modules.length) return 'A especificação deve conter pelo menos um módulo.';
  for (const module of modules) {
    if (!module || typeof module !== 'object') return 'Cada módulo deve ser um objeto JSON.';
    const largura = Number(module.largura);
    const altura = Number(module.altura);
    const profundidade = Number(module.profundidade);
    if (![largura, altura, profundidade].every(Number.isFinite)) {
      return 'Cada módulo precisa de largura, altura e profundidade numéricas em milímetros.';
    }
    if (largura <= 0 || altura <= 0 || profundidade <= 0) {
      return 'Largura, altura e profundidade devem ser maiores que zero.';
    }
  }
  return null;
}

function enqueueJob(dir, jobObj) {
  ensureDirs();
  const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filename = `${id}.json`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, JSON.stringify({ id, ...jobObj }, null, 2), 'utf8');
  return { id, filePath, filename };
}

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '2mb' }));
app.use('/vendor/three/build', express.static(path.join(__dirname, '..', 'node_modules', 'three', 'build')));
app.use('/vendor/three/examples/jsm', express.static(path.join(__dirname, '..', 'node_modules', 'three', 'examples', 'jsm')));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/saida_poc', express.static(path.join(__dirname, '..', 'saida_poc')));
app.use('/examples', express.static(path.join(__dirname, '..', 'examples')));
registerMvpRoutes(app);
registerN8nRoutes(app);
registerHybridRoutes(app, { outDir: OUT_DIR });
registerDraftRoutes(app);

app.get('/projeto_base.json', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'projeto_base.json'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), api: 'moveis-planejados', version: '1.0' });
});

app.post('/api/generate/bom', (req, res) => {
  try {
    const spec = req.body;
    const validation = validateSpec(spec);
    if (validation) return res.status(400).json({ ok: false, error: validation });
    ensureDirs();
    const results = generateFromSpec(spec, { outDir: OUT_DIR });
    return res.json({ ok: true, results });
  } catch (error) {
    console.error('POST /api/generate/bom error', error.code || error.message);
    return res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

app.get('/api/generate/freecad', (req, res) => {
  res.json({ ok: true, method: 'POST', endpoint: '/api/generate/freecad', mode: 'job', message: 'Recebe a especificação e cria um job para um worker FreeCAD.' });
});

app.post('/api/generate/freecad', (req, res) => {
  try {
    const job = enqueueJob(FREECAD_JOBS, { type: 'freecad', created_at: new Date().toISOString(), job: req.body || {} });
    return res.status(202).json({ ok: true, status: 'queued', job_id: job.id, job_file: job.filename, path: job.filePath });
  } catch (error) {
    console.error('POST /api/generate/freecad error', error.code || error.message);
    return res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

app.get('/api/generate/sketchup', (req, res) => {
  res.json({
    ok: true,
    method: 'POST',
    endpoint: '/api/generate/sketchup',
    content_type: 'application/json',
    mode: 'ruby-script',
    message: 'Envia a especificação do móvel. A API gera um arquivo .rb executável no SketchUp.'
  });
});

app.post('/api/generate/sketchup', (req, res) => {
  try {
    const spec = req.body;
    const validation = validateSpec(spec);
    if (validation) return res.status(400).json({ ok: false, error: validation });

    ensureDirs();
    const result = saveSketchupRuby(spec, SKETCHUP_JOBS);
    const relative = `saida_poc/sketchup_jobs/${result.filename}`;
    const jobId = path.basename(result.filename, '.rb');

    return res.status(201).json({
      ok: true,
      status: 'ready',
      job_id: jobId,
      format: 'sketchup-ruby',
      filename: result.filename,
      script_url: publicUrl(req, relative),
      message: 'Script SketchUp gerado. Abra/execute o .rb no SketchUp para criar o modelo 3D.'
    });
  } catch (error) {
    console.error('POST /api/generate/sketchup error', error.code || error.message);
    return res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

app.get('/api/generate/sketchup/:jobId', (req, res) => {
  const jobId = String(req.params.jobId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!jobId) return res.status(400).json({ ok: false, error: 'job_id inválido.' });
  const filename = `${jobId}.rb`;
  const filePath = path.join(SKETCHUP_JOBS, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: 'Job SketchUp não encontrado.' });
  return res.json({ ok: true, status: 'ready', job_id: jobId, filename, script_url: publicUrl(req, `saida_poc/sketchup_jobs/${filename}`) });
});

app.post('/webhook/gerar-moveis', (req, res) => {
  try {
    const payload = req.body;
    if (!payload) return res.status(400).json({ error: 'Missing payload' });
    ensureDirs();
    let results = [];
    if (payload.spec) {
      const validation = validateSpec(payload.spec);
      if (validation) return res.status(400).json({ ok: false, error: validation });
      results = generateFromSpec(payload.spec, { outDir: OUT_DIR });
    }
    const freecad = enqueueJob(FREECAD_JOBS, { type: 'freecad', created_at: new Date().toISOString(), payload });
    const sketchup = saveSketchupRuby(payload.spec || {}, SKETCHUP_JOBS);

    return res.status(202).json({
      ok: true,
      bom_results: results,
      freecad_job: { id: freecad.id, file: freecad.filename },
      sketchup_job: {
        id: path.basename(sketchup.filename, '.rb'),
        file: sketchup.filename,
        script_url: publicUrl(req, `saida_poc/sketchup_jobs/${sketchup.filename}`)
      }
    });
  } catch (error) {
    console.error('POST /webhook/gerar-moveis error', error.code || error.message);
    return res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

app.listen(PORT, () => {
  ensureDirs();
  console.log(`API server listening on port ${PORT} - OUT_DIR=${OUT_DIR}`);
});

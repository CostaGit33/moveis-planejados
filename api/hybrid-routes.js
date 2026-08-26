const fs = require('fs');
const path = require('path');
const { generateParts } = require('../furniture-builder');
const { enrichProject, projectToScene } = require('../hybrid-contract');

const JOB_TYPES = new Set(['freecad', 'sketchup', 'blender', 'nesting']);
const JOB_STATUSES = new Set(['queued', 'running', 'completed', 'failed']);

function safeJobId(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '');
}

function projectParts(project) {
  return (project.modulos || []).flatMap((module) => {
    const generated = generateParts({
      ...module,
      espessura: module.espessura_chapa
    });
    return generated.map((piece, index) => ({
      ...piece,
      id: piece.id || `${module.id}-PECA-${String(index + 1).padStart(2, '0')}`,
      modulo_id: module.id,
      x: module.x,
      y: module.y,
      z: module.z
    }));
  });
}

function ensureJobDir(outDir) {
  const directory = path.join(outDir, 'hybrid_jobs');
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function createJob(outDir, type, project, options = {}) {
  const directory = ensureJobDir(outDir);
  const id = `hybrid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const payload = {
    id,
    type,
    status: 'queued',
    worker_status: 'waiting_worker',
    created_at: new Date().toISOString(),
    input: {
      project,
      options
    }
  };
  const filename = `${id}.json`;
  const filePath = path.join(directory, filename);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return { ...payload, filename, filePath };
}

function registerHybridRoutes(app, options = {}) {
  const outDir = options.outDir || path.join(process.cwd(), 'saida_poc');

  app.get('/api/hybrid/capabilities', (req, res) => {
    res.json({
      ok: true,
      architecture: 'hybrid',
      contract: {
        version: '1.1',
        unit: 'mm',
        scene_format: 'internal-scene-v1',
        exchange_format: 'glb/glTF-ready'
      },
      adapters: {
        viewer_web: { status: 'available', engine: 'three' },
        sketchup: { status: 'available', format: 'sketchup-ruby' },
        freecad: { status: 'queued-only', format: 'freecad-job-json' },
        blender: { status: 'queued-only', format: 'blender-job-json' },
        nesting: { status: 'queued-only', format: 'nesting-job-json' }
      }
    });
  });

  app.post('/api/hybrid/scene', (req, res) => {
    try {
      const input = req.body && req.body.project ? req.body.project : req.body;
      const project = enrichProject(input || {});
      const parts = Array.isArray(req.body?.parts) && req.body.parts.length
        ? req.body.parts
        : projectParts(project);
      const scene = projectToScene(project, parts);
      return res.json({ ok: true, project, parts, scene });
    } catch (error) {
      console.error('POST /api/hybrid/scene error', error.code || error.message);
      return res.status(400).json({ ok: false, error: error.message || String(error) });
    }
  });

  app.post('/api/hybrid/jobs', (req, res) => {
    try {
      const type = String(req.body?.type || '').toLowerCase();
      if (!JOB_TYPES.has(type)) {
        return res.status(400).json({
          ok: false,
          error: 'type deve ser freecad, sketchup, blender ou nesting.'
        });
      }
      const project = enrichProject(req.body?.project || {});
      if (!project.modulos.length) {
        return res.status(400).json({ ok: false, error: 'O projeto precisa conter pelo menos um módulo.' });
      }
      const job = createJob(outDir, type, project, req.body?.options || {});
      return res.status(202).json({
        ok: true,
        job_id: job.id,
        type: job.type,
        status: job.status,
        worker_status: job.worker_status,
        job_file: job.filename,
        message: 'Job registrado. Um worker externo ainda precisa consumir este arquivo.'
      });
    } catch (error) {
      console.error('POST /api/hybrid/jobs error', error.code || error.message);
      return res.status(400).json({ ok: false, error: error.message || String(error) });
    }
  });

  app.patch('/api/hybrid/jobs/:jobId', (req, res) => {
    const jobId = safeJobId(req.params.jobId);
    if (!jobId) return res.status(400).json({ ok: false, error: 'job_id inválido.' });
    const filePath = path.join(ensureJobDir(outDir), `${jobId}.json`);
    if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: 'Job híbrido não encontrado.' });

    try {
      const job = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const status = req.body?.status === undefined ? job.status : String(req.body.status);
      if (!JOB_STATUSES.has(status)) {
        return res.status(400).json({ ok: false, error: 'status deve ser queued, running, completed ou failed.' });
      }
      const next = {
        ...job,
        status,
        worker_status: req.body?.worker_status || job.worker_status,
        artifacts: Array.isArray(req.body?.artifacts) ? req.body.artifacts : (job.artifacts || []),
        error: req.body?.error || job.error || null,
        updated_at: new Date().toISOString()
      };
      if (status === 'completed' || status === 'failed') next.finished_at = new Date().toISOString();
      fs.writeFileSync(filePath, JSON.stringify(next, null, 2), 'utf8');
      return res.json({ ok: true, job: next });
    } catch (error) {
      return res.status(500).json({ ok: false, error: 'Não foi possível atualizar o job híbrido.' });
    }
  });

  app.get('/api/hybrid/jobs/:jobId', (req, res) => {
    const jobId = safeJobId(req.params.jobId);
    if (!jobId) return res.status(400).json({ ok: false, error: 'job_id inválido.' });
    const filePath = path.join(ensureJobDir(outDir), `${jobId}.json`);
    if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: 'Job híbrido não encontrado.' });
    try {
      return res.json({ ok: true, job: JSON.parse(fs.readFileSync(filePath, 'utf8')) });
    } catch (error) {
      return res.status(500).json({ ok: false, error: 'Não foi possível ler o job híbrido.' });
    }
  });
}

module.exports = { registerHybridRoutes, projectParts };

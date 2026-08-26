require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { generateFromSpec } = require('../furniture-builder');
const { registerN8nRoutes } = require('./n8n-routes');
const { registerMvpRoutes } = require('./mvp-routes');

const PORT = process.env.PORT || 8090;
const OUT_DIR = process.env.OUT_DIR || path.join(process.cwd(), 'saida_poc');
const FREECAD_JOBS = path.join(OUT_DIR, 'freecad_jobs');
const SKETCHUP_JOBS = path.join(OUT_DIR, 'sketchup_jobs');

function ensureDirs(){
  [OUT_DIR, FREECAD_JOBS, SKETCHUP_JOBS].forEach(d=>{
    if(!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

// --- server ---
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/saida_poc', express.static(path.join(__dirname, '..', 'saida_poc')));
registerMvpRoutes(app);
registerN8nRoutes(app);

app.get('/projeto_base.json', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'projeto_base.json'));
});

app.get('/health', (req,res)=>{
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.post('/api/generate/bom', (req,res)=>{
  try{
    const spec = req.body;
    if(!spec) return res.status(400).json({ error: 'Missing JSON spec in body' });
    ensureDirs();
    const out = generateFromSpec(spec, { outDir: OUT_DIR });
    return res.json({ ok: true, results: out });
  }catch(e){
    console.error('generate/bom error', e);
    return res.status(500).json({ error: e.message||String(e) });
  }
});

function enqueueJob(dir, jobObj){
  ensureDirs();
  const name = `job-${Date.now()}-${Math.random().toString(36).slice(2,8)}.json`;
  const fp = path.join(dir, name);
  fs.writeFileSync(fp, JSON.stringify(jobObj, null, 2), 'utf8');
  return fp;
}

app.post('/api/generate/freecad', (req,res)=>{
  try{
    const job = req.body || {};
    const fp = enqueueJob(FREECAD_JOBS, { type: 'freecad', created_at: new Date().toISOString(), job });
    return res.status(202).json({ ok:true, path: fp });
  }catch(e){
    console.error('generate/freecad error', e);
    return res.status(500).json({ error: e.message||String(e) });
  }
});

app.post('/api/generate/sketchup', (req,res)=>{
  try{
    const job = req.body || {};
    const fp = enqueueJob(SKETCHUP_JOBS, { type: 'sketchup', created_at: new Date().toISOString(), job });
    return res.status(202).json({ ok:true, path: fp });
  }catch(e){
    console.error('generate/sketchup error', e);
    return res.status(500).json({ error: e.message||String(e) });
  }
});

app.post('/webhook/gerar-moveis', (req,res)=>{
  try{
    const payload = req.body;
    if(!payload) return res.status(400).json({ error: 'Missing payload' });
    ensureDirs();
    let results = [];
    if(payload.spec){
      results = generateFromSpec(payload.spec, { outDir: OUT_DIR });
    }
    const freecadPath = enqueueJob(FREECAD_JOBS, { type: 'freecad', created_at: new Date().toISOString(), payload });
    const sketchupPath = enqueueJob(SKETCHUP_JOBS, { type: 'sketchup', created_at: new Date().toISOString(), payload });

    return res.status(202).json({ ok:true, bom_results: results, freecad_job: freecadPath, sketchup_job: sketchupPath });
  }catch(e){
    console.error('webhook/gerar-moveis error', e);
    return res.status(500).json({ error: e.message||String(e) });
  }
});

app.listen(PORT, ()=>{
  ensureDirs();
  console.log(`API server listening on port ${PORT} - OUT_DIR=${OUT_DIR}`);
});

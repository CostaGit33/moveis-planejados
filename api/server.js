require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8090;
const OUT_DIR = process.env.OUT_DIR || path.join(process.cwd(), 'saida_poc');
const FREECAD_JOBS = path.join(OUT_DIR, 'freecad_jobs');
const SKETCHUP_JOBS = path.join(OUT_DIR, 'sketchup_jobs');

function ensureDirs(){
  [OUT_DIR, FREECAD_JOBS, SKETCHUP_JOBS].forEach(d=>{
    if(!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

// --- simple furniture builder (self-contained) ---
function mm(v){ return Number(v); }
function generateParts(moduloSpec){
  const m = moduloSpec;
  const parts = [];
  const esp = mm(m.espessura || 18);
  parts.push({ nome: 'Painel Traseiro', largura: m.largura, altura: m.altura - esp, espessura: esp, quantidade: 1, material: m.material });
  parts.push({ nome: 'Lateral', largura: m.profundidade - esp, altura: m.altura, espessura: esp, quantidade: 2, material: m.material });
  parts.push({ nome: 'Tampo', largura: m.largura, profundidade: m.profundidade, espessura: esp, quantidade: 1, material: m.material });
  parts.push({ nome: 'Base', largura: m.largura, profundidade: m.profundidade, espessura: esp, quantidade: 1, material: m.material });
  const prateleiras = Number(m.prateleiras || 0);
  if(prateleiras>0) parts.push({ nome: 'Prateleira', largura: m.largura - (esp * 2), profundidade: m.profundidade - esp, espessura: esp, quantidade: prateleiras, material: m.material });
  const portas = Number(m.portas || 0);
  if(portas>0){
    const portaLarg = (m.largura / portas) - (esp * 0.5);
    parts.push({ nome: 'Porta', largura: portaLarg, altura: m.altura - esp*2, espessura: esp, quantidade: portas, material: m.material });
  }
  return parts;
}
function partsToCSV(parts){
  const header = 'nome,largura,altura,profundidade,espessura,quantidade,material\n';
  const lines = parts.map(p=>{
    const largura = p.largura||''; const altura = p.altura||''; const profundidade = p.profundidade||'';
    return `${p.nome},${largura},${altura},${profundidade},${p.espessura||''},${p.quantidade||1},${p.material||''}`;
  });
  return header + lines.join('\n');
}
function saveCutlistCSV(moduloSpec, outPath){
  const parts = generateParts(moduloSpec);
  const csv = partsToCSV(parts);
  fs.writeFileSync(outPath, csv, 'utf8');
  return { outPath, parts };
}
function generateFromSpec(spec, options={}){
  const modules = Array.isArray(spec) ? spec : [spec];
  const results = [];
  for(const mod of modules){
    const fileName = (mod.nome||'modulo').replace(/\s+/g,'_') + '_cutlist.csv';
    const outPath = path.join(options.outDir||OUT_DIR, fileName);
    const r = saveCutlistCSV(mod, outPath);
    results.push({ modulo: mod.nome||null, outPath: r.outPath, parts: r.parts });
  }
  return results;
}

// --- server ---
const app = express();
app.use(express.json({ limit: '2mb' }));

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

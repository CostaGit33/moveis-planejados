// furniture-builder.js
// Converte uma especificação JSON de módulo / móvel em lista de peças (BOM) e cutlist CSV
// Uso: require('./furniture-builder').generateFromSpec(spec)

const fs = require('fs');
const path = require('path');

function mm(v) { return Number(v); }

function generateParts(moduloSpec) {
  // moduloSpec exemplo: { nome: 'Modulo A', largura:600, altura:720, profundidade:560, portas:2, prateleiras:3, material: 'MDF', espessura:18 }
  const m = moduloSpec;
  const parts = [];
  const esp = mm(m.espessura || 18);

  // Painel traseiro
  parts.push({ nome: 'Painel Traseiro', largura: m.largura, altura: m.altura - esp, espessura: esp, quantidade: 1, material: m.material });

  // Laterais
  parts.push({ nome: 'Lateral', largura: m.profundidade - esp, altura: m.altura, espessura: esp, quantidade: 2, material: m.material });

  // Tampo e base
  parts.push({ nome: 'Tampo', largura: m.largura, profundidade: m.profundidade, espessura: esp, quantidade: 1, material: m.material });
  parts.push({ nome: 'Base', largura: m.largura, profundidade: m.profundidade, espessura: esp, quantidade: 1, material: m.material });

  // Prateleiras
  const prateleiras = Number(m.prateleiras || 0);
  if (prateleiras > 0) {
    parts.push({ nome: 'Prateleira', largura: m.largura - (esp * 2), profundidade: m.profundidade - esp, espessura: esp, quantidade: prateleiras, material: m.material });
  }

  // Portas
  const portas = Number(m.portas || 0);
  if (portas > 0) {
    const portaLarg = (m.largura / portas) - (esp * 0.5);
    parts.push({ nome: 'Porta', largura: portaLarg, altura: m.altura - esp*2, espessura: esp, quantidade: portas, material: m.material });
  }

  return parts;
}

function partsToCSV(parts) {
  const header = 'nome,largura,altura,profundidade,espessura,quantidade,material\n';
  const lines = parts.map(p => {
    const largura = p.largura || '';
    const altura = p.altura || '';
    const profundidade = p.profundidade || '';
    return `${p.nome},${largura},${altura},${profundidade},${p.espessura || ''},${p.quantidade || 1},${p.material || ''}`;
  });
  return header + lines.join('\n');
}

function saveCutlistCSV(moduloSpec, outPath) {
  const parts = generateParts(moduloSpec);
  const csv = partsToCSV(parts);
  fs.writeFileSync(outPath, csv, 'utf8');
  return { outPath, parts };
}

function generateFromSpec(spec, options = {}) {
  // spec pode ser single modulo ou array
  const modules = Array.isArray(spec) ? spec : [spec];
  const results = [];
  for (const mod of modules) {
    const fileName = (mod.nome || 'modulo').replace(/\s+/g, '_') + '_cutlist.csv';
    const outPath = path.join(options.outDir || process.cwd(), fileName);
    const r = saveCutlistCSV(mod, outPath);
    results.push({ modulo: mod.nome || null, outPath: r.outPath, parts: r.parts });
  }
  return results;
}

module.exports = { generateParts, partsToCSV, saveCutlistCSV, generateFromSpec };

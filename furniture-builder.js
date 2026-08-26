// furniture-builder.js
// Converte uma especificação JSON de módulo / móvel em peças (BOM) e cutlist CSV.
// Uso: require('./furniture-builder').generateFromSpec(spec)

const fs = require('fs');
const path = require('path');

function mm(value, field = 'medida') {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${field} deve ser um número maior que zero.`);
  }
  return parsed;
}

function count(value, field) {
  const parsed = Number(value || 0);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    throw new Error(`${field} deve ser um número inteiro entre 0 e 100.`);
  }
  return parsed;
}

function normalizeSpec(moduloSpec) {
  if (!moduloSpec || typeof moduloSpec !== 'object' || Array.isArray(moduloSpec)) {
    throw new Error('A especificação do módulo deve ser um objeto JSON.');
  }

  const normalized = {
    id: moduloSpec.id || null,
    tipo: String(moduloSpec.tipo || 'armario_inferior').trim(),
    nome: String(moduloSpec.nome || 'Módulo').trim(),
    largura: mm(moduloSpec.largura, 'largura'),
    altura: mm(moduloSpec.altura, 'altura'),
    profundidade: mm(moduloSpec.profundidade, 'profundidade'),
    espessura: mm(moduloSpec.espessura || moduloSpec.espessura_chapa || 18, 'espessura'),
    portas: count(moduloSpec.portas, 'portas'),
    gavetas: count(moduloSpec.gavetas, 'gavetas'),
    prateleiras: count(moduloSpec.prateleiras, 'prateleiras'),
    material: String(moduloSpec.material || 'MDF').trim(),
    folga_porta: Number(moduloSpec.folga_porta ?? 2),
    parametros: moduloSpec.parametros && typeof moduloSpec.parametros === 'object'
      ? moduloSpec.parametros
      : {}
  };

  if (!Number.isFinite(normalized.folga_porta) || normalized.folga_porta < 0) {
    throw new Error('folga_porta deve ser um número maior ou igual a zero.');
  }

  if (normalized.profundidade <= normalized.espessura * 2) {
    throw new Error('profundidade deve ser maior que duas vezes a espessura.');
  }
  if (normalized.largura <= normalized.espessura * 2) {
    throw new Error('largura deve ser maior que duas vezes a espessura.');
  }
  if (normalized.altura <= normalized.espessura * 2) {
    throw new Error('altura deve ser maior que duas vezes a espessura.');
  }

  return normalized;
}

function part(nome, fields) {
  return { nome, ...fields };
}

function generateParts(moduloSpec) {
  const m = normalizeSpec(moduloSpec);
  const esp = m.espessura;
  const innerWidth = m.largura - (esp * 2);
  const innerDepth = m.profundidade - esp;
  const innerHeight = m.altura - (esp * 2);
  const parts = [];

  parts.push(part('Painel Traseiro', {
    largura: m.largura,
    profundidade: esp,
    altura: m.altura - esp,
    espessura: esp,
    quantidade: 1,
    material: m.material
  }));

  parts.push(part('Lateral', {
    largura: m.profundidade - esp,
    profundidade: esp,
    altura: m.altura,
    espessura: esp,
    quantidade: 2,
    material: m.material
  }));

  parts.push(part('Tampo', {
    largura: m.largura,
    profundidade: m.profundidade,
    altura: esp,
    espessura: esp,
    quantidade: 1,
    material: m.material
  }));

  parts.push(part('Base', {
    largura: m.largura,
    profundidade: m.profundidade,
    altura: esp,
    espessura: esp,
    quantidade: 1,
    material: m.material
  }));

  if (m.prateleiras > 0) {
    parts.push(part('Prateleira', {
      largura: innerWidth,
      profundidade: innerDepth,
      altura: esp,
      espessura: esp,
      quantidade: m.prateleiras,
      material: m.material
    }));
  }

  if (m.portas > 0) {
    const totalGaps = m.folga_porta * (m.portas + 1);
    const portaLargura = (m.largura - totalGaps) / m.portas;
    if (portaLargura <= 0) {
      throw new Error('A quantidade de portas não cabe na largura do módulo.');
    }
    parts.push(part('Porta', {
      largura: Number(portaLargura.toFixed(2)),
      profundidade: esp,
      altura: Number((m.altura - (m.folga_porta * 2)).toFixed(2)),
      espessura: esp,
      quantidade: m.portas,
      material: m.material
    }));
  }

  if (m.gavetas > 0) {
    const totalGaps = m.folga_porta * (m.gavetas + 1);
    const frenteAltura = (m.altura - totalGaps) / m.gavetas;
    if (frenteAltura <= 0) {
      throw new Error('A quantidade de gavetas não cabe na altura do módulo.');
    }

    parts.push(part('Frente de Gaveta', {
      largura: Number((m.largura - (m.folga_porta * 2)).toFixed(2)),
      profundidade: esp,
      altura: Number(frenteAltura.toFixed(2)),
      espessura: esp,
      quantidade: m.gavetas,
      material: m.material
    }));

    parts.push(part('Lateral de Gaveta', {
      largura: Math.max(innerDepth - esp, esp),
      profundidade: esp,
      altura: Math.max(frenteAltura - esp, esp),
      espessura: esp,
      quantidade: m.gavetas * 2,
      material: m.material
    }));

    parts.push(part('Fundo de Gaveta', {
      largura: innerWidth,
      profundidade: Math.max(innerDepth - esp, esp),
      altura: esp,
      espessura: esp,
      quantidade: m.gavetas,
      material: m.material
    }));
  }

  return parts;
}

function csvCell(value) {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function partsToCSV(parts) {
  const header = 'nome,largura,altura,profundidade,espessura,quantidade,material\n';
  const lines = parts.map((p) => [
    p.nome,
    p.largura,
    p.altura,
    p.profundidade,
    p.espessura,
    p.quantidade || 1,
    p.material
  ].map(csvCell).join(','));
  return header + lines.join('\n') + '\n';
}

function saveCutlistCSV(moduloSpec, outPath) {
  const parts = generateParts(moduloSpec);
  const csv = partsToCSV(parts);
  fs.writeFileSync(outPath, csv, 'utf8');
  return { outPath, parts };
}

function generateFromSpec(spec, options = {}) {
  const modules = Array.isArray(spec) ? spec : [spec];
  const results = [];
  for (const mod of modules) {
    const safeName = String(mod.nome || 'modulo')
      .trim()
      .replace(/[^a-zA-Z0-9À-ÿ_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'modulo';
    const outPath = path.join(options.outDir || process.cwd(), `${safeName}_cutlist.csv`);
    const result = saveCutlistCSV(mod, outPath);
    results.push({ modulo: mod.nome || null, outPath: result.outPath, parts: result.parts });
  }
  return results;
}

module.exports = {
  mm,
  normalizeSpec,
  generateParts,
  partsToCSV,
  saveCutlistCSV,
  generateFromSpec
};

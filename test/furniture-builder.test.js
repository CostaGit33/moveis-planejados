const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { generateParts, generateFromSpec } = require('../furniture-builder');

const spec = {
  id: 'MOD-001',
  nome: 'Balcão para pia',
  tipo: 'balcao_pia',
  largura: 600,
  altura: 720,
  profundidade: 600,
  espessura: 18,
  portas: 0,
  gavetas: 4,
  prateleiras: 0,
  material: 'mdf_areia'
};

const parts = generateParts(spec);
const names = parts.map((item) => item.nome);

assert(names.includes('Painel Traseiro'));
assert(names.includes('Lateral'));
assert(names.includes('Tampo'));
assert(names.includes('Base'));
assert(names.includes('Frente de Gaveta'));
assert(names.includes('Lateral de Gaveta'));
assert(names.includes('Fundo de Gaveta'));

const drawerFront = parts.find((item) => item.nome === 'Frente de Gaveta');
const drawerSide = parts.find((item) => item.nome === 'Lateral de Gaveta');
assert.strictEqual(drawerFront.quantidade, 4);
assert.strictEqual(drawerSide.quantidade, 8);
assert(drawerFront.largura > 0);
assert(drawerFront.altura > 0);

const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moveis-builder-'));
const results = generateFromSpec([spec], { outDir: outputDir });
assert.strictEqual(results.length, 1);
assert.strictEqual(results[0].parts.length, parts.length);
assert(fs.existsSync(results[0].outPath));
const csv = fs.readFileSync(results[0].outPath, 'utf8');
assert(csv.startsWith('nome,largura,altura,profundidade,espessura,quantidade,material\n'));
assert(csv.includes('Frente de Gaveta'));

fs.rmSync(outputDir, { recursive: true, force: true });
console.log('furniture-builder tests: ok');

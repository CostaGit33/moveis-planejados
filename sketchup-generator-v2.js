const fs = require('fs');
const path = require('path');

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeName(value) {
  return String(value || 'modulo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'modulo';
}

function rubyString(value) {
  return JSON.stringify(String(value == null ? '' : value));
}

function generateSketchupRuby(spec) {
  const modules = Array.isArray(spec) ? spec : [spec];
  const out = [
    '# Móveis Planejados - gerado pela API',
    '# Entrada em milímetros; SketchUp converte com Numeric#mm.',
    'model = Sketchup.active_model',
    'model.start_operation("Móvel Planejado", true)',
    'entities = model.active_entities',
    'mm = ->(v) { v.to_f.mm }',
    'box = ->(entities, x, y, z, w, d, h) {',
    '  pts = [[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z]]',
    '  face = entities.add_face(pts)',
    '  face.pushpull(h) if face',
    '}',
  ];

  modules.forEach((m) => {
    const nome = String(m.nome || 'Módulo');
    const largura = number(m.largura);
    const altura = number(m.altura);
    const profundidade = number(m.profundidade);
    const esp = number(m.espessura, 18);
    const material = String(m.material || 'MDF');
    const prateleiras = Math.max(0, Math.floor(number(m.prateleiras)));
    const portas = Math.max(0, Math.floor(number(m.portas)));
    if (largura <= 0 || altura <= 0 || profundidade <= 0) return;

    out.push('group = entities.add_group');
    out.push(`group.name = ${rubyString(nome)}`);
    out.push('e = group.entities');
    out.push(`box.call(e, mm.call(0), mm.call(0), mm.call(0), mm.call(${esp}), mm.call(${profundidade}), mm.call(${altura}))`);
    out.push(`box.call(e, mm.call(${Math.max(0, largura - esp)}), mm.call(0), mm.call(0), mm.call(${esp}), mm.call(${profundidade}), mm.call(${altura}))`);
    out.push(`box.call(e, mm.call(${esp}), mm.call(0), mm.call(${Math.max(0, altura - esp)}), mm.call(${Math.max(0, largura - 2 * esp)}), mm.call(${profundidade}), mm.call(${esp}))`);
    out.push(`box.call(e, mm.call(${esp}), mm.call(0), mm.call(0), mm.call(${Math.max(0, largura - 2 * esp)}), mm.call(${profundidade}), mm.call(${esp}))`);

    if (prateleiras) {
      const livre = Math.max(0, altura - 2 * esp);
      const passo = livre / (prateleiras + 1);
      for (let i = 1; i <= prateleiras; i++) {
        const z = esp + passo * i - esp / 2;
        out.push(`box.call(e, mm.call(${esp}), mm.call(0), mm.call(${z}), mm.call(${Math.max(0, largura - 2 * esp)}), mm.call(${Math.max(0, profundidade - esp)}), mm.call(${esp}))`);
      }
    }

    if (portas) {
      const portaLarg = largura / portas - esp * 0.5;
      for (let i = 0; i < portas; i++) {
        const x = i * (largura / portas) + esp * 0.25;
        out.push(`box.call(e, mm.call(${x}), mm.call(${profundidade}), mm.call(${esp}), mm.call(${Math.max(0, portaLarg)}), mm.call(${esp}), mm.call(${Math.max(0, altura - 2 * esp)}))`);
      }
    }

    out.push(`group.set_attribute("moveis_planejados", "material", ${rubyString(material)})`);
    out.push(`group.set_attribute("moveis_planejados", "largura_mm", ${largura})`);
    out.push(`group.set_attribute("moveis_planejados", "altura_mm", ${altura})`);
    out.push(`group.set_attribute("moveis_planejados", "profundidade_mm", ${profundidade})`);
  });

  out.push('model.commit_operation');
  out.push('UI.messagebox("Móvel planejado gerado com sucesso.")');
  return out.join('\n') + '\n';
}

function saveSketchupRuby(spec, outDir) {
  const modules = Array.isArray(spec) ? spec : [spec];
  const filename = `${safeName(modules[0] && modules[0].nome)}_${Date.now()}.rb`;
  const filePath = path.join(outDir, filename);
  const content = generateSketchupRuby(spec);
  fs.writeFileSync(filePath, content, 'utf8');
  return { filePath, filename, content };
}

module.exports = { generateSketchupRuby, saveSketchupRuby, safeName };

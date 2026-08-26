const fs = require('fs');
const path = require('path');

function number(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function safeName(value) {
  return String(value || 'modulo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'modulo';
}

function rubyString(value) {
  return JSON.stringify(String(value == null ? '' : value));
}

function generateSketchupRuby(spec) {
  const modules = Array.isArray(spec) ? spec : [spec];
  const commands = [];

  commands.push('# Móveis Planejados - gerado pela API');
  commands.push('# Compatível com o console Ruby do SketchUp / arquivo .rb');
  commands.push('model = Sketchup.active_model');
  commands.push('model.start_operation("Móvel Planejado", true)');
  commands.push('entities = model.active_entities');

  for (const m of modules) {
    const nome = String(m.nome || 'Módulo');
    const largura = number(m.largura);
    const altura = number(m.altura);
    const profundidade = number(m.profundidade);
    const esp = number(m.espessura, 18);
    const material = String(m.material || 'MDF');
    const prateleiras = Math.max(0, Math.floor(number(m.prateleiras, 0)));
    const portas = Math.max(0, Math.floor(number(m.portas, 0)));

    commands.push(`group = entities.add_group`);
    commands.push(`group.name = ${rubyString(nome)}`);
    commands.push(`e = group.entities`);

    // SketchUp Ruby trabalha em polegadas; a entrada da API é milímetros.
    commands.push(`mm = ->(v) { v.to_f.mm }`);
    commands.push(`def box(entities, x, y, z, w, d, h)`);
    commands.push(`  pts = [[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z]]`);
    commands.push(`  face = entities.add_face(pts)`);
    commands.push(`  face.pushpull(h)`);
    commands.push(`end`);

    // Corpo: laterais, tampo e base.
    commands.push(`box.call(e, mm.call(0), mm.call(0), mm.call(0), mm.call(${esp}), mm.call(${profundidade}), mm.call(${altura}))`);
    commands.push(`box.call(e, mm.call(${largura - esp}), mm.call(0), mm.call(0), mm.call(${esp}), mm.call(${profundidade}), mm.call(${altura}))`);
    commands.push(`box.call(e, mm.call(${esp}), mm.call(0), mm.call(${altura - esp}), mm.call(${Math.max(0, largura - 2 * esp)}), mm.call(${profundidade}), mm.call(${esp}))`);
    commands.push(`box.call(e, mm.call(${esp}), mm.call(0), mm.call(0), mm.call(${Math.max(0, largura - 2 * esp)}), mm.call(${profundidade}), mm.call(${esp}))`);

    if (prateleiras > 0) {
      const livre = Math.max(0, altura - 2 * esp);
      const passo = livre / (prateleiras + 1);
      for (let i = 1; i <= prateleiras; i++) {
        const z = esp + passo * i - esp / 2;
        commands.push(`box.call(e, mm.call(${esp}), mm.call(0), mm.call(${z}), mm.call(${Math.max(0, largura - 2 * esp)}), mm.call(${Math.max(0, profundidade - esp)}), mm.call(${esp}))`);
      }
    }

    if (portas > 0) {
      const portaLarg = largura / portas - esp * 0.5;
      for (let i = 0; i < portas; i++) {
        const x = i * (largura / portas) + esp * 0.25;
        commands.push(`box.call(e, mm.call(${x}), mm.call(${profundidade}), mm.call(${esp}), mm.call(${Math.max(0, portaLarg)}), mm.call(${esp}), mm.call(${Math.max(0, altura - 2 * esp)}))`);
      }
    }

    commands.push(`group.set_attribute("moveis_planejados", "material", ${rubyString(material)})`);
    commands.push(`group.set_attribute("moveis_planejados", "largura_mm", ${largura})`);
    commands.push(`group.set_attribute("moveis_planejados", "altura_mm", ${altura})`);
    commands.push(`group.set_attribute("moveis_planejados", "profundidade_mm", ${profundidade})`);
  }

  commands.push('model.commit_operation');
  commands.push('UI.messagebox("Móvel planejado gerado com sucesso.")');
  return commands.join('\n') + '\n';
}

function saveSketchupRuby(spec, outDir) {
  const modules = Array.isArray(spec) ? spec : [spec];
  const baseName = safeName(modules[0] && modules[0].nome);
  const filename = `${baseName || 'modulo'}_${Date.now()}.rb`;
  const filePath = path.join(outDir, filename);
  const content = generateSketchupRuby(spec);
  fs.writeFileSync(filePath, content, 'utf8');
  return { filePath, filename, content };
}

module.exports = { generateSketchupRuby, saveSketchupRuby, safeName };

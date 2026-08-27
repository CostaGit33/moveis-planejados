const DEFAULT_MATERIALS = {
  alvenaria_branca: {
    nome: 'Alvenaria branca',
    cor_rgb: [0.92, 0.92, 0.88],
    pbr: { base_color: '#eae8df', roughness: 0.88, metallic: 0 }
  },
  mdf_areia: {
    nome: 'MDF Areia',
    cor_rgb: [0.72, 0.58, 0.42],
    pbr: { base_color: '#b8895d', roughness: 0.62, metallic: 0 }
  },
  mdf_cinza: {
    nome: 'MDF Cinza',
    cor_rgb: [0.42, 0.45, 0.48],
    pbr: { base_color: '#6b7280', roughness: 0.62, metallic: 0 }
  },
  mdf_carvalho: {
    nome: 'MDF Carvalho',
    cor_rgb: [0.63, 0.43, 0.24],
    pbr: { base_color: '#a16d3a', roughness: 0.56, metallic: 0 }
  },
  ferragem_preta: {
    nome: 'Ferragem preta',
    cor_rgb: [0.05, 0.05, 0.05],
    pbr: { base_color: '#1f2321', roughness: 0.32, metallic: 0.72 }
  }
};

function finiteOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveOr(value, fallback) {
  const parsed = finiteOr(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

function nonNegativeOr(value, fallback = 0) {
  const parsed = finiteOr(value, fallback);
  return parsed >= 0 ? parsed : fallback;
}

function normalizeMaterial(id, material = {}) {
  const fallback = DEFAULT_MATERIALS[id] || {};
  const pbr = material.pbr && typeof material.pbr === 'object' ? material.pbr : {};
  return {
    ...fallback,
    ...material,
    nome: material.nome || fallback.nome || id,
    pbr: {
      ...(fallback.pbr || {}),
      ...pbr,
      base_color: pbr.base_color || material.cor_hex || fallback.pbr?.base_color || '#a9b3aa',
      roughness: nonNegativeOr(pbr.roughness, fallback.pbr?.roughness ?? 0.65),
      metallic: nonNegativeOr(pbr.metallic, fallback.pbr?.metallic ?? 0)
    }
  };
}

function normalizeModule(module = {}, index = 0) {
  const width = positiveOr(module.largura, 600);
  const depth = positiveOr(module.profundidade, 600);
  const height = positiveOr(module.altura, 720);
  const material = module.material || 'mdf_areia';
  return {
    ...module,
    id: module.id || `MOD-${String(index + 1).padStart(3, '0')}`,
    tipo: module.tipo || 'armario_inferior',
    nome: module.nome || `Módulo ${index + 1}`,
    x: nonNegativeOr(module.x, 0),
    y: nonNegativeOr(module.y, 0),
    z: nonNegativeOr(module.z, 0),
    largura: width,
    profundidade: depth,
    altura: height,
    espessura_chapa: positiveOr(module.espessura_chapa || module.espessura, 18),
    material,
    portas: Math.max(0, Math.round(nonNegativeOr(module.portas, 0))),
    gavetas: Math.max(0, Math.round(nonNegativeOr(module.gavetas, 0))),
    prateleiras: Math.max(0, Math.round(nonNegativeOr(module.prateleiras, 0))),
    parametros: module.parametros && typeof module.parametros === 'object' ? module.parametros : {}
  };
}

function enrichProject(input = {}) {
  const project = input && typeof input === 'object' ? { ...input } : {};
  const ambiente = project.ambiente && typeof project.ambiente === 'object' ? project.ambiente : {};
  const paredes = Array.isArray(project.paredes) ? project.paredes : [];
  const modulos = Array.isArray(project.modulos) ? project.modulos : [];
  const materialInput = project.materiais && typeof project.materiais === 'object' ? project.materiais : {};
  const materialIds = new Set([...Object.keys(DEFAULT_MATERIALS), ...Object.keys(materialInput)]);
  const materiais = {};
  for (const id of materialIds) materiais[id] = normalizeMaterial(id, materialInput[id] || {});

  return {
    ...project,
    schema_version: project.schema_version || '1.1',
    unidade: project.unidade || 'mm',
    pedido: String(project.pedido || ''),
    ambiente: {
      ...ambiente,
      nome: ambiente.nome || 'Ambiente planejado',
      largura: positiveOr(ambiente.largura, 3200),
      profundidade: positiveOr(ambiente.profundidade, 800),
      pe_direito: positiveOr(ambiente.pe_direito, ambiente.altura || 2700)
    },
    paredes,
    modulos: modulos.map(normalizeModule),
    materiais,
    fabricacao: {
      unidade: 'mm',
      kerf: 3,
      margem: 10,
      rotacao_permitida: true,
      veio: 'preservar',
      ...(project.fabricacao && typeof project.fabricacao === 'object' ? project.fabricacao : {})
    },
    render: {
      engine: 'three',
      pipeline: 'glb-compatível',
      materiais: 'pbr',
      ...(project.render && typeof project.render === 'object' ? project.render : {})
    }
  };
}

function assemblyNodes(module) {
  const width = module.largura;
  const depth = module.profundidade;
  const height = module.altura;
  const thickness = module.espessura_chapa;
  const gap = 2;
  const nodes = [];
  const innerWidth = Math.max(width - thickness * 2, thickness);
  const innerDepth = Math.max(depth - thickness, thickness);
  const add = (role, position, size, extra = {}) => {
    nodes.push({
      id: `${module.id}-${role}-${nodes.length + 1}`,
      kind: 'component',
      role,
      module_id: module.id,
      position_mm: {
        x: module.x + position.x,
        y: module.y + position.y,
        z: module.z + position.z
      },
      size_mm: {
        x: Math.max(size.x, 1),
        y: Math.max(size.y, 1),
        z: Math.max(size.z, 1)
      },
      material: extra.material || module.material,
      ...(extra.quantity ? { quantity: extra.quantity } : {})
    });
  };

  add('side-left', { x: thickness / 2, y: depth / 2, z: height / 2 }, { x: thickness, y: depth, z: height });
  add('side-right', { x: width - thickness / 2, y: depth / 2, z: height / 2 }, { x: thickness, y: depth, z: height });
  add('top', { x: width / 2, y: depth / 2, z: height - thickness / 2 }, { x: width, y: depth, z: thickness });
  add('base', { x: width / 2, y: depth / 2, z: thickness / 2 }, { x: width, y: depth, z: thickness });
  add('back', { x: width / 2, y: depth - thickness / 2, z: height / 2 }, { x: width, y: thickness, z: Math.max(height - thickness, thickness) });

  const shelves = module.prateleiras;
  const innerHeight = Math.max(height - thickness * 2, thickness);
  for (let index = 0; index < shelves; index += 1) {
    add('shelf', { x: width / 2, y: thickness + innerDepth / 2, z: thickness + ((index + 1) * innerHeight) / (shelves + 1) }, { x: innerWidth, y: innerDepth, z: thickness });
  }

  const doors = module.portas;
  const drawers = module.gavetas;
  const drawerZoneHeight = drawers > 0 && doors > 0 ? height * 0.38 : drawers > 0 ? height : 0;
  const doorZoneStart = drawers > 0 && doors > 0 ? drawerZoneHeight : 0;
  const doorZoneHeight = Math.max(height - doorZoneStart, thickness);

  if (doors > 0) {
    const doorWidth = Math.max((width - gap * (doors + 1)) / doors, thickness);
    const doorHeight = Math.max(doorZoneHeight - gap * 2, thickness);
    const doorZ = doorZoneStart + gap + doorHeight / 2;
    for (let index = 0; index < doors; index += 1) {
      add('door', { x: gap + doorWidth / 2 + index * (doorWidth + gap), y: -thickness / 2 - gap / 2, z: doorZ }, { x: doorWidth, y: thickness, z: doorHeight });
    }
  }

  if (drawers > 0) {
    const drawerHeight = drawerZoneHeight || height;
    const frontHeight = Math.max((drawerHeight - gap * (drawers + 1)) / drawers, thickness);
    const frontWidth = Math.max(width - gap * 2, thickness);
    const railDepth = Math.max(innerDepth * 0.86, thickness);
    for (let index = 0; index < drawers; index += 1) {
      const frontZ = gap + frontHeight / 2 + index * (frontHeight + gap);
      add('drawer-front', { x: width / 2, y: -thickness / 2 - gap / 2, z: frontZ }, { x: frontWidth, y: thickness, z: frontHeight });
      add('drawer-side-left', { x: thickness * 1.5, y: thickness + railDepth / 2, z: frontZ }, { x: thickness, y: railDepth, z: Math.max(frontHeight - thickness, thickness) });
      add('drawer-side-right', { x: width - thickness * 1.5, y: thickness + railDepth / 2, z: frontZ }, { x: thickness, y: railDepth, z: Math.max(frontHeight - thickness, thickness) });
      add('drawer-bottom', { x: width / 2, y: thickness + railDepth / 2, z: Math.max(frontZ - frontHeight / 2 + thickness / 2, thickness / 2) }, { x: Math.max(frontWidth - thickness * 2, thickness), y: Math.max(railDepth - thickness, thickness), z: thickness });
    }
  }

  if (/inferior|balcao_pia|gaveteiro/i.test(String(module.tipo || ''))) {
    const footSize = Math.min(width * 0.12, 80);
    const footHeight = 60;
    const insetX = Math.min(width * 0.16, 80);
    const insetY = Math.min(depth * 0.18, 100);
    for (const position of [
      { x: insetX, y: insetY },
      { x: width - insetX, y: insetY },
      { x: insetX, y: depth - insetY },
      { x: width - insetX, y: depth - insetY }
    ]) {
      add('foot', { x: position.x, y: position.y, z: -footHeight / 2 }, { x: footSize, y: footSize, z: footHeight }, { material: 'ferragem_preta' });
    }
  }

  return nodes;
}

function projectToScene(projectInput, parts = []) {
  const project = enrichProject(projectInput);
  const nodes = [];

  for (const wall of project.paredes) {
    nodes.push({
      id: wall.id,
      kind: 'wall',
      position_mm: { x: finiteOr(wall.x, 0), y: finiteOr(wall.y, 0), z: finiteOr(wall.z, 0) },
      size_mm: {
        x: positiveOr(wall.largura || wall.comprimento, project.ambiente.largura),
        y: positiveOr(wall.espessura, 120),
        z: positiveOr(wall.altura, project.ambiente.pe_direito)
      },
      material: wall.material || 'alvenaria_branca'
    });
  }

  for (const module of project.modulos) {
    nodes.push({
      id: module.id,
      kind: 'module',
      position_mm: { x: module.x, y: module.y, z: module.z },
      size_mm: { x: module.largura, y: module.profundidade, z: module.altura },
      material: module.material,
      composition: {
        portas: module.portas,
        gavetas: module.gavetas,
        prateleiras: module.prateleiras
      }
    });
    nodes.push(...assemblyNodes(module));
  }

  for (const part of Array.isArray(parts) ? parts : []) {
    nodes.push({
      id: part.id || null,
      kind: 'part',
      position_mm: { x: finiteOr(part.x, 0), y: finiteOr(part.y, 0), z: finiteOr(part.z, 0) },
      size_mm: {
        x: positiveOr(part.largura, 1),
        y: positiveOr(part.profundidade, part.espessura || 1),
        z: positiveOr(part.altura, part.espessura || 1)
      },
      quantity: Math.max(1, Math.round(nonNegativeOr(part.quantidade, 1))),
      material: part.material || 'mdf_areia',
      module_id: part.modulo_id || null
    });
  }

  return {
    schema_version: project.schema_version,
    unidade: project.unidade,
    coordinate_system: 'x=largura,y=profundidade,z=altura',
    ambiente: project.ambiente,
    materials: project.materiais,
    nodes
  };
}

module.exports = {
  DEFAULT_MATERIALS,
  enrichProject,
  normalizeModule,
  assemblyNodes,
  projectToScene
};

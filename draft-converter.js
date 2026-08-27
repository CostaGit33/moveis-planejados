const COMPONENT_KINDS = new Set([
  'side',
  'top',
  'base',
  'back',
  'shelf',
  'vertical_divider',
  'door',
  'drawer',
  'drawer_front',
  'hanger',
  'foot',
  'wall',
  'window',
  'door_opening',
  'mirror',
  'unknown'
]);

const FAMILY_BY_EVIDENCE = [
  { kinds: ['hanger'], type: 'torre_closet', name: 'Torre de closet' },
  { kinds: ['drawer', 'drawer_front'], type: 'gaveteiro', name: 'Gaveteiro' },
  { kinds: ['door'], type: 'armario_com_portas', name: 'Armário com portas' },
  { kinds: ['shelf', 'vertical_divider'], type: 'armario_aberto', name: 'Armário aberto' }
];

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function integerOr(value, fallback = 0) {
  const parsed = asNumberOrNull(value);
  return parsed !== null && Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function clampConfidence(value) {
  const parsed = asNumberOrNull(value);
  if (parsed === null) return 0;
  return Math.max(0, Math.min(1, parsed));
}

function normalizeSource(source = {}) {
  const input = asObject(source);
  return {
    type: String(input.type || 'sketch').trim(),
    filename: input.filename ? String(input.filename) : null,
    view: String(input.view || 'unknown').trim(),
    width_px: asNumberOrNull(input.width_px),
    height_px: asNumberOrNull(input.height_px)
  };
}

function normalizeCalibration(calibration = {}) {
  const input = asObject(calibration);
  const referenceValue = asNumberOrNull(input.reference_value_mm);
  const scale = asNumberOrNull(input.scale_px_per_mm);
  return {
    status: input.status === 'calibrated' && referenceValue !== null ? 'calibrated' : 'needs_confirmation',
    reference_dimension: input.reference_dimension ? String(input.reference_dimension) : null,
    reference_value_mm: referenceValue,
    scale_px_per_mm: scale !== null && scale > 0 ? scale : null
  };
}

function normalizeBox(box = {}) {
  const input = asObject(box);
  return {
    x: asNumberOrNull(input.x),
    y: asNumberOrNull(input.y),
    width: asNumberOrNull(input.width),
    height: asNumberOrNull(input.height)
  };
}

function normalizeEvidence(evidence = []) {
  if (!Array.isArray(evidence)) return [];
  return evidence.map((item, index) => {
    const input = asObject(item);
    const kind = typeof input.kind === 'string' && input.kind.trim() ? input.kind.trim() : 'unknown';
    const status = ['observed', 'proposed', 'needs_confirmation', 'rejected'].includes(input.status)
      ? input.status
      : 'proposed';
    return {
      id: input.id || `EVID-${String(index + 1).padStart(3, '0')}`,
      kind,
      box_px: normalizeBox(input.box_px),
      confidence: clampConfidence(input.confidence),
      status,
      notes: input.notes ? String(input.notes) : '',
      label: input.label ? String(input.label) : null,
      description: input.description ? String(input.description) : null,
      module_id: input.module_id ? String(input.module_id) : null,
      posicao: asObject(input.posicao),
      dimensoes: asObject(input.dimensoes)
    };
  });
}

function inferFamily(evidence) {
  const kinds = new Set(evidence.map((item) => item.kind));
  for (const family of FAMILY_BY_EVIDENCE) {
    if (family.kinds.some((kind) => kinds.has(kind))) return family;
  }
  return { type: 'unknown', name: 'Não identificado' };
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function hasMeaningfulModuleInput(input, { allowWeak = false } = {}) {
  const source = asObject(input);
  if (!Object.keys(source).length) return false;
  if (allowWeak) return true;
  const positiveFields = ['largura', 'profundidade', 'altura', 'espessura_chapa', 'portas', 'gavetas', 'prateleiras'];
  if (positiveFields.some((field) => {
    const value = asNumberOrNull(source[field]);
    return value !== null && value > 0;
  })) return true;
  if (Array.isArray(source.componentes) && source.componentes.length) return true;
  if (Array.isArray(source.evidencia_ids) && source.evidencia_ids.length) return true;
  if (Object.keys(asObject(source.parametros)).length) return true;
  return false;
}

function deriveIdentification(root, family, description, evidence, ocrText) {
  const provided = asObject(root.identification);
  if (provided.type || provided.label) {
    return {
      type: String(provided.type || family.type || 'unknown'),
      label: String(provided.label || family.name || 'Não identificado'),
      confidence: clampConfidence(provided.confidence),
      alternatives: Array.isArray(provided.alternatives) ? provided.alternatives : []
    };
  }
  const sourceText = `${description || ''} ${ocrText.join(' ')} ${evidence.map((item) => `${item.kind} ${item.label || ''} ${item.description || ''}`).join(' ')}`.toLowerCase();
  const candidates = [
    { test: /closet|walk[- ]?in|vesti[aá]rio/, type: 'closet', label: 'Closet', confidence: 0.62 },
    { test: /\b(u|em u)\b/, type: 'composicao_u', label: 'Composição em U', confidence: 0.62 },
    { test: /estante|prateleira|nicho|divis[oó]ria/, type: 'armario_aberto', label: 'Móvel aberto com nichos', confidence: 0.58 },
    { test: /gaveta|gaveteiro/, type: 'gaveteiro', label: 'Gaveteiro', confidence: 0.58 },
    { test: /porta|portas/, type: 'armario_com_portas', label: 'Armário com portas', confidence: 0.55 },
    { test: /painel/, type: 'painel', label: 'Painel', confidence: 0.5 }
  ];
  const candidate = candidates.find((item) => item.test.test(sourceText));
  return candidate
    ? { type: candidate.type, label: candidate.label, confidence: candidate.confidence, alternatives: [] }
    : { type: family.type || 'unknown', label: family.name || 'Não identificado', confidence: 0, alternatives: [] };
}

function countEvidence(evidence, ...kinds) {
  return evidence.filter((item) => kinds.includes(item.kind) && item.status !== 'rejected').length;
}

function componentFromEvidence(item, index, moduleId) {
  const roleMap = {
    side: 'lateral',
    top: 'tampo',
    base: 'base',
    back: 'fundo',
    shelf: 'prateleira',
    vertical_divider: 'divisoria_vertical',
    door: 'porta',
    drawer: 'gaveta',
    drawer_front: 'frente_gaveta',
    hanger: 'cabideiro',
    foot: 'pe',
    mirror: 'espelho',
    window: 'janela',
    door_opening: 'abertura_porta',
    wall: 'parede',
    unknown: 'componente_nao_classificado'
  };
  return {
    id: `${moduleId}-COMP-${String(index + 1).padStart(3, '0')}`,
    tipo: roleMap[item.kind] || String(item.kind || 'componente_nao_classificado'),
    origem_evidencia: item.id,
    status: item.status === 'observed' ? 'proposta' : 'needs_confirmation',
    confianca: item.confidence,
    module_id: item.module_id || moduleId,
    posicao: {
      x: asNumberOrNull(item.posicao?.x),
      y: asNumberOrNull(item.posicao?.y),
      z: asNumberOrNull(item.posicao?.z)
    },
    dimensoes: {
      largura: asNumberOrNull(item.dimensoes?.largura),
      profundidade: asNumberOrNull(item.dimensoes?.profundidade),
      altura: asNumberOrNull(item.dimensoes?.altura)
    }
  };
}

function missingQuestions(module, calibration, evidence = [], suffix = '') {
  const questions = [];
  if (module.largura === null) questions.push(`Qual é a largura total do móvel${suffix} em milímetros?`);
  if (module.profundidade === null) questions.push(`Qual é a profundidade total do móvel${suffix} em milímetros?`);
  if (module.altura === null) questions.push(`Qual é a altura total do móvel${suffix} em milímetros?`);
  if (module.espessura_chapa === null) questions.push(`Qual é a espessura da chapa${suffix}?`);
  if (calibration.status !== 'calibrated') questions.push('Informe uma medida conhecida para calibrar a escala do rascunho.');
  if (evidence.some((item) => item.kind === 'unknown' && item.status !== 'rejected')) {
    questions.push(`Classifique os componentes${suffix} marcados como não identificados.`);
  }
  return questions;
}

function normalizeFamily(input, fallback) {
  const source = asObject(input);
  const type = source.tipo || source.type;
  const name = source.nome || source.name;
  return type ? { tipo: String(type), nome: String(name || type) } : fallback;
}

function moduleEvidence(input, evidence) {
  const source = asObject(input);
  const ids = source.evidencia_ids || source.evidence_ids;
  if (Array.isArray(ids) && ids.length) {
    const selected = new Set(ids.map(String));
    return evidence.filter((item) => selected.has(String(item.id)));
  }
  const assigned = source.id
    ? evidence.filter((item) => String(item.module_id || '') === String(source.id))
    : [];
  return assigned.length ? assigned : evidence;
}

function normalizeModuleInput(input, evidence, index = 0) {
  const source = asObject(input);
  const family = inferFamily(evidence);
  const doors = integerOr(source.portas, countEvidence(evidence, 'door'));
  const drawers = integerOr(source.gavetas, countEvidence(evidence, 'drawer', 'drawer_front'));
  const shelves = integerOr(source.prateleiras, countEvidence(evidence, 'shelf'));
  const moduleId = source.id || `MOD-${String(index + 1).padStart(3, '0')}`;
  const explicitComponents = Array.isArray(source.componentes) ? source.componentes : null;
  const components = explicitComponents || evidence
    .filter((item) => !['wall', 'window', 'door_opening'].includes(item.kind))
    .map((item, index) => componentFromEvidence(item, index, moduleId));

  return {
    id: moduleId,
    tipo: source.tipo || family.type,
    nome: source.nome || family.name,
    x: asNumberOrNull(source.x),
    y: asNumberOrNull(source.y),
    z: asNumberOrNull(source.z),
    rotacao_z: asNumberOrNull(source.rotacao_z ?? source.rotation_z),
    largura: asNumberOrNull(source.largura),
    profundidade: asNumberOrNull(source.profundidade),
    altura: asNumberOrNull(source.altura),
    espessura_chapa: asNumberOrNull(source.espessura_chapa ?? source.espessura),
    material: source.material || 'mdf_areia',
    portas: doors,
    gavetas: drawers,
    prateleiras: shelves,
    componentes: components,
    parametros: asObject(source.parametros)
  };
}

function analyzeDraft(input = {}) {
  const root = asObject(input.draft || input);
  const source = normalizeSource(root.source);
  const calibration = normalizeCalibration(root.calibration);
  const evidence = normalizeEvidence(root.evidence);
  const proposalInput = asObject(root.proposal);
  const compositionInput = asObject(root.composition || proposalInput.composition);
  const description = root.description ? String(root.description).trim() : '';
  const ocrText = Array.isArray(root.ocr_text) ? root.ocr_text.map(String).filter(Boolean) : [];
  const layout = String(root.layout || compositionInput.layout || proposalInput.layout || '').toLowerCase();
  const furnitureEvidence = evidence.filter((item) => !['wall', 'window', 'door_opening'].includes(item.kind));
  const moduleInputs = Array.isArray(root.modules) && root.modules.length
    ? root.modules
    : Array.isArray(root.modulos) && root.modulos.length
      ? root.modulos
      : Array.isArray(proposalInput.modules) && proposalInput.modules.length
        ? proposalInput.modules
        : null;
  const explicitRootModule = hasMeaningfulModuleInput(root.module, { allowWeak: true }) ? root.module : null;
  const proposalModule = hasMeaningfulModuleInput(proposalInput.module) ? proposalInput.module : null;
  const modules = moduleInputs
    ? moduleInputs.map((item, index) => normalizeModuleInput(item, moduleEvidence(item, evidence), index))
    : explicitRootModule
      ? [normalizeModuleInput(explicitRootModule, moduleEvidence(explicitRootModule, evidence), 0)]
      : proposalModule
        ? [normalizeModuleInput(proposalModule, moduleEvidence(proposalModule, evidence), 0)]
        : furnitureEvidence.length
          ? [normalizeModuleInput(null, furnitureEvidence, 0)]
          : [];
  const module = modules[0] || null;
  const requiresPlacement = modules.length > 1 || layout === 'u' || layout === 'composicao_u';
  for (const item of modules) {
    if (item.x === null && !requiresPlacement) item.x = 0;
    if (item.y === null && !requiresPlacement) item.y = 0;
    if (item.z === null) item.z = 0;
    if (item.rotacao_z === null && !requiresPlacement) item.rotacao_z = 0;
  }
  const inferredFamily = layout === 'u' || layout === 'composicao_u'
    ? { type: 'composicao_u', name: 'Closet em U' }
    : inferFamily(evidence);
  let family = normalizeFamily(proposalInput.family, inferredFamily);
  const identification = deriveIdentification(root, family, description, evidence, ocrText);
  if (family.tipo === 'unknown' && identification.type !== 'unknown') {
    family = { tipo: identification.type, nome: identification.label };
  }
  const assumptions = Array.isArray(root.assumptions) ? root.assumptions.map(String) : [];
  const visualMeasurements = asObject(root.visual_measurements);
  const openQuestions = [
    ...(Array.isArray(root.open_questions) ? root.open_questions.map(String) : []),
    ...(modules.length ? modules.flatMap((item, index) => missingQuestions(
      item,
      calibration,
      moduleEvidence(item, evidence),
      modules.length > 1 ? ` do módulo ${index + 1}` : ''
    )) : ['Confirme quais estruturas visíveis devem ser tratadas como módulos independentes antes da conversão.']),
    ...(requiresPlacement && modules.some((item) => item.x === null || item.y === null || item.rotacao_z === null)
      ? ['Confirme x, y e rotação de cada módulo da composição antes de converter.']
      : [])
  ].filter((question, index, list) => list.indexOf(question) === index);
  const criticalFields = ['largura', 'profundidade', 'altura', 'espessura_chapa'];
  const criticalMissing = modules.length
    ? modules.flatMap((item, index) => criticalFields
      .filter((field) => item[field] === null)
      .map((field) => modules.length > 1 ? `modulos[${index}].${field}` : field))
    : ['modulos'];
  if (requiresPlacement) {
    for (const [index, item] of modules.entries()) {
      for (const field of ['x', 'y', 'rotacao_z']) {
        if (item[field] === null) criticalMissing.push(`modulos[${index}].${field}`);
      }
    }
  }
  const invalidCritical = modules.flatMap((item, index) => criticalFields
    .filter((field) => item[field] !== null && item[field] <= 0)
    .map((field) => modules.length > 1 ? `modulos[${index}].${field}` : field));
  const hasRejected = evidence.some((item) => item.status === 'rejected');
  const level = modules.length > 0 && calibration.status === 'calibrated' && criticalMissing.length === 0 && invalidCritical.length === 0 && !hasRejected
    ? 'calibrated'
    : 'draft';

  return {
    draft: {
      id: root.id || 'DRAFT-001',
      source,
      calibration,
      description,
      identification,
      observations: Array.isArray(root.observations) ? root.observations.map(String) : [],
      ocr_text: ocrText,
      visual_measurements: {
        width_mm: asNumberOrNull(visualMeasurements.width_mm),
        depth_mm: asNumberOrNull(visualMeasurements.depth_mm),
        height_mm: asNumberOrNull(visualMeasurements.height_mm),
        board_thickness_mm: asNumberOrNull(visualMeasurements.board_thickness_mm),
        reference_dimension: visualMeasurements.reference_dimension ? String(visualMeasurements.reference_dimension) : null,
        reference_value_mm: asNumberOrNull(visualMeasurements.reference_value_mm)
      },
      evidence,
      assumptions,
      open_questions: openQuestions,
      composition: {
        ...compositionInput,
        layout: compositionInput.layout || (layout || null),
        module_ids: modules.map((item) => item.id)
      },
      proposal: {
        family: { tipo: family.tipo || family.type, nome: family.nome || family.name },
        module,
        modules
      }
    },
    validation: {
      level,
      critical_missing: criticalMissing,
      warnings: [
        ...(calibration.status !== 'calibrated' ? ['Escala não calibrada; dimensões visuais não podem ser tratadas como medidas reais.'] : []),
        ...(modules.length === 0 ? ['A análise visual não retornou módulo confirmado; nenhuma geometria de fabricação foi criada.'] : []),
        ...(evidence.length === 0 ? ['Nenhuma evidência visual estruturada foi retornada pelo interpretador; revise a descrição e confirme os elementos manualmente.'] : []),
        ...(hasRejected ? ['Existem evidências rejeitadas que não foram convertidas em componentes.'] : [])
      ],
      errors: invalidCritical.map((field) => `${field} deve ser maior que zero.`)
    }
  };
}

function convertDraftToProject(input = {}) {
  const analyzed = analyzeDraft(input);
  const modules = analyzed.draft.proposal.modules?.length
    ? analyzed.draft.proposal.modules
    : [analyzed.draft.proposal.module];
  if (analyzed.validation.critical_missing.length || analyzed.validation.errors.length) {
    const error = new Error('O rascunho precisa de confirmação das dimensões críticas antes da conversão.');
    error.code = 'DRAFT_INCOMPLETE';
    error.validation = analyzed.validation;
    throw error;
  }

  const source = analyzed.draft.source;
  const project = {
    schema_version: '1.1',
    unidade: 'mm',
    pedido: input.pedido || `Conversão do rascunho ${source.filename || analyzed.draft.id}`,
    ambiente: asObject(input.ambiente),
    paredes: Array.isArray(input.paredes) ? input.paredes : [],
    aberturas: Array.isArray(input.aberturas) ? input.aberturas : [],
    modulos: modules.map((module) => ({
      ...module,
      componentes: module.componentes.map((component) => ({
        ...component,
        status: component.status || 'needs_confirmation'
      }))
    })),
    composicao: analyzed.draft.composition,
    draft_id: analyzed.draft.id
  };

  return {
    ...analyzed,
    project,
    validation: {
      ...analyzed.validation,
      level: analyzed.validation.level === 'calibrated' ? 'calibrated' : 'draft'
    }
  };
}

module.exports = {
  analyzeDraft,
  convertDraftToProject,
  normalizeEvidence,
  normalizeCalibration,
  normalizeSource
};

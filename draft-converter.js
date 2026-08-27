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
    const kind = COMPONENT_KINDS.has(input.kind) ? input.kind : 'unknown';
    const status = ['observed', 'proposed', 'needs_confirmation', 'rejected'].includes(input.status)
      ? input.status
      : 'proposed';
    return {
      id: input.id || `EVID-${String(index + 1).padStart(3, '0')}`,
      kind,
      box_px: normalizeBox(input.box_px),
      confidence: clampConfidence(input.confidence),
      status,
      notes: input.notes ? String(input.notes) : ''
    };
  });
}

function inferFamily(evidence) {
  const kinds = new Set(evidence.map((item) => item.kind));
  for (const family of FAMILY_BY_EVIDENCE) {
    if (family.kinds.some((kind) => kinds.has(kind))) return family;
  }
  return { type: 'armario_aberto', name: 'Armário aberto' };
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
    tipo: roleMap[item.kind] || 'componente_nao_classificado',
    origem_evidencia: item.id,
    status: item.status === 'observed' ? 'proposta' : 'needs_confirmation',
    confianca: item.confidence,
    posicao: { x: null, y: null, z: null },
    dimensoes: { largura: null, profundidade: null, altura: null }
  };
}

function missingQuestions(module, calibration, evidence) {
  const questions = [];
  if (module.largura === null) questions.push('Qual é a largura total do móvel em milímetros?');
  if (module.profundidade === null) questions.push('Qual é a profundidade total do móvel em milímetros?');
  if (module.altura === null) questions.push('Qual é a altura total do móvel em milímetros?');
  if (module.espessura_chapa === null) questions.push('Qual é a espessura da chapa?');
  if (calibration.status !== 'calibrated') questions.push('Informe uma medida conhecida para calibrar a escala do rascunho.');
  if (evidence.some((item) => item.kind === 'unknown' && item.status !== 'rejected')) {
    questions.push('Classifique os componentes marcados como não identificados.');
  }
  return questions;
}

function normalizeModuleInput(input, evidence) {
  const source = asObject(input);
  const family = inferFamily(evidence);
  const doors = integerOr(source.portas, countEvidence(evidence, 'door'));
  const drawers = integerOr(source.gavetas, countEvidence(evidence, 'drawer', 'drawer_front'));
  const shelves = integerOr(source.prateleiras, countEvidence(evidence, 'shelf'));
  const moduleId = source.id || 'MOD-001';
  const explicitComponents = Array.isArray(source.componentes) ? source.componentes : null;
  const components = explicitComponents || evidence
    .filter((item) => !['wall', 'window', 'door_opening'].includes(item.kind))
    .map((item, index) => componentFromEvidence(item, index, moduleId));

  return {
    id: moduleId,
    tipo: source.tipo || family.type,
    nome: source.nome || family.name,
    x: asNumberOrNull(source.x) ?? 0,
    y: asNumberOrNull(source.y) ?? 0,
    z: asNumberOrNull(source.z) ?? 0,
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
  const family = inferFamily(evidence);
  const module = normalizeModuleInput(root.module || root.proposal?.module, evidence);
  const assumptions = Array.isArray(root.assumptions) ? root.assumptions.map(String) : [];
  const visualMeasurements = asObject(root.visual_measurements);
  const ocrText = Array.isArray(root.ocr_text) ? root.ocr_text.map(String).filter(Boolean) : [];
  const description = root.description ? String(root.description).trim() : '';
  const openQuestions = [
    ...(Array.isArray(root.open_questions) ? root.open_questions.map(String) : []),
    ...missingQuestions(module, calibration, evidence)
  ].filter((question, index, list) => list.indexOf(question) === index);
  const criticalFields = ['largura', 'profundidade', 'altura', 'espessura_chapa'];
  const criticalMissing = criticalFields.filter((field) => module[field] === null);
  const invalidCritical = criticalFields.filter((field) => module[field] !== null && module[field] <= 0);
  const hasRejected = evidence.some((item) => item.status === 'rejected');
  const level = calibration.status === 'calibrated' && criticalMissing.length === 0 && invalidCritical.length === 0 && !hasRejected
    ? 'calibrated'
    : 'draft';

  return {
    draft: {
      id: root.id || 'DRAFT-001',
      source,
      calibration,
      description,
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
      proposal: {
        family: { tipo: family.type, nome: family.name },
        module
      }
    },
    validation: {
      level,
      critical_missing: criticalMissing,
      warnings: [
        ...(calibration.status !== 'calibrated' ? ['Escala não calibrada; dimensões visuais não podem ser tratadas como medidas reais.'] : []),
        ...(hasRejected ? ['Existem evidências rejeitadas que não foram convertidas em componentes.'] : [])
      ],
      errors: invalidCritical.map((field) => `${field} deve ser maior que zero.`)
    }
  };
}

function convertDraftToProject(input = {}) {
  const analyzed = analyzeDraft(input);
  const module = analyzed.draft.proposal.module;
  if (analyzed.validation.critical_missing.length || analyzed.validation.errors.length) {
    const error = new Error('O rascunho precisa de confirmação das dimensões críticas antes da conversão.');
    error.code = 'DRAFT_INCOMPLETE';
    error.validation = analyzed.validation;
    throw error;
  }

  const source = analyzed.draft.source;
  const moduleForProject = {
    ...module,
    componentes: module.componentes.map((component) => ({
      ...component,
      status: component.status || 'needs_confirmation'
    }))
  };
  const project = {
    schema_version: '1.1',
    unidade: 'mm',
    pedido: input.pedido || `Conversão do rascunho ${source.filename || analyzed.draft.id}`,
    ambiente: asObject(input.ambiente),
    paredes: Array.isArray(input.paredes) ? input.paredes : [],
    aberturas: Array.isArray(input.aberturas) ? input.aberturas : [],
    modulos: [moduleForProject],
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

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('n8n/normalize-draft-vision.js', 'utf8');

function runN8nCode(item, webhookItem = null) {
  const context = {
    $input: {
      first: () => item
    },
    $: (nodeName) => ({
      first: () => webhookItem && ['Receber Rascunho', 'Webhook'].includes(nodeName) ? webhookItem : null
    })
  };
  return vm.runInNewContext(`(() => {\n${code}\n})()`, context);
}

const legacyWebhookItem = {
  json: { body: { pedido: 'Estante com prateleiras', filename: 'original-estante.png' } },
  binary: { image: { fileName: 'original-estante.png' } }
};

const legacyItem = {
  json: {
    output_text: JSON.stringify({
      view: 'front',
      description: 'Estante aberta',
      ocr_text: ['900 mm'],
      dimensions: {
        width_mm: 900,
        depth_mm: null,
        height_mm: null,
        board_thickness_mm: null,
        reference_dimension: 'largura',
        reference_value_mm: 900
      },
      components: [
        {
          kind: 'shelf',
          box_px: { x: 10, y: 20, width: 100, height: 4 },
          confidence: 0.9,
          status: 'observed',
          notes: 'Prateleira horizontal visível'
        }
      ],
      assumptions: [],
      open_questions: ['Confirme a profundidade.']
    })
  },
  binary: {
    image: { fileName: 'saida-openai.png' }
  }
};

const legacyResult = runN8nCode(legacyItem, legacyWebhookItem);
const legacyPayload = legacyResult[0].json.draft_payload;
assert.strictEqual(legacyPayload.pedido, 'Estante com prateleiras');
assert.strictEqual(legacyPayload.draft.source.type, 'image');
assert.strictEqual(legacyPayload.draft.source.filename, 'original-estante.png');
assert.deepStrictEqual(Array.from(legacyPayload.draft.source.binary_properties), ['image']);
assert.strictEqual(legacyPayload.draft.visual_measurements.width_mm, 900);
assert.strictEqual(legacyPayload.draft.visual_measurements.depth_mm, null);
assert.strictEqual(legacyPayload.draft.calibration.status, 'needs_confirmation');
assert.strictEqual(legacyPayload.draft.evidence[0].kind, 'shelf');
assert.strictEqual(legacyPayload.draft.evidence[0].status, 'observed');
assert.ok(legacyPayload.draft.open_questions.some((question) => question.includes('profundidade')));

const multipartWebhookItem = {
  json: {
    body: {
      pedido: 'Analisar o ambiente em U e o módulo vertical das imagens'
    }
  },
  binary: {
    image0: { fileName: 'IMG-20260824-WA0028.jpg' },
    image1: { fileName: 'IMG-20260824-WA0023.jpg' }
  }
};

const openAiMessageItem = {
  json: {
    id: 'msg-test',
    type: 'message',
    status: 'incomplete',
    content: [
      {
        type: 'output_text',
        annotations: [],
        text: '```json\n' + JSON.stringify({
          view: [
            {
              description: 'Ambiente em U com janela e módulos laterais.',
              components: [
                {
                  kind: 'shelf',
                  module_id: 'U-BACK',
                  box: { x: 20, y: 30, width: 120, height: 5, confidence: 0.86 },
              status: 'observed',
              notes: 'Prateleira visível na primeira imagem'
                }
              ]
            },
            {
              description: 'Módulo vertical aberto com divisões internas.',
              components: [
                {
                  kind: 'vertical_divider',
                  module_id: 'U-LEFT',
                  box_px: { x: 80, y: 100, width: 5, height: 180 },
                  confidence: 0.72,
                  status: 'proposed',
                  notes: 'Divisão interna sugerida na segunda imagem'
                }
              ]
            }
          ],
          layout: 'U',
          family: { tipo: 'composicao_u', nome: 'Closet em U' },
          composition: {
            layout: 'U',
            description: 'Módulo vertical separado do ambiente em U.',
            module_ids: ['U-LEFT', 'U-BACK'],
            circulation_min_mm: null
          },
          modules: [
            {
              id: 'U-LEFT', tipo: 'torre_closet', nome: 'Lateral esquerda', x: null, y: null, z: 0, rotacao_z: null,
              largura: null, profundidade: null, altura: null, espessura_chapa: null,
              portas: 0, gavetas: 3, prateleiras: 3, parametros: { cabideiros: 1, divisorias_verticais: 1 }, evidencia_ids: []
            },
            {
              id: 'U-BACK', tipo: 'armario_aberto', nome: 'Módulo do fundo', x: null, y: null, z: 0, rotacao_z: null,
              largura: null, profundidade: null, altura: null, espessura_chapa: null,
              portas: 0, gavetas: 0, prateleiras: 4, parametros: { divisorias_verticais: 2 }, evidencia_ids: []
            }
          ],
          ocr_text: 'Espelho\nJanela\nSapateira',
          dimensions: {
            width_mm: null,
            depth_mm: null,
            height_mm: null,
            board_thickness_mm: null,
            reference_dimension: null,
            reference_value_mm: null
          },
          assumptions: ['As imagens representam partes relacionadas, mas sem escala comum.'],
          open_questions: ['Confirme se o módulo vertical pertence ao ambiente em U.']
        }) + '\n```'
      }
    ]
  }
};

const multipartResult = runN8nCode(openAiMessageItem, multipartWebhookItem);
const multipartPayload = multipartResult[0].json.draft_payload;
assert.strictEqual(multipartPayload.pedido, 'Analisar o ambiente em U e o módulo vertical das imagens');
assert.strictEqual(multipartPayload.draft.source.filename, 'IMG-20260824-WA0028.jpg');
assert.deepStrictEqual(Array.from(multipartPayload.draft.source.binary_properties), ['image0', 'image1']);
assert.deepStrictEqual(Array.from(multipartPayload.draft.source.filenames), [
  'IMG-20260824-WA0028.jpg',
  'IMG-20260824-WA0023.jpg'
]);
assert.strictEqual(multipartPayload.draft.description, 'Ambiente em U com janela e módulos laterais. | Módulo vertical aberto com divisões internas.');
assert.deepStrictEqual(Array.from(multipartPayload.draft.ocr_text), ['Espelho', 'Janela', 'Sapateira']);
assert.strictEqual(multipartPayload.draft.evidence.length, 2);
assert.strictEqual(multipartPayload.draft.composition.layout, 'U');
assert.strictEqual(multipartPayload.draft.proposal.family.tipo, 'composicao_u');
assert.strictEqual(multipartPayload.draft.proposal.modules.length, 2);
assert.strictEqual(multipartPayload.draft.evidence[0].module_id, 'U-BACK');
assert.strictEqual(multipartPayload.draft.evidence[1].module_id, 'U-LEFT');
assert.strictEqual(multipartPayload.draft.evidence[0].box_px.width, 120);
assert.strictEqual(multipartPayload.draft.evidence[0].confidence, 0.86);
assert.strictEqual(multipartPayload.draft.evidence[1].kind, 'vertical_divider');
assert.strictEqual(multipartPayload.draft.visual_measurements.width_mm, null);
assert.strictEqual(multipartPayload.draft.calibration.status, 'needs_confirmation');
assert.ok(multipartPayload.draft.assumptions.some((assumption) => assumption.includes('sem escala')));

const partialItem = {
  json: {
    output_text: JSON.stringify({
      description: 'Closet em formato U com prateleiras, espelho central, janela e sapateira.',
      ocr_text: ['Espelho', 'Janela', 'Sapateira'],
      proposal: {
        family: { tipo: 'armario_aberto', nome: 'Armário aberto' },
        module: { id: 'MOD-001', tipo: 'armario_aberto', nome: 'Armário aberto', largura: null, profundidade: null, altura: null, espessura_chapa: null, portas: 0, gavetas: 0, prateleiras: 0 }
      },
      components: [],
      modules: []
    })
  },
  binary: { image0: { fileName: 'closet-u.jpg' } }
};
const partialPayload = runN8nCode(partialItem, {
  json: { body: { pedido: 'Identificar closet em U' } },
  binary: { image0: { fileName: 'closet-u.jpg' } }
})[0].json.draft_payload;
assert.strictEqual(partialPayload.draft.description, 'Closet em formato U com prateleiras, espelho central, janela e sapateira.');
assert.strictEqual(partialPayload.draft.identification.type, 'closet');
assert.strictEqual(partialPayload.draft.composition.layout, 'U');
assert.strictEqual(partialPayload.draft.modules.length, 0);
assert.strictEqual(partialPayload.draft.module, null);

const indexedVision = {
  view: 'perspective',
  description: 'Closet em formato U com prateleiras e espelho.',
  ocr_text: ['Janela', 'Espelho'],
  dimensions: { width_mm: null, depth_mm: null, height_mm: null, board_thickness_mm: null },
  components: [],
  assumptions: [],
  open_questions: []
};
const indexedText = JSON.stringify(indexedVision).replace(/([,{])/g, '$1\\n');
const indexedItem = {
  json: {
    '0': {
      id: 'msg-indexed',
      content: [{ type: 'output_text', text: indexedText }]
    }
  },
  binary: { image0: { fileName: 'indexed-closet.jpg' } }
};
const indexedPayload = runN8nCode(indexedItem, {
  json: { body: { pedido: 'Identificar rascunho indexado' } },
  binary: { image0: { fileName: 'indexed-closet.jpg' } }
})[0].json.draft_payload;
assert.strictEqual(indexedPayload.draft.description, indexedVision.description);
assert.deepStrictEqual(Array.from(indexedPayload.draft.ocr_text), ['Janela', 'Espelho']);
assert.strictEqual(indexedPayload.draft.identification.type, 'closet');
assert.strictEqual(indexedPayload.draft.composition.layout, 'U');
assert.strictEqual(indexedPayload.draft.modules.length, 0);
assert.strictEqual(indexedPayload.draft.module, null);

console.log('n8n normalize draft vision tests: ok');

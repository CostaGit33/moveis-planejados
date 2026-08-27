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
                  kind: 'divider',
                  box_px: { x: 80, y: 100, width: 5, height: 180 },
                  confidence: 0.72,
                  status: 'proposed',
                  notes: 'Divisão interna sugerida na segunda imagem'
                }
              ]
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
assert.strictEqual(multipartPayload.draft.evidence[0].box_px.width, 120);
assert.strictEqual(multipartPayload.draft.evidence[0].confidence, 0.86);
assert.strictEqual(multipartPayload.draft.evidence[1].kind, 'divider');
assert.strictEqual(multipartPayload.draft.visual_measurements.width_mm, null);
assert.strictEqual(multipartPayload.draft.calibration.status, 'needs_confirmation');
assert.ok(multipartPayload.draft.assumptions.some((assumption) => assumption.includes('sem escala')));

console.log('n8n normalize draft vision tests: ok');

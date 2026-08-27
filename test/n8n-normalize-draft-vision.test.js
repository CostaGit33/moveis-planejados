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

const webhookItem = {
  json: { body: { pedido: 'Estante com prateleiras', filename: 'original-estante.png' } },
  binary: { image: { fileName: 'original-estante.png' } }
};

const item = {
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

const result = runN8nCode(item, webhookItem);
const payload = result[0].json.draft_payload;
assert.strictEqual(payload.pedido, 'Estante com prateleiras');
assert.strictEqual(payload.draft.source.type, 'image');
assert.strictEqual(payload.draft.source.filename, 'original-estante.png');
assert.strictEqual(payload.draft.visual_measurements.width_mm, 900);
assert.strictEqual(payload.draft.visual_measurements.depth_mm, null);
assert.strictEqual(payload.draft.calibration.status, 'needs_confirmation');
assert.strictEqual(payload.draft.evidence[0].kind, 'shelf');
assert.strictEqual(payload.draft.evidence[0].status, 'observed');
assert.ok(payload.draft.open_questions.some((question) => question.includes('profundidade')));
console.log('n8n normalize draft vision tests: ok');

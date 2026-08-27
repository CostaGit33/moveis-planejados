const assert = require('assert');
const express = require('express');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { analyzeDraft, convertDraftToProject } = require('../draft-converter');
const { registerDraftRoutes } = require('../api/draft-routes');

function request(server, route, method = 'GET', body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? '' : JSON.stringify(body);
    const address = server.address();
    const req = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path: route,
      method,
      headers: body === undefined ? {} : {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
        } catch (error) {
          reject(new Error(`Resposta não JSON (${res.statusCode}): ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function requestMultipart(server, route, fields, file) {
  return new Promise((resolve, reject) => {
    const boundary = '----moveis-draft-test-boundary';
    const chunks = [];
    for (const [name, value] of Object.entries(fields)) {
      chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    }
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`));
    chunks.push(file.buffer);
    chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const payload = Buffer.concat(chunks);
    const address = server.address();
    const req = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path: route,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': payload.length
      }
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
        } catch (error) {
          reject(new Error(`Resposta não JSON (${res.statusCode}): ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.end(payload);
  });
}

async function main() {
  const fixturePath = path.join(__dirname, '..', 'examples', 'rascunho-modulo-estante.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const analyzed = analyzeDraft(fixture);

  assert.strictEqual(analyzed.draft.source.type, 'technical_drawing');
  assert.strictEqual(analyzed.draft.calibration.status, 'calibrated');
  assert.strictEqual(analyzed.draft.proposal.module.tipo, 'armario_aberto');
  assert.strictEqual(analyzed.draft.proposal.module.largura, 900);
  assert.strictEqual(analyzed.draft.proposal.module.prateleiras, 4);
  assert.strictEqual(analyzed.draft.proposal.module.componentes.length, 9);
  assert.strictEqual(analyzed.validation.level, 'calibrated');
  assert.deepStrictEqual(analyzed.validation.critical_missing, []);

  const converted = convertDraftToProject(fixture);
  assert.strictEqual(converted.project.unidade, 'mm');
  assert.strictEqual(converted.project.modulos[0].altura, 1800);
  assert.strictEqual(converted.project.modulos[0].componentes[0].origem_evidencia, 'EVID-001');

  const incomplete = analyzeDraft({
    draft: {
      source: { type: 'sketch' },
      evidence: [{ kind: 'shelf', confidence: 0.8 }],
      module: { tipo: 'estante', prateleiras: 2 }
    }
  });
  assert.strictEqual(incomplete.validation.level, 'draft');
  assert(incomplete.validation.critical_missing.includes('largura'));
  assert.throws(() => convertDraftToProject({ draft: incomplete.draft }), (error) => error.code === 'DRAFT_INCOMPLETE');

  const previousFetch = global.fetch;
  const previousVisionBase = process.env.VISION_API_BASE;
  const previousVisionKey = process.env.VISION_API_KEY;
  process.env.VISION_API_BASE = 'http://vision.test/v1';
  process.env.VISION_API_KEY = 'test-key';
  global.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            view: 'front',
            description: 'Armário aberto com prateleira visível.',
            ocr_text: ['900 mm'],
            dimensions: {
              width_mm: null,
              depth_mm: null,
              height_mm: null,
              board_thickness_mm: null,
              reference_dimension: null,
              reference_value_mm: null
            },
            components: [{
              kind: 'shelf',
              box_px: { x: 0, y: 0, width: 1, height: 1 },
              confidence: 0.91,
              status: 'observed',
              notes: 'Prateleira identificada.'
            }],
            assumptions: [],
            open_questions: ['Qual é a largura total?']
          })
        }
      }]
    })
  });

  const app = express();
  app.use(express.json());
  registerDraftRoutes(app);
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const visionStatusResponse = await request(server, '/api/drafts/vision/status');
    assert.strictEqual(visionStatusResponse.status, 200);
    assert.strictEqual(visionStatusResponse.body.enabled, true);
    assert.strictEqual(visionStatusResponse.body.model, 'gemini-3-flash-preview');

    const imageResponse = await requestMultipart(server, '/api/drafts/analyze-image', { pedido: 'Reproduzir este armário aberto.' }, {
      filename: 'rascunho.png',
      contentType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
    });
    assert.strictEqual(imageResponse.status, 200);
    assert.strictEqual(imageResponse.body.vision.ocr_text[0], '900 mm');
    assert.strictEqual(imageResponse.body.draft_payload.draft.source.type, 'image');
    assert.strictEqual(imageResponse.body.draft_payload.draft.module.largura, null);
    assert.strictEqual(imageResponse.body.validation.level, 'draft');
    assert.deepStrictEqual(imageResponse.body.validation.critical_missing, ['largura', 'profundidade', 'altura', 'espessura_chapa']);
    assert.strictEqual(imageResponse.body.draft.proposal.module.componentes.length, 1);

    const analysisResponse = await request(server, '/api/drafts/analyze', 'POST', fixture);
    assert.strictEqual(analysisResponse.status, 200);
    assert.strictEqual(analysisResponse.body.draft.proposal.module.largura, 900);

    const conversionResponse = await request(server, '/api/drafts/convert', 'POST', fixture);
    assert.strictEqual(conversionResponse.status, 200);
    assert.strictEqual(conversionResponse.body.project.modulos[0].tipo, 'armario_aberto');
    assert(conversionResponse.body.scene.nodes.some((node) => node.kind === 'module'));
    assert(conversionResponse.body.scene.nodes.some((node) => node.kind === 'component'));

    const incompleteResponse = await request(server, '/api/drafts/convert', 'POST', {
      draft: { source: { type: 'sketch' }, module: { tipo: 'estante' } }
    });
    assert.strictEqual(incompleteResponse.status, 422);
    assert.strictEqual(incompleteResponse.body.error, 'O rascunho precisa de confirmação das dimensões críticas antes da conversão.');

    console.log(JSON.stringify({
      analyze: analysisResponse.status,
      convert: conversionResponse.status,
      incomplete: incompleteResponse.status,
      module_type: conversionResponse.body.project.modulos[0].tipo,
      components: conversionResponse.body.scene.nodes.filter((node) => node.kind === 'component').length
    }, null, 2));
    console.log('draft-converter tests: ok');
  } finally {
    server.close();
    global.fetch = previousFetch;
    if (previousVisionBase === undefined) delete process.env.VISION_API_BASE;
    else process.env.VISION_API_BASE = previousVisionBase;
    if (previousVisionKey === undefined) delete process.env.VISION_API_KEY;
    else process.env.VISION_API_KEY = previousVisionKey;
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

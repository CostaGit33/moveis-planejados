'use strict';

const assert = require('assert');
const express = require('express');
const http = require('http');
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

function requestMultipart(server, route) {
  return new Promise((resolve, reject) => {
    const boundary = '----moveis-n8n-proxy-test';
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    const chunks = [
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="pedido"\r\n\r\nAnalisar estante\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="estante.png"\r\nContent-Type: image/png\r\n\r\n`),
      image,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ];
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
  const previousFetch = global.fetch;
  const previousWebhook = process.env.N8N_DRAFT_WEBHOOK_URL;
  const previousTimeout = process.env.N8N_DRAFT_TIMEOUT_MS;
  process.env.N8N_DRAFT_WEBHOOK_URL = 'https://n8n.test/webhook/rascunho-modulo';
  process.env.N8N_DRAFT_TIMEOUT_MS = '5000';
  let fetchCalls = 0;
  global.fetch = async (url, options) => {
    fetchCalls += 1;
    assert.strictEqual(url, process.env.N8N_DRAFT_WEBHOOK_URL);
    assert.strictEqual(options.method, 'POST');
    assert.ok(options.body instanceof FormData);
    assert.strictEqual(options.body.getAll('image').length, 2);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        ok: true,
        draft: {
          id: 'DRAFT-N8N-TEST',
          source: { type: 'image', filename: 'estante.png', view: 'front' },
          calibration: { status: 'needs_confirmation', reference_dimension: null, reference_value_mm: null, scale_px_per_mm: null },
          description: 'Estante aberta analisada pelo N8N.',
          ocr_text: ['900 mm'],
          visual_measurements: { width_mm: null, depth_mm: null, height_mm: null, board_thickness_mm: null },
          evidence: [{
            id: 'VISION-EVID-001',
            kind: 'shelf',
            box_px: { x: 1, y: 2, width: 10, height: 3 },
            confidence: 0.91,
            status: 'observed',
            notes: 'Prateleira visível.'
          }],
          assumptions: ['Sem escala confirmada.'],
          open_questions: ['Confirme as medidas.'],
          composition: { layout: 'U', module_ids: ['U-LEFT', 'U-BACK'], description: 'Closet em U e módulo vertical separados.' },
          proposal: {
            family: { tipo: 'composicao_u', nome: 'Closet em U' },
            module: {
              id: 'U-LEFT', tipo: 'torre_closet', nome: 'Lateral esquerda', x: null, y: null, z: 0,
              largura: null, profundidade: null, altura: null, espessura_chapa: null,
              material: 'mdf_areia', portas: 0, gavetas: 3, prateleiras: 3,
              componentes: [], parametros: { divisorias_verticais: 1, cabideiros: 1 }
            },
            modules: [
              {
                id: 'U-LEFT', tipo: 'torre_closet', nome: 'Lateral esquerda', x: null, y: null, z: 0,
                largura: null, profundidade: null, altura: null, espessura_chapa: null,
                material: 'mdf_areia', portas: 0, gavetas: 3, prateleiras: 3,
                componentes: [], parametros: { divisorias_verticais: 1, cabideiros: 1 }
              },
              {
                id: 'U-BACK', tipo: 'armario_aberto', nome: 'Módulo do fundo', x: null, y: null, z: 0,
                largura: null, profundidade: null, altura: null, espessura_chapa: null,
                material: 'mdf_areia', portas: 0, gavetas: 0, prateleiras: 4,
                componentes: [], parametros: { divisorias_verticais: 2 }
              }
            ]
          }
        },
        validation: { level: 'draft', critical_missing: ['largura', 'profundidade', 'altura', 'espessura_chapa'], warnings: [], errors: [] }
      })
    };
  };

  const app = express();
  app.use(express.json());
  registerDraftRoutes(app);
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const status = await request(server, '/api/drafts/n8n/status');
    assert.strictEqual(status.status, 200);
    assert.strictEqual(status.body.enabled, true);
    assert.strictEqual(status.body.transport, 'n8n-webhook');

    const response = await requestMultipart(server, '/api/drafts/analyze-image-n8n');
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.ok, true);
    assert.strictEqual(response.body.vision.model, 'n8n-openai');
    assert.strictEqual(response.body.vision.ocr_text[0], '900 mm');
    assert.strictEqual(response.body.draft_payload.draft.source.filename, 'estante.png');
    assert.strictEqual(response.body.draft_payload.draft.evidence.length, 1);
    assert.strictEqual(response.body.draft_payload.draft.composition.layout, 'U');
    assert.strictEqual(response.body.draft_payload.draft.proposal.modules.length, 2);
    assert.deepStrictEqual(response.body.validation.critical_missing, [
      'modulos[0].largura', 'modulos[0].profundidade', 'modulos[0].altura', 'modulos[0].espessura_chapa',
      'modulos[1].largura', 'modulos[1].profundidade', 'modulos[1].altura', 'modulos[1].espessura_chapa',
      'modulos[0].x', 'modulos[0].y', 'modulos[0].rotacao_z',
      'modulos[1].x', 'modulos[1].y', 'modulos[1].rotacao_z'
    ]);
    assert.strictEqual(fetchCalls, 1);

    console.log(JSON.stringify({
      status: status.status,
      proxy: response.status,
      evidence: response.body.draft_payload.draft.evidence.length,
      critical_missing: response.body.validation.critical_missing
    }, null, 2));
    console.log('n8n proxy tests: ok');
  } finally {
    server.close();
    global.fetch = previousFetch;
    if (previousWebhook === undefined) delete process.env.N8N_DRAFT_WEBHOOK_URL;
    else process.env.N8N_DRAFT_WEBHOOK_URL = previousWebhook;
    if (previousTimeout === undefined) delete process.env.N8N_DRAFT_TIMEOUT_MS;
    else process.env.N8N_DRAFT_TIMEOUT_MS = previousTimeout;
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

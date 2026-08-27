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

  const app = express();
  app.use(express.json());
  registerDraftRoutes(app);
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
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
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

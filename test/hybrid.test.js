const assert = require('assert');
const express = require('express');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { enrichProject, projectToScene } = require('../hybrid-contract');
const { registerHybridRoutes, projectParts } = require('../api/hybrid-routes');

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
  const baseProject = enrichProject({
    unidade: 'mm',
    pedido: 'Módulo teste',
    ambiente: { largura: 3200, profundidade: 2800, pe_direito: 2700 },
    paredes: [{ id: 'PAREDE-001', largura: 3200, espessura: 120, altura: 2700 }],
    modulos: [{
      id: 'MOD-001',
      tipo: 'balcao_pia',
      nome: 'Balcão para pia',
      x: 300,
      y: 120,
      z: 0,
      largura: 600,
      profundidade: 600,
      altura: 720,
      espessura_chapa: 18,
      material: 'mdf_areia',
      portas: 0,
      gavetas: 4,
      prateleiras: 0
    }]
  });

  assert.strictEqual(baseProject.schema_version, '1.1');
  assert.strictEqual(baseProject.unidade, 'mm');
  assert.strictEqual(baseProject.fabricacao.kerf, 3);
  assert.strictEqual(baseProject.render.engine, 'three');

  const scene = projectToScene(baseProject);
  assert(scene.nodes.some((node) => node.kind === 'wall'));
  assert(scene.nodes.some((node) => node.kind === 'module'));
  const components = scene.nodes.filter((node) => node.kind === 'component');
  assert(components.some((node) => node.role === 'side-left'));
  assert(components.some((node) => node.role === 'side-right'));
  assert(components.some((node) => node.role === 'top'));
  assert(components.some((node) => node.role === 'base'));
  const back = components.find((node) => node.role === 'back');
  assert(back);
  assert.strictEqual(back.position_mm.y, 120 + 600 - 18 / 2);
  assert.strictEqual(back.size_mm.y, 18);
  assert.strictEqual(components.filter((node) => node.role === 'drawer-front').length, 4);
  assert.strictEqual(components.filter((node) => node.role === 'drawer-side-left').length, 4);
  assert.strictEqual(components.filter((node) => node.role === 'drawer-bottom').length, 4);
  assert.strictEqual(components.filter((node) => node.role === 'foot').length, 4);

  const closetProject = enrichProject({
    unidade: 'mm',
    pedido: 'Regressão: closet em U',
    ambiente: { nome: 'Closet em U', layout: 'U', largura: 3200, profundidade: 2800, pe_direito: 2700, circulacao_minima: 800 },
    paredes: [
      { id: 'PAREDE-FUNDO', x: 0, y: 0, largura: 3200, espessura: 120, altura: 2700 },
      { id: 'PAREDE-ESQUERDA', x: 0, y: 0, largura: 2800, espessura: 120, altura: 2700, rotacao_z: 90 },
      { id: 'PAREDE-DIREITA', x: 3200, y: 0, largura: 2800, espessura: 120, altura: 2700, rotacao_z: -90 }
    ],
    modulos: [
      {
        id: 'U-ESQUERDA', tipo: 'torre_closet', nome: 'Torre esquerda', x: 120, y: 120, z: 0, rotacao_z: 0,
        largura: 600, profundidade: 600, altura: 2400, espessura_chapa: 18, material: 'mdf_areia',
        portas: 0, gavetas: 3, prateleiras: 3, parametros: { cabideiros: 1, divisorias_verticais: 1 }
      },
      {
        id: 'U-FUNDO', tipo: 'armario_aberto', nome: 'Módulo do fundo', x: 1300, y: 120, z: 0, rotacao_z: 0,
        largura: 600, profundidade: 600, altura: 2400, espessura_chapa: 18, material: 'mdf_areia',
        portas: 0, gavetas: 0, prateleiras: 4, parametros: { divisorias_verticais: 2 }
      },
      {
        id: 'U-DIREITA', tipo: 'torre_closet', nome: 'Torre direita', x: 2480, y: 120, z: 0, rotacao_z: 0,
        largura: 600, profundidade: 600, altura: 2400, espessura_chapa: 18, material: 'mdf_areia',
        portas: 0, gavetas: 4, prateleiras: 3, parametros: { cabideiros: 1, divisorias_verticais: 1 }
      }
    ]
  });
  const closetScene = projectToScene(closetProject);
  const closetComponents = closetScene.nodes.filter((node) => node.kind === 'component');
  assert.strictEqual(closetScene.nodes.filter((node) => node.kind === 'module').length, 3);
  assert.strictEqual(closetComponents.filter((node) => node.role === 'vertical-divider').length, 4);
  assert.strictEqual(closetComponents.filter((node) => node.role === 'hanger').length, 2);
  assert(closetScene.nodes.filter((node) => node.rotation_deg?.z === 0).length >= 3);
  const closetParts = projectParts(closetProject);
  assert(closetParts.some((part) => part.nome === 'Divisória vertical'));
  assert(closetParts.some((part) => part.nome === 'Cabideiro'));
  assert(closetParts.length > 0);

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moveis-hybrid-'));
  const app = express();
  app.use(express.json());
  registerHybridRoutes(app, { outDir });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const capabilities = await request(server, '/api/hybrid/capabilities');
    assert.strictEqual(capabilities.status, 200);
    assert.strictEqual(capabilities.body.architecture, 'hybrid');
    assert.strictEqual(capabilities.body.adapters.viewer_web.engine, 'three');

    const sceneResponse = await request(server, '/api/hybrid/scene', 'POST', { project: baseProject });
    assert.strictEqual(sceneResponse.status, 200);
    assert(sceneResponse.body.scene.nodes.length >= 2);
    assert.strictEqual(sceneResponse.body.project.schema_version, '1.1');

    const jobResponse = await request(server, '/api/hybrid/jobs', 'POST', {
      type: 'blender',
      project: baseProject,
      options: { preset: 'preview' }
    });
    assert.strictEqual(jobResponse.status, 202);
    assert.strictEqual(jobResponse.body.worker_status, 'waiting_worker');

    const jobStatus = await request(server, `/api/hybrid/jobs/${jobResponse.body.job_id}`);
    assert.strictEqual(jobStatus.status, 200);
    assert.strictEqual(jobStatus.body.job.input.project.schema_version, '1.1');

    const jobUpdate = await request(server, `/api/hybrid/jobs/${jobResponse.body.job_id}`, 'PATCH', {
      status: 'completed',
      worker_status: 'completed',
      artifacts: [{ type: 'blend', path: 'renders/preview.blend' }]
    });
    assert.strictEqual(jobUpdate.status, 200);
    assert.strictEqual(jobUpdate.body.job.status, 'completed');
    assert.strictEqual(jobUpdate.body.job.artifacts.length, 1);

    console.log(JSON.stringify({
      capabilities: capabilities.status,
      scene: sceneResponse.status,
      job: jobResponse.status,
      job_update: jobUpdate.status,
      job_type: jobUpdate.body.job.type,
      scene_nodes: sceneResponse.body.scene.nodes.length,
      closet_modules: closetScene.nodes.filter((node) => node.kind === 'module').length,
      closet_parts: closetParts.length
    }, null, 2));
    console.log('hybrid tests: ok');
  } finally {
    server.close();
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

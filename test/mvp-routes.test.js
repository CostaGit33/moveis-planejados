const assert = require('assert');
const express = require('express');
const http = require('http');
const { registerMvpRoutes } = require('../api/mvp-routes');

function request(server, route, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const address = server.address();
    const req = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path: route,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (error) {
          reject(new Error(`Resposta não JSON (${res.statusCode}): ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  const app = express();
  app.use(express.json());
  registerMvpRoutes(app);
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const input = {
      pedido: 'Quero uma cozinha em L de 3,20 m x 2,80 m com pia e quatro gavetas',
      interpretacao: {
        ambiente: 'cozinha',
        layout: 'L',
        largura: 3200,
        profundidade: 2800,
        altura: null,
        itens: {
          pia: true,
          cooktop: false,
          torre_quente: false,
          geladeira: false,
          bancada: false,
          armario_inferior: false,
          gavetas: 4
        },
        material_preferido: 'mdf_areia',
        modulos: []
      }
    };

    const normalized = await request(server, '/api/projetos/normalizar', input);
    assert.strictEqual(normalized.status, 200);
    const project = normalized.body.projeto;
    assert.strictEqual(project.unidade, 'mm');
    assert.strictEqual(project.ambiente.largura, 3200);
    assert.strictEqual(project.ambiente.profundidade, 2800);
    assert.strictEqual(project.modulos.length, 1);
    assert.strictEqual(project.modulos[0].tipo, 'balcao_pia');
    assert.strictEqual(project.modulos[0].gavetas, 4);
    assert.strictEqual(project.modulos[0].material, 'mdf_areia');

    const budget = await request(server, '/api/orcamentos/calcular', { projeto: project });
    assert.strictEqual(budget.status, 200);
    assert(budget.body.pecas.some((piece) => piece.nome === 'Frente de Gaveta'));
    assert(budget.body.pecas.some((piece) => piece.nome === 'Lateral de Gaveta'));
    assert(budget.body.orcamento.total > 0);

    console.log(JSON.stringify({
      normalizar: normalized.status,
      orcamento: budget.status,
      modulo: project.modulos[0],
      quantidade_pecas: budget.body.pecas.length,
      total: budget.body.orcamento.total
    }, null, 2));
    console.log('mvp-routes tests: ok');
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

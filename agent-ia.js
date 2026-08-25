// agent-ia.js - esqueleto das ferramentas que o Agent IA chamará
// Observação: implementar integração com Claude/Anthropic conforme necessidade

const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function criar_cliente(data) {
  const { nome, telefone, endereco, email } = data;
  const res = await pool.query(
    'INSERT INTO clientes (nome, telefone, endereco, email) VALUES ($1,$2,$3,$4) RETURNING *',
    [nome, telefone, endereco, email]
  );
  return res.rows[0];
}

async function criar_orcamento(payload) {
  // payload: { cliente_id, itens: [{descricao, quantidade, preco_unitario}], desconto }
  // Lógica simplificada: cria orçamento e itens, recalcula total no frontend/backend conforme regra
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orc = await client.query(
      'INSERT INTO orcamentos (cliente_id, numero_proposta, data, desconto, status) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [payload.cliente_id, payload.numero_proposta || null, payload.data || new Date(), payload.desconto || 0, 'rascunho']
    );
    const orcamentoId = orc.rows[0].id;
    if (Array.isArray(payload.itens)) {
      for (const item of payload.itens) {
        await client.query(
          'INSERT INTO orcamento_itens (orcamento_id, descricao, quantidade, preco_unitario) VALUES ($1,$2,$3,$4)',
          [orcamentoId, item.descricao, item.quantidade || 1, item.preco_unitario || 0]
        );
      }
    }
    await client.query('COMMIT');
    return { id: orcamentoId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listar_clientes() {
  const r = await pool.query('SELECT * FROM clientes ORDER BY id DESC LIMIT 200');
  return r.rows;
}

module.exports = {
  criar_cliente,
  criar_orcamento,
  listar_clientes,
};

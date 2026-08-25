// seed_sample_data.js
// Insere dados de exemplo no banco após o schema ser aplicado
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const c = await client.query(
      `INSERT INTO clientes (nome, telefone, endereco, email) VALUES ($1,$2,$3,$4) RETURNING *`,
      ['João Silva', '(77) 99999-9999', 'Rua Exemplo, 123', 'joao@example.com']
    );
    const clienteId = c.rows[0].id;

    const orc = await client.query(
      `INSERT INTO orcamentos (cliente_id, numero_proposta, desconto, status, valor_total) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [clienteId, 'PROP-001-2026', 10, 'rascunho', 0]
    );
    const orcId = orc.rows[0].id;

    await client.query(
      `INSERT INTO orcamento_itens (orcamento_id, descricao, quantidade, preco_unitario) VALUES ($1,$2,$3,$4)`,
      [orcId, 'Porta de Alumínio', 2, 1700]
    );
    await client.query(
      `INSERT INTO orcamento_itens (orcamento_id, descricao, quantidade, preco_unitario) VALUES ($1,$2,$3,$4)`,
      [orcId, 'Kit Espelho', 1, 500]
    );

    // Atualiza valor_total simplificado
    const totalRes = await client.query('SELECT SUM(quantidade * preco_unitario) as total FROM orcamento_itens WHERE orcamento_id = $1', [orcId]);
    const total = totalRes.rows[0].total || 0;
    const desconto = orc.rows[0].desconto || 0;
    const valorFinal = Number(total) - (Number(total) * Number(desconto) / 100);
    await client.query('UPDATE orcamentos SET valor_total = $1 WHERE id = $2', [valorFinal, orcId]);

    await client.query('COMMIT');
    console.log('Seed concluída. Cliente ID:', clienteId, 'Orçamento ID:', orcId);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro no seed:', err.message || err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

seed();

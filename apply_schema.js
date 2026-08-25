// apply_schema.js
// Aplica o arquivo orcamento_moveis_schema.sql no PostgreSQL usando variáveis de ambiente (.env)

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const sqlPath = path.join(__dirname, 'orcamento_moveis_schema.sql');

async function main() {
  if (!fs.existsSync(sqlPath)) {
    console.error('Arquivo de schema não encontrado:', sqlPath);
    process.exit(2);
  }

  const config = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  };

  if (!config.user || !config.database) {
    console.error('Variáveis de conexão não configuradas. Preencha .env com DB_USER e DB_NAME (ou passe via env).');
    process.exit(3);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  const statements = sql
    .split(/;\s*\n|;\s*$/g)
    .map(s => s.trim())
    .filter(Boolean);

  const client = new Client(config);
  try {
    await client.connect();
    console.log('Conectado ao banco', config.host, 'database', config.database);

    for (const stmt of statements) {
      console.log('Executando statement... (primeiros 100 chars)');
      console.log(stmt.substring(0, 100).replace(/\n/g, ' '));
      await client.query(stmt);
    }

    console.log('Schema aplicado com sucesso.');
    process.exit(0);
  } catch (err) {
    console.error('Erro ao aplicar schema:', err.message || err);
    process.exit(4);
  } finally {
    try { await client.end(); } catch (e) {}
  }
}

main();

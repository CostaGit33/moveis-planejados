import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('.', import.meta.url));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
for (const f of ['schema.sql', 'seed.sql']) await pool.query(readFileSync(dir + f, 'utf8'));
console.log('Banco pronto: tabelas criadas e rota de exemplo carregada.');
await pool.end();

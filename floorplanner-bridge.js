// floorplanner-bridge.js
// Webhook bridge que recebe JSON do Floorplanner, chama o analyzer e salva referência no banco

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const analyzer = require('./floorplanner-analyzer');

const app = express();
app.use(bodyParser.json({ limit: '5mb' }));

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

app.post('/api/floorplanner/analisar', async (req, res) => {
  try {
    const fml = req.body;
    const result = analyzer.analyzeFML(fml);

    // Salvar projeto mínimo no banco (projects table deve existir)
    const insert = await pool.query(
      `INSERT INTO projetos_floorplanner (external_id, nome, raw_json, criado_em) VALUES ($1,$2,$3,NOW()) RETURNING id`,
      [result.meta.projectId, result.meta.name, JSON.stringify(fml)]
    );

    const projetoId = insert.rows[0].id;

    // Opcional: salvar paredes/aberturas/itens em tabelas específicas
    // Aqui apenas retornamos o resumo
    res.json({ projetoId, summary: result });
  } catch (err) {
    console.error('Erro analisar floorplanner:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

const PORT = process.env.PORT_FLOORPLANNER || 3100;
app.listen(PORT, () => console.log(`Floorplanner bridge rodando na porta ${PORT}`));

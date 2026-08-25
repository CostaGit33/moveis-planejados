const path = require("path");
const pool = require("./db");
const { generateParts } = require(path.join("..", "furniture-builder"));

function positiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

function numeric(value, field) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    const error = new Error(`Campo inválido: ${field}`);
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}

function normalizeSpec(body) {
  const spec = body && body.spec ? body.spec : body;
  if (!spec || Array.isArray(spec) || typeof spec !== "object") {
    const error = new Error("O payload deve conter uma especificação de módulo em JSON.");
    error.statusCode = 400;
    throw error;
  }

  const normalized = {
    nome: String(spec.nome || "Módulo N8N").trim(),
    largura: numeric(spec.largura, "largura"),
    altura: numeric(spec.altura, "altura"),
    profundidade: numeric(spec.profundidade, "profundidade"),
    espessura: numeric(spec.espessura || 18, "espessura"),
    portas: positiveInteger(spec.portas || 0, 0, 100),
    prateleiras: positiveInteger(spec.prateleiras || 0, 0, 100),
    material: String(spec.material || "MDF").trim(),
    parametros: spec.parametros && typeof spec.parametros === "object" ? spec.parametros : {}
  };

  if (!normalized.largura || !normalized.altura || !normalized.profundidade || !normalized.espessura) {
    const error = new Error("largura, altura, profundidade e espessura devem ser maiores que zero.");
    error.statusCode = 400;
    throw error;
  }

  return normalized;
}

function registerN8nRoutes(app) {
  app.get("/api/orcamentos", async (req, res) => {
    try {
      const limit = positiveInteger(req.query.limit || 50, 50, 100);
      const values = [];
      let statusClause = "";
      if (req.query.status) {
        values.push(String(req.query.status));
        statusClause = `WHERE o.status = $${values.length}`;
      }
      values.push(limit);

      const result = await pool.query(
        `SELECT o.id, o.cliente_id, o.numero_proposta, o.data, o.desconto,
                o.acrescimo, o.status, o.valor_total, o.criado_em,
                c.nome AS cliente_nome, c.telefone AS cliente_telefone,
                COALESCE(json_agg(json_build_object(
                  'id', i.id,
                  'descricao', i.descricao,
                  'quantidade', i.quantidade,
                  'preco_unitario', i.preco_unitario
                ) ORDER BY i.id) FILTER (WHERE i.id IS NOT NULL), '[]') AS itens
           FROM orcamentos o
           LEFT JOIN clientes c ON c.id = o.cliente_id
           LEFT JOIN orcamento_itens i ON i.orcamento_id = o.id
           ${statusClause}
          GROUP BY o.id, c.id
          ORDER BY o.id DESC
          LIMIT $${values.length}`,
        values
      );
      res.json({ orcamentos: result.rows });
    } catch (error) {
      console.error("GET /api/orcamentos error", error);
      res.status(500).json({ error: "Não foi possível listar os orçamentos." });
    }
  });

  app.get("/api/relatorios/dia", async (req, res) => {
    try {
      const date = req.query.data ? String(req.query.data) : null;
      const result = await pool.query(
        `SELECT COUNT(*)::int AS quantidade,
                COALESCE(SUM(valor_total), 0)::numeric AS valor_total,
                COUNT(*) FILTER (WHERE status = 'enviado')::int AS enviados,
                COUNT(*) FILTER (WHERE status = 'aprovado')::int AS aprovados
           FROM orcamentos
          WHERE criado_em >= COALESCE($1::date, CURRENT_DATE)
            AND criado_em < COALESCE($1::date + INTERVAL '1 day', CURRENT_DATE + INTERVAL '1 day')`,
        [date]
      );
      res.json({ data: date || new Date().toISOString().slice(0, 10), kpis: result.rows[0] });
    } catch (error) {
      console.error("GET /api/relatorios/dia error", error);
      res.status(500).json({ error: "Não foi possível gerar o relatório diário." });
    }
  });

  app.post("/api/cutlists", async (req, res) => {
    const client = await pool.connect();
    try {
      const spec = normalizeSpec(req.body || {});
      const parts = generateParts(spec);
      await client.query("BEGIN");

      const materialResult = await client.query(
        "SELECT id FROM materiais WHERE nome = $1 AND espessura = $2 ORDER BY id LIMIT 1",
        [spec.material, spec.espessura]
      );
      const material = materialResult.rows[0] || (await client.query(
        "INSERT INTO materiais (nome, espessura, tipo) VALUES ($1, $2, $3) RETURNING id",
        [spec.material, spec.espessura, "MDF"]
      )).rows[0];

      const moduloResult = await client.query(
        `INSERT INTO modulos (nome, largura, altura, profundidade, parametros)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, nome, largura, altura, profundidade`,
        [spec.nome, spec.largura, spec.altura, spec.profundidade, JSON.stringify(spec.parametros)]
      );
      const modulo = moduloResult.rows[0];

      const persistedParts = [];
      for (const part of parts) {
        const result = await client.query(
          `INSERT INTO pecas (modulo_id, nome, largura, altura, espessura, quantidade, material_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, nome, largura, altura, espessura, quantidade`,
          [modulo.id, part.nome, part.largura, part.altura || part.profundidade, part.espessura, part.quantidade || 1, material.id]
        );
        persistedParts.push({ ...result.rows[0], profundidade: part.profundidade || null });
      }

      const totalArea = persistedParts.reduce((total, part) => {
        const area = Number(part.largura || 0) * Number(part.altura || 0) * Number(part.quantidade || 1);
        return total + area / 1000000;
      }, 0);
      const cutlistResult = await client.query(
        `INSERT INTO cutlists (modulo_id, total_area, formato_export)
         VALUES ($1, $2, $3) RETURNING id, modulo_id, total_area, formato_export, criado_em`,
        [modulo.id, totalArea, "CSV"]
      );
      const cutlist = cutlistResult.rows[0];

      for (const part of persistedParts) {
        await client.query(
          `INSERT INTO cutlist_items (cutlist_id, peca_id, largura, altura, quantidade)
           VALUES ($1, $2, $3, $4, $5)`,
          [cutlist.id, part.id, part.largura, part.altura, part.quantidade || 1]
        );
      }

      await client.query("COMMIT");
      res.status(201).json({ ok: true, modulo, cutlist, pecas: persistedParts });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("POST /api/cutlists error", error);
      res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : "Não foi possível salvar o cutlist." });
    } finally {
      client.release();
    }
  });
}

module.exports = { registerN8nRoutes };

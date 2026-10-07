import express from 'express';
import pg from 'pg';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const wrap = (f) => (req, res, next) => f(req, res, next).catch(next);

const JANELA_REPETIDO = '30 minutes'; // mesmo usuario + mesma tag: nao cria outro carimbo
const JANELA_TURMA = '4 minutes';     // "toque junto"
const MIN_TURMA = 3;

const app = express();
app.use(express.json());

// Identidade simples: o token fica no celular (sem senha). Trocar por link magico via WhatsApp depois.
const auth = wrap(async (req, res, next) => {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  const [u] = t ? await q('SELECT * FROM usuarios WHERE token=$1', [t]) : [];
  if (!u) return res.status(401).json({ erro: 'nao_autenticado' });
  req.u = u;
  next();
});

app.post('/api/entrar', wrap(async (req, res) => {
  const apelido = String(req.body.apelido || '').trim().slice(0, 30);
  if (apelido.length < 2) return res.status(400).json({ erro: 'apelido_curto' });
  let turma = null;
  if (req.body.turma) [turma] = await q('SELECT id FROM turmas WHERE codigo_convite=upper($1)', [String(req.body.turma).trim()]);
  const token = crypto.randomBytes(24).toString('hex');
  const [usuario] = await q(
    'INSERT INTO usuarios (apelido, token, turma_id) VALUES ($1,$2,$3) RETURNING id, apelido, turma_id',
    [apelido, token, turma?.id ?? null]);
  res.json({ token, usuario });
}));

const tagInfo = async (codigo) => (await q(
  `SELECT t.*, r.nome AS rota_nome, r.cor,
          (SELECT count(*)::int FROM tags WHERE rota_id = t.rota_id) AS total
   FROM tags t JOIN rotas r ON r.id = t.rota_id WHERE t.codigo = $1`, [codigo]))[0];

// Guardiao = quem mais passou no ponto nos ultimos 90 dias (desempate: quem chegou primeiro)
const guardiao = async (tagId) => (await q(
  `SELECT u.apelido, count(*)::int AS passagens
   FROM carimbos c JOIN usuarios u ON u.id = c.usuario_id
   WHERE c.tag_id = $1 AND c.criado_em > now() - interval '90 days'
   GROUP BY u.id ORDER BY passagens DESC, min(c.criado_em) LIMIT 1`, [tagId]))[0] ?? null;

// O toque na tag: registra o carimbo e devolve tudo que a tela precisa
app.post('/api/tags/:codigo/carimbar', auth, wrap(async (req, res) => {
  const t = await tagInfo(req.params.codigo);
  if (!t) return res.status(404).json({ erro: 'tag_inexistente' });
  const u = req.u;

  let [c] = await q(
    `SELECT * FROM carimbos WHERE usuario_id=$1 AND tag_id=$2
     AND criado_em > now() - interval '${JANELA_REPETIDO}' ORDER BY id DESC LIMIT 1`, [u.id, t.id]);
  const repetido = !!c;
  if (!c) [c] = await q(
    'INSERT INTO carimbos (usuario_id, tag_id, seed) VALUES ($1,$2,$3) RETURNING *',
    [u.id, t.id, crypto.randomInt(2 ** 31)]);

  // Toque junto: 3+ pessoas da mesma turma na mesma tag dentro da janela
  let turma = null;
  if (u.turma_id) {
    const m = await q(
      `SELECT DISTINCT c.usuario_id FROM carimbos c JOIN usuarios x ON x.id = c.usuario_id
       WHERE x.turma_id=$1 AND c.tag_id=$2 AND c.criado_em > now() - interval '${JANELA_TURMA}'`,
      [u.turma_id, t.id]);
    const formou = m.length >= MIN_TURMA;
    if (formou) {
      await q(`UPDATE carimbos SET especial='turma'
               WHERE tag_id=$1 AND criado_em > now() - interval '${JANELA_TURMA}' AND usuario_id = ANY($2)`,
        [t.id, m.map((x) => x.usuario_id)]);
      c.especial = 'turma';
    }
    turma = { presentes: m.length, necessarios: MIN_TURMA, formou };
  }

  const [{ feitos }] = await q(
    `SELECT count(DISTINCT c.tag_id)::int AS feitos FROM carimbos c JOIN tags x ON x.id = c.tag_id
     WHERE c.usuario_id=$1 AND x.rota_id=$2`, [u.id, t.rota_id]);
  const [{ hoje }] = await q(
    'SELECT count(*)::int AS hoje FROM carimbos WHERE tag_id=$1 AND criado_em::date = current_date', [t.id]);

  res.json({
    carimbo: { ...c, tag_nome: t.nome, ordem: t.ordem, forma: t.forma, parceiro: t.parceiro, cor: t.cor },
    rota: { nome: t.rota_nome, total: t.total, feitos },
    repetido, hoje, turma,
    guardiao: await guardiao(t.id),
    certificado: feitos >= t.total,
  });
}));

// A caderneta: cada rota com seus pontos e o ultimo carimbo da pessoa em cada um
app.get('/api/caderneta', auth, wrap(async (req, res) => {
  const rows = await q(
    `SELECT r.id AS rota_id, r.nome AS rota_nome, r.cor, r.km,
            t.nome AS tag_nome, t.ordem, t.forma, t.parceiro,
            c.id AS carimbo_id, c.criado_em, c.seed, c.especial
     FROM rotas r JOIN tags t ON t.rota_id = r.id
     LEFT JOIN LATERAL (SELECT * FROM carimbos WHERE usuario_id=$1 AND tag_id=t.id ORDER BY id DESC LIMIT 1) c ON true
     ORDER BY r.id, t.ordem`, [req.u.id]);
  const rotas = {};
  for (const x of rows) {
    const r = (rotas[x.rota_id] ??= { id: x.rota_id, nome: x.rota_nome, cor: x.cor, km: x.km, pontos: [] });
    r.pontos.push({
      ordem: x.ordem, tag_nome: x.tag_nome,
      carimbo: x.carimbo_id ? { id: x.carimbo_id, criado_em: x.criado_em, seed: x.seed, especial: x.especial,
        tag_nome: x.tag_nome, ordem: x.ordem, forma: x.forma, parceiro: x.parceiro, cor: x.cor } : null,
    });
  }
  res.json({
    usuario: { apelido: req.u.apelido },
    rotas: Object.values(rotas).map((r) => ({ ...r, completa: r.pontos.every((p) => p.carimbo) })),
  });
}));

app.get('/api/saude', (req, res) => res.json({ ok: true }));

// Em producao o mesmo processo serve o PWA (a URL gravada na tag e /t/CODIGO)
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((e, req, res, next) => { console.error(e); res.status(500).json({ erro: 'interno' }); });
app.listen(process.env.PORT || 3000, () => console.log('Caderneta no ar'));

CREATE TABLE IF NOT EXISTS turmas (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  codigo_convite TEXT UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  apelido TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  turma_id INT REFERENCES turmas(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rotas (
  id SERIAL PRIMARY KEY,
  nome TEXT UNIQUE NOT NULL,
  tipo TEXT NOT NULL,            -- caminhada | pedal
  cor TEXT NOT NULL,             -- urucum | anil | ocre | folha | jeni
  km NUMERIC
);
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,   -- vai na URL gravada na tag (/t/CODIGO)
  rota_id INT NOT NULL REFERENCES rotas(id),
  ordem INT NOT NULL,
  nome TEXT NOT NULL,
  forma TEXT NOT NULL DEFAULT 'c',  -- c (circulo) | r (retangulo)
  parceiro BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS carimbos (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id),
  tag_id INT NOT NULL REFERENCES tags(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  seed INT NOT NULL,             -- define pressao, textura e rotacao do carimbo
  especial TEXT                  -- null | 'turma'
);
CREATE INDEX IF NOT EXISTS carimbos_tag_tempo ON carimbos (tag_id, criado_em);
CREATE INDEX IF NOT EXISTS carimbos_usuario_tag ON carimbos (usuario_id, tag_id);

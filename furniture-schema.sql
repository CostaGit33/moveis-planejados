-- furniture-schema.sql - tabelas para módulos, peças, materiais e listas de corte

CREATE TABLE IF NOT EXISTS materiais (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  espessura NUMERIC, -- em mm
  tipo TEXT,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modulos (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  largura NUMERIC,
  altura NUMERIC,
  profundidade NUMERIC,
  parametros JSONB,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pecas (
  id SERIAL PRIMARY KEY,
  modulo_id INTEGER REFERENCES modulos(id) ON DELETE CASCADE,
  nome TEXT,
  largura NUMERIC,
  altura NUMERIC,
  espessura NUMERIC,
  quantidade INTEGER DEFAULT 1,
  material_id INTEGER REFERENCES materiais(id),
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cutlists (
  id SERIAL PRIMARY KEY,
  modulo_id INTEGER REFERENCES modulos(id) ON DELETE CASCADE,
  data_geracao TIMESTAMP DEFAULT NOW(),
  total_area NUMERIC,
  formato_export TEXT, -- e.g. CSV, DXF
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cutlist_items (
  id SERIAL PRIMARY KEY,
  cutlist_id INTEGER REFERENCES cutlists(id) ON DELETE CASCADE,
  peca_id INTEGER REFERENCES pecas(id),
  largura NUMERIC,
  altura NUMERIC,
  quantidade INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_modulos_nome ON modulos(nome);

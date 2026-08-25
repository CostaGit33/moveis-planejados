-- floorplanner-schema.sql - tabelas básicas para armazenar projetos Floorplanner

CREATE TABLE IF NOT EXISTS projetos_floorplanner (
  id SERIAL PRIMARY KEY,
  external_id TEXT,
  nome TEXT,
  raw_json JSONB,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fp_paredes (
  id SERIAL PRIMARY KEY,
  projeto_id INTEGER REFERENCES projetos_floorplanner(id) ON DELETE CASCADE,
  ref_id TEXT,
  comprimento NUMERIC,
  altura NUMERIC,
  start_point JSONB,
  end_point JSONB
);

CREATE TABLE IF NOT EXISTS fp_aberturas (
  id SERIAL PRIMARY KEY,
  projeto_id INTEGER REFERENCES projetos_floorplanner(id) ON DELETE CASCADE,
  ref_id TEXT,
  tipo TEXT,
  largura NUMERIC,
  altura NUMERIC,
  parede_ref_id TEXT
);

CREATE TABLE IF NOT EXISTS fp_mobiliario (
  id SERIAL PRIMARY KEY,
  projeto_id INTEGER REFERENCES projetos_floorplanner(id) ON DELETE CASCADE,
  ref_id TEXT,
  nome TEXT,
  x NUMERIC,
  y NUMERIC,
  width NUMERIC,
  depth NUMERIC,
  height NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_projetos_fp ON projetos_floorplanner(external_id);

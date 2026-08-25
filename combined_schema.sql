-- combined_schema.sql
-- Combina furniture-schema.sql, orcamento_moveis_schema.sql e floorplanner-schema.sql
-- Data: 2026-08-25

-- ==================================================================
-- Tabelas de materiais, módulos, peças e cutlists (furniture-schema.sql)
-- ==================================================================

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


-- ==================================================================
-- Tabelas de clientes e orçamentos (orcamento_moveis_schema.sql)
-- ==================================================================

CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT,
  endereco TEXT,
  email TEXT,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orcamentos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  numero_proposta TEXT,
  data TIMESTAMP DEFAULT NOW(),
  desconto NUMERIC DEFAULT 0,
  acrescimo NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'rascunho',
  valor_total NUMERIC DEFAULT 0,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orcamento_itens (
  id SERIAL PRIMARY KEY,
  orcamento_id INTEGER REFERENCES orcamentos(id) ON DELETE CASCADE,
  descricao TEXT,
  quantidade INTEGER DEFAULT 1,
  preco_unitario NUMERIC DEFAULT 0,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente ON orcamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_itens_orcamento ON orcamento_itens(orcamento_id);


-- ==================================================================
-- Tabelas para projetos Floorplanner (floorplanner-schema.sql)
-- ==================================================================

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

-- ==================================================================
-- Fim do combined_schema.sql
-- ==================================================================

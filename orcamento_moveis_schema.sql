-- orcamento_moveis_schema.sql - schema básico para PostgreSQL

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

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente ON orcamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_itens_orcamento ON orcamento_itens(orcamento_id);

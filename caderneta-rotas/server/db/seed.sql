INSERT INTO turmas (nome, codigo_convite) VALUES ('Pedal da Madrugada', 'PEDAL') ON CONFLICT DO NOTHING;
INSERT INTO rotas (nome, tipo, cor, km) VALUES ('Rota do Parque', 'caminhada', 'urucum', 6.2) ON CONFLICT DO NOTHING;
INSERT INTO tags (codigo, rota_id, ordem, nome, forma, parceiro)
SELECT v.codigo, r.id, v.ordem, v.nome, v.forma, v.parceiro
FROM rotas r, (VALUES
  ('k7x2m9', 1, 'Entrada',        'c', false),
  ('r4t8w3', 2, 'Pista',          'r', false),
  ('b6n1c5', 3, 'Lago',           'c', false),
  ('h9z2d7', 4, 'Padaria do Zé',  'o', true)
) AS v(codigo, ordem, nome, forma, parceiro)
WHERE r.nome = 'Rota do Parque'
ON CONFLICT DO NOTHING;

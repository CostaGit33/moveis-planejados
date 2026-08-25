# EXEMPLOS_API.md

## Listar clientes
GET http://localhost:3000/api/clientes

## Criar cliente
POST http://localhost:3000/api/clientes
Content-Type: application/json

{
  "nome": "João Silva",
  "telefone": "(77) 99999-9999",
  "endereco": "Rua A, 123",
  "email": "joao@exemplo.com"
}

## Criar orçamento (exemplo)
POST http://localhost:3000/api/orcamentos
Content-Type: application/json

{
  "cliente_id": 1,
  "numero_proposta": "PROP-001-2026",
  "desconto": 10,
  "itens": [
    { "descricao": "Porta de Alumínio", "quantidade": 2, "preco_unitario": 1700 },
    { "descricao": "Kit Espelho", "quantidade": 1, "preco_unitario": 500 }
  ]
}

## Obter orçamento completo
GET http://localhost:3000/api/orcamentos/1

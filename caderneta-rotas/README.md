# Caderneta de Rotas

PWA mobile-first para registrar carimbos em tags de rotas, com carimbos SVG generativos, progresso por rota, guardião do ponto e carimbo coletivo da turma.

## Estrutura

- `server/`: API Express e inicialização/seed do PostgreSQL.
- `client/`: frontend React + Vite, servido como PWA.
- `docker-compose.yml`: PostgreSQL local para desenvolvimento.

## Executar localmente

```bash
cp server/.env.example server/.env
npm run setup
docker compose up -d db
npm run db:init
npm run dev:server
```

Em outro terminal:

```bash
npm run dev:client
```

Abra a URL do Vite. A rota de exemplo usa o código `k7x2m9`; a turma de demonstração usa `PEDAL`.

## Produção

```bash
npm run setup
npm run build
npm start
```

O servidor serve `client/dist` e escuta `PORT` (padrão `3000`). Defina `DATABASE_URL` para um PostgreSQL persistente. Não versione `server/.env`.

## Observações

- A autenticação atual usa um token anônimo armazenado no dispositivo; o próprio código sinaliza a futura substituição por link mágico.
- O script original tinha um heredoc de Python inválido para gerar os ícones. A versão publicada corrige esse trecho e mantém os PNGs gerados no projeto.

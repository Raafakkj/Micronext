# Micronext Kanban (Vercel + Backend)

Projeto com front-end estatico e backend serverless para centralizar os dados de:
- Kanban
- Sprints
- Chat
- Logs
- Comunidade
- Usuarios e perfis

## Seguranca de senhas
- Senhas novas sao salvas com hash PBKDF2-SHA256 + salt.
- Usuarios antigos em texto puro sao migrados automaticamente apos login.

## Rotas backend
- `GET /api/categories`: lista as categorias de dados do projeto.
- `GET /api/data`: retorna o estado completo.
- `PUT /api/data`: substitui o estado completo.
- `PATCH /api/data`: atualiza parcialmente o estado.
- `GET /api/data/[category]`: retorna uma categoria especifica.
- `PUT/PATCH /api/data/[category]`: atualiza categoria especifica.
- `DELETE /api/data/[category]`: reseta categoria para o padrao.

## Persistencia em producao (Vercel)
Para persistencia real entre execucoes, configure Vercel KV:
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

Sem KV:
- Em ambiente local: salva em `.micronext-state.json`.
- Em runtime serverless sem KV: usa memoria efemera.

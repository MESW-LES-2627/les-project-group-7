# Tarefas e Separação de Responsabilidades (Protótipo de Sexta-feira)

> **Objetivo de Sexta-feira:** Protótipo vertical (*tracer bullet*) funcional.  
> Uma base de dados PostgreSQL em Docker, mapa com pins clicáveis e ligação direta backend-frontend.

---

## 👤 Dev 1: João Pacheco (Backend & Base de Dados)

* **Objetivo:** Garantir a infraestrutura de dados e os endpoints da API para servir o frontend.
* **Tarefas:**
  1. Subir o PostgreSQL local em Docker: `docker compose up -d`
  2. Aplicar as migrações Prisma: `npx prisma migrate dev`
  3. Criar os endpoints REST no Express:
     - `GET /api/places?city=Porto`: Devolve a lista de locais com coordenadas, categoria, rating e nível de preço.
     - `POST /api/reviews`: Recebe `{ placeId, rating, priceLevel, text }`, grava a review e atualiza o `averageRating` e `priceLevel` do local usando as funções do Dev 2.
* **Ficheiros:** `docker-compose.yml`, `backend/src/server.ts`, `backend/src/routes/`

---

## 👤 Dev 2: Lógica de Domínio & TDD

* **Objetivo:** Desenvolver as funções puras de cálculo e regras de negócio com testes automatizados (sem depender de base de dados ou frontend).
* **Tarefas:**
  1. `calculateAverageRating(ratings: number[])`: Média aritmética arredondada a 1 casa decimal.
  2. `calculatePriceLevelMode(levels: PriceLevel[])`: Moda dos níveis de preço (`FREE`, `€`, `€€`, `€€€`), desempatando para o mais barato.
  3. `calculateAverageCostPoints(stops)`: Média de pontos de custo (`FREE=0`, `€=1`, `€€=2`, `€€€=3`) para o orçamento suave.
  4. `haversineDistanceKm()` e `estimateWalkingMinutes()`: Distância geográfica e tempo a pé.
  5. Garantir que `npm test` passa a 100% no Vitest.
* **Ficheiros:** `backend/src/domain/rating.ts`, `backend/src/domain/geo.ts`, e respetivos ficheiros `.test.ts`.

---

## 👤 Dev 3: Dados & Seed do OpenStreetMap

* **Objetivo:** Popular a base de dados com locais reais do Porto para que a equipa não use dados falsos ou vazios na demo.
* **Tarefas:**
  1. Criar o script `backend/prisma/seed.ts` com ~10 a 15 locais emblemáticos do Porto (Clérigos, Livraria Lello, Serralves, Casa da Música, Ribeira, etc.).
  2. Preencher com coordenadas reais (`lat`/`lon`) e categorias corretas (`MUSEUM`, `MONUMENT`, `PARK`, `RESTAURANT`).
  3. Mapear locais sem bilhete para `priceLevel: "FREE"` (ex: miradouros e jardins).
  4. Inserir algumas reviews de exemplo para os rankings terem dados desde o primeiro minuto.
  5. Comando de execução: `npm run seed`
* **Ficheiros:** `backend/prisma/seed.ts`

---

## 👤 Dev 4: Frontend & Mapa Interativo

* **Objetivo:** Interface visual com mapa Leaflet que consome os dados do backend.
* **Tarefas:**
  1. Criar o ecrã principal com o mapa Leaflet centrado no Porto (`[41.1579, -8.6291]`).
  2. Fazer `fetch('/api/places?city=Porto')` e desenhar os pins nas coordenadas de cada local.
  3. Ao clicar num pin, abrir um cartão lateral/modal com:
     - Nome do local, categoria, badge de preço (`FREE`, `€`, `€€`, `€€€`) e estrelas de rating.
     - Formulário simples para submeter uma nova review (`POST /api/reviews`).
* **Ficheiros:** `frontend/src/App.tsx`, `frontend/src/components/Map.tsx`

---

## 🔗 Ponto de Encontro de Sexta-feira (Integração)

1. Dev 1 corre `docker compose up -d` e sobe a API.
2. Dev 3 corre `npm run seed` para carregar os locais do Porto.
3. Dev 4 abre o browser em `http://localhost:3000`.
4. Clicamos num pin (ex: Torre dos Clérigos), vemos os dados da base de dados e adicionamos uma review que atualiza o rating no ecrã.

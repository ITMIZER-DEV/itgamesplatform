# ITGames Arena API 🚀 (Backend NestJS & PostgreSQL)

Backend robusto, modular e auditável para a plataforma **ITGames Arena**, projetado para suportar competições de **CrossFit** e **HYROX** com upload de fotos de súmulas de campo, rastreabilidade imutável e gestão de baterias/raias.

---

## 🐳 Execução com Docker (Recomendado)

Suba o banco PostgreSQL e a API em apenas 1 comando:

```bash
cd itgames-api
docker compose up -d
```

- **API Endpoint:** `http://localhost:3333` ou `http://<SEU_IP_OU_IP_VPN>:3333`
- **Documentação Swagger Interativa:** `http://localhost:3333/api-docs`
- **Banco PostgreSQL 18 Local:** `localhost:5433` (Usuário: `itgames_user`, Senha: `itgames_password`, DB: `itgames_db`)

---

## 💻 Execução Local (Node.js & npm)

1. Instale as dependências:
   ```bash
   cd itgames-api
   npm install
   ```

2. Gere o cliente Prisma:
   ```bash
   npx prisma generate
   ```

3. Inicie em modo de desenvolvimento (com hot-reload):
   ```bash
   npm run start:dev
   ```

---

## 🛡️ Funcionalidades e Endpoints Principais

| Módulo | Endpoint | Descrição |
|---|---|---|
| **Scores & Súmulas** | `POST /scores` | Lança ou retifica score com suporte a fotos de súmula de campo e cálculo automático de pontos. |
| **Fotos de Súmula** | `PATCH /scores/:code/photo` | Anexa foto da prancheta física de papel para auditoria. |
| **Baterias & Raias** | `POST /heats/generate` | Algoritmo de auto-alocação de baterias e raias da arena. |
| **Quadro de Baterias** | `GET /heats/game/:gameCode/workout/:workoutCode` | Consulta do cronograma de arena e status de chamada. |
| **Auditoria Imutável** | `GET /audit/game/:gameCode` | Trilha de auditoria em tempo real com histórico de quem alterou, quando e por qual motivo. |
| **Documentação** | `GET /api-docs` | Interface gráfica OpenAPI / Swagger para teste de todos os endpoints. |

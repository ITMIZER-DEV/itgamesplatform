# Organizadores, área restrita e liberação de campeonatos — Design

**Data:** 2026-10-05
**Escopo:** `itgames-api` (NestJS + Prisma) e `itgames-platform` (Next.js)
**Status:** aguardando revisão do usuário

## 1. Objetivo

Liberar o cadastro de campeonatos e as inscrições de atletas com segurança real:

- O **super admin** cadastra organizadores (nome, e-mail, telefone).
- O **organizador** acessa uma área restrita e cadastra campeonatos, que ficam em `draft` até o super admin liberar a execução (`live`).
- Um campeonato pode ter **mais de um organizador**; um organizador pode ter vários campeonatos.

## 2. Estado atual (problemas que este design resolve)

| # | Problema | Onde |
|---|----------|------|
| 1 | Papel (Super Admin/Organizador) escolhido por botão no navegador, sem consulta à API | `itgames-platform/src/app/admin/page.tsx` (`userRole`) |
| 2 | Nenhuma rota de `events` exige login; todas com `@Public()`. Sem `APP_GUARD` global | `events.controller.ts` |
| 3 | `scores`, `heats` e `audit` ficam abertos por ausência de guard | controllers |
| 4 | `POST /auth/register` aceita `role` livre (qualquer um vira `SUPER_ADMIN`) | `auth.service.ts` |
| 5 | `Game.organizerId` único: um organizador por campeonato | `schema.prisma` |
| 6 | `listGames` só filtra por organizador se o cliente mandar `role=ORGANIZER` | `events.service.ts` |
| 7 | `JWT_SECRET` com valor padrão fixo no código | `auth.module.ts`, `jwt.strategy.ts` |
| 8 | `api-client` não envia `Authorization` | `api-client.ts` |

## 3. Decisões tomadas

- **Modelo:** tabela de vínculo `GameOrganizer` (N:N), sem "dono principal". Todos os organizadores de um campeonato têm o mesmo poder sobre ele.
- **Primeiro acesso:** senha temporária gerada pelo sistema, exibida uma única vez ao super admin, com troca obrigatória no primeiro login. O convite por e-mail fica para depois e encaixa no mesmo fluxo.
- **Quem cria organizador:** somente o super admin.
- **Cadastro público:** cria apenas `ATHLETE`.

## 4. Dados (API)

### 4.1 Novo modelo

```prisma
model GameOrganizer {
  gameCode  String
  userId    String
  createdAt DateTime @default(now())

  game Game @relation(fields: [gameCode], references: [code], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([gameCode, userId])
  @@map("games_organizers")
}
```

### 4.2 Alterações

- `User`: adiciona `mustChangePassword Boolean @default(false)` e a relação `organizedGames GameOrganizer[]`. Remove `managedGames` (`Game[]` da relação `OrganizerGames`).
- `Game`: remove `organizerId` e a relação `organizer`; adiciona `organizers GameOrganizer[]`.
- Papéis válidos continuam: `SUPER_ADMIN`, `ORGANIZER`, `JUDGE`, `ATHLETE`.

### 4.3 Migração dos dados existentes

O projeto usa `prisma db push`, sem histórico de migrations. Como existem campeonatos cadastrados manualmente, a troca **não pode** ser feita com `db push` direto (ele removeria `organizerId` e perderia os vínculos). Ordem:

1. Adicionar `GameOrganizer` e `mustChangePassword` mantendo `organizerId`.
2. Script SQL único: `INSERT INTO games_organizers (gameCode, userId) SELECT code, organizerId FROM games WHERE organizerId IS NOT NULL`.
3. Conferir a contagem de vínculos contra a de campeonatos com organizador.
4. Só então remover `organizerId` do schema e aplicar.

Nenhum comando destrutivo (`migrate reset`, `DROP`) é usado; vale a regra do skill `no-db-reset`. Antes do passo 1, fazer `pg_dump` do banco.

## 5. Autenticação e autorização (API)

### 5.1 Guard global

- `JwtAuthGuard` registrado como `APP_GUARD`, seguido de `RolesGuard` também global. Tudo exige JWT, exceto o que tiver `@Public()`.
- Unificar `Public` e `IS_PUBLIC_KEY`: hoje existem duas definições (`public.decorator.ts` e `roles.decorator.ts`). Mantém uma só.
- `JWT_SECRET` obrigatório: a API falha ao iniciar se não estiver definido. O valor padrão fixo é removido. O `docker-compose.yml` passa a receber a variável.
- CORS: `CORS_ORIGIN` deixa de ser `*` com `credentials: true`; lista explícita de origens vinda da variável.

### 5.2 Matriz de permissões

| Rota | Acesso |
|------|--------|
| `POST /auth/login` | público |
| `POST /auth/register` | público; cria somente `ATHLETE` (campo `role` ignorado) |
| `POST /auth/change-password` | autenticado |
| `GET /auth/me` | autenticado |
| `GET /events` | público; só campeonatos `live` |
| `GET /events/mine` | `ORGANIZER`/`SUPER_ADMIN`; organizador vê os seus (qualquer status), super admin vê todos |
| `GET /events/:code` | público se `live`; se `draft`/`blocked`, só organizador vinculado ou super admin |
| `POST /events` | `ORGANIZER`/`SUPER_ADMIN`; nasce `draft`; criador é vinculado |
| `PUT /events/:code`, categorias, workouts | organizador vinculado ou super admin |
| `PATCH /events/:code/status` | **somente** `SUPER_ADMIN` |
| `DELETE /events/:code` | **somente** `SUPER_ADMIN` |
| `POST /events/:code/organizers`, `DELETE /events/:code/organizers/:userId` | **somente** `SUPER_ADMIN` |
| `POST /events/:code/registrations` | público/atleta autenticado; **só se o campeonato está `live`** |
| `GET /events/:code/registrations` | organizador vinculado ou super admin |
| `POST /users/organizers`, `GET /users/organizers`, `POST /users/organizers/:id/reset-password` | **somente** `SUPER_ADMIN` |
| `scores`, `heats`, `audit` | `JUDGE`/`ORGANIZER` vinculado/`SUPER_ADMIN` (detalhe abaixo) |

### 5.3 Verificação de vínculo

Novo `GameAccessGuard` (ou helper `assertCanManage(user, gameCode)` no `EventsService`): super admin passa; organizador passa se existir linha em `GameOrganizer`; caso contrário `403`. Aplicado em toda rota de escrita que recebe `:code` ou `gameCode`, incluindo `heats` (`generate`, `swap-lanes`, status) e `scores`.

Para `scores`, `JUDGE` pode lançar score; a ligação juiz↔campeonato **não** é tratada aqui (hoje o juiz usa PIN no frontend, sem entidade na API). Nesta fase: score exige JWT com papel `JUDGE`, `ORGANIZER` vinculado ou `SUPER_ADMIN`. O vínculo juiz↔campeonato fica para a rodada de sincronização de scores.

### 5.4 Regras de status

- `createGame` ignora `dto.status`: sempre `draft`.
- `updateGame` (PUT) ignora `status`; só o endpoint de status altera.
- Valores aceitos em `PATCH /status`: `live`, `draft`, `blocked`. Validados em classe DTO com `class-validator`.
- Organizador edita livremente em `draft` e continua gerenciando em `live`, mas não altera o status.
- Inscrição em campeonato não `live`: `400` com mensagem "Inscrições indisponíveis: campeonato não liberado".

## 6. Fluxo do super admin: cadastrar organizador

`POST /users/organizers` com `{ name, email, phoneNumber }` (DTO validado, e-mail único):

1. Gera senha temporária aleatória (12 caracteres, `crypto.randomBytes`).
2. Cria `User` com `role = ORGANIZER`, `passwordHash` (bcrypt) e `mustChangePassword = true`.
3. Retorna `{ user, temporaryPassword }`. A senha **não é armazenada em claro** e só aparece nessa resposta.
4. `POST /users/organizers/:id/reset-password` gera nova senha temporária e marca `mustChangePassword = true` (caso o organizador perca o acesso).

Remove a lógica atual de `tenantOrgId = org-<email>` no registro, que passa a ser irrelevante para o isolamento (o isolamento passa a ser por `GameOrganizer`). A coluna `tenantOrgId` permanece no schema sem uso, para não ampliar o escopo.

### Troca obrigatória de senha

- O JWT inclui `mustChangePassword`.
- Um guard global bloqueia, com `403 { code: 'PASSWORD_CHANGE_REQUIRED' }`, toda rota exceto `GET /auth/me` e `POST /auth/change-password` enquanto o flag for verdadeiro.
- `POST /auth/change-password` `{ currentPassword, newPassword }`: valida a senha atual, exige mínimo de 8 caracteres e diferente da atual, zera o flag e devolve novo token.

## 7. Frontend (`itgames-platform`)

- **Sessão:** a fonte da verdade do papel passa a ser o JWT (campos de `localStorage` apenas como cache de exibição). `getCurrentUserSession` decodifica o token e considera expiração. Unifica as chaves de token (`itgames_auth_token` e `itgames_jwt_token` hoje coexistem) numa só.
- **`api-client`:** envia `Authorization: Bearer` em todas as chamadas; passa a diferenciar erro (lançar exceção com status e mensagem) de resposta vazia, em vez de devolver `null` silenciosamente nas rotas de escrita de campeonato, organizador e status. Em `401`, limpa a sessão e redireciona ao login. Em `PASSWORD_CHANGE_REQUIRED`, redireciona para a troca de senha.
- **`AuthUserModal`:** usa `apiClient` e `NEXT_PUBLIC_API_URL` no lugar da URL fixa `http://localhost:3334`.
- **`/admin`:**
  - Remove o botão de alternar papel; o painel renderiza conforme o papel do token.
  - Super admin: aba "Campeonatos & Liberações" (todos, liberar/bloquear/excluir, gerenciar organizadores do campeonato) e nova aba/seção "Organizadores" (listar, cadastrar com nome/e-mail/telefone, exibir senha temporária uma vez com botão copiar, redefinir senha).
  - Organizador: apenas "Meus campeonatos" (`GET /events/mine`), com criação de campeonato (sempre rascunho) e as abas de gestão dos seus campeonatos. Vê o status de liberação, sem ações de liberar/excluir.
- **Nova rota `/trocar-senha`:** tela de troca obrigatória no primeiro acesso.
- **Inscrição de atleta:** a tela passa a listar somente campeonatos `live` (vindo de `GET /events`).
- O `AclGuard` permanece como camada de experiência de uso; a API impõe as regras.

## 8. Fora do escopo desta fase

Convite por e-mail (SMTP), sincronização de scores e leaderboard via API, ligação juiz↔campeonato, Pix real, upload de fotos em storage, migrations versionadas do Prisma, quebra do `admin/page.tsx` em componentes. Seguem na ordem de prioridade da análise anterior.

## 9. Testes

Testes e2e da API (Jest + supertest) com banco de teste:

- Sem token: `POST /events` → 401; `GET /events` → só `live`.
- Atleta: `POST /events` → 403.
- Organizador A não edita, não vê em `GET /events/:code` (se `draft`) e não gera baterias em campeonato do organizador B → 403.
- Dois organizadores vinculados ao mesmo campeonato editam ambos.
- Organizador não altera status nem exclui → 403; super admin altera.
- `POST /auth/register` com `role: 'SUPER_ADMIN'` cria `ATHLETE`.
- Inscrição em campeonato `draft` → 400; em `live` → sucesso.
- Criar organizador devolve senha temporária; login com ela funciona; qualquer rota (exceto `me` e troca) → 403 `PASSWORD_CHANGE_REQUIRED`; após trocar, acesso normal.
- Migração: script de cópia `organizerId` → `GameOrganizer` verificado em banco com dados de exemplo.

No frontend: verificação manual do fluxo completo (super admin cadastra organizador, organizador troca senha, cria campeonato em rascunho, super admin libera, atleta vê o campeonato e se inscreve).

## 10. Riscos

- **Migração de dados:** mitigada com dump prévio, ordem em quatro passos e conferência de contagem (seção 4.3).
- **Fechar a API quebra telas que dependem de rotas abertas:** o frontend usa `leaderboard`, `heats` e `judge` com chamadas sem token. A fase inclui o envio do token em todas as chamadas; telas só locais (`leaderboard`, `sumulas`) não são afetadas.
- **Juiz sem conta na API:** o app do juiz usa PIN local. Com `scores` exigindo JWT, o lançamento do juiz na API passa a falhar até haver login de juiz. **Decisão (aprovada):** exigir login de juiz nesta fase (o seed já tem `judge@itgames.com.br`). A tela do juiz passa a autenticar na API e enviar o token ao lançar score; o PIN local continua apenas como atalho de seleção de raia/juiz após o login.

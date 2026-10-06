# Organizadores, área restrita e liberação de campeonatos — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar a API com JWT e papéis, permitir vários organizadores por campeonato, cadastro de organizadores pelo super admin (senha temporária) e liberação (`draft` → `live`) somente pelo super admin, com a área restrita do organizador no frontend.

**Architecture:** Guards globais no NestJS (JWT opcional em rotas `@Public`, troca obrigatória de senha, papéis) mais um `GameAccessService` que decide se um usuário gerencia/visualiza um campeonato via tabela `GameOrganizer` (N:N). O frontend passa a derivar o papel do JWT, envia `Authorization` em todas as chamadas e deixa de cair em mocks/localStorage para campeonatos.

**Tech Stack:** NestJS 10, Prisma 5, PostgreSQL 18, Jest + supertest (e2e), Next.js 16.3 / React 19, Tailwind 4, sonner.

**Spec:** `docs/superpowers/specs/2026-10-05-organizadores-e-liberacao-design.md`

## Convenções de execução

- **Diretórios:** API em `D:\Projects\fitness\itgames\itgames-api`, frontend em `D:\Projects\fitness\itgames\itgames-platform`. Todos os comandos abaixo indicam o diretório.
- **Git:** o projeto **não é um repositório git**. Onde um plano normal teria `commit`, aqui o passo final de cada tarefa é "marcar os checkboxes". Se o usuário rodar `git init`, faça um commit ao fim de cada tarefa (`feat: ...`).
- **Banco real:** `itgames_db` (container `itgames-postgres`, porta host `5433`). **Nunca** use `migrate reset`, `db push --force-reset` nem `DROP` (skill `no-db-reset`). Testes usam um banco separado, `itgames_test`.
- **Shell:** os comandos usam sintaxe bash (Git Bash). No PowerShell, troque redirecionamentos conforme necessário.
- **Next.js 16:** o `itgames-platform/CLAUDE.md` avisa que esta versão tem mudanças incompatíveis. Antes de criar a página `/trocar-senha` (Task 9), leia o guia de rotas/páginas em `itgames-platform/node_modules/next/dist/docs/` e confirme que o padrão de página `'use client'` usado nas páginas existentes continua válido (as páginas atuais `src/app/login/page.tsx` etc. são o modelo).

### Desvios deliberados do spec (aprovar na revisão do plano)

1. **`mustChangePassword` lido do banco, não do JWT.** O `JwtStrategy.validate` consulta o usuário a cada requisição. Assim, "redefinir senha" por um super admin e remoção/alteração de papel valem imediatamente, sem esperar o token expirar. Custa uma query por requisição.
2. **Super admin que cria campeonato não é vinculado como organizador** (ele já acessa tudo). O vínculo automático vale para `ORGANIZER`. O campeonato criado por super admin fica sem organizadores até ele adicionar algum.
3. **Senha atual incorreta em `change-password` retorna 400** (não 401), porque o frontend trata 401 como sessão expirada e deslogaria o usuário.
4. **`AuthUserModal.tsx` é removido** (código morto, nunca importado, com URL fixa e contas de teste).

## Global Constraints

- Papéis válidos: `SUPER_ADMIN`, `ORGANIZER`, `JUDGE`, `ATHLETE`.
- Status de campeonato: somente `live`, `draft`, `blocked`. Todo campeonato novo nasce `draft`; `POST /events` e `PUT /events/:code` ignoram o campo `status`.
- Somente `SUPER_ADMIN` altera status (`PATCH /events/:code/status`), exclui (`DELETE /events/:code`), cria/lista/redefine organizadores (`/users/organizers...`) e vincula/desvincula organizadores (`/events/:code/organizers...`).
- Senha temporária: 12 caracteres via `crypto.randomBytes`, devolvida **uma única vez** na resposta, nunca armazenada em claro. Nova senha: mínimo 8 caracteres e diferente da atual.
- Código de erro de troca obrigatória: `403` com corpo `{ "code": "PASSWORD_CHANGE_REQUIRED", "message": "..." }`. Só `GET /auth/me` e `POST /auth/change-password` ficam liberados nesse estado.
- Tabela do vínculo: `games_organizers` (`@@map`), chave composta `(gameCode, userId)`.
- `JWT_SECRET` obrigatório (a API não sobe sem ele). `CORS_ORIGIN` é uma lista de origens separadas por vírgula, nunca `*`.
- `GET /events` público lista somente `live`. `GET /events/:code`, categorias e WODs de campeonato não-`live` só para organizador vinculado ou super admin (outros recebem 404). Inscrição só em campeonato `live` (400 "Inscrições indisponíveis: campeonato não liberado").
- Mensagens ao usuário em português do Brasil, com acentuação correta.

## Review Focus

Entradas/condições que o spec implica mas que nenhuma regra explícita cobre. Cada uma tem seu teste na tarefa indicada:

1. Token inválido/expirado enviado a uma rota pública deve ser tratado como visitante anônimo (200 em campeonato `live`), não 401. → Task 5.
2. E-mail com espaços e maiúsculas ao cadastrar organizador e ao fazer login (`"  Org@X.com "`) deve funcionar e detectar duplicata. → Task 4.
3. Organizador desvinculado de um campeonato perde o acesso na hora (sem cache em token). → Task 5.
4. Redefinir a senha de um organizador com sessão ativa obriga a troca com o token antigo. → Task 4.
5. Excluir campeonato remove os vínculos em `games_organizers` mas **não** apaga o usuário organizador. → Task 5.

## Estrutura de arquivos

**API (`itgames-api`)**

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `prisma/schema.prisma` | Modificar | `GameOrganizer`, `User.mustChangePassword`; (Task 8) remove `Game.organizerId` |
| `src/app.setup.ts` | Criar | `configureApp(app)`: body limit, CORS por lista, interceptor LGPD, `ValidationPipe` (usado por `main.ts` e pelos testes) |
| `src/main.ts` | Modificar | Usa `configureApp` |
| `src/app.module.ts` | Modificar | Registra `APP_GUARD` (JWT → troca de senha → papéis) e `AccessModule`, `UsersModule` |
| `src/common/types/auth-user.ts` | Criar | Tipo `AuthUser` |
| `src/common/decorators/current-user.decorator.ts` | Criar | `@CurrentUser()` |
| `src/common/decorators/allow-pending-password-change.decorator.ts` | Criar | Libera rota durante troca obrigatória |
| `src/common/decorators/roles.decorator.ts` | Modificar | Remove duplicata de `Public` |
| `src/common/guards/jwt-auth.guard.ts` | Modificar | JWT obrigatório, opcional em `@Public` |
| `src/common/guards/password-change.guard.ts` | Criar | Bloqueia rotas durante troca obrigatória |
| `src/common/utils/temporary-password.ts` | Criar | Gerador de senha temporária |
| `src/common/access/game-access.service.ts` + `access.module.ts` | Criar | `canManage`, `assertCanManage`, `assertCanView` |
| `src/modules/auth/*` | Modificar | JWT_SECRET obrigatório, strategy lê do banco, register só ATHLETE, change-password |
| `src/modules/users/*` | Criar | Organizadores (criar/listar/redefinir senha) |
| `src/modules/events/*` | Modificar | Permissões, `/mine`, status, organizadores, regra `live` |
| `src/modules/heats/*`, `scores/*`, `audit/*` | Modificar | Papéis + vínculo; auditoria com identidade do token |
| `prisma/seed.ts`, `prisma/seed.js` | Modificar | Vínculo `GameOrganizer` no lugar de `organizerId` |
| `test/**` | Criar | Infra e testes e2e |
| `../docker-compose.yml`, `../.env` | Modificar/Criar | `JWT_SECRET`, `CORS_ORIGIN` |

**Frontend (`itgames-platform`)**

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/lib/acl.ts` | Modificar | Sessão única derivada do JWT, `saveSession`, `getAuthToken`, `homeForRole` |
| `src/lib/api-client.ts` | Modificar | `Authorization`, `ApiError`, modo estrito, métodos novos |
| `src/components/auth/AuthUserModal.tsx` | Excluir | Código morto |
| `src/components/auth/AclGuard.tsx` | Modificar | Redireciona para `/trocar-senha` |
| `src/app/login/page.tsx` | Modificar | Remove fallbacks que concediam papel sem senha |
| `src/app/trocar-senha/page.tsx` | Criar | Troca obrigatória de senha |
| `src/components/admin/OrganizersPanel.tsx` | Criar | Aba "Organizadores" do super admin |
| `src/components/admin/GameOrganizersModal.tsx` | Criar | Vincular/desvincular organizadores de um campeonato |
| `src/app/admin/page.tsx` | Modificar | Papel vem da sessão, sem toggle; `listMyGames`; sem fallback mock para campeonatos; novas abas |
| `src/app/athlete/page.tsx`, `src/app/athlete/register/page.tsx` | Modificar | Só campeonatos da API; erro de inscrição visível |
| `src/app/judge/page.tsx` | Modificar | Erro de envio de score visível |
| `src/types/index.ts` | Modificar | `organizers` no `GameEvent` |

---

## Task 1: Schema aditivo (`GameOrganizer` + `mustChangePassword`) e cópia dos vínculos

**Files:**
- Modify: `itgames-api/prisma/schema.prisma`
- Create: `itgames-api/prisma/sql/2026-10-05-copy-organizers.sql`
- Create: `backups/` (pasta em `D:\Projects\fitness\itgames\backups`)

**Interfaces:**
- Produces: modelo Prisma `GameOrganizer` (`gameCode`, `userId`, `createdAt`; chave `gameCode_userId`), campo `User.mustChangePassword: boolean`, relações `Game.organizers`, `User.organizedGames`. `Game.organizerId`/`organizer` e `User.managedGames` **continuam** até a Task 8.

- [ ] **Step 1: Backup do banco real**

```bash
cd /d/Projects/fitness/itgames && mkdir -p backups && docker exec itgames-postgres pg_dump -U itgames_user itgames_db > backups/itgames_db-pre-organizers-2026-10-05.sql && ls -la backups/ && head -5 backups/itgames_db-pre-organizers-2026-10-05.sql
```
Expected: arquivo com mais de alguns KB e cabeçalho `-- PostgreSQL database dump`. Se o container não estiver rodando, `docker compose up -d postgres` na raiz e repetir. **Não prossiga sem o backup.**

- [ ] **Step 2: Editar o schema**

Em `itgames-api/prisma/schema.prisma`:

No `model User`, adicione após `phoneNumber`:
```prisma
  mustChangePassword Boolean    @default(false)
```
e, junto das relações (após `managedGames  Game[]         @relation("OrganizerGames")`):
```prisma
  organizedGames GameOrganizer[]
```

No `model Game`, junto das relações (após `auditLogs             AuditLog[]`):
```prisma
  organizers            GameOrganizer[]
```

Ao final do arquivo, adicione:
```prisma
// Vínculo N:N entre campeonato e organizadores
model GameOrganizer {
  gameCode  String
  userId    String
  createdAt DateTime @default(now())

  game      Game     @relation(fields: [gameCode], references: [code], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([gameCode, userId])
  @@map("games_organizers")
}
```

- [ ] **Step 3: Aplicar no banco real (somente adições) e regenerar o client**

```bash
cd /d/Projects/fitness/itgames/itgames-api && npx prisma db push && npx prisma generate
```
Expected: `Your database is now in sync with your Prisma schema` sem aviso de perda de dados (mudança só adiciona tabela e coluna com default). Se aparecer aviso de `data loss`, **pare** e avise o usuário.

- [ ] **Step 4: Criar o script de cópia dos vínculos**

Crie `itgames-api/prisma/sql/2026-10-05-copy-organizers.sql`:
```sql
-- Copia o organizador único atual de cada campeonato para a tabela de vínculo.
INSERT INTO games_organizers ("gameCode", "userId")
SELECT "code", "organizerId"
FROM games
WHERE "organizerId" IS NOT NULL
ON CONFLICT DO NOTHING;
```

- [ ] **Step 5: Executar o script e conferir a contagem**

```bash
cd /d/Projects/fitness/itgames/itgames-api && docker exec -i itgames-postgres psql -U itgames_user -d itgames_db < prisma/sql/2026-10-05-copy-organizers.sql && docker exec itgames-postgres psql -U itgames_user -d itgames_db -c "SELECT (SELECT count(*) FROM games WHERE \"organizerId\" IS NOT NULL) AS campeonatos_com_organizador, (SELECT count(*) FROM games_organizers) AS vinculos;"
```
Expected: as duas colunas com o mesmo número.

- [ ] **Step 6: Verificar que a API ainda compila**

```bash
cd /d/Projects/fitness/itgames/itgames-api && npm run build
```
Expected: build conclui sem erro (nenhum código usa os campos novos ainda).

- [ ] **Step 7: Marcar checkboxes desta tarefa.**

---

## Task 2: Infra de testes e2e e `configureApp`

**Files:**
- Modify: `itgames-api/package.json` (scripts e devDependencies)
- Create: `itgames-api/test/jest-e2e.json`
- Create: `itgames-api/test/setup/test-env.ts`
- Create: `itgames-api/test/setup/global-setup.ts`
- Create: `itgames-api/test/helpers.ts`
- Create: `itgames-api/test/smoke.e2e-spec.ts`
- Create: `itgames-api/src/app.setup.ts`
- Modify: `itgames-api/src/main.ts`

**Interfaces:**
- Produces (`test/helpers.ts`):
  - `createTestApp(): Promise<TestCtx>` onde `TestCtx = { app: INestApplication; prisma: PrismaService }`
  - `resetDb(prisma: PrismaService): Promise<void>`
  - `createUser(prisma, o: { email: string; role: string; password?: string; name?: string; mustChangePassword?: boolean }): Promise<User>` (senha padrão `Senha@12345`)
  - `login(app, email: string, password = 'Senha@12345'): Promise<string>` (devolve o `accessToken`)
  - `bearer(token: string): { Authorization: string }`
  - `createGameFixture(prisma, code: string, o?: { status?: string; organizerIds?: string[] })`
  - `createCategoryFixture(prisma, gameCode: string, code = 1)`
- Produces (`src/app.setup.ts`): `configureApp(app: INestApplication): void`

- [ ] **Step 1: Criar o banco de testes e instalar dependências**

```bash
docker exec itgames-postgres psql -U itgames_user -d postgres -c "CREATE DATABASE itgames_test;"
cd /d/Projects/fitness/itgames/itgames-api && npm install --save-dev jest@^29.7.0 ts-jest@^29.2.5 @types/jest@^29.5.12 supertest@^7.0.0 @types/supertest@^6.0.2 @nestjs/testing@^10.0.0
```
Expected: banco criado (ou erro "already exists", que é aceitável) e pacotes instalados.

- [ ] **Step 2: Adicionar o script de teste**

Em `itgames-api/package.json`, no objeto `scripts`, adicione:
```json
    "test:e2e": "jest --config ./test/jest-e2e.json --runInBand",
```

- [ ] **Step 3: Criar a configuração do Jest**

`itgames-api/test/jest-e2e.json`:
```json
{
  "rootDir": ".",
  "moduleFileExtensions": ["js", "json", "ts"],
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "setupFiles": ["<rootDir>/setup/test-env.ts"],
  "globalSetup": "<rootDir>/setup/global-setup.ts",
  "testTimeout": 30000
}
```

`itgames-api/test/setup/test-env.ts`:
```ts
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://itgames_user:itgames_password@localhost:5433/itgames_test?schema=public';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.DIRECT_URL = TEST_DATABASE_URL;
process.env.JWT_SECRET = 'test-secret-only-for-e2e';
process.env.CORS_ORIGIN = 'http://localhost:3000';
```

`itgames-api/test/setup/global-setup.ts`:
```ts
import { execSync } from 'child_process';
import { TEST_DATABASE_URL } from './test-env';

export default async function globalSetup() {
  if (!TEST_DATABASE_URL.includes('itgames_test')) {
    throw new Error('A URL de teste deve apontar para o banco itgames_test');
  }
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
```

- [ ] **Step 4: Escrever o teste de fumaça (vai falhar)**

`itgames-api/test/smoke.e2e-spec.ts`:
```ts
import * as request from 'supertest';
import { createTestApp, resetDb, TestCtx } from './helpers';

describe('Smoke (e2e)', () => {
  let ctx: TestCtx;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });

  it('GET /events responde 200 com lista vazia', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/events').expect(200);
    expect(res.body).toEqual([]);
  });
});
```

- [ ] **Step 5: Rodar e ver falhar**

```bash
cd /d/Projects/fitness/itgames/itgames-api && npm run test:e2e
```
Expected: FAIL — `Cannot find module './helpers'`.

- [ ] **Step 6: Criar `src/app.setup.ts` e usar em `main.ts`**

`itgames-api/src/app.setup.ts`:
```ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { LgpdMaskInterceptor } from './common/interceptors/lgpd-mask.interceptor';

export function configureApp(app: INestApplication): void {
  // Limite maior para fotos de súmulas em base64
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // CORS por lista explícita de origens (CORS_ORIGIN separado por vírgula)
  const origins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o && o !== '*');
  app.enableCors({
    origin: origins.length > 0 ? origins : false,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalInterceptors(new LgpdMaskInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
}
```

Substitua o conteúdo de `itgames-api/src/main.ts` por:
```ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApp(app);

  const config = new DocumentBuilder()
    .setTitle('ITGames Arena API')
    .setDescription('Documentação OpenAPI do Backend ITGames Arena para CrossFit, HYROX, Súmulas com Foto, Baterias e Auditoria')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Scores & Súmulas')
    .addTag('Baterias & Raias')
    .addTag('Auditoria & Logs Imutáveis')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT || 3333;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 ITGames Arena API rodando em http://0.0.0.0:${port}`);
  console.log(`📑 Swagger UI disponível em http://localhost:${port}/api-docs`);
}

bootstrap();
```

- [ ] **Step 7: Criar os helpers**

`itgames-api/test/helpers.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

export interface TestCtx {
  app: INestApplication;
  prisma: PrismaService;
}

export const DEFAULT_PASSWORD = 'Senha@12345';

export async function createTestApp(): Promise<TestCtx> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

export async function resetDb(prisma: PrismaService): Promise<void> {
  if (!(process.env.DATABASE_URL || '').includes('itgames_test')) {
    throw new Error('resetDb só pode rodar no banco itgames_test');
  }
  // CASCADE alcança todas as tabelas que dependem de users ou games
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users", "games" RESTART IDENTITY CASCADE');
}

export async function createUser(
  prisma: PrismaService,
  o: { email: string; role: string; password?: string; name?: string; mustChangePassword?: boolean },
) {
  return prisma.user.create({
    data: {
      email: o.email,
      name: o.name ?? o.email,
      role: o.role,
      passwordHash: await bcrypt.hash(o.password ?? DEFAULT_PASSWORD, 4),
      mustChangePassword: o.mustChangePassword ?? false,
    },
  });
}

export async function login(app: INestApplication, email: string, password = DEFAULT_PASSWORD): Promise<string> {
  const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
  return res.body.accessToken;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function createGameFixture(
  prisma: PrismaService,
  code: string,
  o: { status?: string; organizerIds?: string[] } = {},
) {
  return prisma.game.create({
    data: {
      code,
      name: `Campeonato ${code}`,
      status: o.status ?? 'draft',
      organizers: { create: (o.organizerIds ?? []).map((userId) => ({ userId })) },
    },
  });
}

export async function createCategoryFixture(prisma: PrismaService, gameCode: string, code = 1) {
  return prisma.category.create({
    data: { code, gamesId: gameCode, name: 'RX', maxAthlete: 1, teamType: 'individual', genderRule: 'open' },
  });
}
```

- [ ] **Step 8: Rodar e ver passar**

```bash
cd /d/Projects/fitness/itgames/itgames-api && npm run test:e2e
```
Expected: `PASS test/smoke.e2e-spec.ts`. Se falhar por conexão, confirme que o container `itgames-postgres` está de pé e o banco `itgames_test` existe.

- [ ] **Step 9: Confirmar que o build de produção ignora `test/`**

```bash
cd /d/Projects/fitness/itgames/itgames-api && npm run build
```
Expected: sucesso (o `tsconfig.build.json` já exclui `test`).

- [ ] **Step 10: Marcar checkboxes desta tarefa.**

---

## Task 3: Fundação de autenticação (guards globais, JWT obrigatório, troca de senha)

**Files:**
- Create: `itgames-api/src/common/types/auth-user.ts`
- Create: `itgames-api/src/common/decorators/current-user.decorator.ts`
- Create: `itgames-api/src/common/decorators/allow-pending-password-change.decorator.ts`
- Modify: `itgames-api/src/common/decorators/roles.decorator.ts`
- Modify: `itgames-api/src/common/guards/jwt-auth.guard.ts`
- Create: `itgames-api/src/common/guards/password-change.guard.ts`
- Modify: `itgames-api/src/modules/auth/strategies/jwt.strategy.ts`
- Modify: `itgames-api/src/modules/auth/auth.module.ts`
- Create: `itgames-api/src/modules/auth/dto/change-password.dto.ts`
- Modify: `itgames-api/src/modules/auth/auth.service.ts`
- Modify: `itgames-api/src/modules/auth/auth.controller.ts`
- Modify: `itgames-api/src/app.module.ts`
- Test: `itgames-api/test/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: helpers da Task 2.
- Produces:
  - `AuthUser = { id: string; email: string; name: string; role: string; mustChangePassword: boolean }` (`src/common/types/auth-user.ts`)
  - `@CurrentUser()` — parâmetro que devolve `AuthUser | undefined` (`request.user`)
  - `@AllowPendingPasswordChange()` — libera a rota durante a troca obrigatória
  - `@Public()` (`public.decorator.ts`, já existente) — agora com autenticação **opcional**: se houver Bearer válido, `request.user` é preenchido
  - `@Roles(...)` (já existente) — `SUPER_ADMIN` sempre passa; rota sem `@Roles` exige apenas login
  - `AuthService.changePassword(userId: string, dto: ChangePasswordDto)` → `{ user, accessToken }`
  - Resposta de login/register: `{ user: { id, email, name, role, cpf, phoneNumber, mustChangePassword, athleteProfile }, accessToken }`

- [ ] **Step 1: Escrever os testes (vão falhar)**

`itgames-api/test/auth.e2e-spec.ts`:
```ts
import * as request from 'supertest';
import { bearer, createTestApp, createUser, DEFAULT_PASSWORD, login, resetDb, TestCtx } from './helpers';

describe('Auth (e2e)', () => {
  let ctx: TestCtx;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });

  it('GET /auth/me sem token retorna 401', async () => {
    await http().get('/auth/me').expect(401);
  });

  it('GET /auth/me com token retorna o perfil sem o hash da senha', async () => {
    await createUser(ctx.prisma, { email: 'a@t.com', role: 'ATHLETE' });
    const token = await login(ctx.app, 'a@t.com');
    const res = await http().get('/auth/me').set(bearer(token)).expect(200);
    expect(res.body.email).toBe('a@t.com');
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('register ignora o role enviado e cria ATHLETE', async () => {
    const res = await http()
      .post('/auth/register')
      .send({ email: 'novo@x.com', password: DEFAULT_PASSWORD, name: 'Novo', role: 'SUPER_ADMIN' })
      .expect(201);
    expect(res.body.user.role).toBe('ATHLETE');
    const db = await ctx.prisma.user.findUnique({ where: { email: 'novo@x.com' } });
    expect(db.role).toBe('ATHLETE');
  });

  it('register sem e-mail retorna 400', async () => {
    await http().post('/auth/register').send({ password: DEFAULT_PASSWORD, name: 'Sem Email' }).expect(400);
  });

  it('usuário com senha temporária fica bloqueado até trocar a senha', async () => {
    await createUser(ctx.prisma, { email: 'org@t.com', role: 'ORGANIZER', mustChangePassword: true });
    const loginRes = await http().post('/auth/login').send({ email: 'org@t.com', password: DEFAULT_PASSWORD }).expect(200);
    expect(loginRes.body.user.mustChangePassword).toBe(true);
    const token = loginRes.body.accessToken;

    const blocked = await http().get('/scores/game/X').set(bearer(token)).expect(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

    await http().get('/auth/me').set(bearer(token)).expect(200);

    const changed = await http()
      .post('/auth/change-password')
      .set(bearer(token))
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'NovaSenha@123' })
      .expect(201);
    expect(changed.body.user.mustChangePassword).toBe(false);
    expect(typeof changed.body.accessToken).toBe('string');

    const after = await http().get('/scores/game/X').set(bearer(changed.body.accessToken));
    expect(after.body.code).not.toBe('PASSWORD_CHANGE_REQUIRED');

    await http().post('/auth/login').send({ email: 'org@t.com', password: 'NovaSenha@123' }).expect(200);
    await http().post('/auth/login').send({ email: 'org@t.com', password: DEFAULT_PASSWORD }).expect(401);
  });

  it('change-password com senha atual errada retorna 400', async () => {
    await createUser(ctx.prisma, { email: 'a@t.com', role: 'ATHLETE', mustChangePassword: true });
    const token = await login(ctx.app, 'a@t.com');
    await http()
      .post('/auth/change-password')
      .set(bearer(token))
      .send({ currentPassword: 'errada', newPassword: 'NovaSenha@123' })
      .expect(400);
  });

  it('change-password com senha nova curta ou igual à atual retorna 400', async () => {
    await createUser(ctx.prisma, { email: 'a@t.com', role: 'ATHLETE', mustChangePassword: true });
    const token = await login(ctx.app, 'a@t.com');
    await http()
      .post('/auth/change-password')
      .set(bearer(token))
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'curta' })
      .expect(400);
    await http()
      .post('/auth/change-password')
      .set(bearer(token))
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: DEFAULT_PASSWORD })
      .expect(400);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd /d/Projects/fitness/itgames/itgames-api && npm run test:e2e -- auth
```
Expected: FAIL (hoje `/scores/game/X` responde 200 sem token e `change-password` não existe).

- [ ] **Step 3: Tipos e decorators**

`itgames-api/src/common/types/auth-user.ts`:
```ts
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  mustChangePassword: boolean;
}
```

`itgames-api/src/common/decorators/current-user.decorator.ts`:
```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../types/auth-user';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
  return ctx.switchToHttp().getRequest().user;
});
```

`itgames-api/src/common/decorators/allow-pending-password-change.decorator.ts`:
```ts
import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_PASSWORD_CHANGE_KEY = 'allowPendingPasswordChange';
export const AllowPendingPasswordChange = () => SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE_KEY, true);
```

Substitua `itgames-api/src/common/decorators/roles.decorator.ts` (remove a duplicata de `Public`):
```ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/role.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: (UserRole | string)[]) => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 4: Guards**

Substitua `itgames-api/src/common/guards/jwt-auth.guard.ts`:
```ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // Autenticação opcional: com Bearer válido, request.user é preenchido;
      // sem token ou com token inválido/expirado, segue como visitante.
      try {
        await super.canActivate(context);
      } catch {
        // visitante anônimo
      }
      return true;
    }

    return (await super.canActivate(context)) as boolean;
  }
}
```

`itgames-api/src/common/guards/password-change.guard.ts`:
```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY } from '../decorators/allow-pending-password-change.decorator';

@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user?.mustChangePassword) return true;

    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_CHANGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) return true;

    throw new ForbiddenException({
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'Troca de senha obrigatória antes de continuar',
    });
  }
}
```

- [ ] **Step 5: Strategy lendo do banco e `JWT_SECRET` obrigatório**

Substitua `itgames-api/src/modules/auth/strategies/jwt.strategy.ts`:
```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../../../common/types/auth-user';
import { PrismaService } from '../../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Papel e troca obrigatória são lidos do banco a cada requisição:
  // redefinir senha, trocar papel ou remover usuário valem imediatamente.
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, mustChangePassword: true },
    });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado ou removido');
    }
    return user;
  }
}
```

Em `itgames-api/src/modules/auth/auth.module.ts`, troque a linha do `secret` por:
```ts
        secret: configService.getOrThrow<string>('JWT_SECRET'),
```

- [ ] **Step 6: DTO e serviço de autenticação**

`itgames-api/src/modules/auth/dto/change-password.dto.ts`:
```ts
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'A nova senha deve ter no mínimo 8 caracteres' })
  newPassword: string;
}
```

Substitua `itgames-api/src/modules/auth/auth.service.ts`:
```ts
import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../../common/enums/role.enum';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  cpf?: string;
  phoneNumber?: string;
  birthDate?: string;
  gender?: string;
  boxOrGym?: string;
  tshirtSize?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // Cadastro público: sempre cria ATHLETE. Organizadores são criados pelo super admin.
  async register(dto: RegisterDto) {
    if (!dto.email || !dto.password || !dto.name) {
      throw new BadRequestException('Informe nome, e-mail e senha');
    }

    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Já existe um usuário cadastrado com este e-mail');
    }

    if (dto.cpf) {
      const existingCpf = await this.prisma.user.findUnique({
        where: { cpf: dto.cpf.replace(/\D/g, '') },
      });
      if (existingCpf) {
        throw new ConflictException('Já existe um usuário cadastrado com este CPF');
      }
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        name: dto.name,
        cpf: dto.cpf ? dto.cpf.replace(/\D/g, '') : null,
        phoneNumber: dto.phoneNumber,
        role: UserRole.ATHLETE,
        athleteProfile: {
          create: {
            birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
            gender: dto.gender || 'M',
            boxOrGym: dto.boxOrGym || '',
            tshirtSize: dto.tshirtSize || 'M',
            emergencyContact: dto.emergencyContact || null,
            emergencyPhone: dto.emergencyPhone || null,
            termsAccepted: true,
          },
        },
      },
      include: { athleteProfile: true },
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: (dto.email || '').toLowerCase().trim() },
      include: { athleteProfile: true },
    });

    if (!user || !(await bcrypt.compare(dto.password || '', user.passwordHash))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.buildAuthResponse(user);
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        athleteProfile: true,
        organizedGames: {
          include: { game: { select: { code: true, name: true, status: true } } },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { athleteProfile: true },
    });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    // 400 (e não 401): o frontend trata 401 como sessão expirada
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Senha atual incorreta');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('A nova senha deve ser diferente da atual');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, 10),
        mustChangePassword: false,
      },
      include: { athleteProfile: true },
    });

    return this.buildAuthResponse(updated);
  }

  private buildAuthResponse(user: any) {
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        cpf: user.cpf,
        phoneNumber: user.phoneNumber,
        mustChangePassword: user.mustChangePassword,
        athleteProfile: user.athleteProfile ?? null,
      },
      accessToken: this.jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      }),
    };
  }
}
```

Substitua `itgames-api/src/modules/auth/auth.controller.ts`:
```ts
import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AllowPendingPasswordChange } from '../../common/decorators/allow-pending-password-change.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser } from '../../common/types/auth-user';
import { AuthService, LoginDto, RegisterDto } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Cadastro público de atleta (o campo role é ignorado)' })
  @ApiResponse({ status: 201, description: 'Atleta registrado com sucesso.' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autenticar usuário e obter token JWT' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @AllowPendingPasswordChange()
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna o perfil do usuário logado' })
  async getMe(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user.id);
  }

  @AllowPendingPasswordChange()
  @Post('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trocar a senha (obrigatório no primeiro acesso de organizadores)' })
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }
}
```

- [ ] **Step 7: Registrar os guards globais**

Substitua `itgames-api/src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { ScoresModule } from './modules/scores/scores.module';
import { HeatsModule } from './modules/heats/heats.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { EventsModule } from './modules/events/events.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PasswordChangeGuard } from './common/guards/password-change.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    EventsModule,
    ScoresModule,
    HeatsModule,
    AuditModule,
  ],
  providers: [
    // A ordem importa: autentica → exige troca de senha pendente → confere papéis
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PasswordChangeGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
```

- [ ] **Step 8: Rodar os testes**

```bash
cd /d/Projects/fitness/itgames/itgames-api && npm run test:e2e
```
Expected: `auth` e `smoke` passam. (O smoke de `GET /events` continua verde porque as rotas de `events` ainda têm `@Public()`.)

- [ ] **Step 9: Marcar checkboxes desta tarefa.**

---

## Task 4: Módulo de organizadores (criar, listar, redefinir senha)

**Files:**
- Create: `itgames-api/src/common/utils/temporary-password.ts`
- Create: `itgames-api/src/modules/users/dto/create-organizer.dto.ts`
- Create: `itgames-api/src/modules/users/users.service.ts`
- Create: `itgames-api/src/modules/users/users.controller.ts`
- Create: `itgames-api/src/modules/users/users.module.ts`
- Modify: `itgames-api/src/app.module.ts` (importa `UsersModule`)
- Test: `itgames-api/test/users.e2e-spec.ts`

**Interfaces:**
- Consumes: `@Roles`, `@CurrentUser`, `PrismaService`, helpers de teste.
- Produces:
  - `generateTemporaryPassword(length = 12): string`
  - `POST /users/organizers` body `{ name, email, phoneNumber }` → `201 { user: OrganizerView, temporaryPassword: string }`
  - `GET /users/organizers` → `OrganizerView[]` (cada um com `_count: { organizedGames: number }`)
  - `POST /users/organizers/:id/reset-password` → `201 { user: OrganizerView, temporaryPassword: string }`
  - `OrganizerView = { id, name, email, phoneNumber, role, mustChangePassword, createdAt }`

- [ ] **Step 1: Escrever os testes (vão falhar)**

`itgames-api/test/users.e2e-spec.ts`:
```ts
import * as request from 'supertest';
import { bearer, createTestApp, createUser, login, resetDb, TestCtx } from './helpers';

describe('Users / Organizadores (e2e)', () => {
  let ctx: TestCtx;
  let tAdmin: string;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    await createUser(ctx.prisma, { email: 'admin@t.com', role: 'SUPER_ADMIN' });
    await createUser(ctx.prisma, { email: 'org@t.com', role: 'ORGANIZER' });
    tAdmin = await login(ctx.app, 'admin@t.com');
  });

  const body = { name: 'Maria Org', email: 'maria@t.com', phoneNumber: '11999990000' };

  it('sem token retorna 401; organizador retorna 403', async () => {
    await http().post('/users/organizers').send(body).expect(401);
    const tOrg = await login(ctx.app, 'org@t.com');
    await http().post('/users/organizers').set(bearer(tOrg)).send(body).expect(403);
    await http().get('/users/organizers').set(bearer(tOrg)).expect(403);
  });

  it('super admin cria organizador e recebe a senha temporária uma única vez', async () => {
    const res = await http().post('/users/organizers').set(bearer(tAdmin)).send(body).expect(201);
    expect(res.body.user.role).toBe('ORGANIZER');
    expect(res.body.user.mustChangePassword).toBe(true);
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.temporaryPassword).toHaveLength(12);

    const db = await ctx.prisma.user.findUnique({ where: { email: 'maria@t.com' } });
    expect(db.passwordHash).not.toBe(res.body.temporaryPassword);

    const loginRes = await http()
      .post('/auth/login')
      .send({ email: 'maria@t.com', password: res.body.temporaryPassword })
      .expect(200);
    expect(loginRes.body.user.mustChangePassword).toBe(true);
  });

  it('normaliza e-mail com espaços e maiúsculas e detecta duplicata (Review Focus 2)', async () => {
    const res = await http()
      .post('/users/organizers')
      .set(bearer(tAdmin))
      .send({ ...body, email: '  Maria@T.com ' })
      .expect(201);
    expect(res.body.user.email).toBe('maria@t.com');

    await http()
      .post('/auth/login')
      .send({ email: '  MARIA@t.com  ', password: res.body.temporaryPassword })
      .expect(200);

    await http().post('/users/organizers').set(bearer(tAdmin)).send(body).expect(409);
  });

  it('e-mail inválido ou campos ausentes retornam 400', async () => {
    await http().post('/users/organizers').set(bearer(tAdmin)).send({ ...body, email: 'invalido' }).expect(400);
    await http().post('/users/organizers').set(bearer(tAdmin)).send({ name: 'Sem Email' }).expect(400);
  });

  it('lista organizadores com a contagem de campeonatos', async () => {
    const res = await http().get('/users/organizers').set(bearer(tAdmin)).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].email).toBe('org@t.com');
    expect(res.body[0]._count.organizedGames).toBe(0);
  });

  it('redefinir senha invalida a antiga e obriga a troca mesmo com sessão ativa (Review Focus 4)', async () => {
    const org = await ctx.prisma.user.findUnique({ where: { email: 'org@t.com' } });
    const oldToken = await login(ctx.app, 'org@t.com');
    await http().get('/auth/me').set(bearer(oldToken)).expect(200);

    const res = await http()
      .post(`/users/organizers/${org.id}/reset-password`)
      .set(bearer(tAdmin))
      .expect(201);
    expect(res.body.temporaryPassword).toHaveLength(12);

    // token antigo, ainda válido, agora exige a troca
    const blocked = await http().get('/users/organizers').set(bearer(oldToken)).expect(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

    await http().post('/auth/login').send({ email: 'org@t.com', password: 'Senha@12345' }).expect(401);
    await http().post('/auth/login').send({ email: 'org@t.com', password: res.body.temporaryPassword }).expect(200);
  });

  it('redefinir senha de usuário que não é organizador retorna 404', async () => {
    const admin = await ctx.prisma.user.findUnique({ where: { email: 'admin@t.com' } });
    await http().post(`/users/organizers/${admin.id}/reset-password`).set(bearer(tAdmin)).expect(404);
    await http()
      .post('/users/organizers/00000000-0000-0000-0000-000000000000/reset-password')
      .set(bearer(tAdmin))
      .expect(404);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd /d/Projects/fitness/itgames/itgames-api && npm run test:e2e -- users
```
Expected: FAIL (404 nas rotas, módulo não existe).

- [ ] **Step 3: Implementar**

`itgames-api/src/common/utils/temporary-password.ts`:
```ts
import { randomBytes } from 'crypto';

// Sem caracteres ambíguos (0/O, 1/l/I) para facilitar o repasse por WhatsApp
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function generateTemporaryPassword(length = 12): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}
```

`itgames-api/src/modules/users/dto/create-organizer.dto.ts`:
```ts
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateOrganizerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;
}
```

`itgames-api/src/modules/users/users.service.ts`:
```ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../../common/enums/role.enum';
import { generateTemporaryPassword } from '../../common/utils/temporary-password';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrganizerDto } from './dto/create-organizer.dto';

const ORGANIZER_SELECT = {
  id: true,
  name: true,
  email: true,
  phoneNumber: true,
  role: true,
  mustChangePassword: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrganizer(dto: CreateOrganizerDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Já existe um usuário cadastrado com este e-mail');
    }

    const temporaryPassword = generateTemporaryPassword();
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        phoneNumber: dto.phoneNumber.trim(),
        role: UserRole.ORGANIZER,
        passwordHash: await bcrypt.hash(temporaryPassword, 10),
        mustChangePassword: true,
      },
      select: ORGANIZER_SELECT,
    });

    return { user, temporaryPassword };
  }

  async listOrganizers() {
    return this.prisma.user.findMany({
      where: { role: UserRole.ORGANIZER },
      select: { ...ORGANIZER_SELECT, _count: { select: { organizedGames: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async resetOrganizerPassword(id: string) {
    const existing = await this.prisma.user.findFirst({ where: { id, role: UserRole.ORGANIZER } });
    if (!existing) {
      throw new NotFoundException('Organizador não encontrado');
    }

    const temporaryPassword = generateTemporaryPassword();
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await bcrypt.hash(temporaryPassword, 10),
        mustChangePassword: true,
      },
      select: ORGANIZER_SELECT,
    });

    return { user, temporaryPassword };
  }
}
```

`itgames-api/src/modules/users/users.controller.ts`:
```ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { CreateOrganizerDto } from './dto/create-organizer.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('users/organizers')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Super Admin: cadastrar organizador (retorna a senha temporária uma única vez)' })
  async create(@Body() dto: CreateOrganizerDto) {
    return this.usersService.createOrganizer(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Super Admin: listar organizadores' })
  async list() {
    return this.usersService.listOrganizers();
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Super Admin: gerar nova senha temporária para um organizador' })
  async resetPassword(@Param('id') id: string) {
    return this.usersService.resetOrganizerPassword(id);
  }
}
```

`itgames-api/src/modules/users/users.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```

Em `itgames-api/src/app.module.ts`, adicione `import { UsersModule } from './modules/users/users.module';` e inclua `UsersModule` no array `imports` (após `AuthModule`).

- [ ] **Step 4: Rodar os testes**

```bash
cd /d/Projects/fitness/itgames/itgames-api && npm run test:e2e
```
Expected: `users`, `auth`, `smoke` passam.

- [ ] **Step 5: Marcar checkboxes desta tarefa.**

---

## Task 5: Acesso por campeonato e regras de campeonato (CRUD, status, organizadores)

**Files:**
- Create: `itgames-api/src/common/access/game-access.service.ts`
- Create: `itgames-api/src/common/access/access.module.ts`
- Create: `itgames-api/src/modules/events/dto/update-status.dto.ts`
- Create: `itgames-api/src/modules/events/dto/add-organizer.dto.ts`
- Modify: `itgames-api/src/modules/events/events.service.ts`
- Modify: `itgames-api/src/modules/events/events.controller.ts`
- Modify: `itgames-api/src/app.module.ts` (importa `AccessModule`)
- Test: `itgames-api/test/events.e2e-spec.ts`

**Interfaces:**
- Consumes: `AuthUser`, `@CurrentUser`, `@Roles`, `@Public`, helpers.
- Produces:
  - `GameAccessService.canManage(user: AuthUser | undefined, gameCode: string): Promise<boolean>`
  - `GameAccessService.assertCanManage(user: AuthUser | undefined, gameCode: string): Promise<void>` — lança 403
  - `GameAccessService.assertCanView(user: AuthUser | undefined, gameCode: string): Promise<void>` — 404 se não existe ou se não-`live` e sem acesso
  - Rotas: `GET /events` (público, só `live`), `GET /events/mine`, `GET /events/:code`, `POST /events`, `PUT /events/:code`, `PATCH /events/:code/status` (`{status}`), `DELETE /events/:code`, `POST /events/:code/organizers` (`{userId}`), `DELETE /events/:code/organizers/:userId`
  - Os jogos retornados têm `organizers: { id, name, email?, phoneNumber? }[]` (e-mail/telefone só quando quem consulta gerencia o campeonato)

- [ ] **Step 1: Escrever os testes (vão falhar)**

`itgames-api/test/events.e2e-spec.ts`:
```ts
import * as request from 'supertest';
import { bearer, createGameFixture, createTestApp, createUser, login, resetDb, TestCtx } from './helpers';

describe('Events: campeonatos, status e organizadores (e2e)', () => {
  let ctx: TestCtx;
  let orgA: { id: string };
  let orgB: { id: string };
  let tAdmin: string;
  let tA: string;
  let tB: string;
  let tAthlete: string;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    await createUser(ctx.prisma, { email: 'admin@t.com', role: 'SUPER_ADMIN' });
    orgA = await createUser(ctx.prisma, { email: 'a@t.com', role: 'ORGANIZER', name: 'Org A' });
    orgB = await createUser(ctx.prisma, { email: 'b@t.com', role: 'ORGANIZER', name: 'Org B' });
    await createUser(ctx.prisma, { email: 'atleta@t.com', role: 'ATHLETE' });
    tAdmin = await login(ctx.app, 'admin@t.com');
    tA = await login(ctx.app, 'a@t.com');
    tB = await login(ctx.app, 'b@t.com');
    tAthlete = await login(ctx.app, 'atleta@t.com');
  });

  describe('leitura', () => {
    beforeEach(async () => {
      await createGameFixture(ctx.prisma, 'LIVE1', { status: 'live', organizerIds: [orgA.id] });
      await createGameFixture(ctx.prisma, 'DRAFT1', { status: 'draft', organizerIds: [orgA.id] });
    });

    it('GET /events anônimo lista somente campeonatos live, sem e-mail dos organizadores', async () => {
      const res = await http().get('/events').expect(200);
      expect(res.body.map((g: any) => g.code)).toEqual(['LIVE1']);
      expect(res.body[0].organizers).toEqual([{ id: orgA.id, name: 'Org A' }]);
    });

    it('GET /events/:code de campeonato draft: 404 para anônimo e para organizador não vinculado', async () => {
      await http().get('/events/DRAFT1').expect(404);
      await http().get('/events/DRAFT1').set(bearer(tB)).expect(404);
      await http().get('/events/DRAFT1').set(bearer(tAthlete)).expect(404);
    });

    it('GET /events/:code de campeonato draft: 200 para organizador vinculado e super admin, com contatos', async () => {
      const a = await http().get('/events/DRAFT1').set(bearer(tA)).expect(200);
      expect(a.body.organizers[0].email).toBe('a@t.com');
      await http().get('/events/DRAFT1').set(bearer(tAdmin)).expect(200);
    });

    it('token inválido em rota pública é tratado como visitante (Review Focus 1)', async () => {
      await http().get('/events/LIVE1').set('Authorization', 'Bearer token-invalido').expect(200);
      await http().get('/events').set('Authorization', 'Bearer token-invalido').expect(200);
    });

    it('GET /events/mine: organizador vê só os seus; super admin vê todos; atleta 403; anônimo 401', async () => {
      await createGameFixture(ctx.prisma, 'B-DRAFT', { status: 'draft', organizerIds: [orgB.id] });
      const a = await http().get('/events/mine').set(bearer(tA)).expect(200);
      expect(a.body.map((g: any) => g.code).sort()).toEqual(['DRAFT1', 'LIVE1']);
      const admin = await http().get('/events/mine').set(bearer(tAdmin)).expect(200);
      expect(admin.body.map((g: any) => g.code).sort()).toEqual(['B-DRAFT', 'DRAFT1', 'LIVE1']);
      await http().get('/events/mine').set(bearer(tAthlete)).expect(403);
      await http().get('/events/mine').expect(401);
    });
  });

  describe('criação e edição', () => {
    it('POST /events: anônimo 401, atleta 403', async () => {
      await http().post('/events').send({ code: 'X1', name: 'X' }).expect(401);
      await http().post('/events').set(bearer(tAthlete)).send({ code: 'X1', name: 'X' }).expect(403);
    });

    it('organizador cria campeonato sempre em draft, vinculado a ele, com código em maiúsculas', async () => {
      const res = await http()
        .post('/events')
        .set(bearer(tA))
        .send({ code: 'copa-1', name: 'Copa 1', status: 'live' })
        .expect(201);
      expect(res.body.code).toBe('COPA-1');
      expect(res.body.status).toBe('draft');
      expect(res.body.organizers.map((o: any) => o.id)).toEqual([orgA.id]);
    });

    it('super admin cria campeonato em draft sem ser vinculado como organizador', async () => {
      const res = await http().post('/events').set(bearer(tAdmin)).send({ code: 'ADM-1', name: 'Adm' }).expect(201);
      expect(res.body.status).toBe('draft');
      expect(res.body.organizers).toEqual([]);
    });

    it('código duplicado retorna 409; campos obrigatórios ausentes retornam 400', async () => {
      await http().post('/events').set(bearer(tA)).send({ code: 'DUP', name: 'Um' }).expect(201);
      await http().post('/events').set(bearer(tA)).send({ code: 'dup', name: 'Dois' }).expect(409);
      await http().post('/events').set(bearer(tA)).send({ name: 'Sem código' }).expect(400);
    });

    it('PUT: vinculado edita e não consegue alterar status; não vinculado recebe 403', async () => {
      await createGameFixture(ctx.prisma, 'G1', { status: 'draft', organizerIds: [orgA.id] });
      const res = await http()
        .put('/events/G1')
        .set(bearer(tA))
        .send({ name: 'Novo Nome', status: 'live' })
        .expect(200);
      expect(res.body.name).toBe('Novo Nome');
      expect(res.body.status).toBe('draft');
      await http().put('/events/G1').set(bearer(tB)).send({ name: 'Invasor' }).expect(403);
      await http().put('/events/G1').send({ name: 'Anônimo' }).expect(401);
    });
  });

  describe('status e exclusão', () => {
    beforeEach(async () => {
      await createGameFixture(ctx.prisma, 'G1', { status: 'draft', organizerIds: [orgA.id] });
    });

    it('organizador não altera status; super admin libera', async () => {
      await http().patch('/events/G1/status').set(bearer(tA)).send({ status: 'live' }).expect(403);
      await http().patch('/events/G1/status').set(bearer(tAdmin)).send({ status: 'live' }).expect(200);
      const game = await ctx.prisma.game.findUnique({ where: { code: 'G1' } });
      expect(game.status).toBe('live');
    });

    it('status inválido retorna 400', async () => {
      await http().patch('/events/G1/status').set(bearer(tAdmin)).send({ status: 'foo' }).expect(400);
    });

    it('organizador não exclui; super admin exclui removendo vínculos sem apagar o usuário (Review Focus 5)', async () => {
      await http().delete('/events/G1').set(bearer(tA)).expect(403);
      await http().delete('/events/G1').set(bearer(tAdmin)).expect(200);
      expect(await ctx.prisma.game.count({ where: { code: 'G1' } })).toBe(0);
      expect(await ctx.prisma.gameOrganizer.count({ where: { gameCode: 'G1' } })).toBe(0);
      expect(await ctx.prisma.user.findUnique({ where: { id: orgA.id } })).not.toBeNull();
    });
  });

  describe('vários organizadores', () => {
    beforeEach(async () => {
      await createGameFixture(ctx.prisma, 'G1', { status: 'draft', organizerIds: [orgA.id] });
    });

    it('só o super admin vincula; depois do vínculo os dois organizadores editam', async () => {
      await http().post('/events/G1/organizers').set(bearer(tA)).send({ userId: orgB.id }).expect(403);
      const res = await http().post('/events/G1/organizers').set(bearer(tAdmin)).send({ userId: orgB.id }).expect(201);
      expect(res.body.map((o: any) => o.id).sort()).toEqual([orgA.id, orgB.id].sort());

      await http().put('/events/G1').set(bearer(tA)).send({ name: 'Por A' }).expect(200);
      await http().put('/events/G1').set(bearer(tB)).send({ name: 'Por B' }).expect(200);
    });

    it('vincular usuário que não é organizador retorna 400; campeonato inexistente retorna 404', async () => {
      const athlete = await ctx.prisma.user.findUnique({ where: { email: 'atleta@t.com' } });
      await http().post('/events/G1/organizers').set(bearer(tAdmin)).send({ userId: athlete.id }).expect(400);
      await http().post('/events/NAOEXISTE/organizers').set(bearer(tAdmin)).send({ userId: orgB.id }).expect(404);
      await http().post('/events/G1/organizers').set(bearer(tAdmin)).send({ userId: 'nao-e-uuid' }).expect(400);
    });

    it('desvincular remove o acesso imediatamente (Review Focus 3)', async () => {
      await http().post('/events/G1/organizers').set(bearer(tAdmin)).send({ userId: orgB.id }).expect(201);
      await http().put('/events/G1').set(bearer(tB)).send({ name: 'Ainda posso' }).expect(200);

      await http().delete(`/events/G1/organizers/${orgB.id}`).set(bearer(tB)).expect(403);
      await http().delete(`/events/G1/organizers/${orgB.id}`).set(bearer(tAdmin)).expect(200);

      await http().put('/events/G1').set(bearer(tB)).send({ name: 'Não posso mais' }).expect(403);
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd /d/Projects/fitness/itgames/itgames-api && npm run test:e2e -- events
```
Expected: FAIL em quase todos os casos.

- [ ] **Step 3: `GameAccessService` e `AccessModule`**

`itgames-api/src/common/access/game-access.service.ts`:
```ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '../enums/role.enum';
import { AuthUser } from '../types/auth-user';

@Injectable()
export class GameAccessService {
  constructor(private readonly prisma: PrismaService) {}

  // Super admin gerencia tudo; organizador gerencia apenas campeonatos em que está vinculado.
  async canManage(user: AuthUser | undefined, gameCode: string): Promise<boolean> {
    if (!user) return false;
    if (user.role === UserRole.SUPER_ADMIN) return true;
    if (user.role !== UserRole.ORGANIZER) return false;
    const link = await this.prisma.gameOrganizer.findUnique({
      where: { gameCode_userId: { gameCode, userId: user.id } },
    });
    return !!link;
  }

  async assertCanManage(user: AuthUser | undefined, gameCode: string): Promise<void> {
    if (!(await this.canManage(user, gameCode))) {
      throw new ForbiddenException('Você não tem permissão para gerenciar este campeonato');
    }
  }

  // Campeonato live é público; draft/blocked só para quem gerencia (os demais veem 404).
  async assertCanView(user: AuthUser | undefined, gameCode: string): Promise<void> {
    const game = await this.prisma.game.findUnique({ where: { code: gameCode }, select: { status: true } });
    if (!game) throw new NotFoundException('Campeonato não encontrado');
    if (game.status === 'live') return;
    if (!(await this.canManage(user, gameCode))) {
      throw new NotFoundException('Campeonato não encontrado');
    }
  }
}
```

`itgames-api/src/common/access/access.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { GameAccessService } from './game-access.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [GameAccessService],
  exports: [GameAccessService],
})
export class AccessModule {}
```

Em `itgames-api/src/app.module.ts`, adicione `import { AccessModule } from './common/access/access.module';` e `AccessModule` no array `imports` (após `PrismaModule`).

- [ ] **Step 4: DTOs de status e vínculo**

`itgames-api/src/modules/events/dto/update-status.dto.ts`:
```ts
import { IsIn } from 'class-validator';

export const GAME_STATUSES = ['live', 'draft', 'blocked'] as const;

export class UpdateStatusDto {
  @IsIn(GAME_STATUSES, { message: 'Status inválido. Use live, draft ou blocked' })
  status: string;
}
```

`itgames-api/src/modules/events/dto/add-organizer.dto.ts`:
```ts
import { IsUUID } from 'class-validator';

export class AddOrganizerDto {
  @IsUUID()
  userId: string;
}
```

- [ ] **Step 5: Atualizar o `EventsService`**

Em `itgames-api/src/modules/events/events.service.ts`:

(a) Ajuste os imports do topo para:
```ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { GameAccessService } from '../../common/access/game-access.service';
import { UserRole } from '../../common/enums/role.enum';
import { AuthUser } from '../../common/types/auth-user';
import { PrismaService } from '../../prisma/prisma.service';
```
(Se `grep -n ForbiddenException src/modules/events/events.service.ts` mostrar outro uso além do import, mantenha `ForbiddenException` no import. Mantenha o restante do arquivo — interfaces `CreateGameDto` etc. — como está, **exceto** remover `organizerId?: string;` e `status?: string;` de `CreateGameDto`.)

(b) Substitua o construtor e todos os métodos desde `constructor(private readonly prisma: PrismaService) {}` até o fim de `updateGameStatus` (isto é, `listGames`, `getGame`, `createGame`, `updateGame`, `updateGameStatus`) por:

```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: GameAccessService,
  ) {}

  private readonly organizerPublicSelect = { user: { select: { id: true, name: true } } };
  private readonly organizerPrivateSelect = {
    user: { select: { id: true, name: true, email: true, phoneNumber: true } },
  };

  // Troca [{ user }] por [user] para o cliente
  private presentGame<T>(game: T) {
    const { organizers, ...rest } = game as any;
    return { ...rest, organizers: (organizers || []).map((o: any) => o.user) };
  }

  // 1. Organização de Campeonatos (Games)

  // Listagem pública: somente campeonatos liberados (live)
  async listPublicGames() {
    const games = await this.prisma.game.findMany({
      where: { status: 'live' },
      include: {
        categories: true,
        organizers: { select: this.organizerPublicSelect },
        _count: { select: { registrations: true, heats: true } },
      },
      orderBy: { code: 'asc' },
    });
    return games.map((g) => this.presentGame(g));
  }

  // Área restrita: organizador vê os seus (qualquer status); super admin vê todos
  async listMyGames(user: AuthUser) {
    const where = user.role === UserRole.SUPER_ADMIN ? {} : { organizers: { some: { userId: user.id } } };
    const games = await this.prisma.game.findMany({
      where,
      include: {
        categories: true,
        organizers: { select: this.organizerPrivateSelect },
        _count: { select: { registrations: true, heats: true } },
      },
      orderBy: { code: 'asc' },
    });
    return games.map((g) => this.presentGame(g));
  }

  async getGame(code: string, user?: AuthUser) {
    await this.access.assertCanView(user, code);
    const canManage = await this.access.canManage(user, code);

    const game = await this.prisma.game.findUnique({
      where: { code },
      include: {
        organizers: { select: canManage ? this.organizerPrivateSelect : this.organizerPublicSelect },
        categories: {
          include: {
            workouts: true,
            _count: { select: { registrations: true } },
          },
        },
        heats: {
          include: { slots: true },
        },
      },
    });
    if (!game) throw new NotFoundException('Campeonato não encontrado');
    return this.presentGame(game);
  }

  // Todo campeonato nasce em draft; apenas o super admin libera (updateGameStatus).
  async createGame(user: AuthUser, dto: CreateGameDto) {
    if (!dto.code?.trim() || !dto.name?.trim()) {
      throw new BadRequestException('Informe o código e o nome do campeonato');
    }

    const code = dto.code.toUpperCase().trim();
    const existing = await this.prisma.game.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException('Já existe um campeonato com este código');
    }

    const game = await this.prisma.game.create({
      data: {
        code,
        name: dto.name,
        date: dto.date,
        description: dto.description,
        location: dto.location,
        foto: dto.foto || null,
        status: 'draft',
        isLowestPointsBetter: dto.isLowestPointsBetter ?? false,
        showTime: dto.showTime ?? true,
        showWeight: dto.showWeight ?? true,
        showReps: dto.showReps ?? true,
        showScoreRevision: dto.showScoreRevision ?? false,
        lanesCount: dto.lanesCount || 8,
        eventType: dto.eventType || 'crossfit',
        ...(user.role === UserRole.ORGANIZER && { organizers: { create: [{ userId: user.id }] } }),
      },
      include: { organizers: { select: this.organizerPrivateSelect } },
    });
    return this.presentGame(game);
  }

  // O status não é editável aqui: só o super admin muda via updateGameStatus.
  async updateGame(code: string, dto: Partial<CreateGameDto>) {
    const existing = await this.prisma.game.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Campeonato não encontrado');

    return this.prisma.game.update({
      where: { code },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.date !== undefined && { date: dto.date }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.foto !== undefined && { foto: dto.foto }),
        ...(dto.isLowestPointsBetter !== undefined && { isLowestPointsBetter: dto.isLowestPointsBetter }),
        ...(dto.showTime !== undefined && { showTime: dto.showTime }),
        ...(dto.showWeight !== undefined && { showWeight: dto.showWeight }),
        ...(dto.showReps !== undefined && { showReps: dto.showReps }),
        ...(dto.showScoreRevision !== undefined && { showScoreRevision: dto.showScoreRevision }),
        ...(dto.lanesCount !== undefined && { lanesCount: dto.lanesCount }),
        ...(dto.eventType !== undefined && { eventType: dto.eventType }),
      },
    });
  }

  // Super Admin: Liberar ('live'), Pausar ('draft') ou Bloquear ('blocked')
  async updateGameStatus(code: string, status: string) {
    const existing = await this.prisma.game.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Campeonato não encontrado');

    return this.prisma.game.update({
      where: { code },
      data: { status },
    });
  }

  // Super Admin: vínculo de organizadores
  async addOrganizer(code: string, userId: string) {
    const game = await this.prisma.game.findUnique({ where: { code } });
    if (!game) throw new NotFoundException('Campeonato não encontrado');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.ORGANIZER) {
      throw new BadRequestException('O usuário informado não é um organizador');
    }

    await this.prisma.gameOrganizer.upsert({
      where: { gameCode_userId: { gameCode: code, userId } },
      update: {},
      create: { gameCode: code, userId },
    });
    return this.listGameOrganizers(code);
  }

  async removeOrganizer(code: string, userId: string) {
    const game = await this.prisma.game.findUnique({ where: { code } });
    if (!game) throw new NotFoundException('Campeonato não encontrado');

    await this.prisma.gameOrganizer.deleteMany({ where: { gameCode: code, userId } });
    return this.listGameOrganizers(code);
  }

  private async listGameOrganizers(code: string) {
    const links = await this.prisma.gameOrganizer.findMany({
      where: { gameCode: code },
      select: this.organizerPrivateSelect,
    });
    return links.map((l) => l.user);
  }
```
(O método `deleteGameCascade` e os demais abaixo permanecem; a exclusão em cascata remove `games_organizers` por FK `ON DELETE CASCADE`.)

- [ ] **Step 6: Reescrever o controller (campeonato, status e organizadores; categorias/WODs/inscrições serão ajustados na Task 6)**

Substitua o conteúdo de `itgames-api/src/modules/events/events.controller.ts` por:
```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GameAccessService } from '../../common/access/game-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { AuthUser } from '../../common/types/auth-user';
import { AddOrganizerDto } from './dto/add-organizer.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import {
  CreateCategoryDto,
  CreateGameDto,
  CreateRegistrationDto,
  CreateWorkoutDto,
  EventsService,
} from './events.service';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly access: GameAccessService,
  ) {}

  // 1. Campeonatos
  @Public()
  @Get()
  @ApiOperation({ summary: 'Listar campeonatos liberados (live) — público' })
  async listGames() {
    return this.eventsService.listPublicGames();
  }

  // Declarada antes de ':code' para não ser capturada como código de campeonato
  @Roles(UserRole.ORGANIZER)
  @Get('mine')
  @ApiOperation({ summary: 'Meus campeonatos (organizador) ou todos (super admin)' })
  async listMyGames(@CurrentUser() user: AuthUser) {
    return this.eventsService.listMyGames(user);
  }

  @Public()
  @Get(':code')
  @ApiOperation({ summary: 'Detalhes do campeonato (draft/blocked só para quem gerencia)' })
  async getGame(@Param('code') code: string, @CurrentUser() user?: AuthUser) {
    return this.eventsService.getGame(code, user);
  }

  @Roles(UserRole.ORGANIZER)
  @Post()
  @ApiOperation({ summary: 'Criar campeonato (nasce em draft)' })
  async createGame(@CurrentUser() user: AuthUser, @Body() dto: CreateGameDto) {
    return this.eventsService.createGame(user, dto);
  }

  @Roles(UserRole.ORGANIZER)
  @Put(':code')
  @ApiOperation({ summary: 'Atualizar dados gerais do campeonato (não altera status)' })
  async updateGame(
    @Param('code') code: string,
    @Body() dto: Partial<CreateGameDto>,
    @CurrentUser() user: AuthUser,
  ) {
    await this.access.assertCanManage(user, code);
    return this.eventsService.updateGame(code, dto);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':code/status')
  @ApiOperation({ summary: 'Super Admin: liberar (live), pausar (draft) ou bloquear (blocked)' })
  async updateGameStatus(@Param('code') code: string, @Body() dto: UpdateStatusDto) {
    return this.eventsService.updateGameStatus(code, dto.status);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Delete(':code')
  @ApiOperation({ summary: 'Super Admin: excluir campeonato em cascata' })
  async deleteGame(@Param('code') code: string) {
    return this.eventsService.deleteGameCascade(code);
  }

  // 2. Organizadores do campeonato
  @Roles(UserRole.SUPER_ADMIN)
  @Post(':code/organizers')
  @ApiOperation({ summary: 'Super Admin: vincular organizador ao campeonato' })
  async addOrganizer(@Param('code') code: string, @Body() dto: AddOrganizerDto) {
    return this.eventsService.addOrganizer(code, dto.userId);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Delete(':code/organizers/:userId')
  @ApiOperation({ summary: 'Super Admin: desvincular organizador do campeonato' })
  async removeOrganizer(@Param('code') code: string, @Param('userId') userId: string) {
    return this.eventsService.removeOrganizer(code, userId);
  }

  // 3. Categorias com regras de equipe
  @Public()
  @Get(':code/categories')
  @ApiOperation({ summary: 'Listar categorias de um campeonato' })
  async listCategories(@Param('code') code: string, @CurrentUser() user?: AuthUser) {
    await this.access.assertCanView(user, code);
    return this.eventsService.listCategories(code);
  }

  @Roles(UserRole.ORGANIZER)
  @Post(':code/categories')
  @ApiOperation({ summary: 'Criar categoria com regras de time e idade' })
  async createCategory(@Param('code') code: string, @Body() dto: CreateCategoryDto, @CurrentUser() user: AuthUser) {
    await this.access.assertCanManage(user, code);
    return this.eventsService.createCategory({ ...dto, gamesId: code });
  }

  @Roles(UserRole.ORGANIZER)
  @Put(':code/categories/:catCode')
  @ApiOperation({ summary: 'Atualizar categoria de um campeonato' })
  async updateCategory(
    @Param('code') code: string,
    @Param('catCode') catCode: string,
    @Body() dto: Partial<CreateCategoryDto>,
    @CurrentUser() user: AuthUser,
  ) {
    await this.access.assertCanManage(user, code);
    return this.eventsService.updateCategory(code, parseInt(catCode, 10), dto);
  }

  @Roles(UserRole.ORGANIZER)
  @Delete(':code/categories/:catCode')
  @ApiOperation({ summary: 'Excluir categoria de um campeonato' })
  async deleteCategory(@Param('code') code: string, @Param('catCode') catCode: string, @CurrentUser() user: AuthUser) {
    await this.access.assertCanManage(user, code);
    return this.eventsService.deleteCategory(code, parseInt(catCode, 10));
  }

  // 4. WODs / Workouts
  @Public()
  @Get(':code/workouts')
  @ApiOperation({ summary: 'Listar WODs de um campeonato' })
  async listWorkouts(
    @Param('code') code: string,
    @Query('categoryId') categoryId?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    await this.access.assertCanView(user, code);
    return this.eventsService.listWorkouts(code, categoryId ? parseInt(categoryId, 10) : undefined);
  }

  @Roles(UserRole.ORGANIZER)
  @Post(':code/workouts')
  @ApiOperation({ summary: 'Criar WOD / Workout para categoria' })
  async createWorkout(@Param('code') code: string, @Body() dto: CreateWorkoutDto, @CurrentUser() user: AuthUser) {
    await this.access.assertCanManage(user, code);
    return this.eventsService.createWorkout({ ...dto, game: code });
  }

  // 5. Inscrições
  @Public()
  @Post(':code/registrations')
  @ApiOperation({ summary: 'Inscrição de equipe/atleta (somente em campeonato liberado)' })
  async registerTeam(@Param('code') code: string, @Body() dto: CreateRegistrationDto) {
    return this.eventsService.registerTeam({ ...dto, gameCode: code });
  }

  @Roles(UserRole.ORGANIZER)
  @Get(':code/registrations')
  @ApiOperation({ summary: 'Listar inscrições do evento (organizador do campeonato / super admin)' })
  async listRegistrations(
    @Param('code') code: string,
    @CurrentUser() user: AuthUser,
    @Query('categoryId') categoryId?: string,
  ) {
    await this.access.assertCanManage(user, code);
    return this.eventsService.listRegistrations(code, categoryId ? parseInt(categoryId, 10) : undefined);
  }
}
```

- [ ] **Step 7: Rodar os testes**

```bash
cd /d/Projects/fitness/itgames/itgames-api && npm run test:e2e
```
Expected: todos os arquivos passam (`smoke`, `auth`, `users`, `events`). Se `npm run build` acusar `organizerId` em outros arquivos, é esperado só em `seed` (corrigido na Task 8); `src/` não deve mais referenciá-lo: `grep -rn "organizerId" src` deve voltar vazio.

- [ ] **Step 8: Marcar checkboxes desta tarefa.**

---

## Task 6: Regras de inscrição, categorias e WODs (`live`, visibilidade, vínculo)

**Files:**
- Modify: `itgames-api/src/modules/events/events.service.ts` (`registerTeam`)
- Test: `itgames-api/test/events-registration.e2e-spec.ts`

**Interfaces:**
- Consumes: `GameAccessService`, rotas da Task 5, helpers (`createCategoryFixture`).
- Produces: `registerTeam` passa a validar que o campeonato existe (404) e está `live` (400, "Inscrições indisponíveis: campeonato não liberado").

- [ ] **Step 1: Escrever os testes (vão falhar)**

`itgames-api/test/events-registration.e2e-spec.ts`:
```ts
import * as request from 'supertest';
import {
  bearer,
  createCategoryFixture,
  createGameFixture,
  createTestApp,
  createUser,
  login,
  resetDb,
  TestCtx,
} from './helpers';

describe('Events: categorias, WODs e inscrições (e2e)', () => {
  let ctx: TestCtx;
  let orgA: { id: string };
  let tAdmin: string;
  let tA: string;
  let tB: string;
  let tAthlete: string;
  const http = () => request(ctx.app.getHttpServer());

  const registration = {
    categoryId: 1,
    teamName: 'Time A',
    athletes: [{ name: 'Atleta Um', gender: 'M' }],
  };

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    await createUser(ctx.prisma, { email: 'admin@t.com', role: 'SUPER_ADMIN' });
    orgA = await createUser(ctx.prisma, { email: 'a@t.com', role: 'ORGANIZER' });
    await createUser(ctx.prisma, { email: 'b@t.com', role: 'ORGANIZER' });
    await createUser(ctx.prisma, { email: 'atleta@t.com', role: 'ATHLETE' });
    tAdmin = await login(ctx.app, 'admin@t.com');
    tA = await login(ctx.app, 'a@t.com');
    tB = await login(ctx.app, 'b@t.com');
    tAthlete = await login(ctx.app, 'atleta@t.com');

    await createGameFixture(ctx.prisma, 'LIVE1', { status: 'live', organizerIds: [orgA.id] });
    await createGameFixture(ctx.prisma, 'DRAFT1', { status: 'draft', organizerIds: [orgA.id] });
    await createCategoryFixture(ctx.prisma, 'LIVE1');
    await createCategoryFixture(ctx.prisma, 'DRAFT1');
  });

  it('inscrição em campeonato draft retorna 400; em live retorna 201; inexistente retorna 404', async () => {
    const draft = await http().post('/events/DRAFT1/registrations').send(registration).expect(400);
    expect(draft.body.message).toBe('Inscrições indisponíveis: campeonato não liberado');

    const live = await http().post('/events/LIVE1/registrations').send(registration).expect(201);
    expect(live.body.success).toBe(true);

    await http().post('/events/NAOEXISTE/registrations').send(registration).expect(404);
  });

  it('inscrição em campeonato bloqueado retorna 400', async () => {
    await ctx.prisma.game.update({ where: { code: 'LIVE1' }, data: { status: 'blocked' } });
    await http().post('/events/LIVE1/registrations').send(registration).expect(400);
  });

  it('listar inscrições: anônimo 401, atleta 403, organizador não vinculado 403, vinculado e super admin 200', async () => {
    await http().get('/events/LIVE1/registrations').expect(401);
    await http().get('/events/LIVE1/registrations').set(bearer(tAthlete)).expect(403);
    await http().get('/events/LIVE1/registrations').set(bearer(tB)).expect(403);
    await http().get('/events/LIVE1/registrations').set(bearer(tA)).expect(200);
    await http().get('/events/LIVE1/registrations').set(bearer(tAdmin)).expect(200);
  });

  it('categorias: leitura pública só de campeonato live; draft 404 para visitante e 200 para vinculado', async () => {
    await http().get('/events/LIVE1/categories').expect(200);
    await http().get('/events/DRAFT1/categories').expect(404);
    await http().get('/events/DRAFT1/categories').set(bearer(tB)).expect(404);
    await http().get('/events/DRAFT1/categories').set(bearer(tA)).expect(200);
  });

  it('categorias: criação exige vínculo (organizador B recebe 403; A recebe 201; anônimo 401)', async () => {
    const payload = { name: 'Nova', maxAthlete: 1 };
    await http().post('/events/DRAFT1/categories').send(payload).expect(401);
    await http().post('/events/DRAFT1/categories').set(bearer(tB)).send(payload).expect(403);
    await http().post('/events/DRAFT1/categories').set(bearer(tA)).send(payload).expect(201);
  });

  it('WODs: criação exige vínculo e leitura de draft é restrita', async () => {
    const payload = { code: 1, category: 1, title: 'Fran', type: 'for_time' };
    await http().post('/events/DRAFT1/workouts').set(bearer(tB)).send(payload).expect(403);
    await http().post('/events/DRAFT1/workouts').set(bearer(tA)).send(payload).expect(201);
    await http().get('/events/DRAFT1/workouts').expect(404);
    await http().get('/events/DRAFT1/workouts').set(bearer(tA)).expect(200);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd /d/Projects/fitness/itgames/itgames-api && npm run test:e2e -- events-registration
```
Expected: FAIL no primeiro teste (inscrição em `draft` hoje retorna 201).

- [ ] **Step 3: Implementar a regra em `registerTeam`**

Em `itgames-api/src/modules/events/events.service.ts`, no início de `registerTeam` (antes da busca da categoria, logo depois de `async registerTeam(dto: CreateRegistrationDto) {`), adicione:
```ts
    const game = await this.prisma.game.findUnique({
      where: { code: dto.gameCode },
      select: { status: true },
    });
    if (!game) {
      throw new NotFoundException('Campeonato não encontrado');
    }
    if (game.status !== 'live') {
      throw new BadRequestException('Inscrições indisponíveis: campeonato não liberado');
    }

```

- [ ] **Step 4: Rodar a suíte inteira**

```bash
cd /d/Projects/fitness/itgames/itgames-api && npm run test:e2e
```
Expected: todos passam.

- [ ] **Step 5: Marcar checkboxes desta tarefa.**

---

## Task 7: Proteger `heats`, `scores` e `audit` (papéis, vínculo e auditoria com identidade real)

**Files:**
- Modify: `itgames-api/src/modules/scores/scores.controller.ts`
- Modify: `itgames-api/src/modules/scores/scores.service.ts`
- Modify: `itgames-api/src/modules/heats/heats.controller.ts`
- Modify: `itgames-api/src/modules/heats/heats.service.ts`
- Modify: `itgames-api/src/modules/audit/audit.controller.ts`
- Test: `itgames-api/test/field-ops.e2e-spec.ts`

**Interfaces:**
- Consumes: `GameAccessService`, `@CurrentUser`, `@Roles`, `@Public`.
- Produces:
  - `ScoresService.createOrUpdateScore(dto, actorName: string, actorRole: string, ipAddress?: string)`
  - `ScoresService.attachPhoto(scoreCode: number, photo: string, actorName: string, actorRole: string, ipAddress?: string)`
  - `ScoresService.getScoreGameCode(scoreCode: number): Promise<string>` (404 se não existe)
  - `HeatsService.gameCodeOfHeat(heatId: string): Promise<string>`, `HeatsService.gameCodeOfSlot(slotId: string): Promise<string>` (404 se não existe)
  - Permissões: `POST/PATCH /scores*` → `JUDGE` (qualquer campeonato, vínculo juiz↔campeonato fica para depois) ou `ORGANIZER` vinculado ou super admin; `GET /scores/game/:code` e `GET /audit/game/:code` → `ORGANIZER` vinculado ou super admin (juiz não vê); `POST /heats/generate`, `POST /heats/swap-lanes` → `ORGANIZER` vinculado; `PATCH /heats/:id/status` → `ORGANIZER` vinculado ou `JUDGE`; `GET /heats/game/...` → público se `live`.

- [ ] **Step 1: Escrever os testes (vão falhar)**

`itgames-api/test/field-ops.e2e-spec.ts`:
```ts
import * as request from 'supertest';
import {
  bearer,
  createCategoryFixture,
  createGameFixture,
  createTestApp,
  createUser,
  login,
  resetDb,
  TestCtx,
} from './helpers';

describe('Scores, Heats e Audit (e2e)', () => {
  let ctx: TestCtx;
  let orgA: { id: string };
  let tA: string;
  let tB: string;
  let tJudge: string;
  let tAthlete: string;
  const http = () => request(ctx.app.getHttpServer());

  const score = { idEvent: 1, game: 'G1', category: 1, codeTeam: 101, time: '05:00' };

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    orgA = await createUser(ctx.prisma, { email: 'a@t.com', role: 'ORGANIZER' });
    await createUser(ctx.prisma, { email: 'b@t.com', role: 'ORGANIZER' });
    await createUser(ctx.prisma, { email: 'judge@t.com', role: 'JUDGE', name: 'Roberto Juiz' });
    await createUser(ctx.prisma, { email: 'atleta@t.com', role: 'ATHLETE' });
    tA = await login(ctx.app, 'a@t.com');
    tB = await login(ctx.app, 'b@t.com');
    tJudge = await login(ctx.app, 'judge@t.com');
    tAthlete = await login(ctx.app, 'atleta@t.com');

    await createGameFixture(ctx.prisma, 'G1', { status: 'live', organizerIds: [orgA.id] });
    await createCategoryFixture(ctx.prisma, 'G1');
    await ctx.prisma.registration.create({
      data: { code: 101, categoryId: 1, gameCode: 'G1', team: 'Time A' },
    });
    await ctx.prisma.workout.create({
      data: { code: 1, game: 'G1', category: 1, title: 'WOD 1', type: 'for_time' },
    });
  });

  describe('scores', () => {
    it('lançar score: anônimo 401, atleta 403, organizador não vinculado 403', async () => {
      await http().post('/scores').send(score).expect(401);
      await http().post('/scores').set(bearer(tAthlete)).send(score).expect(403);
      await http().post('/scores').set(bearer(tB)).send(score).expect(403);
    });

    it('juiz lança score e a auditoria registra o nome do token, o papel e o IP', async () => {
      await http().post('/scores').set(bearer(tJudge)).send(score).expect(201);
      const log = await ctx.prisma.auditLog.findFirst({ where: { gameCode: 'G1' } });
      expect(log.changedBy).toBe('Roberto Juiz');
      expect(log.role).toBe('judge');
      expect(log.ipAddress).toBeTruthy();
    });

    it('organizador vinculado lança score com papel organizer', async () => {
      await http().post('/scores').set(bearer(tA)).send(score).expect(201);
      const log = await ctx.prisma.auditLog.findFirst({ where: { gameCode: 'G1' } });
      expect(log.role).toBe('organizer');
    });

    it('listar scores e auditoria: apenas organizador vinculado/super admin', async () => {
      await http().get('/scores/game/G1').expect(401);
      await http().get('/scores/game/G1').set(bearer(tAthlete)).expect(403);
      await http().get('/scores/game/G1').set(bearer(tJudge)).expect(403);
      await http().get('/scores/game/G1').set(bearer(tB)).expect(403);
      await http().get('/scores/game/G1').set(bearer(tA)).expect(200);

      await http().get('/audit/game/G1').expect(401);
      await http().get('/audit/game/G1').set(bearer(tB)).expect(403);
      await http().get('/audit/game/G1').set(bearer(tA)).expect(200);
    });

    it('anexar foto: juiz pode; atleta não; score inexistente retorna 404', async () => {
      const created = await http().post('/scores').set(bearer(tJudge)).send(score).expect(201);
      const code = created.body.score.code;
      await http().patch(`/scores/${code}/photo`).set(bearer(tAthlete)).send({ photo: 'x' }).expect(403);
      await http().patch(`/scores/${code}/photo`).set(bearer(tJudge)).send({ photo: 'data:image/png;base64,AAAA' }).expect(200);
      await http().patch('/scores/999999/photo').set(bearer(tJudge)).send({ photo: 'x' }).expect(404);
    });
  });

  describe('heats', () => {
    const generate = { gameCode: 'G1', categoryId: 1, workoutCode: 1, totalLanes: 4, startHour: '08:00', intervalMinutes: 10 };

    it('gerar baterias: anônimo 401; juiz 403; organizador não vinculado 403; vinculado 201', async () => {
      await http().post('/heats/generate').send(generate).expect(401);
      await http().post('/heats/generate').set(bearer(tJudge)).send(generate).expect(403);
      await http().post('/heats/generate').set(bearer(tB)).send(generate).expect(403);
      const ok = await http().post('/heats/generate').set(bearer(tA)).send(generate).expect(201);
      expect(ok.body.success).toBe(true);
    });

    it('leitura de baterias: pública em campeonato live, restrita em draft', async () => {
      await http().get('/heats/game/G1/workout/1').expect(200);
      await ctx.prisma.game.update({ where: { code: 'G1' }, data: { status: 'draft' } });
      await http().get('/heats/game/G1/workout/1').expect(404);
      await http().get('/heats/game/G1/workout/1').set(bearer(tA)).expect(200);
    });

    it('status e troca de raias: respeitam papel e vínculo; ids inexistentes retornam 404', async () => {
      // a bateria precisa de duas equipes para ter dois slots a trocar
      await ctx.prisma.registration.create({
        data: { code: 102, categoryId: 1, gameCode: 'G1', team: 'Time B' },
      });
      const gen = await http().post('/heats/generate').set(bearer(tA)).send({ ...generate, totalLanes: 2 }).expect(201);
      const heat = gen.body.heats[0];
      const [slotA, slotB] = heat.slots;

      await http().patch(`/heats/${heat.id}/status`).set(bearer(tAthlete)).send({ status: 'calling' }).expect(403);
      await http().patch(`/heats/${heat.id}/status`).set(bearer(tB)).send({ status: 'calling' }).expect(403);
      await http().patch(`/heats/${heat.id}/status`).set(bearer(tJudge)).send({ status: 'calling' }).expect(200);

      await http().post('/heats/swap-lanes').set(bearer(tB)).send({ slotIdA: slotA.id, slotIdB: slotB.id }).expect(403);
      await http().post('/heats/swap-lanes').set(bearer(tA)).send({ slotIdA: slotA.id, slotIdB: slotB.id }).expect(201);

      await http().patch('/heats/nao-existe/status').set(bearer(tA)).send({ status: 'calling' }).expect(404);
      await http().post('/heats/swap-lanes').set(bearer(tA)).send({ slotIdA: 'x', slotIdB: 'y' }).expect(404);
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd /d/Projects/fitness/itgames/itgames-api && npm run test:e2e -- field-ops
```
Expected: FAIL (as rotas ainda não exigem papéis).

- [ ] **Step 3: `ScoresService`**

Em `itgames-api/src/modules/scores/scores.service.ts`:

- Altere a assinatura de `createOrUpdateScore` para:
```ts
  async createOrUpdateScore(dto: CreateScoreDto, actorName: string, actorRole: string, ipAddress?: string) {
```
- No `this.prisma.auditLog.create` de `createOrUpdateScore`, troque `changedBy: actorName || dto.judge,` por `changedBy: actorName,` e adicione `ipAddress,` ao objeto `data` (depois de `reason`).
- Altere `attachPhoto` para:
```ts
  async attachPhoto(scoreCode: number, photoUrlOrBase64: string, actorName: string, ipAddress?: string) {
    await this.getScoreGameCode(scoreCode);

    const score = await this.prisma.score.update({
      where: { code: scoreCode },
      data: { photo: photoUrlOrBase64 },
    });

    await this.prisma.auditLog.create({
      data: {
        gameCode: score.game,
        scoreId: score.code,
        changedBy: actorName,
        role: 'judge',
        action: 'photo_attached',
        reason: 'Foto comprovante da súmula anexada',
        ipAddress,
      },
    });

    return { success: true, score };
  }

  async getScoreGameCode(scoreCode: number): Promise<string> {
    const score = await this.prisma.score.findUnique({ where: { code: scoreCode }, select: { game: true } });
    if (!score) throw new NotFoundException('Score não encontrado');
    return score.game;
  }
```
(`NotFoundException` já está importado no arquivo.) Para o log de foto registrar o papel real, use a assinatura final `attachPhoto(scoreCode, photo, actorName, actorRole, ipAddress?)`: acrescente o parâmetro `actorRole: string` depois de `actorName` e troque `role: 'judge'` por `role: actorRole` no `auditLog.create`. O controller abaixo já chama com essa assinatura.

- [ ] **Step 4: `ScoresController`**

Substitua `itgames-api/src/modules/scores/scores.controller.ts`:
```ts
import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { GameAccessService } from '../../common/access/game-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { AuthUser } from '../../common/types/auth-user';
import { CreateScoreDto } from './dto/create-score.dto';
import { ScoresService } from './scores.service';

@ApiTags('Scores & Súmulas')
@ApiBearerAuth()
@Controller('scores')
export class ScoresController {
  constructor(
    private readonly scoresService: ScoresService,
    private readonly access: GameAccessService,
  ) {}

  @Roles(UserRole.JUDGE, UserRole.ORGANIZER)
  @Post()
  @ApiOperation({ summary: 'Lançar ou atualizar score com foto e auditoria' })
  @ApiResponse({ status: 201, description: 'Score processado com sucesso' })
  async createScore(@Body() dto: CreateScoreDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    if (user.role === UserRole.ORGANIZER) {
      await this.access.assertCanManage(user, dto.game);
    }
    return this.scoresService.createOrUpdateScore(dto, user.name, user.role.toLowerCase(), req.ip);
  }

  @Roles(UserRole.ORGANIZER)
  @Get('game/:gameCode')
  @ApiOperation({ summary: 'Listar scores de uma competição com histórico de auditoria' })
  async getScoresByGame(@Param('gameCode') gameCode: string, @CurrentUser() user: AuthUser) {
    await this.access.assertCanManage(user, gameCode);
    return this.scoresService.findByGame(gameCode);
  }

  @Roles(UserRole.JUDGE, UserRole.ORGANIZER)
  @Patch(':code/photo')
  @ApiOperation({ summary: 'Anexar foto da súmula de campo a um score existente' })
  async attachPhoto(
    @Param('code') code: string,
    @Body('photo') photo: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const scoreCode = Number(code);
    if (user.role === UserRole.ORGANIZER) {
      await this.access.assertCanManage(user, await this.scoresService.getScoreGameCode(scoreCode));
    }
    return this.scoresService.attachPhoto(scoreCode, photo, user.name, user.role.toLowerCase(), req.ip);
  }
}
```
Nota: `GET /scores/game/:gameCode` usa `@Roles(UserRole.ORGANIZER)`; o `RolesGuard` já deixa o super admin passar, e `assertCanManage` bloqueia organizador não vinculado.

- [ ] **Step 5: `HeatsService` e `HeatsController`**

Em `itgames-api/src/modules/heats/heats.service.ts`: troque `import { Injectable } from '@nestjs/common';` por `import { Injectable, NotFoundException } from '@nestjs/common';`, troque o `throw new Error('Slots de raia não encontrados');` de `swapLanes` por `throw new NotFoundException('Slots de raia não encontrados');` e adicione ao final da classe (antes do `}` de fechamento):
```ts
  async gameCodeOfHeat(heatId: string): Promise<string> {
    const heat = await this.prisma.heat.findUnique({ where: { id: heatId }, select: { gameCode: true } });
    if (!heat) throw new NotFoundException('Bateria não encontrada');
    return heat.gameCode;
  }

  async gameCodeOfSlot(slotId: string): Promise<string> {
    const slot = await this.prisma.laneSlot.findUnique({ where: { id: slotId }, select: { gameCode: true } });
    if (!slot) throw new NotFoundException('Slot de raia não encontrado');
    return slot.gameCode;
  }
```

Substitua `itgames-api/src/modules/heats/heats.controller.ts`:
```ts
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GameAccessService } from '../../common/access/game-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { AuthUser } from '../../common/types/auth-user';
import { HeatsService } from './heats.service';

@ApiTags('Baterias & Raias')
@ApiBearerAuth()
@Controller('heats')
export class HeatsController {
  constructor(
    private readonly heatsService: HeatsService,
    private readonly access: GameAccessService,
  ) {}

  @Roles(UserRole.ORGANIZER)
  @Post('generate')
  @ApiOperation({ summary: 'Gerar baterias e raias automaticamente com opção de Seeding de Final' })
  async generateHeats(
    @Body()
    body: {
      gameCode: string;
      categoryId: number;
      workoutCode: number;
      totalLanes: number;
      startHour: string;
      intervalMinutes: number;
      isFinalSeeding?: boolean;
    },
    @CurrentUser() user: AuthUser,
  ) {
    await this.access.assertCanManage(user, body.gameCode);
    return this.heatsService.generateHeats(body);
  }

  @Roles(UserRole.ORGANIZER)
  @Post('swap-lanes')
  @ApiOperation({ summary: 'Trocar raias entre dois atletas de uma bateria' })
  async swapLanes(@Body() body: { slotIdA: string; slotIdB: string }, @CurrentUser() user: AuthUser) {
    const gameCode = await this.heatsService.gameCodeOfSlot(body.slotIdA);
    await this.access.assertCanManage(user, gameCode);
    return this.heatsService.swapLanes(body);
  }

  @Public()
  @Get('game/:gameCode/workout/:workoutCode')
  @ApiOperation({ summary: 'Listar baterias por evento e workout (público se o campeonato estiver live)' })
  async getHeats(
    @Param('gameCode') gameCode: string,
    @Param('workoutCode') workoutCode: string,
    @CurrentUser() user?: AuthUser,
  ) {
    await this.access.assertCanView(user, gameCode);
    return this.heatsService.findByGameAndWorkout(gameCode, Number(workoutCode));
  }

  @Roles(UserRole.JUDGE, UserRole.ORGANIZER)
  @Patch(':id/status')
  @ApiOperation({ summary: 'Atualizar status da bateria (scheduled, calling, in_progress, completed)' })
  async updateStatus(@Param('id') id: string, @Body('status') status: string, @CurrentUser() user: AuthUser) {
    const gameCode = await this.heatsService.gameCodeOfHeat(id);
    if (user.role === UserRole.ORGANIZER) {
      await this.access.assertCanManage(user, gameCode);
    }
    return this.heatsService.updateStatus(id, status);
  }
}
```

- [ ] **Step 6: `AuditController`**

Substitua `itgames-api/src/modules/audit/audit.controller.ts`:
```ts
import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GameAccessService } from '../../common/access/game-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { AuthUser } from '../../common/types/auth-user';
import { AuditService } from './audit.service';

@ApiTags('Auditoria & Logs Imutáveis')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly access: GameAccessService,
  ) {}

  @Roles(UserRole.ORGANIZER)
  @Get('game/:gameCode')
  @ApiOperation({ summary: 'Consultar trilha de auditoria de um evento (organizador do campeonato / super admin)' })
  async getLogs(@Param('gameCode') gameCode: string, @CurrentUser() user: AuthUser) {
    await this.access.assertCanManage(user, gameCode);
    return this.auditService.getAuditLogs(gameCode);
  }
}
```

- [ ] **Step 7: Rodar a suíte inteira**

```bash
cd /d/Projects/fitness/itgames/itgames-api && npm run test:e2e && npm run build
```
Expected: todos os arquivos passam e o build conclui. (O teste de troca obrigatória em `auth.e2e-spec.ts` usa `/scores/game/X` e só confere que o código **não** é `PASSWORD_CHANGE_REQUIRED` depois da troca — continua válido.)

- [ ] **Step 8: Marcar checkboxes desta tarefa.**

---

## Task 8: Seed, variáveis de ambiente, docker-compose e remoção definitiva de `organizerId`

**Files:**
- Modify: `itgames-api/prisma/seed.ts`
- Modify: `itgames-api/prisma/seed.js`
- Modify: `itgames-api/prisma/schema.prisma` (remoção de `organizerId`, `organizer`, `managedGames`)
- Modify: `itgames-api/.env` (apenas as linhas `CORS_ORIGIN` e `JWT_SECRET`)
- Create: `D:\Projects\fitness\itgames\.env` (variáveis do docker compose)
- Modify: `D:\Projects\fitness\itgames\docker-compose.yml`

**Interfaces:**
- Consumes: modelo `GameOrganizer` (Task 1), código sem `organizerId` (Tasks 3–7).
- Produces: schema final sem `Game.organizerId`; compose exige `JWT_SECRET`.

- [ ] **Step 1: Seed — vínculo no lugar de `organizerId`**

Em `itgames-api/prisma/seed.ts`, no `prisma.game.upsert` do `ITGAMES2026`, **remova** a linha `organizerId: organizerUser.id,` do bloco `create`, e logo depois do `upsert` (antes do comentário `// 6. Categorias ...`) adicione:
```ts
  // Vínculo do organizador ao campeonato (N:N)
  await prisma.gameOrganizer.upsert({
    where: { gameCode_userId: { gameCode: game.code, userId: organizerUser.id } },
    update: {},
    create: { gameCode: game.code, userId: organizerUser.id },
  });
```

Em `itgames-api/prisma/seed.js` (versão compilada do seed), substitua a linha `organizerId: organizerUser.id,` por:
```js
            organizers: { create: [{ userId: organizerUser.id }] },
```
(mantendo a indentação do bloco `create` do `game`).

- [ ] **Step 2: Gerar o `JWT_SECRET` e ajustar os `.env`**

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Copie o valor impresso (não o registre em arquivos versionados nem em logs). Crie `D:\Projects\fitness\itgames\.env` (lido pelo docker compose) com:
```
JWT_SECRET=<valor gerado>
CORS_ORIGIN=http://localhost:3000
```
Em `itgames-api/.env`, adicione `JWT_SECRET=<mesmo valor>` e troque a linha `CORS_ORIGIN=...` por `CORS_ORIGIN=http://localhost:3000`. Se o frontend for acessado por outro endereço (VPN, IP da rede), acrescente-o separado por vírgula, ex.: `http://localhost:3000,http://192.168.0.10:3000`.

- [ ] **Step 3: `docker-compose.yml`**

No serviço `api`, em `environment`, substitua `CORS_ORIGIN: "*"` por:
```yaml
      CORS_ORIGIN: "${CORS_ORIGIN:-http://localhost:3000}"
      JWT_SECRET: "${JWT_SECRET:?Defina JWT_SECRET no arquivo .env da raiz}"
```

- [ ] **Step 4: Confirmar que nada em `src/` ainda usa `organizerId`/`managedGames`/`organizer`**

```bash
cd /d/Projects/fitness/itgames/itgames-api && grep -rn "organizerId\|managedGames\|\.organizer\b\|organizer:" src prisma/seed.ts
```
Expected: sem resultados. Se aparecer algo, corrija antes de seguir.

- [ ] **Step 5: Remover os campos do schema**

Em `itgames-api/prisma/schema.prisma`:
- No `model User`: apague a linha `managedGames  Game[]         @relation("OrganizerGames")`.
- No `model Game`: apague as linhas `organizerId           String?` e `organizer             User?          @relation("OrganizerGames", fields: [organizerId], references: [id], onDelete: SetNull)`.

- [ ] **Step 6: Banco de testes e build**

```bash
cd /d/Projects/fitness/itgames/itgames-api && npx prisma generate && npm run build && npm run test:e2e
```
Expected: build ok e a suíte inteira passa (o setup global aplica o schema final no `itgames_test`).

- [ ] **Step 7: PARAR — pedir confirmação ao usuário antes de alterar o banco real**

O `db push` abaixo remove a coluna `games.organizerId` do banco real. Confirme com o usuário que (a) o backup `backups/itgames_db-pre-organizers-2026-10-05.sql` existe e (b) a contagem de vínculos da Task 1 Step 5 estava correta. Revalide a contagem agora:
```bash
docker exec itgames-postgres psql -U itgames_user -d itgames_db -c "SELECT (SELECT count(*) FROM games WHERE \"organizerId\" IS NOT NULL) AS campeonatos_com_organizador, (SELECT count(*) FROM games_organizers) AS vinculos;"
```
Só prossiga com o "sim" explícito do usuário e se `vinculos >= campeonatos_com_organizador`.

- [ ] **Step 8: Aplicar no banco real**

```bash
cd /d/Projects/fitness/itgames/itgames-api && npx prisma db push --accept-data-loss
```
Expected: `Your database is now in sync`. O flag só autoriza o descarte da coluna `organizerId` já copiada; **não** use `--force-reset`.

- [ ] **Step 9: Reconstruir e subir a stack**

```bash
cd /d/Projects/fitness/itgames && docker compose up -d --build api && docker compose logs --tail 20 api
```
Expected: log `ITGames Arena API rodando`. Teste rápido:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3334/events
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:3334/events/QUALQUER
```
Expected: `200` e `401`.

- [ ] **Step 10: Marcar checkboxes desta tarefa.**

---

## Task 9: Frontend — sessão derivada do JWT, `api-client` estrito, login e troca de senha

**Files:**
- Modify: `itgames-platform/src/lib/acl.ts`
- Modify: `itgames-platform/src/lib/api-client.ts`
- Delete: `itgames-platform/src/components/auth/AuthUserModal.tsx`
- Modify: `itgames-platform/src/components/auth/AclGuard.tsx`
- Modify: `itgames-platform/src/app/login/page.tsx`
- Create: `itgames-platform/src/app/trocar-senha/page.tsx`

**Interfaces:**
- Consumes: respostas da API (Tasks 3–5).
- Produces (`src/lib/acl.ts`):
  - `saveSession(res: { accessToken: string; user: { id; name; email; role; mustChangePassword?: boolean } }): void`
  - `getAuthToken(): string | null` (nulo se ausente ou expirado)
  - `getCurrentUserSession(): UserSession` (agora com `mustChangePassword?: boolean`)
  - `homeForRole(role: UserRoleType): string`
  - `logoutUser(): void`
- Produces (`src/lib/api-client.ts`): `class ApiError extends Error { status: number; code?: string }`, `OrganizerUser`, métodos estritos (lançam `ApiError`): `login`, `register`, `getMe`, `changePassword(currentPassword, newPassword)`, `listMyGames()`, `createGame`, `updateGame`, `updateGameStatus`, `deleteGame`, `listOrganizers()`, `createOrganizer({ name, email, phoneNumber })`, `resetOrganizerPassword(id)`, `addGameOrganizer(code, userId)`, `removeGameOrganizer(code, userId)`, `registerTeam`, `submitScore`. Os demais métodos continuam devolvendo `null` em erro (comportamento atual), mas agora enviam `Authorization`. `listGames()` perde os parâmetros.

- [ ] **Step 1: Baseline de tipos e lint**

```bash
cd /d/Projects/fitness/itgames/itgames-platform && npx tsc --noEmit 2>&1 | tail -20; npm run lint 2>&1 | tail -20
```
Registre os erros que já existem antes das mudanças (para não confundir com regressões). Confirme também que `src/components/auth/AuthUserModal.tsx` não é importado:
```bash
grep -rn "AuthUserModal\|AuthUserButton" src
```
Expected: só o próprio arquivo aparece. Se aparecer um import em outro arquivo, **não** exclua o arquivo; pare e avise o usuário.

- [ ] **Step 2: Substituir `src/lib/acl.ts`**

```ts
export type UserRoleType = 'SUPER_ADMIN' | 'ORGANIZER' | 'JUDGE' | 'ATHLETE' | 'GUEST';

export interface UserSession {
  id?: string;
  name?: string;
  email?: string;
  role: UserRoleType;
  token?: string;
  mustChangePassword?: boolean;
}

interface StoredSession {
  token: string;
  user: { id: string; name: string; email: string; role: UserRoleType; mustChangePassword?: boolean };
}

const SESSION_KEY = 'itgames_session';
// Chaves antigas, removidas no logout e ignoradas na leitura
const LEGACY_KEYS = [
  'itgames_user_role',
  'itgames_user_email',
  'itgames_user_name',
  'itgames_user_id',
  'itgames_auth_token',
  'itgames_current_user',
  'itgames_jwt_token',
];

function decodeExp(token: string): number | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(payload));
    return typeof json.exp === 'number' ? json.exp : null;
  } catch {
    return null;
  }
}

function readStored(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredSession;
    const exp = decodeExp(stored.token);
    if (!exp || exp * 1000 <= Date.now()) return null;
    return stored;
  } catch {
    return null;
  }
}

export function saveSession(res: { accessToken: string; user: StoredSession['user'] }): void {
  if (typeof window === 'undefined') return;
  const stored: StoredSession = {
    token: res.accessToken,
    user: {
      id: res.user.id,
      name: res.user.name,
      email: res.user.email,
      role: res.user.role,
      mustChangePassword: !!res.user.mustChangePassword,
    },
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
  window.dispatchEvent(new Event('itgames_auth_changed'));
}

export function getAuthToken(): string | null {
  return readStored()?.token ?? null;
}

export function getCurrentUserSession(): UserSession {
  const stored = readStored();
  if (!stored) return { role: 'GUEST' };
  return {
    id: stored.user.id,
    name: stored.user.name,
    email: stored.user.email,
    role: stored.user.role,
    token: stored.token,
    mustChangePassword: stored.user.mustChangePassword,
  };
}

export function logoutUser() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
  LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
  window.dispatchEvent(new Event('itgames_auth_changed'));
}

export function homeForRole(role: UserRoleType): string {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ORGANIZER':
      return '/admin';
    case 'JUDGE':
      return '/judge';
    case 'ATHLETE':
      return '/athlete';
    default:
      return '/login';
  }
}

export function hasPermission(role: UserRoleType, resource: 'admin' | 'judge' | 'athlete' | 'heats' | 'sumulas' | 'superadmin' | 'public'): boolean {
  if (role === 'SUPER_ADMIN') return true;

  switch (resource) {
    case 'public':
      return true;
    case 'athlete':
      return role === 'ATHLETE' || role === 'SUPER_ADMIN' || role === 'ORGANIZER';
    case 'judge':
      return role === 'JUDGE' || role === 'ORGANIZER' || role === 'SUPER_ADMIN';
    case 'heats':
    case 'sumulas':
    case 'admin':
      return role === 'ORGANIZER' || role === 'SUPER_ADMIN';
    case 'superadmin':
      return role === 'SUPER_ADMIN';
    default:
      return false;
  }
}
```
(O arquivo antigo importava `UserRole` de `@/types` sem usá-lo; o import foi removido.)

- [ ] **Step 3: `api-client.ts` — cabeçalho, erro estrito e métodos novos**

Em `itgames-platform/src/lib/api-client.ts`:

(a) Substitua o import e a classe até o fim do método `request` (isto é, tudo desde `import { ScoreEntry ...` até o `}` que fecha `private async request`) por:
```ts
import { AuditLogEntry, Heat } from '@/types';
import { getAuthToken, logoutUser } from './acl';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3334';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface OrganizerUser {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string | null;
  mustChangePassword?: boolean;
  createdAt?: string;
  _count?: { organizedGames: number };
}

export class ApiClient {
  private send(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = getAuthToken();
    return fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  }

  private handleUnauthorized() {
    // 401 com sessão ativa = token expirado/revogado
    if (typeof window !== 'undefined' && getAuthToken()) {
      logoutUser();
      window.location.assign('/login');
    }
  }

  // Modo tolerante (comportamento histórico): erro vira null
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
    try {
      const response = await this.send(endpoint, options);
      if (!response.ok) {
        if (response.status === 401) this.handleUnauthorized();
        console.warn(`[API] Endpoint ${endpoint} retornou status ${response.status}`);
        return null;
      }
      return await response.json();
    } catch {
      console.warn(`[API] Falha de conexão com backend ${API_BASE_URL}${endpoint}.`);
      return null;
    }
  }

  // Modo estrito: erro vira ApiError com a mensagem da API
  private async strict<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await this.send(endpoint, options);
    } catch {
      throw new ApiError(0, 'Não foi possível conectar ao servidor. Verifique sua conexão.');
    }

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const code = body?.code;
      if (code === 'PASSWORD_CHANGE_REQUIRED' && typeof window !== 'undefined') {
        window.location.assign('/trocar-senha');
      } else if (response.status === 401) {
        this.handleUnauthorized();
      }
      const message = Array.isArray(body?.message)
        ? body.message.join(', ')
        : body?.message || `Erro ${response.status}`;
      throw new ApiError(response.status, message, code);
    }
    return body as T;
  }
```

(b) Substitua os métodos de autenticação (`login`, `register`, `getMe`) por:
```ts
  // 0. Autenticação & Usuários
  async login(email: string, password: string): Promise<any> {
    return this.strict<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(userData: {
    email: string;
    password: string;
    name: string;
    cpf?: string;
    phoneNumber?: string;
    birthDate?: string;
    gender?: string;
    boxOrGym?: string;
    tshirtSize?: string;
  }): Promise<any> {
    return this.strict<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async getMe(): Promise<any> {
    return this.strict<any>('/auth/me');
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<any> {
    return this.strict<any>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // Organizadores (Super Admin)
  async listOrganizers(): Promise<OrganizerUser[]> {
    return this.strict<OrganizerUser[]>('/users/organizers');
  }

  async createOrganizer(data: { name: string; email: string; phoneNumber: string }): Promise<{ user: OrganizerUser; temporaryPassword: string }> {
    return this.strict('/users/organizers', { method: 'POST', body: JSON.stringify(data) });
  }

  async resetOrganizerPassword(id: string): Promise<{ user: OrganizerUser; temporaryPassword: string }> {
    return this.strict(`/users/organizers/${id}/reset-password`, { method: 'POST' });
  }
```

(c) Substitua o bloco de campeonatos (`listGames` até `deleteGame`) por:
```ts
  // 1. Campeonatos / Eventos
  async listGames(): Promise<any[] | null> {
    return this.request<any[]>('/events');
  }

  async listMyGames(): Promise<any[]> {
    return this.strict<any[]>('/events/mine');
  }

  async getGame(code: string): Promise<any | null> {
    return this.request<any>(`/events/${code}`);
  }

  async createGame(gameData: {
    code: string;
    name: string;
    date?: string;
    description?: string;
    location?: string;
    foto?: string;
    isLowestPointsBetter?: boolean;
    showTime?: boolean;
    showWeight?: boolean;
    showReps?: boolean;
    showScoreRevision?: boolean;
    lanesCount?: number;
    eventType?: string;
  }) {
    return this.strict<any>('/events', {
      method: 'POST',
      body: JSON.stringify(gameData),
    });
  }

  async updateGame(code: string, gameData: any) {
    return this.strict<any>(`/events/${code}`, {
      method: 'PUT',
      body: JSON.stringify(gameData),
    });
  }

  async updateGameStatus(code: string, status: string) {
    return this.strict<any>(`/events/${code}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async deleteGame(code: string) {
    return this.strict<any>(`/events/${code}`, { method: 'DELETE' });
  }

  async addGameOrganizer(code: string, userId: string): Promise<OrganizerUser[]> {
    return this.strict<OrganizerUser[]>(`/events/${code}/organizers`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async removeGameOrganizer(code: string, userId: string): Promise<OrganizerUser[]> {
    return this.strict<OrganizerUser[]>(`/events/${code}/organizers/${userId}`, { method: 'DELETE' });
  }
```

(d) Em `registerTeam` troque `this.request<any>` por `this.strict<any>`. Em `submitScore` substitua o corpo por:
```ts
  async submitScore(scoreData: any) {
    const result = await this.strict<any>('/scores', {
      method: 'POST',
      body: JSON.stringify(scoreData),
    });
    return result?.score || scoreData;
  }
```

(e) Verifique o tipo: `npx tsc --noEmit` (os erros novos aparecerão nas páginas que ainda chamam a API antiga; serão corrigidos nas Tasks 9–11).

- [ ] **Step 4: Excluir o código morto**

```bash
rm "D:/Projects/fitness/itgames/itgames-platform/src/components/auth/AuthUserModal.tsx"
```

- [ ] **Step 5: `AclGuard` — redirecionar troca de senha pendente**

Em `itgames-platform/src/components/auth/AclGuard.tsx`, dentro do `checkAuth` do `useEffect`, logo depois de `const session = getCurrentUserSession();`, adicione:
```ts
      if (session.role !== 'GUEST' && session.mustChangePassword) {
        router.replace('/trocar-senha');
        return;
      }
```

- [ ] **Step 6: Login — sem fallbacks locais**

Em `itgames-platform/src/app/login/page.tsx`:

(a) Troque o import `import { apiClient } from '@/lib/api-client';` por:
```ts
import { apiClient, ApiError } from '@/lib/api-client';
import { homeForRole, saveSession } from '@/lib/acl';
```

(b) Substitua **todo** o `handleLoginSubmit` (comentário `// 1. Executar Login Real...` até o `};` que o fecha, incluindo os três "Fallback" que concediam papel sem senha) por:
```ts
  // 1. Login real: o papel vem sempre do JWT emitido pela API
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      toast.error('Informe seu e-mail e senha');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.login(loginEmail.trim(), loginPassword);
      saveSession(res);

      if (res.user.mustChangePassword) {
        toast.info('Defina uma nova senha para continuar.');
        router.push('/trocar-senha');
        return;
      }

      toast.success(`Bem-vindo de volta, ${res.user.name}!`);
      router.push(homeForRole(res.user.role));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao entrar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };
```

(c) Substitua **todo** o `handleRegisterAthlete` por:
```ts
  // 2. Cadastro Exclusivo de Atleta Competidor (a API sempre cria ATHLETE)
  const handleRegisterAthlete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!athName.trim() || !athEmail.trim() || !athPassword.trim()) {
      toast.error('Preencha os campos obrigatórios (Nome, E-mail e Senha)');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.register({
        name: athName,
        email: athEmail,
        password: athPassword,
        cpf: athCpf ? athCpf.replace(/\D/g, '') : undefined,
        phoneNumber: athPhone,
        birthDate: athBirthDate,
        gender: athGender,
        boxOrGym: athBox,
        tshirtSize: athTshirtSize,
      });
      saveSession(res);
      toast.success(`Conta de Atleta criada com sucesso! Bem-vindo, ${athName}!`);
      router.push('/athlete');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao criar a conta. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };
```

(d) Procure no JSX do login qualquer texto que cite contas de teste/senhas (`grep -n "SenhaForte\|Adm@" src/app/login/page.tsx`) e remova esses blocos.

- [ ] **Step 7: Página `/trocar-senha`**

Antes de criar, leia no guia local do Next 16 (`node_modules/next/dist/docs/`) a seção de páginas/`'use client'` e confira que o padrão abaixo (igual ao de `src/app/login/page.tsx`) continua válido.

`itgames-platform/src/app/trocar-senha/page.tsx`:
```tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiError } from '@/lib/api-client';
import { getCurrentUserSession, homeForRole, saveSession } from '@/lib/acl';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (getCurrentUserSession().role === 'GUEST') {
      router.replace('/login');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('A nova senha deve ter no mínimo 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('A confirmação não confere com a nova senha');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.changePassword(currentPassword, newPassword);
      saveSession(res);
      toast.success('Senha atualizada com sucesso!');
      router.push(homeForRole(res.user.role));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível trocar a senha');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500';

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 p-8 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl"
      >
        <div className="space-y-1 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black text-white">Defina sua nova senha</h1>
          <p className="text-xs text-zinc-400">
            Por segurança, troque a senha temporária recebida do administrador antes de continuar.
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-bold text-zinc-300">Senha atual (temporária)</span>
          <div className="relative">
            <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </div>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-bold text-zinc-300">Nova senha (mínimo 8 caracteres)</span>
          <div className="relative">
            <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
            />
          </div>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-bold text-zinc-300">Confirmar nova senha</span>
          <div className="relative">
            <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
            />
          </div>
        </label>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-sm disabled:opacity-60"
        >
          {isLoading ? 'Salvando...' : 'Salvar nova senha'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 8: Verificação**

```bash
cd /d/Projects/fitness/itgames/itgames-platform && npx tsc --noEmit 2>&1 | tail -30
```
Expected: sem erros **novos** em relação ao baseline do Step 1, exceto os que as Tasks 10–11 corrigem (chamadas a `listGames(undefined, role)` em `admin/page.tsx` e uso de `res.user`/retorno de `registerTeam`/`submitScore`). Anote-os e siga.

- [ ] **Step 9: Marcar checkboxes desta tarefa.**

---

## Task 10: Frontend — área do organizador e do super admin (`/admin`)

**Files:**
- Modify: `itgames-platform/src/types/index.ts` (linha ~236)
- Create: `itgames-platform/src/components/admin/OrganizersPanel.tsx`
- Create: `itgames-platform/src/components/admin/GameOrganizersModal.tsx`
- Modify: `itgames-platform/src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `apiClient.listMyGames`, `createGame`, `updateGameStatus`, `deleteGame`, `listOrganizers`, `createOrganizer`, `resetOrganizerPassword`, `addGameOrganizer`, `removeGameOrganizer`, `getGame`, `ApiError`, `OrganizerUser`, `getCurrentUserSession`.
- Produces: `<OrganizersPanel />` (sem props), `<GameOrganizersModal game={{ code: string; name: string }} onClose={() => void} onChanged={() => void} />`.

- [ ] **Step 1: Tipo `organizers` no `GameEvent`**

Em `itgames-platform/src/types/index.ts`, troque a linha `organizer?: { id: string; name: string; email: string };` por:
```ts
  organizers?: { id: string; name: string; email?: string; phoneNumber?: string | null }[];
```

- [ ] **Step 2: Painel "Organizadores" (super admin)**

`itgames-platform/src/components/admin/OrganizersPanel.tsx`:
```tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Copy, KeyRound, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiError, OrganizerUser } from '@/lib/api-client';

interface IssuedPassword {
  name: string;
  email: string;
  password: string;
}

export function OrganizersPanel() {
  const [organizers, setOrganizers] = useState<OrganizerUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [issued, setIssued] = useState<IssuedPassword | null>(null);

  const load = useCallback(async () => {
    try {
      setOrganizers(await apiClient.listOrganizers());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao carregar organizadores');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await apiClient.createOrganizer({ name, email, phoneNumber: phone });
      setIssued({ name: res.user.name, email: res.user.email, password: res.temporaryPassword });
      setName('');
      setEmail('');
      setPhone('');
      toast.success('Organizador cadastrado!');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao cadastrar organizador');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async (org: OrganizerUser) => {
    if (!confirm(`Gerar nova senha temporária para ${org.name}? A senha atual deixará de funcionar.`)) return;
    try {
      const res = await apiClient.resetOrganizerPassword(org.id);
      setIssued({ name: res.user.name, email: res.user.email, password: res.temporaryPassword });
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao redefinir a senha');
    }
  };

  const copyPassword = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.password);
      toast.success('Senha copiada!');
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie manualmente.');
    }
  };

  const inputClass =
    'w-full bg-zinc-950 border border-zinc-700 text-sm text-white rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500';

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleCreate}
        className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
      >
        <label className="space-y-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase">Nome</span>
          <input className={inputClass} required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase">E-mail</span>
          <input className={inputClass} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase">Telefone</span>
          <input className={inputClass} required value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black text-xs flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <UserPlus className="w-4 h-4" />
          <span>{isSaving ? 'Cadastrando...' : 'Cadastrar organizador'}</span>
        </button>
      </form>

      {issued && (
        <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/40 space-y-3">
          <div className="text-sm font-black text-amber-300">Senha temporária de {issued.name}</div>
          <p className="text-xs text-zinc-300">
            Repasse ao organizador ({issued.email}). Ela só é exibida agora e precisará ser trocada no primeiro acesso.
          </p>
          <div className="flex items-center gap-2">
            <code className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-amber-300 font-mono text-base select-all">
              {issued.password}
            </code>
            <button
              onClick={copyPassword}
              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white flex items-center gap-1.5"
            >
              <Copy className="w-4 h-4" />
              <span>Copiar</span>
            </button>
            <button onClick={() => setIssued(null)} className="px-3 py-2 text-xs text-zinc-400 hover:text-white underline">
              Fechar
            </button>
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-zinc-900 border border-zinc-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-zinc-400 uppercase text-[10px] border-b border-zinc-800">
              <th className="py-3 px-4">Nome</th>
              <th className="py-3 px-4">E-mail</th>
              <th className="py-3 px-4">Telefone</th>
              <th className="py-3 px-4 text-center">Campeonatos</th>
              <th className="py-3 px-4 text-center">Acesso</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-zinc-500">
                  Carregando...
                </td>
              </tr>
            )}
            {!isLoading && organizers.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-zinc-500">
                  Nenhum organizador cadastrado.
                </td>
              </tr>
            )}
            {organizers.map((o) => (
              <tr key={o.id} className="border-b border-zinc-800/60 text-zinc-200">
                <td className="py-3 px-4 font-bold">{o.name}</td>
                <td className="py-3 px-4 font-mono">{o.email}</td>
                <td className="py-3 px-4">{o.phoneNumber || '—'}</td>
                <td className="py-3 px-4 text-center">{o._count?.organizedGames ?? 0}</td>
                <td className="py-3 px-4 text-center">
                  {o.mustChangePassword ? (
                    <span className="text-amber-400 font-bold">Aguardando 1º acesso</span>
                  ) : (
                    <span className="text-emerald-400 font-bold">Ativo</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => handleReset(o)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-[11px] font-bold inline-flex items-center gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Nova senha</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Modal de organizadores do campeonato**

`itgames-platform/src/components/admin/GameOrganizersModal.tsx`:
```tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Trash2, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiError, OrganizerUser } from '@/lib/api-client';

interface Props {
  game: { code: string; name: string };
  onClose: () => void;
  onChanged: () => void;
}

export function GameOrganizersModal({ game, onClose, onChanged }: Props) {
  const [linked, setLinked] = useState<OrganizerUser[]>([]);
  const [all, setAll] = useState<OrganizerUser[]>([]);
  const [selected, setSelected] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [detail, organizers] = await Promise.all([apiClient.getGame(game.code), apiClient.listOrganizers()]);
      setLinked(detail?.organizers || []);
      setAll(organizers);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao carregar organizadores');
    } finally {
      setIsLoading(false);
    }
  }, [game.code]);

  useEffect(() => {
    load();
  }, [load]);

  const available = all.filter((o) => !linked.some((l) => l.id === o.id));

  const handleAdd = async () => {
    if (!selected) return;
    try {
      setLinked(await apiClient.addGameOrganizer(game.code, selected));
      setSelected('');
      onChanged();
      toast.success('Organizador vinculado ao campeonato');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao vincular organizador');
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      setLinked(await apiClient.removeGameOrganizer(game.code, userId));
      onChanged();
      toast.success('Organizador desvinculado');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao desvincular organizador');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-3xl p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-white">Organizadores do campeonato</h3>
            <p className="text-xs text-zinc-400">
              {game.name} ({game.code})
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <ul className="space-y-2">
          {isLoading && <li className="text-xs text-zinc-500">Carregando...</li>}
          {!isLoading && linked.length === 0 && (
            <li className="text-xs text-zinc-500">Nenhum organizador vinculado. Só o super admin gerencia este campeonato.</li>
          )}
          {linked.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
              <div>
                <div className="text-sm font-bold text-white">{o.name}</div>
                <div className="text-[11px] text-zinc-400 font-mono">{o.email}</div>
              </div>
              <button
                onClick={() => handleRemove(o.id)}
                className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                title="Desvincular"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 bg-zinc-950 border border-zinc-700 text-sm text-white rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
          >
            <option value="">Selecione um organizador...</option>
            {available.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} — {o.email}
              </option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!selected}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />
            <span>Vincular</span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `admin/page.tsx` — imports e papel vindo da sessão**

Em `itgames-platform/src/app/admin/page.tsx`:

(a) Junto dos imports existentes, adicione:
```ts
import { ApiError } from '@/lib/api-client';
import { getCurrentUserSession } from '@/lib/acl';
import { OrganizersPanel } from '@/components/admin/OrganizersPanel';
import { GameOrganizersModal } from '@/components/admin/GameOrganizersModal';
```
(se `apiClient` já é importado de `@/lib/api-client`, apenas acrescente `ApiError` à mesma linha.)

(b) Troque as duas linhas de estado do perfil (`const [userRole, setUserRole] = useState<'SUPER_ADMIN' | 'ORGANIZER'>('SUPER_ADMIN');` e `const [organizerEmail, setOrganizerEmail] = ...`) por:
```ts
  // Papel vem do JWT (sessão); não existe mais alternância manual de perfil
  const [userRole, setUserRole] = useState<'SUPER_ADMIN' | 'ORGANIZER'>('ORGANIZER');
  const [organizersGame, setOrganizersGame] = useState<{ code: string; name: string } | null>(null);
```
Se `organizerEmail`/`setOrganizerEmail` forem usados em outro ponto do arquivo (`grep -n "organizerEmail" src/app/admin/page.tsx`), troque o uso por `getCurrentUserSession().email || ''`.

(c) Amplie o tipo do estado de abas (`const [adminTab, setAdminTab] = useState<...>`) acrescentando `| 'organizers_mgmt'` à união.

(d) Adicione, logo depois das declarações de estado (antes de `loadData`), o efeito que sincroniza o papel:
```ts
  useEffect(() => {
    const sync = () => {
      setUserRole(getCurrentUserSession().role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ORGANIZER');
    };
    sync();
    window.addEventListener('itgames_auth_changed', sync);
    return () => window.removeEventListener('itgames_auth_changed', sync);
  }, []);
```
(Confirme que `useEffect` já é importado de `react`.)

- [ ] **Step 5: `loadData` — campeonatos somente da API**

Substitua o trecho do início de `loadData` (de `const loadData = async (roleOverride?...` até o fim do bloco `if (apiGames && apiGames.length > 0) {...} else {...}`) por:
```ts
  const loadData = async () => {
    // 1. Campeonatos vêm sempre da API (organizador: os seus; super admin: todos)
    let apiGames: any[] = [];
    try {
      apiGames = await apiClient.listMyGames();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao carregar os campeonatos');
    }

    const loadedGames: any[] = apiGames.map((g) => ({
      id: g.code,
      organizationId: 'org_1',
      code: g.code,
      name: g.name,
      description: g.description || '',
      location: g.location || '',
      startDate: g.date || '2026-11-15',
      endDate: g.date || '2026-11-15',
      eventType: g.eventType || 'crossfit',
      status: (g.status as any) || 'draft',
      foto: g.foto || '',
      organizers: g.organizers || [],
      lanesCount: g.lanesCount || 8,
      scoringRules: {
        isLowestPointsBetter: g.isLowestPointsBetter || false,
        showTime: g.showTime !== false,
        showWeight: g.showWeight !== false,
        showReps: g.showReps !== false,
        showScoreRevision: g.showScoreRevision || false,
        hyroxChipTimingEnabled: g.eventType === 'hyrox',
      },
    }));
    setGames(loadedGames);
```
O restante de `loadData` (a partir de `const activeId = storage.getActiveGameId();`) permanece. Em seguida, procure todas as chamadas `loadData('SUPER_ADMIN')`/`loadData('ORGANIZER')`/`loadData(role)` (`grep -n "loadData(" src/app/admin/page.tsx`) e remova o argumento: a função não recebe mais papel.

- [ ] **Step 6: Remover o botão de alternar perfil**

Substitua o bloco `{/* Toggle de Perfil */} <div className="flex items-center gap-2 bg-zinc-950 p-1.5 ...">...</div>` (os dois `<button>` "Super Admin (Master)" e "Organizador") por um selo somente leitura:
```tsx
        {/* Perfil da sessão (somente leitura) */}
        <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800">
          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 ${
              userRole === 'SUPER_ADMIN' ? 'bg-amber-500 text-black' : 'bg-orange-500 text-black'
            }`}
          >
            {userRole === 'SUPER_ADMIN' ? <ShieldCheck className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
            <span>{userRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Organizador'}</span>
          </span>
        </div>
```

- [ ] **Step 7: Criar/excluir/liberar campeonato com erros reais**

Em `handleCreateGame`: remova o campo `status: userRole === 'SUPER_ADMIN' ? 'live' : 'draft',` do payload de `apiClient.createGame`; troque o `try { const res = ...; if (res) {...} } catch (err) { console.log(...) }` por:
```ts
    try {
      await apiClient.createGame({
        code: cleanCode,
        name: newGameName,
        date: newGameDate,
        location: newGameLocation,
        foto: newGameFoto || undefined,
        lanesCount: newGameLanes,
        eventType: newGameType,
        isLowestPointsBetter: newGameLowestPoints,
        showTime: newGameShowTime,
        showWeight: newGameShowWeight,
        showReps: newGameShowReps,
        showScoreRevision: newGameShowRevision,
        description: newGameDesc || 'Campeonato oficial organizado na plataforma ITGames Arena',
      });
      toast.success(`Campeonato ${newGameName} (${cleanCode}) cadastrado como rascunho. Aguarde a liberação do Super Admin.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao cadastrar o campeonato');
      return;
    }
```
e, no objeto local `newGameObj`, troque `status: userRole === 'SUPER_ADMIN' ? 'live' : 'draft',` por `status: 'draft',`.

Em `handleUpdateStatus`, troque o `catch` por:
```ts
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao atualizar status do campeonato');
    }
```
Em `handleDeleteGameCascade`, troque o `catch` por:
```ts
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao excluir campeonato em cascata');
```

Nos handlers de categoria que ainda usam `apiClient.createCategory/updateCategory/deleteCategory` dentro de `try/catch` com `console.log`, deixe como está (esses métodos permanecem tolerantes).

- [ ] **Step 8: Cartão do campeonato — organizadores e botão de vínculo**

Imediatamente **antes** do comentário `{/* AÇÕES DE GOVERNANÇA (SUPER ADMIN & ORGANIZADOR) */}`, insira:
```tsx
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="text-zinc-400 truncate">
                      <span className="text-[10px] text-zinc-500 uppercase mr-1">Organizadores:</span>
                      <span className="font-bold text-zinc-300">
                        {(g.organizers || []).map((o: { name: string }) => o.name).join(', ') || 'Nenhum vinculado'}
                      </span>
                    </div>
                    {userRole === 'SUPER_ADMIN' && (
                      <button
                        onClick={() => setOrganizersGame({ code: g.code || g.id, name: g.name })}
                        className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold shrink-0"
                      >
                        Gerenciar organizadores
                      </button>
                    )}
                  </div>
```

O texto do cabeçalho da aba já distingue super admin/organizador pelo `userRole`; ajuste a frase do organizador para: `'Como Organizador, você cadastra seus campeonatos e acompanha o status de liberação. A execução só é liberada pelo Super Admin.'`.

- [ ] **Step 9: Abas exclusivas do Super Admin**

No bloco das abas, **depois** do botão da aba "Dono do SaaS" ajuste-o e acrescente a aba de organizadores:

Envolva o botão `onClick={() => setAdminTab('saas_owner')}` em `{userRole === 'SUPER_ADMIN' && ( ... )}` e adicione, ao lado:
```tsx
          {userRole === 'SUPER_ADMIN' && (
            <button
              onClick={() => setAdminTab('organizers_mgmt')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                adminTab === 'organizers_mgmt'
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Organizadores
            </button>
          )}
```
Logo antes do bloco `{adminTab === 'championships' && (`, adicione o conteúdo da aba:
```tsx
      {adminTab === 'organizers_mgmt' && userRole === 'SUPER_ADMIN' && <OrganizersPanel />}
```
E proteja o conteúdo "Dono do SaaS": troque `{adminTab === 'saas_owner' && (` por `{adminTab === 'saas_owner' && userRole === 'SUPER_ADMIN' && (`.

Garanta que um organizador nunca fique numa aba restrita: depois do efeito de sincronização do papel (Step 4d), acrescente:
```ts
  useEffect(() => {
    if (userRole !== 'SUPER_ADMIN' && (adminTab === 'organizers_mgmt' || adminTab === 'saas_owner')) {
      setAdminTab('championships');
    }
  }, [userRole, adminTab]);
```

- [ ] **Step 10: Renderizar o modal**

Imediatamente antes do fechamento `    </AclGuard>` (última linha do `return`), dentro do `<div className="max-w-7xl ...">`, adicione:
```tsx
      {organizersGame && (
        <GameOrganizersModal
          game={organizersGame}
          onClose={() => setOrganizersGame(null)}
          onChanged={() => loadData()}
        />
      )}
```

- [ ] **Step 11: Verificação**

```bash
cd /d/Projects/fitness/itgames/itgames-platform && npx tsc --noEmit 2>&1 | tail -30 && npm run lint 2>&1 | tail -30
```
Expected: sem erros novos relacionados a `admin/page.tsx`, `OrganizersPanel`, `GameOrganizersModal`. Corrija usos remanescentes de `organizer` (singular) ou de `loadData(role)` que o `tsc` apontar.

- [ ] **Step 12: Marcar checkboxes desta tarefa.**

---

## Task 11: Frontend — telas do atleta e do juiz com a API como fonte da verdade

**Files:**
- Modify: `itgames-platform/src/app/athlete/page.tsx` (carga de campeonatos)
- Modify: `itgames-platform/src/app/athlete/register/page.tsx` (campeonatos, categorias e envio da inscrição)
- Modify: `itgames-platform/src/app/judge/page.tsx` (envio de score)

**Interfaces:**
- Consumes: `apiClient.listGames()` (só `live`), `apiClient.listCategories`, `apiClient.registerTeam` (estrito), `apiClient.submitScore` (estrito), `ApiError`.
- Produces: nenhuma interface nova.

- [ ] **Step 1: `athlete/page.tsx` — campeonatos só da API**

Em `itgames-platform/src/app/athlete/page.tsx`, na função `loadData`, troque o trecho de `// Buscar campeonatos da API ou fallback storage` até `setGames(loadedGames);` (inclusive) por:
```ts
    // Campeonatos liberados vêm sempre da API (sem fallback de mock)
    let loadedGames: GameEvent[] = [];
    try {
      const apiGames = await apiClient.listGames();
      loadedGames = (apiGames || []).map((g) => ({
        id: g.code,
        organizationId: 'org_1',
        code: g.code,
        name: g.name,
        description: g.description || '',
        location: g.location || '',
        startDate: g.date || '2026-11-15',
        endDate: g.date || '2026-11-15',
        eventType: g.eventType || 'crossfit',
        status: (g.status as any) || 'live',
        lanesCount: g.lanesCount || 8,
        scoringRules: {
          isLowestPointsBetter: g.isLowestPointsBetter || false,
          hyroxChipTimingEnabled: g.eventType === 'hyrox',
        },
      }));
    } catch (e) {
      console.warn('[Athlete] Falha ao carregar campeonatos da API', e);
    }

    setGames(loadedGames);
```
Confirme que `GameEvent` já está importado de `@/types` (já era usado no arquivo; se não, adicione ao import).

Observação conhecida: `GET /events/:code/registrations` agora é restrito a organizadores, então `listRegistrations` devolve `null` para o atleta e a tela continua usando as inscrições do `storage` local (comportamento atual quando a API não responde). Ligar inscrições ao usuário atleta fica para a rodada de sincronização.

- [ ] **Step 2: `athlete/register/page.tsx` — campeonatos e categorias só da API**

Em `itgames-platform/src/app/athlete/register/page.tsx`, na função `loadData`:

(a) Troque o início (de `let apiGames: any[] | null = null;` até o fim do `if/else` que preenche `loadedGames`, inclusive o `setGames(loadedGames)` dentro do `else`) por:
```ts
    let apiGames: any[] = [];
    try {
      apiGames = (await apiClient.listGames()) || [];
    } catch (e) {
      console.warn('[Register] Falha ao carregar campeonatos da API', e);
    }

    const loadedGames: GameEvent[] = apiGames.map((g) => ({
      id: g.code,
      organizationId: 'org_1',
      code: g.code,
      name: g.name,
      description: g.description || '',
      location: g.location || '',
      startDate: g.date || '2026-11-15',
      endDate: g.date || '2026-11-15',
      eventType: g.eventType || 'crossfit',
      status: (g.status as any) || 'live',
      lanesCount: g.lanesCount || 8,
      scoringRules: {
        isLowestPointsBetter: g.isLowestPointsBetter || false,
        hyroxChipTimingEnabled: g.eventType === 'hyrox',
      },
    }));
    setGames(loadedGames);
```

(b) No bloco de categorias (`let apiCats: any[] | null = null; ... let loadedCats: Category[] = []; if (apiCats && apiCats.length > 0) {...} else {...}`), leia o `else` (`grep -n "apiCats" src/app/athlete/register/page.tsx`) e troque o ramo `else` que carrega categorias mock do `storage` por `loadedCats = [];` (campeonato liberado sem categorias deve mostrar a lista vazia, não categorias de exemplo).

- [ ] **Step 3: `athlete/register/page.tsx` — não registrar localmente se a API recusar**

No envio da inscrição (por volta da chamada `await apiClient.registerTeam(activeGame.code || activeGame.id, {...})`), substitua o `try { ... } catch (err) { console.log('[Register] Fallback local storage:', err); }` por:
```ts
    try {
      await apiClient.registerTeam(activeGame.code || activeGame.id, {
        gameCode: activeGame.code || activeGame.id,
        categoryId: catCodeNumber,
        teamName,
        status,
        athletes: athletes.map((a) => ({
          name: a.name,
          cpf: a.cpf,
          phonenumber: a.phone,
          birthDate: a.birthDate,
          gender: a.gender,
          tshirtSize: a.tshirtSize || 'M',
        })),
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível concluir a inscrição. Tente novamente.');
      return;
    }
```
Importe `ApiError` junto de `apiClient` (`import { apiClient, ApiError } from '@/lib/api-client';`). Se a função tiver um estado de carregamento (`isSubmitting`/`setIsSaving`...) ligado antes da chamada, desligue-o antes do `return` (`grep -n "setIs" src/app/athlete/register/page.tsx` para achar o nome).

- [ ] **Step 4: `judge/page.tsx` — erro de envio de score visível**

Em `itgames-platform/src/app/judge/page.tsx`, importe `ApiError` (`import { apiClient, ApiError } from '@/lib/api-client';`) e substitua o `try { await apiClient.submitScore({...}); } catch (err) { console.log('[JudgeApp] Salvo offline localmente.'); }` e o `toast.success(...)` seguinte por:
```ts
    let synced = true;
    try {
      await apiClient.submitScore({
        idEvent: parseInt(currentWorkout.id.replace(/\D/g, '')) || 1,
        game: activeGame.id,
        category: parseInt(currentTeam.categoryId.replace(/\D/g, '')) || 1,
        codeTeam: parseInt(currentTeam.id.replace(/\D/g, '')) || 101,
        time: timeFormatted,
        weight: weightKg > 0 ? `${weightKg}kg` : undefined,
        reps: repsCount > 0 ? String(repsCount) : undefined,
        judge: judgeName,
        photo: photoSumulaUrl || undefined,
        penaltySeconds,
        tieBreakTime,
        scoreStatus: 'approved_by_head_judge',
      });
    } catch (err) {
      synced = false;
      toast.error(
        err instanceof ApiError && (err.status === 401 || err.status === 403)
          ? 'Score salvo apenas neste aparelho: entre com seu usuário de juiz para sincronizar.'
          : 'Score salvo apenas neste aparelho: não foi possível enviar ao servidor.',
      );
    }

    if (synced) {
      toast.success(`Score de ${currentTeam.teamName} (#${currentTeam.registerNumber}) enviado e auditado!`);
    }
```
(Mantenha o restante do handler — `setIsTimerRunning(false)` etc. — como está.)

- [ ] **Step 5: Verificação**

```bash
cd /d/Projects/fitness/itgames/itgames-platform && npx tsc --noEmit 2>&1 | tail -30 && npm run lint 2>&1 | tail -30 && npm run build 2>&1 | tail -30
```
Expected: sem erros novos em relação ao baseline da Task 9 Step 1 e `next build` concluído.

- [ ] **Step 6: Marcar checkboxes desta tarefa.**

---

## Task 12: Verificação final ponta a ponta

**Files:** nenhum arquivo novo (somente verificação; correções voltam para a tarefa dona do código).

- [ ] **Step 1: Suíte completa e builds**

```bash
cd /d/Projects/fitness/itgames/itgames-api && npm run test:e2e && npm run build
cd /d/Projects/fitness/itgames/itgames-platform && npx tsc --noEmit && npm run build
```
Expected: todos os testes e2e passam; builds ok (erros de tipo que já existiam no baseline da Task 9 podem permanecer, mas nenhum novo).

- [ ] **Step 2: Subir a stack e popular as contas**

```bash
cd /d/Projects/fitness/itgames && docker compose up -d --build
cd itgames-api && npx prisma db seed
```
Atenção: o seed recria o super admin (`leonardo.alves@itmizer.com.br`) e faz `upsert` dos demais; confirme com o usuário antes de rodar em um banco com dados que ele cadastrou manualmente. Se preferir não rodar o seed, use o super admin já existente.

- [ ] **Step 3: Roteiro manual (navegador ou skill `claude-in-chrome`)**

1. `http://localhost:3000/admin` sem login → mostra "Acesso Restrito" (e API: `curl -X POST http://localhost:3334/events -H "Content-Type: application/json" -d "{\"code\":\"X\",\"name\":\"X\"}"` → `401`).
2. Login como super admin → `/admin`: não existe botão de alternar perfil; aba "Organizadores" visível.
3. Cadastrar organizador (nome, e-mail, telefone) → aparece a senha temporária com botão "Copiar".
4. Logout; login como o organizador com a senha temporária → redireciona para `/trocar-senha`; tentar abrir `/admin` antes de trocar volta para `/trocar-senha`; trocar a senha → cai em `/admin`.
5. Como organizador: aba "Campeonatos" mostra "Meus campeonatos" (só os dele); cadastrar um campeonato → aparece como 🟡 RASCUNHO, sem botões de liberar/excluir; abas "Organizadores" e "Dono do SaaS" não aparecem.
6. Em `/athlete/register` (atleta ou visitante), o campeonato em rascunho **não** aparece.
7. Logout; login como super admin → o campeonato aparece; "Gerenciar organizadores" vincula um segundo organizador; "Liberar Execução" muda para 🟢 LIVE.
8. O segundo organizador vê e edita o mesmo campeonato; um terceiro organizador não o vê.
9. `/athlete/register` agora lista o campeonato liberado e a inscrição é aceita (e, se o super admin pausar o campeonato, a inscrição passa a ser recusada com a mensagem "Inscrições indisponíveis: campeonato não liberado").

- [ ] **Step 4: Relatar o resultado**

Escreva ao usuário o que foi verificado de fato (testes e2e, builds, quais passos do roteiro foram executados e o resultado) e o que ficou pendente (itens "Fora do escopo" do spec). Não afirme sucesso de passos que não foram executados.

- [ ] **Step 5: Marcar checkboxes desta tarefa.**

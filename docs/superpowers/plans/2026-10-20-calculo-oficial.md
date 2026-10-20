# Cálculo oficial pelo juiz-chefe — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O organizador/super admin (juiz-chefe) confirma o resultado de cada WOD por categoria depois que as baterias terminam; a pontuação real só existe no oficial, o parcial público mostra resultados e ordem indicativa sem pontos, e o WOD confirmado trava a súmula até ser revertido.

**Architecture:** Três modelos novos (resultado oficial por categoria+WOD com linhas por equipe, e log de ações) guardam um instantâneo do que o motor calculou na confirmação. O motor ganha `computeWorkoutEntries`/`buildBoard` para montar o board oficial a partir dos instantâneos com a mesma agregação e desempate. O `BoardService` passa a servir três visões (parcial sem pontos = padrão público; oficial; completa só para a prévia do juiz-chefe). Um módulo `official` expõe status/prévia/confirmar/reverter/histórico e o serviço de trava usado pelos caminhos que escrevem súmula.

**Tech Stack:** NestJS 10 + Prisma 5 (jest/ts-jest), Next.js 16 (vitest), Kotlin/Jetpack Compose (JUnit).

**Spec:** `docs/superpowers/specs/2026-10-20-calculo-oficial-design.md` (decisões 1–17). Base: branch `feat/telas-de-tv` (projetos 1 e 3, ainda não mergeados).

## Global Constraints

- Branch de trabalho `feat/calculo-oficial`, criada a partir de `feat/telas-de-tv`.
- Juiz-chefe = `ORGANIZER` (com `GameAccessService.assertCanManage`) ou `SUPER_ADMIN`; sem papel novo. Árbitros e atletas não calculam, não revertem e não veem a prévia com pontos.
- Unidade de cálculo = (categoria, WOD). No motor o WOD é `Workout.code` e a súmula aponta para ele por `Score.idEvent` (`Event.idEvent == Workout.code` na prática). Baterias: `Heat` com `categoryId`, `workoutCode = Event.workout` (se `Event.workout` for nulo ou não houver baterias: confirmar é permitido, com aviso).
- Confirmar exige todas as baterias da categoria no WOD com `status = 'completed'`. Bloqueios de confirmação: bateria não encerrada, súmula `scoreStatus = 'contested'`, nenhuma súmula válida no WOD. Avisos: súmulas `draft` (não contam), sem baterias cadastradas.
- W.O.: equipe ativa sem súmula válida no WOD fica na última posição válida + 1 com os pontos dessa posição (regra do motor); equipe cancelada fora. Vale mesmo que tenha sido escalada numa bateria.
- Instantâneo e histórico em tabelas **novas**; não usar `Score.point`, `Score.rank` nem `Score.isWO`. Histórico só de acréscimo (uma linha por ação). No máximo um resultado ativo por (campeonato, categoria, WOD): `activeKey` único, nulo quando revertido; confirmar de novo depois de reverter gera novo resultado. Reverter exige motivo de 5 a 300 caracteres.
- Trava: WOD confirmado recusa (409) criar/atualizar súmula para qualquer perfil (inclusive super admin) até reverter; foto da súmula continua permitida. Cancelar inscrição (anula súmulas), `deleteCategory` com WOD confirmado e importar backup (para não super admin) com resultado ativo também são recusados; apagar o campeonato inteiro e restaurar como super admin ficam fora da trava. Mudar a regra de pontuação (resultado de `resolveRule` diferente) com WOD confirmado é recusado (409).
- Visões: **público/parcial** = `toPartialBoard` (pontos e totais zerados, `totalDisplay` vazio, `game.pointsVisible = false`, ordem e `rank` preservados); **oficial** = só WODs confirmados, categorias sem WOD confirmado omitidas, `game.awaitingOfficial = true` quando nada foi confirmado, `game.pointsVisible = true`; **completa** (com pontos) só dentro da prévia do juiz-chefe. O formato do board não perde campos (a TV exige `points` e `totalPoints` inteiros).
- Telão `official` mostra só dados oficiais e nunca cai para o parcial; o servidor deixa de recusar `official` (remover `OFFICIAL_MSG`).
- Schema só **aditivo** (modelos novos e campos de relação em `Game`; skill `no-db-reset`; sem `migrate reset`/`--accept-data-loss`); entrypoint aplica `prisma db push --skip-generate`.
- Confirmar e reverter acontecem em transação, notificam `LeaderboardNotifier.changed(gameCode)` e gravam `OfficialLog`.
- `GET /events/:code/board` e o websocket `/ws/leaderboard` mantêm o formato; passam a servir o parcial (sem pontos). `itgames-platform`: ler `node_modules/next/dist/docs/` antes de criar páginas (AGENTS.md). Textos e comentários em Português do Brasil.
- Commits terminam com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` e `Claude-Session: https://claude.ai/code/session_01P8KyDriTk35CRcera5ke98`. `git add` só dos arquivos da tarefa (nunca `-A`; o submódulo `itgames-server` aparece `m`; `itgames-platform/src/lib/arena-data.ts` é edição do usuário com uma linha solta `va`: nunca commitar; para verificar `tsc`/build remova só temporariamente e restaure byte a byte).
- Os `*.e2e-spec.ts` precisam do banco `itgames_test` (credenciais atuais falham com P1000): escreva e compile (`npx tsc --noEmit -p tsconfig.json`), não tente executar nem adivinhar credenciais. Lógica que puder ser pura vai para `test/unit` (`npm run test:unit`).
- No banco de desenvolvimento só é permitido `prisma db push --skip-generate` aditivo (sem flags; se o Prisma avisar perda de dados, pare e reporte). Nenhuma outra escrita, nunca forjar token/JWT, nunca `Stop-Process -Name`/`taskkill /IM` (parar processos só por PID/porta), não tocar nos containers Docker.

## Review Focus

1. Pontuação real nunca aparece em endpoint ou tela pública antes da confirmação: `/board`, `/ws/leaderboard`, `/ws/screen` parcial, cópia congelada parcial, webapp (Tasks 1, 5, 8, 9).
2. Confirmar duas vezes ou em requisições simultâneas gera um só resultado ativo; reverter e confirmar de novo funciona; a trava vale a partir da criação do resultado (Tasks 3, 4).
3. Súmula travada por todos os caminhos e perfis (JUDGE, ORGANIZER, SUPER_ADMIN, cancelar inscrição, importar backup), com a foto ainda permitida (Task 4).
4. Prontidão: bateria pendente, súmula `contested`, WOD sem baterias, WOD só com W.O./sem súmula válida (Tasks 2, 3).
5. Oficial parcialmente confirmado: WOD/categoria não confirmados não pontuam; totais e desempate usam só os confirmados; telão `official` sem nada confirmado mostra "Aguardando cálculo oficial" (Tasks 1, 5, 9).

---

### Task 1: Motor — entradas por WOD, `buildBoard` e visões do board

**Files:**
- Modify: `itgames-api/src/modules/scoring/types.ts`, `itgames-api/src/modules/scoring/engine.ts`
- Create: `itgames-api/src/modules/scoring/visibility.ts`, `itgames-api/test/unit/scoring-official.spec.ts`
- Docs: nesta primeira tarefa crie a branch `feat/calculo-oficial` a partir de `feat/telas-de-tv` e commite também o spec e este plano (`git add docs/superpowers/specs/2026-10-20-calculo-oficial-design.md docs/superpowers/plans/2026-10-20-calculo-oficial.md`).

**Interfaces — Produces:**
- `types.ts`: `export type WodEntry = BoardWod & { seconds?: number; splits?: { name: string; seconds: number }[] }`; `Board['game']` ganha `pointsVisible?: boolean`, `view?: 'partial' | 'official'`, `awaitingOfficial?: boolean`.
- `engine.ts`: `export function computeWorkoutEntries(input: EngineInput, categoryCode: number, workoutCode: number): Map<number, WodEntry> | null` (a mesma computação que hoje é interna a `rankWorkout`: chave = `teamCode`, todas as equipes da categoria; `null` se o WOD não existe na categoria ou não tem nenhuma súmula válida); `export type EntriesProvider = (categoryCode: number, workoutCode: number) => ReadonlyMap<number, WodEntry> | null`; `export function buildBoard(input: EngineInput, entries: EntriesProvider, now?: Date): Board` (a agregação hoje inline em `computeBoard`: totais, desempate, rank denso, formatos); `computeBoard` continua com a assinatura atual (`onlyWorkouts` incluso) e passa a ser `buildBoard` com um provider baseado em `computeWorkoutEntries`.
- `visibility.ts`: `toPartialBoard(board: Board): Board` (cópia; em cada `wod`: `points = 0`; em cada linha: `totalPoints = 0`, `totalDisplay = ''`; `game.pointsVisible = false`, `game.view = 'partial'`; ordem das linhas, `rank`, `display`, `status` e `wods[].rank` preservados); `markOfficial(board: Board): Board` (cópia; `game.pointsVisible = true`, `game.view = 'official'`, `game.awaitingOfficial = board.categories.length === 0`).

- [ ] **Step 1:** Escrever `scoring-official.spec.ts` (estilo de `scoring-engine.spec.ts`: `NOW`, fábricas `team`/`score`, uma `fixtureA` local com 2 WODs e 4 equipes incluindo W.O. e empate): (a) `buildBoard(input, (c, w) => computeWorkoutEntries(input, c, w), NOW)` é `toEqual` a `computeBoard(input, NOW)`; (b) provider que só devolve entradas do WOD 10 deixa o WOD 11 com `status: 'none'`, `points: 0` e fora do total e do desempate `last_workout` (Review Focus 5); (c) `toPartialBoard`: nenhum `points`, `totalPoints` ≠ 0 nem `totalDisplay` não vazio sobra, `pointsVisible === false`, `view === 'partial'`, a ordem das linhas e os `rank` são idênticos ao original e o objeto original não é alterado (Review Focus 1); (d) o mesmo para um board `total_time` (HYROX): `totalPoints` (segundos) e `totalDisplay` (tempo) são limpos; (e) `markOfficial` marca `awaitingOfficial: true` quando `categories` está vazio e `false` quando não; (f) `computeWorkoutEntries` devolve `null` para WOD sem súmula válida e inclui W.O. com `rank` último + 1.
- [ ] **Step 2:** `cd itgames-api && npm run test:unit -- scoring-official` → FAIL.
- [ ] **Step 3:** Extrair em `engine.ts` as funções acima sem mudar nenhum comportamento (`npm run test:unit -- scoring-engine` continua verde sem editar esse arquivo); implementar `visibility.ts`.
- [ ] **Step 4:** `npm run test:unit` e `npx tsc --noEmit -p tsconfig.build.json` limpos.
- [ ] **Step 5: Commit** — `feat(api): motor com entradas por WOD, buildBoard e visões parcial/oficial do board`

### Task 2: Modelos do cálculo oficial e regras puras de prontidão

**Files:**
- Modify: `itgames-api/prisma/schema.prisma` (modelos novos e campos de relação em `Game`: `officialResults OfficialResult[]`, `officialLogs OfficialLog[]`)
- Create: `itgames-api/src/modules/official/official-logic.ts`, `itgames-api/test/unit/official-logic.spec.ts`

**Interfaces — Produces:**
- `OfficialResult` (`games_official_results`): `id String @id @default(uuid())`, `gameCode String`, `categoryId Int`, `eventId Int`, `activeKey String? @unique`, `confirmedById String`, `confirmedByName String`, `confirmedAt DateTime @default(now())`, `revertedAt DateTime?`, `revertedByName String?`, `revertReason String?`, `teamCount Int`, `woCount Int`, relação `game` (onDelete Cascade) e `rows OfficialResultRow[]`, `@@index([gameCode, categoryId, eventId])`.
- `OfficialResultRow` (`games_official_result_rows`): `id`, `resultId` (onDelete Cascade), `teamCode Int`, `rank Int`, `points Float`, `display String`, `status String` (`scored | wo | cancelled | none`), `seconds Float?`, `splits Json?`, `@@unique([resultId, teamCode])`. Sem FK para `Registration` (apagar inscrição não pode quebrar).
- `OfficialLog` (`games_official_logs`): `id`, `gameCode`, `categoryId`, `eventId`, `resultId String?`, `action String` (`confirm | revert`), `userId`, `userName`, `reason String?`, `teamCount Int`, `woCount Int`, `createdAt DateTime @default(now())`, relação `game` (Cascade), `@@index([gameCode, createdAt])`.
- `official-logic.ts`: `officialKey(game: string, category: number, event: number): string` (`"G1:1:10"`); `interface HeatLite { heatNumber: number; status: string }`; `interface Readiness { canConfirm: boolean; blockers: string[]; warnings: string[]; heats: { total: number; completed: number; pending: number[] } }`; `evaluateReadiness(i: { hasWorkoutLink: boolean; heats: HeatLite[]; scoreStatuses: (string | null)[]; validResults: number }): Readiness`; `type OfficialState = 'confirmed' | 'ready' | 'blocked'`; `officialState(r: Readiness, confirmed: boolean): OfficialState`; `parseRevertReason(input: unknown): string | null` (trim; 5–300 caracteres; senão `null`).

- [ ] **Step 1:** `official-logic.spec.ts`: `officialKey('G1',1,10) === 'G1:1:10'`; bateria `in_progress` nº 2 e `scheduled` nº 3 → `canConfirm false`, `pending` `[2,3]`, blocker em português citando "2, 3"; todas `completed` e uma súmula `contested` → bloqueia; `validResults 0` → bloqueia ("nenhuma súmula válida"); `draft` presente → só aviso e `canConfirm true`; `hasWorkoutLink false` ou lista de baterias vazia → aviso "sem baterias cadastradas" e `canConfirm true`; tudo ok → sem blockers nem warnings; `officialState`: confirmado vence, sem blockers = `ready`, com blockers = `blocked`; `parseRevertReason('  ')` → `null`, `'curto'` válido (5), 301 caracteres → `null`, aparado.
- [ ] **Step 2:** `npm run test:unit -- official-logic` → FAIL.
- [ ] **Step 3:** Adicionar os modelos; `npx prisma validate`, `npx prisma generate`; implementar `official-logic.ts`. **Não** rodar `db push` nesta tarefa (a verificação final aplica).
- [ ] **Step 4:** `npm run test:unit` e `npx tsc --noEmit -p tsconfig.build.json` limpos.
- [ ] **Step 5: Commit** — `feat(api): modelos do cálculo oficial e regras puras de prontidão`

### Task 3: Módulo `official` — status, prévia, confirmar, reverter, histórico e trava

**Files:**
- Create: `itgames-api/src/modules/official/{official.module.ts,official.controller.ts,official.service.ts,official-lock.service.ts,dto/official.dto.ts}`, `itgames-api/test/official.e2e-spec.ts`
- Modify: `itgames-api/src/modules/scoring/board.service.ts` (expor `loadRows(code: string): Promise<BoardRows>`, usado por `loadBoard` e pelo serviço oficial, sem mudar o comportamento), `itgames-api/src/app.module.ts`

**Interfaces:**
- Consumes: Tasks 1–2; `BoardService.loadRows`/`toEngineInput`; `GameAccessService.assertCanManage`; `LeaderboardNotifier.changed(game)`.
- Produces: `OfficialLockService` (`@Global` módulo `OfficialModule`, exporta os dois serviços): `isLocked(game: string, category: number, event: number): Promise<boolean>`; `assertUnlocked(game, category, event): Promise<void>` (lança `ConflictException('Este WOD já foi calculado oficialmente. O juiz-chefe precisa reverter o cálculo antes de alterar a súmula.')`); `anyConfirmed(game: string): Promise<boolean>`; `anyConfirmedInCategory(game: string, category: number): Promise<boolean>`; `confirmedEventIds(game: string, category: number): Promise<number[]>`.
- `OfficialService`: `status(code, user)` → `{ categories: { id; name; events: { eventId; title; state: OfficialState; heats: Readiness['heats']; contested: number; draft: number; confirmedAt: string | null; confirmedByName: string | null }[] }[] }`; `preview(code, categoryId, eventId, user)` → `{ eventId; title; state; canConfirm; blockers: string[]; warnings: string[]; heats: Readiness['heats']; rows: { rank; teamCode; team; number: string; display: string; points: number; status: 'scored' | 'wo' | 'cancelled' | 'none' }[]; woTeams: string[] }` (nada gravado; calculado com o motor completo, com pontos); `confirm(code, categoryId, eventId, user, ip?)` → o mesmo corpo da prévia mais `confirmedAt`; `revert(code, categoryId, eventId, reasonInput: unknown, user)`; `history(code, user)` → `OfficialLog[]` mais recentes primeiro (limite 200). Rotas (`@Roles(UserRole.ORGANIZER)` + `assertCanManage`; SUPER_ADMIN passa): `GET /official/:code`, `GET /official/:code/categories/:categoryId/events/:eventId/preview`, `POST /official/:code/categories/:categoryId/events/:eventId/confirm` (200), `POST .../revert` (200, corpo `{ reason: string }`), `GET /official/:code/history`.
- Regras do serviço: evento inexistente → 404; confirmar com `blockers` → 409 com a lista na mensagem; já confirmado (`activeKey` existente, inclusive corrida por `P2002`) → 409 "já calculado"; reverter sem resultado ativo → 409; motivo inválido → 400 ("Informe o motivo da reversão (5 a 300 caracteres)"). A confirmação roda em `$transaction`: cria `OfficialResult` (com `activeKey = officialKey(...)`) primeiro, relê as súmulas e recalcula com `computeWorkoutEntries`, grava `OfficialResultRow` de todas as equipes da categoria (inclusive W.O. e canceladas), `teamCount`/`woCount` e uma linha em `OfficialLog`. Reverter: marca `revertedAt`/`revertedByName`/`revertReason`, `activeKey = null`, grava `OfficialLog`. Ambos chamam `LeaderboardNotifier.changed(code)` depois da transação.

- [ ] **Step 1:** Escrever `official.e2e-spec.ts` (compila, não executa; estilo de `board.e2e-spec.ts`): organizador A do campeonato prévia/confirma e B recebe 403; SUPER_ADMIN confirma qualquer um; JUDGE e ATHLETE recebem 403; confirmar com bateria `in_progress` → 409 e nada gravado; com súmula `contested` → 409; confirmar com todas as baterias `completed` grava `OfficialResult` com linhas de todas as equipes (W.O. na última posição + 1); confirmar de novo → 409; duas confirmações simultâneas (`Promise.all`) → exatamente uma 200 e uma 409; reverter sem motivo → 400; reverter com motivo → `activeKey` nulo, `OfficialLog` com 2 linhas (`confirm`, `revert`), e confirmar de novo funciona; `history` lista as ações; a prévia não altera o banco.
- [ ] **Step 2:** Compilar o e2e (`npx tsc --noEmit -p tsconfig.json`) → FAIL por tipos/módulos inexistentes.
- [ ] **Step 3:** Implementar os serviços, controller, DTOs e módulo conforme as interfaces; importar `OfficialModule` em `AppModule`.
- [ ] **Step 4:** `npm run test:unit` e `npx tsc --noEmit -p tsconfig.json` + `-p tsconfig.build.json` limpos.
- [ ] **Step 5: Commit** — `feat(api): módulo de cálculo oficial (status, prévia, confirmar, reverter, histórico)`

### Task 4: Trava de súmula em todos os caminhos de escrita

**Files:**
- Modify: `itgames-api/src/modules/scores/scores.service.ts` (`createOrUpdateScore`, primeira ação antes de qualquer escrita), `itgames-api/src/modules/events/events.service.ts` (`updateRegistrationStatus` no ramo de cancelamento, `deleteCategory`, `updateGame`), `itgames-api/src/modules/backup/backup.service.ts` (importação)
- Create: `itgames-api/test/official-lock.e2e-spec.ts`

**Interfaces:** Consumes `OfficialLockService` da Task 3 (injeção global).

- [ ] **Step 1:** `official-lock.e2e-spec.ts` (compila, não executa): com o WOD confirmado, `POST /scores` do JUDGE, do ORGANIZER e do SUPER_ADMIN → 409 para esse (categoria, WOD) e 200 para outro WOD ou outra categoria (Review Focus 3); `PATCH /scores/:code/photo` continua 200; depois de reverter, `POST /scores` volta a 200; cancelar a inscrição de equipe com súmula no WOD confirmado → 409; `DELETE` da categoria com WOD confirmado → 409; `PUT /events/:code` mudando `scoringMode` com WOD confirmado → 409 e reenviar os mesmos valores da regra → 200; importar backup como ORGANIZER com resultado ativo → 409 e como SUPER_ADMIN → permitido; apagar o campeonato inteiro (SUPER_ADMIN) continua funcionando e remove os resultados oficiais em cascata.
- [ ] **Step 2:** Compilar → deve falhar apenas se o serviço de trava não estiver ligado (a injeção ainda não existe).
- [ ] **Step 3:** Ligar a trava: em `createOrUpdateScore` verificar `(dto.game, dto.category, dto.idEvent)` e, se já existir súmula da equipe nesse WOD, a categoria dela; em `updateRegistrationStatus` (cancelar) recusar se algum `Score` da equipe estiver em par confirmado; em `deleteCategory` usar `anyConfirmedInCategory`; em `updateGame`, comparar `resolveRule` antes e depois e, se mudou, usar `anyConfirmed`; no import de backup recusar quando `anyConfirmed` e o chamador não for `SUPER_ADMIN`.
- [ ] **Step 4:** `npm run test:unit` e `tsc` (completo e build) limpos.
- [ ] **Step 5: Commit** — `feat(api): WOD calculado trava a súmula e a mudança de regra até reverter`

### Task 5: Board por visão — parcial sem pontos, oficial e telões em modo oficial

**Files:**
- Create: `itgames-api/src/modules/scoring/official-board.ts`, `itgames-api/test/unit/official-board.spec.ts`
- Modify: `itgames-api/src/modules/scoring/board.service.ts`, `itgames-api/src/modules/events/events.controller.ts`, `itgames-api/src/modules/screens/screen-stream.service.ts`, `itgames-api/src/modules/screens/screens.service.ts`, `itgames-api/test/screens.e2e-spec.ts`, `itgames-api/test/board.e2e-spec.ts`

**Interfaces:**
- Produces em `official-board.ts` (puro): `interface ConfirmedResult { categoryId: number; eventId: number; rows: { teamCode: number; rank: number; points: number; display: string; status: 'scored' | 'wo' | 'cancelled' | 'none'; seconds?: number | null; splits?: { name: string; seconds: number }[] | null }[] }`; `buildOfficialBoard(rows: BoardRows, confirmed: ConfirmedResult[], now?: Date): Board` (usa `toEngineInput`, `buildBoard` com um provider que devolve as entradas do instantâneo para os pares confirmados e `null` para os demais, omite categorias sem WOD confirmado e aplica `markOfficial`).
- `BoardService` (mantém `loadBoard(code)` = completo, só para uso interno/prévia): `getBoard(code, user?)` passa a devolver o **parcial** (`toPartialBoard`); novos `getOfficialBoard(code: string, user?: AuthUser): Promise<Board>`, `loadPartialBoard(code: string): Promise<Board>`, `loadOfficialBoard(code: string): Promise<Board>` (lê `OfficialResult` com `activeKey` não nulo e suas linhas) e `loadBoardForMode(code: string, mode: 'partial' | 'official'): Promise<Board>`. Rota nova pública `GET /events/:code/board/official` (mesma visibilidade de `/board`).
- Telões: `ScreenStreamService.liveBoards` e `ScreensService.freezeScreen` passam a usar `loadBoardForMode(code, screen.mode)`; `parseMode` aceita `official` (remover `OFFICIAL_MSG` e o `throw`).

- [ ] **Step 1:** `official-board.spec.ts`: com `BoardRows` mínimos de 2 categorias e 2 WODs e instantâneos só para (cat 1, WOD 10): o board oficial contém só a categoria 1, o WOD 11 aparece `none` e não soma, `game.view === 'official'`, `pointsVisible === true`, pontos e totais vêm dos instantâneos mesmo que as súmulas tenham mudado depois (instantâneo vence); `confirmed = []` → `categories: []` e `awaitingOfficial: true` (Review Focus 5); W.O. do instantâneo aparece com o `rank` e os pontos gravados; HYROX usa `seconds`/`splits` do instantâneo para total e desempate `split:`. Atualizar `board.e2e-spec.ts`/`screens.e2e-spec.ts` (compilam, não executam): `/board` sem pontos (`pointsVisible false`, `totalPoints 0`), `/board/official` com pontos só após confirmar, telão `official` aceito, telão oficial sem nada confirmado recebe `awaitingOfficial: true`, congelar telão parcial guarda board sem pontos (Review Focus 1).
- [ ] **Step 2:** `npm run test:unit -- official-board` → FAIL.
- [ ] **Step 3:** Implementar `official-board.ts` e os carregadores do `BoardService`; trocar `getBoard` para o parcial; rota oficial; ligar telões (stream e congelar) e liberar `official` em `parseMode`. O websocket `/ws/leaderboard` usa `getBoard` e portanto já serve o parcial: conferir e não alterar seu contrato.
- [ ] **Step 4:** `npm run test:unit`, `tsc` (completo e build) limpos.
- [ ] **Step 5: Commit** — `feat(api): board parcial sem pontos, board oficial por instantâneo e telões em modo oficial`

### Task 6: Webapp — API client, helpers e modo Oficial nos Telões

**Files:**
- Create: `itgames-platform/src/lib/official.ts`, `itgames-platform/src/lib/__tests__/official.test.ts`
- Modify: `itgames-platform/src/lib/api-client.ts` (métodos `strict`), `itgames-platform/src/components/layout/Navbar.tsx` (item "Cálculo oficial" para `SUPER_ADMIN` e `ORGANIZER`, `href: '/calculo-oficial'`), `itgames-platform/src/app/telas/page.tsx` (habilitar o botão Oficial, remover a explicação de desabilitado), `itgames-platform/src/lib/screens.ts` se algo da descrição do modo depender disso

**Interfaces — Produces em `official.ts`:** tipos espelhando a API (`OfficialState`, `OfficialEventStatus`, `OfficialStatusView`, `OfficialPreview`, `OfficialLogEntry`); `stateLabel(state: OfficialState): { label: string; tone: 'ok' | 'wait' | 'done' }` (`ready` "Pronto para calcular", `blocked` "Aguardando baterias", `confirmed` "Calculado"); `isValidRevertReason(text: string): boolean` (5–300 após trim); `describeHeats(h: { total: number; completed: number; pending: number[] }): string` (`"3 de 5 baterias encerradas — faltam 2, 4"`, `"Sem baterias cadastradas"` quando `total` é 0). `api-client.ts`: `getOfficialStatus(code)`, `getOfficialPreview(code, categoryId, eventId)`, `confirmOfficial(code, categoryId, eventId)`, `revertOfficial(code, categoryId, eventId, reason)`, `getOfficialHistory(code)`, `getBoard(code, view?: 'partial' | 'official')` (padrão parcial; `official` chama `/events/:code/board/official`).

- [ ] **Step 1:** `official.test.ts`: `stateLabel` para os 3 estados; `isValidRevertReason('')` falso, `'erro de digitação'` verdadeiro, 301 caracteres falso; `describeHeats` com `{total: 5, completed: 3, pending: [2,4]}` → `"3 de 5 baterias encerradas — faltam 2, 4"` e `{total: 0, ...}` → `"Sem baterias cadastradas"`.
- [ ] **Step 2:** `cd itgames-platform && npx vitest run src/lib/__tests__/official.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `official.ts`, os métodos do client, o item do menu e a habilitação do Oficial em `telas/page.tsx` (botão igual ao Parcial, `aria-pressed`); atualizar os testes de `screens.ts` se algum dependia da regra antiga.
- [ ] **Step 4:** `npx vitest run`, `npx tsc --noEmit`, `npm run build` → sucesso (com a regra da linha solta de `arena-data.ts` nas Global Constraints).
- [ ] **Step 5: Commit** — `feat(platform): client do cálculo oficial, helpers e modo Oficial na página Telões`

### Task 7: Webapp — página "Cálculo oficial" do juiz-chefe

**Files:**
- Create: `itgames-platform/src/app/calculo-oficial/page.tsx`
- Modify: nenhum além do que a Task 6 já deixou pronto

**Interfaces:** Consumes `lib/official.ts` e os métodos do `api-client` (Task 6). Página `'use client'` com `AclGuard resource="admin"`, mesmo padrão e visual de `telas/page.tsx` (`friendlyError(err, context)`, toasts, modais próprios acessíveis; sem `window.confirm`/`alert`).

- [ ] **Step 1:** Escrever a página: seletor de campeonato (`listMyGames`), matriz categoria × WOD com `stateLabel`, `describeHeats` e quem/quando confirmou; ao escolher um WOD abre a prévia (tabela rank/equipe/resultado/pontos/status, lista de W.O. destacada, bloqueios em vermelho e avisos em âmbar, botão "Confirmar cálculo" desabilitado com `canConfirm: false`); confirmação em modal que lembra "a súmula deste WOD será travada"; "Reverter" abre modal com motivo obrigatório (`isValidRevertReason`); aba "Histórico" com `getOfficialHistory`; polling de 15 s da matriz; erros 409/403/404 em português (409 de duplicidade: "Este WOD já foi calculado"); ler `node_modules/next/dist/docs/` antes.
- [ ] **Step 2:** `npx tsc --noEmit` e `npx vitest run` limpos.
- [ ] **Step 3:** `npm run build` → a rota `/calculo-oficial` aparece.
- [ ] **Step 4:** Revisão visual: com `next dev` numa porta livre (ex.: 3011) abrir `/calculo-oficial` e confirmar que renderiza (sem login real apenas o estado protegido/redirecionamento); registrar o que foi visto; parar o processo por PID.
- [ ] **Step 5: Commit** — `feat(platform): página Cálculo oficial para o juiz-chefe`

### Task 8: Webapp — telas públicas sem pontos no parcial e visão Oficial

**Files:**
- Modify: `itgames-platform/src/lib/board.ts` (tipos: `game.pointsVisible?`, `game.view?`, `game.awaitingOfficial?`), `itgames-platform/src/lib/use-board.ts` (parâmetro `view`), `itgames-platform/src/app/leaderboard/page.tsx`, `itgames-platform/src/app/leaderboard/big-screen/page.tsx`, `itgames-platform/src/app/athlete/page.tsx`
- Test: `itgames-platform/src/lib/__tests__/board.test.ts` (estender)

**Interfaces:** `useBoard(pollMs: number, code?: string | null, view: 'partial' | 'official' = 'partial')`; `shouldShowPoints(board: BoardResponse | null): boolean` em `board.ts` (`game.pointsVisible !== false`).

- [ ] **Step 1:** Estender `board.test.ts`: `shouldShowPoints` falso quando `pointsVisible === false` e verdadeiro caso contrário (compatível com servidor antigo); `toLeaderboardRanks` continua preservando `rank` e `display` sem pontos.
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/board.test.ts` → FAIL.
- [ ] **Step 3:** Implementar: `/leaderboard` ganha alternância "Parcial | Oficial" (padrão Parcial); no parcial esconder pontos por WOD e totais, mostrar posição geral como "classificação indicativa" e o resultado/posição de cada WOD; na visão Oficial, mostrar pontos e totais, e "Aguardando cálculo oficial" quando `awaitingOfficial`; `/leaderboard/big-screen` esconde o "Total Acumulado" quando `!shouldShowPoints`; `/athlete` esconde pontos do parcial e usa a visão oficial (segundo `useBoard` com `view: 'official'`) para o cartão "Pontuação Acumulada", com "Aguardando cálculo oficial" enquanto vazio (Review Focus 1).
- [ ] **Step 4:** `npx vitest run`, `npx tsc --noEmit`, `npm run build` → sucesso.
- [ ] **Step 5: Commit** — `feat(platform): parcial sem pontos e visão Oficial nas telas públicas`

### Task 9: App de TV — sem pontos no parcial e "Aguardando cálculo oficial"

**Files:**
- Modify: `itgames-tv/app/src/main/java/br/com/itgames/tv/Board.kt`, `itgames-tv/app/src/main/java/br/com/itgames/tv/ui/BoardScreen.kt`, `itgames-tv/README.md`
- Test: `itgames-tv/app/src/test/java/br/com/itgames/tv/BoardTest.kt` (estender)

**Interfaces — Produces:** `Board` ganha `val pointsVisible: Boolean = true` e `val awaitingOfficial: Boolean = false` (lidos de `game` com `optBoolean`, padrões `true`/`false` para servidor antigo).

- [ ] **Step 1:** Estender `BoardTest`: mensagem com `game.pointsVisible:false` e `awaitingOfficial:true` → flags lidas; mensagem antiga sem os campos → `true`/`false`; `totalDisplay` vazio com `pointsVisible:false` não quebra o parse.
- [ ] **Step 2:** `cd itgames-tv && .\gradlew.bat :app:testDebugUnitTest` → FAIL.
- [ ] **Step 3:** Implementar: `ScoreRow` não desenha a caixa TOTAL quando `!board.pointsVisible` (posição `Nº` continua; chips por WOD continuam com resultado); rodapé do PARCIAL passa a dizer "Classificação indicativa — pontuação oficial após o cálculo do juiz-chefe"; quando todos os boards têm `awaitingOfficial`, mostrar a mensagem "Aguardando cálculo oficial" no lugar da lista (mesmo estilo do estado vazio, com cabeçalho e selo OFICIAL); congelado segue servindo a cópia como está.
- [ ] **Step 4:** `.\gradlew.bat :app:testDebugUnitTest :app:assembleDebug` → BUILD SUCCESSFUL.
- [ ] **Step 5: Commit** — `feat(tv): parcial sem pontos, aviso de classificação indicativa e espera do cálculo oficial`

### Task 10: Verificação local ponta a ponta

**Files:** nenhum arquivo de produto (correções só se algo impedir a verificação; defeitos são reportados, não corrigidos aqui).

- [ ] **Step 1:** Suítes: `npm run test:unit` (API) e `tsc` build/completo; `npx vitest run`, `npx tsc --noEmit`, `npm run build` (plataforma); `.\gradlew.bat :app:testDebugUnitTest :app:assembleDebug` (TV). Registrar contagens.
- [ ] **Step 2:** `npx prisma db push --skip-generate` (aditivo, sem flags) no banco de desenvolvimento e relatar a saída resumida (se avisar perda de dados, parar). Subir a API em porta livre (ex.: 3399) e conferir sem login: `GET /events/SUMMER2026/board` devolve `pointsVisible: false`, `totalPoints: 0` e a ordem preservada; `GET /events/SUMMER2026/board/official` devolve `categories: []` e `awaitingOfficial: true`; `/ws/leaderboard?game=SUMMER2026` entrega o parcial; `GET /official/SUMMER2026` sem token → 401. Nenhuma escrita além do `db push`.
- [ ] **Step 3:** Emulador `ITGames_TV` com servidor mock (script temporário fora do repo) falando `screen` com: board parcial (`pointsVisible:false`) e oficial (`awaitingOfficial:true` e com pontos); capturar `screencap` e olhar: sem caixa TOTAL no parcial, rodapé "Classificação indicativa", mensagem "Aguardando cálculo oficial", selo OFICIAL com pontos.
- [ ] **Step 4:** Parar só os processos iniciados (por PID/porta), `adb emu kill`, confirmar `git status` sem arquivos soltos.
- [ ] **Step 5:** Reportar o que ficou **NÃO VERIFICADO**: confirmar/reverter/travar ponta a ponta com banco e login reais, e2e (banco de teste), e o fluxo do juiz-chefe no navegador autenticado.

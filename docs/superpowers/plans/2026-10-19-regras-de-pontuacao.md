# Regras de pontuação por campeonato — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um único motor de classificação na API, configurável por campeonato (pontos por posição, soma de posições, tempo total), consumido pelo telão de TV e pelas telas de leaderboard do webapp.

**Architecture:** Módulo puro `scoring` na API (regras + motor, sem banco) e um `BoardService` que carrega os dados e chama o motor. Novo endpoint público `GET /events/:code/board` e o websocket do telão passam a usar o mesmo resultado. A plataforma e o app de TV só renderizam o placar pronto.

**Tech Stack:** NestJS 10 + Prisma 5 + PostgreSQL (jest/ts-jest), Next.js 16 (vitest), Kotlin/Jetpack Compose (JUnit).

**Spec:** `docs/superpowers/specs/2026-10-19-regras-de-pontuacao-design.md`

## Global Constraints

- Regras: `points_table` (maior soma vence), `rank_sum` (menor soma vence), `total_time` (menor tempo vence).
- Tabela de pontos padrão: `100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 47, 44, 41, 38, 35, 32, 29, 26, 23, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2, 1`; posição além do fim da tabela vale **1 ponto**.
- Desempate: `last_workout` (padrão), `most_wins`, `split:<nome>`.
- Posição **densa** (1, 1, 2). W.O., súmula cancelada e equipe sem score = **maior posição válida + 1**, com os pontos dessa posição; nunca zero, nunca em 1º, nunca somem da tela.
- Mudanças de schema só **aditivas**; nada de `migrate reset`, `db push --accept-data-loss` ou apagar colunas (skill `no-db-reset`). O entrypoint da API usa `prisma db push --skip-generate`.
- Campeonatos existentes: sem coluna nova preenchida, a regra é derivada (hyrox → `total_time`; `isLowestPointsBetter` → `rank_sum`; senão `points_table`). `isLowestPointsBetter` continua gravado, igual a `scoringMode === 'rank_sum'`.
- Dados públicos sem informação pessoal (mesmo critério do endpoint `/events/:code/leaderboard`); campeonato fora de `live` responde 404 para quem não o gerencia.
- `itgames-platform`: ler `node_modules/next/dist/docs/` antes de mexer em páginas (AGENTS.md).
- O working tree tem alterações não commitadas do usuário (`athletes.*`, `storage.ts`, `use-games.ts`, `heats/page.tsx`, specs/planos antigos): faça `git add` **só dos arquivos de cada tarefa**, nunca `git add -A`.
- Testes `*.e2e-spec.ts` usam o banco `itgames_test` (credenciais atuais do `.env` falham com P1000); peça as credenciais ao usuário antes de rodá-los. Os testes do motor são unitários e rodam sem banco.
- Português do Brasil em textos de interface e comentários.

## Review Focus

1. Categoria sem equipes, sem WODs ou sem nenhum score → placar vazio/zerado sem erro (teste na Task 2).
2. WOD em que **todas** as equipes são W.O./canceladas → o WOD não conta (ninguém recebe "posição 1" por falta de concorrente) (Task 2).
3. Empate em todos os critérios → mesma posição final, ordem estável por código da equipe (Task 2).
4. Tabela de pontos inválida (vazia, negativa, texto) ou menor que o número de equipes → API recusa com 400; motor cai no padrão e dá 1 ponto além do fim (Tasks 1 e 4).
5. Desempate `split:<nome>` com parcial ausente numa das equipes ou nome inexistente → quem não tem o parcial perde; ninguém tem → empate (Task 3).
6. Equipe cancelada depois de pontuar continua na tabela, marcada "CANCELADA", e suas súmulas (`voided`) não entram no ranking das outras (Task 5).
7. WOD ainda não disputado (nenhum score) não dá pontos a ninguém, mas num WOD em andamento a equipe sem score recebe último + 1 até lançar (decisão do plano, Task 2).

---

### Task 1: Harness de testes unitários e módulo de regras

**Files:**
- Create: `itgames-api/test/jest-unit.json`, `itgames-api/test/unit/scoring-rules.spec.ts`, `itgames-api/src/modules/scoring/rules.ts`
- Modify: `itgames-api/package.json` (script `"test:unit": "jest --config ./test/jest-unit.json"`)

**Interfaces:**
- Produces (em `rules.ts`):
  - `type ScoringMode = 'points_table' | 'rank_sum' | 'total_time'`
  - `type Tiebreak = 'last_workout' | 'most_wins' | \`split:${string}\``
  - `interface ScoringRule { mode: ScoringMode; pointsTable: number[]; tiebreak: Tiebreak }`
  - `const DEFAULT_POINTS_TABLE: number[]`
  - `function parsePointsTable(input: unknown): number[] | null` — array de 1 a 200 números finitos ≥ 0; senão `null`
  - `function parseTiebreak(input: unknown): Tiebreak | null` — aceita `last_workout`, `most_wins`, `split:<texto não vazio>`
  - `function resolveRule(game: { eventType?: string | null; scoringMode?: string | null; tiebreak?: string | null; pointsTable?: unknown; isLowestPointsBetter?: boolean | null }): ScoringRule` — campos válidos vencem; inválidos/ausentes caem na derivação legada (Global Constraints)
  - `function pointsForPosition(table: number[], position: number): number` — `position <= 0` → 0; além do fim → 1

- [ ] **Step 1:** Criar `test/jest-unit.json` (`rootDir: "."`, `testRegex: ".spec.ts$"`, `testEnvironment: "node"`, transform `ts-jest`, sem `globalSetup`) e o script `test:unit`. Mover `test/leaderboard-board.e2e-spec.ts` para `test/unit/leaderboard-board.spec.ts` (ajustando o import) para rodar sem banco; ele será apagado na Task 5.
- [ ] **Step 2: Escrever `scoring-rules.spec.ts`** com estes casos: `resolveRule({eventType:'hyrox'}).mode === 'total_time'`; `resolveRule({isLowestPointsBetter:true}).mode === 'rank_sum'`; `resolveRule({}).mode === 'points_table'` com `pointsTable` igual a `DEFAULT_POINTS_TABLE` e `tiebreak === 'last_workout'`; `scoringMode:'points_table'` explícito vence `eventType:'hyrox'`; `scoringMode:'lixo'` cai na derivação; `parsePointsTable([])`, `([-1])`, `(['a'])`, `('x')` → `null` e `([100,50])` → `[100,50]`; `parseTiebreak('split:Wall Balls')` válido, `'split:'` e `'x'` → `null`; `pointsForPosition(DEFAULT_POINTS_TABLE, 1) === 100`, `(…, 31) === 1`, `(…, 99) === 1`, `(…, 0) === 0`.
- [ ] **Step 3:** `cd itgames-api && npm run test:unit -- scoring-rules` → FAIL (módulo inexistente).
- [ ] **Step 4:** Implementar `rules.ts` conforme as assinaturas.
- [ ] **Step 5:** Mesmo comando → PASS; `npm run test:unit` inteiro → PASS.
- [ ] **Step 6: Commit** `git add itgames-api/package.json itgames-api/test itgames-api/src/modules/scoring/rules.ts` — `feat(api): regras de pontuação e harness de testes unitários`

### Task 2: Motor de classificação (pontos por posição e soma de posições)

**Files:**
- Create: `itgames-api/src/modules/scoring/types.ts`, `itgames-api/src/modules/scoring/workout-order.ts`, `itgames-api/src/modules/scoring/engine.ts`, `itgames-api/test/unit/scoring-engine.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`ScoringRule`, `resolveRule`, `pointsForPosition`, `Tiebreak`).
- Produces (em `types.ts`):
  - `type TeamStatus = 'active' | 'cancelled'`; `type WodStatus = 'scored' | 'wo' | 'cancelled' | 'none'`
  - `interface EngineScore { workoutCode: number; category: number; teamCode: number; time?: string | null; weight?: string | null; reps?: string | null; penaltySeconds?: number | null; tieBreakTime?: string | null; isWO?: boolean | null; voided?: boolean; splits?: { name: string; seconds: number }[] | null }`
  - `interface EngineInput { game: { code: string; name: string; location?: string | null; eventType?: string | null; scoringMode?: string | null; tiebreak?: string | null; pointsTable?: unknown; isLowestPointsBetter?: boolean | null }; categories: { code: number; name: string }[]; workouts: { code: number; category: number; title?: string | null; type?: string | null; timeCap?: string | null }[]; teams: { code: number; categoryId: number; team: string; number?: string | null; athletes: string[]; status: TeamStatus }[]; scores: EngineScore[]; onlyWorkouts?: ReadonlySet<number> }`
  - `interface BoardWod { title: string; display: string; rank: number; points: number; status: WodStatus }`
  - `interface BoardRow { rank: number; teamCode: number; team: string; number: string; athletes: string[]; status: TeamStatus; totalPoints: number; totalDisplay: string; wods: BoardWod[] }` — `totalPoints` é pontos, soma de posições ou segundos totais conforme a regra; `totalDisplay` é o texto exibido
  - `interface Board { game: { code: string; name: string; location: string; eventType: 'crossfit' | 'hyrox'; rule: { mode: ScoringMode; tiebreak: Tiebreak }; totalUnit: 'PTS' | 'SOMA' | 'TEMPO' }; generatedAt: string; categories: { id: number; name: string; wodTitles: string[]; rows: BoardRow[] }[] }`
  - `function computeBoard(input: EngineInput, now?: Date): Board` (em `engine.ts`)
  - `function compareWithinWorkout(type: string, a: WorkoutResult, b: WorkoutResult): number` (em `workout-order.ts`, `WorkoutResult` = tempo, repetições, carga, tie-break, penalidade e `completed` já numéricos). Portar a ordenação de `rankWorkout` em `src/modules/leaderboard/board.ts` sem mudar o critério (for_time: completou dentro do time cap vem antes, depois menor tempo+penalidade, depois tie-break; amrap/emom: repetições; max_load/complex: carga, depois menor tempo; hyrox_*: menor tempo+penalidade).
- Regras do motor (decididas na spec): posição densa; WOD só conta se ≥ 1 equipe tem resultado válido (não W.O., não cancelada) nele e passa em `onlyWorkouts` quando informado; nos WODs que contam, W.O./`voided`/equipe cancelada/sem score = posição válida máxima + 1; `points_table` usa `pointsForPosition`, `rank_sum` usa a própria posição; `totalUnit` = `PTS`/`SOMA`/`TEMPO`; `display` por tipo de WOD como em `board.ts` (`04:10`, `120 reps`, `150 kg`, `CAP +50`), mais `W.O.` e `CANCELADA`; WOD que não conta tem `status:'none'`, `display:'Sem Score'`, 0 pontos e não entra no total; ordenação final por total (maior vence em `points_table`, menor em `rank_sum`), desempate `last_workout` (menor posição no último WOD que conta) ou `most_wins` (mais posições 1); empate total → mesma posição final (densa) e ordem estável por `teamCode`; equipe cancelada continua na lista com `status:'cancelled'`.

- [ ] **Step 1: Escrever `scoring-engine.spec.ts`** com a fixture A: categoria 1; WOD 10 `for_time` cap `10:00`, WOD 11 `max_load`; equipes 1–4 ativas. Scores: WOD 10 → t1 `05:00`, t2 `04:00`, t3 `04:00`, t4 `isWO`; WOD 11 → t1 `150`, t2 `140`, t3 `140`, t4 sem score. Casos:
  - `points_table`: por WOD, posições `[2,1,1,3]` e pontos `[95,100,100,90]` no WOD 10 e `[1,2,2,3]`/`[100,95,95,90]` no WOD 11; totais t1 195, t2 195, t3 195, t4 180; com `last_workout` a ordem é t1, t2, t3, t4 e as posições finais `[1,2,2,3]`; com `most_wins` as três primeiras empatam em 195 e ficam todas em posição 1, t4 em 2.
  - `rank_sum` (`scoringMode:'rank_sum'`): totais t1 3, t2 3, t3 3, t4 6; ordem t1, t2, t3, t4; posições finais `[1,2,2,3]`.
  - Cancelada: t3 com `status:'cancelled'` → continua na lista, `status:'cancelled'`, `wods[].status === 'cancelled'`, `display === 'CANCELADA'`, e a ausência de t3 não muda a posição dos demais além de abrir a vaga de "último + 1".
  - Review Focus 1, 2, 7: categoria sem equipes → `rows: []`; todas W.O. no WOD 10 → `status:'none'` e 0 pontos para todos; WOD 11 sem nenhum score → `status:'none'` e fora do total.
  - Review Focus 3: duas equipes idênticas em tudo → mesma posição e ordem por `teamCode`.
  - `onlyWorkouts: new Set([10])` ignora o WOD 11.
- [ ] **Step 2:** `npm run test:unit -- scoring-engine` → FAIL.
- [ ] **Step 3:** Implementar `types.ts`, `workout-order.ts` e `engine.ts` (`total_time` fica para a Task 3; por ora lança `Error('modo não suportado')` para ele).
- [ ] **Step 4:** Mesmo comando → PASS.
- [ ] **Step 5: Commit** — `feat(api): motor de classificação por pontos e soma de posições`

### Task 3: Modo `total_time` (HYROX) e desempate por parcial

**Files:**
- Modify: `itgames-api/src/modules/scoring/engine.ts`
- Test: `itgames-api/test/unit/scoring-engine.spec.ts` (novos casos)

**Interfaces:** Consumes Tasks 1–2. Produces: `computeBoard` suporta `rule.mode === 'total_time'`.

Regra: total = soma de (tempo + penalidade) dos WODs que contam; **terminou** = tem tempo válido em todos eles. Terminaram primeiro, por total crescente; depois as demais (W.O., canceladas, sem score), por quantidade de WODs válidos decrescente e `teamCode`; essas têm `totalDisplay: '—'`. Desempate `split:<nome>`: soma dos parciais com esse nome nos WODs que contam; menor vence; quem não tem o parcial perde; nenhum tem → empate.

- [ ] **Step 1: Casos novos (fixture B)**: um WOD 20 `hyrox_standard`, `eventType:'hyrox'`. t1 `60:00` + `penaltySeconds:30`; t2 `60:10`; t3 `isWO`; t4 sem score; t5 cancelada; t6 `60:10` com `splits:[{name:'Wall Balls',seconds:240}]` e t2 com `splits:[{name:'Wall Balls',seconds:270}]`, `tiebreak:'split:Wall Balls'`. Esperado: ordem t6, t2, t1, t3, t4, t5; `totalDisplay` `'60:10'`, `'60:10'`, `'60:30'`, depois `'—'` ×3; `rule.mode === 'total_time'`, `totalUnit === 'TEMPO'`. Mais: com `tiebreak` padrão, t2 e t6 empatam (posição final igual); `split:Inexistente` → empate; só t6 com parcial → t6 vence.
- [ ] **Step 2:** `npm run test:unit -- scoring-engine` → FAIL nos novos casos.
- [ ] **Step 3:** Implementar o ramo `total_time` e o desempate por parcial em `engine.ts`.
- [ ] **Step 4:** `npm run test:unit` → PASS.
- [ ] **Step 5: Commit** — `feat(api): classificação por tempo total (HYROX) e desempate por parcial`

### Task 4: Configuração do campeonato na API (schema, validação, parciais)

**Files:**
- Modify: `itgames-api/prisma/schema.prisma` (Game: `scoringMode String?`, `tiebreak String?`, `pointsTable Json?`; Score: `splits Json?`), `itgames-api/src/modules/events/events.service.ts` (`CreateGameDto`, `createGame`, `updateGame`, `presentGame`), `itgames-api/src/modules/scores/dto/create-score.dto.ts`, `itgames-api/src/modules/scores/scores.service.ts`
- Test: `itgames-api/test/game-scoring-config.e2e-spec.ts`

**Interfaces:** Consumes `parsePointsTable`, `parseTiebreak`, `resolveRule` (Task 1). Produces: `POST/PUT /events` aceitam `scoringMode`, `tiebreak`, `pointsTable`; respostas de campeonato (`presentGame`, inclusive o retorno de `updateGame`) trazem `scoring: { mode, tiebreak, pointsTable }` já resolvido; `POST /scores` aceita `splits?: { name: string; seconds: number }[]`.

- [ ] **Step 1: Escrever `game-scoring-config.e2e-spec.ts`** (usar `createTestApp` e os helpers de `test/helpers.ts`): criar campeonato com `scoringMode:'rank_sum'` → resposta `scoring.mode === 'rank_sum'` e `isLowestPointsBetter === true`; `scoringMode:'inventado'` → 400; `pointsTable:[]` e `[-5]` → 400; `tiebreak:'split:Wall Balls'` aceito, `'xyz'` → 400; campeonato sem os campos e `eventType:'hyrox'` → `scoring.mode === 'total_time'`; `PUT` trocando para `points_table` zera `isLowestPointsBetter`; `POST /scores` com `splits` grava e o score volta com os parciais; `splits` mal formado → 400.
- [ ] **Step 2:** Rodar o teste (precisa do banco de teste, ver Global Constraints) → FAIL.
- [ ] **Step 3:** Editar o schema (campos opcionais; nenhuma coluna removida) e aplicar com `cd itgames-api && npx prisma db push --skip-generate` (sem `--accept-data-loss`), depois `npx prisma generate`.
- [ ] **Step 4:** Implementar validação e persistência: validar com as funções da Task 1 (erros em português, `BadRequestException`); manter `isLowestPointsBetter = (scoringMode === 'rank_sum')` quando `scoringMode` vier; `presentGame` adiciona `scoring` via `resolveRule`; `updateGame` retorna `presentGame(...)`; `CreateScoreDto.splits` com `class-validator` (`@IsArray`, itens `{name: string, seconds: number ≥ 0}`) gravado em `Score.splits`.
- [ ] **Step 5:** Teste da Step 1 → PASS; `npx tsc --noEmit -p tsconfig.build.json` limpo.
- [ ] **Step 6: Commit** — `feat(api): regra de pontuação configurável por campeonato e parciais de HYROX`

### Task 5: BoardService, endpoint `/events/:code/board` e websocket

**Files:**
- Create: `itgames-api/src/modules/scoring/board.service.ts`, `itgames-api/src/modules/scoring/scoring.module.ts`, `itgames-api/test/unit/board-mapping.spec.ts`, `itgames-api/test/board.e2e-spec.ts`
- Modify: `itgames-api/src/modules/events/events.controller.ts`, `itgames-api/src/modules/leaderboard/leaderboard.module.ts`, `itgames-api/src/modules/leaderboard/leaderboard-stream.service.ts`, `itgames-api/src/app.module.ts`
- Delete: `itgames-api/src/modules/leaderboard/board.ts`, `itgames-api/test/unit/leaderboard-board.spec.ts` (cobertos pelo motor)

**Interfaces:** Consumes `computeBoard` (Tasks 2–3), `GameAccessService.assertCanView`. Produces:
- `BoardService.getBoard(code: string, user?: AuthUser): Promise<Board>` — mesma regra de visibilidade do `getLeaderboardData` (`assertCanView`)
- `function toEngineInput(rows: BoardRows): EngineInput` (puro, em `board.service.ts`) onde `BoardRows` agrupa o jogo, categorias, WODs (`Workout`), inscrições **incluindo canceladas** (`status === 'cancelled'` → `'cancelled'`) com atletas, e scores de **todos os status** (`scoreStatus === 'voided'` → `voided: true`; `approved_by_head_judge`/`approved` entram normais; demais status — `draft`, `submitted_by_judge`, `contested` — entram como provisórios, ou seja, normais, para o placar em tempo real) com `idEvent → workoutCode`
- `GET /events/:code/board` (`@Public()`) → `Board`; websocket `/ws/leaderboard?game=` envia `{type:'board', board}` com o mesmo `Board`

- [ ] **Step 1: Escrever `board-mapping.spec.ts`** (unitário, sem banco): inscrição `status:'cancelled'` vira `status:'cancelled'`; score `scoreStatus:'voided'` vira `voided:true`; `idEvent` vira `workoutCode`; `athletes` vira lista de nomes; `pointsTable` JSON passa adiante.
- [ ] **Step 2: Escrever `board.e2e-spec.ts`** (banco): campeonato `live` com 2 categorias, 2 WODs e 3 equipes, uma cancelada depois de pontuar → `GET /events/<code>/board` devolve a cancelada com `status:'cancelled'`; campeonato `draft` → 404 para anônimo; resposta não contém e-mail/CPF; após `POST /scores` o websocket recebe um novo `board` (cliente `ws` no teste).
- [ ] **Step 3:** Rodar os dois → FAIL.
- [ ] **Step 4:** Implementar `BoardService` e `ScoringModule` (exporta `BoardService`, importa `PrismaModule`); registrar o endpoint no `EventsController` delegando ao `BoardService` (importar `ScoringModule` em `EventsModule`); trocar em `LeaderboardStreamService` as chamadas `EventsService.getLeaderboardData` + `buildBoard` por `BoardService.getBoard`; `LeaderboardModule` passa a importar `ScoringModule` em vez de `EventsModule`; remover `board.ts` e seu teste.
- [ ] **Step 5:** `npm run test:unit` → PASS; teste e2e da Step 2 → PASS; `npx tsc --noEmit -p tsconfig.build.json` limpo.
- [ ] **Step 6: Commit** — `feat(api): placar calculado pelo motor em /events/:code/board e no websocket`

### Task 6: App de TV lê o placar novo

**Files:**
- Modify: `itgames-tv/app/src/main/java/br/com/itgames/tv/Board.kt`, `itgames-tv/app/src/main/java/br/com/itgames/tv/ui/BoardScreen.kt`, `itgames-tv/app/src/test/java/br/com/itgames/tv/BoardTest.kt`, `itgames-tv/README.md`

**Interfaces:** Consumes o JSON da Task 5. Produces: `BoardRow` ganha `status: String`, `totalDisplay: String`; `BoardWod` ganha `status: String`; `Board` ganha `totalUnit: String`.

- [ ] **Step 1: Atualizar `BoardTest.kt`** com uma mensagem completa nova: `parsesNewFields` (equipe `status:"cancelled"`, `totalDisplay:"60:10"`, `totalUnit:"TEMPO"`) e `parsesLegacyMessageWithoutNewFields` (campos novos ausentes caem em `"active"`, `totalPoints` como texto e `"PTS"`).
- [ ] **Step 2:** `cd itgames-tv && ./gradlew.bat :app:testDebugUnitTest` → FAIL.
- [ ] **Step 3:** Ajustar `Board.parse` (campos novos com `optString`/padrão) e `ScoreRow`: o total mostra `totalDisplay` com `board.totalUnit` (vazio no `TEMPO`); linha de equipe cancelada com selo "CANCELADA" e cor atenuada; chips `W.O.`/`CANCELADA` já vêm no `display`. Atualizar a seção "Servidor" do README (endpoint `/events/:code/board`, regras por campeonato).
- [ ] **Step 4:** Testes → PASS; `./gradlew.bat :app:assembleDebug` → BUILD SUCCESSFUL.
- [ ] **Step 5: Commit** — `feat(tv): exibe total por regra do campeonato e equipes canceladas`

### Task 7: Plataforma usa o placar do servidor

**Files:**
- Create: `itgames-platform/src/lib/board.ts`, `itgames-platform/src/lib/use-board.ts`, `itgames-platform/src/lib/__tests__/board.test.ts`
- Modify: `itgames-platform/src/lib/api-client.ts` (`getBoard`), `itgames-platform/src/types/index.ts` (`LeaderboardRank` ganha `totalDisplay?: string`, `status?: 'active' | 'cancelled'`, `totalUnit?: string`; `workoutScores[]` ganha `status?: string`), `itgames-platform/src/app/leaderboard/page.tsx`, `itgames-platform/src/app/leaderboard/big-screen/page.tsx`, `itgames-platform/src/app/athlete/page.tsx`
- Delete: `itgames-platform/src/lib/use-leaderboard.ts`, `itgames-platform/src/lib/leaderboard-data.ts`; remover `calculateOverallLeaderboard`/`calculateWorkoutRanks` de `src/lib/scoring.ts` mantendo `formatSecondsToTime`/`parseTimeToSeconds` (usados pelo juiz) e apagar o que ficar sem uso

**Interfaces:** Consumes `GET /events/:code/board`. Produces:
- `BoardResponse` (espelho do `Board` da Task 2) e `function toLeaderboardRanks(category: BoardResponse['categories'][number], unit: string): LeaderboardRank[]` em `board.ts` — `registrationId = String(row.teamCode)`, `teamName = row.team`, `registerNumber = row.number`, `workoutScores[].scoreDisplay = wod.display`, demais campos 1:1
- `function useBoard(pollMs: number): { status: 'loading' | 'ok' | 'no-games' | 'error'; board: BoardResponse | null }` — mesma escolha de campeonato do hook antigo (`?game=`, depois o ativo, depois o primeiro)

- [ ] **Step 1: Escrever `board.test.ts`** (vitest): `toLeaderboardRanks` mapeia posição, nome, número, total, `workoutScores[].scoreDisplay`/`rank`/`points`, `status:'cancelled'` e `totalDisplay`; categoria sem linhas → `[]`.
- [ ] **Step 2:** `cd itgames-platform && npx vitest run src/lib/__tests__/board.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `board.ts`, `use-board.ts` e `apiClient.getBoard`; nas três páginas trocar o cálculo local por `useBoard` + `toLeaderboardRanks` mantendo o JSX (mostrar `totalDisplay` + unidade e o selo "CANCELADA"); em `athlete/page.tsx`, `myRank` vem da linha com `teamCode` da inscrição selecionada.
- [ ] **Step 4:** `npx vitest run` → PASS; `npx tsc --noEmit` limpo; `npm run build` → sucesso.
- [ ] **Step 5: Commit** — `feat(platform): leaderboards usam o placar calculado pelo servidor`

### Task 8: Formulário do organizador

**Files:**
- Modify: `itgames-platform/src/app/admin/page.tsx` (estado ~linha 85, carga ~178 e ~528, salvar ~594/624/653, campo ~2529), `itgames-platform/src/types/index.ts` (`scoringRules` ganha `mode`, `tiebreak`, `pointsTable`), `itgames-platform/src/lib/api-client.ts` (tipos de `createGame`/`updateGame`)
- Test: `itgames-platform/src/lib/__tests__/scoring-form.test.ts` + helper `itgames-platform/src/lib/scoring-form.ts`

**Interfaces:** Consumes `scoring` da Task 4. Produces em `scoring-form.ts`: `parsePointsInput(text: string): number[] | null` (lista separada por vírgula/espaço/quebra de linha; `null` se vazia, negativa ou não numérica) e `formatPointsInput(table: number[]): string`.

- [ ] **Step 1: Escrever `scoring-form.test.ts`:** `parsePointsInput('100, 95 90')` → `[100,95,90]`; `''`, `'a,b'`, `'-1'` → `null`; `formatPointsInput([100,95])` → `'100, 95'`.
- [ ] **Step 2:** Rodar → FAIL. Implementar o helper → PASS.
- [ ] **Step 3:** Trocar o `<select>` "Menor Pontuação Ganha" por: seletor de regra (Pontos por posição / Soma de posições / Tempo total), campo da tabela de pontos (só em "Pontos por posição", valor inicial a tabela padrão da Task 1), seletor de desempate (Último WOD / Mais vitórias / Parcial de exercício + campo do nome). Carregar de `g.scoring` (a regra **resolvida**, para campeonatos antigos já aparecer o equivalente) e enviar `scoringMode`, `tiebreak`, `pointsTable` nos três pontos de salvamento, mantendo `isLowestPointsBetter` coerente. Mostrar erro de validação inline (tabela inválida) sem chamar a API.
- [ ] **Step 4:** `npx vitest run`, `npx tsc --noEmit`, `npm run build` → sucesso.
- [ ] **Step 5: Commit** — `feat(platform): organizador configura regra de pontuação, tabela e desempate`

### Task 9: Verificação local ponta a ponta

**Files:** nenhum arquivo de produto (ajustes só se algo falhar).

- [ ] **Step 1:** Subir banco (já em Docker, `localhost:5433`), API (`PORT=3399 node -r ts-node/register src/main.ts` em `itgames-api`) e plataforma (`npm run dev` em `itgames-platform` apontando para a API local). Confirmar que `prisma db push --skip-generate` não pediu perda de dados.
- [ ] **Step 2:** No SUMMER2026 (hoje `isLowestPointsBetter = true`): `GET /events/SUMMER2026/board` → `rule.mode === 'rank_sum'` e `totalUnit === 'SOMA'`; abrir `/leaderboard` e `/leaderboard/big-screen` na plataforma e conferir a mesma ordem e totais.
- [ ] **Step 3:** No formulário do admin, trocar o campeonato para "Pontos por posição" com tabela `10, 8, 6`, salvar, e conferir no `/board` o novo cálculo e a posição além do fim da tabela valendo 1.
- [ ] **Step 4:** Emulador Android TV (`ITGames_TV`, AVD já criado; servidor `http://10.0.2.2:3399`): instalar o APK debug, conferir total e selo "CANCELADA". Parar **só** os processos que você subiu (por porta ou PID; nunca `Stop-Process -Name node`).
- [ ] **Step 5:** Rodar todos os testes: `npm run test:unit` e (com banco de teste) `npm run test:e2e` na API; `npx vitest run` na plataforma; `./gradlew.bat :app:testDebugUnitTest` na TV → tudo PASS. Registrar no resumo final o que não pôde ser rodado.

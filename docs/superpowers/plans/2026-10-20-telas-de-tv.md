# Telões de TV (pareamento, configuração, parcial e congelar) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O organizador pareia TVs por código, escolhe quais campeonatos cada telão exibe, alterna parcial/oficial e congela o placar com um texto em overlay, tudo pelo webapp e em tempo real.

**Architecture:** Novo módulo `screens` na API (modelo `Screen`, pareamento, REST do organizador, credencial por telão com hash) e um websocket `/ws/screen` que empurra a configuração e um `Board` por campeonato (reusando o motor do projeto 1; congelado = cópia guardada). O app de TV troca "servidor + campeonato" por código de pareamento; o webapp ganha a página "Telões".

**Tech Stack:** NestJS 10 + Prisma 5 + `ws` (jest/ts-jest), Next.js 16 (vitest), Kotlin/Jetpack Compose (JUnit).

**Spec:** `docs/superpowers/specs/2026-10-19-telas-de-tv-design.md` (inclui as anotações aprovadas do usuário). Base: branch `feat/regras-pontuacao` (projeto 1, ainda não mergeada).

## Global Constraints

- Branch de trabalho `feat/telas-de-tv`, criada a partir de `feat/regras-pontuacao`.
- Código de pareamento: **6 caracteres**, alfabeto sem `0`, `O`, `1`, `I` (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), validade de **10 minutos**, uso único.
- Rotação por telão: padrão **15 s**, mínimo **5**, máximo **120**.
- Modos: `partial` (parcial, tempo real) e `official`. Enquanto o projeto 2 não existir, o servidor **recusa** salvar `official` (400, "Modo oficial disponível após o cálculo oficial do juiz-chefe") e a página mostra a opção desabilitada.
- Congelar guarda **no servidor** a cópia do `Board` de cada campeonato do telão no instante da ação; telão congelado **nunca** recebe dado novo (reconexão, reinício, rotação, súmula nova). Descongelar apaga a cópia.
- Texto do overlay: modelos `LEADERBOARD CONGELADO` (padrão) e `LEADERBOARD EM REVISÃO`, ou texto livre de **1 a 60 caracteres** (após trim).
- Permissões: SUPER_ADMIN vê e controla todos os telões; ORGANIZER cria telões só com campeonatos que gerencia (vínculo ativo, não suspenso) e vê/controla só os seus; campeonato `blocked` é recusado, `draft` é aceito; vínculo suspenso tira o campeonato do telão na hora.
- Credencial do telão: aleatória (32 bytes), mostrada à TV **uma única vez**, guardada só como hash SHA-256; nunca registrada em log. Códigos de pareamento: criação limitada por IP e tentativas de resgate limitadas por usuário.
- Schema só **aditivo** (modelos novos; nada de colunas removidas, `migrate reset` ou `--accept-data-loss`; skill `no-db-reset`); entrypoint aplica `prisma db push --skip-generate`.
- O websocket antigo `/ws/leaderboard?game=` e `GET /events/:code/board` continuam funcionando sem mudança de contrato.
- Dados dos telões continuam sem informação pessoal (mesmo conteúdo do `/board`).
- `itgames-platform`: ler `node_modules/next/dist/docs/` antes de criar páginas (AGENTS.md). Textos em Português do Brasil; comentários também.
- Commits terminam com as linhas `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` e `Claude-Session: https://claude.ai/code/session_01UriL8PbfAt8PX7SqSXQJSD`. `git add` só dos arquivos da tarefa (nunca `-A`; o submódulo `itgames-server` aparece `m`).
- Os `*.e2e-spec.ts` precisam do banco de teste (credenciais atuais falham com P1000): escreva e compile (`npx tsc --noEmit -p tsconfig.json`), não tente executar nem adivinhar credenciais. Toda lógica que puder ser pura vai para `test/unit` (roda sem banco: `npm run test:unit`).
- Nunca forjar token/JWT durante verificações; no banco de desenvolvimento só são permitidos o `prisma db push --skip-generate` **aditivo** (sem flags; se o Prisma avisar perda de dados, pare e reporte) e as linhas **pendentes de pareamento** criadas por `POST /screens/pairing` (expiram e são limpas pela própria API); nenhuma outra escrita. Nunca `Stop-Process -Name node` (parar processos só por PID/porta).

## Review Focus

1. Telão congelado nunca mostra dado novo: súmula lançada, reconexão do websocket e reinício do servidor servem a cópia (Task 3).
2. Organizador A não lê, edita, congela nem remove telão do organizador B; super admin consegue (Tasks 1 e 2).
3. Código de pareamento expirado, já usado ou inexistente é recusado com a mesma resposta genérica e conta no limite de tentativas (Tasks 1 e 2).
4. Telão removido ou credencial inválida: o websocket fecha (4401/4410) e a TV volta ao pareamento sem travar; a credencial nunca é devolvida duas vezes (Tasks 2, 3 e 5).
5. Dono perde a gestão de um campeonato (vínculo suspenso) ou o campeonato é bloqueado: some do telão ao vivo; telão sem nenhum campeonato mostra aviso "Nenhum campeonato disponível" em vez de erro (Tasks 1, 3 e 6).
6. TV reiniciada ou sem rede enquanto pareada: mantém a credencial, reconecta e continua mostrando o último placar (Task 5).
7. Campeonato em rascunho exibido num telão não vaza para os endpoints públicos (Task 3).

---

### Task 1: Lógica pura dos telões (códigos, credencial, regras, limitador)

**Files:**
- Create: `itgames-api/src/modules/screens/screens-logic.ts`, `itgames-api/src/modules/screens/screen-token.ts`, `itgames-api/src/modules/screens/attempt-limiter.ts`, `itgames-api/test/unit/screens-logic.spec.ts`
- Docs: commit também o spec e este plano na primeira tarefa (`git add docs/superpowers/specs/2026-10-19-telas-de-tv-design.md docs/superpowers/plans/2026-10-20-telas-de-tv.md`)

**Interfaces — Produces:**
- `screens-logic.ts`: `PAIRING_ALPHABET`, `PAIRING_CODE_LENGTH = 6`, `PAIRING_TTL_MS = 600_000`, `OVERLAY_DEFAULT = 'LEADERBOARD CONGELADO'`, `OVERLAY_PRESETS: readonly string[]`, `type ScreenMode = 'partial' | 'official'`; `generatePairingCode(randomInt: (max: number) => number): string`; `normalizePairingCode(input: unknown): string | null` (maiúsculas, ignora espaço e hífen, valida tamanho/alfabeto); `isPairingExpired(expiresAt: Date, now: Date): boolean`; `clampRotateSeconds(input: unknown): number` (padrão 15, limites 5–120, arredonda); `parseOverlayText(input: unknown): string | null` (undefined/vazio → `OVERLAY_DEFAULT`; mais de 60 caracteres após trim → `null`); `parseScreenMode(input: unknown): ScreenMode | null`; `interface GameForScreen { code: string; status?: string | null; canManage: boolean }`; `validateScreenGames(requested: string[], known: ReadonlyMap<string, GameForScreen>, isSuperAdmin: boolean): string | null` (mensagem de erro em português ou `null`); `effectiveGameCodes(codes: string[], manageable: ReadonlySet<string> | 'all', blocked: ReadonlySet<string>): string[]`; `canControlScreen(user: { id: string; role: string }, screen: { ownerId: string | null }): boolean`.
- `screen-token.ts`: `generateDeviceToken(): string` (32 bytes aleatórios em base64url) e `hashDeviceToken(token: string): string` (SHA-256 em hexadecimal).
- `attempt-limiter.ts`: `class AttemptLimiter { constructor(max: number, windowMs: number); hit(key: string, now: number): boolean }` — `true` = permitido; janela deslizante; chaves independentes.

- [ ] **Step 1:** `git checkout -b feat/telas-de-tv` (a partir de `feat/regras-pontuacao`); escrever `screens-logic.spec.ts` com os casos: códigos gerados têm 6 caracteres e nunca contêm `0 O 1 I` (rodar 500 vezes com `randomInt` real); `normalizePairingCode(' k7f-29q ')` → `'K7F29Q'`, `'K7F29'`, `'K7F29O'`, `123` → `null`; `isPairingExpired` falso em 9min59s e verdadeiro em 10min; `clampRotateSeconds(undefined) === 15`, `(1) === 5`, `(500) === 120`, `(30.4) === 30`, `('abc') === 15`; `parseOverlayText(undefined) === 'LEADERBOARD CONGELADO'`, `('  Em revisão  ') === 'Em revisão'`, 61 caracteres → `null`, `'   '` → padrão; `parseScreenMode('partial'|'official')` válidos e `'x'` → `null`; `validateScreenGames`: lista vazia → erro, código desconhecido → erro, `blocked` → erro, organizador com `canManage:false` → erro, super admin ignora `canManage`, `draft` aceito; `effectiveGameCodes(['A','B'], new Set(['A']), new Set())` → `['A']`, `'all'` mantém ambos, `blocked` remove; `canControlScreen`: dono sim, outro organizador não, `SUPER_ADMIN` sim, telão sem dono (pendente) só super admin; token: dois `generateDeviceToken()` diferentes, `hashDeviceToken` estável e com 64 hex; limitador: com `max=3` o 4º `hit` na janela é `false`, passa de novo depois da janela, chaves distintas independentes.
- [ ] **Step 2:** `cd itgames-api && npm run test:unit -- screens-logic` → FAIL.
- [ ] **Step 3:** Implementar os três módulos conforme as assinaturas (sem Nest/Prisma; relógio e aleatoriedade injetados).
- [ ] **Step 4:** `npm run test:unit` → PASS; `npx tsc --noEmit -p tsconfig.build.json` limpo.
- [ ] **Step 5: Commit** — `feat(api): lógica pura dos telões (código, credencial, regras e limitador)`

### Task 2: Modelo, REST e pareamento dos telões (API)

**Files:**
- Modify: `itgames-api/prisma/schema.prisma` (modelos novos, sem relação com `User`: `Screen`, `ScreenGame`, `ScreenLog`), `itgames-api/src/app.module.ts`
- Create: `itgames-api/src/modules/screens/{screens.module.ts,screens.controller.ts,screens.service.ts,screen-notifier.service.ts}`, `itgames-api/src/modules/screens/dto/*.ts`, `itgames-api/test/screens.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 1 (todas as funções puras); `BoardService.loadBoard` (Task 3, para congelar — por isso `freeze` fica **depois** de Task 3: nesta tarefa implemente `freeze`/`unfreeze` chamando `BoardService.loadBoard`, criado aqui como `loadBoard(code: string): Promise<Board>` sem checagem de visibilidade, e fazendo `getBoard(code, user)` = `assertCanView` + `loadBoard` em `src/modules/scoring/board.service.ts`).
- Produces: modelo `Screen` { `id uuid`, `name`, `ownerId String?`, `mode String @default("partial")`, `rotateSeconds Int @default(15)`, `frozen Boolean @default(false)`, `frozenAt DateTime?`, `overlayText String?`, `frozenBoards Json?`, `pairingCode String? @unique`, `pairingExpiresAt DateTime?`, `claimedAt DateTime?`, `deviceTokenHash String? @unique`, `lastSeenAt DateTime?`, `createdAt`, `updatedAt` }, `ScreenGame` { `screenId`, `gameCode`, `@@id` composto }, `ScreenLog` { `id`, `screenId`, `screenName`, `action`, `userId`, `userName`, `createdAt` }.
- `interface ScreenView { id: string; name: string; mode: ScreenMode; rotateSeconds: number; frozen: boolean; frozenAt: string | null; overlayText: string | null; gameCodes: string[]; online: boolean; lastSeenAt: string | null; ownerId: string | null }` (online = `lastSeenAt` nos últimos 45 s).
- `class ScreenNotifier { onChange(l: (screenId: string, kind: 'config' | 'removed') => void): void; changed(screenId: string): void; removed(screenId: string): void }` (global, como `LeaderboardNotifier`).
- Endpoints (JWT global; `@Roles(UserRole.ORGANIZER)` — super admin passa pelo guard existente):
  - `POST /screens/pairing` (`@Public`, limitado por IP: 10 por minuto) → `{ pairingId: string; code: string; expiresAt: string }` (cria `Screen` pendente sem dono; na mesma chamada apaga telões **não resgatados** cujo código expirou há mais de 1 hora).
  - `GET /screens/pairing/:pairingId` (`@Public`) → `{ status: 'pending' | 'expired' }` ou, **uma única vez** após o resgate, `{ status: 'paired', deviceToken: string }` (gera a credencial, grava só o hash); depois → 410.
  - `POST /screens/claim` `{ code, name, gameCodes, mode?, rotateSeconds? }` → `ScreenView` (resposta genérica 404 para código inexistente/expirado/já usado; 10 tentativas inválidas por usuário a cada 10 min → 429).
  - `GET /screens` → `ScreenView[]` (só os do usuário; todos para super admin); `PATCH /screens/:id` `{ name?, gameCodes?, mode?, rotateSeconds? }`; `POST /screens/:id/freeze` `{ text? }`; `POST /screens/:id/unfreeze`; `POST /screens/freeze-all` `{ text? }` e `POST /screens/unfreeze-all` (nos telões que o usuário controla); `DELETE /screens/:id`. Todas as de `:id` respondem 404 (não 403) a quem não controla o telão. Cada ação grava `ScreenLog` e chama `ScreenNotifier`.

- [ ] **Step 1:** Escrever `test/screens.e2e-spec.ts` (compila, não executa): organizador A cria telão com campeonato próprio e B recebe 404 ao tentar `PATCH/freeze/DELETE`; super admin enxerga tudo; `claim` com campeonato que o organizador não gerencia → 400; `mode:'official'` → 400; código expirado/usado → 404; 11 códigos errados seguidos → 429; `GET /screens/pairing/:id` devolve a credencial uma vez e 410 na segunda; `freeze` guarda `frozenBoards` e `unfreeze` limpa; `freeze-all` afeta só os telões do usuário.
- [ ] **Step 2:** Adicionar os modelos ao `schema.prisma` (somente novos); `npx prisma validate`, `npx prisma generate` e `npx prisma db push --skip-generate` (aditivo, sem flags) no banco local de desenvolvimento, conforme Global Constraints; reportar a saída resumida do push.
- [ ] **Step 3:** Implementar `ScreensService` (regras de permissão com `canControlScreen`, `validateScreenGames` carregando os campeonatos e `GameAccessService.canManage`, limitadores `AttemptLimiter` em memória), controller e DTOs com `class-validator`, `ScreenNotifier` e `ScreensModule` (importar em `AppModule`); refatorar `BoardService` (`loadBoard` + `getBoard`) mantendo o comportamento atual do `/board`.
- [ ] **Step 4:** `npm run test:unit` (inclui um teste novo de `getBoard`/`loadBoard` só se isolável; senão cobertura pelo e2e) e `npx tsc --noEmit -p tsconfig.json` + `-p tsconfig.build.json` limpos.
- [ ] **Step 5: Commit** — `feat(api): telões — modelo, pareamento por código e controle pelo organizador`

### Task 3: Websocket dos telões (roteador de upgrade + `/ws/screen`)

**Files:**
- Create: `itgames-api/src/modules/ws/ws-upgrade-router.ts` (provider global), `itgames-api/src/modules/screens/screen-stream.service.ts`, `itgames-api/src/modules/screens/screen-message.ts`, `itgames-api/test/unit/screen-message.spec.ts`, `itgames-api/test/screen-stream.e2e-spec.ts`
- Modify: `itgames-api/src/modules/leaderboard/leaderboard-stream.service.ts` (passa a usar `noServer` + o roteador), `itgames-api/src/modules/screens/screens.module.ts`, `itgames-api/src/modules/screens/screen-notifier.service.ts` (acrescenta `gameChanged`), `itgames-api/src/modules/events/events.service.ts` (`setGameOrganizerActive` e `updateGameStatus` chamam `ScreenNotifier.gameChanged(code)`), `itgames-api/src/app.module.ts`

**Interfaces:**
- Consumes: Tasks 1–2 (`ScreenNotifier`, modelos, `hashDeviceToken`, `effectiveGameCodes`, `BoardService.loadBoard`), `LeaderboardNotifier.onChange(game)`.
- Produces também: `ScreenNotifier.gameChanged(gameCode: string): void` + `onGameChange(l: (gameCode: string) => void): void` — o `ScreenStreamService` recalcula na hora os telões conectados que exibem esse campeonato (vínculo suspenso/reativado, campeonato bloqueado ou liberado; Review Focus 5). `type ScreenRecord = { id: string; name: string; mode: ScreenMode; rotateSeconds: number; frozen: boolean; frozenAt: Date | null; overlayText: string | null; frozenBoards: Board[] | null }`.
- Produces: `class WsUpgradeRouter { register(path: string, wss: WebSocketServer): void }` — um único handler `upgrade` no servidor HTTP que encaminha por `pathname` e responde 404 e destrói o socket para caminhos desconhecidos. **Motivo:** vários `WebSocketServer` com `{ server, path }` no mesmo servidor HTTP recusam os upgrades uns dos outros.
- `ScreenMessage` (em `screen-message.ts`): `{ type: 'screen'; screen: { id: string; name: string; mode: ScreenMode; rotateSeconds: number; frozen: boolean; frozenAt: string | null; overlayText: string | null; games: { code: string; name: string }[] }; boards: Board[] }` e `buildScreenMessage(screen: ScreenRecord, liveBoards: Board[]): ScreenMessage` (puro: se `screen.frozen`, usa **somente** `screen.frozenBoards`, ignorando `liveBoards`).
- Websocket `ws://host/ws/screen?token=<deviceToken>`: token inexistente → fecha 4401; telão removido (via `ScreenNotifier.removed`) → fecha 4410; envia `ScreenMessage` ao conectar, a cada `changed` do telão e (se não congelado) a cada alteração de placar de um campeonato do telão (debounce 300 ms); atualiza `lastSeenAt` ao conectar, a cada 30 s e ao fechar.

- [ ] **Step 1:** `screen-message.spec.ts` (unitário): congelado → `boards` vêm só da cópia mesmo com `liveBoards` diferentes (Review Focus 1); não congelado → `liveBoards`; `games` é derivado dos próprios boards (`board.game.code`/`board.game.name`, na ordem recebida, e no congelado vem de `frozenBoards`); telão sem campeonatos efetivos → `boards: []` (Review Focus 5). `screen-stream.e2e-spec.ts` (compila, não executa): conecta com token válido e recebe `screen`; token inválido fecha 4401; lança score em campeonato do telão → recebe novo `screen` só quando não congelado; `DELETE` do telão fecha 4410; `/ws/leaderboard?game=` antigo continua respondendo (Review Focus 1, 4, 7).
- [ ] **Step 2:** `npm run test:unit -- screen-message` → FAIL.
- [ ] **Step 3:** Implementar `screen-message.ts`, `WsUpgradeRouter`, mover `LeaderboardStreamService` para `noServer` registrando `/ws/leaderboard` no roteador (comportamento idêntico), e `ScreenStreamService` (carrega o telão pelo hash da credencial, calcula `effectiveGameCodes` com o dono atual — super admin `'all'`, organizador pelos vínculos ativos —, usa `BoardService.loadBoard`, nunca recalcula quando congelado).
- [ ] **Step 4:** `npm run test:unit`, `tsc` (build e completo) limpos. Subir a API em outra porta (`PORT=3398`), conectar um cliente `ws` ao `/ws/leaderboard?game=SUMMER2026` e conferir que o placar antigo ainda chega; parar só o processo iniciado.
- [ ] **Step 5: Commit** — `feat(api): websocket dos telões com roteador de upgrade e congelamento servido da cópia`

### Task 4: Página "Telões" no webapp

**Files:**
- Create: `itgames-platform/src/app/telas/page.tsx`, `itgames-platform/src/lib/screens.ts`, `itgames-platform/src/lib/__tests__/screens.test.ts`
- Modify: `itgames-platform/src/lib/api-client.ts` (métodos dos telões), `itgames-platform/src/components/layout/Navbar.tsx` (link "Telões" para `SUPER_ADMIN` e `ORGANIZER`)

**Interfaces:**
- Consumes: endpoints da Task 2 (`ScreenView`, `claim`, `PATCH`, `freeze*`, `unfreeze*`, `DELETE`) e `listMyGames()` para escolher campeonatos.
- Produces em `screens.ts`: `interface ScreenView` (espelho da API); `OVERLAY_PRESETS: string[]` (`'LEADERBOARD CONGELADO'`, `'LEADERBOARD EM REVISÃO'`); `normalizeCodeInput(text: string): string` (maiúsculas, remove espaço/hífen, corta em 6); `describeScreenState(s: ScreenView, now: Date): { label: string; tone: 'live' | 'frozen' | 'offline' }` (`ao vivo`, `congelado desde HH:MM`, `offline — visto há X min`); `formatLastSeen(lastSeenAt: string | null, now: Date): string`; `isValidOverlayText(text: string): boolean` (1–60 após trim).
- Página: protegida por `AclGuard resource="admin"` (mesmo mecanismo das demais); lista (polling a cada 10 s), "Parear telão" (código + nome + campeonatos + modo + rotação), "Congelar" (passo para escolher modelo ou texto livre ≤ 60), "Congelar/Descongelar todos", editar, remover (com confirmação); opção **Oficial** visível e desabilitada com a explicação do spec; tema/estilo igual ao das outras páginas; textos em português.

- [ ] **Step 1:** `screens.test.ts`: `normalizeCodeInput(' k7f-29q9 ')` → `'K7F29Q'`; `describeScreenState` para ao vivo / congelado (hora formatada) / offline; `formatLastSeen(null)` → texto de "nunca visto"; `isValidOverlayText('')` falso, `'EM REVISÃO'` verdadeiro, 61 caracteres falso; asserts reais.
- [ ] **Step 2:** `cd itgames-platform && npx vitest run src/lib/__tests__/screens.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `screens.ts`, os métodos em `api-client.ts` (padrão `strict` com autenticação), a página e o link do menu (ler os docs do Next 16 antes).
- [ ] **Step 4:** `npx vitest run`, `npx tsc --noEmit`, `npm run build` → sucesso.
- [ ] **Step 5: Commit** — `feat(platform): página Telões para parear, configurar e congelar`

### Task 5: App de TV — pareamento e conexão do telão

**Files:**
- Create: `itgames-tv/app/src/main/java/br/com/itgames/tv/Pairing.kt`, `ScreenMessage.kt`, `ScreenSocket.kt`, `ui/PairingScreen.kt`, `app/src/test/java/br/com/itgames/tv/ScreenMessageTest.kt`
- Modify: `Prefs.kt` (`deviceToken: String?`), `Api.kt` (URL do websocket `/ws/screen`), `MainActivity.kt`, `ui/SetupScreen.kt` (vira só edição do endereço do servidor + "Desparear"), `itgames-tv/README.md`

**Interfaces:**
- Consumes: `POST /screens/pairing`, `GET /screens/pairing/:id`, `ws /ws/screen?token=` (Tasks 2–3); `Board` existente.
- Produces: `data class ScreenConfig(val id: String, val name: String, val mode: String, val rotateSeconds: Int, val frozen: Boolean, val frozenAt: String?, val overlayText: String?, val games: List<GameRef>)`, `data class GameRef(val code: String, val name: String)`, `data class ScreenState(val config: ScreenConfig?, val boards: List<Board>, val link: Link, val error: String?)`; `ScreenMessage.parse(text: String): Pair<ScreenConfig, List<Board>>?` (null se não for `type:"screen"`); `class ScreenSocket(url: String, scope: CoroutineScope, onUnpaired: () -> Unit)` com `state: StateFlow<ScreenState>`, reconexão como `BoardSocket` (2 s → 30 s), mantém o último estado offline; códigos 4401/4410 chamam `onUnpaired` (limpa a credencial); `suspend fun requestPairing(server: String): PairingRequest` e `suspend fun pollPairing(server: String, pairingId: String): PairingPoll` (`Pending | Expired | Paired(token)`) em `Pairing.kt`.
- `MainActivity`: sem credencial → `PairingScreen` (código grande legível de longe, instrução "Abra Telões no painel do organizador e digite o código", renova o código quando expira, polling a cada 3 s); com credencial → telão; MENU abre a tela do servidor.

- [ ] **Step 1:** `ScreenMessageTest.kt`: mensagem completa (config com `frozen:true`, `overlayText`, 2 jogos, 2 boards) vira `ScreenConfig` + 2 `Board`; mensagem sem `overlayText`/`frozenAt` → `null`; `type` diferente → `null`; `boards` vazio parseia (Review Focus 5).
- [ ] **Step 2:** `cd itgames-tv && .\gradlew.bat :app:testDebugUnitTest` (PowerShell) → FAIL.
- [ ] **Step 3:** Implementar os arquivos listados; o endereço do servidor continua em `Prefs.serverUrl` (padrão do build `BuildConfig.DEFAULT_API_URL`); com credencial salva a TV reconecta sozinha ao reabrir (Review Focus 6); quando `onUnpaired` dispara, limpa `deviceToken` e volta ao pareamento (Review Focus 4). Ainda **sem** mudar o `BoardScreen` (Task 6): exiba o primeiro `Board` da lista com a tela atual.
- [ ] **Step 4:** Testes unitários e `.\gradlew.bat :app:assembleDebug` → BUILD SUCCESSFUL.
- [ ] **Step 5: Commit** — `feat(tv): pareamento por código e conexão do telão`

### Task 6: App de TV — modos, congelamento com overlay e vários campeonatos

**Files:**
- Modify: `itgames-tv/app/src/main/java/br/com/itgames/tv/ui/BoardScreen.kt`, `MainActivity.kt` (passa `ScreenState`), `itgames-tv/README.md`
- Test: `itgames-tv/app/src/test/java/br/com/itgames/tv/PagesTest.kt`

**Interfaces:**
- Consumes: `ScreenState`/`ScreenConfig` da Task 5.
- Produces: `data class BoardPage(val gameIndex: Int, val categoryIndex: Int, val page: Int, val pages: Int)`; `fun pagesOf(boards: List<Board>): List<BoardPage>` (por campeonato, categorias com equipes, páginas de 6 linhas; campeonato sem equipes é pulado, e se nenhum tiver equipes retorna a primeira página vazia do primeiro); `fun statusBadge(config: ScreenConfig?): StatusBadge` com `enum class StatusBadge { PARCIAL, OFICIAL, CONGELADO }` (`frozen` vence o modo) e `fun frozenSince(frozenAt: String?, zone: java.time.ZoneId): String?` (`HH:mm`).
- UI: selo no cabeçalho (`PARCIAL` âmbar, `OFICIAL` verde, `CONGELADO` azul com cadeado e a hora); **overlay** quando congelado: faixa grande e legível de longe com `overlayText` sobre o placar, sem escondê-lo por completo; nome do campeonato no cabeçalho quando há mais de um; rotação com `rotateSeconds` do telão (teclas ◀ ▶ e OK mantidas); sem campeonatos efetivos → mensagem "Nenhum campeonato disponível" (Review Focus 5); `PARCIAL` mantém o aviso discreto de resultados sujeitos a homologação; congelado ignora qualquer dado novo (o servidor já manda só a cópia).

- [ ] **Step 1:** `PagesTest.kt`: `pagesOf` com 2 campeonatos (7 e 3 equipes na categoria) → páginas `[(0,0,0,2),(0,0,1,2),(1,0,0,1)]` na ordem; campeonato sem equipes é pulado; todos vazios → uma página; lista de boards vazia → lista vazia; `statusBadge(frozen=true, mode=official)` → `CONGELADO`; `frozenSince("2026-10-20T14:32:00.000Z", ZoneOffset.UTC)` → `"14:32"`, `null` → `null`.
- [ ] **Step 2:** `.\gradlew.bat :app:testDebugUnitTest` → FAIL.
- [ ] **Step 3:** Implementar as funções puras e adaptar `BoardScreen`/`MainActivity`; manter 6 linhas por página e o layout de 1080p; textos em português.
- [ ] **Step 4:** Testes e `assembleDebug` → sucesso.
- [ ] **Step 5: Commit** — `feat(tv): selos PARCIAL/OFICIAL/CONGELADO, overlay de congelamento e rotação entre campeonatos`

### Task 7: Verificação local ponta a ponta

**Files:** nenhum arquivo de produto (correções só se algo impedir a verificação; defeitos encontrados são reportados, não corrigidos aqui).

- [ ] **Step 1:** Suítes: `npm run test:unit` (API), `npx tsc --noEmit -p tsconfig.build.json` e `-p tsconfig.json`; `npx vitest run`, `npx tsc --noEmit`, `npm run build` (plataforma); `.\gradlew.bat :app:testDebugUnitTest :app:assembleDebug` (TV). Registrar contagens.
- [ ] **Step 2:** API (porta 3399) e plataforma (porta 3010, `NEXT_PUBLIC_API_URL=http://localhost:3399`) locais, escrevendo no banco **só** o que as Global Constraints permitem: `POST /screens/pairing` devolve código de 6 caracteres sem `0/O/1/I`; `GET /screens/pairing/:id` → `pending`; `ws /ws/leaderboard?game=SUMMER2026` continua entregando o placar; `ws /ws/screen?token=invalido` fecha 4401. A página `/telas` abre (200) e, com navegador disponível, o login e o resgate do código ficam como **passo manual do usuário** (precisa de login real).
- [ ] **Step 3:** Emulador `ITGames_TV` (APK debug; servidor `http://10.0.2.2:3399`): a TV mostra o código de pareamento e o renova ao expirar. Para a parte visual dos modos use um servidor WebSocket **mock** (script temporário dentro de `itgames-api/`, apagado no fim) que fala o `ScreenMessage` com: modo parcial; congelado com overlay "LEADERBOARD EM REVISÃO"; 2 campeonatos; telão sem campeonatos. Capturar com `adb shell screencap` + `adb pull`, olhar cada imagem e conferir selos, overlay legível, nome do campeonato quando há dois, mensagem "Nenhum campeonato disponível" e que 6 linhas continuam cabendo. Review Focus 6: pré-gravar `deviceToken` nas SharedPreferences (`run-as`, como na verificação anterior) e conferir que a TV reabre **sem** mostrar o pareamento, conecta ao mock e, com o mock desligado, mantém o último placar com "RECONECTANDO"; o mock fechando com código 4401 devolve a TV ao pareamento.
- [ ] **Step 4:** Parar só os processos iniciados (por PID/porta) e `adb emu kill`; confirmar `git status` sem arquivos soltos.
- [ ] **Step 5:** Reportar o que ficou **NÃO VERIFICADO** (resgate do código com login real, congelar/descongelar ponta a ponta com o banco, e2e dependentes do banco de teste).

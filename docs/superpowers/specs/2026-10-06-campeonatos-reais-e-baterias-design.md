# Campeonatos reais no menu e Baterias na API — Design (parte 1 de 3)

Data: 2026-10-06 · Status: aguardando revisão

## Contexto e objetivo

O seletor "Selecione o Campeonato" do menu superior e as telas **Súmulas**, **Baterias** e **Juiz** leem campeonatos do `localStorage` (`storage.getGames()`), que na primeira visita é semeado com dados fictícios (`MOCK_GAMES`: "Copa dos Campeões CrossFit 2026" e "HYROX National Championship 2026", mais categorias, equipes, notas e baterias inventadas). Para um campeonato real (ex.: SUMMER2026) essas telas ficam vazias, porque categorias, WODs, equipes e baterias também só são lidos do armazenamento local, nunca da API.

A migração completa foi dividida em três partes, cada uma com spec, plano e entrega própria:

1. **Esta spec:** fundação (campeonatos reais, camada de dados da API, limpeza dos fictícios) e a tela de **Baterias** 100% na API.
2. Juiz: lançamento de notas e leitura de baterias/equipes pela API (inclui campos de nota que faltam no servidor).
3. Súmulas: modelos de súmula guardados no servidor e impressão com dados reais.

**Objetivo desta parte:** o seletor do menu e das três telas lista só campeonatos reais; nenhum dado fictício é semeado nem exibido; a tela de Baterias usa a API como única fonte de verdade para categorias, WODs, inscrições e baterias.

## Decisões já tomadas

- Camada de dados da API como fonte de verdade (abordagem A). Não se espelha a API no `storage`.
- Quem vê o quê no seletor: visitante e atleta veem os campeonatos **liberados** (`GET /events`); organizador vê os **seus**, de qualquer status (`GET /events/mine`, só vínculos ativos); super admin vê **todos** (`GET /events/mine`).
- Sem campeonato disponível: o menu e as telas mostram "Nenhum campeonato disponível", sem erro.
- Súmulas e Juiz mudam **só o seletor** nesta parte; os dados dessas telas migram nas partes 2 e 3.

## Fora do escopo

Juiz e Súmulas lerem categorias/WODs/equipes/baterias da API; modelos de súmula e lista de juízes no servidor; as telas Admin e Atleta (continuam como estão); mudanças no servidor de baterias (ele já cobre o necessário).

## Arquitetura

Dois módulos novos no `itgames-platform/src/lib`, sem dependência de `storage`:

### `lib/arena-data.ts` — conversores puros API → tipos das telas

Funções puras (testáveis sem rede):

| Função | Entrada (API) | Saída |
|---|---|---|
| `mapGame(g)` | item de `GET /events` ou `/events/mine` | `GameEvent` (`id = code`, `code`, `name`, `description`, `location`, datas a partir de `date`, `eventType`, `status`, `lanesCount`, `scoringRules`) |
| `mapCategory(c, gameCode)` | `GET /events/:code/categories` | `Category` (`id = String(code)`, `name`, formato e limites) |
| `mapWorkout(w, gameCode)` | `GET /events/:code/workouts` | `WorkoutRule` (`id = String(code)`, `categoryId = String(category)`, `title`, `type`, `timeCapSeconds` via `parseTimeToSeconds`) |
| `mapRegistration(r, gameCode)` | `GET /events/:code/registrations` | `TeamRegistration` (`id = String(code)`, `categoryId = String(categoryId)`, `teamName = team`, `registerNumber = number ?? '#'+code`, `athletes`) |
| `mapHeat(h, gameCode)` | `GET /heats/game/:code/workout/:wod` | `Heat` (`id` = uuid do servidor, `workoutId = String(workoutCode)`, `categoryId = String(categoryId)`, `heatNumber`, `startTime`, `status`, `laneAssignments`) |

`laneAssignments[]` de cada bateria ganha o campo opcional **`slotId`** (id da `LaneSlot`), necessário para trocar raias pela API. O tipo `Heat` em `types/index.ts` recebe `slotId?: string` em cada atribuição; o restante do tipo não muda.

### `lib/use-games.ts` — hook do seletor

`useGames()` devolve `{ games, activeGame, setActiveGame, isLoading }`:

- Busca conforme o perfil da sessão (`getCurrentUserSession().role`): `SUPER_ADMIN` e `ORGANIZER` usam `listMyGames()`; os demais usam `listGames()`.
- `activeGame` = campeonato cujo código está guardado na preferência `ITGAMES_ACTIVE_GAME` do `localStorage` (a mesma chave de hoje, só o código); se não existir na lista, o primeiro da lista; se a lista estiver vazia, `null`.
- `setActiveGame(code)` grava a preferência e dispara o evento `itgames_storage_updated` (já ouvido por Admin e Atleta), mantendo a sincronia entre telas.
- Recarrega ao mudar a sessão (`itgames_auth_changed`).

### Limpeza dos dados fictícios

- `storage.initDefaultsIfEmpty()` deixa de semear `MOCK_GAMES`, `MOCK_CATEGORIES`, `MOCK_WORKOUTS`, `MOCK_TEAMS`, `MOCK_SCORES`, `MOCK_HEATS` e `MOCK_ORGANIZATIONS`. Os modelos de súmula padrão e o log de auditoria inicial continuam (as partes 2 e 3 os tratam).
- Os fallbacks `getItem(KEY, MOCK_*)` em `getGames`, `getCategories`, `getWorkouts` e `getTeams` passam a `[]`.
- Uma **limpeza única** (`purgeMockData`, marcada em `localStorage` como já executada) remove dos dados já gravados no navegador os registros cujo `gameId`/`id` seja `game_cf_2026` ou `game_hy_2026` (campeonatos) e os que apontam para eles (categorias, WODs, equipes, notas, baterias), além das organizações fictícias `org_1` e `org_2`. Registros reais não são tocados. Roda uma vez por navegador, antes do primeiro carregamento do seletor.
- `mock-data.ts` permanece no repositório porque o log de auditoria inicial e os modelos de súmula ainda o referenciam; os exports de campeonato ficam sem uso nesta parte.

## Tela de Baterias

Tudo vem da API; a tela guarda só estado de interface:

1. **Carga:** com `activeGame`, busca categorias, WODs e inscrições (`listCategories`, `listWorkouts`, `listRegistrations`) e converte com `arena-data`. Seleciona a primeira categoria e o primeiro WOD dessa categoria.
2. **Baterias:** ao mudar o WOD, busca `getHeats(gameCode, workoutCode)` e converte. A tela mostra as baterias do WOD selecionado.
3. **Gerar:** `generateHeats({ gameCode, categoryId, workoutCode, totalLanes, startHour, intervalMinutes, isFinalSeeding })` e recarrega as baterias. A resposta `{ success:false, message }` (ex.: nenhuma equipe inscrita) vira aviso, sem "sucesso". O gerador local `heats-generator.ts` deixa de ser usado por esta tela.
4. **Trocar raias:** dois cliques em raias da mesma bateria chamam `swapLanes(slotIdA, slotIdB)` e recarregam; falha mostra aviso e não altera a tela.
5. **Status:** `updateHeatStatus(heatId, status)` e recarrega.
6. **Permissões:** gerar e trocar raias são só do organizador do campeonato (servidor valida). Para juiz e demais, os botões de edição ficam desabilitados; a leitura é pública para campeonato liberado.
7. **Estados:** carregando; sem campeonato; sem categorias; sem WODs; sem inscrições; erro de rede (aviso com "tentar de novo"). Nenhum desses estados cai em dados locais.

A "final por pontos" (`isFinalSeeding`) usa a regra do servidor (soma dos pontos já gravados); a tela deixa de calcular ranking local.

## Navbar, Súmulas e Juiz

- `Navbar` troca `storage.getGames()` por `useGames()`; a lista, o campeonato ativo e a troca vêm do hook. Mostra "Nenhum campeonato disponível" quando vazio.
- `sumulas/page.tsx` e `judge/page.tsx` trocam apenas a origem de `games`/`activeGame` por `useGames()`. O restante (categorias, WODs, equipes, baterias, modelos, notas) continua lendo `storage` até as partes 2 e 3; para campeonatos reais isso resulta em listas vazias, como já acontece hoje. Cada uma dessas telas mostra um aviso curto "Dados deste campeonato ainda não estão disponíveis nesta tela" quando o campeonato ativo não tem categorias locais, para não parecer quebrada.

## Erros e segurança

- Falhas de rede/permissão da API não derrubam a tela: aviso (`toast`) e estado de erro com botão de recarregar.
- Nenhuma credencial ou dado pessoal novo trafega; `listRegistrations` já é restrito ao organizador do campeonato (a tela de Baterias é restrita a organizador, juiz e super admin pelo `AclGuard`). Para **juiz**, `GET /events/:code/registrations` é negado (403); nesse caso a tela usa as equipes que vêm dentro das baterias (já traz nome, número e atletas) e não lista "equipes sem bateria".
- O endpoint de leitura de baterias é público para campeonato liberado; o hook não grava nada no servidor.

## Testes

**Frontend (unitários, sem rede):** o `itgames-platform` não tem executor de testes hoje. Esta parte adiciona **Vitest** como `devDependency` (ambiente Node, sem navegador) e o script `npm test`. Não entra na imagem de produção, porque `npm install --omit=dev` ignora `devDependencies`. Testes:
- `arena-data`: cada conversor com um item real de exemplo e casos vazios/nulos (`number` nulo vira `#código`, `timeCap` inválido vira 0, bateria sem slots).
- Escolha do campeonato ativo: preferência existente, preferência de campeonato que sumiu, lista vazia.
- `purgeMockData`: remove só os fictícios e é idempotente.

**Servidor:** nenhuma mudança de código; os testes e2e de baterias existentes continuam valendo.

**Manual guiado (navegador):** menu e as três telas mostram só o SUMMER2026 (sem os fictícios, inclusive em navegador que já tinha os dados antigos); em Baterias, gerar, trocar raia e mudar status persistem após recarregar; usuário sem permissão não consegue editar.

## Riscos

- O `Heat` local usa `laneAssignments` aninhado e a API usa `LaneSlot`; o conversor é o único ponto de tradução e tem testes.
- Telas Admin e Atleta ainda leem/gravam alguns dados no `storage`. Esta parte não as altera, e a limpeza não remove registros reais.
- Súmulas e Juiz ficam parcialmente vazias até as partes 2 e 3 (aviso explícito na tela).

## Próximas partes (visão geral)

- **Parte 2 — Juiz:** `ScoreEntry` completo no servidor (rounds, desclassificação, assinatura, contestação), leitura de baterias e equipes reais, lista de juízes.
- **Parte 3 — Súmulas:** tabela de modelos de súmula, campos ricos de WOD (padrões de movimento, desempate, estações HYROX) e impressão com dados reais.

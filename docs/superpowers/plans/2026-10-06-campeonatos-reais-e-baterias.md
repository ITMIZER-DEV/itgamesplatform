# Campeonatos reais no menu e Baterias na API — Implementation Plan (parte 1 de 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O seletor de campeonato do menu e das telas Súmulas, Baterias e Juiz lista só campeonatos reais da API (sem dados fictícios), e a tela de Baterias lê e grava tudo pela API.

**Architecture:** Dois módulos novos em `itgames-platform/src/lib`: `arena-data.ts` (conversores puros API → tipos das telas, testados com Vitest) e `use-games.ts` (hook que busca os campeonatos conforme o perfil). Uma limpeza única (`mock-purge.ts`) remove os campeonatos fictícios já gravados no navegador, e o `storage` deixa de semeá-los. A tela de Baterias troca o `storage` por chamadas à API (gerar, trocar raias e status passam a ser estritos: erro vira aviso). Súmulas e Juiz só trocam a origem do seletor.

**Tech Stack:** Next.js 16 (App Router, `'use client'`), React 19, TypeScript, Tailwind, `sonner`, Vitest (novo, só devDependency).

**Spec:** `docs/superpowers/specs/2026-10-06-campeonatos-reais-e-baterias-design.md`

## Global Constraints

- Idioma: textos de tela, avisos e comentários em **português do Brasil, com acentuação correta**; identificadores de código em inglês.
- **Next.js deste repo tem mudanças que quebram APIs conhecidas** (`itgames-platform/AGENTS.md`): copiar os padrões de páginas existentes; só consultar `node_modules/next/dist/docs/` se o build reclamar.
- **Regra de lint do repositório `react-hooks/set-state-in-effect`:** nunca chamar `setState` de forma síncrona no corpo de um `useEffect`. Dentro de callbacks de `.then`/`.catch`/`.finally` é permitido. Valores derivados saem de `useState` lazy ou de cálculo no render.
- **Nunca** usar o `storage` (localStorage) como fonte dos campeonatos, categorias, WODs, equipes ou baterias da tela de Baterias. Só a preferência `itgames_active_game_id` (apenas o código) continua no navegador.
- Falha de rede ou de permissão: aviso (`toast`) e estado de erro na tela. **Nunca** cair em dados locais ou fictícios.
- Não alterar o servidor (`itgames-api`): ele já cobre tudo desta parte. Não alterar as telas Admin e Atleta.
- `apiClient.getHeats` (tolerante) é usado por `campeonatos/[code]/page.tsx`: **não mudar**. Os métodos novos estritos têm outro nome (`fetchHeats`).
- Convenção do repo: um commit por task, mensagem em inglês no estilo `feat(...)`, terminando com as linhas de atribuição pedidas pelo harness. **Só commitar se o usuário pedir.**
- O ambiente local de desenvolvimento está no ar (frontend na 3000, API na 3334). Não rodar `next build` no diretório do projeto enquanto o `npm run dev` estiver ativo (corrompe o `.next`); a verificação de build é por `docker compose build frontend`.

## Desvios deliberados da spec

1. **`MOCK_ORGANIZATIONS` e o armazenamento de organizações não são tocados.** A spec previa remover `org_1`/`org_2`, mas os campeonatos reais já usam `organizationId: 'org_1'` como valor de preenchimento (ver `athlete/register/page.tsx`); apagar a organização quebraria telas que a consultam. Só os dados de campeonato fictício saem.
2. **Os registros de auditoria iniciais fictícios e o `itgames_active_game_id = 'game_cf_2026'` deixam de ser semeados** (ambos apontam para o campeonato fictício). A spec dizia que a auditoria continuava; semear linhas que apontam para um campeonato que não existe mais só poluiria. A limpeza também remove os já gravados.

## Review Focus

1. **Navegador que já tem os fictícios gravados** (`game_cf_2026`, `game_hy_2026` e tudo que aponta para eles) não pode vê-los nem por um instante, e dados reais gravados localmente não podem ser apagados. Testes na Task 2.
2. **API devolve `null` (rede/erro) em categorias, WODs ou inscrições:** a tela mostra o erro e **não** cai em dados locais. Verificação na Task 4.
3. **Perfil JUIZ:** `GET /events/:code/registrations` retorna 403; a tela não chama esse endpoint para quem não é organizador/super admin e conta as equipes pelas baterias. Task 4.
4. **`generateHeats` responde `{ success: false, message }`** (ex.: nenhuma equipe inscrita): o aviso é de erro, nunca "baterias geradas". Task 4.
5. **Campeonato real sem categorias, sem WODs ou sem inscrições:** a tela mostra estados vazios sem quebrar (`selectedCategoryId` vazio, `currentWorkout` indefinido). Task 4.
6. **Preferência de campeonato ativo que aponta para um campeonato que o usuário não vê** (ex.: rascunho de organizador depois de sair da conta): cai no primeiro da lista. Testes na Task 1.

---

## File Structure

**Criar**
- `itgames-platform/vitest.config.ts` — configuração do Vitest (ambiente Node, alias `@`).
- `itgames-platform/src/lib/arena-data.ts` — conversores puros API → tipos das telas e `pickActiveGame`.
- `itgames-platform/src/lib/__tests__/arena-data.test.ts`
- `itgames-platform/src/lib/mock-purge.ts` — limpeza única dos fictícios gravados no navegador.
- `itgames-platform/src/lib/__tests__/mock-purge.test.ts`
- `itgames-platform/src/lib/__tests__/storage-defaults.test.ts` — `storage` não semeia fictícios.
- `itgames-platform/src/lib/use-games.ts` — hook `useGames()`.

**Modificar**
- `itgames-platform/package.json` — `vitest` (dev) e script `test`.
- `itgames-platform/src/types/index.ts` — `slotId?` nas raias de `Heat`.
- `itgames-platform/src/lib/storage.ts` — sem sementes fictícias, sem fallback fictício, chama a limpeza.
- `itgames-platform/src/lib/api-client.ts` — `generateHeats`, `swapLanes`, `updateHeatStatus` estritos e novo `fetchHeats`.
- `itgames-platform/src/components/layout/Navbar.tsx` — seletor via `useGames()`.
- `itgames-platform/src/app/heats/page.tsx` — dados e ações pela API.
- `itgames-platform/src/app/sumulas/page.tsx`, `itgames-platform/src/app/judge/page.tsx` — seletor via `useGames()` e aviso.

---

### Task 1: Vitest, conversores `arena-data` e `pickActiveGame`

**Files:**
- Modify: `itgames-platform/package.json`
- Create: `itgames-platform/vitest.config.ts`
- Modify: `itgames-platform/src/types/index.ts`
- Create: `itgames-platform/src/lib/arena-data.ts`
- Test: `itgames-platform/src/lib/__tests__/arena-data.test.ts`

**Interfaces:**
- Produces (em `lib/arena-data.ts`, todos puros):
  - `mapGame(g: any): GameEvent`
  - `mapCategory(c: any, gameCode: string, eventType?: GameEvent['eventType']): Category`
  - `mapWorkout(w: any, gameCode: string): WorkoutRule`
  - `mapRegistration(r: any, gameCode: string, categoryName?: string): TeamRegistration`
  - `mapHeat(h: any, gameCode: string): Heat`
  - `pickActiveGame(games: GameEvent[], preferredCode: string): GameEvent | null`
- `Heat['laneAssignments'][number]` ganha `slotId?: string`.

- [ ] **Step 1: Instalar o Vitest e configurar**

```bash
cd D:/Projects/fitness/itgames/itgames-platform && npm install -D vitest
```

Em `package.json`, dentro de `"scripts"`, acrescentar a linha `"test": "vitest run",` (depois de `"lint": "eslint"`, lembrando da vírgula). Criar `itgames-platform/vitest.config.ts`:

```ts
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
```

- [ ] **Step 2: Escrever o teste que falha**

Criar `itgames-platform/src/lib/__tests__/arena-data.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mapCategory, mapGame, mapHeat, mapRegistration, mapWorkout, pickActiveGame } from '../arena-data';

describe('mapGame', () => {
  it('converte um campeonato da API', () => {
    const g = mapGame({
      code: 'SUMMER2026',
      name: 'Summer Cross',
      description: 'desc',
      location: 'Goiânia',
      date: '2026-11-15T00:00:00.000Z',
      eventType: 'crossfit',
      status: 'live',
      lanesCount: 10,
      isLowestPointsBetter: true,
      pixKey: 'chave',
    });
    expect(g).toMatchObject({
      id: 'SUMMER2026',
      code: 'SUMMER2026',
      name: 'Summer Cross',
      startDate: '2026-11-15',
      endDate: '2026-11-15',
      eventType: 'crossfit',
      status: 'live',
      lanesCount: 10,
      pixKey: 'chave',
    });
    expect(g.scoringRules).toEqual({ isLowestPointsBetter: true, hyroxChipTimingEnabled: false });
  });

  it('hyrox liga o cronômetro por chip; status desconhecido vira draft; campos ausentes têm padrão', () => {
    const g = mapGame({ code: 'H1', eventType: 'hyrox', status: 'estranho' });
    expect(g.scoringRules.hyroxChipTimingEnabled).toBe(true);
    expect(g.status).toBe('draft');
    expect(g).toMatchObject({ name: 'H1', description: '', location: '', startDate: '', lanesCount: 8 });
  });

  it('aceita os status liberado e bloqueado', () => {
    expect(mapGame({ code: 'A', status: 'blocked' }).status).toBe('blocked');
    expect(mapGame({ code: 'A', status: 'live' }).status).toBe('live');
  });
});

describe('mapCategory', () => {
  it('converte código em id texto e traz o limite de vagas', () => {
    const c = mapCategory(
      { code: 3, name: 'RX', teamType: 'duo', maxAthlete: 2, genderRule: 'male', amount: 150, maxRegistrations: 10, registrationsCount: 4 },
      'G1',
    );
    expect(c).toMatchObject({
      id: '3',
      gameId: 'G1',
      name: 'RX',
      teamFormat: 'duo',
      maxAthletesPerTeam: 2,
      genderComposition: 'male',
      price: 150,
      maxRegistrations: 10,
      registrationsCount: 4,
    });
  });

  it('valores ausentes viram padrões', () => {
    const c = mapCategory({ code: 1, name: 'X' }, 'G1');
    expect(c).toMatchObject({ teamFormat: 'individual', maxAthletesPerTeam: 1, genderComposition: 'open', price: 0 });
    expect(c.maxRegistrations ?? null).toBeNull();
  });
});

describe('mapWorkout', () => {
  it('converte o tempo limite e os ids', () => {
    const w = mapWorkout({ code: 2, category: 5, title: 'Fran', type: 'for_time', timeCap: '12:00', description: 'd' }, 'G1');
    expect(w).toMatchObject({ id: '2', gameId: 'G1', categoryId: '5', title: 'Fran', type: 'for_time', timeCapSeconds: 720 });
  });

  it('tempo limite nulo vira 0; título e tipo ausentes têm padrão', () => {
    const w = mapWorkout({ code: 7, category: 1, timeCap: null }, 'G1');
    expect(w).toMatchObject({ id: '7', title: 'WOD 7', type: 'for_time', timeCapSeconds: 0 });
  });
});

describe('mapRegistration', () => {
  const reg = {
    code: 1101,
    categoryId: 2,
    team: 'Dupla Teste',
    number: '#1101',
    status: 'paid',
    amount: 150,
    check: true,
    athletes: [
      { code: 1, name: 'Ana', gender: 'F' },
      { code: 2, name: 'Bia', gender: 'F' },
    ],
  };

  it('converte a inscrição em equipe', () => {
    const t = mapRegistration(reg, 'G1', 'FEMININA');
    expect(t).toMatchObject({
      id: '1101',
      gameId: 'G1',
      categoryId: '2',
      categoryName: 'FEMININA',
      teamName: 'Dupla Teste',
      registerNumber: '#1101',
    });
    expect(t.athletes.map((a) => a.name)).toEqual(['Ana', 'Bia']);
  });

  it('número ausente vira #código e atletas ausentes viram lista vazia', () => {
    const t = mapRegistration({ code: 9, categoryId: 1, team: 'X' }, 'G1');
    expect(t.registerNumber).toBe('#9');
    expect(t.athletes).toEqual([]);
  });
});

describe('mapHeat', () => {
  const heat = {
    id: 'h-uuid',
    gameCode: 'G1',
    categoryId: 1,
    workoutCode: 4,
    heatNumber: 2,
    startTime: '09:15',
    status: 'calling',
    slots: [
      { id: 's2', laneNumber: 2, teamCode: 102, registration: { team: 'Time B', number: '#102', athletes: [{ name: 'B1' }] } },
      { id: 's1', laneNumber: 1, teamCode: 101, registration: { team: 'Time A', number: '#101', athletes: [{ name: 'A1' }, { name: 'A2' }] } },
    ],
  };

  it('converte a bateria e ordena as raias, guardando o id da vaga', () => {
    const h = mapHeat(heat, 'G1');
    expect(h).toMatchObject({ id: 'h-uuid', gameId: 'G1', workoutId: '4', categoryId: '1', heatNumber: 2, startTime: '09:15', status: 'calling' });
    expect(h.laneAssignments.map((l) => l.lane)).toEqual([1, 2]);
    expect(h.laneAssignments[0]).toMatchObject({
      slotId: 's1',
      registrationId: '101',
      teamName: 'Time A',
      registerNumber: '#101',
      athletes: ['A1', 'A2'],
    });
  });

  it('status inválido vira scheduled; vaga sem inscrição e bateria sem vagas não quebram', () => {
    const h = mapHeat({ ...heat, status: 'xyz', slots: [{ id: 's9', laneNumber: 3, teamCode: 77, registration: null }] }, 'G1');
    expect(h.status).toBe('scheduled');
    expect(h.laneAssignments[0]).toMatchObject({ teamName: 'Equipe 77', registerNumber: '#77', athletes: [] });
    expect(mapHeat({ ...heat, slots: undefined }, 'G1').laneAssignments).toEqual([]);
  });
});

describe('pickActiveGame', () => {
  const games = [{ code: 'A' }, { code: 'B' }] as never[];

  it('usa a preferência quando ela está na lista', () => {
    expect(pickActiveGame(games, 'B')?.code).toBe('B');
  });

  it('cai no primeiro quando a preferência não está na lista ou está vazia', () => {
    expect(pickActiveGame(games, 'Z')?.code).toBe('A');
    expect(pickActiveGame(games, '')?.code).toBe('A');
  });

  it('lista vazia devolve null', () => {
    expect(pickActiveGame([], 'A')).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd D:/Projects/fitness/itgames/itgames-platform && npx vitest run src/lib/__tests__/arena-data.test.ts`
Expected: FAIL — `Failed to resolve import "../arena-data"`.

- [ ] **Step 4: Ajustar o tipo `Heat`**

Em `itgames-platform/src/types/index.ts`, dentro de `export interface Heat`, trocar o bloco de `laneAssignments` por:

```ts
  laneAssignments: {
    lane: number;
    registrationId: string;
    teamName: string;
    registerNumber: string;
    athletes: string[];
    // id da vaga (LaneSlot) no servidor; necessário para trocar raias pela API
    slotId?: string;
  }[];
```

- [ ] **Step 5: Implementar `arena-data.ts`**

Criar `itgames-platform/src/lib/arena-data.ts`:

```ts
import { Category, GameEvent, Heat, TeamRegistration, WorkoutRule } from '@/types';
import { parseTimeToSeconds } from './scoring';

// Conversores API → tipos das telas. Funções puras: não acessam rede nem navegador.

const GAME_STATUSES: GameEvent['status'][] = ['draft', 'open_for_registrations', 'live', 'finished', 'blocked'];
const HEAT_STATUSES: Heat['status'][] = ['scheduled', 'calling', 'in_progress', 'completed'];

export function mapGame(g: any): GameEvent {
  const code = String(g.code);
  const date = g.date ? String(g.date).slice(0, 10) : '';
  const eventType: GameEvent['eventType'] = g.eventType === 'hyrox' ? 'hyrox' : 'crossfit';
  return {
    id: code,
    // valor de preenchimento: os campeonatos reais não têm organização local (mesmo valor da tela de inscrição)
    organizationId: 'org_1',
    code,
    name: g.name || code,
    description: g.description || '',
    location: g.location || '',
    startDate: date,
    endDate: date,
    eventType,
    status: GAME_STATUSES.includes(g.status) ? g.status : 'draft',
    foto: g.foto || undefined,
    organizers: g.organizers,
    lanesCount: Number(g.lanesCount) || 8,
    pixKey: g.pixKey || undefined,
    pixBeneficiary: g.pixBeneficiary || undefined,
    scoringRules: {
      isLowestPointsBetter: !!g.isLowestPointsBetter,
      hyroxChipTimingEnabled: eventType === 'hyrox',
    },
  };
}

export function mapCategory(c: any, gameCode: string, eventType: GameEvent['eventType'] = 'crossfit'): Category {
  const ageRule = c.minTeamSumAge
    ? 'sum_team_age'
    : c.minIndividualAge
      ? 'min_individual_age'
      : c.maxIndividualAge
        ? 'max_individual_age'
        : 'none';
  return {
    id: String(c.code),
    gameId: gameCode,
    name: c.name,
    description: c.description || '',
    standards: c.standards || '',
    price: c.amount || 0,
    type: eventType,
    teamFormat: c.teamType || 'individual',
    maxAthletesPerTeam: c.maxAthlete || 1,
    genderComposition: c.genderRule || 'open',
    division: 'open',
    ageRule,
    minIndividualAge: c.minIndividualAge ?? undefined,
    maxIndividualAge: c.maxIndividualAge ?? undefined,
    minSumTeamAge: c.minTeamSumAge ?? undefined,
    spotsTotal: c.maxRegistrations ?? 0,
    spotsFilled: c.registrationsCount ?? 0,
    maxRegistrations: c.maxRegistrations ?? null,
    registrationsCount: c.registrationsCount ?? 0,
  } as unknown as Category;
}

export function mapWorkout(w: any, gameCode: string): WorkoutRule {
  return {
    id: String(w.code),
    gameId: gameCode,
    categoryId: String(w.category),
    title: w.title || `WOD ${w.code}`,
    type: (w.type as WorkoutRule['type']) || 'for_time',
    timeCapSeconds: parseTimeToSeconds(w.timeCap || ''),
    description: w.description || '',
    movementStandards: [],
  };
}

export function mapRegistration(r: any, gameCode: string, categoryName?: string): TeamRegistration {
  return {
    id: String(r.code),
    gameId: gameCode,
    categoryId: String(r.categoryId),
    categoryName: categoryName || '',
    teamName: r.team,
    registerNumber: r.number || `#${r.code}`,
    amountPaid: r.status === 'paid' ? r.amount || 0 : 0,
    paymentStatus: r.status === 'paid' ? 'paid' : 'pending',
    registeredAt: '',
    checkedIn: !!r.check,
    athletes: (r.athletes || []).map((a: any) => ({
      id: `ath_${r.code}_${a.code}`,
      name: a.name,
      gender: a.gender === 'F' ? 'F' : 'M',
      checkIn: false,
    })),
  } as unknown as TeamRegistration;
}

export function mapHeat(h: any, gameCode: string): Heat {
  const slots = [...(h.slots || [])].sort((a: any, b: any) => a.laneNumber - b.laneNumber);
  return {
    id: String(h.id),
    gameId: gameCode,
    workoutId: String(h.workoutCode),
    categoryId: String(h.categoryId),
    heatNumber: Number(h.heatNumber),
    startTime: h.startTime || '',
    status: HEAT_STATUSES.includes(h.status) ? h.status : 'scheduled',
    laneAssignments: slots.map((s: any) => ({
      slotId: s.id,
      lane: s.laneNumber,
      registrationId: String(s.teamCode),
      teamName: s.registration?.team ?? `Equipe ${s.teamCode}`,
      registerNumber: s.registration?.number ?? `#${s.teamCode}`,
      athletes: (s.registration?.athletes || []).map((a: any) => a.name),
    })),
  };
}

// Campeonato ativo: a preferência salva, se ainda estiver na lista; senão o primeiro; sem lista, nenhum.
export function pickActiveGame(games: GameEvent[], preferredCode: string): GameEvent | null {
  return games.find((g) => g.code === preferredCode) ?? games[0] ?? null;
}
```

- [ ] **Step 6: Rodar e ver passar; conferir tipos**

Run: `cd D:/Projects/fitness/itgames/itgames-platform && npx vitest run && npx tsc --noEmit`
Expected: vitest com todos os testes de `arena-data` passando; `tsc` sem erros. Se `tsc` reclamar do tipo `Category` ou `TeamRegistration` nos objetos literais, os `as unknown as` já cobrem; se `foto` não existir em `GameEvent`, o campo existe (`foto?: string`).

- [ ] **Step 7: Commit (somente se o usuário pedir)**

```bash
git add itgames-platform/package.json itgames-platform/package-lock.json itgames-platform/vitest.config.ts itgames-platform/src/types/index.ts itgames-platform/src/lib/arena-data.ts itgames-platform/src/lib/__tests__/arena-data.test.ts
git commit -m "feat(platform): vitest and API data converters for games, heats and registrations"
```

---

### Task 2: Limpeza dos fictícios e `storage` sem sementes

**Files:**
- Create: `itgames-platform/src/lib/mock-purge.ts`
- Test: `itgames-platform/src/lib/__tests__/mock-purge.test.ts`
- Test: `itgames-platform/src/lib/__tests__/storage-defaults.test.ts`
- Modify: `itgames-platform/src/lib/storage.ts`

**Interfaces:**
- Produces:
  - `MOCK_GAME_IDS: string[]` (`['game_cf_2026', 'game_hy_2026']`).
  - `purgeMockData(store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): boolean` — devolve `true` quando limpou agora, `false` se já tinha rodado. Idempotente (marca `itgames_mock_purged_v1`).
- `storage.initDefaultsIfEmpty()` chama `purgeMockData(localStorage)` no início e não semeia mais campeonato, categorias, WODs, equipes, notas, baterias, auditoria nem campeonato ativo.

- [ ] **Step 1: Escrever os testes que falham**

Criar `itgames-platform/src/lib/__tests__/mock-purge.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MOCK_GAME_IDS, purgeMockData } from '../mock-purge';

function fakeStore(initial: Record<string, unknown> = {}) {
  const map = new Map<string, string>(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    read: (k: string) => (map.has(k) ? JSON.parse(map.get(k) as string) : undefined),
  };
}

const MOCK = 'game_cf_2026';
const REAL = 'SUMMER2026';

describe('purgeMockData', () => {
  it('remove os campeonatos fictícios e tudo que aponta para eles, e mantém os reais', () => {
    const store = fakeStore({
      itgames_data_games: [{ id: MOCK }, { id: 'game_hy_2026' }, { id: REAL }],
      itgames_data_categories: [{ id: 'c1', gameId: MOCK }, { id: '1', gameId: REAL }],
      itgames_data_workouts: [{ id: 'w1', gameId: MOCK }, { id: '2', gameId: REAL }],
      itgames_data_teams: [{ id: 't1', gameId: MOCK }, { id: '1101', gameId: REAL }],
      itgames_data_scores: [{ id: 's1', gameId: MOCK }],
      itgames_data_heats: [{ id: 'h1', gameId: MOCK }, { id: 'h2', gameId: REAL }],
      itgames_data_audit_logs: [{ id: 'a1', gameId: MOCK }, { id: 'a2', gameId: REAL }],
    });

    expect(purgeMockData(store)).toBe(true);

    expect(store.read('itgames_data_games')).toEqual([{ id: REAL }]);
    expect(store.read('itgames_data_categories')).toEqual([{ id: '1', gameId: REAL }]);
    expect(store.read('itgames_data_workouts')).toEqual([{ id: '2', gameId: REAL }]);
    expect(store.read('itgames_data_teams')).toEqual([{ id: '1101', gameId: REAL }]);
    expect(store.read('itgames_data_scores')).toEqual([]);
    expect(store.read('itgames_data_heats')).toEqual([{ id: 'h2', gameId: REAL }]);
    expect(store.read('itgames_data_audit_logs')).toEqual([{ id: 'a2', gameId: REAL }]);
  });

  it('limpa a preferência de campeonato ativo que aponta para um fictício, mas mantém a de um real', () => {
    const fake = fakeStore({ itgames_active_game_id: MOCK });
    purgeMockData(fake);
    expect(fake.getItem('itgames_active_game_id')).toBeNull();

    const real = fakeStore({ itgames_active_game_id: REAL });
    purgeMockData(real);
    expect(real.read('itgames_active_game_id')).toBe(REAL);
  });

  it('só roda uma vez: a segunda chamada não altera nada, mesmo que apareçam fictícios depois', () => {
    const store = fakeStore({ itgames_data_games: [{ id: MOCK }] });
    expect(purgeMockData(store)).toBe(true);
    store.setItem('itgames_data_games', JSON.stringify([{ id: MOCK }]));
    expect(purgeMockData(store)).toBe(false);
    expect(store.read('itgames_data_games')).toEqual([{ id: MOCK }]);
  });

  it('não quebra com armazenamento vazio ou JSON inválido', () => {
    const store = fakeStore();
    store.setItem('itgames_data_games', '{quebrado');
    expect(() => purgeMockData(store)).not.toThrow();
    expect(MOCK_GAME_IDS).toEqual(['game_cf_2026', 'game_hy_2026']);
  });
});
```

Criar `itgames-platform/src/lib/__tests__/storage-defaults.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';

// localStorage mínimo em memória; "window" aponta para o próprio global para o storage se considerar no navegador
const data = new Map<string, string>();
const fakeLocalStorage = {
  getItem: (k: string) => data.get(k) ?? null,
  setItem: (k: string, v: string) => void data.set(k, v),
  removeItem: (k: string) => void data.delete(k),
  clear: () => data.clear(),
};
Object.assign(globalThis, {
  window: globalThis,
  localStorage: fakeLocalStorage,
  dispatchEvent: () => true,
});

describe('storage sem dados fictícios', () => {
  beforeEach(() => data.clear());

  it('initDefaultsIfEmpty não semeia campeonatos nem dados de arena', async () => {
    const { storage } = await import('../storage');
    storage.initDefaultsIfEmpty();
    expect(storage.getGames()).toEqual([]);
    expect(storage.getCategories()).toEqual([]);
    expect(storage.getWorkouts()).toEqual([]);
    expect(storage.getTeams()).toEqual([]);
    expect(storage.getScores()).toEqual([]);
    expect(storage.getHeats()).toEqual([]);
    expect(JSON.stringify([...data.values()])).not.toContain('game_cf_2026');
    expect(JSON.stringify([...data.values()])).not.toContain('game_hy_2026');
  });

  it('remove os fictícios que já estavam gravados e preserva os reais', async () => {
    data.set('itgames_data_games', JSON.stringify([{ id: 'game_cf_2026' }, { id: 'SUMMER2026' }]));
    const { storage } = await import('../storage');
    storage.initDefaultsIfEmpty();
    expect(storage.getGames().map((g) => g.id)).toEqual(['SUMMER2026']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd D:/Projects/fitness/itgames/itgames-platform && npx vitest run src/lib/__tests__/mock-purge.test.ts src/lib/__tests__/storage-defaults.test.ts`
Expected: FAIL — `../mock-purge` inexistente e o `storage` ainda semeia os fictícios.

- [ ] **Step 3: Implementar `mock-purge.ts`**

Criar `itgames-platform/src/lib/mock-purge.ts`:

```ts
// Limpeza única dos campeonatos fictícios que versões antigas gravaram no navegador.
// Remove só o que pertence aos ids fictícios; dados de campeonatos reais não são tocados.

export const MOCK_GAME_IDS = ['game_cf_2026', 'game_hy_2026'];

const MARKER = 'itgames_mock_purged_v1';
const ACTIVE_GAME_KEY = 'itgames_active_game_id';

// chave do armazenamento → campo que identifica o campeonato em cada registro
const KEYS_BY_GAME_FIELD: Array<[string, string]> = [
  ['itgames_data_games', 'id'],
  ['itgames_data_categories', 'gameId'],
  ['itgames_data_workouts', 'gameId'],
  ['itgames_data_teams', 'gameId'],
  ['itgames_data_scores', 'gameId'],
  ['itgames_data_heats', 'gameId'],
  ['itgames_data_audit_logs', 'gameId'],
];

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function isMockId(value: unknown): boolean {
  return typeof value === 'string' && MOCK_GAME_IDS.includes(value);
}

function readList(store: Store, key: string): any[] | null {
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Devolve true quando limpou agora; false se já tinha rodado neste navegador.
export function purgeMockData(store: Store): boolean {
  if (store.getItem(MARKER)) return false;

  for (const [key, field] of KEYS_BY_GAME_FIELD) {
    const list = readList(store, key);
    if (!list) continue;
    const kept = list.filter((item) => !isMockId(item?.[field]));
    if (kept.length !== list.length) store.setItem(key, JSON.stringify(kept));
  }

  try {
    const raw = store.getItem(ACTIVE_GAME_KEY);
    if (raw && isMockId(JSON.parse(raw))) store.removeItem(ACTIVE_GAME_KEY);
  } catch {
    // preferência ilegível: ignora
  }

  store.setItem(MARKER, '1');
  return true;
}
```

- [ ] **Step 4: Ajustar `storage.ts`**

Criar o script e rodá-lo (cuida de CRLF). Salvar em `/tmp/edit-storage.js` e executar a partir de `itgames-platform`:

```js
const fs = require('fs');
const p = 'src/lib/storage.ts';
let s = fs.readFileSync(p, 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');

function must(cond, msg) { if (!cond) throw new Error('não encontrado: ' + msg); }

// 1. importa só o que ainda é usado e a limpeza
const importBlock = /import \{\n  MOCK_GAMES,[\s\S]*?\} from '\.\/mock-data';/;
must(importBlock.test(s), 'bloco de import dos mocks');
s = s.replace(importBlock, "import { MOCK_ORGANIZATIONS } from './mock-data';\nimport { purgeMockData } from './mock-purge';");

// 2. chama a limpeza no início de initDefaultsIfEmpty
must(s.includes('  public initDefaultsIfEmpty(): void {\n    if (!this.isBrowser()) return;\n'), 'início de initDefaultsIfEmpty');
s = s.replace(
  '  public initDefaultsIfEmpty(): void {\n    if (!this.isBrowser()) return;\n',
  '  public initDefaultsIfEmpty(): void {\n    if (!this.isBrowser()) return;\n\n    // remove os campeonatos fictícios que versões antigas gravaram neste navegador\n    purgeMockData(localStorage);\n',
);

// 3. não semeia mais campeonato, categorias, WODs, equipes, notas e baterias
const seed = /\n    if \(!localStorage\.getItem\(STORAGE_KEYS\.(GAMES|CATEGORIES|WORKOUTS|TEAMS|SCORES|HEATS)\)\) \{\n      this\.setItem\(STORAGE_KEYS\.\1, MOCK_\w+\);\n    \}/g;
must(seed.test(s), 'sementes de campeonato');
s = s.replace(seed, '');

// 4. auditoria inicial fictícia vira lista vazia
const audit = /(    if \(!localStorage\.getItem\(STORAGE_KEYS\.AUDIT_LOGS\)\) \{\n      this\.setItem\(STORAGE_KEYS\.AUDIT_LOGS, )\[[\s\S]*?\] as AuditLogEntry\[\]\);\n    \}/;
must(audit.test(s), 'auditoria inicial');
s = s.replace(audit, '$1[] as AuditLogEntry[]);\n    }');

// 5. não semeia o campeonato ativo fictício
const active = /\n    if \(!localStorage\.getItem\(STORAGE_KEYS\.ACTIVE_GAME_ID\)\) \{\n      this\.setItem\(STORAGE_KEYS\.ACTIVE_GAME_ID, 'game_cf_2026'\);\n    \}/;
must(active.test(s), 'semente do campeonato ativo');
s = s.replace(active, '');

// 6. fallbacks fictícios viram lista vazia
for (const name of ['MOCK_GAMES', 'MOCK_CATEGORIES', 'MOCK_WORKOUTS', 'MOCK_TEAMS', 'MOCK_SCORES', 'MOCK_HEATS']) {
  must(s.includes(', ' + name + ')'), name);
  s = s.split(', ' + name + ')').join(', [])');
}

if (crlf) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(p, s);
console.log('ok');
```

Run: `cd D:/Projects/fitness/itgames/itgames-platform && node /tmp/edit-storage.js && grep -n "MOCK_" src/lib/storage.ts`
Expected: `ok` e a `grep` mostra apenas as linhas de `MOCK_ORGANIZATIONS` (import, semente das organizações e `getOrganizations`).

- [ ] **Step 5: Rodar os testes e os tipos**

Run: `cd D:/Projects/fitness/itgames/itgames-platform && npx vitest run && npx tsc --noEmit`
Expected: todos os testes (`arena-data`, `mock-purge`, `storage-defaults`) passam; `tsc` sem erros. Se `tsc` apontar importações não usadas ou o `ScoreEntry`/`Heat` do `storage` sem uso, o projeto não bloqueia por isso; só erros de tipo importam.

- [ ] **Step 6: Commit (somente se o usuário pedir)**

```bash
git add itgames-platform/src/lib/mock-purge.ts itgames-platform/src/lib/storage.ts itgames-platform/src/lib/__tests__/mock-purge.test.ts itgames-platform/src/lib/__tests__/storage-defaults.test.ts
git commit -m "feat(platform): stop seeding mock championships and purge the ones already stored"
```

---

### Task 3: Métodos estritos de baterias, hook `useGames` e Navbar

**Files:**
- Modify: `itgames-platform/src/lib/api-client.ts`
- Create: `itgames-platform/src/lib/use-games.ts`
- Modify: `itgames-platform/src/components/layout/Navbar.tsx`

**Interfaces:**
- Consumes (Task 1/2): `mapGame`, `pickActiveGame` de `arena-data`; `purgeMockData` de `mock-purge`.
- Produces:
  - `apiClient.generateHeats(body)`, `apiClient.swapLanes(slotIdA, slotIdB)`, `apiClient.updateHeatStatus(heatId, status)` passam a **estritos** (lançam `ApiError`).
  - `apiClient.fetchHeats(gameCode: string, workoutCode: number): Promise<any[]>` (estrito).
  - `useGames(): { games: GameEvent[]; activeGame: GameEvent | null; isLoading: boolean; error: string | null; role: UserRoleType; setActiveGame: (code: string) => void; reload: () => void }`.

> Estas funções dependem de navegador e rede; a verificação desta task é `tsc`, `eslint` e a conferência manual do Step 6.

- [ ] **Step 1: Tornar estritos os métodos de baterias e criar `fetchHeats`**

Em `itgames-platform/src/lib/api-client.ts`, substituir os métodos `generateHeats`, `swapLanes` e `updateHeatStatus` (manter `getHeats` como está) por:

```ts
  // Baterias: estritos (erro da API vira ApiError e a tela mostra o aviso)
  async generateHeats(body: {
    gameCode: string;
    categoryId: number;
    workoutCode: number;
    totalLanes: number;
    startHour: string;
    intervalMinutes: number;
    isFinalSeeding?: boolean;
  }) {
    return this.strict<any>('/heats/generate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async swapLanes(slotIdA: string, slotIdB: string) {
    return this.strict<any>('/heats/swap-lanes', {
      method: 'POST',
      body: JSON.stringify({ slotIdA, slotIdB }),
    });
  }

  // Lê as baterias de um WOD (com as vagas e as equipes); diferente de getHeats, não engole erros
  async fetchHeats(gameCode: string, workoutCode: number): Promise<any[]> {
    return this.strict<any[]>(`/heats/game/${gameCode}/workout/${workoutCode}`);
  }

  async updateHeatStatus(heatId: string, status: string) {
    return this.strict<any>(`/heats/${heatId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }
```

(Remover as versões antigas, que usavam `this.request`. `getHeats`, usado por `campeonatos/[code]/page.tsx`, permanece intocado.)

- [ ] **Step 2: Criar o hook `useGames`**

Criar `itgames-platform/src/lib/use-games.ts`:

```ts
'use client';

import { useEffect, useState } from 'react';
import { GameEvent } from '@/types';
import { apiClient } from './api-client';
import { getCurrentUserSession, UserRoleType } from './acl';
import { mapGame, pickActiveGame } from './arena-data';
import { purgeMockData } from './mock-purge';
import { storage } from './storage';

// Campeonatos reais para o seletor: super admin e organizador veem os seus (qualquer status);
// os demais perfis veem os liberados. Nenhum dado local ou fictício entra aqui.
export function useGames() {
  const [games, setGames] = useState<GameEvent[]>([]);
  // preferência salva (só o código); lida de forma lazy para não setar estado dentro de efeito
  const [activeCode, setActiveCode] = useState<string>(() =>
    typeof window === 'undefined' ? '' : storage.getActiveGameId(),
  );
  const [role, setRole] = useState<UserRoleType>('GUEST');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // remove os fictícios antigos antes de qualquer leitura (idempotente)
    purgeMockData(window.localStorage);

    let cancelled = false;
    const currentRole = getCurrentUserSession().role;
    const request: Promise<any[] | null> =
      currentRole === 'SUPER_ADMIN' || currentRole === 'ORGANIZER'
        ? apiClient.listMyGames()
        : apiClient.listGames();

    request
      .then((list) => {
        if (cancelled) return;
        setRole(currentRole);
        if (!list) {
          setError('Não foi possível carregar os campeonatos.');
          setGames([]);
          return;
        }
        setError(null);
        setGames(list.map(mapGame));
      })
      .catch(() => {
        if (cancelled) return;
        setRole(currentRole);
        setError('Não foi possível carregar os campeonatos.');
        setGames([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    const onAuthChanged = () => setReloadKey((k) => k + 1);
    // outra tela trocou o campeonato ativo
    const onStorageUpdated = () => setActiveCode(storage.getActiveGameId());
    window.addEventListener('itgames_auth_changed', onAuthChanged);
    window.addEventListener('itgames_storage_updated', onStorageUpdated);
    return () => {
      window.removeEventListener('itgames_auth_changed', onAuthChanged);
      window.removeEventListener('itgames_storage_updated', onStorageUpdated);
    };
  }, []);

  const activeGame = pickActiveGame(games, activeCode);

  const setActiveGame = (code: string) => {
    setActiveCode(code);
    storage.setActiveGameId(code); // também avisa as outras telas
  };

  return {
    games,
    activeGame,
    isLoading,
    error,
    role,
    setActiveGame,
    reload: () => setReloadKey((k) => k + 1),
  };
}
```

- [ ] **Step 3: Usar o hook no `Navbar`**

Criar `/tmp/edit-navbar.js` e rodar a partir de `itgames-platform`:

```js
const fs = require('fs');
const p = 'src/components/layout/Navbar.tsx';
let s = fs.readFileSync(p, 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
function rep(a, b) { if (!s.includes(a)) throw new Error('não encontrado: ' + a.slice(0, 70)); s = s.replace(a, () => b); }

// imports: sai o storage/GameEvent de seleção; entra o hook
rep("import { storage } from '@/lib/storage';\nimport { GameEvent } from '@/types';\n", "import { useGames } from '@/lib/use-games';\n");

// estado e efeito de campeonatos
rep(`  const [games, setGames] = useState<GameEvent[]>([]);
  const [activeGameId, setActiveGameId] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);`,
`  const { games, activeGame, setActiveGame, isLoading: gamesLoading } = useGames();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);`);

rep(`    storage.initDefaultsIfEmpty();
    const loadState = () => {
      const g = storage.getGames();
      setGames(g);
      setActiveGameId(storage.getActiveGameId());
      setSession(getCurrentUserSession());
      setReady(true);
    };

    loadState();
    window.addEventListener('itgames_storage_updated', loadState);
    window.addEventListener('itgames_auth_changed', loadState);
    return () => {
      window.removeEventListener('itgames_storage_updated', loadState);
      window.removeEventListener('itgames_auth_changed', loadState);
    };`,
`    const loadState = () => {
      setSession(getCurrentUserSession());
      setReady(true);
    };

    loadState();
    window.addEventListener('itgames_auth_changed', loadState);
    return () => {
      window.removeEventListener('itgames_auth_changed', loadState);
    };`);

rep(`  const activeGame = games.find(g => g.id === activeGameId) || games[0];

  const handleSelectGame = (gameId: string) => {
    storage.setActiveGameId(gameId);
    setActiveGameId(gameId);
    setIsDropdownOpen(false);
  };`,
`  const handleSelectGame = (gameId: string) => {
    const game = games.find((g) => g.id === gameId);
    if (game) setActiveGame(game.code);
    setIsDropdownOpen(false);
  };`);

// seletor: destaque do ativo e estado sem campeonatos
rep('${game.id === activeGameId ?', '${game.id === activeGame?.id ?');
rep(`            {/* SELETOR DE EVENTO */}
            {activeGame && (`, `            {/* SELETOR DE EVENTO */}
            {!activeGame && !gamesLoading && (
              <span className="hidden md:inline-flex items-center px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-500">
                Nenhum campeonato disponível
              </span>
            )}
            {activeGame && (`);

if (crlf) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(p, s);
console.log('ok');
```

Run: `cd D:/Projects/fitness/itgames/itgames-platform && node /tmp/edit-navbar.js && npx tsc --noEmit 2>&1 | head -10`
Expected: `ok`. `tsc` pode reclamar de `storage`, `useState` ou `useEffect` não importados/usados: o `useState`/`useEffect` continuam sendo usados pelo `session`/`ready`. Se `activeGameId` ainda aparecer em algum ponto do JSX, trocar por `activeGame?.id`.

- [ ] **Step 4: Tipos e lint dos arquivos novos**

Run: `cd D:/Projects/fitness/itgames/itgames-platform && npx tsc --noEmit && npx eslint src/lib/use-games.ts src/lib/arena-data.ts src/lib/mock-purge.ts src/components/layout/Navbar.tsx 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "error|warning" | grep -v "no-explicit-any"`
Expected: `tsc` limpo; nenhuma regra de hooks (`set-state-in-effect`, `exhaustive-deps`) em `use-games.ts` e no Navbar. Erros de `no-explicit-any` já existem no repo e são ignorados nesta checagem.

- [ ] **Step 5: Rodar todos os testes**

Run: `cd D:/Projects/fitness/itgames/itgames-platform && npx vitest run`
Expected: todos passam (nada novo para testar aqui; garante que nada quebrou).

- [ ] **Step 6: Conferência manual do menu (dev em execução)**

Abrir `http://localhost:3000`. Em um navegador que já visitou o site antes e tinha os fictícios, o menu deve mostrar apenas o campeonato real (ex.: "SUMMER CROSS 2016 INTERBOX") e **nenhum** dos dois fictícios; recarregar a página não os traz de volta. Sem login, deve listar só campeonatos liberados.

- [ ] **Step 7: Commit (somente se o usuário pedir)**

```bash
git add itgames-platform/src/lib/api-client.ts itgames-platform/src/lib/use-games.ts itgames-platform/src/components/layout/Navbar.tsx
git commit -m "feat(platform): real championships in the selector and strict heats API methods"
```

---

### Task 4: Tela de Baterias 100% na API

**Files:**
- Modify: `itgames-platform/src/app/heats/page.tsx`

**Interfaces:**
- Consumes: `useGames()` (Task 3), `mapCategory`/`mapWorkout`/`mapRegistration`/`mapHeat` (Task 1), `apiClient.listCategories/listWorkouts/listRegistrations`, `apiClient.fetchHeats/generateHeats/swapLanes/updateHeatStatus` (Task 3), `ApiError`.
- Produces: tela sem dependência de `storage` nem de `heats-generator`.

> Sem suíte de testes de tela. A cobertura de Review Focus 2–5 desta task é a verificação manual do Step 5 e `tsc`/`eslint`.

- [ ] **Step 1: Substituir a lógica de dados da página**

Criar `/tmp/edit-heats.js` e rodar a partir de `itgames-platform`. O script troca (a) as importações, (b) todo o trecho entre `export default function HeatsPage() {` e o `return (` do JSX pela nova lógica, e (c) pequenos trechos do JSX:

```js
const fs = require('fs');
const p = 'src/app/heats/page.tsx';
let s = fs.readFileSync(p, 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
function rep(a, b, all) {
  if (!s.includes(a)) throw new Error('não encontrado: ' + a.slice(0, 80));
  s = all ? s.split(a).join(b) : s.replace(a, () => b);
}

// (a) importações
rep("import { storage } from '@/lib/storage';\n", '');
rep("import { GameEvent, Category, WorkoutRule, TeamRegistration, Heat } from '@/types';", "import { Category, WorkoutRule, TeamRegistration, Heat } from '@/types';");
rep("import { generateHeatsAndLanes } from '@/lib/heats-generator';\n", '');
rep("import { calculateOverallLeaderboard } from '@/lib/scoring';\n", '');
rep("import { apiClient } from '@/lib/api-client';", "import { apiClient, ApiError } from '@/lib/api-client';\nimport { useGames } from '@/lib/use-games';\nimport { mapCategory, mapHeat, mapRegistration, mapWorkout } from '@/lib/arena-data';");

// (b) toda a lógica entre a assinatura do componente e o return do JSX
const startMarker = 'export default function HeatsPage() {';
const endMarker = '  return (\n    <AclGuard resource="heats"';
const start = s.indexOf(startMarker);
const end = s.indexOf(endMarker);
if (start < 0 || end < 0 || end < start) throw new Error('marcadores da página não encontrados');

const prelude = `export default function HeatsPage() {
  const { activeGame, isLoading: gamesLoading, error: gamesError, role } = useGames();
  // gerar e trocar raias: organizador do campeonato ou super admin (o servidor também valida)
  const canEdit = role === 'SUPER_ADMIN' || role === 'ORGANIZER';

  const gameCode = activeGame?.code ?? '';
  const eventType = activeGame?.eventType;
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  // dados do campeonato ativo; guardam o código a que pertencem para nunca mostrar dados de outro campeonato
  const [data, setData] = useState<{
    game: string;
    categories: Category[];
    workouts: WorkoutRule[];
    teams: TeamRegistration[];
  } | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [heatsData, setHeatsData] = useState<{ key: string; heats: Heat[] } | null>(null);

  const fresh = data && data.game === gameCode ? data : null;
  const categories = fresh?.categories ?? [];
  const allWorkouts = fresh?.workouts ?? [];
  const teams = fresh?.teams ?? [];

  // seleção do usuário; os valores efetivos são derivados abaixo (sempre válidos para os dados carregados)
  const [pickedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [pickedWorkoutId, setSelectedWorkoutId] = useState<string>('');
  const currentCategory = categories.find((c) => c.id === pickedCategoryId) || categories[0];
  const selectedCategoryId = currentCategory?.id ?? '';
  const workouts = allWorkouts.filter((w) => w.categoryId === selectedCategoryId);
  const currentWorkout = workouts.find((w) => w.id === pickedWorkoutId) || workouts[0];
  const selectedWorkoutId = currentWorkout?.id ?? '';

  // Gerador
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [totalLanes, setTotalLanes] = useState(8);
  const [startHour, setStartHour] = useState('09:00');
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [isFinalSeeding, setIsFinalSeeding] = useState(false);

  // Troca de Raias (Swap)
  const [selectedLaneToSwap, setSelectedLaneToSwap] = useState<{
    heatId: string;
    lane: number;
    teamName: string;
    slotId?: string;
  } | null>(null);

  // Categorias, WODs e inscrições do campeonato ativo. O juiz não pode listar inscrições (403): as equipes dele
  // vêm das baterias.
  useEffect(() => {
    if (!gameCode) return;
    let cancelled = false;
    Promise.all([
      apiClient.listCategories(gameCode),
      apiClient.listWorkouts(gameCode),
      canEdit ? apiClient.listRegistrations(gameCode) : Promise.resolve([] as any[]),
    ])
      .then(([cats, wods, regs]) => {
        if (cancelled) return;
        if (!cats || !wods || !regs) {
          setDataError('Não foi possível carregar as categorias, os WODs e as inscrições deste campeonato.');
          return;
        }
        setDataError(null);
        const categoryList = cats.map((c) => mapCategory(c, gameCode, eventType));
        const nameById = new Map(categoryList.map((c) => [c.id, c.name]));
        setData({
          game: gameCode,
          categories: categoryList,
          workouts: wods.map((w) => mapWorkout(w, gameCode)),
          teams: regs
            .filter((r) => r.status !== 'cancelled')
            .map((r) => mapRegistration(r, gameCode, nameById.get(String(r.categoryId)))),
        });
      })
      .catch(() => {
        if (!cancelled) setDataError('Não foi possível carregar os dados deste campeonato.');
      });
    return () => {
      cancelled = true;
    };
  }, [gameCode, eventType, canEdit, reloadKey]);

  // Baterias do WOD selecionado
  const heatsKey = currentWorkout ? \`\${gameCode}:\${currentWorkout.id}:\${reloadKey}\` : '';
  useEffect(() => {
    if (!gameCode || !selectedWorkoutId) return;
    let cancelled = false;
    const key = \`\${gameCode}:\${selectedWorkoutId}:\${reloadKey}\`;
    apiClient
      .fetchHeats(gameCode, Number(selectedWorkoutId))
      .then((list) => {
        if (!cancelled) setHeatsData({ key, heats: list.map((h) => mapHeat(h, gameCode)) });
      })
      .catch((err) => {
        if (cancelled) return;
        setHeatsData({ key, heats: [] });
        toast.error(err instanceof ApiError ? err.message : 'Não foi possível carregar as baterias.');
      });
    return () => {
      cancelled = true;
    };
  }, [gameCode, selectedWorkoutId, reloadKey]);

  const heats = heatsData && heatsData.key === heatsKey ? heatsData.heats : [];
  const isLoadingHeats = !!currentWorkout && !(heatsData && heatsData.key === heatsKey);

  // Baterias filtradas
  const filteredHeats = heats.filter((h) => h.categoryId === selectedCategoryId);

  // Equipes da categoria: organizador vê as inscritas; juiz conta as que já estão em baterias
  const categoryTeams: unknown[] = canEdit
    ? teams.filter((t) => t.categoryId === selectedCategoryId)
    : filteredHeats.flatMap((h) => h.laneAssignments);

  const openGenerator = () => {
    if (!canEdit) {
      toast.error('Apenas o organizador do campeonato pode gerar baterias.');
      return;
    }
    setIsModalOpen(true);
  };

  const handleGenerateHeats = async () => {
    if (!activeGame || !currentWorkout || !currentCategory) return;
    try {
      const res = await apiClient.generateHeats({
        gameCode: activeGame.code,
        categoryId: Number(currentCategory.id),
        workoutCode: Number(currentWorkout.id),
        totalLanes,
        startHour,
        intervalMinutes,
        isFinalSeeding,
      });
      if (!res?.success) {
        // ex.: nenhuma equipe inscrita nesta categoria
        toast.error(res?.message || 'Não foi possível gerar as baterias.');
        return;
      }
      setIsModalOpen(false);
      reload();
      toast.success(\`\${res.totalHeats} baterias geradas com sucesso para \${categoryTeams.length} atletas!\`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível gerar as baterias.');
    }
  };

  const handleUpdateStatus = async (heatId: string, status: Heat['status']) => {
    try {
      await apiClient.updateHeatStatus(heatId, status);
      reload();
      toast.success(\`Status da bateria atualizado para \${status}!\`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível atualizar o status da bateria.');
    }
  };

  const handleLaneClickForSwap = async (heatId: string, laneNumber: number, teamName: string, slotId?: string) => {
    if (!canEdit) {
      toast.error('Apenas o organizador do campeonato pode trocar raias.');
      return;
    }
    if (!selectedLaneToSwap) {
      setSelectedLaneToSwap({ heatId, lane: laneNumber, teamName, slotId });
      toast.info(\`Raia \${laneNumber} (\${teamName}) selecionada. Clique em outra raia da mesma bateria para trocar.\`);
      return;
    }
    if (selectedLaneToSwap.heatId !== heatId) {
      toast.error('Só é possível trocar raias dentro da mesma bateria!');
      setSelectedLaneToSwap(null);
      return;
    }
    if (selectedLaneToSwap.lane === laneNumber) {
      setSelectedLaneToSwap(null);
      return;
    }
    if (!selectedLaneToSwap.slotId || !slotId) {
      toast.error('Não foi possível identificar as raias. Recarregue a página.');
      setSelectedLaneToSwap(null);
      return;
    }

    const from = selectedLaneToSwap.lane;
    try {
      await apiClient.swapLanes(selectedLaneToSwap.slotId, slotId);
      reload();
      toast.success(\`Raias trocadas: Raia \${from} ⇄ Raia \${laneNumber}!\`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível trocar as raias.');
    } finally {
      setSelectedLaneToSwap(null);
    }
  };

`;
s = s.slice(0, start) + prelude + s.slice(end);

// (c) trechos do JSX
rep('onClick={() => handleLaneClickForSwap(heat.id, lane.lane, lane.teamName)}', 'onClick={() => handleLaneClickForSwap(heat.id, lane.lane, lane.teamName, lane.slotId)}');
rep('onClick={() => setIsModalOpen(true)}', 'onClick={openGenerator}', true);
rep('      {filteredHeats.length === 0 ? (', `      {isLoadingHeats ? (
        <div className="text-center py-16 text-sm text-zinc-400">Carregando baterias...</div>
      ) : filteredHeats.length === 0 ? (`);

// avisos de estado antes dos filtros
rep('      {/* FILTROS DE CATEGORIA E WORKOUT */}', `      {/* ESTADOS: sem campeonato, erro ou dados incompletos */}
      {!gamesLoading && !activeGame && (
        <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 no-print">
          {gamesError || 'Nenhum campeonato disponível.'}
        </div>
      )}
      {dataError && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/40 text-sm text-red-300 no-print flex items-center justify-between gap-3">
          <span>{dataError}</span>
          <button onClick={reload} className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold">
            Tentar de novo
          </button>
        </div>
      )}
      {activeGame && !dataError && fresh && categories.length === 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-200 no-print">
          Este campeonato ainda não tem categorias cadastradas.
        </div>
      )}
      {activeGame && !dataError && fresh && categories.length > 0 && workouts.length === 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-200 no-print">
          Esta categoria ainda não tem WODs cadastrados.
        </div>
      )}

      {/* FILTROS DE CATEGORIA E WORKOUT */}`);

if (crlf) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(p, s);
console.log('ok');
```

Run: `cd D:/Projects/fitness/itgames/itgames-platform && node /tmp/edit-heats.js`
Expected: `ok`.

- [ ] **Step 2: Conferir os tipos**

Run: `cd D:/Projects/fitness/itgames/itgames-platform && npx tsc --noEmit 2>&1 | head -15`
Expected: sem erros. Se aparecer identificador não definido no JSX (por exemplo `activeGame`), ele já existe no hook; se aparecer algo como `lane.slotId` inexistente, confirmar que o tipo `Heat` da Task 1 foi salvo. Se o `tsc` acusar `selectedLaneToSwap?.slotId`, o tipo do estado já inclui `slotId?`.

- [ ] **Step 3: Lint da página**

Run: `cd D:/Projects/fitness/itgames/itgames-platform && npx eslint src/app/heats/page.tsx 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "error|warning" | grep -v "no-explicit-any"`
Expected: nenhum erro de `react-hooks/set-state-in-effect` ou `exhaustive-deps` introduzido pela nova lógica. Se `exhaustive-deps` pedir `selectedWorkoutId` ou `eventType`, eles já estão nos arrays; se reclamar de `reload`, ele só é usado fora de efeitos.

- [ ] **Step 4: Rodar os testes**

Run: `cd D:/Projects/fitness/itgames/itgames-platform && npx vitest run`
Expected: todos passam.

- [ ] **Step 5: Verificação manual guiada (dev em execução, como organizador do campeonato)**

1. Abrir `/heats` com o campeonato real: os filtros mostram as categorias e os WODs da API (nada de CrossFit/HYROX fictícios).
2. Escolher uma categoria sem WODs: aparece "Esta categoria ainda não tem WODs cadastrados." e a tela não quebra.
3. Em categoria com inscritos e WOD: **Gerar baterias** cria as baterias; recarregar a página (F5) mantém as baterias (vieram da API).
4. Gerar numa categoria **sem inscrições**: aparece erro "Nenhuma equipe inscrita nesta categoria", não "sucesso".
5. Clicar em duas raias da mesma bateria: elas trocam e o resultado persiste ao recarregar. Clicar em raias de baterias diferentes mostra o aviso de que é só dentro da mesma bateria.
6. Mudar o status de uma bateria e recarregar: o status persiste.
7. Parar a API (ou simular erro) e recarregar: aparece o aviso com "Tentar de novo", sem dados antigos.
8. Entrar como atleta ou visitante em `/heats`: bloqueado pelo `AclGuard` (já é o comportamento atual).

- [ ] **Step 6: Commit (somente se o usuário pedir)**

```bash
git add itgames-platform/src/app/heats/page.tsx
git commit -m "feat(heats): load categories, workouts, registrations and heats from the API"
```

---

### Task 5: Súmulas e Juiz com o seletor real e aviso

**Files:**
- Modify: `itgames-platform/src/app/sumulas/page.tsx`
- Modify: `itgames-platform/src/app/judge/page.tsx`

**Interfaces:**
- Consumes: `useGames()` (Task 3).
- Produces: as duas telas passam a ter `games`/`activeGame` vindos do hook; o restante (categorias, WODs, equipes, baterias, modelos, notas) continua no `storage` até as partes 2 e 3.

- [ ] **Step 1: Trocar a origem do campeonato nas duas telas**

Criar `/tmp/edit-others.js` e rodar a partir de `itgames-platform`:

```js
const fs = require('fs');
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8');
  const crlf = s.includes('\r\n');
  if (crlf) s = s.replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('não encontrado em ' + p + ': ' + a.slice(0, 80));
    s = s.replace(a, () => b);
  }
  if (crlf) s = s.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, s);
}

const notice = (marker) => `      {(!activeGame || categories.length === 0) && (
        <div className="no-print p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
          {activeGame
            ? 'Os dados deste campeonato (categorias, WODs, equipes e baterias) ainda não estão disponíveis nesta tela.'
            : 'Nenhum campeonato disponível.'}
        </div>
      )}

      ${marker}`;

// ── Súmulas ────────────────────────────────────────────────────────────────
edit('src/app/sumulas/page.tsx', [
  ["import { storage } from '@/lib/storage';", "import { storage } from '@/lib/storage';\nimport { useGames } from '@/lib/use-games';"],
  [
    "  const [games, setGames] = useState<GameEvent[]>([]);\n  const [activeGame, setActiveGame] = useState<GameEvent | null>(null);",
    '  const { games, activeGame } = useGames();',
  ],
  [
    `      const allGames = storage.getGames();
      setGames(allGames);

      const activeId = storage.getActiveGameId();
      const game = storage.getGameById(activeId) || allGames[0];
      setActiveGame(game);`,
    '      const game = activeGame;',
  ],
  [
    "    return () => window.removeEventListener('itgames_storage_updated', loadData);\n  }, []);",
    "    return () => window.removeEventListener('itgames_storage_updated', loadData);\n  }, [activeGame]);",
  ],
  ['{/* CABEÇALHO PRINCIPAL DO ESTÚDIO */}', notice('{/* CABEÇALHO PRINCIPAL DO ESTÚDIO */}').trimStart()],
]);

// ── Juiz ───────────────────────────────────────────────────────────────────
edit('src/app/judge/page.tsx', [
  ["import { storage } from '@/lib/storage';", "import { storage } from '@/lib/storage';\nimport { useGames } from '@/lib/use-games';"],
  [
    '  const [activeGame, setActiveGame] = useState<GameEvent | null>(null);',
    '  const { activeGame } = useGames();',
  ],
  [
    `      const activeId = storage.getActiveGameId();
      const game = storage.getGameById(activeId) || storage.getGames()[0];
      setActiveGame(game);`,
    '      const game = activeGame;',
  ],
  [
    "    return () => window.removeEventListener('itgames_storage_updated', loadData);\n  }, []);",
    "    return () => window.removeEventListener('itgames_storage_updated', loadData);\n  }, [activeGame]);",
  ],
  ['{/* CABEÇALHO DO JUIZ */}', notice('{/* CABEÇALHO DO JUIZ */}').trimStart()],
]);

console.log('ok');
```

Run: `cd D:/Projects/fitness/itgames/itgames-platform && node /tmp/edit-others.js`
Expected: `ok`. O `notice(...)` usa `categories`, que existe nas duas telas (estado `categories`). Na tela do Juiz o estado também se chama `categories` (confirmado em `judge/page.tsx`).

- [ ] **Step 2: Conferir tipos e lint**

Run: `cd D:/Projects/fitness/itgames/itgames-platform && npx tsc --noEmit 2>&1 | head -10; npx eslint src/app/sumulas/page.tsx src/app/judge/page.tsx 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "set-state-in-effect" | head`
Expected: `tsc` sem erros e nenhuma ocorrência de `set-state-in-effect`. Se `setGames`/`setActiveGame` ainda aparecerem em outro ponto de `sumulas`, remover essas chamadas (o hook as substitui). Se `tsc` acusar `GameEvent` sem uso em `judge`, é só aviso de lint.

- [ ] **Step 3: Rodar os testes**

Run: `cd D:/Projects/fitness/itgames/itgames-platform && npx vitest run`
Expected: todos passam.

- [ ] **Step 4: Conferência manual**

Em `/sumulas` e `/judge`: o menu superior lista só o campeonato real; as telas mostram o aviso âmbar "Os dados deste campeonato ... ainda não estão disponíveis nesta tela." (categorias dessas telas ainda vêm do armazenamento local, vazio para campeonatos reais). Sem campeonato, aparece "Nenhum campeonato disponível.".

- [ ] **Step 5: Commit (somente se o usuário pedir)**

```bash
git add itgames-platform/src/app/sumulas/page.tsx itgames-platform/src/app/judge/page.tsx
git commit -m "feat(platform): real championship selector on sumulas and judge screens"
```

---

### Task 6: Verificação final e build de produção

**Files:** nenhum novo.

- [ ] **Step 1: Testes, tipos e build de produção**

```bash
cd D:/Projects/fitness/itgames/itgames-platform && npx vitest run && npx tsc --noEmit
cd D:/Projects/fitness/itgames && docker compose build frontend 2>&1 | grep -E "ERROR|error TS|Compiled|naming to" | tail -5
```
Expected: Vitest e `tsc` limpos; o build do Docker termina com "Compiled successfully" e `naming to docker.io/library/itgames-frontend:latest`. (Esse é o mesmo build que a nuvem fará; o Vitest não entra na imagem de produção porque `npm install --omit=dev` ignora `devDependencies`.)

- [ ] **Step 2: Conferir o que ficou sem dados fictícios**

```bash
cd D:/Projects/fitness/itgames/itgames-platform && grep -rn "MOCK_GAMES\|MOCK_CATEGORIES\|MOCK_WORKOUTS\|MOCK_TEAMS\|MOCK_SCORES\|MOCK_HEATS\|game_cf_2026" src --include=*.ts --include=*.tsx | grep -v "lib/mock-data.ts\|__tests__\|lib/mock-purge.ts"
```
Expected: nenhuma linha (o único uso restante de `mock-data.ts` é `MOCK_ORGANIZATIONS` no `storage`).

- [ ] **Step 3: Verificação ponta a ponta no navegador (dev em execução)**

Com o `localStorage` antigo (um navegador que já tinha os fictícios):
1. Abrir `/`, `/heats`, `/sumulas` e `/judge`: o seletor mostra só campeonatos reais.
2. DevTools → Application → Local Storage: não há `game_cf_2026` nem `game_hy_2026` em nenhuma chave `itgames_data_*`, e existe `itgames_mock_purged_v1`.
3. Fluxo de Baterias do Task 4, Step 5, completo.

- [ ] **Step 4: Preparar o relato**

Registrar no resumo final: o que foi entregue, os dois desvios deliberados da spec, que Súmulas e Juiz mostram aviso de dados indisponíveis até as partes 2 e 3, e que o deploy só acontece se o usuário pedir (push na `main` atualiza a nuvem pelo Portainer).

---

## Self-Review

**Cobertura da spec**
- Seletor só com campeonatos reais, por perfil, com fallback e estado vazio: Tasks 1 (`pickActiveGame`), 3 (`useGames`, Navbar).
- Sem sementes fictícias e limpeza única do que já está gravado: Task 2 (com testes de `purgeMockData` e `storage`).
- Conversores API → tipos e `slotId`: Task 1.
- Baterias 100% API (carga, gerar, trocar raias, status, estados, permissões, juiz sem listar inscrições): Tasks 3 e 4.
- Súmulas/Juiz só trocam a origem do seletor + aviso: Task 5.
- Vitest como devDependency: Task 1. Build de produção continua passando: Task 6.
- Desvios da spec (organizações intocadas; auditoria/campeonato ativo sem semente): listados no topo e executados na Task 2.

**Placeholders:** nenhum. Todos os passos têm código, comando e resultado esperado. Os pontos que dependem do arquivo real (`judge`/`sumulas` com o estado `categories`) vêm com a confirmação feita durante a leitura.

**Consistência de nomes/assinaturas:** `mapGame/mapCategory/mapWorkout/mapRegistration/mapHeat/pickActiveGame` (Task 1) usados em `use-games.ts` (Task 3) e `heats/page.tsx` (Task 4); `purgeMockData` (Task 2) usado em `storage.ts` e em `use-games.ts`; `fetchHeats/generateHeats/swapLanes/updateHeatStatus` (Task 3) usados na Task 4; `Heat.laneAssignments[].slotId` (Task 1) usado em `mapHeat` e no clique de troca de raias (Task 4); `useGames()` devolve `role`, usado em `heats/page.tsx`.

**Review Focus:** 1 → Task 2 (testes de purga e do `storage`); 2 → Task 4 (erro explícito, sem fallback) e Step 5.7; 3 → Task 4 (`canEdit` controla a chamada de inscrições); 4 → Task 4 (`res.success`); 5 → Task 4 (estados vazios com valores derivados); 6 → Task 1 (`pickActiveGame`).

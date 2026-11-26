/**
 * Simulação do dia do campeonato — SOMENTE LEITURA (não grava nada no banco).
 *
 * Lê do banco as categorias, os WODs e as duplas reais do campeonato, gera um resultado
 * para cada dupla em cada WOD (no mesmo formato que o App do Juiz e a Mesa do Head Judge gravam),
 * roda o MESMO motor de classificação do placar e confere, prova a prova, se a ordem bate com o regulamento.
 *
 * Uso (na pasta itgames-api):
 *   npx ts-node scripts/simular-dia-campeonato.ts                # SUMMER2026, semente 2026
 *   npx ts-node scripts/simular-dia-campeonato.ts SUMMER2026 7   # outra semente = outro "dia"
 *   ... --gravar   # GRAVA os resultados simulados como scores aprovados (faça backup de games_scores antes)
 *
 * Regras conferidas (regulamento Summer Games):
 *   WOD 1-A Row ............ menor tempo; CAP ordena por menos metros faltando
 *   WOD 1-B Death By ....... mais rounds → mais reps → menor soma dos tempos
 *   WOD 2 Sync & Burn ...... menor tempo; CAP ordena por menos reps faltando
 *   WOD 3 Maximum Lift ..... maior carga (soma da dupla); carga igual empata
 *   WOD 4-A / 4-B .......... mais reps
 *   Geral .................. soma dos pontos da tabela; empate: melhores colocações (best_ranks) e, depois, última prova
 */
import 'dotenv/config'; // lê DATABASE_URL do itgames-api/.env
import { PrismaClient } from '@prisma/client';
import { computeBoard } from '../src/modules/scoring/engine';
import { BoardService, toEngineInput } from '../src/modules/scoring/board.service';
import { pointsForPosition, resolveRule } from '../src/modules/scoring/rules';
import { formatTime } from '../src/modules/scoring/workout-order';
import { EngineInput, EngineScore } from '../src/modules/scoring/types';

// ───────────────────────── gerador determinístico (mesma semente = mesmo dia)
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Kind = 'row' | 'death_by' | 'for_time' | 'max_load' | 'amrap_reps';

/** Resultado "real" da dupla, usado para conferir o motor. */
interface Truth {
  kind: Kind;
  finished?: boolean;
  seconds?: number;
  missing?: number;
  rounds?: number;
  reps?: number;
  tieBreak?: number;
  kg?: number;
  wo?: boolean;
}

function kindOf(w: { type?: string | null; title?: string | null }): Kind {
  const t = (w.title || '').toUpperCase();
  if (w.type === 'max_load') return 'max_load';
  if (t.includes('ROW')) return 'row';
  if (t.includes('DEATH BY')) return 'death_by';
  if (w.type === 'amrap' || w.type === 'emom') return 'amrap_reps';
  return 'for_time';
}

const mmss = (s: number) => formatTime(s);
const capSeconds = (cap?: string | null) => {
  const [m, s] = String(cap || '0:0').split(':').map(Number);
  return (m || 0) * 60 + (s || 0);
};

/** Gera o resultado e o score no formato gravado na arena (alternando App do Juiz e Mesa). */
function simulate(
  kind: Kind,
  timeCap: string | null | undefined,
  rand: () => number,
  idx: number,
): { truth: Truth; score: Partial<EngineScore> } {
  const viaJudgeApp = idx % 2 === 0; // metade pelo App do Juiz, metade pela Mesa
  const cap = capSeconds(timeCap);
  switch (kind) {
    case 'row': {
      if (rand() < 0.7) {
        const seconds = 230 + Math.floor(rand() * 69); // 03:50 a 04:58
        return { truth: { kind, finished: true, seconds }, score: { time: mmss(seconds) } };
      }
      const missing = 10 + Math.floor(rand() * 240);
      return {
        truth: { kind, finished: false, missing },
        score: viaJudgeApp
          ? { time: `CAP +${missing}m`, reps: String(missing) }
          : { time: mmss(cap || 300), reps: String(missing) },
      };
    }
    case 'death_by': {
      const rounds = 1 + Math.floor(rand() * 5);
      const perRound = Array.from({ length: rounds }, () => 120 + Math.floor(rand() * 60));
      const sum = perRound.reduce((a, b) => a + b, 0);
      const reps = rounds < 5 ? Math.floor(rand() * 25) : 0;
      const splits = perRound.map((s, i) => `R${i + 1} ${mmss(s)}`).join(', ');
      if (viaJudgeApp) {
        // App do Juiz: "5 Rounds (12:30)" / "3 Rds + 12 reps", soma no campo de desempate
        return {
          truth: { kind, rounds, reps, tieBreak: sum },
          score: {
            time: rounds === 5 ? `5 Rounds (${mmss(sum)})` : `${rounds} Rds + ${reps} reps`,
            reps: reps > 0 ? String(reps) : undefined,
            tieBreakTime: mmss(sum),
          },
        };
      }
      // Mesa do Head Judge: "4R + 1 reps (08:19 | R1 02:40, ...)", soma só no texto
      return {
        truth: { kind, rounds, reps, tieBreak: sum },
        score: {
          time: rounds === 5 ? `5R (${mmss(sum)} | ${splits})` : `${rounds}R + ${reps} reps (${mmss(sum)} | ${splits})`,
          reps: String(reps),
        },
      };
    }
    case 'for_time': {
      if (rand() < 0.75) {
        const seconds = 420 + Math.floor(rand() * Math.max(60, (cap || 600) - 421));
        return { truth: { kind, finished: true, seconds }, score: { time: mmss(seconds) } };
      }
      const missing = 1 + Math.floor(rand() * 40);
      return { truth: { kind, finished: false, missing }, score: { time: `CAP +${missing}`, reps: String(missing) } };
    }
    case 'max_load': {
      const kg = 60 + Math.round(rand() * 56) * 2.5; // 60 a 200 kg, de 2,5 em 2,5 (gera empates)
      return { truth: { kind, kg }, score: { weight: viaJudgeApp ? `${kg}kg` : String(kg) } };
    }
    case 'amrap_reps': {
      const reps = 20 + Math.floor(rand() * 50);
      return { truth: { kind, reps }, score: { time: `${reps} reps`, reps: String(reps) } };
    }
  }
}

/** Ordem do regulamento (negativo = a na frente), calculada só com os números "reais". */
function regulationCompare(a: Truth, b: Truth): number {
  switch (a.kind) {
    case 'row':
    case 'for_time':
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return a.finished ? a.seconds! - b.seconds! : a.missing! - b.missing!;
    case 'death_by':
      if (a.rounds !== b.rounds) return b.rounds! - a.rounds!;
      if (a.reps !== b.reps) return b.reps! - a.reps!;
      return a.tieBreak! - b.tieBreak!;
    case 'max_load':
      return b.kg! - a.kg!;
    case 'amrap_reps':
      return b.reps! - a.reps!;
  }
}

function denseRanks<T>(items: T[], cmp: (a: T, b: T) => number): Map<T, number> {
  const sorted = [...items].sort(cmp);
  const out = new Map<T, number>();
  let rank = 1;
  sorted.forEach((it, i) => {
    if (i > 0 && cmp(sorted[i - 1], it) !== 0) rank++;
    out.set(it, rank);
  });
  return out;
}

const pad = (s: string | number, n: number) => String(s).padEnd(n).slice(0, n);

async function main() {
  const gameCode = process.argv[2] || 'SUMMER2026';
  const seed = Number(process.argv[3] || 2026);
  const prisma = new PrismaClient();
  const t0 = Date.now();

  // mesma leitura do placar oficial (somente leitura)
  const loadRows = BoardService.prototype.loadRows as unknown as (code: string, db: unknown) => ReturnType<BoardService['loadRows']>;
  const rows = await loadRows.call({ prisma }, gameCode, prisma);
  if (!rows) throw new Error(`Campeonato ${gameCode} não encontrado`);

  const base: EngineInput = toEngineInput({ ...rows, scores: [] });
  const rule = resolveRule(base.game);
  const rand = rng(seed);
  const truths = new Map<string, Truth>(); // `${wod}:${team}`
  const scores: EngineScore[] = [];

  for (const cat of base.categories) {
    const teams = base.teams.filter((t) => t.categoryId === cat.code && t.status === 'active');
    const wods = base.workouts.filter((w) => w.category === cat.code);
    wods.forEach((w) => {
      const kind = kindOf(w);
      teams.forEach((t, idx) => {
        const { truth, score } = simulate(kind, w.timeCap, rand, idx);
        truths.set(`${w.code}:${t.code}`, truth);
        scores.push({ workoutCode: w.code, category: cat.code, teamCode: t.code, ...score });
      });
    });
  }

  const loadMs = Date.now() - t0;
  const t1 = Date.now();
  const board = computeBoard({ ...base, scores });
  const elapsed = Date.now() - t1;

  let checks = 0;
  const failures: string[] = [];
  const ok = (cond: boolean, msg: string) => {
    checks++;
    if (!cond) failures.push(msg);
  };

  console.log(`\n══ Simulação do dia — ${board.game.name} (${gameCode}) • semente ${seed}`);
  console.log(`   Regra: ${rule.mode} • desempate ${rule.tiebreak} • tabela ${rule.pointsTable.slice(0, 5).join(', ')}...\n`);

  for (const cat of board.categories) {
    const catCode = base.categories.find((c) => c.name === cat.name)?.code;
    const wods = base.workouts.filter((w) => w.category === catCode);
    const active = cat.rows.filter((r) => r.status === 'active');
    console.log(`▶ ${cat.name} — ${active.length} duplas, ${wods.length} provas`);

    wods.forEach((w, wi) => {
      const kind = kindOf(w);
      const entries = active.map((r) => ({ row: r, truth: truths.get(`${w.code}:${r.teamCode}`)!, wod: r.wods[wi] }));
      const expected = denseRanks(entries, (a, b) => regulationCompare(a.truth, b.truth));
      console.log(`   ${w.title}  [${kind}${w.timeCap ? ` • cap ${w.timeCap}` : ''}]`);
      [...entries]
        .sort((a, b) => a.wod.rank - b.wod.rank)
        .forEach((e) => {
          const exp = expected.get(e)!;
          const good = exp === e.wod.rank && e.wod.points === pointsForPosition(rule.pointsTable, e.wod.rank);
          ok(good, `${cat.name} • ${w.title} • ${e.row.team}: motor ${e.wod.rank}º, regulamento ${exp}º`);
          console.log(
            `     ${good ? '✔' : '✘'} ${pad(`${e.wod.rank}º`, 4)} ${pad(e.row.team, 28)} ${pad(e.wod.display, 26)} ${e.wod.points} pts`,
          );
        });
    });

    // classificação geral: soma dos pontos e desempate por melhores colocações → última prova
    const total = (r: (typeof active)[number]) => r.wods.reduce((s, x) => s + (x.status === 'scored' ? x.points : 0), 0);
    const bestRanks = (r: (typeof active)[number]) => r.wods.filter((x) => x.status === 'scored').map((x) => x.rank).sort((a, b) => a - b);
    const generalCmp = (a: (typeof active)[number], b: (typeof active)[number]) => {
      if (total(a) !== total(b)) return total(b) - total(a);
      const ra = bestRanks(a), rb = bestRanks(b);
      for (let i = 0; i < Math.max(ra.length, rb.length); i++) {
        if ((ra[i] ?? 9999) !== (rb[i] ?? 9999)) return (ra[i] ?? 9999) - (rb[i] ?? 9999);
      }
      return a.wods[a.wods.length - 1].rank - b.wods[b.wods.length - 1].rank;
    };
    const generalExpected = denseRanks(active, generalCmp);
    console.log('   ── Classificação geral');
    active.forEach((r) => {
      const exp = generalExpected.get(r)!;
      const good = exp === r.rank && Math.abs(r.totalPoints - total(r)) < 0.001;
      ok(good, `${cat.name} • geral • ${r.team}: motor ${r.rank}º (${r.totalPoints}), regulamento ${exp}º (${total(r)})`);
      console.log(`     ${good ? '✔' : '✘'} ${pad(`${r.rank}º`, 4)} ${pad(r.team, 28)} ${r.totalDisplay}`);
    });
    console.log('');
  }

  if (process.argv.includes('--gravar')) {
    // Grava como se o Head Judge tivesse aprovado cada súmula (atualiza o score existente da dupla na prova)
    const ops = scores.map((sc) => {
      const data = {
        category: sc.category,
        time: sc.time ?? null,
        weight: sc.weight ?? null,
        reps: sc.reps ?? null,
        tieBreakTime: sc.tieBreakTime ?? null,
        isWO: !!sc.isWO,
        penaltySeconds: 0,
        status: true,
        scoreStatus: 'approved_by_head_judge',
        judge: 'Simulação do dia',
        dateScore: new Date().toISOString(),
      };
      return prisma.score.upsert({
        where: { team_event: { codeTeam: sc.teamCode, idEvent: sc.workoutCode, game: gameCode } },
        create: { ...data, codeTeam: sc.teamCode, idEvent: sc.workoutCode, game: gameCode },
        update: data,
      });
    });
    await prisma.$transaction(ops);
    console.log(`
Gravado: ${ops.length} scores simulados (aprovados) em ${gameCode}.`);
  }
  await prisma.$disconnect();

  console.log(`══ ${checks - failures.length}/${checks} conferências conforme o regulamento • leitura do banco ${loadMs} ms • cálculo do placar ${elapsed} ms`);
  if (failures.length) {
    console.log('\nDivergências:');
    failures.forEach((f) => console.log(`  ✘ ${f}`));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

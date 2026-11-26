/**
 * Timeline em ARENA ÚNICA sem o WOD 4, com o WOD 3 em 8 raias e categorias misturadas.
 * - WOD 1 e WOD 2: mantém duplas e raias das baterias atuais; muda só o horário (arena = null).
 * - WOD 3: refaz as baterias em 8 raias. Uma bateria mista vira uma bateria por categoria no
 *   mesmo horário, com raias diferentes (cada dupla continua pontuando na própria categoria).
 * - WOD 4 (4-A/4-B): as baterias saem da timeline. As provas e os scores não são tocados.
 * - 5 min entre baterias da mesma categoria; 10 min quando muda a categoria.
 *
 * Uso (na pasta itgames-api):
 *   npx ts-node --transpile-only scripts/timeline-arena-unica.ts SUMMER2026          # só mostra
 *   npx ts-node --transpile-only scripts/timeline-arena-unica.ts SUMMER2026 --apply  # grava
 * Opções: --inicio=08:00 --troca=5 --categoria=10 --raias3=8
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { categoryArenaOrder, extractWodBlockKey, parseRestMinutes, parseTimeCapMinutes } from '../src/modules/heats/heat-time';
import { hhmm } from '../src/modules/heats/arena-schedule';

const arg = (name: string, def: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : def;
};
const toMin = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

async function main() {
  const gameCode = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'SUMMER2026';
  const apply = process.argv.includes('--apply');
  const HEAT = Number(arg('troca', '5'));
  const CAT = Number(arg('categoria', '10'));
  const LANES3 = Number(arg('raias3', '8'));
  const prisma = new PrismaClient();

  const [categories, workouts, heats] = await Promise.all([
    prisma.category.findMany({ where: { gamesId: gameCode }, select: { code: true, name: true } }),
    prisma.workout.findMany({ where: { game: gameCode }, select: { code: true, category: true, title: true, timeCap: true, description: true } }),
    prisma.heat.findMany({
      where: { gameCode },
      select: {
        id: true,
        categoryId: true,
        workoutCode: true,
        heatNumber: true,
        slots: { select: { laneNumber: true, teamCode: true, registration: { select: { team: true } } }, orderBy: { laneNumber: 'asc' } },
      },
    }),
  ]);
  const catName = new Map(categories.map((c) => [c.code, c.name]));
  const cats = categories
    .filter((c) => heats.some((h) => h.categoryId === c.code))
    .sort((a, b) => categoryArenaOrder(a.name, a.code) - categoryArenaOrder(b.name, b.code));
  const wById = new Map(workouts.map((w) => [w.code, w]));
  const blockOf = (code: number) => extractWodBlockKey(wById.get(code)?.title, code).replace('block_', '');

  type Row = { start: number; end: number; block: string; cat: number; heat: number; lanes: { lane: number; team: number; name: string }[]; heatIds: string[] };
  const rows: Row[] = [];
  let t = toMin(arg('inicio', '08:00'));
  let lastCat: number | null = null;
  const gap = (cat: number) => {
    if (lastCat === null) return 0;
    return lastCat === cat ? HEAT : CAT;
  };

  // WOD 1 e WOD 2: baterias atuais (A/B juntas), duração = caps + rest da descrição da prova B
  for (const block of ['1', '2']) {
    for (const c of cats) {
      const list = heats.filter((h) => h.categoryId === c.code && blockOf(h.workoutCode) === block);
      const nums = [...new Set(list.map((h) => h.heatNumber))].sort((a, b) => a - b);
      const parts = [...new Set(list.map((h) => h.workoutCode))]
        .map((code) => wById.get(code)!)
        .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR', { numeric: true }));
      const dur = parts.reduce((s, w, i) => s + parseTimeCapMinutes(w.timeCap) + (i > 0 ? parseRestMinutes(w.description, 1) : 0), 0);
      for (const n of nums) {
        const same = list.filter((h) => h.heatNumber === n);
        t += gap(c.code);
        rows.push({
          start: t,
          end: t + dur,
          block,
          cat: c.code,
          heat: n,
          lanes: same[0].slots.map((s) => ({ lane: s.laneNumber, team: s.teamCode, name: s.registration.team })),
          heatIds: same.map((h) => h.id),
        });
        t += dur;
        lastCat = c.code;
      }
    }
  }

  // WOD 3: duplas na ordem das baterias atuais; baterias de 8 raias, categoria dividida ao meio quando não cabe inteira
  const w3 = new Map<number, { team: number; name: string }[]>();
  const w3Workout = new Map<number, number>();
  for (const c of cats) {
    const list = heats
      .filter((h) => h.categoryId === c.code && blockOf(h.workoutCode) === '3')
      .sort((a, b) => a.heatNumber - b.heatNumber);
    w3.set(c.code, list.flatMap((h) => h.slots.map((s) => ({ team: s.teamCode, name: s.registration.team }))));
    const wc = workouts.find((w) => w.category === c.code && extractWodBlockKey(w.title, w.code) === 'block_3');
    if (wc) w3Workout.set(c.code, wc.code);
  }
  // Empacotamento: enche baterias de LANES3; se uma categoria não cabe no espaço que sobra, divide o que dá
  // em partes iguais entre esta bateria e a próxima (ex.: 6 duplas -> 3 + 3) para não deixar raias soltas.
  const packs: { cat: number; teams: { team: number; name: string }[] }[][] = [[]];
  const used = () => packs[packs.length - 1].reduce((s, p) => s + p.teams.length, 0);
  for (const c of cats) {
    let rest = [...(w3.get(c.code) || [])];
    while (rest.length) {
      let free = LANES3 - used();
      if (free === 0) {
        packs.push([]);
        free = LANES3;
      }
      let take = Math.min(free, rest.length);
      const halves = take < rest.length && rest.length <= LANES3 && free < LANES3;
      if (halves) take = Math.min(free, Math.ceil(rest.length / 2));
      packs[packs.length - 1].push({ cat: c.code, teams: rest.slice(0, take) });
      rest = rest.slice(take);
      if (halves) packs.push([]); // o resto da categoria abre a próxima bateria
    }
  }
  while (packs.length && packs[packs.length - 1].length === 0) packs.pop();
  const dur3 = parseTimeCapMinutes(wById.get([...w3Workout.values()][0])?.timeCap, 6);
  const heatNo = new Map<number, number>();
  const newW3: { start: number; cat: number; heat: number; lanes: { lane: number; team: number; name: string }[] }[] = [];
  packs.forEach((pack, i) => {
    t += i === 0 || pack.length > 1 || pack[0].cat !== lastCat ? CAT : HEAT;
    let lane = 1;
    for (const p of pack) {
      const n = (heatNo.get(p.cat) || 0) + 1;
      heatNo.set(p.cat, n);
      const lanes = p.teams.map((x) => ({ lane: lane++, team: x.team, name: x.name }));
      newW3.push({ start: t, cat: p.cat, heat: n, lanes });
      rows.push({ start: t, end: t + dur3, block: '3', cat: p.cat, heat: n, lanes, heatIds: [] });
    }
    lastCat = pack[pack.length - 1].cat;
    t += dur3;
  });

  // Relatório
  const removed4 = heats.filter((h) => blockOf(h.workoutCode) === '4');
  const old3 = heats.filter((h) => blockOf(h.workoutCode) === '3');
  console.log(`\nTIMELINE ARENA ÚNICA — ${gameCode}${apply ? '' : '  (simulação, nada gravado)'}`);
  console.log(`${hhmm(rows[0].start)} → ${hhmm(t)} · ${new Set(rows.map((r) => `${r.block}|${r.start}`)).size} baterias na arena`);
  let prevKey = '';
  for (const r of rows) {
    const key = `${r.block}|${r.start}`;
    const time = key === prevKey ? '           ' : `${hhmm(r.start)}-${hhmm(r.end)}`;
    prevKey = key;
    const lanes = `raias ${r.lanes[0].lane}-${r.lanes[r.lanes.length - 1].lane}`;
    console.log(`  ${time}  WOD ${r.block}  ${String(catName.get(r.cat)).padEnd(26)} B${r.heat}  ${lanes.padEnd(10)} ${r.lanes.map((l) => l.name).join(', ')}`);
  }
  // Descanso mínimo por dupla
  const byTeam = new Map<number, { s: number; e: number }[]>();
  for (const r of rows) for (const l of r.lanes) byTeam.set(l.team, [...(byTeam.get(l.team) || []), { s: r.start, e: r.end }]);
  let minRest = Infinity;
  let who = '';
  for (const [team, list] of byTeam) {
    list.sort((a, b) => a.s - b.s);
    for (let i = 1; i < list.length; i++) {
      const rest = list[i].s - list[i - 1].e;
      if (rest < minRest) {
        minRest = rest;
        who = rows.flatMap((r) => r.lanes).find((l) => l.team === team)!.name;
      }
    }
  }
  console.log(`\n  Menor descanso: ${minRest} min (${who}). Duplas: ${byTeam.size}.`);

  // --json=arquivo: exporta a timeline (com nomes das duplas) para gerar o PDF
  const jsonOut = arg('json', '');
  if (jsonOut) {
    const wodTitle = (block: string) =>
      workouts.find((w) => extractWodBlockKey(w.title, w.code) === `block_${block}`)?.title.replace(/-\s*[AB]\s*—.*$/, '').replace(/\s*—.*$/, '') ?? `WOD ${block}`;
    require('fs').writeFileSync(
      jsonOut,
      JSON.stringify(
        {
          gameCode,
          start: hhmm(rows[0].start),
          end: hhmm(t),
          minRest,
          minRestTeam: who,
          teams: byTeam.size,
          rows: rows.map((r) => ({
            start: hhmm(r.start),
            end: hhmm(r.end),
            block: r.block,
            wod: wodTitle(r.block),
            category: catName.get(r.cat),
            heat: r.heat,
            lanes: r.lanes,
          })),
        },
        null,
        2,
      ),
    );
    console.log(`  JSON: ${jsonOut}`);
  }
  console.log(`  WOD 4: ${removed4.length} baterias saem da timeline (provas e scores mantidos).`);
  console.log(`  WOD 3: ${old3.length} baterias atuais viram ${newW3.length} registros em ${packs.length} baterias de ${LANES3} raias.`);

  if (apply) {
    const ops = [
      ...rows
        .filter((r) => r.heatIds.length)
        .flatMap((r) => r.heatIds.map((id) => prisma.heat.update({ where: { id }, data: { startTime: hhmm(r.start), arena: null } }))),
      prisma.heat.deleteMany({ where: { id: { in: [...removed4, ...old3].map((h) => h.id) } } }),
      ...newW3.map((h) =>
        prisma.heat.create({
          data: {
            gameCode,
            categoryId: h.cat,
            workoutCode: w3Workout.get(h.cat)!,
            heatNumber: h.heat,
            startTime: hhmm(h.start),
            arena: null,
            slots: { create: h.lanes.map((l) => ({ laneNumber: l.lane, teamCode: l.team, gameCode })) },
          },
        }),
      ),
    ];
    await prisma.$transaction(ops);
    console.log(`\nGravado: horários do WOD 1/2, WOD 3 refeito em ${LANES3} raias, baterias do WOD 4 removidas.`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Recalcula SÓ horário e arena das baterias já geradas (duplas e raias não mudam),
 * usando o mesmo planejador da API/tela (src/modules/heats/arena-schedule.ts).
 *
 * Uso (na pasta itgames-api):
 *   npx ts-node --transpile-only scripts/recalcular-horarios-2-arenas.ts SUMMER2026            # 2 arenas, só mostra
 *   npx ts-node --transpile-only scripts/recalcular-horarios-2-arenas.ts SUMMER2026 --unico    # arena única, só mostra
 *   ... --apply                                                                                 # grava
 * Opções: --inicio=08:00 --tarde=13:00 --troca=5 --descanso=30
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hhmm, planArenaSchedule } from '../src/modules/heats/arena-schedule';

const arg = (name: string, def: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : def;
};

async function main() {
  const gameCode = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'SUMMER2026';
  const apply = process.argv.includes('--apply');
  const arenas = process.argv.includes('--unico') ? 1 : 2;
  const prisma = new PrismaClient();

  const [categories, workouts, heats] = await Promise.all([
    prisma.category.findMany({ where: { gamesId: gameCode }, select: { code: true, name: true } }),
    prisma.workout.findMany({ where: { game: gameCode }, select: { code: true, category: true, title: true, timeCap: true, description: true } }),
    prisma.heat.findMany({ where: { gameCode }, select: { id: true, categoryId: true, workoutCode: true, heatNumber: true, slots: { select: { teamCode: true } } } }),
  ]);
  const plan = planArenaSchedule(
    categories,
    workouts,
    heats.map((h) => ({ ...h, teams: h.slots.map((s) => s.teamCode) })),
    {
      arenas,
      startHour: arg('inicio', '08:00'),
      afternoonStart: arg('tarde', '13:00'),
      intervalMinutes: Number(arg('troca', '5')),
      minRestMinutes: Number(arg('descanso', '30')),
    },
  );

  const s = plan.summary;
  console.log(`\nCRONOGRAMA ${arenas === 2 ? '2 ARENAS' : 'ARENA ÚNICA'} — ${gameCode}${apply ? '' : '  (simulação, nada gravado)'}`);
  console.log(`${s.start} → ${s.end} (${Math.floor(s.totalMinutes / 60)}h${String(s.totalMinutes % 60).padStart(2, '0')})`);
  Object.keys(s.heatsPerArena).forEach((k) => console.log(`  ${k}: ${s.heatsPerArena[k]} baterias, ${s.busyMinutesPerArena[k]} min de prova`));
  console.log(`  Descanso entre provas: menor ${s.minRestMinutes} min (${s.minRestInfo}), médio ${s.avgRestMinutes} min\n`);
  for (const i of plan.items) {
    const where = i.arena ? `A${i.arena}` : '  ';
    console.log(`  ${where} ${hhmm(i.start)}-${hhmm(i.end)} ${i.blockLabel.padEnd(6)} ${i.categoryName} B${i.heatNumber} (${i.teams.length})`);
  }
  console.log(plan.problems.length ? `\n✘ PROBLEMAS:\n  ${plan.problems.join('\n  ')}` : '\n✔ Sem sobreposição em arena, nenhuma dupla em dois lugares, todas as baterias cobertas.');

  if (apply && !plan.problems.length) {
    const updates = plan.items.flatMap((i) => i.heatIds.map((id) => prisma.heat.update({ where: { id }, data: { startTime: hhmm(i.start), arena: i.arena } })));
    await prisma.$transaction(updates);
    console.log(`\nGravado: ${updates.length} baterias (horário e arena); duplas e raias mantidas.`);
  } else if (apply) {
    process.exitCode = 1;
    console.log('\nNada gravado por causa dos problemas acima.');
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

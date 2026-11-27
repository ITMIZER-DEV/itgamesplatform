/**
 * Exporta a programação de um campeonato (WODs, provas, vínculo de súmulas, layouts e timeline) para um JSON,
 * no mesmo formato do botão "Exportar" do Admin. Somente leitura.
 *
 * Uso (na pasta itgames-api):
 *   npx ts-node scripts/exportar-programacao.ts SUMMER2026 ../docs/vps/programacao-SUMMER2026.json
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { ProgramService } from '../src/modules/backup/program.service';

async function main() {
  const [gameCode = 'SUMMER2026', out = `programacao-${gameCode}.json`] = process.argv.slice(2);
  const prisma = new PrismaClient();
  try {
    const service = new ProgramService(prisma as any, null as any);
    const pkg = await service.exportProgram(gameCode);
    writeFileSync(out, JSON.stringify(pkg, null, 2));
    console.log(
      `${out}: ${pkg.workouts.length} WODs, ${pkg.events.length} provas, ${pkg.sumulaTemplates.length} layouts, ${pkg.heats.length} baterias`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main();

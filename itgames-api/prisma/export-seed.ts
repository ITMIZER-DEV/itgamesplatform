import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function exportSeed() {
  console.log('📦 [ITGAMES EXPORT] Extraindo snapshot completo do banco de dados...');

  try {
    const users = await prisma.user.findMany({ include: { athleteProfile: true } });
    const games = await prisma.game.findMany({ include: { organizers: true } });
    const categories = await prisma.category.findMany();
    const events = await prisma.event.findMany();
    const workouts = await prisma.workout.findMany();
    const registrations = await prisma.registration.findMany({ include: { athletes: true } });
    const heats = await prisma.heat.findMany({ include: { slots: true } });
    const scores = await prisma.score.findMany();
    const auditLogs = await prisma.auditLog.findMany();

    const data = {
      exportedAt: new Date().toISOString(),
      users,
      games,
      categories,
      events,
      workouts,
      registrations,
      heats,
      scores,
      auditLogs,
    };

    const outputPath = path.join(__dirname, 'seed-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');

    console.log(`\n✅ [ITGAMES EXPORT] Snapshot exportado com sucesso para: ${outputPath}`);
    console.log(`📊 Resumo dos dados extraídos:`);
    console.log(`   - Usuários / Atletas com Perfil: ${users.length}`);
    console.log(`   - Campeonatos (Games): ${games.length}`);
    console.log(`   - Categorias: ${categories.length}`);
    console.log(`   - Workouts / Provas: ${workouts.length}`);
    console.log(`   - Inscrições (Equipes/Atletas): ${registrations.length}`);
    console.log(`   - Baterias & Raias: ${heats.length}`);
    console.log(`   - Scores Homologados: ${scores.length}`);
    console.log(`\n💡 Dica: Ao commitar 'prisma/seed-data.json', o comando 'npx prisma db seed' usará estes dados em qualquer servidor!`);
  } catch (error) {
    console.error('❌ [ITGAMES EXPORT] Erro ao exportar dados:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

exportSeed();

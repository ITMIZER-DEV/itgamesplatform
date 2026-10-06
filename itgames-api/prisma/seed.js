const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const jsonPath = path.join(__dirname, 'seed-data.json');

  if (fs.existsSync(jsonPath)) {
    console.log('🌱 [SEED RESTORE] Arquivo seed-data.json encontrado! Restaurando snapshot...');
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(raw);

    // 1. Usuários
    if (Array.isArray(data.users) && data.users.length > 0) {
      console.log(`   Restaurando ${data.users.length} usuários...`);
      for (const u of data.users) {
        const { athleteProfile, organizedGames, ...userData } = u;
        const user = await prisma.user.upsert({
          where: { email: userData.email },
          update: userData,
          create: userData,
        });

        if (athleteProfile) {
          const { id: _, userId: __, ...profData } = athleteProfile;
          await prisma.athleteProfile.upsert({
            where: { userId: user.id },
            update: profData,
            create: { ...profData, userId: user.id },
          });
        }
      }
    }

    // 2. Games
    if (Array.isArray(data.games) && data.games.length > 0) {
      console.log(`   Restaurando ${data.games.length} campeonatos...`);
      for (const g of data.games) {
        const { organizers, registrations, categories, heats, auditLogs, ...gameData } = g;
        await prisma.game.upsert({
          where: { code: gameData.code },
          update: gameData,
          create: gameData,
        });
      }
    }

    // 3. Categorias
    if (Array.isArray(data.categories) && data.categories.length > 0) {
      console.log(`   Restaurando ${data.categories.length} categorias...`);
      for (const c of data.categories) {
        await prisma.category.upsert({
          where: { code_gamesId: { code: c.code, gamesId: c.gamesId } },
          update: c,
          create: c,
        });
      }
    }

    // 4. Workouts
    if (Array.isArray(data.workouts) && data.workouts.length > 0) {
      console.log(`   Restaurando ${data.workouts.length} workouts...`);
      for (const w of data.workouts) {
        await prisma.workout.upsert({
          where: { code_game: { code: w.code, game: w.game } },
          update: w,
          create: w,
        });
      }
    }

    // 5. Inscrições e Atletas
    if (Array.isArray(data.registrations) && data.registrations.length > 0) {
      console.log(`   Restaurando ${data.registrations.length} inscrições...`);
      for (const r of data.registrations) {
        const { athletes, scores, laneSlots, ...regData } = r;
        await prisma.registration.upsert({
          where: { code_gameCode: { code: regData.code, gameCode: regData.gameCode } },
          update: regData,
          create: regData,
        });

        if (Array.isArray(athletes) && athletes.length > 0) {
          for (const a of athletes) {
            await prisma.athlete.upsert({
              where: { code_team: { code: a.code, team: a.team } },
              update: a,
              create: a,
            });
          }
        }
      }
    }

    // 6. Baterias e Raias
    if (Array.isArray(data.heats) && data.heats.length > 0) {
      console.log(`   Restaurando ${data.heats.length} baterias...`);
      for (const h of data.heats) {
        const { slots, ...heatData } = h;
        await prisma.heat.upsert({
          where: { id: heatData.id },
          update: heatData,
          create: heatData,
        });

        if (Array.isArray(slots) && slots.length > 0) {
          for (const s of slots) {
            await prisma.laneSlot.upsert({
              where: { id: s.id },
              update: s,
              create: s,
            });
          }
        }
      }
    }

    // 7. Scores
    if (Array.isArray(data.scores) && data.scores.length > 0) {
      console.log(`   Restaurando ${data.scores.length} scores...`);
      for (const sc of data.scores) {
        const { auditLogs, ...scoreData } = sc;
        await prisma.score.upsert({
          where: { team_event: { codeTeam: scoreData.codeTeam, idEvent: scoreData.idEvent, game: scoreData.game } },
          update: scoreData,
          create: scoreData,
        });
      }
    }

    console.log('✅ [SEED RESTORE] Restauração completa de dados finalizada!');
    return;
  }

  console.log('🌱 Iniciando Seed Padrão do ITGAMES...');

  const passwordHash = await bcrypt.hash('Adm@itmizer', 10);

  // 1. Super Admin Oficial
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: 'leonardo.alves@itmizer.com.br' },
        { cpf: '00000000000' }
      ]
    }
  });

  const adminUser = await prisma.user.create({
    data: {
      email: 'leonardo.alves@itmizer.com.br',
      passwordHash,
      name: 'Leonardo Alves (Super Admin)',
      cpf: '00000000000',
      phoneNumber: '11999999999',
      role: 'SUPER_ADMIN',
    },
  });

  // 2. Organizador
  const organizerUser = await prisma.user.upsert({
    where: { email: 'phg.ajls@gmail.com' },
    update: { role: 'ORGANIZER' },
    create: {
      email: 'phg.ajls@gmail.com',
      passwordHash,
      name: 'Organizador Oficial (PHG)',
      cpf: '11122233344',
      phoneNumber: '11988887777',
      role: 'ORGANIZER',
      tenantOrgId: 'org-phg-fitness',
    },
  });

  // 3. Juiz
  const judgeUser = await prisma.user.upsert({
    where: { email: 'judge@itgames.com.br' },
    update: {},
    create: {
      email: 'judge@itgames.com.br',
      passwordHash,
      name: 'Roberto Head Judge',
      cpf: '22233344455',
      phoneNumber: '11977776666',
      role: 'JUDGE',
    },
  });

  // 4. Game Padrão
  const defaultGame = await prisma.game.upsert({
    where: { code: 'SUMMER2026' },
    update: {},
    create: {
      code: 'SUMMER2026',
      name: 'ITGAMES Summer Championship 2026',
      date: '2026-11-20',
      description: 'Campeonato Oficial de CrossFit & HYROX de Abertura de Temporada',
      location: 'Arena Olímpica - São Paulo / SP',
      status: 'live',
      lanesCount: 8,
      eventType: 'crossfit',
      pixKey: 'financeiro@itgames.com.br',
      pixBeneficiary: 'ITGames Plataforma de Eventos Esportivos LTDA',
    },
  });

  console.log('✅ [SEED] Seed padrão executado com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ [SEED ERROR]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const jsonPath = path.join(__dirname, 'seed-data.json');

  if (fs.existsSync(jsonPath)) {
    console.log('🌱 [SEED RESTORE] Arquivo seed-data.json encontrado! Restaurando snapshot...');
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(raw);

    // 1. Usuários
    if (data.users?.length) {
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

    // 2. Games (Campeonatos)
    if (data.games?.length) {
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
    if (data.categories?.length) {
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
    if (data.workouts?.length) {
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
    if (data.registrations?.length) {
      console.log(`   Restaurando ${data.registrations.length} inscrições...`);
      for (const r of data.registrations) {
        const { athletes, scores, laneSlots, ...regData } = r;
        await prisma.registration.upsert({
          where: { code_gameCode: { code: regData.code, gameCode: regData.gameCode } },
          update: regData,
          create: regData,
        });

        if (athletes?.length) {
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
    if (data.heats?.length) {
      console.log(`   Restaurando ${data.heats.length} baterias...`);
      for (const h of data.heats) {
        const { slots, ...heatData } = h;
        await prisma.heat.upsert({
          where: { id: heatData.id },
          update: heatData,
          create: heatData,
        });

        if (slots?.length) {
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
    if (data.scores?.length) {
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

  // 2. Organizadores Oficiais
  const organizerUser = await prisma.user.upsert({
    where: { email: 'phg.ajls@gmail.com' },
    update: {
      role: 'ORGANIZER',
    },
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

  const secondaryOrganizer = await prisma.user.upsert({
    where: { email: 'organizador@crossfitgames.com.br' },
    update: {},
    create: {
      email: 'organizador@crossfitgames.com.br',
      passwordHash,
      name: 'Carlos Organizador Head',
      cpf: '55566677788',
      phoneNumber: '11988887777',
      role: 'ORGANIZER',
      tenantOrgId: 'org-crossfit-brazil',
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

  // 4. Atleta
  const athleteUser = await prisma.user.upsert({
    where: { email: 'atleta@itgames.com.br' },
    update: {},
    create: {
      email: 'atleta@itgames.com.br',
      passwordHash,
      name: 'Lucas Crossfitter',
      cpf: '33344455566',
      phoneNumber: '11966665555',
      role: 'ATHLETE',
      athleteProfile: {
        create: {
          birthDate: new Date('1994-06-15'),
          gender: 'M',
          boxOrGym: 'CrossFit Imperial Arena',
          tshirtSize: 'M',
          emergencyContact: 'Juliana (Esposa)',
          emergencyPhone: '11955554444',
          termsAccepted: true,
        },
      },
    },
  });

  // 5. Game Principal
  const game = await prisma.game.upsert({
    where: { code: 'ITGAMES2026' },
    update: {},
    create: {
      code: 'ITGAMES2026',
      name: 'ITGAMES CHAMPIONSHIP 2026',
      date: '2026-11-15',
      description: 'O maior torneio híbrido de CrossFit e Fitness Racing do Brasil.',
      location: 'Arena Olímpica - São Paulo / SP',
      Events: 4,
      status: 'live',
      lanesCount: 8,
      eventType: 'crossfit',
    },
  });

  // Vínculo do organizador ao campeonato (N:N)
  await prisma.gameOrganizer.upsert({
    where: { gameCode_userId: { gameCode: game.code, userId: organizerUser.id } },
    update: {},
    create: { gameCode: game.code, userId: organizerUser.id },
  });

  // 6. Categorias com Regras Avançadas de Time e Idade
  const categoriesData = [
    {
      code: 1,
      name: 'Time Master Trio (Soma 110+)',
      description: 'Equipe de 3 atletas masculinos cuja soma das idades deve ser no mínimo 110 anos (cada um com 35+).',
      amount: 450.0,
      maxAthlete: 3,
      teamType: 'trio',
      genderRule: 'male',
      minTeamSumAge: 110,
      minIndividualAge: 35,
    },
    {
      code: 2,
      name: 'Quarteto Misto RX (2M + 2F)',
      description: 'Equipe de 4 atletas sendo obrigatoriamente 2 homens e 2 mulheres.',
      amount: 600.0,
      maxAthlete: 4,
      teamType: 'team_4',
      genderRule: 'mixed_2m_2f',
    },
    {
      code: 3,
      name: 'Teen Individual (Até 18 anos)',
      description: 'Categoria individual de base para atletas com até 18 anos.',
      amount: 150.0,
      maxAthlete: 1,
      teamType: 'individual',
      genderRule: 'open',
      maxIndividualAge: 18,
    },
    {
      code: 4,
      name: 'Master 35+ Individual Masculino',
      description: 'Atletas individuais com 35 anos ou mais.',
      amount: 200.0,
      maxAthlete: 1,
      teamType: 'individual',
      genderRule: 'male',
      minIndividualAge: 35,
    },
    {
      code: 5,
      name: 'Dupla Mista Scaled (1M + 1F)',
      description: 'Dupla formada por 1 homem e 1 mulher.',
      amount: 300.0,
      maxAthlete: 2,
      teamType: 'duo',
      genderRule: 'mixed_1m_1f',
    },
    {
      code: 6,
      name: 'HYROX Doubles Mixed',
      description: 'Competição estilo Fitness Racing em duplas mistas.',
      amount: 320.0,
      maxAthlete: 2,
      teamType: 'duo',
      genderRule: 'mixed_1m_1f',
    },
  ];

  for (const cat of categoriesData) {
    await prisma.category.upsert({
      where: {
        code_gamesId: {
          code: cat.code,
          gamesId: game.code,
        },
      },
      update: cat,
      create: {
        ...cat,
        gamesId: game.code,
      },
    });
  }

  // 7. Workouts
  const workoutsData = [
    {
      code: 1,
      title: 'WOD 1 - THE SNATCH LADDER & BURPEES',
      type: 'for_time',
      timeCap: '12:00',
      description: '21-15-9 Snatch (60/40kg) + Burpee Over The Bar',
      category: 1,
    },
    {
      code: 2,
      title: 'WOD 2 - THRUSTER OLY BLASTER',
      type: 'max_load',
      timeCap: '06:00',
      description: '1 Rep Max Thruster a partir do chão',
      category: 1,
    },
  ];

  for (const w of workoutsData) {
    await prisma.workout.upsert({
      where: {
        code_game: {
          code: w.code,
          game: game.code,
        },
      },
      update: w,
      create: {
        ...w,
        game: game.code,
      },
    });
  }

  console.log('✅ Seed finalizado com sucesso no PostgreSQL 18!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

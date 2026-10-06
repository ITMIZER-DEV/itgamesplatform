import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

export interface TestCtx {
  app: INestApplication;
  prisma: PrismaService;
}

export const DEFAULT_PASSWORD = 'Senha@12345';

export async function createTestApp(): Promise<TestCtx> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

export async function resetDb(prisma: PrismaService): Promise<void> {
  if (!(process.env.DATABASE_URL || '').includes('itgames_test')) {
    throw new Error('resetDb só pode rodar no banco itgames_test');
  }
  // CASCADE alcança todas as tabelas que dependem de users ou games
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users", "games" RESTART IDENTITY CASCADE');
}

export async function createUser(
  prisma: PrismaService,
  o: { email: string; role: string; password?: string; name?: string; mustChangePassword?: boolean },
) {
  return prisma.user.create({
    data: {
      email: o.email,
      name: o.name ?? o.email,
      role: o.role,
      passwordHash: await bcrypt.hash(o.password ?? DEFAULT_PASSWORD, 4),
      mustChangePassword: o.mustChangePassword ?? false,
    },
  });
}

export async function login(app: INestApplication, email: string, password = DEFAULT_PASSWORD): Promise<string> {
  const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
  return res.body.accessToken;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function createGameFixture(
  prisma: PrismaService,
  code: string,
  o: { status?: string; organizerIds?: string[] } = {},
) {
  return prisma.game.create({
    data: {
      code,
      name: `Campeonato ${code}`,
      status: o.status ?? 'draft',
      organizers: { create: (o.organizerIds ?? []).map((userId) => ({ userId })) },
    },
  });
}

export async function createCategoryFixture(prisma: PrismaService, gameCode: string, code = 1) {
  return prisma.category.create({
    data: { code, gamesId: gameCode, name: 'RX', maxAthlete: 1, teamType: 'individual', genderRule: 'open' },
  });
}

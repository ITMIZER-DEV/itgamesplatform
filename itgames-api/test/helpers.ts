import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { encryptSecret } from '../src/modules/mail/mail.crypto';
import { MailService } from '../src/modules/mail/mail.service';
import { MAIL_TRANSPORT_FACTORY, MailTransportFactory } from '../src/modules/mail/mail.transport';

export interface SentMail {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface FakeMail {
  sent: SentMail[];
  // quando preenchido, os envios falham com esta mensagem
  failWith: string | null;
}

export interface TestCtx {
  app: INestApplication;
  prisma: PrismaService;
  mail: FakeMail;
  // espera os envios em segundo plano terminarem
  idle: () => Promise<void>;
}

export const DEFAULT_PASSWORD = 'Senha@12345';

export async function createTestApp(): Promise<TestCtx> {
  const mail: FakeMail = { sent: [], failWith: null };
  const factory: MailTransportFactory = () => ({
    sendMail: async (options) => {
      if (mail.failWith) throw new Error(mail.failWith);
      mail.sent.push(options);
      return {};
    },
  });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MAIL_TRANSPORT_FACTORY)
    .useValue(factory)
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService), mail, idle: () => app.get(MailService).idle() };
}

// Deixa o envio de e-mail pronto para uso nos testes (SMTP falso, senha criptografada)
export async function configureMail(
  ctx: TestCtx,
  over: Partial<{
    enabled: boolean;
    host: string;
    port: number;
    secure: string;
    username: string;
    password: string | null;
    fromName: string;
    fromAddress: string;
    appBaseUrl: string;
  }> = {},
): Promise<void> {
  const { password = 'senha-de-app', ...rest } = over;
  const data = {
    enabled: true,
    host: 'smtp.test',
    port: 587,
    secure: 'starttls',
    username: 'envio@itgames.test',
    fromName: 'ITGames',
    fromAddress: 'envio@itgames.test',
    appBaseUrl: 'http://localhost:3000',
    passwordEnc: password === null ? null : encryptSecret(password),
    ...rest,
  };
  await ctx.prisma.mailSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
}

export async function resetDb(prisma: PrismaService): Promise<void> {
  if (!(process.env.DATABASE_URL || '').includes('itgames_test')) {
    throw new Error('resetDb só pode rodar no banco itgames_test');
  }
  // CASCADE alcança todas as tabelas que dependem de users ou games
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users", "games", "mail_settings", "mail_templates", "email_logs" RESTART IDENTITY CASCADE');
}

export async function createUser(
  prisma: PrismaService,
  o: {
    email: string;
    role: string;
    password?: string;
    name?: string;
    mustChangePassword?: boolean;
    cpf?: string;
    phoneNumber?: string;
    birthDate?: string;
    gender?: string;
    tshirtSize?: string;
  },
) {
  const isAthlete = o.role === 'ATHLETE';
  return prisma.user.create({
    data: {
      email: o.email,
      name: o.name ?? o.email,
      role: o.role,
      cpf: o.cpf ?? null,
      phoneNumber: o.phoneNumber ?? null,
      passwordHash: await bcrypt.hash(o.password ?? DEFAULT_PASSWORD, 4),
      mustChangePassword: o.mustChangePassword ?? false,
      ...(isAthlete && {
        athleteProfile: {
          create: {
            birthDate: new Date(o.birthDate ?? '1990-01-01'),
            gender: o.gender ?? 'M',
            tshirtSize: o.tshirtSize ?? 'M',
          },
        },
      }),
    },
  });
}

// CPFs com dígitos verificadores válidos, para os testes
export const CPF_A = '52998224725';
export const CPF_B = '11144477735';
export const CPF_C = '39053344705';

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

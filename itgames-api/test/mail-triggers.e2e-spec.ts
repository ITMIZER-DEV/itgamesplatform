import * as request from 'supertest';
import {
  bearer,
  configureMail,
  CPF_A,
  CPF_B,
  createCategoryFixture,
  createGameFixture,
  createTestApp,
  createUser,
  login,
  resetDb,
  TestCtx,
} from './helpers';

describe('Gatilhos de e-mail (e2e)', () => {
  let ctx: TestCtx;
  let orgA: { id: string };
  let orgB: { id: string };
  let tAdmin: string;
  let tOrgA: string;
  let tCaptain: string;
  const http = () => request(ctx.app.getHttpServer());

  const recipients = () => ctx.mail.sent.map((m) => m.to).sort();
  const subjects = () => ctx.mail.sent.map((m) => m.subject);

  // dupla masculina: capitão (CPF_A) + parceiro (CPF_B)
  const registerPair = async (extra: object = {}) => {
    const res = await http()
      .post('/events/G1/registrations')
      .set(bearer(tCaptain))
      .send({ categoryId: 2, teamName: 'Dupla Teste', athletes: [{ cpf: CPF_A }, { cpf: CPF_B }], ...extra });
    await ctx.idle();
    return res;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    ctx.mail.sent.length = 0;
    ctx.mail.failWith = null;
    await configureMail(ctx);

    await createUser(ctx.prisma, { email: 'admin@t.com', role: 'SUPER_ADMIN' });
    orgA = await createUser(ctx.prisma, { email: 'orga@t.com', role: 'ORGANIZER', name: 'Org A' });
    orgB = await createUser(ctx.prisma, { email: 'orgb@t.com', role: 'ORGANIZER', name: 'Org B' });
    await createUser(ctx.prisma, { email: 'cap@t.com', role: 'ATHLETE', cpf: CPF_A, name: 'Capitão Teste' });
    await createUser(ctx.prisma, { email: 'par@t.com', role: 'ATHLETE', cpf: CPF_B, name: 'Parceiro Teste' });
    tAdmin = await login(ctx.app, 'admin@t.com');
    tOrgA = await login(ctx.app, 'orga@t.com');
    tCaptain = await login(ctx.app, 'cap@t.com');

    await createGameFixture(ctx.prisma, 'G1', { status: 'live', organizerIds: [orgA.id, orgB.id] });
    await createCategoryFixture(ctx.prisma, 'G1', 1);
    await createCategoryFixture(ctx.prisma, 'G1', 2);
    await ctx.prisma.category.update({
      where: { code_gamesId: { code: 2, gamesId: 'G1' } },
      data: { maxAthlete: 2, teamType: 'pair', amount: 150 },
    });
    // organizador B suspenso neste campeonato
    await ctx.prisma.gameOrganizer.update({
      where: { gameCode_userId: { gameCode: 'G1', userId: orgB.id } },
      data: { active: false },
    });
  });

  describe('inscrição', () => {
    it('confirma ao capitão e ao parceiro e avisa só o organizador ativo', async () => {
      const res = await registerPair();
      expect(res.status).toBe(201);
      expect(recipients()).toEqual(['cap@t.com', 'orga@t.com', 'par@t.com']);

      const toCaptain = ctx.mail.sent.find((m) => m.to === 'cap@t.com')!;
      expect(toCaptain.subject).toBe('Inscrição recebida — Campeonato G1');
      expect(toCaptain.text).toContain('Olá, Capitão Teste!');
      expect(toCaptain.text).toContain('Dupla Teste');
      expect(toCaptain.text).toContain(res.body.registration.number);
      expect(toCaptain.text).toMatch(/R\$\s?150,00/);

      const toOrg = ctx.mail.sent.find((m) => m.to === 'orga@t.com')!;
      expect(toOrg.subject).toBe('Nova inscrição em Campeonato G1');
      expect(toOrg.text).toContain('Capitão Teste, Parceiro Teste');
      expect(recipients()).not.toContain('orgb@t.com'); // suspenso não recebe
    });

    it('SMTP fora do ar: a inscrição continua 201 e o log mostra failed', async () => {
      ctx.mail.failWith = 'ECONNREFUSED';
      const res = await registerPair();
      expect(res.status).toBe(201);
      const logs = await ctx.prisma.emailLog.findMany();
      expect(logs).toHaveLength(3);
      expect(logs.every((l) => l.status === 'failed')).toBe(true);
    });

    it('envio desligado: a inscrição continua 201 e tudo vira skipped', async () => {
      await configureMail(ctx, { enabled: false });
      const res = await registerPair();
      expect(res.status).toBe(201);
      expect(ctx.mail.sent).toHaveLength(0);
      const logs = await ctx.prisma.emailLog.findMany();
      expect(logs.every((l) => l.status === 'skipped')).toBe(true);
    });

    it('inscrição recusada (400) não envia nenhum e-mail', async () => {
      const res = await http()
        .post('/events/G1/registrations')
        .set(bearer(tCaptain))
        .send({ categoryId: 2, teamName: 'X', athletes: [{ cpf: CPF_A }] });
      await ctx.idle();
      expect(res.status).toBe(400);
      expect(ctx.mail.sent).toHaveLength(0);
    });

    it('nome de equipe com HTML sai escapado no e-mail', async () => {
      await registerPair({ teamName: '<img src=x onerror=alert(1)>' });
      const html = ctx.mail.sent.map((m) => m.html).join('\n');
      expect(html).not.toContain('<img');
      expect(html).toContain('&lt;img');
    });
  });

  describe('pagamento e cancelamento', () => {
    const patch = (code: number, body: object, token = tOrgA) =>
      http().patch(`/events/G1/registrations/${code}/status`).set(bearer(token)).send(body);

    it('pagamento confirmado avisa os integrantes uma única vez, só quando o status muda', async () => {
      const code = (await registerPair()).body.registration.code;
      ctx.mail.sent.length = 0;

      await patch(code, { status: 'paid' }).expect(200);
      await ctx.idle();
      expect(recipients()).toEqual(['cap@t.com', 'par@t.com']);
      expect(subjects()[0]).toBe('Pagamento confirmado — Campeonato G1');

      await patch(code, { status: 'paid' }).expect(200);
      await patch(code, { check: true }).expect(200);
      await ctx.idle();
      expect(ctx.mail.sent).toHaveLength(2);
    });

    it('cancelamento avisa integrantes e organizadores ativos, uma única vez', async () => {
      const code = (await registerPair()).body.registration.code;
      ctx.mail.sent.length = 0;

      await patch(code, { status: 'cancelled' }).expect(200);
      await ctx.idle();
      expect(recipients()).toEqual(['cap@t.com', 'orga@t.com', 'par@t.com']);
      expect(subjects().every((s) => s === 'Inscrição cancelada — Campeonato G1')).toBe(true);

      await patch(code, { status: 'cancelled' }).expect(200);
      await ctx.idle();
      expect(ctx.mail.sent).toHaveLength(3);
    });

    it('mudar só o valor ou o check não envia nada', async () => {
      const code = (await registerPair()).body.registration.code;
      ctx.mail.sent.length = 0;
      await patch(code, { amount: 99 }).expect(200);
      await patch(code, { check: true }).expect(200);
      await ctx.idle();
      expect(ctx.mail.sent).toHaveLength(0);
    });
  });

  describe('status do campeonato', () => {
    const setStatus = (status: string) => http().patch('/events/G1/status').set(bearer(tAdmin)).send({ status });

    it('bloquear e liberar avisam só os organizadores ativos', async () => {
      await setStatus('blocked').expect(200);
      await ctx.idle();
      expect(recipients()).toEqual(['orga@t.com']);
      expect(ctx.mail.sent[0].subject).toBe('Campeonato G1 foi bloqueado');

      ctx.mail.sent.length = 0;
      await setStatus('live').expect(200);
      await ctx.idle();
      expect(ctx.mail.sent[0].subject).toBe('Campeonato G1 foi liberado');
    });

    it('draft não envia, e repetir o mesmo status não envia', async () => {
      await setStatus('draft').expect(200);
      await ctx.idle();
      expect(ctx.mail.sent).toHaveLength(0); // draft nunca gera alerta

      await setStatus('live').expect(200); // draft → live muda e envia
      await ctx.idle();
      expect(ctx.mail.sent).toHaveLength(1);

      ctx.mail.sent.length = 0;
      await setStatus('live').expect(200); // repetição
      await ctx.idle();
      expect(ctx.mail.sent).toHaveLength(0);
    });

    it('template desligado de um alerta não envia', async () => {
      await ctx.prisma.mailTemplate.create({
        data: { type: 'alert_game_status', enabled: false, subject: 'x', body: 'y' },
      });
      await setStatus('blocked').expect(200);
      await ctx.idle();
      expect(ctx.mail.sent).toHaveLength(0);
    });
  });
});

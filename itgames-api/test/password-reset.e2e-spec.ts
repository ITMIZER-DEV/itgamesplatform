import { createHash } from 'crypto';
import * as request from 'supertest';
import { AuthService } from '../src/modules/auth/auth.service';
import { configureMail, createTestApp, createUser, DEFAULT_PASSWORD, resetDb, TestCtx } from './helpers';

describe('Recuperação de senha (e2e)', () => {
  let ctx: TestCtx;
  const http = () => request(ctx.app.getHttpServer());
  const MSG = 'Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.';

  const forgot = (email: string) => http().post('/auth/forgot-password').send({ email });
  const tokenFromMail = (): string => {
    const last = ctx.mail.sent[ctx.mail.sent.length - 1];
    const m = last.text.match(/token=([a-f0-9]+)/);
    return m![1];
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    process.env.PASSWORD_RESET_MAX_PER_HOUR = '100';
  });
  afterAll(async () => {
    delete process.env.PASSWORD_RESET_MAX_PER_HOUR;
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    (ctx.app.get(AuthService) as any).resetLimiter.clear();
    ctx.mail.sent.length = 0;
    ctx.mail.failWith = null;
    await configureMail(ctx);
    await createUser(ctx.prisma, { email: 'ana@t.com', role: 'ATHLETE', name: 'Ana Souza' });
  });

  it('e-mail existente e inexistente recebem a mesma resposta 200', async () => {
    const a = await forgot('ana@t.com').expect(200);
    const b = await forgot('nao-existe@t.com').expect(200);
    expect(a.body).toEqual({ message: MSG });
    expect(b.body).toEqual({ message: MSG });
    await ctx.idle();
    expect(ctx.mail.sent).toHaveLength(1);
    expect(ctx.mail.sent[0].to).toBe('ana@t.com');
  });

  it('o e-mail traz link com token, usa appBaseUrl e o assunto padrão; o log não guarda o link', async () => {
    await forgot('ANA@t.com ').expect(200);
    await ctx.idle();
    const mail = ctx.mail.sent[0];
    expect(mail.subject).toBe('Redefinição de senha — ITGames');
    expect(mail.text).toContain('Olá, Ana Souza!');
    expect(mail.text).toMatch(/http:\/\/localhost:3000\/redefinir-senha\?token=[a-f0-9]{64}/);
    const [log] = await ctx.prisma.emailLog.findMany({ where: { type: 'password_reset' } });
    expect(log.payload).toBeNull();
    expect(JSON.stringify(log)).not.toMatch(/[a-f0-9]{64}/);
  });

  it('o banco guarda só o hash do token', async () => {
    await forgot('ana@t.com').expect(200);
    await ctx.idle();
    const raw = tokenFromMail();
    const rows = await ctx.prisma.passwordResetToken.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(createHash('sha256').update(raw).digest('hex'));
    expect(rows[0].tokenHash).not.toBe(raw);
    expect(rows[0].expiresAt.getTime()).toBeGreaterThan(Date.now() + 50 * 60 * 1000);
  });

  it('token válido troca a senha, permite login, zera mustChangePassword e só serve uma vez', async () => {
    await ctx.prisma.user.update({ where: { email: 'ana@t.com' }, data: { mustChangePassword: true } });
    await forgot('ana@t.com').expect(200);
    await ctx.idle();
    const token = tokenFromMail();

    await http().post('/auth/reset-password').send({ token, newPassword: 'NovaSenha@123' }).expect(200);
    await http().post('/auth/login').send({ email: 'ana@t.com', password: 'NovaSenha@123' }).expect(200);
    await http().post('/auth/login').send({ email: 'ana@t.com', password: DEFAULT_PASSWORD }).expect(401);
    const user = await ctx.prisma.user.findUnique({ where: { email: 'ana@t.com' } });
    expect(user.mustChangePassword).toBe(false);

    const again = await http().post('/auth/reset-password').send({ token, newPassword: 'OutraSenha@123' }).expect(400);
    expect(again.body.message).toMatch(/inválido ou expirado/i);
  });

  it('token inválido, vazio, adulterado ou expirado retorna 400 com a mesma mensagem', async () => {
    await forgot('ana@t.com').expect(200);
    await ctx.idle();
    const token = tokenFromMail();

    const msgs: string[] = [];
    for (const t of ['', 'abc', token.slice(0, -1) + (token.endsWith('0') ? '1' : '0')]) {
      const res = await http().post('/auth/reset-password').send({ token: t, newPassword: 'NovaSenha@123' }).expect(400);
      msgs.push(res.body.message);
    }
    await ctx.prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await http().post('/auth/reset-password').send({ token, newPassword: 'NovaSenha@123' }).expect(400);
    msgs.push(expired.body.message);
    expect(msgs.filter((m) => /inválido ou expirado/i.test(m))).toHaveLength(msgs.length);
  });

  it('senha curta retorna 400 e não consome o token', async () => {
    await forgot('ana@t.com').expect(200);
    await ctx.idle();
    const token = tokenFromMail();
    await http().post('/auth/reset-password').send({ token, newPassword: '1234567' }).expect(400);
    await http().post('/auth/reset-password').send({ token, newPassword: 'NovaSenha@123' }).expect(200);
  });

  it('usar um token invalida os outros pendentes do mesmo usuário', async () => {
    await forgot('ana@t.com').expect(200);
    await ctx.idle();
    const first = tokenFromMail();
    await forgot('ana@t.com').expect(200);
    await ctx.idle();
    const second = tokenFromMail();
    expect(second).not.toBe(first);

    await http().post('/auth/reset-password').send({ token: second, newPassword: 'NovaSenha@123' }).expect(200);
    await http().post('/auth/reset-password').send({ token: first, newPassword: 'OutraSenha@123' }).expect(400);
  });

  it('limite: a 4ª solicitação na hora responde 200 mas não envia', async () => {
    process.env.PASSWORD_RESET_MAX_PER_HOUR = '3';
    try {
      for (let i = 0; i < 4; i++) {
        const res = await forgot('ana@t.com').expect(200);
        expect(res.body).toEqual({ message: MSG });
      }
      await ctx.idle();
      expect(ctx.mail.sent).toHaveLength(3);
    } finally {
      process.env.PASSWORD_RESET_MAX_PER_HOUR = '100';
    }
  });

  it('mesma origem (proxy do frontend) pedindo para e-mails diferentes não é bloqueada pelo limite por e-mail', async () => {
    process.env.PASSWORD_RESET_MAX_PER_HOUR = '3';
    try {
      for (const n of ['b', 'c', 'd']) await createUser(ctx.prisma, { email: `${n}@t.com`, role: 'ATHLETE' });
      for (const e of ['ana@t.com', 'b@t.com', 'c@t.com', 'd@t.com']) await forgot(e).expect(200);
      await ctx.idle();
      // todas as requisições chegam do mesmo IP (o proxy); só o limite por e-mail vale de verdade
      expect(ctx.mail.sent.map((m) => m.to).sort()).toEqual(['ana@t.com', 'b@t.com', 'c@t.com', 'd@t.com']);
    } finally {
      process.env.PASSWORD_RESET_MAX_PER_HOUR = '100';
    }
  });

  describe('aviso de senha trocada', () => {
    const changedMails = () => ctx.mail.sent.filter((m) => m.subject === 'Sua senha foi alterada — ITGames');

    it('depois de redefinir pelo link, avisa o dono da conta', async () => {
      await forgot('ana@t.com').expect(200);
      await ctx.idle();
      const token = tokenFromMail();
      ctx.mail.sent.length = 0;

      await http().post('/auth/reset-password').send({ token, newPassword: 'NovaSenha@123' }).expect(200);
      await ctx.idle();
      expect(changedMails()).toHaveLength(1);
      expect(changedMails()[0].to).toBe('ana@t.com');
      expect(changedMails()[0].text).toContain('Olá, Ana Souza!');
      expect(changedMails()[0].text).toMatch(/alterada em \d{2}\/\d{2}\/\d{4}/);
    });

    it('redefinição com token inválido não envia aviso', async () => {
      await http().post('/auth/reset-password').send({ token: 'invalido', newPassword: 'NovaSenha@123' }).expect(400);
      await ctx.idle();
      expect(changedMails()).toHaveLength(0);
    });

    it('troca de senha logada avisa; senha atual errada não avisa', async () => {
      const t = (await http().post('/auth/login').send({ email: 'ana@t.com', password: DEFAULT_PASSWORD }).expect(200)).body
        .accessToken;
      await http()
        .post('/auth/change-password')
        .set({ Authorization: `Bearer ${t}` })
        .send({ currentPassword: 'errada-errada', newPassword: 'NovaSenha@123' })
        .expect(400);
      await ctx.idle();
      expect(changedMails()).toHaveLength(0);

      await http()
        .post('/auth/change-password')
        .set({ Authorization: `Bearer ${t}` })
        .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'NovaSenha@123' })
        .expect(201);
      await ctx.idle();
      expect(changedMails()).toHaveLength(1);
      expect(changedMails()[0].to).toBe('ana@t.com');
    });
  });

  it('envio desligado: responde 200, não envia e registra skipped', async () => {
    await configureMail(ctx, { enabled: false });
    await forgot('ana@t.com').expect(200);
    await ctx.idle();
    expect(ctx.mail.sent).toHaveLength(0);
    const logs = await ctx.prisma.emailLog.findMany({ where: { type: 'password_reset' } });
    expect(logs.map((l) => l.status)).toEqual(['skipped']);
  });

  it('sem URL base configurada registra skipped e não cria token', async () => {
    await configureMail(ctx, { appBaseUrl: '' });
    await forgot('ana@t.com').expect(200);
    await ctx.idle();
    expect(ctx.mail.sent).toHaveLength(0);
    expect(await ctx.prisma.passwordResetToken.count()).toBe(0);
    const [log] = await ctx.prisma.emailLog.findMany({ where: { type: 'password_reset' } });
    expect(log).toMatchObject({ status: 'skipped' });
    expect(log.error).toMatch(/URL base/i);
  });

  it('falha de SMTP não afeta a resposta', async () => {
    ctx.mail.failWith = 'ECONNREFUSED';
    await forgot('ana@t.com').expect(200);
    await ctx.idle();
    const [log] = await ctx.prisma.emailLog.findMany({ where: { type: 'password_reset' } });
    expect(log.status).toBe('failed');
  });

  it('corpo sem e-mail ou com tipo errado retorna 400', async () => {
    await http().post('/auth/forgot-password').send({}).expect(400);
    await http().post('/auth/forgot-password').send({ email: 123 }).expect(400);
  });
});

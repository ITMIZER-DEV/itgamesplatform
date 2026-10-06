import * as request from 'supertest';
import { bearer, configureMail, createTestApp, createUser, login, resetDb, TestCtx } from './helpers';

describe('Mail admin (e2e)', () => {
  let ctx: TestCtx;
  let tAdmin: string;
  let tOrg: string;
  let tAthlete: string;
  const http = () => request(ctx.app.getHttpServer());

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
    await createUser(ctx.prisma, { email: 'admin@t.com', role: 'SUPER_ADMIN' });
    await createUser(ctx.prisma, { email: 'org@t.com', role: 'ORGANIZER' });
    await createUser(ctx.prisma, { email: 'atl@t.com', role: 'ATHLETE' });
    tAdmin = await login(ctx.app, 'admin@t.com');
    tOrg = await login(ctx.app, 'org@t.com');
    tAthlete = await login(ctx.app, 'atl@t.com');
  });

  const settingsBody = {
    enabled: true,
    host: 'smtp.gmail.com',
    port: 587,
    secure: 'starttls',
    username: 'envio@itgames.com.br',
    password: 'abcd efgh ijkl mnop',
    fromName: 'ITGames',
    fromAddress: 'envio@itgames.com.br',
    appBaseUrl: 'https://arena.itgames.com.br/',
  };

  describe('permissões', () => {
    const routes: Array<[string, string]> = [
      ['get', '/mail/settings'],
      ['put', '/mail/settings'],
      ['post', '/mail/settings/test'],
      ['get', '/mail/templates'],
      ['get', '/mail/logs'],
    ];
    it.each(routes)('%s %s: anônimo 401; atleta e organizador 403', async (method, path) => {
      await (http() as any)[method](path).expect(401);
      await (http() as any)[method](path).set(bearer(tAthlete)).expect(403);
      await (http() as any)[method](path).set(bearer(tOrg)).expect(403);
    });
  });

  describe('configurações', () => {
    it('sem nada salvo devolve os padrões e passwordSet false', async () => {
      const res = await http().get('/mail/settings').set(bearer(tAdmin)).expect(200);
      expect(res.body).toMatchObject({ enabled: false, host: 'smtp.gmail.com', port: 587, passwordSet: false });
    });

    it('PUT salva, criptografa a senha e nunca a devolve; normaliza appBaseUrl', async () => {
      const res = await http().put('/mail/settings').set(bearer(tAdmin)).send(settingsBody).expect(200);
      expect(res.body.passwordSet).toBe(true);
      expect(res.body.password).toBeUndefined();
      expect(res.body.passwordEnc).toBeUndefined();
      expect(res.body.appBaseUrl).toBe('https://arena.itgames.com.br');
      expect(JSON.stringify(res.body)).not.toContain('abcd efgh');

      const row = await ctx.prisma.mailSettings.findUnique({ where: { id: 1 } });
      expect(row.passwordEnc).toBeTruthy();
      expect(row.passwordEnc).not.toContain('abcd');

      const get = await http().get('/mail/settings').set(bearer(tAdmin)).expect(200);
      expect(JSON.stringify(get.body)).not.toContain('abcd efgh');
      expect(get.body.passwordSet).toBe(true);
    });

    it('PUT sem password (ou vazio) mantém a senha salva', async () => {
      await http().put('/mail/settings').set(bearer(tAdmin)).send(settingsBody).expect(200);
      const before = (await ctx.prisma.mailSettings.findUnique({ where: { id: 1 } })).passwordEnc;
      const { password, ...semSenha } = settingsBody;
      await http().put('/mail/settings').set(bearer(tAdmin)).send({ ...semSenha, port: 465, secure: 'ssl' }).expect(200);
      await http().put('/mail/settings').set(bearer(tAdmin)).send({ ...semSenha, password: '' }).expect(200);
      const after = await ctx.prisma.mailSettings.findUnique({ where: { id: 1 } });
      expect(after.passwordEnc).toBe(before);
    });

    it('enabled true com configuração incompleta retorna 400; desligado aceita parcial', async () => {
      const res = await http()
        .put('/mail/settings')
        .set(bearer(tAdmin))
        .send({ enabled: true, host: 'smtp.gmail.com' })
        .expect(400);
      expect(res.body.message).toMatch(/incompleta|obrigat/i);
      await http().put('/mail/settings').set(bearer(tAdmin)).send({ enabled: false, host: 'smtp.gmail.com' }).expect(200);
    });

    it('valida porta, segurança, e-mail do remetente e URL base', async () => {
      const put = (over: object) => http().put('/mail/settings').set(bearer(tAdmin)).send({ ...settingsBody, ...over });
      await put({ port: 0 }).expect(400);
      await put({ port: 70000 }).expect(400);
      await put({ secure: 'tls' }).expect(400);
      await put({ fromAddress: 'sem-arroba' }).expect(400);
      await put({ appBaseUrl: 'ftp://x.com' }).expect(400);
      await put({ appBaseUrl: 'javascript:alert(1)' }).expect(400);
      await put({ appBaseUrl: 'http://localhost:3000' }).expect(200);
    });
  });

  describe('testar envio', () => {
    it('sem configuração completa devolve ok false com o motivo', async () => {
      const res = await http().post('/mail/settings/test').set(bearer(tAdmin)).expect(201);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/incompleta|senha/i);
    });

    it('envia ao e-mail do admin logado mesmo com o envio geral desligado', async () => {
      await configureMail(ctx, { enabled: false });
      const res = await http().post('/mail/settings/test').set(bearer(tAdmin)).expect(201);
      expect(res.body).toEqual({ ok: true });
      expect(ctx.mail.sent).toHaveLength(1);
      expect(ctx.mail.sent[0].to).toBe('admin@t.com');
    });

    it('devolve o erro real do SMTP quando falha', async () => {
      await configureMail(ctx);
      ctx.mail.failWith = 'Invalid login: 535 5.7.8 Username and Password not accepted';
      const res = await http().post('/mail/settings/test').set(bearer(tAdmin)).expect(201);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain('535');
    });
  });

  describe('templates', () => {
    it('lista os 8 tipos com padrão, variáveis e custom false', async () => {
      const res = await http().get('/mail/templates').set(bearer(tAdmin)).expect(200);
      expect(res.body).toHaveLength(8);
      const reset = res.body.find((t: any) => t.type === 'password_reset');
      expect(reset).toMatchObject({ enabled: true, custom: false });
      expect(reset.variables).toEqual(expect.arrayContaining(['nome', 'link', 'validade']));
      expect(reset.subject).toBe(reset.defaultSubject);
    });

    it('PUT edita, DELETE restaura o padrão; tipo desconhecido 404; corpo vazio 400', async () => {
      const put = await http()
        .put('/mail/templates/payment_confirmed')
        .set(bearer(tAdmin))
        .send({ enabled: false, subject: 'Pago!', body: 'Oi {{nome}}' })
        .expect(200);
      expect(put.body).toMatchObject({ custom: true, enabled: false, subject: 'Pago!' });

      await http().put('/mail/templates/nao_existe').set(bearer(tAdmin)).send({ subject: 'a', body: 'b' }).expect(404);
      await http().put('/mail/templates/payment_confirmed').set(bearer(tAdmin)).send({ subject: '', body: 'b' }).expect(400);
      await http().put('/mail/templates/payment_confirmed').set(bearer(tAdmin)).send({ subject: 'a', body: '' }).expect(400);

      const del = await http().delete('/mail/templates/payment_confirmed').set(bearer(tAdmin)).expect(200);
      expect(del.body).toMatchObject({ custom: false, enabled: true });
      expect(del.body.subject).toBe(del.body.defaultSubject);
    });

    it('preview renderiza com dados de exemplo e escapa HTML; aceita rascunho', async () => {
      const res = await http()
        .post('/mail/templates/payment_confirmed/preview')
        .set(bearer(tAdmin))
        .send({ subject: 'Olá {{nome}}', body: '<b>{{equipe}}</b>' })
        .expect(201);
      expect(res.body.subject).toBe('Olá Maria Souza');
      expect(res.body.html).toBe('&lt;b&gt;Dupla Dinâmica&lt;/b&gt;');
      expect(res.body.text).toBe('<b>Dupla Dinâmica</b>');
    });
  });

  describe('logs', () => {
    it('lista do mais recente ao mais antigo, filtra por status e respeita o limite', async () => {
      await ctx.prisma.emailLog.createMany({
        data: [
          { type: 'payment_confirmed', toAddress: 'a@x.com', subject: 's1', status: 'sent', createdAt: new Date('2026-01-01') },
          { type: 'payment_confirmed', toAddress: 'b@x.com', subject: 's2', status: 'failed', error: 'boom', createdAt: new Date('2026-01-02') },
          { type: 'payment_confirmed', toAddress: 'c@x.com', subject: 's3', status: 'sent', createdAt: new Date('2026-01-03') },
        ],
      });
      const all = await http().get('/mail/logs').set(bearer(tAdmin)).expect(200);
      expect(all.body.map((l: any) => l.toAddress)).toEqual(['c@x.com', 'b@x.com', 'a@x.com']);
      const failed = await http().get('/mail/logs?status=failed').set(bearer(tAdmin)).expect(200);
      expect(failed.body).toHaveLength(1);
      const limited = await http().get('/mail/logs?limit=2').set(bearer(tAdmin)).expect(200);
      expect(limited.body).toHaveLength(2);
    });

    it('cada linha informa se pode ser reenviada e a lista não expõe o payload', async () => {
      await ctx.prisma.emailLog.createMany({
        data: [
          { type: 'payment_confirmed', toAddress: 'a@x.com', subject: 's', status: 'failed', payload: { nome: 'Ana' } },
          { type: 'password_reset', toAddress: 'b@x.com', subject: 's', status: 'skipped' },
          { type: 'test', toAddress: 'c@x.com', subject: 's', status: 'failed', error: 'x' },
          { type: 'tipo_antigo', toAddress: 'd@x.com', subject: 's', status: 'failed', payload: { a: 'b' } },
        ],
      });
      const res = await http().get('/mail/logs').set(bearer(tAdmin)).expect(200);
      const byTo = Object.fromEntries(res.body.map((l: any) => [l.toAddress, l]));
      expect(byTo['a@x.com'].resendable).toBe(true);
      expect(byTo['b@x.com'].resendable).toBe(false); // recuperação de senha: o link tem token
      expect(byTo['c@x.com'].resendable).toBe(false); // teste
      expect(byTo['d@x.com'].resendable).toBe(false); // tipo que não existe mais
      expect(res.body.every((l: any) => !('payload' in l))).toBe(true);
    });

    it('reenviar usa o payload gravado e o template atual; sem payload retorna 400; inexistente 404', async () => {
      await configureMail(ctx);
      const log = await ctx.prisma.emailLog.create({
        data: {
          type: 'payment_confirmed',
          toAddress: 'ana@x.com',
          subject: 'x',
          status: 'failed',
          error: 'timeout',
          payload: { nome: 'Ana', campeonato: 'Summer', categoria: 'RX', equipe: 'Time A', numero: '#1101' },
        },
      });
      const res = await http().post(`/mail/logs/${log.id}/resend`).set(bearer(tAdmin)).expect(201);
      expect(res.body.status).toBe('sent');
      expect(ctx.mail.sent[0]).toMatchObject({ to: 'ana@x.com', subject: 'Pagamento confirmado — Summer' });

      const noPayload = await ctx.prisma.emailLog.create({
        data: { type: 'password_reset', toAddress: 'ana@x.com', subject: 'x', status: 'sent' },
      });
      const bad = await http().post(`/mail/logs/${noPayload.id}/resend`).set(bearer(tAdmin)).expect(400);
      expect(bad.body.message).toMatch(/reenviado/i);
      await http().post('/mail/logs/00000000-0000-0000-0000-000000000000/resend').set(bearer(tAdmin)).expect(404);
    });
  });
});

import * as request from 'supertest';
import { bearer, createTestApp, createUser, login, resetDb, TestCtx } from './helpers';

describe('Users / Organizadores (e2e)', () => {
  let ctx: TestCtx;
  let tAdmin: string;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    await createUser(ctx.prisma, { email: 'admin@t.com', role: 'SUPER_ADMIN' });
    await createUser(ctx.prisma, { email: 'org@t.com', role: 'ORGANIZER' });
    tAdmin = await login(ctx.app, 'admin@t.com');
  });

  const body = { name: 'Maria Org', email: 'maria@t.com', phoneNumber: '11999990000' };

  it('sem token retorna 401; organizador retorna 403', async () => {
    await http().post('/users/organizers').send(body).expect(401);
    const tOrg = await login(ctx.app, 'org@t.com');
    await http().post('/users/organizers').set(bearer(tOrg)).send(body).expect(403);
    await http().get('/users/organizers').set(bearer(tOrg)).expect(403);
  });

  it('super admin cria organizador e recebe a senha temporária uma única vez', async () => {
    const res = await http().post('/users/organizers').set(bearer(tAdmin)).send(body).expect(201);
    expect(res.body.user.role).toBe('ORGANIZER');
    expect(res.body.user.mustChangePassword).toBe(true);
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.temporaryPassword).toHaveLength(12);

    const db = await ctx.prisma.user.findUnique({ where: { email: 'maria@t.com' } });
    expect(db.passwordHash).not.toBe(res.body.temporaryPassword);

    const loginRes = await http()
      .post('/auth/login')
      .send({ email: 'maria@t.com', password: res.body.temporaryPassword })
      .expect(200);
    expect(loginRes.body.user.mustChangePassword).toBe(true);
  });

  it('normaliza e-mail com espaços e maiúsculas e detecta duplicata (Review Focus 2)', async () => {
    const res = await http()
      .post('/users/organizers')
      .set(bearer(tAdmin))
      .send({ ...body, email: '  Maria@T.com ' })
      .expect(201);
    expect(res.body.user.email).toBe('maria@t.com');

    await http()
      .post('/auth/login')
      .send({ email: '  MARIA@t.com  ', password: res.body.temporaryPassword })
      .expect(200);

    await http().post('/users/organizers').set(bearer(tAdmin)).send(body).expect(409);
  });

  it('e-mail inválido ou campos ausentes retornam 400', async () => {
    await http().post('/users/organizers').set(bearer(tAdmin)).send({ ...body, email: 'invalido' }).expect(400);
    await http().post('/users/organizers').set(bearer(tAdmin)).send({ name: 'Sem Email' }).expect(400);
  });

  it('lista organizadores com a contagem de campeonatos', async () => {
    const res = await http().get('/users/organizers').set(bearer(tAdmin)).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].email).toBe('org@t.com');
    expect(res.body[0]._count.organizedGames).toBe(0);
  });

  it('redefinir senha invalida a antiga e obriga a troca mesmo com sessão ativa (Review Focus 4)', async () => {
    const org = await ctx.prisma.user.findUnique({ where: { email: 'org@t.com' } });
    const oldToken = await login(ctx.app, 'org@t.com');
    await http().get('/auth/me').set(bearer(oldToken)).expect(200);

    const res = await http()
      .post(`/users/organizers/${org.id}/reset-password`)
      .set(bearer(tAdmin))
      .expect(201);
    expect(res.body.temporaryPassword).toHaveLength(12);

    // token antigo, ainda válido, agora exige a troca
    const blocked = await http().get('/users/organizers').set(bearer(oldToken)).expect(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

    await http().post('/auth/login').send({ email: 'org@t.com', password: 'Senha@12345' }).expect(401);
    await http().post('/auth/login').send({ email: 'org@t.com', password: res.body.temporaryPassword }).expect(200);
  });

  it('redefinir senha de usuário que não é organizador retorna 404', async () => {
    const admin = await ctx.prisma.user.findUnique({ where: { email: 'admin@t.com' } });
    await http().post(`/users/organizers/${admin.id}/reset-password`).set(bearer(tAdmin)).expect(404);
    await http()
      .post('/users/organizers/00000000-0000-0000-0000-000000000000/reset-password')
      .set(bearer(tAdmin))
      .expect(404);
  });
});

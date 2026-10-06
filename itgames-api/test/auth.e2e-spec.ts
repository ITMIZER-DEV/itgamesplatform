import * as request from 'supertest';
import { bearer, createTestApp, createUser, DEFAULT_PASSWORD, login, resetDb, TestCtx } from './helpers';

describe('Auth (e2e)', () => {
  let ctx: TestCtx;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });

  it('GET /auth/me sem token retorna 401', async () => {
    await http().get('/auth/me').expect(401);
  });

  it('GET /auth/me com token retorna o perfil sem o hash da senha', async () => {
    await createUser(ctx.prisma, { email: 'a@t.com', role: 'ATHLETE' });
    const token = await login(ctx.app, 'a@t.com');
    const res = await http().get('/auth/me').set(bearer(token)).expect(200);
    expect(res.body.email).toBe('a@t.com');
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('register ignora o role enviado e cria ATHLETE', async () => {
    const res = await http()
      .post('/auth/register')
      .send({ email: 'novo@x.com', password: DEFAULT_PASSWORD, name: 'Novo', cpf: '529.982.247-25', role: 'SUPER_ADMIN' })
      .expect(201);
    expect(res.body.user.role).toBe('ATHLETE');
    const db = await ctx.prisma.user.findUnique({ where: { email: 'novo@x.com' } });
    expect(db.role).toBe('ATHLETE');
    expect(db.cpf).toBe('52998224725');
  });

  it('register exige CPF válido', async () => {
    const base = { email: 'cpf@x.com', password: DEFAULT_PASSWORD, name: 'Sem CPF' };
    await http().post('/auth/register').send(base).expect(400);
    await http().post('/auth/register').send({ ...base, cpf: '12345678900' }).expect(400);
    await http().post('/auth/register').send({ ...base, cpf: '111.111.111-11' }).expect(400);
  });

  it('register sem e-mail retorna 400', async () => {
    await http().post('/auth/register').send({ password: DEFAULT_PASSWORD, name: 'Sem Email' }).expect(400);
  });

  it('usuário com senha temporária fica bloqueado até trocar a senha', async () => {
    await createUser(ctx.prisma, { email: 'org@t.com', role: 'ORGANIZER', mustChangePassword: true });
    const loginRes = await http().post('/auth/login').send({ email: 'org@t.com', password: DEFAULT_PASSWORD }).expect(200);
    expect(loginRes.body.user.mustChangePassword).toBe(true);
    const token = loginRes.body.accessToken;

    const blocked = await http().get('/scores/game/X').set(bearer(token)).expect(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

    await http().get('/auth/me').set(bearer(token)).expect(200);

    const changed = await http()
      .post('/auth/change-password')
      .set(bearer(token))
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'NovaSenha@123' })
      .expect(201);
    expect(changed.body.user.mustChangePassword).toBe(false);
    expect(typeof changed.body.accessToken).toBe('string');

    const after = await http().get('/scores/game/X').set(bearer(changed.body.accessToken));
    expect(after.body.code).not.toBe('PASSWORD_CHANGE_REQUIRED');

    await http().post('/auth/login').send({ email: 'org@t.com', password: 'NovaSenha@123' }).expect(200);
    await http().post('/auth/login').send({ email: 'org@t.com', password: DEFAULT_PASSWORD }).expect(401);
  });

  it('change-password com senha atual errada retorna 400', async () => {
    await createUser(ctx.prisma, { email: 'a@t.com', role: 'ATHLETE', mustChangePassword: true });
    const token = await login(ctx.app, 'a@t.com');
    await http()
      .post('/auth/change-password')
      .set(bearer(token))
      .send({ currentPassword: 'errada', newPassword: 'NovaSenha@123' })
      .expect(400);
  });

  it('change-password com senha nova curta ou igual à atual retorna 400', async () => {
    await createUser(ctx.prisma, { email: 'a@t.com', role: 'ATHLETE', mustChangePassword: true });
    const token = await login(ctx.app, 'a@t.com');
    await http()
      .post('/auth/change-password')
      .set(bearer(token))
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'curta' })
      .expect(400);
    await http()
      .post('/auth/change-password')
      .set(bearer(token))
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: DEFAULT_PASSWORD })
      .expect(400);
  });
});

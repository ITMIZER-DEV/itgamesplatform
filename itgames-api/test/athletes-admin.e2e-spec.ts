import * as request from 'supertest';
import { bearer, CPF_A, CPF_B, createTestApp, createUser, DEFAULT_PASSWORD, login, resetDb, TestCtx } from './helpers';

describe('Administração de atletas pelo super admin (e2e)', () => {
  let ctx: TestCtx;
  let tAdmin: string;
  let tOrg: string;
  let tAth: string;
  let athId: string;
  let orgId: string;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    const admin = await createUser(ctx.prisma, { email: 'admin@t.com', role: 'SUPER_ADMIN' });
    orgId = (await createUser(ctx.prisma, { email: 'org@t.com', role: 'ORGANIZER', name: 'Organizador' })).id;
    athId = (await createUser(ctx.prisma, { email: 'ana@t.com', role: 'ATHLETE', name: 'Ana Souza', cpf: CPF_A })).id;
    await createUser(ctx.prisma, { email: 'bruno@t.com', role: 'ATHLETE', name: 'Bruno Lima', cpf: CPF_B });
    tAdmin = await login(ctx.app, 'admin@t.com');
    tOrg = await login(ctx.app, 'org@t.com');
    tAth = await login(ctx.app, 'ana@t.com');
    expect(admin.id).toBeTruthy();
  });

  describe('permissões', () => {
    const routes: Array<[string, () => string]> = [
      ['get', () => '/users/athletes'],
      ['post', () => `/users/athletes/${athId}/reset-password`],
    ];
    it.each(routes)('%s: anônimo 401; atleta e organizador 403', async (method, path) => {
      await (http() as any)[method](path()).expect(401);
      await (http() as any)[method](path()).set(bearer(tAth)).expect(403);
      await (http() as any)[method](path()).set(bearer(tOrg)).expect(403);
    });
  });

  describe('listar e buscar', () => {
    it('lista só atletas, com CPF mascarado e sem hash de senha', async () => {
      const res = await http().get('/users/athletes').set(bearer(tAdmin)).expect(200);
      expect(res.body.map((a: any) => a.email).sort()).toEqual(['ana@t.com', 'bruno@t.com']);
      const ana = res.body.find((a: any) => a.email === 'ana@t.com');
      expect(ana.cpfMasked).toBe('***.***.***-25');
      expect(JSON.stringify(res.body)).not.toContain(CPF_A);
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('busca por nome, e-mail ou CPF (com ou sem pontuação), sem diferenciar maiúsculas', async () => {
      const q = async (term: string) =>
        (await http().get(`/users/athletes?q=${encodeURIComponent(term)}`).set(bearer(tAdmin)).expect(200)).body.map(
          (a: any) => a.email,
        );
      expect(await q('SOUZA')).toEqual(['ana@t.com']);
      expect(await q('bruno@')).toEqual(['bruno@t.com']);
      expect(await q('529.982.247-25')).toEqual(['ana@t.com']);
      expect(await q('52998224725')).toEqual(['ana@t.com']);
      expect(await q('nao-existe')).toEqual([]);
    });
  });

  describe('senha temporária', () => {
    it('gera uma senha única, que permite login e obriga a troca', async () => {
      const res = await http().post(`/users/athletes/${athId}/reset-password`).set(bearer(tAdmin)).expect(201);
      expect(res.body.temporaryPassword).toEqual(expect.any(String));
      expect(res.body.temporaryPassword.length).toBeGreaterThanOrEqual(8);
      expect(res.body.user).toMatchObject({ email: 'ana@t.com', mustChangePassword: true });
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');

      await http().post('/auth/login').send({ email: 'ana@t.com', password: DEFAULT_PASSWORD }).expect(401);
      const loginRes = await http()
        .post('/auth/login')
        .send({ email: 'ana@t.com', password: res.body.temporaryPassword })
        .expect(200);
      expect(loginRes.body.user.mustChangePassword).toBe(true);
    });

    it('duas gerações dão senhas diferentes e só a última vale', async () => {
      const a = (await http().post(`/users/athletes/${athId}/reset-password`).set(bearer(tAdmin)).expect(201)).body;
      const b = (await http().post(`/users/athletes/${athId}/reset-password`).set(bearer(tAdmin)).expect(201)).body;
      expect(a.temporaryPassword).not.toBe(b.temporaryPassword);
      await http().post('/auth/login').send({ email: 'ana@t.com', password: a.temporaryPassword }).expect(401);
      await http().post('/auth/login').send({ email: 'ana@t.com', password: b.temporaryPassword }).expect(200);
    });

    it('só vale para atleta: organizador, admin e id inexistente retornam 404', async () => {
      await http().post(`/users/athletes/${orgId}/reset-password`).set(bearer(tAdmin)).expect(404);
      const admin = await ctx.prisma.user.findUnique({ where: { email: 'admin@t.com' } });
      await http().post(`/users/athletes/${admin.id}/reset-password`).set(bearer(tAdmin)).expect(404);
      await http().post('/users/athletes/00000000-0000-0000-0000-000000000000/reset-password').set(bearer(tAdmin)).expect(404);
    });
  });
});

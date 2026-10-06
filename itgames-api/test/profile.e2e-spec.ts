import * as request from 'supertest';
import {
  bearer,
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

describe('Meu perfil (e2e)', () => {
  let ctx: TestCtx;
  let tOrg: string; // organizador sem CPF nem perfil de atleta (caso do Eduardo)
  let tAth: string; // atleta com CPF_A e perfil
  const http = () => request(ctx.app.getHttpServer());
  const patch = (token: string | null, body: object) => {
    const req = http().patch('/auth/profile');
    return (token ? req.set(bearer(token)) : req).send(body);
  };

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    await createUser(ctx.prisma, { email: 'org@t.com', role: 'ORGANIZER', name: 'Eduardo Frederico', phoneNumber: '62 9651-3253' });
    await createUser(ctx.prisma, { email: 'atl@t.com', role: 'ATHLETE', name: 'Atleta A', cpf: CPF_A, gender: 'M' });
    await createUser(ctx.prisma, { email: 'outro@t.com', role: 'ATHLETE', name: 'Atleta B', cpf: CPF_B });
    tOrg = await login(ctx.app, 'org@t.com');
    tAth = await login(ctx.app, 'atl@t.com');
  });

  const full = { cpf: '390.533.447-05', birthDate: '1991-04-12', gender: 'F', tshirtSize: 'P', boxOrGym: 'Box Goiânia' };

  it('sem login retorna 401', async () => {
    await patch(null, { phoneNumber: '1' }).expect(401);
  });

  it('organizador sem CPF define CPF e cria o perfil de atleta; CPF sai só com dígitos', async () => {
    const res = await patch(tOrg, full).expect(200);
    expect(res.body.athleteProfile).toMatchObject({ gender: 'F', tshirtSize: 'P', boxOrGym: 'Box Goiânia' });
    expect(res.body.athleteProfile.birthDate).toContain('1991-04-12');

    const db = await ctx.prisma.user.findUnique({ where: { email: 'org@t.com' }, include: { athleteProfile: true } });
    expect(db.cpf).toBe('39053344705');
    expect(db.role).toBe('ORGANIZER');
    expect(db.athleteProfile).toBeTruthy();
  });

  it('não expõe o hash da senha', async () => {
    const res = await patch(tOrg, full).expect(200);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('o organizador, depois de completar o cadastro, consegue se inscrever como competidor', async () => {
    const orgUser = await ctx.prisma.user.findUnique({ where: { email: 'org@t.com' } });
    await createGameFixture(ctx.prisma, 'G1', { status: 'live' });
    await createCategoryFixture(ctx.prisma, 'G1', 1);
    // antes: sem CPF, a inscrição é recusada
    await http()
      .post('/events/G1/registrations')
      .set(bearer(tOrg))
      .send({ categoryId: 1, teamName: 'Time', athletes: [{ cpf: CPF_A }] })
      .expect(400);

    await patch(tOrg, full).expect(200);
    const res = await http()
      .post('/events/G1/registrations')
      .set(bearer(tOrg))
      .send({ categoryId: 1, teamName: 'Time', athletes: [{ cpf: '39053344705' }] })
      .expect(201);
    expect(res.body.registration.athletes[0]).toMatchObject({ name: orgUser.name, gender: 'F', tshirtSize: 'P' });
  });

  describe('CPF', () => {
    it('depois de definido não pode ser trocado, mas repetir o mesmo valor é aceito', async () => {
      const res = await patch(tAth, { cpf: CPF_B }).expect(400);
      expect(res.body.message).toMatch(/não pode ser alterado/i);
      await patch(tAth, { cpf: '529.982.247-25', phoneNumber: '11999990000' }).expect(200);
      const db = await ctx.prisma.user.findUnique({ where: { email: 'atl@t.com' } });
      expect(db.cpf).toBe(CPF_A);
      expect(db.phoneNumber).toBe('11999990000');
    });

    it('CPF inválido retorna 400; CPF de outra conta retorna 409', async () => {
      const bad = await patch(tOrg, { cpf: '12345678900' }).expect(400);
      expect(bad.body.message).toMatch(/CPF inválido/i);
      await patch(tOrg, { cpf: CPF_B }).expect(409);
      const db = await ctx.prisma.user.findUnique({ where: { email: 'org@t.com' } });
      expect(db.cpf).toBeNull();
    });
  });

  describe('validações', () => {
    it.each([
      ['nascimento futuro', { birthDate: '2999-01-01' }],
      ['nascimento inválido', { birthDate: 'ontem' }],
      ['gênero inválido', { gender: 'X' }],
      ['camiseta inválida', { tshirtSize: 'ZZ' }],
      ['nome vazio', { name: '' }],
    ])('%s retorna 400 e não grava nada', async (_nome, body) => {
      await patch(tOrg, body).expect(400);
      const db = await ctx.prisma.user.findUnique({ where: { email: 'org@t.com' }, include: { athleteProfile: true } });
      expect(db.athleteProfile).toBeNull();
      expect(db.name).toBe('Eduardo Frederico');
    });
  });

  it('atualização parcial mantém o resto; e-mail e papel enviados são ignorados', async () => {
    await patch(tAth, { gender: 'F', tshirtSize: 'G' }).expect(200);
    const res = await patch(tAth, { phoneNumber: '62 99999-0000', role: 'SUPER_ADMIN', email: 'hack@t.com' }).expect(200);
    expect(res.body.athleteProfile).toMatchObject({ gender: 'F', tshirtSize: 'G' });
    const db = await ctx.prisma.user.findUnique({ where: { cpf: CPF_A } });
    expect(db).toMatchObject({ role: 'ATHLETE', email: 'atl@t.com', phoneNumber: '62 99999-0000' });
  });

  it('GET /auth/me devolve o CPF do próprio usuário sem máscara em ownCpf (o campo cpf continua mascarado)', async () => {
    const res = await http().get('/auth/me').set(bearer(tAth)).expect(200);
    expect(res.body.ownCpf).toBe(CPF_A);
    expect(res.body.cpf).toContain('***');
    const orgRes = await http().get('/auth/me').set(bearer(tOrg)).expect(200);
    expect(orgRes.body.ownCpf).toBeNull();
  });

  it('muda o nome do cadastro', async () => {
    const res = await patch(tAth, { name: '  Atleta Renomeado  ' }).expect(200);
    expect(res.body.name).toBe('Atleta Renomeado');
  });
});

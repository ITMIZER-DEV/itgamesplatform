import * as request from 'supertest';
import { bearer, createCategoryFixture, createGameFixture, createTestApp, createUser, login, resetDb, TestCtx } from './helpers';

describe('Telões de TV (e2e)', () => {
  let ctx: TestCtx;
  let orgA: { id: string };
  let orgB: { id: string };
  let tA: string;
  let tB: string;
  let tSuper: string;
  const http = () => request(ctx.app.getHttpServer());

  // TV pede o código; o organizador resgata.
  async function pair(token: string, body: Record<string, unknown>) {
    const p = await http().post('/screens/pairing').expect(201);
    const res = await http()
      .post('/screens/claim')
      .set(bearer(token))
      .send({ code: p.body.code, name: 'Telão 1', gameCodes: ['G1'], ...body });
    return { pairing: p.body as { pairingId: string; code: string }, res };
  }

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    orgA = await createUser(ctx.prisma, { email: 'a@t.com', role: 'ORGANIZER' });
    orgB = await createUser(ctx.prisma, { email: 'b@t.com', role: 'ORGANIZER' });
    await createUser(ctx.prisma, { email: 'root@t.com', role: 'SUPER_ADMIN' });
    tA = await login(ctx.app, 'a@t.com');
    tB = await login(ctx.app, 'b@t.com');
    tSuper = await login(ctx.app, 'root@t.com');

    await createGameFixture(ctx.prisma, 'G1', { status: 'draft', organizerIds: [orgA.id] });
    await createCategoryFixture(ctx.prisma, 'G1', 1);
    await createGameFixture(ctx.prisma, 'G2', { status: 'live', organizerIds: [orgB.id] });
    await createGameFixture(ctx.prisma, 'GB', { status: 'blocked', organizerIds: [orgA.id] });
  });

  it('organizador A cria telão com campeonato próprio (draft aceito) e B recebe 404', async () => {
    const { res } = await pair(tA, {});
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Telão 1', mode: 'partial', rotateSeconds: 15, gameCodes: ['G1'], ownerId: orgA.id });
    const id = res.body.id;

    await http().patch(`/screens/${id}`).set(bearer(tB)).send({ name: 'x' }).expect(404);
    await http().post(`/screens/${id}/freeze`).set(bearer(tB)).send({}).expect(404);
    await http().delete(`/screens/${id}`).set(bearer(tB)).expect(404);

    const listB = await http().get('/screens').set(bearer(tB)).expect(200);
    expect(listB.body).toHaveLength(0);
  });

  it('super admin enxerga e controla tudo', async () => {
    const { res } = await pair(tA, {});
    const list = await http().get('/screens').set(bearer(tSuper)).expect(200);
    expect(list.body.map((s: { id: string }) => s.id)).toContain(res.body.id);
    await http().patch(`/screens/${res.body.id}`).set(bearer(tSuper)).send({ name: 'Renomeado' }).expect(200);
  });

  it('claim com campeonato que o organizador não gerencia, ou bloqueado, retorna 400', async () => {
    expect((await pair(tA, { gameCodes: ['G2'] })).res.status).toBe(400);
    expect((await pair(tA, { gameCodes: ['GB'] })).res.status).toBe(400);
    expect((await pair(tA, { gameCodes: [] })).res.status).toBe(400);
  });

  it('modo official é recusado com 400', async () => {
    const { res } = await pair(tA, { mode: 'official' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Modo oficial disponível após o cálculo oficial do juiz-chefe');
  });

  it('rotateSeconds numérico em texto é convertido antes do clamp', async () => {
    const { res } = await pair(tA, { rotateSeconds: '30' });
    expect(res.status).toBe(201);
    expect(res.body.rotateSeconds).toBe(30);
  });

  it('código expirado ou já usado retorna 404', async () => {
    const used = await pair(tA, {});
    await http().post('/screens/claim').set(bearer(tA)).send({ code: used.pairing.code, name: 'x', gameCodes: ['G1'] }).expect(404);

    const p = await http().post('/screens/pairing').expect(201);
    await ctx.prisma.screen.update({ where: { id: p.body.pairingId }, data: { pairingExpiresAt: new Date(Date.now() - 1000) } });
    await http().post('/screens/claim').set(bearer(tA)).send({ code: p.body.code, name: 'x', gameCodes: ['G1'] }).expect(404);
    const poll = await http().get(`/screens/pairing/${p.body.pairingId}`).expect(200);
    expect(poll.body.status).toBe('expired');
  });

  it('11 códigos errados seguidos retornam 429 na 11ª tentativa', async () => {
    for (let i = 0; i < 10; i++) {
      await http().post('/screens/claim').set(bearer(tB)).send({ code: 'ZZZZZZ', name: 'x', gameCodes: ['G2'] }).expect(404);
    }
    await http().post('/screens/claim').set(bearer(tB)).send({ code: 'ZZZZZZ', name: 'x', gameCodes: ['G2'] }).expect(429);
  });

  it('11 claims válidos seguidos não geram 429 (só tentativas inválidas contam)', async () => {
    for (let i = 0; i < 11; i++) {
      const { res } = await pair(tA, {});
      expect(res.status).toBe(201);
    }
  });

  it('GET /screens/pairing/:id devolve a credencial uma única vez e depois 410', async () => {
    const { pairing } = await pair(tA, {});
    const first = await http().get(`/screens/pairing/${pairing.pairingId}`).expect(200);
    expect(first.body.status).toBe('paired');
    expect(typeof first.body.deviceToken).toBe('string');

    const row = await ctx.prisma.screen.findUnique({ where: { id: pairing.pairingId } });
    expect(row?.deviceTokenHash).toBeTruthy();
    expect(row?.deviceTokenHash).not.toBe(first.body.deviceToken);

    await http().get(`/screens/pairing/${pairing.pairingId}`).expect(410);
  });

  it('antes do resgate o pareamento fica pendente', async () => {
    const p = await http().post('/screens/pairing').expect(201);
    const poll = await http().get(`/screens/pairing/${p.body.pairingId}`).expect(200);
    expect(poll.body).toEqual({ status: 'pending' });
  });

  it('freeze guarda frozenBoards e unfreeze limpa', async () => {
    const { res } = await pair(tA, {});
    const id = res.body.id;

    const frozen = await http().post(`/screens/${id}/freeze`).set(bearer(tA)).send({ text: 'LEADERBOARD EM REVISÃO' }).expect(200);
    expect(frozen.body).toMatchObject({ frozen: true, overlayText: 'LEADERBOARD EM REVISÃO' });
    let row = await ctx.prisma.screen.findUnique({ where: { id } });
    expect(row?.frozenBoards).toBeTruthy();
    expect(Object.keys(row!.frozenBoards as object)).toEqual(['G1']);

    await http().post(`/screens/${id}/freeze`).set(bearer(tA)).send({ text: 'x'.repeat(61) }).expect(400);

    const un = await http().post(`/screens/${id}/unfreeze`).set(bearer(tA)).expect(200);
    expect(un.body).toMatchObject({ frozen: false, frozenAt: null, overlayText: null });
    row = await ctx.prisma.screen.findUnique({ where: { id } });
    expect(row?.frozenBoards).toBeNull();

    const logs = await ctx.prisma.screenLog.findMany({ where: { screenId: id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['claim', 'freeze', 'unfreeze']);
  });

  it('freeze-all e unfreeze-all afetam só os telões do usuário', async () => {
    const a = (await pair(tA, {})).res.body.id;
    const b = (await pair(tB, { gameCodes: ['G2'] })).res.body.id;

    const all = await http().post('/screens/freeze-all').set(bearer(tA)).send({}).expect(200);
    expect(all.body.map((s: { id: string }) => s.id)).toEqual([a]);
    expect((await ctx.prisma.screen.findUnique({ where: { id: a } }))?.frozen).toBe(true);
    expect((await ctx.prisma.screen.findUnique({ where: { id: b } }))?.frozen).toBe(false);

    await http().post('/screens/unfreeze-all').set(bearer(tA)).expect(200);
    expect((await ctx.prisma.screen.findUnique({ where: { id: a } }))?.frozen).toBe(false);
  });

  it('DELETE remove o telão', async () => {
    const { res } = await pair(tA, {});
    await http().delete(`/screens/${res.body.id}`).set(bearer(tA)).expect(200);
    expect((await http().get('/screens').set(bearer(tA)).expect(200)).body).toHaveLength(0);
  });
});

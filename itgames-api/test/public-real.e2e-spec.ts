import * as fs from 'fs';
import * as path from 'path';
import * as request from 'supertest';
import {
  bearer,
  createCategoryFixture,
  createGameFixture,
  createTestApp,
  createUser,
  login,
  resetDb,
  TestCtx,
} from './helpers';

const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(64, 1)]);
const JPEG = Buffer.concat([Buffer.from('ffd8ffe0', 'hex'), Buffer.alloc(64, 2)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(32, 3)]);
const GIF = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(64, 4)]);

describe('Rotas públicas reais: banner, Pix e leaderboard (e2e)', () => {
  let ctx: TestCtx;
  let orgA: { id: string };
  let tAdmin: string;
  let tA: string;
  let tB: string;
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
    await createUser(ctx.prisma, { email: 'admin@t.com', role: 'SUPER_ADMIN' });
    orgA = await createUser(ctx.prisma, { email: 'a@t.com', role: 'ORGANIZER' });
    await createUser(ctx.prisma, { email: 'b@t.com', role: 'ORGANIZER' });
    await createUser(ctx.prisma, { email: 'atleta@t.com', role: 'ATHLETE' });
    tAdmin = await login(ctx.app, 'admin@t.com');
    tA = await login(ctx.app, 'a@t.com');
    tB = await login(ctx.app, 'b@t.com');
    tAthlete = await login(ctx.app, 'atleta@t.com');
  });

  describe('upload de imagem do campeonato', () => {
    beforeEach(async () => {
      await createGameFixture(ctx.prisma, 'G1', { status: 'draft', organizerIds: [orgA.id] });
    });
    const upload = (token: string | null, buf: Buffer, name = 'banner.png', type = 'image/png') => {
      const req = http().post('/events/G1/banner');
      if (token) req.set(bearer(token));
      return req.attach('file', buf, { filename: name, contentType: type });
    };

    it('exige login e vínculo: anônimo 401, atleta 403, organizador não vinculado 403', async () => {
      await upload(null, PNG).expect(401);
      await upload(tAthlete, PNG).expect(403);
      await upload(tB, PNG).expect(403);
    });

    it('organizador vinculado envia PNG; o caminho é gravado e o arquivo é servido', async () => {
      const res = await upload(tA, PNG).expect(201);
      expect(res.body.foto).toMatch(/^\/uploads\/banners\/G1-\d+\.png$/);
      const game = await ctx.prisma.game.findUnique({ where: { code: 'G1' } });
      expect(game.foto).toBe(res.body.foto);

      const file = await http().get(res.body.foto).expect(200);
      expect(file.headers['content-type']).toContain('image/png');
    });

    it('aceita JPEG e WebP e o super admin também pode enviar', async () => {
      await upload(tA, JPEG, 'a.jpg', 'image/jpeg').expect(201);
      await upload(tAdmin, WEBP, 'a.webp', 'image/webp').expect(201);
    });

    it('recusa arquivo que não é imagem mesmo com nome e tipo de imagem, e formatos não aceitos', async () => {
      await upload(tA, Buffer.from('isto não é uma imagem'), 'fake.png', 'image/png').expect(400);
      await upload(tA, GIF, 'a.gif', 'image/gif').expect(400);
    });

    it('recusa arquivo acima de 5 MB (413) e requisição sem arquivo (400)', async () => {
      const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 10, 5)]);
      await upload(tA, big).expect(413);
      await http().post('/events/G1/banner').set(bearer(tA)).expect(400);
    });

    it('novo envio apaga a imagem anterior do disco', async () => {
      const first = await upload(tA, PNG).expect(201);
      const dir = process.env.UPLOADS_DIR as string;
      const firstPath = path.join(dir, 'banners', path.basename(first.body.foto));
      expect(fs.existsSync(firstPath)).toBe(true);
      await new Promise((r) => setTimeout(r, 5));
      await upload(tA, JPEG, 'b.jpg', 'image/jpeg').expect(201);
      expect(fs.existsSync(firstPath)).toBe(false);
    });

    it('campeonato inexistente retorna 404 (super admin)', async () => {
      await http()
        .post('/events/NAOEXISTE/banner')
        .set(bearer(tAdmin))
        .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })
        .expect(404);
    });
  });

  describe('chave Pix do campeonato', () => {
    it('é gravada na criação e na edição e aparece na leitura pública de campeonato liberado', async () => {
      await http()
        .post('/events')
        .set(bearer(tA))
        .send({ code: 'PIX1', name: 'Com Pix', pixKey: 'pix@arena.com', pixBeneficiary: 'Arena LTDA' })
        .expect(201);
      await ctx.prisma.game.update({ where: { code: 'PIX1' }, data: { status: 'live' } });

      const created = await http().get('/events/PIX1').expect(200);
      expect(created.body.pixKey).toBe('pix@arena.com');
      expect(created.body.pixBeneficiary).toBe('Arena LTDA');

      const gameLink = await ctx.prisma.gameOrganizer.count({ where: { gameCode: 'PIX1', userId: orgA.id } });
      expect(gameLink).toBe(1);
      await http().put('/events/PIX1').set(bearer(tA)).send({ pixKey: '11999990000' }).expect(200);
      const edited = await http().get('/events/PIX1').expect(200);
      expect(edited.body.pixKey).toBe('11999990000');
      expect(edited.body.pixBeneficiary).toBe('Arena LTDA');
    });
  });

  describe('leaderboard público', () => {
    beforeEach(async () => {
      await createGameFixture(ctx.prisma, 'G1', { status: 'live', organizerIds: [orgA.id] });
      await createCategoryFixture(ctx.prisma, 'G1');
      await ctx.prisma.workout.create({ data: { code: 1, game: 'G1', category: 1, title: 'WOD 1', type: 'for_time', timeCap: '10:00' } });
      await ctx.prisma.event.create({ data: { idEvent: 1, game: 'G1', category: 1, title: 'WOD 1', workout: 1 } });
      await ctx.prisma.event.create({ data: { idEvent: 2, game: 'G1', category: 1, title: 'WOD 2', workout: 2 } });
      for (const [code, status] of [[101, 'paid'], [102, 'paid'], [103, 'cancelled']] as const) {
        await ctx.prisma.registration.create({
          data: {
            code,
            categoryId: 1,
            gameCode: 'G1',
            team: `Time ${code}`,
            status,
            number: `#${code}`,
            athletes: {
              create: [{ code: 1, name: `Atleta ${code}`, cpf: `${code}00000000`, phonenumber: `1198${code}000`, category: 1 }],
            },
          },
        });
      }
      const base = { game: 'G1', category: 1, judge: 'Juiz' };
      await ctx.prisma.score.create({ data: { ...base, idEvent: 1, codeTeam: 101, time: '05:00', scoreStatus: 'approved_by_head_judge' } });
      await ctx.prisma.score.create({ data: { ...base, idEvent: 1, codeTeam: 102, time: '06:00', scoreStatus: 'draft' } });
      await ctx.prisma.score.create({ data: { ...base, idEvent: 2, codeTeam: 101, time: '04:00', scoreStatus: 'voided' } });
      await ctx.prisma.score.create({ data: { ...base, idEvent: 1, codeTeam: 103, time: '03:00', scoreStatus: 'approved_by_head_judge' } });
    });

    it('é público, traz só equipes ativas e scores homologados, sem CPF nem telefone', async () => {
      const res = await http().get('/events/G1/leaderboard').expect(200);
      expect(res.body.game.code).toBe('G1');
      expect(res.body.categories).toHaveLength(1);
      expect(res.body.workouts.map((w: any) => w.code)).toEqual([1]);
      expect(res.body.teams.map((t: any) => t.code).sort()).toEqual([101, 102]);
      expect(res.body.teams[0].athletes[0]).toMatch(/^Atleta 10/);

      // só o score homologado de equipe ativa (101 no WOD 1); rascunho, anulado e de equipe cancelada ficam de fora
      expect(res.body.scores.map((s: any) => `${s.codeTeam}:${s.idEvent}`)).toEqual(['101:1']);

      const body = JSON.stringify(res.body);
      expect(body).not.toContain('10100000000');
      expect(body).not.toContain('1198101000');
    });

    it('campeonato em rascunho: 404 para visitante, 200 para organizador vinculado', async () => {
      await ctx.prisma.game.update({ where: { code: 'G1' }, data: { status: 'draft' } });
      await http().get('/events/G1/leaderboard').expect(404);
      await http().get('/events/G1/leaderboard').set(bearer(tA)).expect(200);
    });

    it('campeonato inexistente retorna 404', async () => {
      await http().get('/events/NAOEXISTE/leaderboard').expect(404);
    });
  });
});

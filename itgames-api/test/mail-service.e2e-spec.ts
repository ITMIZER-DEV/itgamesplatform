import { MailService } from '../src/modules/mail/mail.service';
import { configureMail, createTestApp, resetDb, TestCtx } from './helpers';

describe('MailService (e2e)', () => {
  let ctx: TestCtx;
  let mail: MailService;
  const vars = { nome: 'Ana', campeonato: 'Summer', categoria: 'RX', equipe: 'Time A', numero: '#1101', valor: 'R$ 10,00' };

  beforeAll(async () => {
    ctx = await createTestApp();
    mail = ctx.app.get(MailService);
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    ctx.mail.sent.length = 0;
    ctx.mail.failWith = null;
  });

  const logs = () => ctx.prisma.emailLog.findMany({ orderBy: { createdAt: 'asc' } });

  it('sem configuração, grava skipped e não chama o transporte', async () => {
    const r = await mail.send('registration_confirmed', 'ana@x.com', vars);
    expect(r.status).toBe('skipped');
    expect(ctx.mail.sent).toHaveLength(0);
    const [log] = await logs();
    expect(log).toMatchObject({ type: 'registration_confirmed', toAddress: 'ana@x.com', status: 'skipped' });
  });

  it('configurado, envia com remetente, destinatário e assunto renderizados e grava sent', async () => {
    await configureMail(ctx);
    const r = await mail.send('registration_confirmed', 'ana@x.com', vars);
    expect(r.status).toBe('sent');
    expect(ctx.mail.sent).toHaveLength(1);
    expect(ctx.mail.sent[0]).toMatchObject({
      from: '"ITGames" <envio@itgames.test>',
      to: 'ana@x.com',
      subject: 'Inscrição recebida — Summer',
    });
    expect(ctx.mail.sent[0].text).toContain('equipe Time A');
    expect((await logs())[0]).toMatchObject({ status: 'sent', error: null });
  });

  it('envio geral desligado grava skipped', async () => {
    await configureMail(ctx, { enabled: false });
    expect((await mail.send('payment_confirmed', 'ana@x.com', vars)).status).toBe('skipped');
    expect(ctx.mail.sent).toHaveLength(0);
  });

  it('tipo desligado grava skipped; template editado vale no envio', async () => {
    await configureMail(ctx);
    await ctx.prisma.mailTemplate.create({
      data: { type: 'payment_confirmed', enabled: false, subject: 'X', body: 'Y' },
    });
    expect((await mail.send('payment_confirmed', 'ana@x.com', vars)).status).toBe('skipped');

    await ctx.prisma.mailTemplate.update({
      where: { type: 'payment_confirmed' },
      data: { enabled: true, subject: 'Pago {{numero}}', body: 'Valeu, {{nome}}' },
    });
    await mail.send('payment_confirmed', 'ana@x.com', vars);
    expect(ctx.mail.sent[0]).toMatchObject({ subject: 'Pago #1101', text: 'Valeu, Ana' });
  });

  it('falha do transporte grava failed, não lança e não vaza a senha', async () => {
    await configureMail(ctx, { password: 'senha-super-secreta' });
    ctx.mail.failWith = 'auth falhou para senha-super-secreta';
    const r = await mail.send('payment_confirmed', 'ana@x.com', vars);
    expect(r.status).toBe('failed');
    const [log] = await logs();
    expect(log.status).toBe('failed');
    expect(log.error).toContain('auth falhou');
    expect(log.error).not.toContain('senha-super-secreta');
    expect(JSON.stringify(r)).not.toContain('senha-super-secreta');
  });

  it('senha ilegível (chave trocada) vira skipped com motivo, sem lançar', async () => {
    await configureMail(ctx);
    await ctx.prisma.mailSettings.update({ where: { id: 1 }, data: { passwordEnc: 'lixo:lixo:lixo' } });
    const r = await mail.send('payment_confirmed', 'ana@x.com', vars);
    expect(r.status).toBe('skipped');
    expect((await logs())[0].error).toMatch(/senha/i);
  });

  it('conteúdo malicioso: HTML escapado no corpo e quebra de linha removida do assunto', async () => {
    await configureMail(ctx);
    await mail.send('registration_confirmed', 'ana@x.com', {
      ...vars,
      equipe: '<script>alert(1)</script>',
      campeonato: 'Summer\r\nBcc: alguem@x.com',
    });
    const sent = ctx.mail.sent[0];
    expect(sent.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(sent.html).not.toContain('<script>');
    expect(sent.subject).not.toMatch(/[\r\n]/);
  });

  it('dispatch roda em segundo plano e idle() espera terminar', async () => {
    await configureMail(ctx);
    mail.dispatch('payment_confirmed', 'ana@x.com', vars);
    await mail.idle();
    expect(ctx.mail.sent).toHaveLength(1);
  });

  it('opts.redact não grava as variáveis (payload nulo)', async () => {
    await configureMail(ctx);
    await mail.send('payment_confirmed', 'ana@x.com', vars, { redact: true });
    expect((await logs())[0].payload).toBeNull();
    await mail.send('payment_confirmed', 'ana@x.com', vars);
    expect((await logs())[1].payload).toMatchObject({ nome: 'Ana' });
  });
});

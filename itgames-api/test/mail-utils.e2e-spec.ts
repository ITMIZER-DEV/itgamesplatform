import { decryptSecret, encryptSecret } from '../src/modules/mail/mail.crypto';
import {
  DEFAULT_TEMPLATES,
  escapeHtml,
  isMailType,
  MAIL_TYPES,
  renderHtml,
  renderText,
  SAMPLE_VARS,
} from '../src/modules/mail/mail.templates';

describe('Mail utils', () => {
  describe('criptografia', () => {
    it('cifra e decifra de volta; o texto cifrado não contém o original', () => {
      const enc = encryptSecret('senha-de-app-123');
      expect(enc).not.toContain('senha-de-app-123');
      expect(enc.split(':')).toHaveLength(3);
      expect(decryptSecret(enc)).toBe('senha-de-app-123');
    });

    it('duas cifragens do mesmo texto diferem (IV aleatório)', () => {
      expect(encryptSecret('x')).not.toBe(encryptSecret('x'));
    });

    it('chave trocada ou conteúdo adulterado devolve null, sem lançar', () => {
      const enc = encryptSecret('segredo');
      const old = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'outra-chave';
      try {
        expect(decryptSecret(enc)).toBeNull();
      } finally {
        process.env.JWT_SECRET = old;
      }
      expect(decryptSecret('lixo')).toBeNull();
      expect(decryptSecret('')).toBeNull();
    });

    it('MAIL_ENCRYPTION_KEY tem precedência sobre JWT_SECRET', () => {
      process.env.MAIL_ENCRYPTION_KEY = 'chave-propria';
      try {
        const enc = encryptSecret('abc');
        delete process.env.MAIL_ENCRYPTION_KEY;
        expect(decryptSecret(enc)).toBeNull(); // sem a chave própria, usa JWT_SECRET e falha
        process.env.MAIL_ENCRYPTION_KEY = 'chave-propria';
        expect(decryptSecret(enc)).toBe('abc');
      } finally {
        delete process.env.MAIL_ENCRYPTION_KEY;
      }
    });
  });

  describe('templates', () => {
    it('tem os 8 tipos, cada um com assunto, corpo e variáveis, e todo {{var}} do padrão está declarado', () => {
      expect([...MAIL_TYPES].sort()).toEqual(
        [
          'alert_category_full',
          'alert_game_status',
          'alert_new_registration',
          'alert_registration_cancelled',
          'password_changed',
          'password_reset',
          'payment_confirmed',
          'registration_confirmed',
        ].sort(),
      );
      for (const type of MAIL_TYPES) {
        const def = DEFAULT_TEMPLATES[type];
        expect(def.subject.length).toBeGreaterThan(0);
        expect(def.body.length).toBeGreaterThan(0);
        const used = [...(def.subject + def.body).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]);
        for (const v of used) expect(def.variables).toContain(v);
        for (const v of def.variables) expect(SAMPLE_VARS[type][v]).toBeDefined();
      }
    });

    it('isMailType só aceita os tipos conhecidos', () => {
      expect(isMailType('password_reset')).toBe(true);
      expect(isMailType('qualquer')).toBe(false);
      expect(isMailType('__proto__')).toBe(false);
    });

    it('renderText substitui variáveis (com espaços) e deixa vazio o que não existe', () => {
      expect(renderText('Olá, {{ nome }}! {{x}}', { nome: 'Ana' })).toBe('Olá, Ana! ');
    });

    it('renderHtml escapa variáveis e o próprio template e converte quebras de linha', () => {
      const html = renderHtml('Oi {{nome}}\n<b>x</b>', { nome: '<script>alert(1)</script>' });
      expect(html).toBe('Oi &lt;script&gt;alert(1)&lt;/script&gt;<br>&lt;b&gt;x&lt;/b&gt;');
      expect(escapeHtml(`&"'<>`)).toBe('&amp;&quot;&#39;&lt;&gt;');
    });

    it('um valor que contém {{outra}} não é reinterpretado', () => {
      expect(renderText('{{a}}', { a: '{{b}}', b: 'secreto' })).toBe('{{b}}');
    });
  });
});

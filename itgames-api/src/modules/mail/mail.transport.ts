import * as nodemailer from 'nodemailer';

export const MAIL_TRANSPORT_FACTORY = 'MAIL_TRANSPORT_FACTORY';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: 'starttls' | 'ssl';
  user: string;
  pass: string;
}

export interface MailTransport {
  sendMail(options: { from: string; to: string; subject: string; text: string; html: string }): Promise<unknown>;
}

export type MailTransportFactory = (config: SmtpConfig) => MailTransport;

// Implementação real; os testes substituem este provider por um fake
export const nodemailerFactory: MailTransportFactory = (c) =>
  nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure === 'ssl',
    requireTLS: c.secure === 'starttls',
    auth: { user: c.user, pass: c.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

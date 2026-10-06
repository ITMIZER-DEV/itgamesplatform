import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailController } from './mail.controller';
import { MailNotifier } from './mail-notifier.service';
import { MailService } from './mail.service';
import { MAIL_TRANSPORT_FACTORY, nodemailerFactory } from './mail.transport';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [MailController],
  providers: [MailService, MailNotifier, { provide: MAIL_TRANSPORT_FACTORY, useValue: nodemailerFactory }],
  exports: [MailService, MailNotifier],
})
export class MailModule {}

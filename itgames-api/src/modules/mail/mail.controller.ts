import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { AuthUser } from '../../common/types/auth-user';
import { PreviewMailTemplateDto, UpdateMailTemplateDto } from './dto/update-mail-template.dto';
import { UpdateMailSettingsDto } from './dto/update-mail-settings.dto';
import { MailService } from './mail.service';

@ApiTags('mail')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('mail')
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Super Admin: configuração de envio (a senha nunca é devolvida)' })
  getSettings() {
    return this.mail.getPublicSettings();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Super Admin: salvar configuração SMTP (senha ausente/vazia mantém a atual)' })
  saveSettings(@Body() dto: UpdateMailSettingsDto) {
    return this.mail.saveSettings(dto);
  }

  @Post('settings/test')
  @ApiOperation({ summary: 'Super Admin: enviar e-mail de teste para o próprio e-mail' })
  async test(@CurrentUser() user: AuthUser) {
    return this.mail.sendTest(user.email);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Super Admin: tipos de e-mail com texto atual e padrão' })
  listTemplates() {
    return this.mail.listTemplates();
  }

  @Put('templates/:type')
  @ApiOperation({ summary: 'Super Admin: editar um tipo de e-mail' })
  saveTemplate(@Param('type') type: string, @Body() dto: UpdateMailTemplateDto) {
    return this.mail.saveTemplate(type, dto);
  }

  @Delete('templates/:type')
  @ApiOperation({ summary: 'Super Admin: restaurar o texto padrão de um tipo' })
  resetTemplate(@Param('type') type: string) {
    return this.mail.resetTemplate(type);
  }

  @Post('templates/:type/preview')
  @ApiOperation({ summary: 'Super Admin: prévia com dados de exemplo (aceita rascunho)' })
  preview(@Param('type') type: string, @Body() dto: PreviewMailTemplateDto) {
    return this.mail.previewTemplate(type, dto);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Super Admin: histórico de envios' })
  listLogs(@Query('status') status?: string, @Query('limit') limit?: string) {
    return this.mail.listLogs({ status, limit: limit ? parseInt(limit, 10) : undefined });
  }

  @Post('logs/:id/resend')
  @ApiOperation({ summary: 'Super Admin: reenviar um e-mail do histórico' })
  resend(@Param('id') id: string) {
    return this.mail.resendLog(id);
  }
}

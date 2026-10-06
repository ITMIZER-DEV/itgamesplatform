import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GameAccessService } from '../../common/access/game-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { AuthUser } from '../../common/types/auth-user';
import { AuditService } from './audit.service';

@ApiTags('Auditoria & Logs Imutáveis')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly access: GameAccessService,
  ) {}

  @Roles(UserRole.ORGANIZER)
  @Get('game/:gameCode')
  @ApiOperation({ summary: 'Consultar trilha de auditoria de um evento (organizador do campeonato / super admin)' })
  async getLogs(@Param('gameCode') gameCode: string, @CurrentUser() user: AuthUser) {
    await this.access.assertCanManage(user, gameCode);
    return this.auditService.getAuditLogs(gameCode);
  }
}

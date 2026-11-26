import { Controller, Get, Post, Body, Res, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { BackupService } from './backup.service';
import { ProgramService } from './program.service';
import { GameAccessService } from '../../common/access/game-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types/auth-user';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Backup & Sincronização')
@ApiBearerAuth()
@Controller('backup')
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly programService: ProgramService,
    private readonly access: GameAccessService,
  ) {}

  // Programação de um campeonato (WODs, provas, layouts de súmula, timeline) — sem scores nem placar
  @Get('program/:gameCode/export')
  @Roles('SUPER_ADMIN', 'ORGANIZER')
  @ApiOperation({ summary: 'Exporta a programação do campeonato (WODs, súmulas e timeline)' })
  async exportProgram(@Param('gameCode') gameCode: string, @CurrentUser() user: AuthUser) {
    await this.access.assertCanManage(user, gameCode);
    return this.programService.exportProgram(gameCode);
  }

  @Post('program/:gameCode/import')
  @Roles('SUPER_ADMIN', 'ORGANIZER')
  @ApiOperation({ summary: 'Simula (padrão) ou grava (?apply=1) a programação exportada de outro sistema' })
  async importProgram(
    @Param('gameCode') gameCode: string,
    @Body() payload: any,
    @Query('apply') apply: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    await this.access.assertCanManage(user, gameCode);
    return this.programService.importProgram(gameCode, payload, apply === '1' || apply === 'true', user.role === 'SUPER_ADMIN');
  }

  @Get('export')
  @Roles('SUPER_ADMIN', 'ORGANIZER')
  @ApiOperation({ summary: 'Exporta snapshot JSON com todos os dados do sistema' })
  async exportSnapshot(@Res() res: Response) {
    const data = await this.backupService.exportSnapshot();
    const filename = `itgames-backup-${new Date().toISOString().slice(0, 10)}.json`;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(data, null, 2));
  }

  @Post('import')
  @Roles('SUPER_ADMIN', 'ORGANIZER')
  @ApiOperation({ summary: 'Restaura snapshot JSON completo no banco de dados' })
  async importSnapshot(@Body() payload: any, @CurrentUser() user: AuthUser) {
    return this.backupService.importSnapshot(payload, user.role);
  }
}

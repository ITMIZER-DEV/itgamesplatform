import { Controller, Get, Post, Body, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { BackupService } from './backup.service';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Backup & Sincronização')
@ApiBearerAuth()
@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

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
  async importSnapshot(@Body() payload: any) {
    return this.backupService.importSnapshot(payload);
  }
}

import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';

@ApiTags('sumulas')
@ApiBearerAuth()
@Controller('sumulas')
export class SumulasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('templates')
  @ApiOperation({ summary: 'Listar templates de súmula salvos no banco' })
  async listTemplates() {
    return this.prisma.sumulaTemplate.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  @Roles(UserRole.ORGANIZER)
  @Post('templates')
  @ApiOperation({ summary: 'Criar ou atualizar template de súmula no banco' })
  async upsertTemplate(
    @Body()
    body: {
      id: string;
      name: string;
      type?: string;
      workoutType?: string;
      gameId?: string | null;
      categoryId?: string | null;
      workoutId?: string | null;
      htmlContent: string;
      isDefault?: boolean;
    },
  ) {
    return this.prisma.sumulaTemplate.upsert({
      where: { id: body.id },
      update: {
        name: body.name,
        type: body.type || 'crossfit',
        workoutType: body.workoutType || 'for_time',
        gameId: body.gameId || null,
        categoryId: body.categoryId || null,
        workoutId: body.workoutId || null,
        htmlContent: body.htmlContent,
        isDefault: Boolean(body.isDefault),
      },
      create: {
        id: body.id,
        name: body.name,
        type: body.type || 'crossfit',
        workoutType: body.workoutType || 'for_time',
        gameId: body.gameId || null,
        categoryId: body.categoryId || null,
        workoutId: body.workoutId || null,
        htmlContent: body.htmlContent,
        isDefault: Boolean(body.isDefault),
      },
    });
  }

  @Roles(UserRole.ORGANIZER)
  @Delete('templates/:id')
  @ApiOperation({ summary: 'Remover template de súmula do banco' })
  async deleteTemplate(@Param('id') id: string) {
    await this.prisma.sumulaTemplate.deleteMany({ where: { id } });
    return { success: true };
  }
}

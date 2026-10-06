import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { AthletesService } from './athletes.service';

@ApiTags('athletes')
@ApiBearerAuth()
@Roles(UserRole.ATHLETE)
@Controller('athletes')
export class AthletesController {
  constructor(private readonly athletesService: AthletesService) {}

  @Get('lookup')
  @ApiOperation({ summary: 'Confere se um CPF tem cadastro de atleta (devolve só primeiro nome e CPF mascarado)' })
  async lookup(@Query('cpf') cpf?: string) {
    return this.athletesService.lookupByCpf(cpf);
  }
}

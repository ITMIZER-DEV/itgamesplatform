import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { AdminAthleteDto } from './admin-create-registration.dto';

export class SubstituteAthleteDto {
  @ApiProperty({ description: 'Código posicional do atleta a ser substituído na equipe (1, 2, 3...)' })
  @IsNumber()
  @IsNotEmpty()
  athleteCode: number;

  @ApiProperty({ description: 'Dados do novo atleta substituto', type: AdminAthleteDto })
  @ValidateNested()
  @Type(() => AdminAthleteDto)
  newAthlete: AdminAthleteDto;

  @ApiPropertyOptional({ description: 'Motivo da substituição (lesão, desistência, acerto cadastral, etc.)' })
  @IsString()
  @IsOptional()
  reason?: string;
}


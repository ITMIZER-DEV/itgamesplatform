import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreateScoreDto {
  @ApiProperty({ description: 'ID do Evento / WOD' })
  @IsNumber()
  idEvent: number;

  @ApiProperty({ description: 'Código do Game (ex: CPCF26)' })
  @IsString()
  @IsNotEmpty()
  game: string;

  @ApiProperty({ description: 'ID da Categoria' })
  @IsNumber()
  category: number;

  @ApiProperty({ description: 'Código do Time / Atleta' })
  @IsNumber()
  codeTeam: number;

  @ApiPropertyOptional({ description: 'Tempo da Prova (ex: 06:14.2)' })
  @IsOptional()
  @IsString()
  time?: string;

  @ApiPropertyOptional({ description: 'Carga Máxima Validada (KG)' })
  @IsOptional()
  @IsString()
  weight?: string;

  @ApiPropertyOptional({ description: 'Total de Repetições' })
  @IsOptional()
  @IsString()
  reps?: string;

  @ApiProperty({ description: 'Nome do Árbitro de Campo' })
  @IsString()
  judge: string;

  @ApiPropertyOptional({ description: 'Foto da Súmula de Papel (Base64 ou URL)' })
  @IsOptional()
  @IsString()
  photo?: string;

  @ApiPropertyOptional({ description: 'Tempo de Tie-Break' })
  @IsOptional()
  @IsString()
  tieBreakTime?: string;

  @ApiPropertyOptional({ description: 'Penalidades em Segundos' })
  @IsOptional()
  @IsNumber()
  penaltySeconds?: number;

  @ApiPropertyOptional({ description: 'Indica se foi W.O.' })
  @IsOptional()
  @IsBoolean()
  isWO?: boolean;

  @ApiPropertyOptional({ description: 'Motivo / Justificativa para log de auditoria' })
  @IsOptional()
  @IsString()
  auditReason?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsBoolean } from 'class-validator';

export class MigrateCategoryDto {
  @ApiProperty({ description: 'Código numérico da categoria de destino' })
  @IsNumber()
  @IsNotEmpty()
  targetCategoryId: number;

  @ApiPropertyOptional({ description: 'Motivo da migração para auditoria e histórico' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ description: 'Ignorar limite de vagas da categoria destino (Super Admin / Override Governança)' })
  @IsBoolean()
  @IsOptional()
  overrideLimit?: boolean;
}


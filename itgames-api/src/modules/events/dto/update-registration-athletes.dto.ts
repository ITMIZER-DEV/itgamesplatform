import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class UpdateAthleteItemDto {
  @ApiProperty({ description: 'Código de ordem do atleta no time (1, 2, ...)', example: 1 })
  @IsNumber()
  code: number;

  @ApiPropertyOptional({ description: 'Nome completo do atleta', example: 'Carlos Henrique Silva' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'E-mail do atleta', example: 'carlos@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Telefone ou WhatsApp', example: '(11) 98765-4321' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'Gênero (M ou F)', example: 'M' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: 'CPF do atleta (com ou sem pontuação)', example: '123.456.789-00' })
  @IsOptional()
  @IsString()
  cpf?: string;

  @ApiPropertyOptional({ description: 'Data de nascimento (YYYY-MM-DD)', example: '1995-04-20' })
  @IsOptional()
  birthDate?: string | Date | null;

  @ApiPropertyOptional({ description: 'Tamanho da camiseta (PP, P, M, G, GG, XG, XGG)', example: 'G' })
  @IsOptional()
  @IsString()
  tshirtSize?: string;

  @ApiPropertyOptional({ description: 'Nome da Box, Ginásio ou CT filiado', example: 'CrossFit Moema' })
  @IsOptional()
  @IsString()
  boxOrAffiliate?: string;
}

export class UpdateRegistrationAthletesDto {
  @ApiPropertyOptional({ description: 'Nome da equipe / competidor', example: 'Titans Moema RX' })
  @IsOptional()
  @IsString()
  teamName?: string;

  @ApiProperty({ description: 'Lista de atletas da inscrição para atualização', type: [UpdateAthleteItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAthleteItemDto)
  athletes: UpdateAthleteItemDto[];
}

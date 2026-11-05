import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class AdminAthleteDto {
  @ApiProperty({ description: 'Nome completo do atleta' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'CPF do atleta' })
  @IsString()
  @IsOptional()
  cpf?: string;

  @ApiPropertyOptional({ description: 'E-mail do atleta' })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Telefone de contato' })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({ description: 'Gênero (M ou F)' })
  @IsString()
  @IsNotEmpty()
  gender: string;

  @ApiPropertyOptional({ description: 'Data de nascimento (YYYY-MM-DD)' })
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional({ description: 'Tamanho da camiseta do kit (PP, P, M, G, GG, XG, XGG)' })
  @IsString()
  @IsOptional()
  tshirtSize?: string;

  @ApiPropertyOptional({ description: 'Box ou Centro de Treinamento' })
  @IsString()
  @IsOptional()
  boxOrGym?: string;
}

export class AdminCreateRegistrationDto {
  @ApiProperty({ description: 'ID numérico da categoria' })
  @IsNumber()
  categoryId: number;

  @ApiProperty({ description: 'Nome da equipe ou competidor' })
  @IsString()
  @IsNotEmpty()
  teamName: string;

  @ApiPropertyOptional({ description: 'Valor pago ou cobrado' })
  @IsNumber()
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({ description: 'Status inicial do pagamento (paid, pending, free)' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ description: 'Lista de atletas da equipe', type: [AdminAthleteDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminAthleteDto)
  athletes: AdminAthleteDto[];
}


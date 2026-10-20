import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ClaimScreenDto {
  @IsString()
  code: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Informe um nome para o telão' })
  @MaxLength(60)
  name: string;

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  gameCodes: string[];

  // Validados no serviço (mensagens em português; rotateSeconds é convertido para número lá).
  @IsOptional()
  mode?: unknown;

  @IsOptional()
  rotateSeconds?: unknown;
}

export class UpdateScreenDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Informe um nome para o telão' })
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  gameCodes?: string[];

  @IsOptional()
  mode?: unknown;

  @IsOptional()
  rotateSeconds?: unknown;
}

export class FreezeScreenDto {
  @IsOptional()
  text?: unknown;
}

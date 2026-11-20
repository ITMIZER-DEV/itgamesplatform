import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { HeatCallLane } from '../screen-message';

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

  @IsOptional()
  @IsString()
  gameCode?: string;

  @IsOptional()
  @IsArray()
  categoryIds?: number[];
}

export class UnfreezeScreenDto {
  @IsOptional()
  @IsString()
  gameCode?: string;

  @IsOptional()
  @IsArray()
  categoryIds?: number[];
}

export class ScreenSpotlightDto {
  @IsOptional()
  @IsString()
  screenId?: string;

  @IsString()
  @IsIn(['heat_call', 'podium'])
  kind: 'heat_call' | 'podium';

  @IsString()
  @IsNotEmpty()
  gameCode: string;

  @IsOptional()
  @IsNumber()
  categoryId?: number;

  @IsOptional()
  @IsNumber()
  workoutCode?: number;

  @IsOptional()
  @IsNumber()
  heatNumber?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  message?: string;

  @IsOptional()
  @IsArray()
  lanes?: HeatCallLane[];

  @IsOptional()
  @IsNumber()
  revealStep?: number;

  @IsOptional()
  @IsBoolean()
  autoAdvance?: boolean;
}

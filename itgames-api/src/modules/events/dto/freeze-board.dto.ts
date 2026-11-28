import { IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class FreezeBoardDto {
  @IsBoolean()
  frozen: boolean;

  /** Sem categorias: congela/libera o campeonato inteiro. Com categorias: só elas. */
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  categoryIds?: number[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  text?: string;
}

import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMailTemplateDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsString()
  @IsNotEmpty({ message: 'O assunto não pode ficar vazio' })
  @MaxLength(200)
  subject: string;

  @IsString()
  @IsNotEmpty({ message: 'O corpo não pode ficar vazio' })
  @MaxLength(5000)
  body: string;
}

export class PreviewMailTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;
}

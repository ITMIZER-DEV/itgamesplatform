import { IsOptional } from 'class-validator';

export class RevertOfficialDto {
  // Validado no serviço (parseRevertReason) para devolver a mensagem em português.
  @IsOptional()
  reason?: unknown;
}

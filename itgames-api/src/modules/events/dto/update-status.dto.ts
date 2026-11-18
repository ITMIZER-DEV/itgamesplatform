import { IsIn } from 'class-validator';

export const GAME_STATUSES = ['live', 'draft', 'blocked', 'frozen'] as const;

export class UpdateStatusDto {
  @IsIn(GAME_STATUSES, { message: 'Status inválido. Use live, draft, blocked ou frozen' })
  status: string;
}

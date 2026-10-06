import { IsBoolean } from 'class-validator';

export class SetOrganizerActiveDto {
  @IsBoolean()
  active: boolean;
}

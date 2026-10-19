import { BadRequestException } from '@nestjs/common';
import { parsePointsTable, parseTiebreak } from './rules';

export interface GameScoringInput {
  scoringMode?: string | null;
  tiebreak?: string | null;
  pointsTable?: unknown;
}

export interface GameScoringPatch {
  scoringMode?: string | null;
  tiebreak?: string | null;
  pointsTable?: number[] | null;
  // mantido igual a (scoringMode === 'rank_sum') sempre que scoringMode vier
  isLowestPointsBetter?: boolean;
}

const MODES = ['points_table', 'rank_sum', 'total_time'];

/**
 * Valida e normaliza a regra de pontuação enviada no campeonato.
 * Campos ausentes (undefined) são ignorados; null limpa o valor (volta ao padrão).
 */
export function normalizeGameScoring(input: GameScoringInput): GameScoringPatch {
  const patch: GameScoringPatch = {};

  if (input.scoringMode !== undefined) {
    if (input.scoringMode === null) {
      patch.scoringMode = null;
    } else {
      if (typeof input.scoringMode !== 'string' || !MODES.includes(input.scoringMode)) {
        throw new BadRequestException(
          'Modo de pontuação inválido. Use points_table, rank_sum ou total_time',
        );
      }
      patch.scoringMode = input.scoringMode;
      patch.isLowestPointsBetter = input.scoringMode === 'rank_sum';
    }
  }

  if (input.tiebreak !== undefined) {
    if (input.tiebreak === null) {
      patch.tiebreak = null;
    } else {
      const tb = parseTiebreak(input.tiebreak);
      if (!tb) {
        throw new BadRequestException(
          'Critério de desempate inválido. Use last_workout, most_wins ou split:<nome do parcial>',
        );
      }
      patch.tiebreak = tb;
    }
  }

  if (input.pointsTable !== undefined) {
    if (input.pointsTable === null) {
      patch.pointsTable = null;
    } else {
      const table = parsePointsTable(input.pointsTable);
      if (!table) {
        throw new BadRequestException(
          'Tabela de pontos inválida. Informe de 1 a 200 números maiores ou iguais a zero',
        );
      }
      patch.pointsTable = table;
    }
  }

  return patch;
}

const BOARD_FIELDS = ['scoringMode', 'tiebreak', 'pointsTable', 'eventType', 'isLowestPointsBetter'];

/** O patch do campeonato traz algo que muda a classificação (regra, tabela, desempate ou tipo)? */
export function affectsBoard(patch: Record<string, unknown>): boolean {
  return BOARD_FIELDS.some((f) => patch[f] !== undefined);
}

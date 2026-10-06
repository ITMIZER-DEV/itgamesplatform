import { Heat, TeamRegistration, LeaderboardRank } from '@/types';

export interface GenerateHeatsOptions {
  gameId: string;
  workoutId: string;
  categoryId: string;
  totalLanes: number; // Ex: 10 raias
  startHour: string; // Ex: "09:00"
  intervalMinutes: number; // Ex: 15 minutos entre baterias
  teams: TeamRegistration[];
  // Se true, coloca os atletas com melhores colocações nas últimas baterias e raias centrais (Seeding de Final)
  isFinalSeeding?: boolean;
  currentLeaderboard?: LeaderboardRank[];
}

export function generateHeatsAndLanes(options: GenerateHeatsOptions): Heat[] {
  const {
    gameId,
    workoutId,
    categoryId,
    totalLanes,
    startHour,
    intervalMinutes,
    teams,
    isFinalSeeding,
    currentLeaderboard
  } = options;

  if (!teams || teams.length === 0) return [];

  // Cria cópia ordenada dos times
  let orderedTeams = [...teams];

  if (isFinalSeeding && currentLeaderboard && currentLeaderboard.length > 0) {
    // Ordenar pelo rank do Leaderboard (piores colocados primeiro para que os líderes fiquem na última bateria)
    orderedTeams.sort((a, b) => {
      const rankA = currentLeaderboard.find(l => l.registrationId === a.id)?.rank || 999;
      const rankB = currentLeaderboard.find(l => l.registrationId === b.id)?.rank || 999;
      return rankB - rankA; // Piores primeiro -> Melhores por último (na bateria principal)
    });
  }

  // Divisão em baterias com base na quantidade de raias
  const totalHeats = Math.ceil(orderedTeams.length / totalLanes);
  const heats: Heat[] = [];

  // Função auxiliar para calcular horário da bateria
  const [baseH, baseM] = startHour.split(':').map(Number);

  for (let h = 0; h < totalHeats; h++) {
    const heatNumber = h + 1;
    const startIndex = h * totalLanes;
    const heatTeams = orderedTeams.slice(startIndex, startIndex + totalLanes);

    // Calcular horário de início
    const totalAddedMinutes = h * intervalMinutes;
    const date = new Date();
    date.setHours(baseH || 9, baseM || 0, 0, 0);
    date.setMinutes(date.getMinutes() + totalAddedMinutes);
    const formattedStartTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

    // Distribuição nas raias
    // Se for Seeding de Final da última bateria, distribui em raias centrais (Ex: em 10 raias: 5, 6, 4, 7, 3, 8, 2, 9, 1, 10)
    let laneOrder: number[] = [];
    if (isFinalSeeding && heatNumber === totalHeats) {
      laneOrder = getCenterLanesOrder(totalLanes);
    } else {
      laneOrder = Array.from({ length: totalLanes }, (_, i) => i + 1);
    }

    const laneAssignments = heatTeams.map((team, idx) => ({
      lane: laneOrder[idx] || (idx + 1),
      registrationId: team.id,
      teamName: team.teamName,
      registerNumber: team.registerNumber,
      athletes: team.athletes.map(a => a.name)
    }));

    // Ordenar as raias para visualização crescente
    laneAssignments.sort((a, b) => a.lane - b.lane);

    heats.push({
      id: `heat_${workoutId}_${heatNumber}`,
      gameId,
      workoutId,
      categoryId,
      heatNumber,
      startTime: formattedStartTime,
      status: 'scheduled',
      laneAssignments
    });
  }

  return heats;
}

/**
 * Retorna a ordem das raias dando preferência para o centro da arena
 * Exemplo para 10 raias: [5, 6, 4, 7, 3, 8, 2, 9, 1, 10]
 */
function getCenterLanesOrder(totalLanes: number): number[] {
  const center = Math.ceil(totalLanes / 2);
  const result: number[] = [];
  let left = center;
  let right = center + 1;

  while (left >= 1 || right <= totalLanes) {
    if (left >= 1) result.push(left--);
    if (right <= totalLanes) result.push(right++);
  }

  return result;
}

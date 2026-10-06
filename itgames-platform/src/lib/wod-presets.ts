import { WorkoutType, EventType, HyroxStation } from '@/types';

export interface WodPreset {
  id: string;
  name: string;
  eventType: EventType;
  type: WorkoutType;
  defaultTitle: string;
  defaultTimeCapMinutes: number;
  description: string;
  standards: string[];
  suggestedSumulaTemplateId: string;
  hyroxStations?: HyroxStation[];
}

export const OFFICIAL_WOD_PRESETS: WodPreset[] = [
  // 1. CROSSFIT - FOR TIME
  {
    id: 'preset_cf_for_time',
    name: 'CrossFit • For Time (Clássico por Tempo)',
    eventType: 'crossfit',
    type: 'for_time',
    defaultTitle: 'WOD 1 - Rapid Fire',
    defaultTimeCapMinutes: 12,
    description: '3 Rounds For Time:\n• 21 Cal Echo Bike / Remo\n• 15 Dumbbell Snatches (22.5kg / 15kg)\n• 9 Bar Muscle-ups / Pull-ups',
    standards: [
      'Extensão completa de quadril e joelho no topo do snatch.',
      'Troca do halter obrigatória abaixo da linha dos olhos.',
      'Queixo nitidamente acima da barra no pull-up / extensão no topo do muscle-up.'
    ],
    suggestedSumulaTemplateId: 'crossfit-for-time'
  },

  // 2. CROSSFIT - AMRAP
  {
    id: 'preset_cf_amrap',
    name: 'CrossFit • AMRAP (Maior Nº de Reps)',
    eventType: 'crossfit',
    type: 'amrap',
    defaultTitle: 'WOD 2 - The Grinder (AMRAP)',
    defaultTimeCapMinutes: 10,
    description: 'AMRAP em 10 Minutos:\n• 12 Toes-to-Bar\n• 10 Box Jump Overs (24/20 pol)\n• 8 Wall Balls (9kg / 6kg)',
    standards: [
      'Ambos os pés tocam simultaneamente a barra no toes-to-bar.',
      'Pulo com ambos os pés na caixa.',
      'Quebra paralela do agachamento antes do arremesso da bola no alvo.'
    ],
    suggestedSumulaTemplateId: 'crossfit-for-time'
  },

  // 3. CROSSFIT - MAX LOAD / COMPLEX
  {
    id: 'preset_cf_max_load',
    name: 'CrossFit • Carga Máxima (1RM & Complex)',
    eventType: 'crossfit',
    type: 'max_load',
    defaultTitle: 'WOD 3 - Heavy Metal Complex',
    defaultTimeCapMinutes: 6,
    description: 'Janela de 6 minutos para encontrar a carga máxima do Complex:\n1 Clean + 1 Hang Clean + 1 Shoulder-to-Overhead',
    standards: [
      'A barra não pode tocar o chão após o primeiro Clean.',
      'Extensão completa e cotovelos travados no topo do Shoulder-to-Overhead.',
      'O atleta tem 3 tentativas oficiais declaradas para homologação.'
    ],
    suggestedSumulaTemplateId: 'crossfit-max-load'
  },

  // 4. HYROX - 8 STATIONS OFFICIAL RACE
  {
    id: 'preset_hyrox_official',
    name: 'HYROX • Corrida Oficial das 8 Estações',
    eventType: 'hyrox',
    type: 'hyrox_standard',
    defaultTitle: 'HYROX Main Championship Race',
    defaultTimeCapMinutes: 90,
    description: 'Formato Oficial Mundial HYROX:\n8x 1000m de Corrida intercalados por 8 Estações Funcionais com entrada e saída via Roxzone.',
    standards: [
      'Atleta deve cumprir rigorosamente a distância ou repetições de cada estação.',
      'Penalidade de tempo automática (+3 min) para falta de distância não completada.',
      'Conferência obrigatória do fiscal em cada estação.'
    ],
    suggestedSumulaTemplateId: 'hyrox-official-splits',
    hyroxStations: [
      { id: 1, name: 'SkiErg', distanceOrReps: '1000m' },
      { id: 2, name: 'Sled Push', distanceOrReps: '50m (152kg / 102kg)' },
      { id: 3, name: 'Sled Pull', distanceOrReps: '50m (103kg / 78kg)' },
      { id: 4, name: 'Burpee Broad Jumps', distanceOrReps: '80m' },
      { id: 5, name: 'Rowing', distanceOrReps: '1000m' },
      { id: 6, name: 'Farmers Carry', distanceOrReps: '200m (2x 24kg / 2x 16kg)' },
      { id: 7, name: 'Sandbag Lunges', distanceOrReps: '100m (20kg / 10kg)' },
      { id: 8, name: 'Wall Balls', distanceOrReps: '100 reps (6kg / 4kg)' }
    ]
  },

  // 5. HYROX - DOUBLES RELAY
  {
    id: 'preset_hyrox_doubles',
    name: 'HYROX • Duplas / Revezamento',
    eventType: 'hyrox',
    type: 'hyrox_relay',
    defaultTitle: 'HYROX Doubles Challenge',
    defaultTimeCapMinutes: 80,
    description: 'Ambos os atletas correm os 1000m juntos em cada etapa e dividem o trabalho das 8 estações livremente.',
    standards: [
      'Correm os 8km lado a lado.',
      'Trabalho alternado na estação com toque de mão para revezamento.'
    ],
    suggestedSumulaTemplateId: 'hyrox-official-splits'
  }
];

// Descanso entre provas A/B lido da descrição da prova B (Summer Games: WOD 1 = 1', WOD 4 = 4').
import { parseRestMinutes } from '../../src/modules/heats/heats.service';

describe('parseRestMinutes', () => {
  it('WOD 1-B: "Rest 1\' + 5 blocos de 3\'" → 1', () => {
    expect(parseRestMinutes("Rest 1' + 5 blocos de 3'. Cargas Fem 25kg")).toBe(1);
  });
  it('WOD 4-B: "Após 4\' de Rest — AMRAP 4\'" → 4', () => {
    expect(parseRestMinutes("Após 4' de Rest — AMRAP 4': 6 Shuttle Runs")).toBe(4);
  });
  it('outros formatos: "Rest: 2 min", "3 min de descanso"', () => {
    expect(parseRestMinutes('Rest: 2 min entre blocos')).toBe(2);
    expect(parseRestMinutes('3 minutos de descanso')).toBe(3);
  });
  it('sem descanso na descrição usa o fallback', () => {
    expect(parseRestMinutes('AMRAP 4\': 6 Shuttle Runs', 1)).toBe(1);
    expect(parseRestMinutes(null, 2)).toBe(2);
  });
});

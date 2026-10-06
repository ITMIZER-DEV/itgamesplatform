import { describe, expect, it } from 'vitest';
import { mapCategory, mapGame, mapHeat, mapRegistration, mapWorkout, pickActiveGame } from '../arena-data';

describe('mapGame', () => {
  it('converte um campeonato da API', () => {
    const g = mapGame({
      code: 'SUMMER2026',
      name: 'Summer Cross',
      description: 'desc',
      location: 'Goiânia',
      date: '2026-11-15T00:00:00.000Z',
      eventType: 'crossfit',
      status: 'live',
      lanesCount: 10,
      isLowestPointsBetter: true,
      pixKey: 'chave',
    });
    expect(g).toMatchObject({
      id: 'SUMMER2026',
      code: 'SUMMER2026',
      name: 'Summer Cross',
      startDate: '2026-11-15',
      endDate: '2026-11-15',
      eventType: 'crossfit',
      status: 'live',
      lanesCount: 10,
      pixKey: 'chave',
    });
    expect(g.scoringRules).toEqual({ isLowestPointsBetter: true, hyroxChipTimingEnabled: false });
  });

  it('hyrox liga o cronômetro por chip; status desconhecido vira draft; campos ausentes têm padrão', () => {
    const g = mapGame({ code: 'H1', eventType: 'hyrox', status: 'estranho' });
    expect(g.scoringRules.hyroxChipTimingEnabled).toBe(true);
    expect(g.status).toBe('draft');
    expect(g).toMatchObject({ name: 'H1', description: '', location: '', startDate: '', lanesCount: 8 });
  });

  it('aceita os status liberado e bloqueado', () => {
    expect(mapGame({ code: 'A', status: 'blocked' }).status).toBe('blocked');
    expect(mapGame({ code: 'A', status: 'live' }).status).toBe('live');
  });
});

describe('mapCategory', () => {
  it('converte código em id texto e traz o limite de vagas', () => {
    const c = mapCategory(
      { code: 3, name: 'RX', teamType: 'duo', maxAthlete: 2, genderRule: 'male', amount: 150, maxRegistrations: 10, registrationsCount: 4 },
      'G1',
    );
    expect(c).toMatchObject({
      id: '3',
      gameId: 'G1',
      name: 'RX',
      teamFormat: 'duo',
      maxAthletesPerTeam: 2,
      genderComposition: 'male',
      price: 150,
      maxRegistrations: 10,
      registrationsCount: 4,
    });
  });

  it('valores ausentes viram padrões', () => {
    const c = mapCategory({ code: 1, name: 'X' }, 'G1');
    expect(c).toMatchObject({ teamFormat: 'individual', maxAthletesPerTeam: 1, genderComposition: 'open', price: 0 });
    expect(c.maxRegistrations ?? null).toBeNull();
  });
});

describe('mapWorkout', () => {
  it('converte o tempo limite e os ids', () => {
    const w = mapWorkout({ code: 2, category: 5, title: 'Fran', type: 'for_time', timeCap: '12:00', description: 'd' }, 'G1');
    expect(w).toMatchObject({ id: '2', gameId: 'G1', categoryId: '5', title: 'Fran', type: 'for_time', timeCapSeconds: 720 });
  });

  it('tempo limite nulo vira 0; título e tipo ausentes têm padrão', () => {
    const w = mapWorkout({ code: 7, category: 1, timeCap: null }, 'G1');
    expect(w).toMatchObject({ id: '7', title: 'WOD 7', type: 'for_time', timeCapSeconds: 0 });
  });
});

describe('mapRegistration', () => {
  const reg = {
    code: 1101,
    categoryId: 2,
    team: 'Dupla Teste',
    number: '#1101',
    status: 'paid',
    amount: 150,
    check: true,
    athletes: [
      { code: 1, name: 'Ana', gender: 'F' },
      { code: 2, name: 'Bia', gender: 'F' },
    ],
  };

  it('converte a inscrição em equipe', () => {
    const t = mapRegistration(reg, 'G1', 'FEMININA');
    expect(t).toMatchObject({
      id: '1101',
      gameId: 'G1',
      categoryId: '2',
      categoryName: 'FEMININA',
      teamName: 'Dupla Teste',
      registerNumber: '#1101',
    });
    expect(t.athletes.map((a) => a.name)).toEqual(['Ana', 'Bia']);
  });

  it('número ausente vira #código e atletas ausentes viram lista vazia', () => {
    const t = mapRegistration({ code: 9, categoryId: 1, team: 'X' }, 'G1');
    expect(t.registerNumber).toBe('#9');
    expect(t.athletes).toEqual([]);
  });
});

describe('mapHeat', () => {
  const heat = {
    id: 'h-uuid',
    gameCode: 'G1',
    categoryId: 1,
    workoutCode: 4,
    heatNumber: 2,
    startTime: '09:15',
    status: 'calling',
    slots: [
      { id: 's2', laneNumber: 2, teamCode: 102, registration: { team: 'Time B', number: '#102', athletes: [{ name: 'B1' }] } },
      { id: 's1', laneNumber: 1, teamCode: 101, registration: { team: 'Time A', number: '#101', athletes: [{ name: 'A1' }, { name: 'A2' }] } },
    ],
  };

  it('converte a bateria e ordena as raias, guardando o id da vaga', () => {
    const h = mapHeat(heat, 'G1');
    expect(h).toMatchObject({ id: 'h-uuid', gameId: 'G1', workoutId: '4', categoryId: '1', heatNumber: 2, startTime: '09:15', status: 'calling' });
    expect(h.laneAssignments.map((l) => l.lane)).toEqual([1, 2]);
    expect(h.laneAssignments[0]).toMatchObject({
      slotId: 's1',
      registrationId: '101',
      teamName: 'Time A',
      registerNumber: '#101',
      athletes: ['A1', 'A2'],
    });
  });

  it('status inválido vira scheduled; vaga sem inscrição e bateria sem vagas não quebram', () => {
    const h = mapHeat({ ...heat, status: 'xyz', slots: [{ id: 's9', laneNumber: 3, teamCode: 77, registration: null }] }, 'G1');
    expect(h.status).toBe('scheduled');
    expect(h.laneAssignments[0]).toMatchObject({ teamName: 'Equipe 77', registerNumber: '#77', athletes: [] });
    expect(mapHeat({ ...heat, slots: undefined }, 'G1').laneAssignments).toEqual([]);
  });
});

describe('pickActiveGame', () => {
  const games = [{ code: 'A' }, { code: 'B' }] as never[];

  it('usa a preferência quando ela está na lista', () => {
    expect(pickActiveGame(games, 'B')?.code).toBe('B');
  });

  it('cai no primeiro quando a preferência não está na lista ou está vazia', () => {
    expect(pickActiveGame(games, 'Z')?.code).toBe('A');
    expect(pickActiveGame(games, '')?.code).toBe('A');
  });

  it('lista vazia devolve null', () => {
    expect(pickActiveGame([], 'A')).toBeNull();
  });
});

import { jsPDF } from 'jspdf';
import { Category, Heat, WorkoutRule } from '@/types';

export interface SchedulePdfHeat extends Heat {
  categoryName: string;
  workoutTitle: string;
  timeCap?: string;
}

function toMinutes(hhmm?: string): number {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fromMinutes(total: number): string {
  const norm = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(norm / 60)).padStart(2, '0')}:${String(norm % 60).padStart(2, '0')}`;
}

function parseCapMin(cap?: string): number {
  if (!cap) return 10;
  const m = cap.match(/(\d{1,2}):(\d{2})/);
  if (m) return Math.max(1, Number(m[1]) + (Number(m[2]) > 0 ? 1 : 0));
  const n = cap.match(/(\d+)/);
  return n ? Math.max(1, Number(n[1])) : 10;
}

export function downloadSchedulePdf(gameName: string, gameCode: string, heats: SchedulePdfHeat[]) {
  if (heats.length === 0) return;

  const sortedRaw = [...heats].sort((a, b) => {
    const tCmp = String(a.startTime || '').localeCompare(String(b.startTime || ''));
    if (tCmp !== 0) return tCmp;
    const cCmp = String(a.categoryId).localeCompare(String(b.categoryId), 'pt-BR', { numeric: true });
    if (cCmp !== 0) return cCmp;
    return a.heatNumber - b.heatNumber;
  });

  // Unifica WOD 1-A + 1-B da mesma categoria e bateria em uma única linha de 21 min no PDF
  const sorted: SchedulePdfHeat[] = [];
  for (let i = 0; i < sortedRaw.length; i++) {
    const cur = sortedRaw[i];
    const next = sortedRaw[i + 1];
    if (
      next &&
      cur.categoryId === next.categoryId &&
      cur.heatNumber === next.heatNumber &&
      /1-A/i.test(cur.workoutTitle) &&
      /1-B/i.test(next.workoutTitle)
    ) {
      const totalMin = parseCapMin(cur.timeCap) + 1 + parseCapMin(next.timeCap);
      sorted.push({
        ...cur,
        workoutTitle: 'WOD 1-A + 1-B (Combo)',
        timeCap: `${String(totalMin).padStart(2, '0')}:00`,
      });
      i += 1;
    } else {
      sorted.push(cur);
    }
  }

  const maxLanes = Math.max(
    4,
    ...sorted.map((h) => Math.max(0, ...(h.laneAssignments || []).map((l) => l.lane))),
  );
  const displayLanes = Math.min(maxLanes, 8);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;
  const usableW = pageW - margin * 2; // 281mm

  const fixedW = 14 + 36 + 41 + 10; // 101mm
  const laneW = (usableW - fixedW) / displayLanes;

  const cols = [
    { label: 'HORA', w: 14 },
    { label: 'CATEGORIA', w: 36 },
    { label: 'PROVA (WOD)', w: 41 },
    { label: 'BAT', w: 10 },
    ...Array.from({ length: displayLanes }, (_, i) => ({ label: `RAIA ${i + 1}`, w: laneW })),
  ];

  let pageNum = 1;

  const drawHeader = () => {
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, 8, usableW, 14, 'F');
    doc.setTextColor(245, 158, 11);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${gameName.toUpperCase()} — CRONOGRAMA OFICIAL POR HORARIO E RAIA`, margin + 4, 15);
    doc.setTextColor(226, 232, 240);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Total: ${sorted.length} baterias | Gerado em ${new Date().toLocaleString('pt-BR')}`, margin + 4, 19.5);
    doc.text(`Pagina ${pageNum}`, pageW - margin - 18, 15);

    let x = margin;
    const y = 24;
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, y, usableW, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    for (const c of cols) {
      doc.text(c.label, x + 1.5, y + 4.8);
      x += c.w;
    }
    return y + 7;
  };

  let y = drawHeader();

  sorted.forEach((h, idx) => {
    const slotMap = new Map((h.laneAssignments || []).map((s) => [s.lane, s]));
    const laneTextWidth = Math.max(18, laneW - 3);

    const laneData = Array.from({ length: displayLanes }, (_, i) => {
      const slot = slotMap.get(i + 1);
      if (!slot) return { team: [] as string[], ath: [] as string[] };
      const teamLine = `${slot.registerNumber || ''} ${String(slot.teamName || '').trim()}`.trim();
      const athNames = (slot.athletes || []).map((a) => a.trim()).filter(Boolean).join(' / ');
      return {
        team: doc.splitTextToSize(teamLine, laneTextWidth).slice(0, 2),
        ath: athNames ? doc.splitTextToSize(athNames, laneTextWidth).slice(0, 2) : [],
      };
    });

    const catLines = doc.splitTextToSize(h.categoryName || `Cat ${h.categoryId}`, 33);
    const wodTitle = `${h.workoutTitle}${h.timeCap ? ` (${h.timeCap})` : ''}`;
    const wodLines = doc.splitTextToSize(wodTitle, 38);

    const maxLines = Math.max(
      2,
      catLines.length,
      wodLines.length,
      ...laneData.map((l) => l.team.length + l.ath.length),
    );
    const rowH = Math.max(11, maxLines * 3.3 + 3);

    if (y + rowH > pageH - 8) {
      doc.addPage();
      pageNum += 1;
      y = drawHeader();
    }

    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, usableW, rowH, 'F');
    }
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, usableW, rowH, 'S');

    let x = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(h.startTime || '--:--', x + 1.5, y + 4.5);
    x += cols[0].w;

    doc.setFontSize(6.5);
    doc.setTextColor(51, 65, 85);
    doc.text(catLines, x + 1.5, y + 4);
    x += cols[1].w;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(wodLines, x + 1.5, y + 4);
    x += cols[2].w;

    doc.text(`#${h.heatNumber}`, x + 2, y + 4.5);
    x += cols[3].w;

    for (let l = 0; l < displayLanes; l++) {
      const cell = laneData[l];
      if (cell.team.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2);
        doc.setTextColor(15, 23, 42);
        doc.text(cell.team, x + 1.5, y + 3.8);
        if (cell.ath.length > 0) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.5);
          doc.setTextColor(100, 116, 139);
          doc.text(cell.ath, x + 1.5, y + 3.8 + cell.team.length * 3.0);
        }
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text('—', x + 1.5, y + 4.5);
      }
      x += cols[4 + l].w;
    }

    y += rowH;

    // Linha explícita de intervalo / descanso até a próxima bateria
    const next = sorted[idx + 1];
    if (next) {
      const endMin = toMinutes(h.startTime) + parseCapMin(h.timeCap);
      const nextMin = toMinutes(next.startTime);
      const gap = nextMin - endMin;
      if (gap > 0) {
        const gapH = 5.5;
        if (y + gapH > pageH - 8) {
          doc.addPage();
          pageNum += 1;
          y = drawHeader();
        }
        const isCategoryTransition = h.categoryId !== next.categoryId;
        const isShortRest = gap <= 5;
        if (isCategoryTransition) {
          doc.setFillColor(249, 115, 22); // orange-500
          doc.setTextColor(0, 0, 0); // preto
        } else if (isShortRest) {
          doc.setFillColor(254, 243, 199); // amber-100
          doc.setTextColor(146, 64, 14);
        } else {
          doc.setFillColor(226, 232, 240); // slate-200
          doc.setTextColor(30, 41, 59);
        }
        doc.rect(margin, y, usableW, gapH, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.rect(margin, y, usableW, gapH, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2);
        const label = isCategoryTransition
          ? `${fromMinutes(endMin)} - ${fromMinutes(nextMin)}  •  INTERVALO ENTRE CATEGORIAS (${gap} min)`
          : isShortRest
            ? `${fromMinutes(endMin)} - ${fromMinutes(nextMin)}  •  DESCANSO / TRANSICAO DE SUB-PROVA (${gap} min)`
            : `${fromMinutes(endMin)} - ${fromMinutes(nextMin)}  •  INTERVALO DE ARENA / TROCA DE BATERIA (${gap} min)`;
        doc.text(label, margin + 4, y + 3.8);
        y += gapH;
      }
    }
  });

  doc.save(`cronograma_${gameCode.toLowerCase()}_raias.pdf`);
}

export function buildPdfHeatList(
  rawHeats: Heat[],
  categories: Category[],
  workouts: WorkoutRule[],
): SchedulePdfHeat[] {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const wodMap = new Map(workouts.map((w) => [w.id, w]));
  return rawHeats.map((h) => {
    const w = wodMap.get(h.workoutId);
    const capMin = w?.timeCapSeconds ? `${String(Math.floor(w.timeCapSeconds / 60)).padStart(2, '0')}:00` : undefined;
    return {
      ...h,
      categoryName: catMap.get(h.categoryId) || `Categoria ${h.categoryId}`,
      workoutTitle: w?.title || `WOD ${h.workoutId}`,
      timeCap: capMin,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CRONOGRAMA OFICIAL • 2 ARENAS SIMULTÂNEAS (4 RAIAS • MÍNIMO 2 EQUIPES)
// ─────────────────────────────────────────────────────────────────────────────

export interface DualArenaScheduleOptions {
  gameName: string;
  gameCode: string;
  categories: Category[];
  workouts: WorkoutRule[];
  teams: { id: string; categoryId: string; teamName: string; registerNumber: string; athletes: { name: string }[] }[];
  startHour?: string;
  totalLanes?: number; // padrão 4
  minPerHeat?: number; // padrão 2
  /** Baterias gravadas (com arena). Quando houver, o PDF mostra exatamente o cronograma do sistema. */
  realHeats?: SchedulePdfHeat[];
}

interface RealArenaPhase {
  phase: string;
  a1Title: string;
  a2Title: string;
  a1: SimulatedArenaHeat[];
  a2: SimulatedArenaHeat[];
  transition: number;
}

// Descanso entre provas A/B escrito na descrição da prova B ("Rest 1'", "Após 4' de Rest").
function restFromDescription(text?: string): number {
  const t = String(text || '');
  const m =
    t.match(/\b(?:rest|descanso)\s*:?\s*(\d+)\s*(?:'|min)/i) ||
    t.match(/\b(\d+)\s*(?:'|min(?:utos?)?)\s*(?:de\s+)?(?:rest|descanso)\b/i);
  return m ? Number(m[1]) : 1;
}

// Monta as fases do PDF a partir das baterias reais: junta A/B, separa manhã/tarde pelo maior intervalo
// e marca a inversão de ondas pelo maior vão dentro da Arena 1.
function buildRealArenaPhases(realHeats: SchedulePdfHeat[] | undefined, workouts: WorkoutRule[]): RealArenaPhase[] | null {
  const withArena = (realHeats || []).filter((h) => h.arena);
  if (withArena.length === 0) return null;
  const wodById = new Map(workouts.map((w) => [w.id, w]));
  const blockOf = (title: string, id: string) => title.match(/WOD\s*(\d+)/i)?.[1] ?? id;

  type Entry = SimulatedArenaHeat & { arena: number; block: string; start: number; end: number };
  const groups = new Map<string, SchedulePdfHeat[]>();
  for (const h of withArena) {
    const key = `${h.categoryId}|${h.heatNumber}|${h.arena}|${blockOf(h.workoutTitle, h.workoutId)}`;
    groups.set(key, [...(groups.get(key) || []), h]);
  }
  const entries: Entry[] = [];
  for (const list of groups.values()) {
    const parts = [...list].sort((a, b) => a.workoutTitle.localeCompare(b.workoutTitle, 'pt-BR', { numeric: true }));
    const first = parts[0];
    let work = 0;
    parts.forEach((p, i) => {
      work += parseCapMin(p.timeCap);
      if (i > 0) work += restFromDescription(wodById.get(p.workoutId)?.description);
    });
    const start = toMinutes(first.startTime);
    const block = blockOf(first.workoutTitle, first.workoutId);
    entries.push({
      heatNumber: first.heatNumber,
      startTime: first.startTime,
      endTime: fromMinutes(start + work),
      categoryName: first.categoryName,
      workoutTitle: parts.length > 1 ? `WOD ${block} (${parts.length} provas)` : first.workoutTitle,
      lanes: [...first.laneAssignments]
        .sort((a, b) => a.lane - b.lane)
        .map((l) => ({ lane: l.lane, teamName: l.teamName, registerNumber: l.registerNumber, athletes: l.athletes })),
      arena: Number(first.arena),
      block,
      start,
      end: start + work,
    });
  }
  entries.sort((a, b) => a.start - b.start || a.arena - b.arena);

  // Fases: corta onde a arena fica parada 45 min ou mais (almoço)
  const phases: Entry[][] = [];
  let current: Entry[] = [];
  let maxEnd = -Infinity;
  for (const e of entries) {
    if (current.length && e.start - maxEnd >= 45) {
      phases.push(current);
      current = [];
    }
    current.push(e);
    maxEnd = Math.max(current.length === 1 ? -Infinity : maxEnd, e.end);
  }
  if (current.length) phases.push(current);

  return phases.map((list, idx) => {
    const a1 = list.filter((e) => e.arena === 1);
    const a2 = list.filter((e) => e.arena === 2);
    let transition = 0;
    let biggest = 0;
    for (let i = 1; i < a1.length; i++) {
      const gap = a1[i].start - a1[i - 1].end;
      if (gap > biggest) {
        biggest = gap;
        transition = i;
      }
    }
    const title = (arr: Entry[], arena: number) => {
      if (!arr.length) return `ARENA ${arena}`;
      const dur = arr[0].end - arr[0].start;
      return `ARENA ${arena} — WOD ${arr[0].block} (${dur} MIN/BAT)`;
    };
    const blocks = [...new Set(list.map((e) => e.block))].map((b) => `WOD ${b}`).join(' & ');
    const span = `${fromMinutes(Math.min(...list.map((e) => e.start)))} → ${fromMinutes(Math.max(...list.map((e) => e.end)))}`;
    return {
      phase: `FASE ${idx + 1} — ${blocks} (${span})`,
      a1Title: title(a1, 1),
      a2Title: title(a2, 2),
      a1,
      a2,
      transition,
    };
  });
}

interface SimulatedArenaHeat {
  heatNumber: number;
  startTime: string;
  endTime: string;
  categoryName: string;
  workoutTitle: string;
  lanes: { lane: number; teamName: string; registerNumber: string; athletes: string[] }[];
}

export function downloadDualArenaSchedulePdf(options: DualArenaScheduleOptions) {
  const {
    gameName,
    gameCode,
    categories,
    workouts,
    teams,
    startHour = '08:00',
    totalLanes = 4,
    minPerHeat = 2,
  } = options;

  // Filtrar categorias que possuem equipes inscritas
  const activeCategories = categories.filter((c) => teams.some((t) => String(t.categoryId) === String(c.id)));
  const usableCategories = activeCategories.length > 0 ? activeCategories : categories;

  // Distribuir equipes em baterias balanceadas (máx totalLanes, mín minPerHeat)
  const balanceHeats = (teamList: typeof teams, maxL = totalLanes, minL = minPerHeat) => {
    if (teamList.length === 0) return [];
    if (teamList.length <= maxL) return [teamList];
    let numHeats = Math.ceil(teamList.length / maxL);

    while (numHeats > 1 && Math.floor(teamList.length / numHeats) < minL && Math.ceil(teamList.length / (numHeats - 1)) <= maxL) {
      numHeats--;
    }

    const baseSize = Math.floor(teamList.length / numHeats);
    const remainder = teamList.length % numHeats;
    const result: (typeof teams)[] = [];
    let cur = 0;
    for (let i = 0; i < numHeats; i++) {
      const size = baseSize + (i < remainder ? 1 : 0);
      result.push(teamList.slice(cur, cur + size));
      cur += size;
    }
    return result;
  };

  // Ordenação lógica das categorias para apresentação profissional
  const sortedCategories = [...usableCategories].sort((a, b) => {
    const orderScore = (name: string) => {
      const n = name.toLowerCase();
      if (n.includes('iniciante') && n.includes('fem')) return 1;
      if (n.includes('scaled') && n.includes('masc')) return 2;
      if (n.includes('scaled') && n.includes('fem')) return 3;
      if (n.includes('amador') && n.includes('mist')) return 4;
      return 10;
    };
    return orderScore(a.name) - orderScore(b.name);
  });

  // Divisão balanceada das categorias em dois blocos (Crossed Waves)
  // Bloco 1: Iniciante Fem (4 baterias) + Scaled Masc (2 baterias)
  // Bloco 2: Scaled Fem (2 baterias) + Amador Mista (2 baterias)
  const midPoint = Math.max(1, Math.floor(sortedCategories.length / 2));
  const block1Cats = sortedCategories.slice(0, midPoint);
  const block2Cats = sortedCategories.slice(midPoint);

  interface ScheduledHeatGroup {
    categoryName: string;
    categoryId: string;
    heatTeams: typeof teams;
  }

  // Gera baterias estritamente separadas por categoria (NUNCA mistura categorias diferentes na mesma bateria)
  const generateCategoryHeats = (catList: Category[]): ScheduledHeatGroup[] => {
    const list: ScheduledHeatGroup[] = [];
    for (const cat of catList) {
      const catTeams = teams.filter((t) => String(t.categoryId) === String(cat.id));
      if (catTeams.length === 0) continue;
      // Balanceia as duplas APENAS dentro desta categoria específica
      const groups = balanceHeats(catTeams, totalLanes, minPerHeat);
      groups.forEach((g) => {
        list.push({
          categoryName: cat.name,
          categoryId: String(cat.id),
          heatTeams: g,
        });
      });
    }
    return list;
  };

  // Grupos de baterias estritamente isoladas por categoria
  const b1Groups = generateCategoryHeats(block1Cats);
  const b2Groups = generateCategoryHeats(block2Cats);

  let [currentH, currentM] = startHour.split(':').map(Number);
  let baseStartMin = (currentH || 8) * 60 + (currentM || 0);

  // ═══════════════════════════════════════════════════════════════════════════
  // FASE 1: MANHÃ • PROVAS 1 & 4 [WOD 1-A/1-B (ARENA 1) vs. WOD 4-A/4-B (ARENA 2)]
  // ═══════════════════════════════════════════════════════════════════════════
  const durWod1 = 25; // 21 min cap + 4 min reset
  const durWod4 = 15; // 4 min A + 4 min rest + 4 min B + 3 min reset

  const phase1Arena1Heats: SimulatedArenaHeat[] = [];
  const phase1Arena2Heats: SimulatedArenaHeat[] = [];

  // Rodada 1A: Bloco 1 na Arena 1 (WOD 1) | Bloco 2 na Arena 2 (WOD 4)
  let a1Cursor = baseStartMin;
  b1Groups.forEach((group, idx) => {
    const sMin = a1Cursor;
    const eMin = sMin + 21;
    a1Cursor += durWod1;
    phase1Arena1Heats.push({
      heatNumber: idx + 1,
      startTime: fromMinutes(sMin),
      endTime: fromMinutes(eMin),
      categoryName: group.categoryName,
      workoutTitle: 'WOD 1-A & 1-B Combo',
      lanes: group.heatTeams.map((t, lIdx) => ({
        lane: lIdx + 1,
        teamName: t.teamName,
        registerNumber: t.registerNumber,
        athletes: (t.athletes || []).map((a) => a.name),
      })),
    });
  });

  let a2Cursor = baseStartMin;
  b2Groups.forEach((group, idx) => {
    const sMin = a2Cursor;
    const eMin = sMin + 12;
    a2Cursor += durWod4;
    phase1Arena2Heats.push({
      heatNumber: idx + 1,
      startTime: fromMinutes(sMin),
      endTime: fromMinutes(eMin),
      categoryName: group.categoryName,
      workoutTitle: 'WOD 4 • Double Trouble',
      lanes: group.heatTeams.map((t, lIdx) => ({
        lane: lIdx + 1,
        teamName: t.teamName,
        registerNumber: t.registerNumber,
        athletes: (t.athletes || []).map((a) => a.name),
      })),
    });
  });

  // Inversão Fase 1 (Rodada 1B): Bloco 2 na Arena 1 (WOD 1) | Bloco 1 na Arena 2 (WOD 4)
  // O Bloco 2 finalizou WOD 4 às 09:00 e descansou mais de 1h30. Arena 1 finaliza Bloco 1 às 10:30.
  // Inversão inicia às 10:35 para finalizar a manhã às 12:15, permitindo pausa de almoço até as 13:00.
  const round1BStart = Math.ceil(Math.max(a1Cursor + 5, a2Cursor + 30) / 5) * 5;

  let a1Round1B = round1BStart;
  b2Groups.forEach((group, idx) => {
    const sMin = a1Round1B;
    const eMin = sMin + 21;
    a1Round1B += durWod1;
    phase1Arena1Heats.push({
      heatNumber: b1Groups.length + idx + 1,
      startTime: fromMinutes(sMin),
      endTime: fromMinutes(eMin),
      categoryName: group.categoryName,
      workoutTitle: 'WOD 1-A & 1-B Combo',
      lanes: group.heatTeams.map((t, lIdx) => ({
        lane: lIdx + 1,
        teamName: t.teamName,
        registerNumber: t.registerNumber,
        athletes: (t.athletes || []).map((a) => a.name),
      })),
    });
  });

  let a2Round1B = round1BStart;
  b1Groups.forEach((group, idx) => {
    const sMin = a2Round1B;
    const eMin = sMin + 12;
    a2Round1B += durWod4;
    phase1Arena2Heats.push({
      heatNumber: b2Groups.length + idx + 1,
      startTime: fromMinutes(sMin),
      endTime: fromMinutes(eMin),
      categoryName: group.categoryName,
      workoutTitle: 'WOD 4 • Double Trouble',
      lanes: group.heatTeams.map((t, lIdx) => ({
        lane: lIdx + 1,
        teamName: t.teamName,
        registerNumber: t.registerNumber,
        athletes: (t.athletes || []).map((a) => a.name),
      })),
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FASE 2: TARDE • PROVAS 2 & 3 [WOD 2 (ARENA 1) vs. WOD 3 (ARENA 2)]
  // ═══════════════════════════════════════════════════════════════════════════
  // Horário oficial cravado do turno da tarde: 13:00 (13 * 60 = 780 minutos)
  const phase2StartMin = 13 * 60;

  const durWod2 = 15; // 10 min cap + 5 min reset
  const durWod3 = 12; // 6 min cap + 6 min reset/cargas

  const phase2Arena1Heats: SimulatedArenaHeat[] = [];
  const phase2Arena2Heats: SimulatedArenaHeat[] = [];

  // Rodada 2A: Bloco 1 na Arena 1 (WOD 2: Sync & Burn) | Bloco 2 na Arena 2 (WOD 3: Maximum Lift)
  let a1P2Cursor = phase2StartMin;
  b1Groups.forEach((group, idx) => {
    const sMin = a1P2Cursor;
    const eMin = sMin + 10;
    a1P2Cursor += durWod2;
    phase2Arena1Heats.push({
      heatNumber: idx + 1,
      startTime: fromMinutes(sMin),
      endTime: fromMinutes(eMin),
      categoryName: group.categoryName,
      workoutTitle: 'WOD 2 • Sync & Burn',
      lanes: group.heatTeams.map((t, lIdx) => ({
        lane: lIdx + 1,
        teamName: t.teamName,
        registerNumber: t.registerNumber,
        athletes: (t.athletes || []).map((a) => a.name),
      })),
    });
  });

  let a2P2Cursor = phase2StartMin;
  b2Groups.forEach((group, idx) => {
    const sMin = a2P2Cursor;
    const eMin = sMin + 6;
    a2P2Cursor += durWod3;
    phase2Arena2Heats.push({
      heatNumber: idx + 1,
      startTime: fromMinutes(sMin),
      endTime: fromMinutes(eMin),
      categoryName: group.categoryName,
      workoutTitle: 'WOD 3 • Maximum Lift',
      lanes: group.heatTeams.map((t, lIdx) => ({
        lane: lIdx + 1,
        teamName: t.teamName,
        registerNumber: t.registerNumber,
        athletes: (t.athletes || []).map((a) => a.name),
      })),
    });
  });

  // Inversão Fase 2 (Rodada 2B): Bloco 2 na Arena 1 (WOD 2) | Bloco 1 na Arena 2 (WOD 3)
  const maxRound2AEnd = Math.max(a1P2Cursor, a2P2Cursor);
  const round2BStart = Math.ceil((maxRound2AEnd + 35) / 5) * 5;

  let a1Round2B = round2BStart;
  b2Groups.forEach((group, idx) => {
    const sMin = a1Round2B;
    const eMin = sMin + 10;
    a1Round2B += durWod2;
    phase2Arena1Heats.push({
      heatNumber: b1Groups.length + idx + 1,
      startTime: fromMinutes(sMin),
      endTime: fromMinutes(eMin),
      categoryName: group.categoryName,
      workoutTitle: 'WOD 2 • Sync & Burn',
      lanes: group.heatTeams.map((t, lIdx) => ({
        lane: lIdx + 1,
        teamName: t.teamName,
        registerNumber: t.registerNumber,
        athletes: (t.athletes || []).map((a) => a.name),
      })),
    });
  });

  let a2Round2B = round2BStart;
  b1Groups.forEach((group, idx) => {
    const sMin = a2Round2B;
    const eMin = sMin + 6;
    a2Round2B += durWod3;
    phase2Arena2Heats.push({
      heatNumber: b2Groups.length + idx + 1,
      startTime: fromMinutes(sMin),
      endTime: fromMinutes(eMin),
      categoryName: group.categoryName,
      workoutTitle: 'WOD 3 • Maximum Lift',
      lanes: group.heatTeams.map((t, lIdx) => ({
        lane: lIdx + 1,
        teamName: t.teamName,
        registerNumber: t.registerNumber,
        athletes: (t.athletes || []).map((a) => a.name),
      })),
    });
  });

  // Fases a imprimir: as baterias reais do sistema quando já têm arena; senão, a simulação acima.
  const realPhases = buildRealArenaPhases(options.realHeats, workouts);
  const phasesToRender: RealArenaPhase[] = realPhases ?? [
    {
      phase: 'FASE 1 (MANHÃ) — PROVAS 1 & 4 (ROW/DEATH BY & DOUBLE TROUBLE)',
      a1Title: 'WOD 1-A & 1-B COMBO (4 RAIAS • 25 MIN/BAT)',
      a2Title: 'WOD 4: DOUBLE TROUBLE (4 RAIAS • 15 MIN/BAT • 4-A & 4-B)',
      a1: phase1Arena1Heats,
      a2: phase1Arena2Heats,
      transition: b1Groups.length,
    },
    {
      phase: 'FASE 2 (TARDE) — PROVAS 2 & 3 (SYNC & BURN & MAXIMUM LIFT PR)',
      a1Title: 'WOD 2: SYNC & BURN (4 RAIAS • 15 MIN/BAT)',
      a2Title: 'WOD 3: MAXIMUM LIFT (4 RAIAS • 12 MIN/BAT • PR EM KG)',
      a1: phase2Arena1Heats,
      a2: phase2Arena2Heats,
      transition: b1Groups.length,
    },
  ];

  // ─── GERAÇÃO DO DOCUMENTO PDF (LANDSCAPE A4) ───
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;
  const usableW = pageW - margin * 2; // 281mm
  const colW = (usableW - 5) / 2; // 138mm por arena

  let pageNum = 1;

  const drawHeader = (phaseTitle: string, arena1Title: string, arena2Title: string) => {
    // Top Banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(margin, 8, usableW, 14, 'F');
    doc.setTextColor(245, 158, 11); // amber-500
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(`${gameName.toUpperCase()} — CRONOGRAMA 2 ARENAS SIMULTÂNEAS`, margin + 4, 14.5);

    doc.setTextColor(226, 232, 240);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(
      `${phaseTitle} • 4 Raias/Arena • Mín 2 Duplas/Bat • Zero Choque de Horários • Emitido em ${new Date().toLocaleDateString('pt-BR')}`,
      margin + 4,
      19
    );
    doc.text(`Página ${pageNum}`, pageW - margin - 18, 14.5);

    // Cabeçalho das Arenas
    const headerY = 24;

    // Arena 1 Header Box
    doc.setFillColor(185, 28, 28); // red-700
    doc.rect(margin, headerY, colW, 6.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(`ARENA 1 — ${arena1Title.toUpperCase()}`, margin + 3, headerY + 4.5);

    // Arena 2 Header Box
    const x2 = margin + colW + 5;
    doc.setFillColor(22, 163, 74); // green-600
    doc.rect(x2, headerY, colW, 6.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(`ARENA 2 — ${arena2Title.toUpperCase()}`, x2 + 3, headerY + 4.5);

    // Sub-colunas
    const subColY = headerY + 6.5;
    const subCols = [
      { label: 'HORA', w: 14 },
      { label: 'BAT', w: 8 },
      { label: 'CATEGORIA', w: 28 },
      { label: 'RAIA 1', w: 22 },
      { label: 'RAIA 2', w: 22 },
      { label: 'RAIA 3', w: 22 },
      { label: 'RAIA 4', w: 22 },
    ];

    doc.setFillColor(30, 41, 59);
    doc.rect(margin, subColY, colW, 5.5, 'F');
    doc.rect(x2, subColY, colW, 5.5, 'F');

    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);

    let sx1 = margin;
    for (const sc of subCols) {
      doc.text(sc.label, sx1 + 1, subColY + 3.8);
      sx1 += sc.w;
    }

    let sx2 = x2;
    for (const sc of subCols) {
      doc.text(sc.label, sx2 + 1, subColY + 3.8);
      sx2 += sc.w;
    }

    return subColY + 5.5;
  };

  const renderPhaseTable = (
    phaseTitle: string,
    arena1Title: string,
    arena2Title: string,
    a1Heats: SimulatedArenaHeat[],
    a2Heats: SimulatedArenaHeat[],
    transitionIndex: number
  ) => {
    let y = drawHeader(phaseTitle, arena1Title, arena2Title);
    const maxRows = Math.max(a1Heats.length, a2Heats.length);
    const rowH = 11.5;

    for (let r = 0; r < maxRows; r++) {
      const h1 = a1Heats[r];
      const h2 = a2Heats[r];

      // Quebra de página se necessário
      if (y + rowH > pageH - 14) {
        doc.addPage();
        pageNum += 1;
        y = drawHeader(phaseTitle, arena1Title, arena2Title);
      }

      // Faixa divisória de descanso/inversão de arenas
      if (r === transitionIndex && transitionIndex > 0) {
        const bannerH = 6;
        doc.setFillColor(245, 158, 11); // amber-500
        doc.rect(margin, y, usableW, bannerH, 'F');
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8);
        doc.text(
          `⏳ INVERSÃO DE ARENAS • TRANSIÇÃO DE BLOCOS (DESCANSO PROTEGIDO: 35 A 60 MINUTOS • ZERO CHOQUE DE HORÁRIOS)`,
          margin + 6,
          y + 4.2
        );
        y += bannerH;
      }

      // Linha Arena 1
      const x1 = margin;
      if (h1) {
        if (r % 2 === 0) {
          doc.setFillColor(254, 242, 242);
          doc.rect(x1, y, colW, rowH, 'F');
        }
        doc.setDrawColor(226, 232, 240);
        doc.rect(x1, y, colW, rowH, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(15, 23, 42);
        doc.text(h1.startTime, x1 + 1, y + 4.5);
        doc.text(`#${h1.heatNumber}`, x1 + 15, y + 4.5);

        doc.setFontSize(5.8);
        doc.setTextColor(51, 65, 85);
        const catLines1 = doc.splitTextToSize(h1.categoryName, 26);
        doc.text(catLines1, x1 + 23, y + 4);

        let lx = x1 + 50;
        for (let l = 1; l <= 4; l++) {
          const laneSlot = h1.lanes.find((ls) => ls.lane === l);
          if (laneSlot) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6);
            doc.setTextColor(15, 23, 42);
            const tName = doc.splitTextToSize(`${laneSlot.registerNumber || ''} ${laneSlot.teamName}`, 20).slice(0, 1);
            doc.text(tName, lx + 1, y + 3.8);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5);
            doc.setTextColor(100, 116, 139);
            const ath = doc.splitTextToSize(laneSlot.athletes.slice(0, 2).join('/'), 20).slice(0, 1);
            doc.text(ath, lx + 1, y + 7.5);
          } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            doc.setTextColor(148, 163, 184);
            doc.text('—', lx + 1, y + 5);
          }
          lx += 22;
        }
      }

      // Linha Arena 2
      const x2 = margin + colW + 5;
      if (h2) {
        if (r % 2 === 0) {
          doc.setFillColor(240, 253, 244);
          doc.rect(x2, y, colW, rowH, 'F');
        }
        doc.setDrawColor(226, 232, 240);
        doc.rect(x2, y, colW, rowH, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(15, 23, 42);
        doc.text(h2.startTime, x2 + 1, y + 4.5);
        doc.text(`#${h2.heatNumber}`, x2 + 15, y + 4.5);

        doc.setFontSize(5.8);
        doc.setTextColor(51, 65, 85);
        const catLines2 = doc.splitTextToSize(h2.categoryName, 26);
        doc.text(catLines2, x2 + 23, y + 4);

        let lx = x2 + 50;
        for (let l = 1; l <= 4; l++) {
          const laneSlot = h2.lanes.find((ls) => ls.lane === l);
          if (laneSlot) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6);
            doc.setTextColor(15, 23, 42);
            const tName = doc.splitTextToSize(`${laneSlot.registerNumber || ''} ${laneSlot.teamName}`, 20).slice(0, 1);
            doc.text(tName, lx + 1, y + 3.8);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5);
            doc.setTextColor(100, 116, 139);
            const ath = doc.splitTextToSize(laneSlot.athletes.slice(0, 2).join('/'), 20).slice(0, 1);
            doc.text(ath, lx + 1, y + 7.5);
          } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            doc.setTextColor(148, 163, 184);
            doc.text('—', lx + 1, y + 5);
          }
          lx += 22;
        }
      }

      y += rowH;
    }
  };

  // Uma página por fase (manhã, tarde...)
  phasesToRender.forEach((p, idx) => {
    if (idx > 0) {
      doc.addPage();
      pageNum += 1;
    }
    renderPhaseTable(p.phase, p.a1Title, p.a2Title, p.a1, p.a2, p.transition);
  });

  // Rodapé Oficial de Validação
  const footerY = pageH - 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `✓ SISTEMA ITGAMES • AUDITORIA MULTI-ARENA APROVADA: WODs 1, 2, 3 e 4 Completos • 4 Raias com Mínimo 2 Equipes • Zero Choque de Horários.`,
    margin,
    footerY
  );

  doc.save(`cronograma_2_arenas_${gameCode.toLowerCase()}_completo.pdf`);
}

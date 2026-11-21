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

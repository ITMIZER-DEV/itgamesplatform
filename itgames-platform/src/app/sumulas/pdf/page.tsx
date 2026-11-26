'use client';

// Área de PDFs das súmulas: gera o kit completo do dia (um PDF com capa e índice) e um ZIP com um PDF
// por bateria da arena, organizado em pastas por WOD. Tudo é gerado no navegador, sem passar pela impressão.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileArchive, FileText, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { AclGuard } from '@/components/auth/AclGuard';
import { useGames } from '@/lib/use-games';
import { loadSumulaData, SumulaData } from '@/lib/sumula-data';
import { buildDayPlan, PrintItem, PrintSlot, safeFileName, slotFileName, sumulaVarsFor } from '@/lib/sumula-print';
import { replaceSumulaVariables } from '@/lib/sumula-replacer';
import { SUMMER_GAMES_LOGO_BASE64 } from '@/lib/summer-logo-base64';

type Rendered = { data: string; w: number; h: number };
type Job = 'kit' | 'zip';

const A4 = { w: 210, h: 297, margin: 8 };

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function waitImages(el: HTMLElement) {
  const imgs = Array.from(el.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((res) => {
        img.onload = () => res();
        img.onerror = () => res();
      }),
    ),
  );
}

export default function SumulasPdfPage() {
  const { activeGame } = useGames();
  const [data, setData] = useState<SumulaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [blocks, setBlocks] = useState<string[]>([]);
  const [running, setRunning] = useState<Job | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: '' });
  const cancelRef = useRef(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef(new Map<string, Rendered>());

  const gameCode = activeGame?.code || activeGame?.id || '';

  useEffect(() => {
    if (!gameCode) return;
    let alive = true;
    setLoading(true);
    cacheRef.current.clear();
    loadSumulaData(gameCode, activeGame?.name)
      .then((d) => {
        if (!alive) return;
        setData(d);
        const all = buildDayPlan(d).map((s) => s.block);
        setBlocks([...new Set(all)]);
      })
      .catch(() => toast.error('Não foi possível carregar as súmulas do campeonato.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [gameCode, activeGame?.name]);

  const allBlocks = useMemo(() => (data ? [...new Set(buildDayPlan(data).map((s) => s.block))] : []), [data]);
  const plan = useMemo(() => (data ? buildDayPlan({ ...data, blocks }) : []), [data, blocks]);
  const totalSheets = plan.reduce((n, s) => n + s.items.length, 0);

  // Renderiza uma súmula fora da tela e guarda a imagem (o kit e o ZIP reaproveitam)
  const render = async (item: PrintItem): Promise<Rendered> => {
    const cached = cacheRef.current.get(item.key);
    if (cached) return cached;
    const host = hostRef.current!;
    const tmpl = data!.templates.find((t) => t.id === item.templateId);
    const html = replaceSumulaVariables(
      tmpl?.htmlContent || '',
      sumulaVarsFor(item, { name: activeGame?.name, code: gameCode }, SUMMER_GAMES_LOGO_BASE64, window.location.origin),
    );
    host.innerHTML = `<div style="width: 794px; background: #ffffff;">${html}</div>`;
    const target = host.firstElementChild as HTMLElement;
    await waitImages(target);
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(target, { scale: 1.6, backgroundColor: '#ffffff', useCORS: true, logging: false });
    const out = { data: canvas.toDataURL('image/jpeg', 0.85), w: canvas.width, h: canvas.height };
    host.innerHTML = '';
    cacheRef.current.set(item.key, out);
    return out;
  };

  // Página A4 com a súmula proporcional (sem esticar) e rodapé de identificação
  const addSheet = (pdf: any, img: Rendered, footer: string, first: boolean) => {
    if (!first) pdf.addPage('a4', 'portrait');
    const maxW = A4.w - A4.margin * 2;
    const maxH = A4.h - A4.margin * 2 - 6;
    let w = maxW;
    let h = (img.h / img.w) * w;
    if (h > maxH) {
      h = maxH;
      w = (img.w / img.h) * h;
    }
    pdf.addImage(img.data, 'JPEG', (A4.w - w) / 2, A4.margin, w, h, undefined, 'FAST');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(120);
    pdf.text(footer, A4.w / 2, A4.h - 5, { align: 'center' });
  };

  const footerOf = (s: PrintSlot, i: PrintItem) =>
    `${activeGame?.name ?? ''} · WOD ${s.block} · ${s.time} · Bateria ${s.number}${s.mixed ? ' (mista)' : ''} · Raia ${i.lane} · ${i.team.teamName}`;

  const renderAll = async () => {
    const total = totalSheets;
    let done = 0;
    for (const s of plan) {
      for (const item of s.items) {
        if (cancelRef.current) throw new Error('cancelado');
        setProgress({ done, total, label: `WOD ${s.block} · ${s.time} · raia ${item.lane}` });
        await render(item);
        done++;
      }
    }
    setProgress({ done: total, total, label: 'Montando arquivo...' });
  };

  const run = async (job: Job) => {
    if (!data || running || plan.length === 0) return;
    cancelRef.current = false;
    setRunning(job);
    try {
      await renderAll();
      const { jsPDF } = await import('jspdf');
      const stamp = new Date().toISOString().slice(0, 10);

      if (job === 'kit') {
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
        // capa + índice (páginas calculadas: capa ocupa as primeiras)
        const rowsPerPage = 34;
        const coverPages = Math.max(1, Math.ceil(plan.length / rowsPerPage));
        let page = coverPages + 1;
        const index = plan.map((s) => {
          const from = page;
          page += s.items.length;
          return { s, from, to: page - 1 };
        });
        index.forEach((row, i) => {
          if (i % rowsPerPage === 0) {
            if (i > 0) pdf.addPage('a4', 'portrait');
            let y = 18;
            if (i === 0) {
              pdf.setFont('helvetica', 'bold');
              pdf.setFontSize(18);
              pdf.setTextColor(17);
              pdf.text('Súmulas do dia', 14, y);
              pdf.setFont('helvetica', 'normal');
              pdf.setFontSize(10);
              pdf.setTextColor(90);
              pdf.text(`${activeGame?.name ?? ''} · ${plan.length} baterias · ${totalSheets} súmulas · gerado em ${new Date().toLocaleString('pt-BR')}`, 14, y + 7);
              y += 16;
            }
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8);
            pdf.setTextColor(110);
            ['HORÁRIO', 'WOD', 'BATERIA', 'CATEGORIAS', 'SÚMULAS', 'PÁGINAS'].forEach((h, k) => pdf.text(h, [14, 34, 50, 74, 160, 180][k], y));
            pdf.setDrawColor(200);
            pdf.line(14, y + 2, 196, y + 2);
            (pdf as any).__y = y + 8;
          }
          const y = (pdf as any).__y as number;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(20);
          pdf.text(row.s.time, 14, y);
          pdf.text(`WOD ${row.s.block}`, 34, y);
          pdf.text(`${row.s.number}${row.s.mixed ? ' (mista)' : ''}`, 50, y);
          const cats = row.s.categoryNames.map((n) => n.replace(/\s*-\s*DUPLA\s*/i, ' ')).join(' + ');
          pdf.text(pdf.splitTextToSize(cats, 84)[0], 74, y);
          pdf.text(String(row.s.items.length), 160, y);
          pdf.text(row.from === row.to ? `${row.from}` : `${row.from}–${row.to}`, 180, y);
          (pdf as any).__y = y + 7;
        });
        for (const s of plan) {
          for (const item of s.items) addSheet(pdf, cacheRef.current.get(item.key)!, footerOf(s, item), false);
        }
        pdf.save(safeFileName(`Sumulas do dia - ${gameCode} - ${stamp}.pdf`));
        toast.success(`Kit do dia gerado: ${totalSheets} súmulas em ${plan.length} baterias.`);
      } else {
        const { zipSync } = await import('fflate');
        const files: Record<string, [Uint8Array, { level: 0 }]> = {};
        for (const s of plan) {
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
          s.items.forEach((item, idx) => addSheet(pdf, cacheRef.current.get(item.key)!, footerOf(s, item), idx === 0));
          files[`WOD ${s.block}/${slotFileName(s)}`] = [new Uint8Array(pdf.output('arraybuffer')), { level: 0 }];
        }
        const zip = zipSync(files);
        downloadBlob(new Blob([zip], { type: 'application/zip' }), safeFileName(`Sumulas por bateria - ${gameCode} - ${stamp}.zip`));
        toast.success(`ZIP gerado: ${plan.length} PDFs (um por bateria).`);
      }
    } catch (e: any) {
      if (e?.message === 'cancelado') toast.info('Geração cancelada.');
      else toast.error(`Falha ao gerar: ${e?.message || 'erro desconhecido'}`);
    } finally {
      setRunning(null);
      setProgress({ done: 0, total: 0, label: '' });
    }
  };

  const toggleBlock = (b: string) => {
    cancelRef.current = false;
    setBlocks((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b].sort((x, y) => x.localeCompare(y, 'pt-BR', { numeric: true }))));
  };

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <AclGuard resource="sumulas" requiredRoleLabel="Organizadores e Mesa Técnica">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href="/sumulas" className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200">
              <ArrowLeft className="w-3.5 h-3.5" /> Súmulas
            </Link>
            <h1 className="text-2xl font-bold text-zinc-100 mt-1">PDFs das súmulas</h1>
            <p className="text-sm text-zinc-400">
              {activeGame?.name ?? 'Selecione um campeonato'} · gerado direto no navegador, na ordem da timeline (horário e raia).
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">WODs incluídos</div>
          <div className="flex flex-wrap gap-2">
            {allBlocks.map((b) => (
              <button
                key={b}
                type="button"
                disabled={!!running}
                onClick={() => toggleBlock(b)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                  blocks.includes(b) ? 'border-amber-500 bg-amber-500/10 text-zinc-100' : 'border-zinc-700 text-zinc-500'
                }`}
              >
                WOD {b}
              </button>
            ))}
            {loading && <span className="text-xs text-zinc-500 inline-flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...</span>}
          </div>
          <div className="text-xs text-zinc-400">
            {plan.length} baterias · {totalSheets} súmulas · cada súmula numa folha A4
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => run('kit')}
            disabled={!!running || totalSheets === 0}
            className="text-left rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:border-amber-500/60 p-4 disabled:opacity-50"
          >
            <div className="flex items-center gap-2 text-zinc-100 font-bold">
              {running === 'kit' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-amber-400" />}
              Kit completo do dia
            </div>
            <p className="text-xs text-zinc-400 mt-1">Um PDF com capa e índice (horário, WOD, bateria, categorias e páginas) e todas as súmulas na ordem da timeline.</p>
          </button>
          <button
            type="button"
            onClick={() => run('zip')}
            disabled={!!running || totalSheets === 0}
            className="text-left rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:border-amber-500/60 p-4 disabled:opacity-50"
          >
            <div className="flex items-center gap-2 text-zinc-100 font-bold">
              {running === 'zip' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4 text-amber-400" />}
              ZIP com um PDF por bateria
            </div>
            <p className="text-xs text-zinc-400 mt-1">Pastas por WOD e um arquivo por horário (ex.: &quot;WOD 3/15h05 - Bateria 2 (mista) - ...pdf&quot;), pronto para entregar a cada bateria.</p>
          </button>
        </div>

        {running && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span>
                {progress.done}/{progress.total} súmulas · {progress.label}
              </span>
              <button type="button" onClick={() => (cancelRef.current = true)} className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-100">
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase">
              <tr>
                <th className="text-left p-2.5">Horário</th>
                <th className="text-left p-2.5">WOD</th>
                <th className="text-left p-2.5">Bateria</th>
                <th className="text-left p-2.5">Categorias</th>
                <th className="text-right p-2.5">Súmulas</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((s) => (
                <tr key={`${s.block}-${s.time}`} className="border-t border-zinc-800 text-zinc-200">
                  <td className="p-2.5 font-semibold">{s.time}</td>
                  <td className="p-2.5">WOD {s.block}</td>
                  <td className="p-2.5">
                    {s.number}
                    {s.mixed && <span className="ml-1.5 text-[11px] text-amber-400">mista</span>}
                  </td>
                  <td className="p-2.5 text-zinc-400">{s.categoryNames.join(' + ')}</td>
                  <td className="p-2.5 text-right">{s.items.length}</td>
                </tr>
              ))}
              {!loading && plan.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-zinc-500">Nenhuma bateria com duplas para os WODs escolhidos.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* área fora da tela onde cada súmula é desenhada para virar imagem */}
        <div ref={hostRef} aria-hidden style={{ position: 'fixed', left: -10000, top: 0, width: 794, background: '#ffffff' }} />
      </div>
    </AclGuard>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Flame,
  Maximize2,
  Pause,
  Play,
  ArrowLeft,
  Clock,
  Sparkles,
  Medal,
  Lock,
} from 'lucide-react';
import { useBoard } from '@/lib/use-board';
import { toLeaderboardRanks, parseWodTitle, type BoardResponse } from '@/lib/board';
import { LeaderboardRank } from '@/types';
import confetti from 'canvas-confetti';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { storage } from '@/lib/storage';
import { computeCategoryStandings } from '@/lib/standings-engine';

export default function BigScreenLeaderboardPage() {
  const { board } = useBoard(15000);
  const activeGame = board?.game ?? null;
  const categories = board?.categories ?? [];

  const [currentCategoryIndex, setCurrentCategoryIndex] = useState<number>(0);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isFrozen, setIsFrozen] = useState<boolean>(false);
  const [localCategories, setLocalCategories] = useState<BoardResponse['categories']>([]);

  // Detecção em tempo real de bloqueio/congelamento do Leaderboard
  useEffect(() => {
    const checkFreeze = () => {
      const gCode = activeGame?.code || 'SUMMER2026';
      const localFreeze =
        localStorage.getItem('itgames_leaderboard_frozen') === 'true' ||
        localStorage.getItem('itgames_freeze_leaderboard') === 'true' ||
        localStorage.getItem('itgames_freeze_leaderboard_SUMMER2026') === 'true' ||
        (gCode ? localStorage.getItem(`itgames_freeze_leaderboard_${gCode}`) === 'true' : false);
      const apiFreeze =
        (activeGame?.status as string) === 'frozen' ||
        (activeGame?.status as string) === 'blocked';
      setIsFrozen(Boolean(localFreeze || apiFreeze));
    };

    checkFreeze();
    window.addEventListener('storage', checkFreeze);
    window.addEventListener('itgames_freeze_changed', checkFreeze);

    const interval = setInterval(checkFreeze, 1000);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('itgames_freeze_channel');
      bc.onmessage = (ev) => {
        if (ev.data && typeof ev.data.frozen === 'boolean') {
          setIsFrozen(ev.data.frozen);
        }
        if (ev.data?.standingsUpdated) {
          window.dispatchEvent(new Event('itgames_standings_updated'));
        }
      };
    } catch {
      // BroadcastChannel opcional
    }

    return () => {
      window.removeEventListener('storage', checkFreeze);
      window.removeEventListener('itgames_freeze_changed', checkFreeze);
      clearInterval(interval);
      if (bc) bc.close();
    };
  }, [activeGame]);

  // Fallback inteligente para categorias locais usando o motor oficial de desempate e pontuação
  useEffect(() => {
    const syncLocal = () => {
      storage.initDefaultsIfEmpty();
      const gCode = activeGame?.code || storage.getActiveGameId() || 'SUMMER2026';
      const cats = storage.getCategories(gCode);
      const teams = storage.getTeams(gCode);
      const wods = storage.getWorkouts(gCode);
      const scores = storage.getScores(gCode);

      if (cats.length > 0 && teams.length > 0) {
        const formatted: BoardResponse['categories'] = cats.map((c) => {
          const res = computeCategoryStandings(c, teams, wods, scores);
          return {
            id: Number(String(c.id).replace(/\D/g, '')) || 1,
            name: c.name,
            wodTitles: res.workouts.map((w) => w.title),
            rows: res.ranks.map((r) => ({
              rank: r.rank,
              teamCode: Number(String(r.registrationId).replace(/\D/g, '')) || r.rank,
              team: r.teamName,
              number: r.registerNumber,
              athletes: r.athletes,
              status: r.status === 'cancelled' ? 'cancelled' : 'active',
              totalPoints: r.totalPoints,
              totalDisplay: String(r.totalPoints),
              wods: r.workoutScores.map((ws) => ({
                title: ws.workoutTitle,
                display: ws.scoreDisplay,
                rank: ws.rank,
                points: ws.points,
                status: (ws.status as 'scored' | 'wo' | 'cancelled' | 'none') || 'none',
              })),
            })),
          };
        });
        setLocalCategories(formatted);
      }
    };

    syncLocal();
    window.addEventListener('itgames_storage_updated', syncLocal);
    window.addEventListener('itgames_standings_updated', syncLocal);
    return () => {
      window.removeEventListener('itgames_storage_updated', syncLocal);
      window.removeEventListener('itgames_standings_updated', syncLocal);
    };
  }, [activeGame]);

  const effectiveCategories = categories.length > 0 ? categories : localCategories;

  // Atualizar hora local em tempo real
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Efeito de rotação automática de categorias a cada 15 segundos
  useEffect(() => {
    if (!isAutoRotating || effectiveCategories.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentCategoryIndex((prev) => (prev + 1) % effectiveCategories.length);
    }, 15000);

    return () => clearInterval(interval);
  }, [isAutoRotating, effectiveCategories.length]);

  // Efeito de confete ao trocar de categoria (pausado quando bloqueado)
  useEffect(() => {
    if (isFrozen) return;
    try {
      confetti({
        particleCount: 40,
        spread: 70,
        origin: { y: 0.2 },
        colors: ['#f59e0b', '#ef4444', '#3b82f6', '#10b981'],
      });
    } catch {
      // ignore
    }
  }, [currentCategoryIndex, isFrozen]);

  const currentCategory = effectiveCategories[currentCategoryIndex] || effectiveCategories[0];
  const leaderboard: LeaderboardRank[] = currentCategory
    ? toLeaderboardRanks(currentCategory, activeGame?.totalUnit ?? 'PTS')
    : [];
  const totalUnit = activeGame?.totalUnit ?? 'PTS';
  const totalSuffix = totalUnit === 'TEMPO' ? '' : totalUnit;

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 sm:p-10 flex flex-col justify-between select-none relative">
      {/* OVERLAY DE BLOQUEIO DO LEADERBOARD (MESA DO HEAD JUDGE) */}
      {isFrozen && (
        <div className="fixed inset-0 z-50 bg-black/92 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-300">
          <div className="absolute top-5 left-5 sm:top-8 sm:left-8 flex items-center gap-2">
            <Link
              href="/head-judge"
              className="px-4 py-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-black flex items-center gap-2 transition-all shadow-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Painel do Head Judge</span>
            </Link>
          </div>

          <div className="relative mb-6">
            <div className="w-28 h-28 sm:w-40 sm:h-40 rounded-3xl bg-rose-500/15 border-2 border-rose-500/60 flex items-center justify-center text-rose-400 mx-auto shadow-2xl shadow-rose-500/40 animate-pulse">
              <Lock className="w-14 h-14 sm:w-20 sm:h-20" />
            </div>
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-rose-600 text-white font-black text-xs uppercase tracking-widest shadow-xl border border-rose-400 flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              OFICIAL
            </div>
          </div>

          <div className="space-y-4 max-w-4xl px-2">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-black text-xs sm:text-sm uppercase tracking-widest">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping" />
              Gabinete de Arbitragem Geral &amp; Auditoria de Pista
            </div>

            <h1 className="text-3xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight uppercase drop-shadow-2xl">
              LEADERBOARD BLOQUEADO
            </h1>

            <p className="text-lg sm:text-3xl text-amber-400 font-black tracking-wide uppercase">
              BLINDAGEM OFICIAL DE CLASSIFICAÇÃO
            </p>

            <p className="text-sm sm:text-lg text-zinc-300 max-w-2xl mx-auto leading-relaxed pt-1 font-medium">
              A classificação geral e as pontuações estão <strong className="text-rose-400">temporariamente bloqueadas</strong> pela Mesa do Head Judge para conferência de súmulas, julgamento de penalidades e fechamento oficial do pódio.
            </p>

            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 max-w-xl mx-auto text-xs sm:text-sm text-zinc-300">
              Os resultados finais e os grandes campeões do <strong className="text-amber-400">{activeGame?.name || 'Campeonato Oficial'}</strong> serão revelados na <strong className="text-white">Cerimônia de Premiação</strong>!
            </div>

            <div className="pt-3 flex flex-wrap items-center justify-center gap-3 text-xs font-bold text-zinc-400">
              <span className="px-4 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center gap-2">
                <span className="text-zinc-500">Campeonato:</span>
                <span className="text-white font-black">{activeGame?.name || 'ITGames Arena'}</span>
              </span>
              <span className="px-4 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center gap-2">
                <span className="text-zinc-500">Hora Oficial:</span>
                <span className="text-amber-400 font-mono font-black">{currentTime || '--:--:--'}</span>
              </span>
              <span className="px-4 py-2 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 font-mono font-bold">
                Status: SIGILO DA MESA
              </span>
            </div>
          </div>
        </div>
      )}

      {/* CABEÇALHO DO TELÃO DE ARENA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-amber-500/30 pb-5">
        <div className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/leaderboard"
            className="p-2.5 sm:p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
            title="Voltar ao Leaderboard padrão"
          >
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </Link>

          <BrandLogo variant="white" size="lg" />

          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {isFrozen ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600 text-white font-black text-xs uppercase tracking-widest">
                  <Lock className="w-3.5 h-3.5" />
                  LEADERBOARD BLOQUEADO
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white font-black text-xs uppercase tracking-widest animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  AO VIVO NA ARENA
                </span>
              )}
              <span className="text-zinc-400 text-xs uppercase font-bold tracking-wider">
                {activeGame?.name || 'ITGames Arena'} {activeGame?.location ? `• ${activeGame.location}` : ''}
              </span>
            </div>
            <h1 className="text-xl sm:text-4xl font-black tracking-tight text-white mt-1.5 flex flex-wrap items-center gap-2 sm:gap-3">
              <span>CATEGORIA:</span>
              <span className="text-amber-400 bg-amber-400/10 px-3 sm:px-4 py-0.5 sm:py-1 rounded-2xl border border-amber-400/30">
                {currentCategory?.name || 'Geral'}
              </span>
            </h1>
          </div>
        </div>

        {/* CONTROLES DO TELÃO E RELÓGIO */}
        <div className="flex items-center justify-between sm:justify-end gap-4">
          <div className="text-left sm:text-right">
            <div className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-widest">Hora Oficial</div>
            <div className="text-xl sm:text-3xl font-black font-mono text-white">{currentTime || '12:00:00'}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAutoRotating(!isAutoRotating)}
              className={`p-2.5 sm:p-3 rounded-2xl border transition-colors ${
                isAutoRotating
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800'
              }`}
              title={isAutoRotating ? 'Pausar rotação de categorias' : 'Ativar rotação automática'}
            >
              {isAutoRotating ? <Pause className="w-5 h-5 sm:w-6 sm:h-6" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>

            <button
              onClick={toggleFullScreen}
              className="p-2.5 sm:p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
              title="Tela Cheia (Full Screen)"
            >
              <Maximize2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* GRADE GIGANTE DE CLASSIFICAÇÃO */}
      <div className="my-6 sm:my-8 flex-1 flex flex-col justify-center">
        {leaderboard.length === 0 ? (
          <div className="rounded-3xl bg-zinc-900/60 border border-zinc-800 p-10 text-center space-y-3 max-w-2xl mx-auto">
            <Trophy className="w-12 h-12 text-amber-400/70 mx-auto" />
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Aguardando Pontuações Homologadas
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Assim que as primeiras súmulas forem lançadas e validadas pela arbitragem, o ranking desta categoria aparecerá automaticamente no telão.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.slice(0, 7).map((rankItem) => {
              const isTop1 = rankItem.rank === 1;
              const isTop2 = rankItem.rank === 2;
              const isTop3 = rankItem.rank === 3;

              return (
                <div
                  key={rankItem.registrationId}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl transition-all ${
                    isTop1
                      ? 'bg-gradient-to-r from-amber-500/30 via-zinc-900 to-zinc-900 border-2 border-amber-500 shadow-2xl shadow-amber-500/20 sm:scale-[1.01]'
                      : isTop2
                        ? 'bg-zinc-900/90 border border-zinc-500/50'
                        : isTop3
                          ? 'bg-zinc-900/90 border border-amber-700/50'
                          : 'bg-zinc-950/80 border border-zinc-800/80'
                  }`}
                >
                  {/* RANKING & ATLETA */}
                  <div className="flex items-center gap-4 sm:gap-5">
                    <div
                      className={`w-11 sm:w-14 h-11 sm:h-14 rounded-2xl flex items-center justify-center font-black text-xl sm:text-2xl shadow-lg shrink-0 ${
                        isTop1
                          ? 'bg-amber-500 text-black shadow-amber-500/50'
                          : isTop2
                            ? 'bg-zinc-300 text-black'
                            : isTop3
                              ? 'bg-amber-700 text-white'
                              : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {rankItem.rank}º
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg sm:text-3xl font-black text-white truncate">
                          {rankItem.teamName}
                        </span>
                        <span className="text-xs sm:text-base font-bold text-amber-400 bg-amber-400/20 px-2.5 py-0.5 rounded-lg border border-amber-400/30">
                          {rankItem.registerNumber}
                        </span>
                        {rankItem.status === 'cancelled' && (
                          <span className="text-xs sm:text-sm font-black text-rose-300 bg-rose-500/20 px-2.5 py-0.5 rounded-lg border border-rose-500/40 uppercase">
                            CANCELADA
                          </span>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm text-zinc-400 mt-0.5 font-medium truncate">
                        {rankItem.athletes.join(', ')}
                        {rankItem.boxOrAffiliate && (
                          <>
                            {' '}
                            • <strong className="text-zinc-300">{rankItem.boxOrAffiliate}</strong>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* PONTUAÇÃO GIGANTE */}
                  <div className="text-right flex items-center justify-end gap-4 sm:gap-6">
                    <div className="hidden lg:flex items-center gap-3">
                      {rankItem.workoutScores.map((ws, idx) => {
                        const parsed = parseWodTitle(ws.workoutTitle, idx);
                        return (
                          <div key={idx} className="bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800 text-center min-w-[70px]">
                            <div className="text-[10px] text-zinc-400 font-bold uppercase">{parsed.shortTitle}</div>
                            <div className="text-xs font-black text-zinc-200">{ws.scoreDisplay}</div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="bg-black/60 px-4 sm:px-6 py-2 rounded-2xl border border-amber-500/40">
                      <div className="text-[10px] uppercase font-bold text-zinc-400">Total Acumulado</div>
                      <div className="text-xl sm:text-4xl font-black text-amber-400 font-mono">
                        {rankItem.totalDisplay ?? rankItem.totalPoints}
                        {totalSuffix && <span className="text-xs sm:text-sm font-bold text-zinc-400"> {totalSuffix}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RODAPÉ INFORMATIVO COM ROTAÇÃO DE CATEGORIAS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-zinc-800 pt-4 text-xs text-zinc-400">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="font-bold text-white">Categorias da Competição:</span>
          <div className="flex flex-wrap items-center gap-2">
            {effectiveCategories.map((cat, idx) => (
              <button
                key={cat.id}
                onClick={() => setCurrentCategoryIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  idx === currentCategoryIndex
                    ? 'bg-amber-500 text-black'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 font-bold text-zinc-300">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>ITGames Broadcast Engine • Atualização Instantânea</span>
        </div>
      </div>
    </div>
  );
}

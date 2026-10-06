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
  Medal
} from 'lucide-react';
import { useLeaderboard } from '@/lib/use-leaderboard';
import { GameEvent, Category, WorkoutRule, TeamRegistration, ScoreEntry, LeaderboardRank } from '@/types';
import { calculateOverallLeaderboard } from '@/lib/scoring';
import confetti from 'canvas-confetti';

export default function BigScreenLeaderboardPage() {
  const { view } = useLeaderboard(15000);
  const activeGame = view?.game ?? null;
  const categories = view?.categories ?? [];
  const workouts = view?.workouts ?? [];
  const teams = view?.teams ?? [];
  const scores = view?.scores ?? [];

  const [currentCategoryIndex, setCurrentCategoryIndex] = useState<number>(0);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<string>('');

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
    if (!isAutoRotating || categories.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentCategoryIndex((prev) => (prev + 1) % categories.length);
    }, 15000);

    return () => clearInterval(interval);
  }, [isAutoRotating, categories.length]);

  // Efeito de confete ao trocar de categoria
  useEffect(() => {
    try {
      confetti({
        particleCount: 40,
        spread: 70,
        origin: { y: 0.2 },
        colors: ['#f59e0b', '#ef4444', '#3b82f6', '#10b981']
      });
    } catch (e) {
      // ignore
    }
  }, [currentCategoryIndex]);

  const currentCategory = categories[currentCategoryIndex] || categories[0];
  const categoryWorkouts = workouts.filter(w => w.categoryId === currentCategory?.id);
  const categoryTeams = teams.filter(t => t.categoryId === currentCategory?.id);

  const leaderboard: LeaderboardRank[] = calculateOverallLeaderboard(
    categoryTeams,
    categoryWorkouts,
    scores,
    activeGame?.eventType === 'hyrox'
  );

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 sm:p-10 flex flex-col justify-between select-none">
      
      {/* CABEÇALHO DO TELÃO DE ARENA */}
      <div className="flex items-center justify-between border-b-2 border-amber-500/30 pb-6">
        <div className="flex items-center gap-4">
          <Link 
            href="/leaderboard"
            className="p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
            title="Voltar ao Leaderboard padrão"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>

          <div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white font-black text-xs uppercase tracking-widest animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                AO VIVO NA ARENA
              </span>
              <span className="text-zinc-400 text-xs uppercase font-bold tracking-wider">
                {activeGame?.name} • {activeGame?.location}
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mt-1 flex items-center gap-3">
              <span>CATEGORIA:</span>
              <span className="text-amber-400 bg-amber-400/10 px-4 py-1 rounded-2xl border border-amber-400/30">
                {currentCategory?.name || 'Geral'}
              </span>
            </h1>
          </div>
        </div>

        {/* CONTROLES DO TELÃO E RELÓGIO */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Hora Oficial</div>
            <div className="text-3xl font-black font-mono text-white">{currentTime || '12:00:00'}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAutoRotating(!isAutoRotating)}
              className={`p-3 rounded-2xl border transition-colors ${
                isAutoRotating 
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' 
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800'
              }`}
              title={isAutoRotating ? 'Pausar rotação de categorias' : 'Ativar rotação automática'}
            >
              {isAutoRotating ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>

            <button
              onClick={toggleFullScreen}
              className="p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
              title="Tela Cheia (Full Screen)"
            >
              <Maximize2 className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* GRADE GIGANTE DE CLASSIFICAÇÃO */}
      <div className="my-8 flex-1 flex flex-col justify-center">
        <div className="space-y-3">
          {leaderboard.slice(0, 7).map((rankItem) => {
            const isTop1 = rankItem.rank === 1;
            const isTop2 = rankItem.rank === 2;
            const isTop3 = rankItem.rank === 3;

            return (
              <div
                key={rankItem.registrationId}
                className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl transition-all ${
                  isTop1 
                    ? 'bg-gradient-to-r from-amber-500/30 via-zinc-900 to-zinc-900 border-2 border-amber-500 shadow-2xl shadow-amber-500/20 scale-[1.01]' 
                    : isTop2
                      ? 'bg-zinc-900/90 border border-zinc-500/50'
                      : isTop3
                        ? 'bg-zinc-900/90 border border-amber-700/50'
                        : 'bg-zinc-950/80 border border-zinc-800/80'
                }`}
              >
                {/* RANKING & ATLETA */}
                <div className="flex items-center gap-5">
                  <div className={`w-12 sm:w-14 h-12 sm:h-14 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg ${
                    isTop1 ? 'bg-amber-500 text-black shadow-amber-500/50' :
                    isTop2 ? 'bg-zinc-300 text-black' :
                    isTop3 ? 'bg-amber-700 text-white' :
                    'bg-zinc-800 text-zinc-400'
                  }`}>
                    {rankItem.rank}º
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl sm:text-3xl font-black text-white">
                        {rankItem.teamName}
                      </span>
                      <span className="text-sm sm:text-base font-bold text-amber-400 bg-amber-400/20 px-2.5 py-0.5 rounded-lg border border-amber-400/30">
                        {rankItem.registerNumber}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm text-zinc-400 mt-0.5 font-medium">
                      {rankItem.athletes.join(', ')} • <strong className="text-zinc-300">{rankItem.boxOrAffiliate}</strong>
                    </div>
                  </div>
                </div>

                {/* PONTUAÇÃO GIGANTE */}
                <div className="text-right flex items-center gap-6">
                  {/* Scores dos WODs individuais */}
                  <div className="hidden lg:flex items-center gap-3">
                    {rankItem.workoutScores.map((ws, idx) => (
                      <div key={idx} className="bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800 text-center">
                        <div className="text-[10px] text-zinc-500 font-bold uppercase">WOD {idx + 1}</div>
                        <div className="text-xs font-black text-zinc-200">{ws.scoreDisplay}</div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-black/60 px-6 py-2 rounded-2xl border border-amber-500/40">
                    <div className="text-[10px] uppercase font-bold text-zinc-400">Total Acumulado</div>
                    <div className="text-2xl sm:text-4xl font-black text-amber-400 font-mono">
                      {rankItem.totalPoints} <span className="text-sm font-bold text-zinc-400">PTS</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RODAPÉ INFORMATIVO COM ROTAÇÃO DE CATEGORIAS */}
      <div className="flex items-center justify-between border-t border-zinc-800 pt-4 text-xs text-zinc-400">
        <div className="flex items-center gap-3">
          <span className="font-bold text-white">Categorias da Competição:</span>
          <div className="flex items-center gap-2">
            {categories.map((cat, idx) => (
              <button
                key={cat.id}
                onClick={() => setCurrentCategoryIndex(idx)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
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

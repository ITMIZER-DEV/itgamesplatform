'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Trophy, 
  Tv, 
  Search, 
  Medal, 
  TrendingUp, 
  Flame, 
  Clock, 
  Activity, 
  ChevronRight,
  Filter,
  Sparkles
} from 'lucide-react';
import { useLeaderboard } from '@/lib/use-leaderboard';
import { GameEvent, Category, WorkoutRule, TeamRegistration, ScoreEntry, LeaderboardRank } from '@/types';
import { calculateOverallLeaderboard } from '@/lib/scoring';
import { getCurrentUserSession } from '@/lib/acl';

export default function LeaderboardPage() {
  const { view, status } = useLeaderboard(30000);
  const activeGame = view?.game ?? null;
  const categories = view?.categories ?? [];
  const workouts = view?.workouts ?? [];
  const teams = view?.teams ?? [];
  const scores = view?.scores ?? [];

  const [pickedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const selectedCategoryId = pickedCategoryId || categories[0]?.id || '';

  const currentCategory = categories.find(c => c.id === selectedCategoryId) || categories[0];
  const categoryWorkouts = workouts.filter(w => w.categoryId === currentCategory?.id);
  const categoryTeams = teams.filter(t => t.categoryId === currentCategory?.id);

  // Calcular ranking oficial acumulado
  const leaderboard: LeaderboardRank[] = calculateOverallLeaderboard(
    categoryTeams,
    categoryWorkouts,
    scores,
    activeGame?.eventType === 'hyrox'
  );

  // Filtrar busca por nome ou número
  const filteredRanks = leaderboard.filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      item.teamName.toLowerCase().includes(query) ||
      item.registerNumber.toLowerCase().includes(query) ||
      item.athletes.some(a => a.toLowerCase().includes(query)) ||
      (item.boxOrAffiliate && item.boxOrAffiliate.toLowerCase().includes(query))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* CABEÇALHO DO LEADERBOARD */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Trophy className="w-4 h-4" />
            <span>Classificação Oficial Ao Vivo</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
            Leaderboard Geral • {activeGame?.name}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Pontuação homologada em tempo real com critérios de desempate oficiais de {activeGame?.eventType === 'crossfit' ? 'CrossFit (100, 95, 90...)' : 'HYROX Racing (Tempo Acumulado)'}.
          </p>
        </div>

        {/* ATALHO PARA MODO TELÃO DE LED */}
        <div>
          <Link
            href="/leaderboard/big-screen"
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-xs shadow-xl shadow-amber-500/20 transition-transform hover:scale-105 active:scale-95"
          >
            <Tv className="w-4 h-4" />
            <span>MODO TELÃO DE ARENA (FULL SCREEN)</span>
          </Link>
        </div>
      </div>

      {status === 'loading' && <p className="text-sm text-zinc-500">Carregando classificação...</p>}
      {status === 'no-games' && (
        <div className="p-8 text-center rounded-3xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-400">
          Nenhum campeonato liberado no momento.
        </div>
      )}
      {status === 'error' && (
        <div className="p-8 text-center rounded-3xl bg-zinc-900 border border-rose-500/30 text-sm text-zinc-300">
          Não foi possível carregar a classificação agora. Tente novamente em instantes.
        </div>
      )}
      {status === 'ok' && scores.length === 0 && (
        <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
          Ainda não há resultados homologados neste campeonato. A classificação aparece aqui assim que os juízes lançarem e homologarem os scores.
        </div>
      )}

      {/* SELEÇÃO DE CATEGORIA EM ABAS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map(cat => {
          const isSelected = cat.id === currentCategory?.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 scale-105'
                  : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* BARRA DE PESQUISA RÁPIDA */}
      <div className="glass-panel rounded-2xl p-4 border border-zinc-800 flex items-center gap-3">
        <Search className="w-4 h-4 text-zinc-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar atleta pelo nome, número de peito (#101) ou Box / Afiliação..."
          className="bg-transparent flex-1 text-xs text-white placeholder-zinc-500 focus:outline-none"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-xs text-zinc-400 hover:text-white">
            Limpar
          </button>
        )}
      </div>

      {/* PÓDIO DOS 3 PRIMEIROS COLOCADOS (TOP 3) */}
      {filteredRanks.length >= 3 && !searchQuery && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          
          {/* 2º LUGAR (PRATA) */}
          <div className="glass-panel rounded-3xl p-5 border border-zinc-700/80 flex flex-col justify-between order-2 md:order-1 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-full bg-zinc-400/20 text-zinc-300 font-black text-sm flex items-center justify-center border border-zinc-400/40">
                2º
              </span>
              <Medal className="w-6 h-6 text-zinc-300" />
            </div>
            <div className="my-4">
              <span className="text-[11px] font-bold text-zinc-400">{filteredRanks[1].registerNumber}</span>
              <h3 className="text-lg font-black text-white truncate">{filteredRanks[1].teamName}</h3>
              <p className="text-xs text-zinc-400 truncate">{filteredRanks[1].boxOrAffiliate}</p>
            </div>
            <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-xs text-zinc-400">Pontuação Total:</span>
              <span className="text-lg font-black text-zinc-200">{filteredRanks[1].totalPoints} pts</span>
            </div>
          </div>

          {/* 1º LUGAR (OURO / CAMPEÃO) */}
          <div className="glass-panel-gold rounded-3xl p-6 border-2 border-amber-500/60 flex flex-col justify-between order-1 md:order-2 relative overflow-hidden shadow-2xl shadow-amber-500/10">
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-full bg-amber-500 text-black font-black text-base flex items-center justify-center shadow-lg shadow-amber-500/40">
                1º
              </span>
              <Trophy className="w-8 h-8 text-amber-400 animate-bounce" />
            </div>
            <div className="my-4">
              <span className="text-xs font-bold text-amber-400">{filteredRanks[0].registerNumber} • LÍDER GERAL</span>
              <h3 className="text-2xl font-black text-white truncate">{filteredRanks[0].teamName}</h3>
              <p className="text-xs text-zinc-300 truncate">{filteredRanks[0].boxOrAffiliate}</p>
            </div>
            <div className="pt-4 border-t border-amber-500/30 flex items-center justify-between">
              <span className="text-xs text-zinc-300 font-bold uppercase">Pontuação Acumulada:</span>
              <span className="text-2xl font-black text-amber-400">{filteredRanks[0].totalPoints} pts</span>
            </div>
          </div>

          {/* 3º LUGAR (BRONZE) */}
          <div className="glass-panel rounded-3xl p-5 border border-zinc-700/80 flex flex-col justify-between order-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-full bg-amber-700/20 text-amber-600 font-black text-sm flex items-center justify-center border border-amber-700/40">
                3º
              </span>
              <Medal className="w-6 h-6 text-amber-600" />
            </div>
            <div className="my-4">
              <span className="text-[11px] font-bold text-zinc-400">{filteredRanks[2].registerNumber}</span>
              <h3 className="text-lg font-black text-white truncate">{filteredRanks[2].teamName}</h3>
              <p className="text-xs text-zinc-400 truncate">{filteredRanks[2].boxOrAffiliate}</p>
            </div>
            <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-xs text-zinc-400">Pontuação Total:</span>
              <span className="text-lg font-black text-amber-600">{filteredRanks[2].totalPoints} pts</span>
            </div>
          </div>

        </div>
      )}

      {/* TABELA GERAL DO LEADERBOARD */}
      <div className="glass-panel rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-900/90 text-zinc-400 border-b border-zinc-800 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-4 px-4 text-center w-16">Rank</th>
                <th className="py-4 px-4">Atleta / Equipe</th>
                <th className="py-4 px-4">Box / Box Affiliate</th>
                {categoryWorkouts.map((wod, i) => (
                  <th key={wod.id} className="py-4 px-3 text-center">
                    {wod.title.split('-')[0] || `WOD ${i + 1}`}
                  </th>
                ))}
                <th className="py-4 px-4 text-right font-black text-amber-400">Pontos Totais</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredRanks.map((rankItem) => (
                <tr 
                  key={rankItem.registrationId}
                  className="hover:bg-zinc-800/40 transition-colors"
                >
                  <td className="py-3.5 px-4 text-center">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-xl font-black text-xs ${
                      rankItem.rank === 1 ? 'bg-amber-500 text-black' :
                      rankItem.rank === 2 ? 'bg-zinc-300 text-black' :
                      rankItem.rank === 3 ? 'bg-amber-700 text-white' :
                      'bg-zinc-800 text-zinc-400'
                    }`}>
                      {rankItem.rank}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>{rankItem.teamName}</span>
                      <span className="text-[10px] text-amber-400">({rankItem.registerNumber})</span>
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      {rankItem.athletes.join(', ')}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-zinc-400">
                    {rankItem.boxOrAffiliate || '-'}
                  </td>

                  {/* SCORES DE CADA WOD */}
                  {rankItem.workoutScores.map((ws) => (
                    <td key={ws.workoutId} className="py-3.5 px-3 text-center">
                      <div className="font-bold text-zinc-200">
                        {ws.scoreDisplay}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {ws.points > 0 ? `${ws.points} pts (${ws.rank}º)` : '-'}
                      </div>
                    </td>
                  ))}

                  <td className="py-3.5 px-4 text-right font-black text-sm text-amber-400">
                    {rankItem.totalPoints} pts
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

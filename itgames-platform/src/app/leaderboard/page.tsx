'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Trophy, 
  Tv, 
  Search, 
  Medal, 
  Snowflake,
  AlertCircle,
  CheckCircle2,
  Layers,
  ShieldCheck,
  Flame,
  Clock,
  Sparkles,
  Lock
} from 'lucide-react';
import { useBoard } from '@/lib/use-board';
import { toLeaderboardRanks, formatTotal, parseWodTitle, type BoardResponse } from '@/lib/board';
import { computeCategoryStandings } from '@/lib/standings-engine';
import { storage } from '@/lib/storage';
import { getArenaSelection } from '@/lib/arena-selection';
import { FrozenCategorySummary, getLocalFrozenCategories } from '@/lib/screens';
import { useServerFreeze } from '@/lib/use-server-freeze';
import { LeaderboardRank } from '@/types';

export default function LeaderboardPage() {
  const { board, status } = useBoard(30000);
  const activeGame = board?.game ?? null;
  const apiCategories = board?.categories ?? [];
  const [localFallbackCats, setLocalFallbackCats] = useState<BoardResponse['categories']>([]);

  useEffect(() => {
    const syncLocalStandings = () => {
      storage.initDefaultsIfEmpty();
      const gCode = activeGame?.code || storage.getActiveGameId() || 'SUMMER2026';
      const cats = storage.getCategories(gCode);
      const teams = storage.getTeams(gCode);
      const wods = storage.getWorkouts(gCode);
      const scores = storage.getScores(gCode);
      if (cats.length === 0 || teams.length === 0) return;

      const computed: BoardResponse['categories'] = cats.map((cat) => {
        const res = computeCategoryStandings(cat, teams, wods, scores);
        return {
          id: Number(String(cat.id).replace(/\D/g, '')) || 1,
          name: cat.name,
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
      setLocalFallbackCats(computed);
    };

    syncLocalStandings();
    window.addEventListener('itgames_storage_updated', syncLocalStandings);
    window.addEventListener('itgames_standings_updated', syncLocalStandings);
    return () => {
      window.removeEventListener('itgames_storage_updated', syncLocalStandings);
      window.removeEventListener('itgames_standings_updated', syncLocalStandings);
    };
  }, [activeGame]);

  const categories = apiCategories.length > 0 ? apiCategories : localFallbackCats;

  const [pickedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedWodIndex, setSelectedWodIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  // sem escolha aqui, abre na categoria que a operação está trabalhando (Head Judge / Baterias)
  const sharedCategoryId = getArenaSelection(activeGame?.code).categoryId;
  const selectedCategoryId =
    pickedCategoryId ||
    (sharedCategoryId && categories.some((c) => String(c.id) === sharedCategoryId) ? sharedCategoryId : '') ||
    String(categories[0]?.id ?? '');

  const currentCategory = categories.find(c => String(c.id) === selectedCategoryId) || categories[0];
  const categoryWodTitles = currentCategory?.wodTitles ?? [];

  // Classificação oficial calculada pelo servidor com regras oficiais de pontuação e tiebreak
  const leaderboard: LeaderboardRank[] = currentCategory
    ? toLeaderboardRanks(currentCategory, activeGame?.totalUnit ?? 'PTS')
    : [];
  const hasResults = categories.some(c => c.rows.some(r => r.wods.some(w => w.status !== 'none')));

  // Ordenação das equipes:
  // Se selectedWodIndex for número: ordena pelo rank daquela prova específica!
  // Se for null: usa o ranking geral acumulado com o critério de desempate
  const sortedRanks = [...leaderboard].sort((a, b) => {
    if (selectedWodIndex !== null) {
      const scoreA = a.workoutScores[selectedWodIndex];
      const scoreB = b.workoutScores[selectedWodIndex];
      const rankA = scoreA && scoreA.rank > 0 ? scoreA.rank : 9999;
      const rankB = scoreB && scoreB.rank > 0 ? scoreB.rank : 9999;
      if (rankA !== rankB) return rankA - rankB;
      return a.rank - b.rank;
    }
    return a.rank - b.rank;
  });

  // Filtrar busca por nome ou número
  const filteredRanks = sortedRanks.filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      item.teamName.toLowerCase().includes(query) ||
      item.registerNumber.toLowerCase().includes(query) ||
      item.athletes.some(a => a.toLowerCase().includes(query)) ||
      (item.boxOrAffiliate && item.boxOrAffiliate.toLowerCase().includes(query))
    );
  });

  const [localFrozen, setIsFrozen] = useState<boolean>(false);
  const [localFrozenCats, setFrozenCategoriesMap] = useState<Record<string, FrozenCategorySummary>>({});

  useEffect(() => {
    const checkFreeze = () => {
      const gCode = activeGame?.code || '';
      // só a chave do campeonato atual: as chaves globais antigas ficavam presas em "true" e congelavam qualquer evento
      const localFreeze = gCode ? localStorage.getItem(`itgames_freeze_leaderboard_${gCode}`) === 'true' : false;
      const apiFreeze =
        (activeGame?.status as string) === 'frozen' ||
        (activeGame?.status as string) === 'blocked';
      setIsFrozen(Boolean(localFreeze || apiFreeze));
      setFrozenCategoriesMap(getLocalFrozenCategories(gCode));
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
        if (ev.data?.frozenCategories) {
          setFrozenCategoriesMap(ev.data.frozenCategories);
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

  // O servidor manda: congelar na Mesa do Head Judge vale para todos os aparelhos (o local só cobre até a 1ª resposta)
  const serverFreeze = useServerFreeze(activeGame?.code);
  const isFrozen = serverFreeze.loaded
    ? serverFreeze.frozen || (activeGame?.status as string) === 'blocked'
    : localFrozen;
  const frozenCategoriesMap = serverFreeze.loaded ? serverFreeze.categories : localFrozenCats;


  const currentCatFrozenMeta = currentCategory
    ? frozenCategoriesMap[String(currentCategory.id)] ||
      (currentCategory.frozen
        ? {
            gameCode: activeGame?.code || 'SUMMER2026',
            categoryId: currentCategory.id,
            categoryName: currentCategory.name,
            overlayText: currentCategory.overlayText || 'CATEGORIA EM REVISÃO',
            frozenAt: currentCategory.frozenAt || new Date().toISOString(),
          }
        : undefined)
    : undefined;
  const isCurrentCatFrozen = isFrozen || Boolean(currentCatFrozenMeta);
  const showRevision = Boolean(activeGame?.showScoreRevision);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* CABEÇALHO DO LEADERBOARD */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Trophy className="w-4 h-4" />
            <span>Classificação Oficial Ao Vivo</span>
            {isFrozen && (
              <span className="inline-flex items-center gap-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                <Lock className="w-3 h-3" />
                Bloqueado
              </span>
            )}
            {showRevision && (
              <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                <AlertCircle className="w-3 h-3" />
                Revisão Aberta
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
            Leaderboard Geral • {activeGame?.name}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Pontuação homologada em tempo real com critérios de desempate oficiais Summer Games (melhores colocações sucessivas).
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

      {/* SELEÇÃO DE CATEGORIA EM ABAS (Sempre visível para permitir alternar quando apenas 1 categoria está em revisão) */}
      {!isFrozen && categories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((cat) => {
            const isSelected = cat.id === currentCategory?.id;
            const catFrozen = Boolean(frozenCategoriesMap[String(cat.id)] || cat.frozen);
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(String(cat.id))}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 scale-105'
                    : catFrozen
                      ? 'bg-sky-950/70 hover:bg-sky-900/70 text-sky-300 border border-sky-500/50'
                      : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                }`}
              >
                {catFrozen && <Lock className="w-3 h-3" />}
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* OVERLAY / BANNER DE BLOQUEIO DO LEADERBOARD (TOTAL OU DA CATEGORIA ATIVA) */}
      {isCurrentCatFrozen && (
        <div className="rounded-3xl bg-gradient-to-br from-rose-950/90 via-zinc-900 to-black border-2 border-rose-500/60 p-6 sm:p-10 shadow-2xl shadow-rose-500/20 text-center space-y-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-rose-500/20 border-2 border-rose-500/50 flex items-center justify-center text-rose-400 mx-auto animate-pulse">
            <Lock className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
          <div className="space-y-2 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-black uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
              {!isFrozen && currentCategory ? `Categoria: ${currentCategory.name}` : 'Blindagem Oficial Pré-Pódio'}
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight">
              {!isFrozen && currentCatFrozenMeta ? currentCatFrozenMeta.overlayText : 'LEADERBOARD BLOQUEADO'}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              {!isFrozen && currentCategory ? (
                <>
                  As pontuações da categoria <strong className="text-amber-400">{currentCategory.name}</strong> estão temporariamente em revisão pela{' '}
                  <strong className="text-white">Mesa do Head Judge</strong>. As demais categorias seguem com placar ao vivo normalmente!
                </>
              ) : (
                <>
                  As pontuações parciais e o ranking geral foram temporariamente ocultados pela <strong className="text-white">Mesa do Head Judge</strong> para conferência de súmulas e fechamento oficial. O resultado definitivo será anunciado na Cerimônia de Premiação!
                </>
              )}
            </p>
          </div>
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-mono font-bold text-amber-300 bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-700">
              <Snowflake className="w-4 h-4 animate-spin" />
              Auditoria &amp; Homologação em Andamento
            </span>
          </div>
        </div>
      )}

      {/* BANNER DE JANELA DE REVISÃO DE SÚMULA */}
      {showRevision && (
        <div className="rounded-2xl bg-amber-950/40 border border-amber-500/40 p-4 flex items-center gap-3 text-xs text-amber-200">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <strong>Período de Revisão & Contestação de Súmulas Ativo:</strong> Atletas e capitães têm 15 minutos após o encerramento de cada bateria para solicitar auditoria formal de tempos, parciais e contagem de repetições junto à mesa diretora.
          </div>
        </div>
      )}

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
      {status === 'ok' && !hasResults && (
        <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
          Ainda não há resultados homologados neste campeonato. A classificação aparece aqui assim que os juízes lançarem e homologarem os scores.
        </div>
      )}

      {!isCurrentCatFrozen && (
        <>

      {/* SELEÇÃO DE VISUALIZAÇÃO: GERAL ACUMULADO OU PARCIAL POR PROVA */}
      <div className="glass-panel rounded-2xl p-2 border border-zinc-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setSelectedWodIndex(null)}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all whitespace-nowrap ${
            selectedWodIndex === null
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md shadow-amber-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>🏆 GERAL ACUMULADO</span>
        </button>

        {categoryWodTitles.map((title, idx) => {
          const parsed = parseWodTitle(title, idx);
          const isSelected = selectedWodIndex === idx;
          return (
            <button
              key={idx}
              onClick={() => setSelectedWodIndex(idx)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                isSelected
                  ? 'bg-zinc-100 text-black shadow-md shadow-white/10'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5 opacity-60" />
              <span>{parsed.shortTitle}</span>
              {parsed.subtitle && (
                <span className={`text-[10px] font-normal ${isSelected ? 'text-zinc-700' : 'text-zinc-500'}`}>
                  ({parsed.subtitle})
                </span>
              )}
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

      {/* PÓDIO DOS 3 PRIMEIROS COLOCADOS (TOP 3) - EXIBIDO NO GERAL ACUMULADO */}
      {selectedWodIndex === null && filteredRanks.length >= 3 && !searchQuery && (
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
              <span className="text-lg font-black text-zinc-200">{formatTotal(filteredRanks[1])}</span>
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
              <span className="text-2xl font-black text-amber-400">{formatTotal(filteredRanks[0])}</span>
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
              <span className="text-lg font-black text-amber-600">{formatTotal(filteredRanks[2])}</span>
            </div>
          </div>

        </div>
      )}

      {/* CARDS DE CLASSIFICAÇÃO MOBILE (ERGONÔMICO PARA CELULARES) */}
      <div className="space-y-3 md:hidden">
        {filteredRanks.map((rankItem, rIdx) => {
          const wodScore = selectedWodIndex !== null ? rankItem.workoutScores[selectedWodIndex] : null;
          const displayRank = selectedWodIndex !== null ? (wodScore?.rank || rIdx + 1) : rankItem.rank;

          return (
            <div
              key={`mob_${rankItem.registrationId}`}
              className={`p-4 rounded-2xl border bg-zinc-950/90 space-y-3 ${
                displayRank === 1
                  ? 'border-amber-500/60 bg-gradient-to-br from-amber-500/10 via-zinc-900 to-zinc-950'
                  : 'border-zinc-800'
              } ${rankItem.status === 'cancelled' ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-9 h-9 rounded-xl font-black text-sm flex items-center justify-center shrink-0 ${
                      displayRank === 1
                        ? 'bg-amber-500 text-black'
                        : displayRank === 2
                          ? 'bg-zinc-300 text-black'
                          : displayRank === 3
                            ? 'bg-amber-700 text-white'
                            : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {displayRank}º
                  </span>
                  <div className="min-w-0">
                    <div className="font-black text-white text-sm flex items-center gap-1.5 flex-wrap">
                      <span className="truncate">{rankItem.teamName}</span>
                      <span className="text-[10px] font-mono text-amber-400">{rankItem.registerNumber}</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate">
                      {rankItem.athletes.join(', ')}
                      {rankItem.boxOrAffiliate ? ` • ${rankItem.boxOrAffiliate}` : ''}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[10px] uppercase font-bold text-zinc-500">
                    {selectedWodIndex !== null ? 'Pontos' : 'Total'}
                  </div>
                  <div className="text-base font-black text-amber-400 font-mono">
                    {selectedWodIndex !== null ? `${wodScore?.points ?? 0} pts` : formatTotal(rankItem)}
                  </div>
                </div>
              </div>

              {selectedWodIndex === null ? (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/80">
                  {rankItem.workoutScores.map((ws, idx) => {
                    const parsed = parseWodTitle(ws.workoutTitle, idx);
                    return (
                      <div key={ws.workoutId} className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
                        <div className="text-[10px] text-zinc-400 font-bold truncate">{parsed.shortTitle}</div>
                        <div className="font-mono font-bold text-white">{ws.scoreDisplay}</div>
                        <div className="text-[10px] text-emerald-400 font-semibold">
                          {ws.points > 0 ? `${ws.points} pts (${ws.rank}º)` : '-'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-xs">
                  <span className="text-zinc-400">Marca Oficial:</span>
                  <span className="font-mono font-black text-white bg-zinc-900 border border-zinc-700 px-3 py-1 rounded-lg">
                    {wodScore?.scoreDisplay || '-'}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* TABELA DE CLASSIFICAÇÃO (GERAL OU PARCIAL) */}
      <div className="hidden md:block glass-panel rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-900/90 text-zinc-400 border-b border-zinc-800 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-4 px-4 text-center w-16">
                  {selectedWodIndex !== null ? 'Pos. WOD' : 'Rank'}
                </th>
                <th className="py-4 px-4">Atleta / Equipe</th>
                <th className="py-4 px-4">Box / Box Affiliate</th>
                
                {selectedWodIndex === null ? (
                  // COLUNAS DE TODOS OS WODS
                  <>
                    {categoryWodTitles.map((title, i) => {
                      const parsed = parseWodTitle(title, i);
                      return (
                        <th key={i} className="py-3 px-3 text-center" title={title}>
                          <div className="font-extrabold text-zinc-200 tracking-normal text-xs">{parsed.shortTitle}</div>
                          {parsed.subtitle && (
                            <div className="text-[9px] font-normal text-zinc-500 uppercase truncate max-w-[120px] mx-auto tracking-tight">
                              {parsed.subtitle}
                            </div>
                          )}
                        </th>
                      );
                    })}
                    <th className="py-4 px-4 text-right font-black text-amber-400">Total</th>
                  </>
                ) : (
                  // COLUNAS DA VISÃO PARCIAL DO WOD SELECIONADO
                  <>
                    <th className="py-4 px-4 text-center">Marca / Resultado Oficial</th>
                    <th className="py-4 px-4 text-center">Pontos Conquistados</th>
                    <th className="py-4 px-4 text-center">Homologação</th>
                    <th className="py-4 px-4 text-right font-black text-zinc-400">Geral Acum.</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredRanks.map((rankItem, rIdx) => {
                const wodScore = selectedWodIndex !== null ? rankItem.workoutScores[selectedWodIndex] : null;
                const displayRank = selectedWodIndex !== null ? (wodScore?.rank || rIdx + 1) : rankItem.rank;

                return (
                  <tr 
                    key={rankItem.registrationId}
                    className={`hover:bg-zinc-800/40 transition-colors ${rankItem.status === 'cancelled' ? 'opacity-60' : ''}`}
                  >
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-xl font-black text-xs ${
                        displayRank === 1 ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20' :
                        displayRank === 2 ? 'bg-zinc-300 text-black' :
                        displayRank === 3 ? 'bg-amber-700 text-white' :
                        'bg-zinc-800 text-zinc-400'
                      }`}>
                        {displayRank}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{rankItem.teamName}</span>
                        <span className="text-[10px] text-amber-400">({rankItem.registerNumber})</span>
                        {rankItem.status === 'cancelled' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black uppercase">
                            CANCELADA
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {rankItem.athletes.join(', ')}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-zinc-400">
                      {rankItem.boxOrAffiliate || '-'}
                    </td>

                    {selectedWodIndex === null ? (
                      // SCORES DE CADA WOD NO GERAL
                      <>
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
                          {formatTotal(rankItem)}
                        </td>
                      </>
                    ) : (
                      // VISÃO ESPECÍFICA DO WOD SELECIONADO
                      <>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-sm text-white">
                          <span className="bg-zinc-900 border border-zinc-700/80 px-3 py-1 rounded-lg">
                            {wodScore?.scoreDisplay || '-'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-black text-amber-400 text-sm">
                            {wodScore ? `${wodScore.points} pts` : '-'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {wodScore?.status === 'scored' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded font-bold uppercase">
                              <CheckCircle2 className="w-3 h-3" />
                              Homologado
                            </span>
                          ) : wodScore?.status === 'wo' ? (
                            <span className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded font-bold uppercase">
                              W.O.
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-500">Sem Score</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-zinc-400">
                          {formatTotal(rankItem)}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {/* RODAPÉ INFORMATIVO: REGULAMENTO OFICIAL DE DESEMPATE */}
      <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 space-y-1.5">
        <div className="font-bold text-zinc-300 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span>Critério Oficial de Desempate — Regulamento Summer Games Interbox</span>
        </div>
        <p className="leading-relaxed text-[11px]">
          Em caso de empate na pontuação geral acumulada, a classificação é definida pela comparação das <strong>melhores colocações sucessivas</strong> em cada WOD (1ºs lugares; persistindo, 2ºs lugares; e assim sucessivamente). Se o empate persistir após todos os WODs, o <strong>resultado obtido na última prova disputada</strong> formaliza a vitória definitiva.
        </p>
      </div>

    </div>
  );
}

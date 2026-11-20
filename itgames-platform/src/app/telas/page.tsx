'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Tv, Plus, Snowflake, Sun, Trash2, Pencil, RefreshCw, Lock, Megaphone, Trophy, Square, Sparkles, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { AclGuard } from '@/components/auth/AclGuard';
import { apiClient, ApiError } from '@/lib/api-client';
import { storage } from '@/lib/storage';
import {
  FrozenCategorySummary,
  OVERLAY_MAX_LENGTH,
  OVERLAY_PRESETS,
  ROTATE_DEFAULT,
  ROTATE_MAX,
  ROTATE_MIN,
  ScreenMode,
  ScreenSpotlight,
  ScreenView,
  describeScreenState,
  gameCodesForPatch,
  getLocalArenaSpotlight,
  getLocalFrozenCategories,
  isValidOverlayText,
  normalizeCodeInput,
  saveLocalArenaSpotlight,
  saveLocalFrozenCategories,
} from '@/lib/screens';

interface GameOption {
  code: string;
  name: string;
}

interface CategoryOption {
  id: number;
  name: string;
}

interface WorkoutOption {
  code: number;
  title: string;
  categoryId: number;
}

const OFFICIAL_HINT = 'Disponível após o cálculo oficial do juiz-chefe';

function friendlyError(err: unknown, context: 'claim' | 'other' = 'other'): string {
  if (err instanceof ApiError) {
    if (err.status === 404) {
      return context === 'claim'
        ? 'Código inválido ou expirado. Confira o código mostrado na TV.'
        : 'Telão não encontrado — ele pode ter sido removido.';
    }
    if (err.status === 429) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    if (err.status === 403) return 'Você não tem permissão para esta ação.';
    return err.message;
  }
  return 'Não foi possível concluir a ação. Tente novamente.';
}

const TONE_CLASS: Record<'live' | 'frozen' | 'offline', string> = {
  live: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  frozen: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  offline: 'bg-zinc-800 text-zinc-400 border-zinc-700',
};

const INPUT_CLASS =
  'w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500';
const LABEL_CLASS = 'text-xs font-bold text-zinc-300 block mb-1';

type Dialog =
  | { kind: 'claim' }
  | { kind: 'edit'; screen: ScreenView }
  | { kind: 'freeze'; screen: ScreenView | null }
  | { kind: 'heat_call'; screen: ScreenView | null }
  | { kind: 'podium'; screen: ScreenView | null }
  | { kind: 'remove'; screen: ScreenView }
  | null;

export default function TelasPage() {
  const [screens, setScreens] = useState<ScreenView[]>([]);
  const [games, setGames] = useState<GameOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [gamesError, setGamesError] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [now, setNow] = useState(() => new Date());
  const [localSpotlight, setLocalSpotlight] = useState<ScreenSpotlight | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await apiClient.listScreens();
      setScreens(list);
      setLoadError('');
    } catch (err) {
      setLoadError(friendlyError(err));
    } finally {
      setLoading(false);
      setNow(new Date());
      setLocalSpotlight(getLocalArenaSpotlight());
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 10_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const loadGames = useCallback(() => {
    apiClient
      .listMyGames()
      .then((list) => {
        setGames(list.map((g) => ({ code: g.code, name: g.name })));
        setGamesError(false);
      })
      .catch(() => {
        // Fallback para listGames públicos caso listMyGames falhe
        apiClient
          .listGames()
          .then((list) => {
            if (list && list.length > 0) {
              setGames(list.map((g) => ({ code: g.code, name: g.name })));
              setGamesError(false);
            } else {
              setGamesError(true);
            }
          })
          .catch(() => setGamesError(true));
      });
  }, []);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const gameName = useCallback(
    (code: string) => games.find((g) => g.code === code)?.name ?? code,
    [games],
  );

  const run = async (action: () => Promise<unknown>, okMessage: string, context: 'claim' | 'other' = 'other') => {
    try {
      await action();
      toast.success(okMessage);
      setDialog(null);
      await refresh();
    } catch (err) {
      toast.error(friendlyError(err, context));
      if (err instanceof ApiError && err.status === 404 && context === 'other') {
        setDialog(null);
        await refresh();
      }
    }
  };

  const anyFrozen = useMemo(
    () => screens.some((s) => s.frozen || (s.frozenCategories && s.frozenCategories.length > 0)),
    [screens],
  );

  const activeSpotlight = useMemo(
    () => screens.find((s) => s.spotlight)?.spotlight ?? localSpotlight,
    [screens, localSpotlight],
  );

  const handleClearSpotlight = async (screenId?: string) => {
    saveLocalArenaSpotlight(null);
    setLocalSpotlight(null);
    await run(
      () => apiClient.clearScreenSpotlight(screenId),
      'Transmissão especial encerrada. Os telões voltaram ao placar ao vivo.',
    );
  };

  const handleStepPodium = async (spot: Extract<ScreenSpotlight, { kind: 'podium' }>, nextStep: number) => {
    const updated: ScreenSpotlight = {
      ...spot,
      revealStep: nextStep,
      autoAdvance: false,
      triggeredAt: new Date().toISOString(),
    };
    saveLocalArenaSpotlight(updated);
    setLocalSpotlight(updated);
    await run(
      () =>
        apiClient.triggerScreenSpotlight({
          kind: 'podium',
          gameCode: spot.gameCode,
          categoryId: spot.categoryId,
          revealStep: nextStep,
          autoAdvance: false,
        }),
      nextStep === 3
        ? `🥇 1º Lugar CAMPEÃO revelado em ${spot.categoryName}!`
        : nextStep === 2
          ? `🥈 2º Lugar revelado em ${spot.categoryName}!`
          : `🥉 3º Lugar revelado em ${spot.categoryName}!`,
    );
  };

  const handleUnfreezeCategory = async (screenId: string | null, fc: FrozenCategorySummary) => {
    // Atualiza estado local para o Telão Web e Leaderboard
    const currentLocal = getLocalFrozenCategories(fc.gameCode);
    delete currentLocal[String(fc.categoryId)];
    saveLocalFrozenCategories(fc.gameCode, currentLocal);

    if (screenId) {
      await run(
        () => apiClient.unfreezeScreen(screenId, { gameCode: fc.gameCode, categoryIds: [fc.categoryId] }),
        `Categoria “${fc.categoryName}” liberada ao vivo!`,
      );
    } else {
      await run(
        () => apiClient.unfreezeAllScreens({ gameCode: fc.gameCode, categoryIds: [fc.categoryId] }),
        `Categoria “${fc.categoryName}” liberada em todos os telões!`,
      );
    }
  };

  return (
    <AclGuard resource="admin" requiredRoleLabel="Organizadores e Administradores">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Tv className="w-6 h-6 text-amber-400" />
            <div>
              <h1 className="text-xl font-black text-white">Telões & Show de Arena (Firestick / LED)</h1>
              <p className="text-xs text-zinc-400">
                Pareie TVs, congele categorias específicas em revisão, chame atletas para as raias e anuncie o pódio.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setDialog({ kind: 'heat_call', screen: null })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-black"
            >
              <Megaphone className="w-3.5 h-3.5" /> Chamar Atletas p/ Raias
            </button>
            <button
              onClick={() => setDialog({ kind: 'podium', screen: null })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-black"
            >
              <Trophy className="w-3.5 h-3.5" /> Anunciar Vencedores (Pódio)
            </button>
            <button
              onClick={() => setDialog({ kind: 'freeze', screen: null })}
              disabled={screens.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-xs font-bold disabled:opacity-40"
            >
              <Snowflake className="w-3.5 h-3.5" /> Congelar todos os meus telões
            </button>
            <button
              onClick={() => {
                games.forEach((g) => saveLocalFrozenCategories(g.code, {}));
                run(() => apiClient.unfreezeAllScreens(), 'Todos os seus telões foram descongelados.');
              }}
              disabled={!anyFrozen}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-bold disabled:opacity-40"
            >
              <Sun className="w-3.5 h-3.5" /> Descongelar todos os meus telões
            </button>
            <button
              onClick={() => setDialog({ kind: 'claim' })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black"
            >
              <Plus className="w-3.5 h-3.5" /> Parear telão
            </button>
          </div>
        </div>

        {/* BANNER DE CONTROLE AO VIVO QUANDO HÁ CHAMADA DE RAIAS OU PÓDIO ATIVO */}
        {activeSpotlight && (
          <div className="p-4 rounded-3xl bg-gradient-to-r from-amber-500/15 via-zinc-900 to-amber-500/15 border-2 border-amber-500/50 flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-black flex items-center justify-center font-black shrink-0">
                {activeSpotlight.kind === 'heat_call' ? <Megaphone className="w-5 h-5" /> : <Trophy className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-black">
                    {activeSpotlight.kind === 'heat_call' ? 'CHAMADA DE RAIAS NO AR' : 'CERIMÔNIA DE PÓDIO NO AR'}
                  </span>
                  <span className="text-xs font-bold text-zinc-300">{activeSpotlight.gameName}</span>
                </div>
                <p className="text-sm font-black text-white mt-0.5">
                  {activeSpotlight.categoryName}{' '}
                  {activeSpotlight.kind === 'heat_call'
                    ? `• ${activeSpotlight.workoutTitle} • Bateria ${activeSpotlight.heatNumber}/${activeSpotlight.totalHeats} (${activeSpotlight.startTime})`
                    : `• Etapa ${activeSpotlight.revealStep}/3 (${activeSpotlight.revealStep === 1 ? '3º Lugar' : activeSpotlight.revealStep === 2 ? '3º e 2º Lugares' : 'Pódio Completo 1º, 2º e 3º!'})`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeSpotlight.kind === 'podium' && (
                <>
                  <button
                    onClick={() => handleStepPodium(activeSpotlight, 1)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${
                      activeSpotlight.revealStep === 1
                        ? 'bg-amber-700 text-white border-amber-400'
                        : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800'
                    }`}
                  >
                    🥉 1. Revelar 3º Lugar
                  </button>
                  <button
                    onClick={() => handleStepPodium(activeSpotlight, 2)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${
                      activeSpotlight.revealStep === 2
                        ? 'bg-zinc-300 text-black border-white'
                        : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800'
                    }`}
                  >
                    🥈 2. Revelar 2º Lugar
                  </button>
                  <button
                    onClick={() => handleStepPodium(activeSpotlight, 3)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${
                      activeSpotlight.revealStep === 3
                        ? 'bg-amber-400 text-black border-amber-200 shadow-lg'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                    }`}
                  >
                    🥇 3. Revelar 1º CAMPEÃO!
                  </button>
                </>
              )}
              <button
                onClick={() => handleClearSpotlight()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-black"
              >
                <Square className="w-3.5 h-3.5" /> Voltar ao Placar
              </button>
            </div>
          </div>
        )}

        {loadError && (
          <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center justify-between gap-3">
            <span>{loadError}</span>
            <button onClick={refresh} className="flex items-center gap-1 font-bold underline">
              <RefreshCw className="w-3 h-3" /> Tentar de novo
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-xs text-zinc-400">Carregando telões…</div>
        ) : screens.length === 0 && !loadError ? (
          <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 text-center space-y-2">
            <Tv className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm font-bold text-white">Nenhum telão pareado</p>
            <p className="text-xs text-zinc-400">Abra a tela de pareamento na TV e use “Parear telão” para digitar o código exibido.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {screens.map((s) => {
              const state = describeScreenState(s, now);
              const hasCategoryFreezes = Boolean(s.frozenCategories && s.frozenCategories.length > 0);
              return (
                <li key={s.id} className="p-4 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h2 className="font-bold text-white text-sm truncate">{s.name}</h2>
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${TONE_CLASS[state.tone]}`}>
                        {state.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => setDialog({ kind: 'heat_call', screen: s })}
                        title="Chamar atletas para as raias neste telão"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[11px] font-bold"
                      >
                        <Megaphone className="w-3 h-3" /> Chamar Raias
                      </button>
                      <button
                        onClick={() => setDialog({ kind: 'podium', screen: s })}
                        title="Anunciar vencedores da categoria neste telão"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold"
                      >
                        <Trophy className="w-3 h-3" /> Pódio
                      </button>
                      {s.frozen ? (
                        <button
                          onClick={() => {
                            s.gameCodes.forEach((c) => saveLocalFrozenCategories(c, {}));
                            run(() => apiClient.unfreezeScreen(s.id), `“${s.name}” descongelado.`);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-[11px] font-bold"
                        >
                          <Sun className="w-3 h-3" /> Descongelar
                        </button>
                      ) : (
                        <button
                          onClick={() => setDialog({ kind: 'freeze', screen: s })}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-[11px] font-bold"
                        >
                          <Snowflake className="w-3 h-3" /> Congelar
                        </button>
                      )}
                      {hasCategoryFreezes && !s.frozen && (
                        <button
                          onClick={() => {
                            s.gameCodes.forEach((c) => saveLocalFrozenCategories(c, {}));
                            run(() => apiClient.unfreezeScreen(s.id), `Todas as categorias de “${s.name}” foram liberadas.`);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-[11px] font-bold"
                        >
                          <Sun className="w-3 h-3" /> Liberar todas
                        </button>
                      )}
                      <button
                        onClick={() => setDialog({ kind: 'edit', screen: s })}
                        title="Editar telão"
                        className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-300"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDialog({ kind: 'remove', screen: s })}
                        title="Remover telão"
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] text-zinc-400 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Modo: {s.mode === 'official' ? 'Oficial' : 'Parcial'}</span>
                    <span>Rotação: {s.rotateSeconds} s</span>
                    <span>
                      Campeonatos:{' '}
                      {s.gameCodes.length ? s.gameCodes.map(gameName).join(', ') : 'nenhum campeonato'}
                    </span>
                    {s.frozen && s.overlayText && <span className="text-sky-300">Aviso: {s.overlayText}</span>}
                  </div>

                  {/* PÍLULAS DE CATEGORIAS CONGELADAS INDIVIDUALMENTE */}
                  {hasCategoryFreezes && (
                    <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-sky-400 flex items-center gap-1">
                        <Snowflake className="w-3 h-3" /> Categorias Congeladas / Em Revisão:
                      </span>
                      {s.frozenCategories!.map((fc) => (
                        <span
                          key={`${fc.gameCode}:${fc.categoryId}`}
                          className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-200 text-[11px] font-bold"
                        >
                          <span>
                            {fc.categoryName} <span className="text-sky-400/80">({fc.overlayText})</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUnfreezeCategory(s.id, fc)}
                            className="px-1.5 py-0.5 rounded bg-sky-500/30 hover:bg-sky-500/50 text-white text-[10px] font-black"
                            title={`Liberar categoria ${fc.categoryName}`}
                          >
                            Liberar
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {dialog?.kind === 'claim' && (
        <ScreenFormDialog
          games={games}
          gamesError={gamesError}
          onRetryGames={loadGames}
          onClose={() => setDialog(null)}
          onSubmit={(v) =>
            run(
              () => apiClient.claimScreen({ code: v.code, name: v.name, gameCodes: v.gameCodes ?? [], mode: v.mode, rotateSeconds: v.rotateSeconds }),
              'Telão pareado com sucesso.',
              'claim',
            )
          }
        />
      )}
      {dialog?.kind === 'edit' && (
        <ScreenFormDialog
          games={games}
          gamesError={gamesError}
          onRetryGames={loadGames}
          screen={dialog.screen}
          onClose={() => setDialog(null)}
          onSubmit={(v) =>
            run(
              () => apiClient.updateScreen(dialog.screen.id, { name: v.name, gameCodes: v.gameCodes, mode: v.mode, rotateSeconds: v.rotateSeconds }),
              'Telão atualizado.',
            )
          }
        />
      )}
      {dialog?.kind === 'freeze' && (
        <FreezeDialog
          target={dialog.screen}
          games={games}
          onClose={() => setDialog(null)}
          onSubmit={(payload) => {
            const target = dialog.screen;
            if (payload.categoryIds && payload.categoryIds.length > 0 && payload.gameCode) {
              const currentLocal = getLocalFrozenCategories(payload.gameCode);
              const nowIso = new Date().toISOString();
              payload.categoryIds.forEach((catId) => {
                const catName = payload.categoryNames?.[catId] || `Categoria ${catId}`;
                currentLocal[String(catId)] = {
                  gameCode: payload.gameCode!,
                  categoryId: catId,
                  categoryName: catName,
                  overlayText: payload.text,
                  frozenAt: nowIso,
                };
              });
              saveLocalFrozenCategories(payload.gameCode, currentLocal);
            }
            const apiOpts =
              payload.categoryIds && payload.categoryIds.length > 0
                ? { text: payload.text, gameCode: payload.gameCode, categoryIds: payload.categoryIds }
                : payload.text;
            const msg =
              payload.categoryIds && payload.categoryIds.length > 0
                ? `${payload.categoryIds.length} categoria(s) colocada(s) em revisão no telão.`
                : target
                  ? `“${target.name}” congelado.`
                  : 'Todos os seus telões foram congelados.';
            return target
              ? run(() => apiClient.freezeScreen(target.id, apiOpts), msg)
              : run(() => apiClient.freezeAllScreens(apiOpts), msg);
          }}
        />
      )}
      {dialog?.kind === 'heat_call' && (
        <HeatCallDialog
          target={dialog.screen}
          games={games}
          onClose={() => setDialog(null)}
          onSubmit={async (payload) => {
            await run(async () => {
              const res = await apiClient.triggerScreenSpotlight({
                screenId: dialog.screen?.id,
                kind: 'heat_call',
                ...payload,
              });
              if (res?.spotlight) {
                saveLocalArenaSpotlight(res.spotlight);
                setLocalSpotlight(res.spotlight);
              }
            }, `📢 Chamada da Bateria ${payload.heatNumber} transmitida para os telões!`);
          }}
        />
      )}
      {dialog?.kind === 'podium' && (
        <PodiumDialog
          target={dialog.screen}
          games={games}
          onClose={() => setDialog(null)}
          onSubmit={async (payload) => {
            await run(async () => {
              const res = await apiClient.triggerScreenSpotlight({
                screenId: dialog.screen?.id,
                kind: 'podium',
                ...payload,
              });
              if (res?.spotlight) {
                saveLocalArenaSpotlight(res.spotlight);
                setLocalSpotlight(res.spotlight);
              }
            }, '🏆 Cerimônia de Pódio iniciada nos telões!');
          }}
        />
      )}
      {dialog?.kind === 'remove' && (
        <ModalShell title="Remover telão" onClose={() => setDialog(null)}>
          <p className="text-xs text-zinc-300">
            Remover <strong className="text-white">{dialog.screen.name}</strong>? A TV voltará à tela de pareamento e será
            preciso parear novamente.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setDialog(null)} className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-bold">
              Cancelar
            </button>
            <button
              onClick={() => run(() => apiClient.deleteScreen(dialog.screen.id), 'Telão removido.')}
              className="px-3 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white text-xs font-black"
            >
              Remover
            </button>
          </div>
        </ModalShell>
      )}
    </AclGuard>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const items = () => (node ? Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)) : []);
    const first = items().find((el) => el.getAttribute('aria-label') !== 'Fechar') ?? node;
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = items();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === firstEl || !node?.contains(active))) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && (active === lastEl || !node?.contains(active))) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto focus:outline-none"
      >
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <h3 id={titleId} className="font-bold text-white text-base">{title}</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-zinc-500 hover:text-white">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Helper que carrega as categorias de um campeonato (API com fallback local)
function useGameCategories(gameCode: string): CategoryOption[] {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  useEffect(() => {
    if (!gameCode) return;
    let cancelled = false;
    apiClient
      .listCategories(gameCode)
      .then((list) => {
        if (cancelled) return;
        if (list && list.length > 0) {
          setCategories(list.map((c: any) => ({ id: Number(c.code ?? c.id), name: c.name })));
        } else {
          const local = storage.getCategories(gameCode);
          setCategories(local.map((c) => ({ id: Number(String(c.id).replace(/\D/g, '')) || 1, name: c.name })));
        }
      })
      .catch(() => {
        if (cancelled) return;
        const local = storage.getCategories(gameCode);
        setCategories(local.map((c) => ({ id: Number(String(c.id).replace(/\D/g, '')) || 1, name: c.name })));
      });
    return () => {
      cancelled = true;
    };
  }, [gameCode]);
  return categories;
}

function ScreenFormDialog({
  games,
  gamesError,
  onRetryGames,
  screen,
  onClose,
  onSubmit,
}: {
  games: GameOption[];
  gamesError: boolean;
  onRetryGames: () => void;
  screen?: ScreenView;
  onClose: () => void;
  onSubmit: (v: { code: string; name: string; gameCodes: string[] | undefined; mode: ScreenMode; rotateSeconds: number }) => void | Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState(screen?.name ?? '');
  const [gameCodes, setGameCodes] = useState<string[]>(screen?.gameCodes ?? []);
  const [mode, setMode] = useState<ScreenMode>(screen?.mode ?? 'partial');
  const [rotate, setRotate] = useState<string>(String(screen?.rotateSeconds ?? ROTATE_DEFAULT));
  const [busy, setBusy] = useState(false);

  const rotateNum = Number(rotate);
  const rotateOk = Number.isInteger(rotateNum) && rotateNum >= ROTATE_MIN && rotateNum <= ROTATE_MAX;
  const codeOk = screen ? true : code.length === 6;
  const visibleSelected = gameCodes.filter((c) => games.some((g) => g.code === c));
  const canSubmit = codeOk && visibleSelected.length > 0 && name.trim().length > 0 && name.trim().length <= 60 && rotateOk && !busy;

  const toggleGame = (c: string) =>
    setGameCodes((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      const codes = screen
        ? gameCodesForPatch(screen.gameCodes, gameCodes, games.map((g) => g.code))
        : gameCodes;
      await onSubmit({ code, name: name.trim(), gameCodes: codes, mode, rotateSeconds: rotateNum });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title={screen ? 'Editar telão' : 'Parear telão'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {!screen && (
          <div>
            <label htmlFor="tv-code" className={LABEL_CLASS}>Código exibido na TV</label>
            <input
              id="tv-code"
              value={code}
              onChange={(e) => setCode(normalizeCodeInput(e.target.value))}
              placeholder="K7F29Q"
              autoComplete="off"
              className={`${INPUT_CLASS} font-mono tracking-[0.3em] text-base uppercase`}
            />
          </div>
        )}
        <div>
          <label htmlFor="tv-name" className={LABEL_CLASS}>Nome do telão</label>
          <input
            id="tv-name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Telão da entrada"
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <span className={LABEL_CLASS}>Campeonatos exibidos (selecione ao menos um)</span>
          {gamesError ? (
            <div role="alert" className="text-[11px] text-red-300 flex items-center justify-between gap-2">
              <span>Não foi possível carregar seus campeonatos.</span>
              <button type="button" onClick={onRetryGames} className="font-bold underline">Tentar de novo</button>
            </div>
          ) : games.length === 0 ? (
            <p className="text-[11px] text-zinc-500">Você ainda não tem campeonatos.</p>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-1 p-2 rounded-xl bg-zinc-950 border border-zinc-800">
              {games.map((g) => (
                <label key={g.code} className="flex items-center gap-2 text-xs text-zinc-200 cursor-pointer">
                  <input type="checkbox" checked={gameCodes.includes(g.code)} onChange={() => toggleGame(g.code)} />
                  {g.name}
                </label>
              ))}
            </div>
          )}
        </div>
        <div>
          <span className={LABEL_CLASS}>Modo</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('partial')}
              aria-pressed={mode === 'partial'}
              className={`p-3 rounded-xl border text-left text-xs ${mode === 'partial' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-zinc-950 border-zinc-700 text-zinc-300'}`}
            >
              <span className="font-bold block">Parcial</span>
              <span className="text-[10px] text-zinc-400">Placar em tempo real</span>
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              title={OFFICIAL_HINT}
              className="p-3 rounded-xl border border-zinc-800 bg-zinc-950 text-left text-xs opacity-60 cursor-not-allowed"
            >
              <span className="font-bold text-zinc-400 flex items-center gap-1"><Lock className="w-3 h-3" /> Oficial</span>
              <span className="text-[10px] text-zinc-500">{OFFICIAL_HINT}</span>
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="tv-rotate" className={LABEL_CLASS}>Tempo de rotação (segundos)</label>
          <input
            id="tv-rotate"
            type="number"
            min={ROTATE_MIN}
            max={ROTATE_MAX}
            value={rotate}
            onChange={(e) => setRotate(e.target.value)}
            className={INPUT_CLASS}
          />
          {!rotateOk && (
            <p className="text-[11px] text-red-400 mt-1">Informe um número inteiro entre {ROTATE_MIN} e {ROTATE_MAX}.</p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-bold">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black disabled:opacity-40"
          >
            {screen ? 'Salvar' : 'Parear'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function FreezeDialog({
  target,
  games,
  onClose,
  onSubmit,
}: {
  target: ScreenView | null;
  games: GameOption[];
  onClose: () => void;
  onSubmit: (payload: {
    text: string;
    gameCode?: string;
    categoryIds?: number[];
    categoryNames?: Record<number, string>;
  }) => void | Promise<void>;
}) {
  const defaultGame = target?.gameCodes?.[0] ?? games[0]?.code ?? 'SUMMER2026';
  const [scope, setScope] = useState<'all' | 'categories'>('all');
  const [selectedGameCode, setSelectedGameCode] = useState<string>(defaultGame);
  const categories = useGameCategories(selectedGameCode);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [choice, setChoice] = useState<string>(OVERLAY_PRESETS[0]);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);

  const text = choice === '__custom__' ? custom.trim() : choice;
  const validText = isValidOverlayText(text);
  const validScope = scope === 'all' || selectedCategoryIds.length > 0;
  const valid = validText && validScope;

  const toggleCategory = (id: number) => {
    setSelectedCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleScopeChange = (nextScope: 'all' | 'categories') => {
    setScope(nextScope);
    if (nextScope === 'categories' && choice === OVERLAY_PRESETS[0]) {
      setChoice('CATEGORIA EM REVISÃO');
    }
  };

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const catNames: Record<number, string> = {};
      categories.forEach((c) => {
        catNames[c.id] = c.name;
      });
      await onSubmit({
        text,
        gameCode: scope === 'categories' ? selectedGameCode : undefined,
        categoryIds: scope === 'categories' ? selectedCategoryIds : undefined,
        categoryNames: catNames,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title={target ? `Congelar “${target.name}”` : 'Congelar todos os meus telões'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <span className={LABEL_CLASS}>Escopo do Congelamento</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleScopeChange('all')}
              className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                scope === 'all'
                  ? 'bg-sky-500/20 border-sky-500/60 text-sky-200 font-bold'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400'
              }`}
            >
              <span className="block font-black">🌐 Todas as Categorias</span>
              <span className="text-[10px] text-zinc-400">Bloqueia o campeonato inteiro</span>
            </button>
            <button
              type="button"
              onClick={() => handleScopeChange('categories')}
              className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                scope === 'categories'
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 font-bold'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400'
              }`}
            >
              <span className="block font-black">🏷️ Por Categoria</span>
              <span className="text-[10px] text-zinc-400">Ex.: Scaled Masculino em revisão</span>
            </button>
          </div>
        </div>

        {scope === 'categories' && (
          <div className="space-y-2 p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
            {games.length > 1 && (
              <div>
                <label className={LABEL_CLASS}>Campeonato</label>
                <select
                  value={selectedGameCode}
                  onChange={(e) => {
                    setSelectedGameCode(e.target.value);
                    setSelectedCategoryIds([]);
                  }}
                  className={INPUT_CLASS}
                >
                  {games.map((g) => (
                    <option key={g.code} value={g.code}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <span className={LABEL_CLASS}>Selecione as categorias para colocar em revisão/bloqueio:</span>
            {categories.length === 0 ? (
              <p className="text-[11px] text-zinc-500">Nenhuma categoria encontrada neste campeonato.</p>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1.5">
                {categories.map((cat) => (
                  <label
                    key={cat.id}
                    className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                      selectedCategoryIds.includes(cat.id)
                        ? 'bg-sky-500/15 border-sky-500/50 text-sky-200 font-bold'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedCategoryIds.includes(cat.id)}
                        onChange={() => toggleCategory(cat.id)}
                      />
                      {cat.name}
                    </span>
                    {selectedCategoryIds.includes(cat.id) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/30 text-sky-200 font-black">
                        CONGELAR
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <p className="text-xs text-zinc-400 mb-2">Escolha o aviso que aparecerá sobre o placar congelado.</p>
          <div className="space-y-2">
            {OVERLAY_PRESETS.map((p) => (
              <label key={p} className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 cursor-pointer">
                <input type="radio" name="overlay" checked={choice === p} onChange={() => setChoice(p)} />
                {p}
              </label>
            ))}
            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 cursor-pointer">
              <input type="radio" name="overlay" checked={choice === '__custom__'} onChange={() => setChoice('__custom__')} />
              Texto livre
            </label>
            {choice === '__custom__' && (
              <div>
                <input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder="Ex.: SCALED MASCULINO EM REVISÃO"
                  aria-label="Texto livre do aviso"
                  className={INPUT_CLASS}
                  autoFocus
                />
                <p className={`text-[11px] mt-1 ${custom.trim().length > OVERLAY_MAX_LENGTH ? 'text-red-400' : 'text-zinc-500'}`}>
                  {custom.trim().length}/{OVERLAY_MAX_LENGTH} caracteres
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-bold">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!valid || busy}
            className="px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black text-xs font-black disabled:opacity-40"
          >
            Congelar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function HeatCallDialog({
  target,
  games,
  onClose,
  onSubmit,
}: {
  target: ScreenView | null;
  games: GameOption[];
  onClose: () => void;
  onSubmit: (payload: {
    gameCode: string;
    categoryId: number;
    workoutCode?: number;
    heatNumber: number;
    message: string;
  }) => void | Promise<void>;
}) {
  const defaultGame = target?.gameCodes?.[0] ?? games[0]?.code ?? 'SUMMER2026';
  const [gameCode, setGameCode] = useState(defaultGame);
  const categories = useGameCategories(gameCode);
  const [categoryId, setCategoryId] = useState<number>(0);
  const [workouts, setWorkouts] = useState<WorkoutOption[]>([]);
  const [workoutCode, setWorkoutCode] = useState<number>(0);
  const [heatNumber, setHeatNumber] = useState<number>(1);
  const [message, setMessage] = useState('ATLETAS DA BATERIA, DIRIJAM-SE ÀS SUAS RAIAS DE LARGADA');
  const [busy, setBusy] = useState(false);

  const effectiveCatId = categoryId || categories[0]?.id || 1;

  useEffect(() => {
    if (!gameCode) return;
    apiClient
      .listWorkouts(gameCode)
      .then((list) => {
        if (list && list.length > 0) {
          setWorkouts(
            list.map((w: any) => ({
              code: Number(w.code ?? w.id),
              title: w.title || `WOD ${w.code}`,
              categoryId: Number(w.category ?? w.categoryId),
            })),
          );
        }
      })
      .catch(() => {});
  }, [gameCode]);

  const catWorkouts = workouts.filter((w) => !w.categoryId || w.categoryId === effectiveCatId);
  const effectiveWodCode = workoutCode || catWorkouts[0]?.code || undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !gameCode) return;
    setBusy(true);
    try {
      await onSubmit({
        gameCode,
        categoryId: effectiveCatId,
        workoutCode: effectiveWodCode,
        heatNumber: Math.max(1, heatNumber),
        message: message.trim() || 'DIRIJAM-SE ÀS RAIAS DE LARGADA',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title={target ? `📢 Chamar Atletas p/ Raias em “${target.name}”` : '📢 Chamar Atletas para as Raias (Todos os Telões)'}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs text-zinc-400">
          Exibe nos telões Firestick e Telão Web o painel de chamada oficial da bateria com cada Raia, BIB, equipe e atletas.
        </p>

        {games.length > 1 && (
          <div>
            <label className={LABEL_CLASS}>Campeonato</label>
            <select value={gameCode} onChange={(e) => setGameCode(e.target.value)} className={INPUT_CLASS}>
              {games.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={LABEL_CLASS}>Categoria</label>
          <select
            value={effectiveCatId}
            onChange={(e) => {
              setCategoryId(Number(e.target.value));
              setWorkoutCode(0);
            }}
            className={INPUT_CLASS}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Prova / WOD</label>
            <select
              value={effectiveWodCode ?? ''}
              onChange={(e) => setWorkoutCode(Number(e.target.value))}
              className={INPUT_CLASS}
            >
              {catWorkouts.length === 0 ? (
                <option value="">WOD 1</option>
              ) : (
                catWorkouts.map((w) => (
                  <option key={w.code} value={w.code}>
                    {w.title}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className={LABEL_CLASS}>Nº da Bateria (Heat)</label>
            <input
              type="number"
              min={1}
              max={30}
              value={heatNumber}
              onChange={(e) => setHeatNumber(Math.max(1, Number(e.target.value)))}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div>
          <label className={LABEL_CLASS}>Mensagem de Chamada no Telão</label>
          <input
            value={message}
            maxLength={80}
            onChange={(e) => setMessage(e.target.value)}
            className={INPUT_CLASS}
            placeholder="Ex.: ATLETAS DA BATERIA, DIRIJAM-SE ÀS RAIAS DE LARGADA"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-bold">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black disabled:opacity-40"
          >
            <Megaphone className="w-3.5 h-3.5" /> Transmitir Chamada nos Telões
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function PodiumDialog({
  target,
  games,
  onClose,
  onSubmit,
}: {
  target: ScreenView | null;
  games: GameOption[];
  onClose: () => void;
  onSubmit: (payload: {
    gameCode: string;
    categoryId: number;
    revealStep: number;
    autoAdvance: boolean;
  }) => void | Promise<void>;
}) {
  const defaultGame = target?.gameCodes?.[0] ?? games[0]?.code ?? 'SUMMER2026';
  const [gameCode, setGameCode] = useState(defaultGame);
  const categories = useGameCategories(gameCode);
  const [categoryId, setCategoryId] = useState<number>(0);
  const [revealMode, setRevealMode] = useState<'suspense_manual' | 'suspense_auto' | 'full'>('suspense_auto');
  const [busy, setBusy] = useState(false);

  const effectiveCatId = categoryId || categories[0]?.id || 1;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !gameCode) return;
    setBusy(true);
    try {
      await onSubmit({
        gameCode,
        categoryId: effectiveCatId,
        revealStep: revealMode === 'full' ? 3 : 1,
        autoAdvance: revealMode === 'suspense_auto',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title={target ? `🏆 Anunciar Vencedores em “${target.name}”` : '🏆 Cerimônia de Pódio — Anunciar Vencedores'}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs text-zinc-400">
          Inicia a cerimônia oficial de pódio no Firestick e Telão LED com animação dourada e destaque para 1º, 2º e 3º lugares.
        </p>

        {games.length > 1 && (
          <div>
            <label className={LABEL_CLASS}>Campeonato</label>
            <select value={gameCode} onChange={(e) => setGameCode(e.target.value)} className={INPUT_CLASS}>
              {games.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={LABEL_CLASS}>Categoria a Premiar</label>
          <select
            value={effectiveCatId}
            onChange={(e) => setCategoryId(Number(e.target.value))}
            className={INPUT_CLASS}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <span className={LABEL_CLASS}>Modo de Revelação na TV</span>
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 cursor-pointer">
            <input
              type="radio"
              name="revealMode"
              checked={revealMode === 'suspense_auto'}
              onChange={() => setRevealMode('suspense_auto')}
              className="mt-0.5"
            />
            <div>
              <span className="font-black text-amber-300 block">✨ Suspense Automático (3º ➔ 2º ➔ 1º Campeão)</span>
              <span className="text-[11px] text-zinc-400">
                Revela o 3º lugar primeiro, depois o 2º lugar após 5s, e coroação do 1º lugar Campeão!
              </span>
            </div>
          </label>
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 cursor-pointer">
            <input
              type="radio"
              name="revealMode"
              checked={revealMode === 'suspense_manual'}
              onChange={() => setRevealMode('suspense_manual')}
              className="mt-0.5"
            />
            <div>
              <span className="font-black text-white block">🎙️ Suspense Controlado pelo Locutor (Passo a Passo)</span>
              <span className="text-[11px] text-zinc-400">
                Inicia no 3º lugar e você clica (ou aperta OK no controle do Firestick) para revelar o 2º e o 1º lugar.
              </span>
            </div>
          </label>
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 cursor-pointer">
            <input
              type="radio"
              name="revealMode"
              checked={revealMode === 'full'}
              onChange={() => setRevealMode('full')}
              className="mt-0.5"
            />
            <div>
              <span className="font-black text-emerald-300 block">🏆 Pódio Completo Imediato</span>
              <span className="text-[11px] text-zinc-400">Exibe 1º, 2º e 3º colocados juntos imediatamente na TV.</span>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-bold">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black disabled:opacity-40"
          >
            <Trophy className="w-3.5 h-3.5" /> Iniciar Cerimônia de Pódio
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

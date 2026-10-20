'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Tv, Plus, Snowflake, Sun, Trash2, Pencil, RefreshCw, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { AclGuard } from '@/components/auth/AclGuard';
import { apiClient, ApiError } from '@/lib/api-client';
import {
  OVERLAY_MAX_LENGTH,
  OVERLAY_PRESETS,
  ROTATE_DEFAULT,
  ROTATE_MAX,
  ROTATE_MIN,
  ScreenMode,
  ScreenView,
  describeScreenState,
  isValidOverlayText,
  normalizeCodeInput,
} from '@/lib/screens';

interface GameOption {
  code: string;
  name: string;
}

const OFFICIAL_HINT = 'Disponível após o cálculo oficial do juiz-chefe';

// Traduz erros da API para mensagens amigáveis.
// No pareamento, 404 significa código inválido; nas demais ações, o telão não existe mais.
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
  | { kind: 'freeze'; screen: ScreenView | null } // null = congelar todos
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
    }
  }, []);

  // Atualização automática da lista a cada 10 s.
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
      .catch(() => setGamesError(true));
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
      // Telão que sumiu: fecha o diálogo e atualiza a lista.
      if (err instanceof ApiError && err.status === 404 && context === 'other') {
        setDialog(null);
        await refresh();
      }
    }
  };

  const anyFrozen = useMemo(() => screens.some((s) => s.frozen), [screens]);

  return (
    <AclGuard resource="admin" requiredRoleLabel="Organizadores e Administradores">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Tv className="w-6 h-6 text-amber-400" />
            <div>
              <h1 className="text-xl font-black text-white">Telões</h1>
              <p className="text-xs text-zinc-400">Pareie TVs, escolha os campeonatos exibidos e congele o placar.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setDialog({ kind: 'freeze', screen: null })}
              disabled={screens.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-xs font-bold disabled:opacity-40"
            >
              <Snowflake className="w-3.5 h-3.5" /> Congelar todos
            </button>
            <button
              onClick={() => run(() => apiClient.unfreezeAllScreens(), 'Todos os telões foram descongelados.')}
              disabled={!anyFrozen}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-bold disabled:opacity-40"
            >
              <Sun className="w-3.5 h-3.5" /> Descongelar todos
            </button>
            <button
              onClick={() => setDialog({ kind: 'claim' })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black"
            >
              <Plus className="w-3.5 h-3.5" /> Parear telão
            </button>
          </div>
        </div>

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
              return (
                <li key={s.id} className="p-4 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h2 className="font-bold text-white text-sm truncate">{s.name}</h2>
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${TONE_CLASS[state.tone]}`}>
                        {state.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {s.frozen ? (
                        <button
                          onClick={() => run(() => apiClient.unfreezeScreen(s.id), `“${s.name}” descongelado.`)}
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
              () => apiClient.claimScreen({ code: v.code, name: v.name, gameCodes: v.gameCodes, mode: v.mode, rotateSeconds: v.rotateSeconds }),
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
          onClose={() => setDialog(null)}
          onSubmit={(text) => {
            const target = dialog.screen;
            return target
              ? run(() => apiClient.freezeScreen(target.id, text), `“${target.name}” congelado.`)
              : run(() => apiClient.freezeAllScreens(text), 'Todos os telões foram congelados.');
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

// Modal acessível: Esc fecha, o foco entra no modal e fica preso, e volta a quem abriu ao fechar.
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const items = () => (node ? Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)) : []);
    // Foca o primeiro campo (ignorando o botão de fechar); senão o próprio diálogo.
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
  onSubmit: (v: { code: string; name: string; gameCodes: string[]; mode: ScreenMode; rotateSeconds: number }) => void | Promise<void>;
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
  const canSubmit = codeOk && gameCodes.length > 0 && name.trim().length > 0 && name.trim().length <= 60 && rotateOk && !busy;

  const toggleGame = (c: string) =>
    setGameCodes((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onSubmit({ code, name: name.trim(), gameCodes, mode, rotateSeconds: rotateNum });
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
  onClose,
  onSubmit,
}: {
  target: ScreenView | null;
  onClose: () => void;
  onSubmit: (text: string) => void | Promise<void>;
}) {
  // Opção selecionada: um modelo ou '__custom__' para texto livre.
  const [choice, setChoice] = useState<string>(OVERLAY_PRESETS[0]);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);

  const text = choice === '__custom__' ? custom.trim() : choice;
  const valid = isValidOverlayText(text);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onSubmit(text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title={target ? `Congelar “${target.name}”` : 'Congelar todos os telões'} onClose={onClose}>
      <p className="text-xs text-zinc-400">Escolha o aviso que aparecerá sobre o placar congelado.</p>
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
              placeholder="Ex.: INTERVALO — VOLTAMOS EM 10 MIN"
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
    </ModalShell>
  );
}

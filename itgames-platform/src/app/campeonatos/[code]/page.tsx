'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CalendarDays, Layers, Lock, MapPin, Timer, Users } from 'lucide-react';
import { apiClient, assetUrl } from '@/lib/api-client';
import { parseWodTitle, sortWorkoutsNaturally } from '@/lib/board';
import { storage } from '@/lib/storage';
import { evaluateRegistrationAvailability } from '@/lib/registration-lock';

interface Workout {
  code: number;
  title?: string | null;
  type?: string | null;
  timeCap?: string | null;
  description?: string | null;
  category: number;
}

interface PublicCategory {
  code: number;
  name: string;
  description?: string | null;
  standards?: string | null;
  amount?: number | null;
  teamType?: string | null;
  genderRule?: string | null;
  maxAthlete?: number | null;
  minIndividualAge?: number | null;
  maxIndividualAge?: number | null;
  minTeamSumAge?: number | null;
  workouts?: Workout[];
  _count?: { registrations?: number };
}

interface PublicGame {
  code: string;
  name: string;
  date?: string | null;
  location?: string | null;
  description?: string | null;
  eventType?: string | null;
  foto?: string | null;
  lanesCount?: number | null;
  status?: string | null;
  registrationLocked?: boolean | null;
  registrationStartAt?: string | null;
  registrationCloseAt?: string | null;
  categories?: PublicCategory[];
  organizers?: { id: string; name: string }[];
}

interface PublicHeat {
  id: string;
  heatNumber: number;
  startTime: string;
  status: string;
  categoryId: number;
  slots: {
    id: string;
    laneNumber: number;
    registration?: { team: string; number?: string | null; athletes?: { name: string }[] };
  }[];
}

const TEAM_LABEL: Record<string, string> = {
  individual: 'Individual',
  duo: 'Dupla',
  trio: 'Trio',
  team_4: 'Time de 4',
};

const GENDER_LABEL: Record<string, string> = {
  open: 'Livre',
  male: 'Masculino',
  female: 'Feminino',
  mixed_1m_1f: 'Misto (1M + 1F)',
  mixed_2m_2f: 'Misto (2M + 2F)',
  mixed_free: 'Misto',
};

const HEAT_STATUS: Record<string, string> = {
  scheduled: 'Agendada',
  calling: 'Chamando',
  in_progress: 'Em andamento',
  completed: 'Concluída',
};

function formatDate(date?: string | null) {
  if (!date) return 'Data a definir';
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('pt-BR');
}

function ageRule(c: PublicCategory) {
  const parts: string[] = [];
  if (c.minIndividualAge) parts.push(`mínimo ${c.minIndividualAge} anos`);
  if (c.maxIndividualAge) parts.push(`máximo ${c.maxIndividualAge} anos`);
  if (c.minTeamSumAge) parts.push(`soma das idades ${c.minTeamSumAge}+`);
  return parts.join(' • ');
}

export default function PublicGamePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = decodeURIComponent(String(params.code));

  const [game, setGame] = useState<PublicGame | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [selectedCategoryCode, setSelectedCategoryCode] = useState<number | null>(null);
  const [workoutCode, setWorkoutCode] = useState<number | null>(null);
  const [heats, setHeats] = useState<PublicHeat[] | null>(null);

  const loadHeatsForWorkout = (wodCode: number) => {
    setWorkoutCode(wodCode);
    setHeats(null);
    apiClient.getHeats(code, wodCode).then((list) => setHeats((list as unknown as PublicHeat[]) || []));
  };

  useEffect(() => {
    apiClient.getGame(code).then((data) => {
      if (!data) {
        setState('missing');
        return;
      }
      const loaded = data as PublicGame;
      setGame(loaded);
      setState('ready');

      const cats = loaded.categories || [];
      if (cats.length > 0) {
        const firstCat = cats[0];
        setSelectedCategoryCode(firstCat.code);
        const sortedFirstWods = sortWorkoutsNaturally(firstCat.workouts || []);
        if (sortedFirstWods.length > 0) {
          setWorkoutCode(sortedFirstWods[0].code);
          setHeats(null);
          apiClient
            .getHeats(code, sortedFirstWods[0].code)
            .then((list) => setHeats((list as unknown as PublicHeat[]) || []));
        }
      }
    });
  }, [code]);

  const categories = game?.categories || [];
  const activeCategory = categories.find((c) => c.code === selectedCategoryCode) || categories[0] || null;
  const activeCategoryWorkouts = sortWorkoutsNaturally(activeCategory?.workouts || []);
  const selectedWorkout =
    activeCategoryWorkouts.find((w) => w.code === workoutCode) || activeCategoryWorkouts[0] || null;
  const regAvailability = evaluateRegistrationAvailability(game);
  const visibleHeats = (heats || []).filter(
    (h) => !activeCategory || !h.categoryId || h.categoryId === activeCategory.code,
  );

  const handleSelectCategory = (catCode: number, scrollIfNeeded = false) => {
    setSelectedCategoryCode(catCode);
    const targetCat = categories.find((c) => c.code === catCode);
    const sortedWods = sortWorkoutsNaturally(targetCat?.workouts || []);
    if (sortedWods.length > 0) {
      loadHeatsForWorkout(sortedWods[0].code);
    } else {
      setWorkoutCode(null);
      setHeats([]);
    }
    if (scrollIfNeeded && typeof document !== 'undefined') {
      const el = document.getElementById('wods');
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top > window.innerHeight * 0.72) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  };

  const selectWorkout = (value: number) => {
    loadHeatsForWorkout(value);
  };

  const handleRegister = () => {
    storage.setActiveGameId(code);
    router.push('/athlete/register');
  };

  if (state === 'loading') {
    return <p className="max-w-5xl mx-auto px-4 py-10 text-sm text-zinc-500">Carregando campeonato...</p>;
  }

  if (state === 'missing' || !game) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-xl font-black text-white">Campeonato não encontrado</h1>
        <p className="text-sm text-zinc-400">Ele não existe ou ainda não foi liberado para o público.</p>
        <Link href="/" className="inline-flex items-center gap-2 text-amber-400 text-sm font-bold">
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar aos campeonatos</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white">
        <ArrowLeft className="w-4 h-4" />
        <span>Todos os campeonatos</span>
      </Link>

      <header className="rounded-3xl bg-zinc-900 border border-zinc-800 overflow-hidden">
        {game.foto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={assetUrl(game.foto)} alt={`Banner do campeonato ${game.name}`} className="w-full h-48 object-cover" />
        )}
        <div className="p-6 sm:p-8 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase">
            <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono">
              {game.code}
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              {game.eventType === 'hyrox' ? 'HYROX' : 'CrossFit'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">{game.name}</h1>
          {game.description && <p className="text-sm text-zinc-400">{game.description}</p>}
          <ul className="text-sm text-zinc-300 space-y-1.5">
            <li className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-zinc-500" />
              <span>{formatDate(game.date)}</span>
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-zinc-500" />
              <span>{game.location || 'Local a definir'}</span>
            </li>
            {(game.organizers || []).length > 0 && (
              <li className="flex items-center gap-2">
                <Users className="w-4 h-4 text-zinc-500" />
                <span>Organização: {(game.organizers || []).map((o) => o.name).join(', ')}</span>
              </li>
            )}
          </ul>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {regAvailability.isOpen ? (
                <button
                  onClick={handleRegister}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-sm min-h-[44px]"
                >
                  Fazer minha inscrição
                </button>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 font-black text-xs sm:text-sm min-h-[44px]">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>{regAvailability.badgeText}</span>
                </div>
              )}
              <Link
                href={`/leaderboard?game=${encodeURIComponent(game.code)}`}
                className="px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-black text-sm border border-zinc-700 min-h-[44px] inline-flex items-center"
              >
                Ver classificação
              </Link>
            </div>
            {!regAvailability.isOpen ? (
              <p className="text-xs text-rose-300/90 bg-rose-950/30 border border-rose-500/30 rounded-xl px-3.5 py-2 inline-block">
                {regAvailability.reason}
              </p>
            ) : regAvailability.closeAtFormatted ? (
              <p className="text-xs text-emerald-300/90">
                Prazo limite de inscrições: <strong>{regAvailability.closeAtFormatted}</strong>
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <section aria-labelledby="categorias" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="categorias" className="text-lg font-black text-white">
            Categorias
          </h2>
          {categories.length > 0 && (
            <span className="text-xs text-zinc-400">Selecione uma categoria para ver suas provas e baterias</span>
          )}
        </div>
        {categories.length === 0 && <p className="text-sm text-zinc-500">As categorias ainda não foram divulgadas.</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categories.map((c) => {
            const isActiveCat = activeCategory?.code === c.code;
            const wodCount = (c.workouts || []).length;
            const regCount = c._count?.registrations ?? 0;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => handleSelectCategory(c.code, true)}
                aria-pressed={isActiveCat}
                className={`p-4 rounded-2xl border text-left space-y-1.5 transition-all ${
                  isActiveCat
                    ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500/40'
                    : 'bg-zinc-900 border-zinc-800 hover:border-amber-500/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-black text-white">{c.name}</h3>
                  <span className="text-sm font-black text-amber-400 whitespace-nowrap">
                    {c.amount ? `R$ ${Number(c.amount).toFixed(2)}` : 'Gratuita'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  {TEAM_LABEL[c.teamType || 'individual'] || c.teamType} • {GENDER_LABEL[c.genderRule || 'open'] || c.genderRule}
                  {ageRule(c) ? ` • ${ageRule(c)}` : ''}
                </p>
                {c.description && <p className="text-xs text-zinc-400">{c.description}</p>}
                <div className="pt-1 flex items-center justify-between gap-2 text-[11px] font-bold">
                  <span className="text-zinc-400">
                    {regCount} {regCount === 1 ? 'equipe' : 'equipes'} • {wodCount} {wodCount === 1 ? 'prova' : 'provas'}
                  </span>
                  <span className={isActiveCat ? 'text-amber-400' : 'text-zinc-500'}>
                    {isActiveCat ? 'Ativa ↓' : 'Ver WODs →'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section id="wods" aria-labelledby="wods-heading" className="space-y-4 scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400 shrink-0" />
            <h2 id="wods-heading" className="text-lg font-black text-white">
              WODs e baterias
            </h2>
          </div>

          {categories.length > 0 && activeCategory && (
            <div className="flex items-center gap-2">
              <label htmlFor="wods-category-select" className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider shrink-0">
                Categoria:
              </label>
              <select
                id="wods-category-select"
                value={activeCategory.code}
                onChange={(e) => handleSelectCategory(Number(e.target.value))}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-amber-500/40 text-xs font-black text-amber-400 focus:outline-none focus:border-amber-500"
              >
                {categories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c._count?.registrations ?? 0} equipes)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {categories.length === 0 ? (
          <p className="text-sm text-zinc-500">Os WODs ainda não foram divulgados.</p>
        ) : (
          <div className="space-y-3">
            {/* BARRA COMPACTA DE 4 ABAS DE WOD EM ORDEM NATURAL */}
            {activeCategoryWorkouts.length === 0 ? (
              <p className="text-sm text-zinc-500 p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
                Os WODs desta categoria ainda não foram divulgados.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {activeCategoryWorkouts.map((w, idx) => {
                  const isSelectedWod = selectedWorkout?.code === w.code;
                  const { shortTitle, subtitle } = parseWodTitle(w.title, idx);
                  return (
                    <button
                      key={`${w.category}-${w.code}`}
                      type="button"
                      onClick={() => selectWorkout(w.code)}
                      aria-pressed={isSelectedWod}
                      className={`px-3 py-2.5 rounded-xl text-left border transition-all min-h-[58px] flex flex-col justify-between gap-0.5 ${
                        isSelectedWod
                          ? 'bg-amber-500 text-black border-amber-500 shadow-sm'
                          : 'bg-zinc-900 text-zinc-200 border-zinc-800 hover:border-amber-500/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-black tracking-tight">{shortTitle}</span>
                        {w.timeCap && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isSelectedWod ? 'bg-black/15 text-black' : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {w.timeCap}
                          </span>
                        )}
                      </div>
                      <div className={`text-[11px] font-bold truncate ${isSelectedWod ? 'text-black/80' : 'text-zinc-400'}`}>
                        {subtitle || w.type?.replace('_', ' ') || 'Prova Oficial'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* PAINEL ÚNICO INTEGRADO: DETALHES DO WOD + BATERIAS */}
            {selectedWorkout && (
              <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
                <div className="p-4 sm:p-5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-black text-white text-sm sm:text-base">
                      {selectedWorkout.title || `WOD ${selectedWorkout.code}`}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                      {selectedWorkout.timeCap && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700">
                          <Timer className="w-3.5 h-3.5 text-amber-400" />
                          Time cap: {selectedWorkout.timeCap}
                        </span>
                      )}
                      {heats !== null && (
                        <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                          {visibleHeats.length} {visibleHeats.length === 1 ? 'bateria' : 'baterias'}
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedWorkout.description && (
                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                      {selectedWorkout.description}
                    </p>
                  )}
                </div>

                <div className="p-4 sm:p-5 border-t border-zinc-800 bg-zinc-950/30 space-y-3">
                  {heats === null && <p className="text-xs text-zinc-500">Carregando baterias e raias...</p>}
                  {heats !== null && visibleHeats.length === 0 && (
                    <p className="text-xs text-zinc-500">
                      As baterias deste WOD na categoria {activeCategory?.name} ainda não foram geradas.
                    </p>
                  )}
                  {visibleHeats.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {visibleHeats.map((h) => (
                        <div key={h.id} className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
                          <div className="px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 text-xs bg-zinc-950/50">
                            <span className="font-black text-white">
                              Bateria #{h.heatNumber}
                            </span>
                            <span className="text-zinc-400 font-semibold text-[11px]">
                              {h.startTime} • {HEAT_STATUS[h.status] || h.status}
                            </span>
                          </div>
                          <ul className="divide-y divide-zinc-800 text-xs">
                            {h.slots.map((s) => (
                              <li key={s.id} className="px-3.5 py-2 flex items-center gap-2.5">
                                <span className="w-12 shrink-0 font-black text-amber-400">Raia {s.laneNumber}</span>
                                <span className="text-zinc-200 min-w-0 flex-1">
                                  <strong className="truncate block sm:inline">
                                    {s.registration?.team}
                                    {s.registration?.number ? ` (${s.registration.number})` : ''}
                                  </strong>
                                  {(s.registration?.athletes || []).length > 0 && (
                                    <span className="text-zinc-400 text-[11px]">
                                      <span className="hidden sm:inline"> — </span>
                                      {(s.registration?.athletes || []).map((a) => a.name).join(', ')}
                                    </span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

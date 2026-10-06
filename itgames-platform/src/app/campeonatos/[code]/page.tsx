'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CalendarDays, MapPin, Timer, Users } from 'lucide-react';
import { apiClient, assetUrl } from '@/lib/api-client';
import { storage } from '@/lib/storage';

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
  const [workoutCode, setWorkoutCode] = useState<number | null>(null);
  const [heats, setHeats] = useState<PublicHeat[] | null>(null);

  useEffect(() => {
    apiClient.getGame(code).then((data) => {
      if (!data) {
        setState('missing');
        return;
      }
      setGame(data as PublicGame);
      setState('ready');
    });
  }, [code]);

  const categories = game?.categories || [];
  const workouts = categories.flatMap((c) => (c.workouts || []).map((w) => ({ ...w, categoryName: c.name })));
  const categoryName = (id: number) => categories.find((c) => c.code === id)?.name || `Categoria ${id}`;

  const selectWorkout = (value: number) => {
    setWorkoutCode(value);
    setHeats(null);
    apiClient.getHeats(code, value).then((list) => setHeats((list as unknown as PublicHeat[]) || []));
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
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleRegister}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-sm"
            >
              Fazer minha inscrição
            </button>
            <Link
              href={`/leaderboard?game=${encodeURIComponent(game.code)}`}
              className="px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-black text-sm border border-zinc-700"
            >
              Ver classificação
            </Link>
          </div>
        </div>
      </header>

      <section aria-labelledby="categorias" className="space-y-3">
        <h2 id="categorias" className="text-lg font-black text-white">
          Categorias
        </h2>
        {categories.length === 0 && <p className="text-sm text-zinc-500">As categorias ainda não foram divulgadas.</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categories.map((c) => (
            <div key={c.code} className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1.5">
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
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="wods" className="space-y-3">
        <h2 id="wods" className="text-lg font-black text-white">
          WODs e baterias
        </h2>
        {workouts.length === 0 && <p className="text-sm text-zinc-500">Os WODs ainda não foram divulgados.</p>}

        <div className="flex flex-wrap gap-2">
          {workouts.map((w) => (
            <button
              key={`${w.category}-${w.code}`}
              onClick={() => selectWorkout(w.code)}
              aria-pressed={workoutCode === w.code}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                workoutCode === w.code
                  ? 'bg-amber-500 text-black border-amber-500'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-amber-500/60'
              }`}
            >
              {w.title || `WOD ${w.code}`}
              <span className="ml-1 opacity-70">• {w.categoryName}</span>
            </button>
          ))}
        </div>

        {workoutCode !== null && (
          <div className="space-y-3">
            {(() => {
              const selected = workouts.find((w) => w.code === workoutCode);
              return selected ? (
                <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 space-y-1">
                  <div className="font-black text-white text-sm">{selected.title || `WOD ${selected.code}`}</div>
                  {selected.timeCap && (
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <Timer className="w-3.5 h-3.5" />
                      <span>Time cap: {selected.timeCap}</span>
                    </div>
                  )}
                  {selected.description && <p>{selected.description}</p>}
                </div>
              ) : null;
            })()}

            {heats === null && <p className="text-sm text-zinc-500">Carregando baterias...</p>}
            {heats !== null && heats.length === 0 && (
              <p className="text-sm text-zinc-500">As baterias deste WOD ainda não foram geradas.</p>
            )}
            {(heats || []).map((h) => (
              <div key={h.id} className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
                <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 text-xs">
                  <span className="font-black text-white">
                    Bateria {h.heatNumber} • {categoryName(h.categoryId)}
                  </span>
                  <span className="text-zinc-400">
                    {h.startTime} • {HEAT_STATUS[h.status] || h.status}
                  </span>
                </div>
                <ul className="divide-y divide-zinc-800 text-xs">
                  {h.slots.map((s) => (
                    <li key={s.id} className="px-4 py-2 flex items-center gap-3">
                      <span className="w-14 shrink-0 font-black text-amber-400">Raia {s.laneNumber}</span>
                      <span className="text-zinc-200">
                        <strong>{s.registration?.team}</strong>
                        {(s.registration?.athletes || []).length > 0 && (
                          <span className="text-zinc-400"> — {(s.registration?.athletes || []).map((a) => a.name).join(', ')}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

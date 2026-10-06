'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Flame, MapPin, Trophy, Users } from 'lucide-react';
import { apiClient, assetUrl } from '@/lib/api-client';
import { getCurrentUserSession, homeForRole, UserSession } from '@/lib/acl';

interface PublicGame {
  code: string;
  name: string;
  date?: string | null;
  location?: string | null;
  description?: string | null;
  eventType?: string | null;
  foto?: string | null;
  categories?: { code: number }[];
  organizers?: { id: string; name: string }[];
  _count?: { registrations: number };
}

function formatDate(date?: string | null) {
  if (!date) return 'Data a definir';
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('pt-BR');
}

export default function HomePage() {
  const [games, setGames] = useState<PublicGame[] | null>(null);
  const [session, setSession] = useState<UserSession>({ role: 'GUEST' });

  useEffect(() => {
    // a sessão é lida junto com a resposta da API (evita setState síncrono no efeito)
    apiClient
      .listGames()
      .then((list) => {
        setSession(getCurrentUserSession());
        setGames((list as PublicGame[]) || []);
      })
      .catch(() => {
        setSession(getCurrentUserSession());
        setGames([]);
      });
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-700/80 p-8 sm:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <Flame className="w-3.5 h-3.5" />
            <span>CrossFit • HYROX • Fitness Racing</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight">
            Campeonatos <span className="text-amber-400">abertos</span> na ITGames Arena
          </h1>
          <p className="text-sm sm:text-base text-zinc-400">
            Veja os campeonatos em andamento, confira categorias, WODs e baterias e faça a sua inscrição.
          </p>
          {session.role !== 'GUEST' && (
            <Link
              href={homeForRole(session.role)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black text-xs"
            >
              <span>Ir para o meu painel</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </section>

      <section aria-labelledby="campeonatos-ativos" className="space-y-4">
        <h2 id="campeonatos-ativos" className="text-xl font-black text-white flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <span>Campeonatos ativos</span>
        </h2>

        {games === null && <p className="text-sm text-zinc-500">Carregando campeonatos...</p>}

        {games !== null && games.length === 0 && (
          <div className="p-10 text-center rounded-3xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-sm">
            Nenhum campeonato liberado no momento. Volte em breve!
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {(games || []).map((g) => (
            <article
              key={g.code}
              className="rounded-3xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 transition-colors overflow-hidden flex flex-col"
            >
              {g.foto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={assetUrl(g.foto)} alt={`Banner do campeonato ${g.name}`} className="w-full h-40 object-cover" />
              )}
              <div className="p-6 space-y-4 flex-1 flex flex-col">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase">
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono">
                      {g.code}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                      {g.eventType === 'hyrox' ? 'HYROX' : 'CrossFit'}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white">{g.name}</h3>
                  {g.description && <p className="text-xs text-zinc-400 line-clamp-2">{g.description}</p>}
                </div>

                <ul className="text-xs text-zinc-300 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-zinc-500" />
                    <span>{formatDate(g.date)}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-zinc-500" />
                    <span>{g.location || 'Local a definir'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-zinc-500" />
                    <span>
                      {g._count?.registrations ?? 0} inscrições • {g.categories?.length ?? 0} categorias
                    </span>
                  </li>
                </ul>

                <div className="mt-auto pt-2">
                  <Link
                    href={`/campeonatos/${encodeURIComponent(g.code)}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-xs"
                  >
                    <span>Ver campeonato</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

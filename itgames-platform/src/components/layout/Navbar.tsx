'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Trophy, 
  FileSpreadsheet, 
  Flame, 
  Activity, 
  Gavel, 
  UserCheck, 
  LayoutDashboard, 
  Tv, 
  ChevronDown,
  Sparkles,
  ShieldCheck,
  LogIn,
  LogOut,
  User
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { GameEvent } from '@/types';
import { getCurrentUserSession, logoutUser, UserSession } from '@/lib/acl';
import { toast } from 'sonner';
import { ThemeToggle } from './ThemeToggle';
import { PublicTopBar } from './PublicTopBar';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [games, setGames] = useState<GameEvent[]>([]);
  const [activeGameId, setActiveGameId] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [session, setSession] = useState<UserSession>({ role: 'GUEST' });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    storage.initDefaultsIfEmpty();
    const loadState = () => {
      const g = storage.getGames();
      setGames(g);
      setActiveGameId(storage.getActiveGameId());
      setSession(getCurrentUserSession());
      setReady(true);
    };

    loadState();
    window.addEventListener('itgames_storage_updated', loadState);
    window.addEventListener('itgames_auth_changed', loadState);
    return () => {
      window.removeEventListener('itgames_storage_updated', loadState);
      window.removeEventListener('itgames_auth_changed', loadState);
    };
  }, []);

  const activeGame = games.find(g => g.id === activeGameId) || games[0];

  const handleSelectGame = (gameId: string) => {
    storage.setActiveGameId(gameId);
    setActiveGameId(gameId);
    setIsDropdownOpen(false);
  };

  const handleLogout = () => {
    logoutUser();
    setSession({ role: 'GUEST' });
    toast.info('Sessão encerrada com sucesso.');
    router.push('/login');
  };

  // Definição estrita de rotas permitidas por perfil (ACL)
  const getNavLinks = () => {
    switch (session.role) {
      case 'SUPER_ADMIN':
        return [
          { href: '/admin', label: '👑 Governança Global', icon: ShieldCheck, badge: 'Master' },
          { href: '/sumulas', label: 'Súmulas A4', icon: FileSpreadsheet },
          { href: '/heats', label: 'Baterias & Raias', icon: Activity },
          { href: '/judge', label: '⚖️ Juiz', icon: Gavel },
          { href: '/leaderboard', label: 'Leaderboard', icon: Trophy, badge: 'Live' },
        ];

      case 'ORGANIZER':
        return [
          { href: '/admin', label: '🏢 Painel do Organizador', icon: LayoutDashboard, badge: 'Gestão' },
          { href: '/sumulas', label: 'Súmulas A4', icon: FileSpreadsheet },
          { href: '/heats', label: 'Baterias & Raias', icon: Activity },
          { href: '/leaderboard', label: 'Leaderboard', icon: Trophy, badge: 'Live' },
        ];

      case 'JUDGE':
        return [
          { href: '/judge', label: '⚖️ App de Arbitragem', icon: Gavel, highlight: true },
          { href: '/heats', label: 'Baterias do Dia', icon: Activity },
          { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
        ];

      case 'ATHLETE':
        return [
          { href: '/athlete', label: '🏃 Meu Portal do Atleta', icon: UserCheck, badge: 'Competidor' },
          { href: '/athlete/register', label: 'Nova Inscrição', icon: Sparkles, badge: 'Camisetas' },
          { href: '/leaderboard', label: 'Leaderboard', icon: Trophy, badge: 'Live' },
        ];

      case 'GUEST':
      default:
        return [
          { href: '/leaderboard', label: 'Leaderboard Oficial', icon: Trophy, badge: 'Live' },
          { href: '/athlete/register', label: 'Inscrição na Competição', icon: Sparkles, badge: 'Camisetas' },
        ];
    }
  };

  const navLinks = getNavLinks();

  // Ocultar Navbar no Modo Telão de Arena
  if (pathname.includes('/leaderboard/big-screen')) {
    return <ThemeToggle floating />;
  }

  // Antes de ler a sessão não se mostra nada (evita piscar o menu errado)
  if (!ready) {
    return null;
  }

  // Visitante: sem menus de módulos, apenas marca, tema e acesso ao login
  if (session.role === 'GUEST') {
    return <PublicTopBar />;
  }

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-white/10 no-print backdrop-blur-md bg-zinc-950/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* LOGO & SELETOR DE CAMPEONATO PÚBLICO */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-600 to-red-600 flex items-center justify-center text-black font-black shadow-lg shadow-amber-500/30 group-hover:scale-105 transition-transform">
                <Flame className="w-5 h-5 text-black fill-black" />
              </div>
              <div>
                <span className="text-lg font-black tracking-wider text-white flex items-center gap-1">
                  IT<span className="text-amber-400">GAMES</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-400 font-bold border border-amber-400/30">
                    ARENA
                  </span>
                </span>
                <span className="text-[9px] text-zinc-400 block -mt-1 font-medium tracking-tight">
                  CrossFit & HYROX Platform
                </span>
              </div>
            </Link>

            {/* SELETOR DE EVENTO */}
            {activeGame && (
              <div className="relative hidden md:block">
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full ${activeGame.status === 'live' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  <span className="max-w-[160px] truncate">{activeGame.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                </button>

                {isDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-72 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="text-[10px] font-bold text-zinc-400 px-2 py-1 uppercase tracking-wider">
                      Selecione o Campeonato
                    </div>
                    {games.map(game => (
                      <button
                        key={game.id}
                        onClick={() => handleSelectGame(game.id)}
                        className={`w-full text-left p-2.5 rounded-lg text-xs flex flex-col gap-0.5 transition-colors ${game.id === activeGameId ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300' : 'hover:bg-zinc-800 text-zinc-300'}`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span>{game.name}</span>
                          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                            {game.eventType}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400 truncate">{game.location}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* MENU DE LINKS (FILTRADO POR ACL) */}
          <nav className="hidden lg:flex items-center gap-1.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(`${link.href}/`));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isActive 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm' 
                      : link.highlight
                        ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30'
                        : 'text-zinc-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : link.highlight ? 'text-red-400' : 'text-zinc-400'}`} />
                  <span>{link.label}</span>
                  {link.badge && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* AÇÕES DA DIREITA: TELÃO + ESTADO DE AUTENTICAÇÃO */}
          <div className="flex items-center gap-2">
            
            {/* TELÃO ARENA (VISÍVEL PARA ORGANIZADOR, SUPER ADMIN OU LIVE) */}
            {(session.role === 'ORGANIZER' || session.role === 'SUPER_ADMIN' || activeGame?.status === 'live') && (
              <Link
                href="/leaderboard/big-screen"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 font-bold text-xs transition-colors"
                title="Abrir Modo Telão LED para TVs"
              >
                <Tv className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Telão</span>
              </Link>
            )}

            {/* SE ESTIVER LOGADO -> EXIBIR PERFIL & LOGOUT */}
            <ThemeToggle />
            {(
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-1 pl-2.5">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] ${
                    session.role === 'SUPER_ADMIN' ? 'bg-amber-500 text-black' :
                    session.role === 'ORGANIZER' ? 'bg-orange-500 text-black' :
                    session.role === 'JUDGE' ? 'bg-red-500 text-white' :
                    'bg-purple-500 text-white'
                  }`}>
                    {session.name ? session.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="text-left hidden md:block">
                    <div className="font-bold text-[11px] text-white truncate max-w-[110px] leading-tight">
                      {session.name}
                    </div>
                    <div className="text-[9px] text-zinc-400 font-medium leading-none">
                      {session.role === 'SUPER_ADMIN' ? 'Super Admin' :
                       session.role === 'ORGANIZER' ? 'Organizador' :
                       session.role === 'JUDGE' ? 'Juiz de Arena' : 'Atleta'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  title="Encerrar Sessão (Logout)"
                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

          </div>

        </div>
      </div>
    </header>
  );
}

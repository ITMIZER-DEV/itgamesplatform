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
  User,
  Menu,
  X,
} from 'lucide-react';
import { useGames } from '@/lib/use-games';
import { getCurrentUserSession, logoutUser, UserSession } from '@/lib/acl';
import { toast } from 'sonner';
import { ThemeToggle } from './ThemeToggle';
import { PublicTopBar } from './PublicTopBar';
import { BrandLogo } from '@/components/brand/BrandLogo';

interface NavLinkItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  badge?: string;
  highlight?: boolean;
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { games, activeGame, setActiveGame, isLoading: gamesLoading } = useGames();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [session, setSession] = useState<UserSession>({ role: 'GUEST' });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loadState = () => {
      setSession(getCurrentUserSession());
      setReady(true);
    };

    loadState();
    window.addEventListener('itgames_auth_changed', loadState);
    return () => {
      window.removeEventListener('itgames_auth_changed', loadState);
    };
  }, []);

  // Fechar drawer mobile ao navegar
  useEffect(() => {
    setIsMobileDrawerOpen(false);
    setIsDropdownOpen(false);
  }, [pathname]);

  const handleSelectGame = (gameId: string) => {
    const game = games.find((g) => g.id === gameId);
    if (game) setActiveGame(game.code);
    setIsDropdownOpen(false);
  };

  const handleLogout = () => {
    logoutUser();
    setSession({ role: 'GUEST' });
    setIsMobileDrawerOpen(false);
    toast.info('Sessão encerrada com sucesso.');
    router.push('/login');
  };

  const getNavLinks = (): NavLinkItem[] => {
    switch (session.role) {
      case 'SUPER_ADMIN':
        return [
          { href: '/admin', label: 'Administração', shortLabel: 'Admin', icon: ShieldCheck },
          { href: '/head-judge', label: 'Head Judge', shortLabel: 'Head', icon: Gavel },
          { href: '/sumulas', label: 'Súmulas A4', shortLabel: 'Súmulas', icon: FileSpreadsheet },
          { href: '/sumulas/pdf', label: 'PDFs das Súmulas', shortLabel: 'PDFs', icon: FileSpreadsheet },
          { href: '/heats', label: 'Baterias & Raias', shortLabel: 'Baterias', icon: Activity },
          { href: '/judge', label: 'Juiz', shortLabel: 'Juiz', icon: Gavel },
          { href: '/telas', label: 'Telões', shortLabel: 'Telões', icon: Tv },
          { href: '/leaderboard', label: 'Leaderboard', shortLabel: 'Placar', icon: Trophy },
          { href: '/perfil', label: 'Meu Perfil', shortLabel: 'Perfil', icon: User },
        ];

      case 'ORGANIZER':
        return [
          { href: '/admin', label: 'Painel', shortLabel: 'Painel', icon: LayoutDashboard },
          { href: '/head-judge', label: 'Head Judge', shortLabel: 'Head', icon: Gavel },
          { href: '/sumulas', label: 'Súmulas A4', shortLabel: 'Súmulas', icon: FileSpreadsheet },
          { href: '/sumulas/pdf', label: 'PDFs das Súmulas', shortLabel: 'PDFs', icon: FileSpreadsheet },
          { href: '/heats', label: 'Baterias & Raias', shortLabel: 'Baterias', icon: Activity },
          { href: '/telas', label: 'Telões', shortLabel: 'Telões', icon: Tv },
          { href: '/leaderboard', label: 'Leaderboard', shortLabel: 'Placar', icon: Trophy },
          { href: '/athlete/register', label: 'Inscrever-me como competidor', shortLabel: 'Inscrição', icon: Sparkles },
          { href: '/perfil', label: 'Meu Perfil', shortLabel: 'Perfil', icon: User },
        ];

      case 'JUDGE':
        return [
          { href: '/head-judge', label: 'Head Judge', shortLabel: 'Head', icon: Gavel },
          { href: '/judge', label: 'App de Arbitragem', shortLabel: 'Juiz', icon: Gavel },
          { href: '/heats', label: 'Baterias do Dia', shortLabel: 'Baterias', icon: Activity },
          { href: '/leaderboard', label: 'Leaderboard', shortLabel: 'Placar', icon: Trophy },
          { href: '/perfil', label: 'Meu Perfil', shortLabel: 'Perfil', icon: User },
        ];

      case 'ATHLETE':
        return [
          { href: '/athlete', label: 'Meu Portal', shortLabel: 'Portal', icon: UserCheck },
          { href: '/athlete/register', label: 'Nova Inscrição', shortLabel: 'Inscrever', icon: Sparkles },
          { href: '/leaderboard', label: 'Leaderboard', shortLabel: 'Placar', icon: Trophy },
          { href: '/perfil', label: 'Meu Perfil', shortLabel: 'Perfil', icon: User },
        ];

      case 'GUEST':
      default:
        return [
          { href: '/leaderboard', label: 'Leaderboard Oficial', shortLabel: 'Placar', icon: Trophy },
          { href: '/athlete/register', label: 'Inscrição na Competição', shortLabel: 'Inscrever', icon: Sparkles },
        ];
    }
  };

  const navLinks = getNavLinks();
  const mobilePrimaryLinks = navLinks.slice(0, 4);

  // Ocultar Navbar no Modo Telão de Arena
  if (pathname.includes('/leaderboard/big-screen')) {
    return <ThemeToggle floating />;
  }

  if (!ready) {
    return null;
  }

  if (session.role === 'GUEST') {
    return <PublicTopBar />;
  }

  return (
    <>
      <header className="sticky top-0 z-50 glass-panel border-b border-white/10 no-print backdrop-blur-md bg-zinc-950/85">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-2">
            {/* LOGO & SELETOR DE CAMPEONATO */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Link href="/" className="flex items-center gap-2 group shrink-0">
                <BrandLogo variant="white" size="md" />
              </Link>

              {!activeGame && !gamesLoading && (
                <span className="hidden md:inline-flex items-center px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-500">
                  Nenhum campeonato disponível
                </span>
              )}
              {activeGame && (
                <div className="relative block min-w-0">
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 transition-colors min-h-[38px]"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${activeGame.status === 'live' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                    <span className="max-w-[110px] sm:max-w-[160px] truncate">{activeGame.name}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute left-0 mt-2 w-72 max-w-[85vw] rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                      <div className="text-[10px] font-bold text-zinc-400 px-2 py-1 uppercase tracking-wider">
                        Selecione o Campeonato
                      </div>
                      {games.map((game) => (
                        <button
                          key={game.id}
                          onClick={() => handleSelectGame(game.id)}
                          className={`w-full text-left p-2.5 rounded-lg text-xs flex flex-col gap-0.5 transition-colors ${
                            game.id === activeGame?.id
                              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                              : 'hover:bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold gap-2">
                            <span className="truncate">{game.name}</span>
                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 shrink-0">
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

            {/* MENU DESKTOP (FILTRADO POR ACL) */}
            <nav className="hidden lg:flex items-center gap-1 overflow-x-auto scrollbar-none min-w-0">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(`${link.href}/`));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 px-2.5 2xl:px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                      isActive
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                        : link.highlight
                          ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30'
                          : 'text-zinc-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-400' : link.highlight ? 'text-red-400' : 'text-zinc-400'}`} />
                    <span className="2xl:hidden">{link.shortLabel}</span>
                    <span className="hidden 2xl:inline">{link.label}</span>
                    {link.badge && (
                      <span className="hidden xl:inline-block text-[9px] px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                        {link.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* AÇÕES DA DIREITA: TELÃO + PERFIL & LOGOUT */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {(session.role === 'ORGANIZER' || session.role === 'SUPER_ADMIN' || activeGame?.status === 'live') && (
                <Link
                  href="/leaderboard/big-screen"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 font-bold text-xs transition-colors min-h-[38px]"
                  title="Abrir Modo Telão LED para TVs"
                >
                  <Tv className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Telão</span>
                </Link>
              )}

              <ThemeToggle />

              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-1 pl-2 sm:pl-2.5">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center font-bold text-[10px] ${
                      session.role === 'SUPER_ADMIN'
                        ? 'bg-amber-500 text-black'
                        : session.role === 'ORGANIZER'
                          ? 'bg-orange-500 text-black'
                          : session.role === 'JUDGE'
                            ? 'bg-red-500 text-white'
                            : 'bg-purple-500 text-white'
                    }`}
                  >
                    {session.name ? session.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="text-left hidden md:block">
                    <div className="font-bold text-[11px] text-white truncate max-w-[110px] leading-tight">
                      {session.name}
                    </div>
                    <div className="text-[9px] text-zinc-400 font-medium leading-none">
                      {session.role === 'SUPER_ADMIN'
                        ? 'Super Admin'
                        : session.role === 'ORGANIZER'
                          ? 'Organizador'
                          : session.role === 'JUDGE'
                            ? 'Juiz de Arena'
                            : 'Atleta'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  title="Encerrar Sessão (Logout)"
                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* BARRA DE NAVEGAÇÃO INFERIOR MOBILE-FIRST (THUMB ZONE) */}
      <nav
        aria-label="Navegação rápida mobile"
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 px-1.5 py-1.5 flex items-center justify-around gap-1 no-print shadow-2xl"
      >
        {mobilePrimaryLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(`${link.href}/`));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 transition-all ${
                isActive
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : link.highlight
                    ? 'text-red-400 hover:bg-red-500/10'
                    : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-bold truncate max-w-full">{link.shortLabel}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setIsMobileDrawerOpen(true)}
          className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 transition-all ${
            isMobileDrawerOpen ? 'bg-amber-500 text-black' : 'text-zinc-300 hover:bg-zinc-900'
          }`}
        >
          <Menu className="w-4 h-4" />
          <span className="text-[10px] font-bold">Mais</span>
        </button>
      </nav>

      {/* DRAWER MOBILE COMPLETO (TODAS AS ROTAS DO PERFIL) */}
      {isMobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end no-print animate-in fade-in duration-150">
          <div className="bg-zinc-950 border-t border-zinc-800 rounded-t-3xl p-5 space-y-4 max-h-[82vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <div className="text-xs font-black uppercase text-amber-400">
                  {session.role === 'SUPER_ADMIN'
                    ? 'Super Admin'
                    : session.role === 'ORGANIZER'
                      ? 'Organizador'
                      : session.role === 'JUDGE'
                        ? 'Juiz de Arena'
                        : 'Atleta'}
                </div>
                <div className="text-sm font-black text-white">{session.name}</div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(`${link.href}/`));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className={`flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold min-h-[48px] transition-all ${
                      isActive
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-zinc-900/90 text-zinc-200 border border-zinc-800'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-amber-400" />
                      <span>{link.label}</span>
                    </span>
                    {link.badge && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                        {link.badge}
                      </span>
                    )}
                  </Link>
                );
              })}

              {(session.role === 'ORGANIZER' || session.role === 'SUPER_ADMIN' || activeGame?.status === 'live') && (
                <Link
                  href="/leaderboard/big-screen"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-sm font-bold text-zinc-200 min-h-[48px]"
                >
                  <Tv className="w-4 h-4 text-amber-400" />
                  <span>Abrir Telão LED de Arena</span>
                </Link>
              )}
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-black text-sm flex items-center justify-center gap-2 min-h-[48px]"
            >
              <LogOut className="w-4 h-4" />
              <span>Encerrar Sessão (Logout)</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

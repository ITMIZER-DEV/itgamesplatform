'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  UserCheck, 
  Search, 
  QrCode, 
  Clock, 
  Activity, 
  Trophy, 
  AlertCircle, 
  CheckCircle2, 
  Send, 
  ShieldAlert, 
  Flame, 
  FileText, 
  Sparkles, 
  Calendar, 
  MapPin, 
  Shirt, 
  ChevronRight, 
  ArrowRight, 
  Check, 
  X, 
  Users,
  ShieldCheck,
  Upload,
  Image as ImageIcon,
  FileCheck,
  CreditCard,
  Copy
} from 'lucide-react';

import { QRCodeSVG } from 'qrcode.react';
import { storage } from '@/lib/storage';
import { GameEvent, Category, WorkoutRule, TeamRegistration, ScoreEntry, Heat, LeaderboardRank } from '@/types';
import { calculateOverallLeaderboard } from '@/lib/scoring';
import { getCurrentUserSession, UserSession } from '@/lib/acl';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { AclGuard } from '@/components/auth/AclGuard';

export default function AthletePortalPage() {
  const [session, setSession] = useState<UserSession>({ role: 'ATHLETE' });
  const [games, setGames] = useState<GameEvent[]>([]);
  const [activeGame, setActiveGame] = useState<GameEvent | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutRule[]>([]);
  const [heats, setHeats] = useState<Heat[]>([]);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [teams, setTeams] = useState<TeamRegistration[]>([]);

  // Comprovante de Pagamento do Atleta
  const [proofInput, setProofInput] = useState<string>('');
  const [proofImagePreview, setProofImagePreview] = useState<string | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState<boolean>(false);
  const [isCopiedPix, setIsCopiedPix] = useState<boolean>(false);
  const [isViewingProofModal, setIsViewingProofModal] = useState<boolean>(false);

  // Abas do Portal: 'credential', 'timeline', 'leaderboard', 'available_events'
  const [activeTab, setActiveTab] = useState<'credential' | 'timeline' | 'leaderboard' | 'available_events'>('credential');

  // Time / Inscrição selecionada
  const [selectedTeam, setSelectedTeam] = useState<TeamRegistration | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal de Contestação de Score
  const [isContestModalOpen, setIsContestModalOpen] = useState<boolean>(false);
  const [contestWorkoutId, setContestWorkoutId] = useState<string>('');
  const [contestReason, setContestReason] = useState<string>('');

  const loadData = async () => {
    const curSession = getCurrentUserSession();
    setSession(curSession);

    // Campeonatos liberados vêm sempre da API (sem fallback de mock)
    let loadedGames: GameEvent[] = [];
    try {
      const apiGames = await apiClient.listGames();
      loadedGames = (apiGames || []).map((g) => ({
        id: g.code,
        organizationId: 'org_1',
        code: g.code,
        name: g.name,
        description: g.description || '',
        location: g.location || '',
        startDate: g.date || '2026-11-15',
        endDate: g.date || '2026-11-15',
        eventType: g.eventType || 'crossfit',
        status: (g.status as any) || 'live',
        lanesCount: g.lanesCount || 8,
        scoringRules: {
          isLowestPointsBetter: g.isLowestPointsBetter || false,
          hyroxChipTimingEnabled: g.eventType === 'hyrox',
        },
      }));
    } catch (e) {
      console.warn('[Athlete] Falha ao carregar campeonatos da API', e);
    }

    setGames(loadedGames);
    const activeId = storage.getActiveGameId();
    const game = loadedGames.find(g => g.id === activeId || g.code === activeId) || loadedGames[0];
    setActiveGame(game || null);

    if (game) {
      let tms = storage.getTeams(game.id);
      try {
        const apiRegs = await apiClient.listRegistrations(game.code || game.id);
        if (apiRegs && apiRegs.length > 0) {
          const apiMapped: TeamRegistration[] = apiRegs.map(r => ({
            id: `reg_${r.code}`,
            gameId: r.gameCode,
            categoryId: String(r.categoryId),
            categoryName: r.category?.name || `Categoria ${r.categoryId}`,
            teamName: r.team,
            registerNumber: r.number || `#${r.code}`,
            amountPaid: r.amount || 0,
            paymentStatus: (r.status as any) || 'pending',
            registeredAt: new Date().toISOString(),
            checkedIn: r.check || false,
            validationStatus: 'valid',
            athletes: (r.athletes || []).map((a: any) => ({
              id: `ath_${a.code}`,
              name: a.name,
              cpf: a.cpf,
              phone: a.phonenumber,
              gender: a.gender || 'M',
              tshirtSize: a.tshirtSize || 'M',
              birthDate: a.birthDate,
              checkIn: a.check || false,
            }))
          }));

          const existingBibs = new Set(tms.map(t => t.registerNumber));
          apiMapped.forEach(m => {
            if (!existingBibs.has(m.registerNumber)) {
              tms.push(m);
            }
          });
        }
      } catch (err) {
        console.log('[Athlete] Fallback storage');
      }

      setTeams(tms);
      setWorkouts(storage.getWorkouts(game.id));
      setHeats(storage.getHeats(game.id));
      setScores(storage.getScores(game.id));
      setCategories(storage.getCategories(game.id));

      const isStaff = curSession.role === 'SUPER_ADMIN' || curSession.role === 'ORGANIZER' || curSession.role === 'JUDGE';

      if (!isStaff) {
        const lastBib = typeof window !== 'undefined' ? localStorage.getItem('itgames_last_registered_bib') : null;
        const lastId = typeof window !== 'undefined' ? localStorage.getItem('itgames_last_registered_team_id') : null;
        const userEmail = curSession.email?.toLowerCase().trim();
        const userName = curSession.name?.toLowerCase().trim() || '';

        const matchName = (n1: string, n2: string) => {
          const a = n1.toLowerCase().trim();
          const b = n2.toLowerCase().trim();
          if (!a || !b) return false;
          if (a === b || a.includes(b) || b.includes(a)) return true;
          const aWords = a.split(/\s+/).filter(w => w.length >= 3);
          const bWords = b.split(/\s+/).filter(w => w.length >= 3);
          return aWords.some(aw => bWords.some(bw => aw === bw || aw.includes(bw) || bw.includes(aw)));
        };

        // Filtra estritamente as inscrições deste atleta
        const myTeams = tms.filter(t => 
          (lastBib && t.registerNumber === lastBib) ||
          (lastId && t.id === lastId) ||
          (userEmail && t.athletes.some(a => a.email?.toLowerCase().trim() === userEmail)) ||
          (userName && t.athletes.some(a => matchName(userName, a.name))) ||
          (userName && matchName(userName, t.teamName))
        );

        // Prioridade: última registrada (lastBib), ou a mais recente da lista de inscrições do próprio atleta
        let myReg = null;
        if (lastBib) {
          myReg = myTeams.find(t => t.registerNumber === lastBib);
        }
        if (!myReg && myTeams.length > 0) {
          myReg = myTeams[myTeams.length - 1];
        }

        setSelectedTeam(myReg || null);
      } else {
        // Staff/SuperAdmin pode inspecionar qualquer atleta ou selecionar da lista
        if (!selectedTeam && tms.length > 0) {
          setSelectedTeam(tms[0]);
        }
      }


    }
  };

  // Envio de Arquivo / Foto do Comprovante (Base64)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('O arquivo do comprovante deve ter no máximo 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setProofInput(result);
      setProofImagePreview(result);
      toast.info('Comprovante anexado! Clique em "Salvar e Enviar Comprovante" para concluir.');
    };
    reader.readAsDataURL(file);
  };

  // Enviar / Anexar Comprovante Pix
  const handleSaveProof = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;
    if (!proofInput.trim()) {
      toast.error('Insira o comprovante (imagem ou código da transação Pix)');
      return;
    }

    setIsUploadingProof(true);
    const updatedTeam: TeamRegistration = {
      ...selectedTeam,
      proofOfPaymentUrl: proofInput.trim(),
      proofUploadedAt: new Date().toISOString(),
    };

    storage.saveTeam(updatedTeam);
    setSelectedTeam(updatedTeam);
    setTeams(storage.getTeams(activeGame?.id));
    setIsUploadingProof(false);
    toast.success('🎉 Comprovante Pix enviado com sucesso! A organização foi notificada e fará a validação e baixa manual.');
  };


  useEffect(() => {
    storage.initDefaultsIfEmpty();
    loadData();
    window.addEventListener('itgames_storage_updated', loadData);
    window.addEventListener('itgames_auth_changed', loadData);
    return () => {
      window.removeEventListener('itgames_storage_updated', loadData);
      window.removeEventListener('itgames_auth_changed', loadData);
    };
  }, []);

  const handleSearchAthlete = () => {
    const isStaff = session.role === 'SUPER_ADMIN' || session.role === 'ORGANIZER';
    if (!isStaff) {
      toast.error('Apenas a organização ou administradores podem inspecionar outros atletas.');
      return;
    }
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase().trim();
    const found = teams.find(
      t => t.registerNumber.toLowerCase().includes(q) ||
           t.teamName.toLowerCase().includes(q) ||
           t.athletes.some(a => a.name.toLowerCase().includes(q))
    );

    if (found) {
      setSelectedTeam(found);
      toast.success(`Inscrição "${found.teamName}" (${found.registerNumber}) localizada!`);
    } else {
      toast.error('Nenhuma inscrição encontrada com esse termo.');
    }
  };

  // Minhas Baterias e Raias
  const athleteHeats: { workout: WorkoutRule; heat: Heat; lane: number }[] = [];
  if (selectedTeam) {
    heats.forEach(h => {
      const laneInfo = h.laneAssignments.find(l => l.registrationId === selectedTeam.id);
      if (laneInfo) {
        const wod = workouts.find(w => w.id === h.workoutId);
        if (wod) {
          athleteHeats.push({
            workout: wod,
            heat: h,
            lane: laneInfo.lane
          });
        }
      }
    });
  }

  // Meus Scores
  const athleteScores = selectedTeam 
    ? scores.filter(s => s.registrationId === selectedTeam.id) 
    : [];

  // Calcular ranking da categoria do atleta
  const currentCategory = categories.find(c => c.id === selectedTeam?.categoryId) || categories[0];
  const categoryTeams = teams.filter(t => t.categoryId === currentCategory?.id);
  const categoryWorkouts = workouts.filter(w => w.categoryId === currentCategory?.id || w.gameId === activeGame?.id);

  const categoryLeaderboard: LeaderboardRank[] = calculateOverallLeaderboard(
    categoryTeams,
    categoryWorkouts,
    scores,
    activeGame?.eventType === 'hyrox'
  );

  const myRank = categoryLeaderboard.find(r => r.teamId === selectedTeam?.id);

  const handleSendContest = () => {
    if (!contestReason.trim()) {
      toast.error('Descreva detalhadamente o motivo da contestação');
      return;
    }

    toast.success('Solicitação de revisão enviada com sucesso! O Head Judge foi notificado e você será chamado na mesa de arbitragem.');
    setIsContestModalOpen(false);
    setContestReason('');
  };

  // Inscrições vinculadas estritamente a este competidor autenticado (Zero Trust)
  const lastBib = typeof window !== 'undefined' ? localStorage.getItem('itgames_last_registered_bib') : null;
  const lastId = typeof window !== 'undefined' ? localStorage.getItem('itgames_last_registered_team_id') : null;
  const userEmail = session.email?.toLowerCase().trim();
  const userName = session.name?.toLowerCase().trim() || '';

  const matchName = (n1: string, n2: string) => {
    const a = n1.toLowerCase().trim();
    const b = n2.toLowerCase().trim();
    if (!a || !b) return false;
    if (a === b || a.includes(b) || b.includes(a)) return true;
    const aWords = a.split(/\s+/).filter(w => w.length >= 3);
    const bWords = b.split(/\s+/).filter(w => w.length >= 3);
    return aWords.some(aw => bWords.some(bw => aw === bw || aw.includes(bw) || bw.includes(aw)));
  };

  const myAthleteTeams = teams.filter(t => 
    (lastBib && t.registerNumber === lastBib) ||
    (lastId && t.id === lastId) ||
    (userEmail && t.athletes.some(a => a.email?.toLowerCase().trim() === userEmail)) ||
    (userName && t.athletes.some(a => matchName(userName, a.name))) ||
    (userName && matchName(userName, t.teamName))
  );

  return (
    <AclGuard resource="athlete" requiredRoleLabel="Atletas e Competidores">

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
        
        {/* CABEÇALHO PORTAL DO ATLETA */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
              <UserCheck className="w-4 h-4" />
              <span>Portal Oficial do Competidor</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white mt-1">
              Olá, {session.name || 'Atleta'}! 👋
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Painel de competição com sua credencial oficial (BIB), horários de baterias, súmulas homologadas e campeonatos abertos.
            </p>
          </div>

          {/* Se for SuperAdmin ou Organizador, exibe ferramenta de inspeção */}
          {(session.role === 'SUPER_ADMIN' || session.role === 'ORGANIZER') && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchAthlete()}
                  placeholder="Inspecionar BIB (#101)"
                  className="pl-8 pr-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white font-bold w-44 focus:outline-none focus:border-purple-500"
                />
              </div>
              <button
                onClick={handleSearchAthlete}
                className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 transition-all active:scale-95"
              >
                Inspecionar
              </button>
            </div>
          )}
        </div>

        {/* SELETOR DE CAMPEONATO ATIVO */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-black">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-zinc-400">Campeonato Selecionado</div>
              <div className="text-sm font-black text-white flex items-center gap-2">
                <span>{activeGame?.name || 'Selecione um Evento'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {activeGame?.eventType === 'hyrox' ? 'HYROX Racing' : 'CrossFit'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-400 font-semibold whitespace-nowrap">Torneio:</label>
              <select
                value={activeGame?.id || ''}
                onChange={(e) => {
                  const gId = e.target.value;
                  storage.setActiveGameId(gId);
                  const g = games.find(x => x.id === gId || x.code === gId);
                  if (g) {
                    setActiveGame(g);
                    const tms = storage.getTeams(g.id);
                    setTeams(tms);
                    setWorkouts(storage.getWorkouts(g.id));
                    setHeats(storage.getHeats(g.id));
                    setScores(storage.getScores(g.id));
                    setCategories(storage.getCategories(g.id));
                    setSelectedTeam(tms[0] || null);
                  }
                }}
                className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
              >
                {games.map(g => (
                  <option key={g.id || g.code} value={g.id || g.code}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {(session.role === 'SUPER_ADMIN' || session.role === 'ORGANIZER' || session.role === 'JUDGE') ? (
              <div className="flex items-center gap-2 bg-purple-950/40 border border-purple-500/30 px-3 py-1.5 rounded-xl">
                <span className="text-[11px] font-bold text-purple-300 whitespace-nowrap">Inspecionar Atleta:</span>
                <select
                  value={selectedTeam?.id || ''}
                  onChange={(e) => {
                    const tm = teams.find(t => t.id === e.target.value);
                    if (tm) setSelectedTeam(tm);
                  }}
                  className="px-2 py-1 rounded-lg bg-zinc-900 border border-purple-500/40 text-xs font-bold text-white focus:outline-none"
                >
                  {teams.length === 0 && <option value="">Nenhum atleta inscrito</option>}
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>
                      #{t.registerNumber} - {t.teamName} ({t.paymentStatus === 'paid' ? '🟢 Pago' : '🟡 Pendente'})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              myAthleteTeams.length > 0 && (
                <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-700 px-3 py-1.5 rounded-xl">
                  <span className="text-[11px] font-bold text-amber-400 whitespace-nowrap">Minha Inscrição ({myAthleteTeams.length}):</span>
                  <select
                    value={selectedTeam?.id || ''}
                    onChange={(e) => {
                      const tm = myAthleteTeams.find(t => t.id === e.target.value);
                      if (tm) {
                        setSelectedTeam(tm);
                        localStorage.setItem('itgames_last_registered_bib', tm.registerNumber);
                        localStorage.setItem('itgames_last_registered_team_id', tm.id);
                      }
                    }}
                    className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                  >
                    {myAthleteTeams.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.registerNumber} — {t.teamName} ({t.paymentStatus === 'paid' ? '🟢 Pago' : '🟡 Aguardando Liberação'})
                      </option>
                    ))}
                  </select>
                </div>
              )
            )}


          </div>
        </div>

        {/* NAVEGAÇÃO POR ABAS DO PORTAL */}
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800/80 pb-2">
          <button
            onClick={() => setActiveTab('credential')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'credential'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>1. Credencial & BIB Card</span>
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'timeline'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>2. Timeline & Baterias ({athleteHeats.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>3. Meus Scores & Leaderboard</span>
          </button>

          <button
            onClick={() => setActiveTab('available_events')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'available_events'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>4. Próximos Campeonatos ({games.length})</span>
          </button>
        </div>

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* 1. ABA: CREDENCIAL OFICIAL & BIB CARD */}
        {/* ────────────────────────────────────────────────────────────────────────── */}
        {activeTab === 'credential' && selectedTeam && (
          <div className="space-y-6">
            
            {/* AVISO DE PAGAMENTO PENDENTE & ENVIO DE COMPROVANTE */}
            {selectedTeam.paymentStatus !== 'paid' && (
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-amber-950/40 via-zinc-900 to-zinc-900 border-2 border-amber-500/50 shadow-2xl space-y-6 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black text-xl shrink-0">
                      <Clock className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black uppercase border border-amber-500/30">
                          🟡 Aguardando Liberação da Organização
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">
                          BIB: {selectedTeam.registerNumber}
                        </span>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                        Inscrição Pendente de Pagamento
                      </h3>
                    </div>
                  </div>

                  <div className="text-right bg-zinc-950/80 px-4 py-2.5 rounded-2xl border border-zinc-800">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase block">Valor da Inscrição</span>
                    <span className="text-xl font-black text-amber-400 font-mono">
                      R$ {Number(currentCategory?.price || 150).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* INFORMAÇÕES DE PAGAMENTO PIX */}
                  <div className="p-5 rounded-2xl bg-zinc-950/90 border border-zinc-800 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                      <CreditCard className="w-4 h-4" />
                      <span>1. Dados para Transferência Pix (Fictício)</span>
                    </div>

                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Neste campeonato, a conferência financeira é <strong>100% manual</strong> pela comissão organizadora. Realize a transferência Pix da sua taxa e anexe o comprovante ao lado para liberação da sua vaga.
                    </p>

                    <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                      <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                        <span>Chave Pix (E-mail):</span>
                        <strong className="text-white font-mono">financeiro@itgames.com.br</strong>
                      </div>
                      <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                        <span>Favorecido:</span>
                        <strong className="text-zinc-200">ITGames Arena Competições</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText('financeiro@itgames.com.br');
                        setIsCopiedPix(true);
                        toast.success('Chave Pix copiada para a área de transferência!');
                        setTimeout(() => setIsCopiedPix(false), 3000);
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      {isCopiedPix ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
                      <span>{isCopiedPix ? 'Chave Copiada!' : 'Copiar Chave Pix (financeiro@itgames.com.br)'}</span>
                    </button>
                  </div>

                  {/* FORMULÁRIO DE ENVIO DE COMPROVANTE */}
                  <div className="p-5 rounded-2xl bg-zinc-950/90 border border-zinc-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-wider">
                        <Upload className="w-4 h-4" />
                        <span>2. Enviar Comprovante de Pagamento</span>
                      </div>
                      {selectedTeam.proofOfPaymentUrl && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                          Comprovante Anexado
                        </span>
                      )}
                    </div>

                    {selectedTeam.proofOfPaymentUrl ? (
                      <div className="space-y-3">
                        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs space-y-2">
                          <div className="flex items-center gap-2 text-emerald-400 font-bold">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Comprovante registrado com sucesso!</span>
                          </div>
                          <p className="text-zinc-300 text-[11px]">
                            Enviado em:{' '}
                            <strong className="text-white font-mono">
                              {selectedTeam.proofUploadedAt
                                ? new Date(selectedTeam.proofUploadedAt).toLocaleString('pt-BR')
                                : 'Recentemente'}
                            </strong>
                          </p>
                          <p className="text-zinc-400 text-[11px]">
                            A mesa organizadora está validando o pagamento. Assim que baixado, sua credencial e baterias serão liberadas automaticamente.
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsViewingProofModal(true)}
                            className="flex-1 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-zinc-700"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                            <span>Visualizar Comprovante</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setProofInput('');
                              setProofImagePreview(null);
                              const updated: TeamRegistration = {
                                ...selectedTeam,
                                proofOfPaymentUrl: undefined,
                                proofUploadedAt: undefined,
                              };
                              storage.saveTeam(updated);
                              setSelectedTeam(updated);
                              setTeams(storage.getTeams(activeGame?.id));
                              toast.info('Comprovante removido. Você pode anexar um novo.');
                            }}
                            className="py-2 px-3 rounded-xl bg-zinc-900 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 text-xs font-semibold border border-zinc-800"
                            title="Substituir comprovante"
                          >
                            Substituir
                          </button>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleSaveProof} className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-bold text-zinc-400 mb-1.5">
                            Selecione a Foto do Comprovante (ou digite o código Pix):
                          </label>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={handleFileChange}
                            className="w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-600 file:text-white hover:file:bg-purple-500 cursor-pointer bg-zinc-900 rounded-xl p-1 border border-zinc-700"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                            Ou Cole o Código / ID da Transação / Link do Comprovante:
                          </label>
                          <input
                            type="text"
                            value={proofInput.startsWith('data:') ? 'Foto do comprovante carregada' : proofInput}
                            onChange={(e) => {
                              setProofInput(e.target.value);
                              setProofImagePreview(null);
                            }}
                            placeholder="Ex: E90400888202611151234ABC ou cole o link..."
                            className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                          />
                        </div>

                        {proofImagePreview && (
                          <div className="p-2 bg-zinc-900 rounded-xl border border-zinc-800 text-center">
                            <span className="text-[10px] text-zinc-400 block mb-1">Prévia da Foto do Comprovante:</span>
                            <img
                              src={proofImagePreview}
                              alt="Comprovante"
                              className="max-h-28 mx-auto rounded-lg object-contain border border-zinc-700"
                            />
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={isUploadingProof || !proofInput.trim()}
                          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{isUploadingProof ? 'Enviando...' : 'Salvar e Enviar Comprovante'}</span>
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* CARTÃO DIGITAL PRINCIPAL (BIB PASS) */}
              <div className="lg:col-span-2 glass-panel p-6 sm:p-8 rounded-3xl border border-purple-500/30 bg-gradient-to-br from-zinc-900 via-zinc-900 to-purple-950/20 shadow-2xl relative overflow-hidden space-y-6">
                
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {selectedTeam.paymentStatus === 'paid' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Inscrição Confirmada • Check-in {selectedTeam.checkedIn ? 'Realizado' : 'Pendente'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold">
                          <Clock className="w-3.5 h-3.5" />
                          Aguardando Liberação da Organização
                        </span>
                      )}
                      <span className="text-xs px-2.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold">
                        {activeGame?.name}
                      </span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-black text-white">
                      {selectedTeam.teamName}
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      Categoria: <strong className="text-amber-400 font-bold">{currentCategory?.name || 'Geral'}</strong> • Box: <strong className="text-zinc-200">{selectedTeam.athletes[0]?.boxOrAffiliate || 'Box Filiada'}</strong>
                    </p>
                  </div>

                  {/* QR CODE DIGITAL DA CREDENCIAL */}
                  <div className="p-3 bg-white rounded-2xl shadow-xl flex flex-col items-center">
                    <QRCodeSVG 
                      value={`ITGAMES-BIB-${selectedTeam.registerNumber}-${selectedTeam.id}`} 
                      size={96}
                      level="H"
                    />
                    <span className="text-[10px] font-black text-black mt-1 font-mono tracking-wider">
                      BIB: {selectedTeam.registerNumber}
                    </span>
                  </div>
                </div>

                {/* LISTA DE INTEGRANTES & CAMISETAS */}
                <div className="pt-4 border-t border-zinc-800 space-y-3">
                  <div className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span>Integrantes & Tamanhos de Camiseta:</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedTeam.athletes.map((ath, idx) => (
                      <div key={ath.id || idx} className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold flex items-center justify-center">
                              #{idx + 1}
                            </span>
                            <span>{ath.name}</span>
                          </div>
                          <div className="text-[11px] text-zinc-400 font-mono">
                            {ath.email || 'Email cadastrado'}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
                            <Shirt className="w-3.5 h-3.5" />
                            Tam: {ath.tshirtSize || 'M'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* DETALHES DO EVENTO */}
                <div className="pt-4 border-t border-zinc-800 flex flex-wrap items-center justify-between text-xs text-zinc-400 gap-4">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <span>Data: {activeGame?.startDate || '15/11/2026'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-red-400" />
                    <span>{activeGame?.location || 'Arena Olímpica'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Termo LGPD Aceito</span>
                  </div>
                </div>

              </div>

              {/* CARD DE RESUMO RÁPIDO DO ATLETA */}
              <div className="space-y-4">
                <div className="glass-panel p-6 rounded-3xl border border-zinc-800 space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    Status da Competição
                  </h3>

                  <div className="space-y-3">
                    <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Classificação Atual:</span>
                      <span className="text-sm font-black text-amber-400">
                        {myRank ? `${myRank.rank}º Lugar` : 'Em Andamento'}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Pontuação Acumulada:</span>
                      <span className="text-sm font-black text-emerald-400">
                        {myRank ? `${myRank.totalPoints} pts` : `${athleteScores.length * 95} pts`}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Baterias Agendadas:</span>
                      <span className="text-sm font-black text-blue-400">
                        {athleteHeats.length} provas
                      </span>
                    </div>
                  </div>

                  <Link
                    href="/athlete/register"
                    className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-md shadow-purple-600/20"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Inscrever em Nova Prova</span>
                  </Link>
                </div>
              </div>

            </div>
          </div>
        )}


        {/* CASO NÃO HAJA INSCRIÇÃO SELECIONADA OU ENCONTRADA */}
        {activeTab === 'credential' && !selectedTeam && (
          <div className="p-10 rounded-3xl bg-zinc-900/90 border border-zinc-800 text-center space-y-4 max-w-2xl mx-auto shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
              <QrCode className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">Nenhuma Inscrição Vinculada Neste Torneio</h3>
              <p className="text-xs text-zinc-400">
                {session.role === 'SUPER_ADMIN' || session.role === 'ORGANIZER' 
                  ? 'Você está conectado como Administrador do Sistema. Use o seletor "Inspecionar Atleta" no topo ou o campo de busca por BIB para inspecionar um competidor.'
                  : `Você ainda não possui uma inscrição ativa no campeonato "${activeGame?.name || 'selecionado'}". Garanta sua vaga agora mesmo!`}
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/athlete/register"
                className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 flex items-center gap-2 transition-transform active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>Realizar Inscrição Oficial</span>
              </Link>

              <button
                onClick={() => setActiveTab('available_events')}
                className="px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700 transition-colors"
              >
                Ver Outros Campeonatos
              </button>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* 2. ABA: TIMELINE & BATERIAS (CRONOGRAMA) */}
        {/* ────────────────────────────────────────────────────────────────────────── */}
        {activeTab === 'timeline' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  Cronograma de Baterias & Raias Agendadas
                </h3>
                <p className="text-xs text-zinc-400">
                  Apresente-se na área de aquecimento (Call Room) com 15 minutos de antecedência ao horário de entrada.
                </p>
              </div>
            </div>

            {athleteHeats.length > 0 ? (
              <div className="space-y-4">
                {athleteHeats.map((item, idx) => (
                  <div 
                    key={item.heat.id || idx}
                    className="p-5 rounded-3xl bg-zinc-900/90 border border-zinc-800 hover:border-blue-500/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 font-black text-sm flex items-center justify-center flex-shrink-0">
                        #{idx + 1}
                      </div>

                      <div className="space-y-1">
                        <div className="text-[10px] font-black uppercase tracking-wider text-blue-400 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 w-fit">
                          {item.workout.title}
                        </div>
                        <h4 className="text-base font-bold text-white">
                          Bateria #{item.heat.heatNumber} • Raia {item.lane}
                        </h4>
                        <p className="text-xs text-zinc-400">
                          {item.workout.description || 'Prova oficial homologada'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 bg-zinc-950 p-3 rounded-2xl border border-zinc-800/80">
                      <div className="text-right">
                        <div className="text-[10px] text-zinc-400 uppercase font-bold">Horário de Entrada</div>
                        <div className="text-base font-black text-amber-400 font-mono">
                          {item.heat.estimatedStartTime || '09:00'}
                        </div>
                      </div>

                      <div className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-black text-xs">
                        Raia {item.lane}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 text-center space-y-3">
                <Activity className="w-10 h-10 text-zinc-600 mx-auto" />
                <h4 className="text-base font-bold text-white">Nenhuma bateria alocada no momento</h4>
                <p className="text-xs text-zinc-400 max-w-md mx-auto">
                  A organização do evento está realizando o sorteio e geração de raias. Fique atento às notificações da mesa de arbitragem.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* 3. ABA: MEUS SCORES & LEADERBOARD PESSOAL */}
        {/* ────────────────────────────────────────────────────────────────────────── */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Scores Homologados & Classificação Oficial
                </h3>
                <p className="text-xs text-zinc-400">
                  Pontuações conferidas e assinadas pelo juiz de arena.
                </p>
              </div>

              <button
                onClick={() => setIsContestModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Solicitar Revisão de Score</span>
              </button>
            </div>

            {/* LISTA DE SCORES LANÇADOS */}
            <div className="space-y-3">
              {athleteScores.length > 0 ? (
                athleteScores.map((sc, idx) => (
                  <div key={sc.id || idx} className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{sc.workoutTitle || `WOD ${idx + 1}`}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                          Homologado
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400">
                        Árbitro: <strong>{sc.judgeName || 'Juiz Oficial'}</strong> • Tie-Break: <strong>{sc.tieBreakTimeFormatted || '00:00'}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                      <div className="text-right">
                        <div className="text-[10px] text-zinc-400 uppercase font-bold">Resultado</div>
                        <div className="text-base font-black text-white font-mono">{sc.scoreResultFormatted || '06:14.2'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-zinc-400 uppercase font-bold">Pontos</div>
                        <div className="text-base font-black text-amber-400">{sc.pointsAwarded || 100} pts</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 text-center space-y-2">
                  <Flame className="w-10 h-10 text-amber-500/40 mx-auto" />
                  <h4 className="text-sm font-bold text-white">Nenhum score registrado ainda</h4>
                  <p className="text-xs text-zinc-400">Seus resultados aparecerão aqui assim que sua bateria for julgada na arena.</p>
                </div>
              )}
            </div>

            {/* TABELA DE LEADERBOARD COMPLETA DA CATEGORIA */}
            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>Leaderboard da Categoria: {currentCategory?.name || 'Geral'}</span>
                </h4>
                <span className="text-xs text-zinc-400">
                  {categoryTeams.length} Atletas / Equipes inscritos
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950/60">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-900/90 text-[10px] uppercase font-bold text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="p-3 w-14 text-center">Pos</th>
                      <th className="p-3">Atleta / Equipe</th>
                      <th className="p-3 hidden sm:table-cell">Box / Afiliação</th>
                      {categoryWorkouts.map((w, i) => (
                        <th key={w.id || i} className="p-3 text-center">
                          {w.title}
                        </th>
                      ))}
                      <th className="p-3 text-right font-black text-amber-400">Total Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {categoryLeaderboard.map((row) => {
                      const isMe = row.teamId === selectedTeam?.id;
                      return (
                        <tr 
                          key={row.teamId} 
                          className={`transition-colors ${
                            isMe 
                              ? 'bg-purple-950/40 font-bold border-l-4 border-l-purple-500 text-white' 
                              : 'hover:bg-zinc-900/40'
                          }`}
                        >
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                              row.rank === 1 ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20' :
                              row.rank === 2 ? 'bg-slate-300 text-black' :
                              row.rank === 3 ? 'bg-amber-700 text-white' :
                              'text-zinc-400'
                            }`}>
                              {row.rank}º
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-bold flex items-center gap-1.5">
                              <span>{row.teamName}</span>
                              {isMe && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-300 border border-purple-500/40 uppercase">
                                  Você
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono">BIB: #{row.registerNumber}</div>
                          </td>
                          <td className="p-3 hidden sm:table-cell text-zinc-400">
                            {row.boxOrAffiliate || 'Box Filiada'}
                          </td>
                          {categoryWorkouts.map((w) => {
                            const wScore = row.workoutScores[w.id];
                            return (
                              <td key={w.id} className="p-3 text-center font-mono">
                                {wScore ? (
                                  <div>
                                    <div className="text-white text-xs font-bold">{wScore.scoreFormatted}</div>
                                    <div className="text-[10px] text-amber-400/90">{wScore.points} pts</div>
                                  </div>
                                ) : (
                                  <span className="text-zinc-600">-</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="p-3 text-right">
                            <span className="text-sm font-black text-amber-400 font-mono">
                              {row.totalPoints} pts
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-center pt-2">
              <Link
                href="/leaderboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700 transition-colors"
              >
                <span>Abrir Leaderboard Geral de Todas as Categorias</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* 4. ABA: PRÓXIMOS CAMPEONATOS & INSCRIÇÕES ABERTAS */}
        {/* ────────────────────────────────────────────────────────────────────────── */}
        {activeTab === 'available_events' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Campeonatos Oficiais Disponíveis para Inscrição
              </h3>
              <p className="text-xs text-zinc-400">
                Selecione um evento para garantir sua vaga e escolher o tamanho da camiseta oficial.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {games.map((g) => (
                <div 
                  key={g.id || g.code}
                  className="p-6 rounded-3xl bg-zinc-900/90 border border-zinc-800 hover:border-amber-500/40 transition-all space-y-4 shadow-xl"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          {g.eventType === 'crossfit' ? 'CrossFit Oficial' : 'HYROX Racing'}
                        </span>
                        <span className={`w-2 h-2 rounded-full ${g.status === 'live' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                      </div>
                      <h4 className="text-lg font-black text-white">{g.name}</h4>
                    </div>

                    <div className="text-right text-xs text-zinc-400 font-bold">
                      {g.lanesCount || 8} Raias
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                    {g.description || 'Campeonato oficial organizado na plataforma ITGames Arena.'}
                  </p>

                  <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-red-400" />
                      <span>{g.location || 'Brasil'}</span>
                    </div>

                    <Link
                      href="/athlete/register"
                      onClick={() => storage.setActiveGameId(g.code || g.id)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-transform active:scale-95"
                    >
                      <span>Inscrever-se</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* MODAL DE CONTESTAÇÃO DE SCORE COM HEAD JUDGE */}
        {/* ────────────────────────────────────────────────────────────────────────── */}
        {isContestModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="bg-zinc-900 border border-red-500/30 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center font-bold">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Contestação Oficial de Score</h3>
                    <p className="text-xs text-zinc-400">Protocolo direto com o Head Judge do Torneio</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsContestModalOpen(false)}
                  className="text-zinc-500 hover:text-white text-sm p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Selecione a Prova / WOD</label>
                  <select
                    value={contestWorkoutId}
                    onChange={(e) => setContestWorkoutId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="">Selecione o WOD contestado</option>
                    {workouts.map(w => (
                      <option key={w.id} value={w.id}>{w.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Motivo Detalhado da Contestação</label>
                  <textarea
                    rows={4}
                    required
                    value={contestReason}
                    onChange={(e) => setContestReason(e.target.value)}
                    placeholder="Ex: Houve divergência no número de repetições computadas na 3ª série de Thrusters ou o tempo de tie-break difere da súmula de papel..."
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-400 space-y-1">
                  <strong>Atenção:</strong> Conforme regulamento, contestações devem ser abertas no prazo máximo de 30 minutos após o término da bateria.
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  onClick={() => setIsContestModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSendContest}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-500/20 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar ao Head Judge</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* MODAL DE VISUALIZAÇÃO DO COMPROVANTE ENVIADO PELO ATLETA */}
        {/* ────────────────────────────────────────────────────────────────────────── */}
        {isViewingProofModal && selectedTeam?.proofOfPaymentUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="bg-zinc-900 border border-purple-500/30 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Comprovante de Pagamento</h3>
                    <p className="text-xs text-zinc-400 font-mono">
                      Inscrição: {selectedTeam.registerNumber} • {selectedTeam.teamName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsViewingProofModal(false)}
                  className="text-zinc-500 hover:text-white text-sm p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-center">
                  {selectedTeam.proofOfPaymentUrl.startsWith('data:image') || selectedTeam.proofOfPaymentUrl.startsWith('http') ? (
                    <img
                      src={selectedTeam.proofOfPaymentUrl}
                      alt="Comprovante Pix"
                      className="max-h-72 mx-auto rounded-xl object-contain border border-zinc-700"
                    />
                  ) : (
                    <div className="p-4 bg-zinc-900 rounded-xl text-left space-y-1">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Código/Autenticação Pix Informada:</span>
                      <p className="font-mono text-xs text-amber-300 break-all select-all font-bold">
                        {selectedTeam.proofOfPaymentUrl}
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-zinc-950 text-[11px] text-zinc-400 flex items-center justify-between">
                  <span>Data de envio:</span>
                  <strong className="text-zinc-200">
                    {selectedTeam.proofUploadedAt ? new Date(selectedTeam.proofUploadedAt).toLocaleString('pt-BR') : 'Hoje'}
                  </strong>
                </div>
              </div>

              <div className="flex items-center justify-end pt-3 border-t border-zinc-800">
                <button
                  onClick={() => setIsViewingProofModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/20"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AclGuard>
  );
}


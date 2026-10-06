'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  UserCheck, 
  Dumbbell, 
  Users, 
  Calendar, 
  CreditCard, 
  QrCode, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  ShieldCheck, 
  Flame, 
  Sparkles,
  Copy,
  Check,
  Building2,
  Clock
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { GameEvent, Category, TeamRegistration, Athlete } from '@/types';
import { formatCpf, isValidCpf, onlyDigits } from '@/lib/cpf';
import { getCurrentUserSession } from '@/lib/acl';
import { LgpdConsentModal } from '@/components/lgpd/LgpdConsentModal';
import { QRCodeSVG } from 'qrcode.react';
import { apiClient, ApiError } from '@/lib/api-client';
import { buildPixPayload } from '@/lib/pix';
import { toast } from 'sonner';

// Integrante identificado por CPF (e e-mail opcional). Os dados reais vêm do cadastro de atleta, na API.
interface Member {
  cpf: string;
  email: string;
  status: 'idle' | 'checking' | 'found' | 'missing' | 'invalid';
  firstName?: string;
}

// Categoria esgotada: tem limite de inscrições e todas as vagas já estão ocupadas
function isCategoryFull(cat: Category): boolean {
  return !!cat.maxRegistrations && (cat.registrationsCount ?? 0) >= cat.maxRegistrations;
}

export default function AthleteRegistrationWizardPage() {
  const [isMounted, setIsMounted] = useState(false);
  // 'guest' → vai para o login; 'forbidden' → logado, mas não é atleta; 'ok' → capitão logado
  const [access, setAccess] = useState<'loading' | 'guest' | 'forbidden' | 'ok'>('loading');
  const [captain, setCaptain] = useState<{ name: string; cpf: string } | null>(null);
  const [activeGame, setActiveGame] = useState<GameEvent | null>(null);
  const [games, setGames] = useState<GameEvent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Wizard Steps: 1 (Categoria), 2 (Atletas & Dados), 3 (Validação & LGPD), 4 (Pagamento Pix/Cartão), 5 (Confirmação)
  const [step, setStep] = useState<number>(1);

  // Seleções
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [teamName, setTeamName] = useState<string>('');
  const [members, setMembers] = useState<Member[]>([]);

  // LGPD & Pagamento
  const [isLgpdModalOpen, setIsLgpdModalOpen] = useState(false);
  const [hasLgpdConsent, setHasLgpdConsent] = useState(false);
  const [isCopiedPix, setIsCopiedPix] = useState(false);
  const [createdRegistration, setCreatedRegistration] = useState<TeamRegistration | null>(null);

  const loadData = async () => {
    let apiGames: any[] = [];
    try {
      apiGames = (await apiClient.listGames()) || [];
    } catch (e) {
      console.warn('[Register] Falha ao carregar campeonatos da API', e);
    }

    const loadedGames: GameEvent[] = apiGames.map((g) => ({
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
      pixKey: g.pixKey || undefined,
      pixBeneficiary: g.pixBeneficiary || undefined,
      scoringRules: {
        isLowestPointsBetter: g.isLowestPointsBetter || false,
        hyroxChipTimingEnabled: g.eventType === 'hyrox',
      },
    }));
    setGames(loadedGames);

    const activeId = storage.getActiveGameId();
    const game = loadedGames.find(g => g.id === activeId || g.code === activeId) || loadedGames[0];
    setActiveGame(game || null);

    if (game) {
      // Buscar categorias reais da API
      let apiCats: any[] | null = null;
      try {
        apiCats = await apiClient.listCategories(game.code || game.id);
      } catch (e) {}

      let loadedCats: Category[] = [];
      if (apiCats && apiCats.length > 0) {
        loadedCats = apiCats.map(c => ({
          id: String(c.code),
          gameId: game.id,
          name: c.name,
          description: c.description || '',
          standards: c.standards || '',
          price: c.amount || 0,
          type: (game.eventType as any) || 'crossfit',
          teamFormat: (c.teamType as any) || 'individual',
          maxAthletesPerTeam: c.maxAthlete || 1,
          genderComposition: (c.genderRule as any) || 'open',
          division: 'open',
          ageRule: c.minTeamSumAge ? 'sum_team_age' : c.minIndividualAge ? 'min_individual_age' : c.maxIndividualAge ? 'max_individual_age' : 'none',
          minIndividualAge: c.minIndividualAge,
          maxIndividualAge: c.maxIndividualAge,
          minSumTeamAge: c.minTeamSumAge,
          spotsTotal: c.maxRegistrations ?? 0,
          spotsFilled: c.registrationsCount ?? 0,
          maxRegistrations: c.maxRegistrations ?? null,
          registrationsCount: c.registrationsCount ?? 0,
        }));
        setCategories(loadedCats);
      } else {
        // campeonato liberado sem categorias: lista vazia, nunca categorias de exemplo
        loadedCats = [];
        setCategories(loadedCats);
      }


      // pré-seleciona a primeira categoria que ainda tem vaga
      const firstOpen = loadedCats.find((c) => !isCategoryFull(c));
      setSelectedCategoryId(firstOpen ? firstOpen.id : '');
    }
  };

  // A inscrição exige capitão logado como atleta; o CPF dele vem do cadastro (GET /auth/me)
  useEffect(() => {
    const session = getCurrentUserSession();
    if (session.role === 'GUEST') {
      setAccess('guest');
      window.location.replace('/login?next=/athlete/register');
      return;
    }
    // organizador também compete; a API barra quem ainda é organizador ativo do campeonato
    if (session.role !== 'ATHLETE' && session.role !== 'ORGANIZER') {
      setAccess('forbidden');
      return;
    }
    apiClient
      .getMe()
      .then((me) => {
        // ownCpf é o CPF do próprio usuário sem máscara (o campo cpf vem mascarado pela API)
        setCaptain({ name: me.name, cpf: onlyDigits(me.ownCpf || '') });
        setAccess('ok');
      })
      .catch(() => setAccess('guest'));
  }, []);

  useEffect(() => {
    setIsMounted(true);
    loadData();
    window.addEventListener('itgames_storage_updated', loadData);
    return () => window.removeEventListener('itgames_storage_updated', loadData);
  }, []);


  const currentCategory: Category | undefined = categories.find(c => c.id === selectedCategoryId) || categories[0];

  // Lista de integrantes: o capitão (logado) é sempre o #1; os demais são preenchidos por CPF
  useEffect(() => {
    if (!currentCategory || !captain) return;
    const count = currentCategory.maxAthletesPerTeam || 1;
    const list: Member[] = [{ cpf: captain.cpf, email: '', status: 'found', firstName: captain.name.split(' ')[0] }];
    for (let i = 1; i < count; i++) list.push({ cpf: '', email: '', status: 'idle' });
    setMembers(list);
  }, [currentCategory?.id, currentCategory?.maxAthletesPerTeam, captain]);

  const handleSelectCategory = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    if (cat && isCategoryFull(cat)) {
      toast.error(`Categoria esgotada: ${cat.name} atingiu o limite de ${cat.maxRegistrations} inscrições.`);
      return;
    }
    setSelectedCategoryId(catId);
  };

  const patchMember = (index: number, patch: Partial<Member>) =>
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));

  // Digitou o CPF do parceiro: valida o formato e confere na API se ele tem cadastro de atleta
  const handleMemberCpf = async (index: number, raw: string) => {
    const cpf = formatCpf(raw);
    if (onlyDigits(cpf).length < 11) {
      patchMember(index, { cpf, status: 'idle', firstName: undefined });
      return;
    }
    if (!isValidCpf(cpf)) {
      patchMember(index, { cpf, status: 'invalid', firstName: undefined });
      return;
    }
    patchMember(index, { cpf, status: 'checking', firstName: undefined });
    try {
      const res = await apiClient.lookupAthlete(onlyDigits(cpf));
      // ignora a resposta se o campo mudou enquanto a consulta rodava
      setMembers((prev) =>
        prev.map((m, i) =>
          i === index && m.cpf === cpf
            ? { ...m, status: res.found ? 'found' : 'missing', firstName: res.firstName }
            : m,
        ),
      );
    } catch (err) {
      patchMember(index, { status: 'idle' });
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível consultar o CPF.');
    }
  };

  // Avançar para pagamento
  const handleProceedToPayment = () => {
    if (!teamName.trim()) {
      toast.error('Informe o nome da equipe ou atleta');
      return;
    }

    const problem = members.find((m) => m.status !== 'found');
    if (problem) {
      toast.error(
        problem.status === 'missing'
          ? 'Todos os integrantes precisam ter cadastro de atleta. Peça ao parceiro para se cadastrar.'
          : 'Informe o CPF válido de todos os integrantes.',
      );
      return;
    }

    const cpfs = members.map((m) => onlyDigits(m.cpf));
    if (new Set(cpfs).size !== cpfs.length) {
      toast.error('Há CPF repetido entre os integrantes.');
      return;
    }

    if (!hasLgpdConsent) {
      setIsLgpdModalOpen(true);
      return;
    }

    setStep(4);
  };

  // Concluir a inscrição: a API gera o número de inscrição; o pagamento é confirmado pela organização
  const handleConfirmRegistration = async () => {
    if (!activeGame || !currentCategory) return;

    const catCodeNumber = Number(String(currentCategory.id).replace(/\D/g, '')) || 1;

    let result: any;
    try {
      result = await apiClient.registerTeam(activeGame.code || activeGame.id, {
        gameCode: activeGame.code || activeGame.id,
        categoryId: catCodeNumber,
        teamName,
        athletes: members.map((m) => ({
          cpf: onlyDigits(m.cpf),
          ...(m.email.trim() ? { email: m.email.trim() } : {}),
        })),
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível concluir a inscrição. Tente novamente.');
      if (err instanceof ApiError && err.status === 409) {
        // alguém ocupou a última vaga enquanto você preenchia: volta para a escolha com as vagas atualizadas
        setStep(1);
        await loadData();
      }
      return;
    }

    const saved = result?.registration;
    const bib = saved?.number || `#${saved?.code ?? ''}`;
    const newReg: TeamRegistration = {
      id: `reg_${saved?.code ?? Date.now()}`,
      gameId: activeGame.id,
      categoryId: currentCategory.id,
      categoryName: currentCategory.name,
      teamName,
      registerNumber: bib,
      amountPaid: 0,
      paymentStatus: 'pending',
      paymentMethod: 'pix',
      registeredAt: new Date().toISOString(),
      checkedIn: false,
      teamAgeSum: 0,
      validationStatus: 'valid',
      validationMessage: '',
      // dados oficiais, como a API gravou a partir do cadastro de cada atleta
      athletes: (saved?.athletes ?? []).map((a: any) => ({
        id: `ath_${saved?.code}_${a.code}`,
        name: a.name,
        gender: a.gender === 'F' ? 'F' : 'M',
        tshirtSize: a.tshirtSize || 'M',
        checkIn: false,
        lgpdConsent: true,
      })),
    };

    setCreatedRegistration(newReg);
    setStep(5);
    toast.success(`Inscrição ${bib} registrada! Faça o Pix e aguarde a confirmação da organização.`);
  };

  // Pix copia e cola real, gerado com a chave cadastrada pela organização do campeonato
  const pixPayload = activeGame?.pixKey
    ? buildPixPayload({
        key: activeGame.pixKey,
        beneficiary: activeGame.pixBeneficiary,
        amount: currentCategory?.price || 0,
      })
    : null;

  if (!isMounted) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-zinc-400">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <span>Carregando portal de inscrições...</span>
      </div>
    );
  }

  if (access !== 'ok' || !captain?.cpf) {
    const notice =
      access === 'forbidden'
        ? 'A inscrição em competições é feita por atletas e organizadores. Entre com a sua conta.'
        : access === 'ok'
          ? 'Seu cadastro não possui CPF. Complete o cadastro em "Meu Perfil" para se inscrever.'
          : null;
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center text-zinc-400 space-y-4">
        {notice ? (
          <>
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="text-sm">{notice}</p>
            <Link
              href={access === 'ok' ? '/perfil?next=/athlete/register' : '/login?next=/athlete/register'}
              className="inline-block text-xs font-bold text-amber-400 underline"
            >
              {access === 'ok' ? 'Completar cadastro' : 'Ir para o login / cadastro de atleta'}
            </Link>
          </>
        ) : (
          <>
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <span className="text-sm">
              {access === 'guest' ? 'Redirecionando para o login...' : 'Verificando seu cadastro de atleta...'}
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

      {/* CABEÇALHO DO WIZARD DE INSCRIÇÃO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Portal de Inscrições & Atletas</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
            Inscrição Oficial de Competição
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {activeGame?.name || 'ITGAMES Championship'} • <strong className="text-zinc-300">{activeGame?.location || 'Arena Oficial'}</strong>
          </p>
        </div>

        {/* INDICADOR DE PROGRESSO DOS PASSOS */}
        <div className="flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-2xl border border-zinc-800 text-xs font-bold">
          <span className={step >= 1 ? 'text-amber-400' : 'text-zinc-600'}>1. Categoria</span>
          <span className="text-zinc-600">→</span>
          <span className={step >= 2 ? 'text-amber-400' : 'text-zinc-600'}>2. Equipe</span>
          <span className="text-zinc-600">→</span>
          <span className={step >= 4 ? 'text-amber-400' : 'text-zinc-600'}>3. Pagamento</span>
          <span className="text-zinc-600">→</span>
          <span className={step >= 5 ? 'text-emerald-400' : 'text-zinc-600'}>4. Concluído</span>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* PASSO 1: ESCOLHA DA CATEGORIA E REGRAS */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="glass-panel rounded-3xl p-6 border border-zinc-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-amber-400" />
              1. Selecione a sua Categoria:
            </h3>

            {categories.length > 0 && categories.every(isCategoryFull) && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/40 text-sm text-red-300">
                Todas as categorias deste campeonato atingiram o limite de inscrições. Não há vagas disponíveis no momento.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categories.map((cat) => {
                const isSelected = cat.id === selectedCategoryId;
                const formatLabel = (cat.teamFormat || 'individual').toUpperCase();
                const maxAthletes = cat.maxAthletesPerTeam || 1;
                const priceVal = cat.price || 0;
                const isFull = isCategoryFull(cat);

                return (
                  <button
                    key={cat.id}
                    onClick={() => handleSelectCategory(cat.id)}
                    disabled={isFull}
                    aria-disabled={isFull}
                    className={`p-5 rounded-2xl text-left transition-all flex flex-col justify-between gap-4 ${
                      isFull
                        ? 'bg-zinc-950/60 border border-red-500/30 opacity-60 cursor-not-allowed'
                        : isSelected
                          ? 'bg-amber-500/15 border-2 border-amber-500 shadow-xl shadow-amber-500/10 scale-[1.01]'
                          : 'bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-zinc-800 text-amber-400">
                          {formatLabel} ({maxAthletes} {maxAthletes > 1 ? 'atletas' : 'atleta'})
                        </span>
                        <span className="text-base font-black text-emerald-400">
                          R$ {priceVal.toFixed(2)}
                        </span>
                      </div>

                      <h4 className="text-base font-black text-white mt-2 flex items-center gap-2 flex-wrap">
                        <span>{cat.name}</span>
                        {isFull && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40">
                            Esgotado
                          </span>
                        )}
                      </h4>
                      {isFull && (
                        <p className="text-[11px] text-red-300 mt-1">
                          Limite de {cat.maxRegistrations} inscrições atingido. Não é possível se inscrever nesta categoria.
                        </p>
                      )}
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{cat.description || ''}</p>
                    </div>

                    {/* BADGES DE REGRAS DE IDADE / GÊNERO */}
                    <div className="pt-3 border-t border-zinc-800/80 flex flex-wrap items-center gap-2 text-[10px]">
                      {cat.ageRule === 'sum_team_age' && cat.minSumTeamAge && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
                          Soma de Idades: {cat.minSumTeamAge}+ anos
                        </span>
                      )}
                      {cat.ageRule === 'min_individual_age' && cat.minIndividualAge && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-bold border border-purple-500/30">
                          Idade Mínima: {cat.minIndividualAge}+ anos
                        </span>
                      )}
                      {cat.ageRule === 'max_individual_age' && cat.maxIndividualAge && (
                        <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-bold border border-orange-500/30">
                          Idade Máxima: Até {cat.maxIndividualAge} anos
                        </span>
                      )}
                      {cat.maxRegistrations ? (
                        <span className={isFull ? 'text-red-300 font-bold' : 'text-zinc-500 font-semibold'}>
                          {cat.registrationsCount ?? 0}/{cat.maxRegistrations} vagas
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-zinc-800">
              <button
                onClick={() => setStep(2)}
                disabled={!selectedCategoryId || (!!currentCategory && isCategoryFull(currentCategory))}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
              >
                <span>Avançar para Cadastro da Equipe</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* PASSO 2: DADOS DOS ATLETAS & VALIDAÇÃO EM TEMPO REAL */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {step === 2 && currentCategory && (
        <div className="space-y-6">
          
          {/* NOME DA EQUIPE */}
          <div className="glass-panel rounded-3xl p-6 border border-zinc-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              2. Nome da Equipe / Atleta Competidor:
            </h3>

            <input
              type="text"
              required
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Ex: CrossFit Vikings, Dupla Dinâmica RX, ou Seu Nome"
              className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* INTEGRANTES: o capitão é o atleta logado; os demais são identificados pelo CPF do cadastro de atleta */}
          <div className="glass-panel rounded-3xl p-6 border border-zinc-800 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-purple-400" />
                Integrantes da Equipe ({members.length}/{currentCategory.maxAthletesPerTeam || 1})
              </h3>
            </div>

            <p className="text-xs text-zinc-400">
              Todos os integrantes precisam ter cadastro de atleta. Informe o CPF de cada parceiro; os dados (nome, idade,
              camiseta) vêm do cadastro dele. Quem ainda não tem conta deve se cadastrar em{' '}
              <Link href="/login" className="text-amber-400 underline">
                Cadastro de Atleta
              </Link>
              .
            </p>

            <div className="space-y-4">
              {members.map((member, idx) => {
                const isCaptain = idx === 0;
                return (
                  <div key={idx} className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                        {isCaptain ? 'Atleta #1 • Capitão (você)' : `Atleta #${idx + 1}`}
                      </span>
                      {member.status === 'checking' && <span className="text-[11px] text-zinc-400">Consultando...</span>}
                      {member.status === 'found' && (
                        <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Cadastro encontrado{member.firstName ? `: ${member.firstName}` : ''}
                        </span>
                      )}
                      {member.status === 'missing' && (
                        <span className="text-[11px] font-bold text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Sem cadastro de atleta
                        </span>
                      )}
                      {member.status === 'invalid' && (
                        <span className="text-[11px] font-bold text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> CPF inválido
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-zinc-400 block mb-1">CPF *</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          disabled={isCaptain}
                          value={formatCpf(member.cpf)}
                          onChange={(e) => handleMemberCpf(idx, e.target.value)}
                          placeholder="000.000.000-00"
                          className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 disabled:opacity-70"
                        />
                      </div>

                      {!isCaptain && (
                        <div>
                          <label className="text-[11px] font-bold text-zinc-400 block mb-1">E-mail do atleta (opcional)</label>
                          <input
                            type="email"
                            value={member.email}
                            onChange={(e) => patchMember(idx, { email: e.target.value })}
                            placeholder="parceiro@exemplo.com"
                            className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-zinc-500">
              As regras da categoria (idade e gênero) são conferidas pela organização com os dados cadastrados de cada atleta ao
              concluir a inscrição.
            </p>

            {/* BOTÕES DE NAVEGAÇÃO */}
            <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Voltar para Categorias
              </button>

              <button
                onClick={handleProceedToPayment}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-transform active:scale-95"
              >
                <span>Avançar para Pagamento</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* PASSO 4: CHECKOUT PIX & HOMOLOGAÇÃO */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {step === 4 && currentCategory && (
        <div className="space-y-6">
          <div className="glass-panel rounded-3xl p-6 border border-zinc-800 space-y-6">
            
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                  3. Pagamento da Taxa de Inscrição
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Equipe: <strong className="text-white">{teamName}</strong> • Categoria: <strong className="text-amber-400">{currentCategory.name}</strong>
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-zinc-400 font-bold uppercase block">Valor Total</span>
                <span className="text-2xl font-black text-emerald-400">
                  R$ {(currentCategory.price || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* PIX DA ORGANIZAÇÃO */}
            {pixPayload ? (
              <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
                <div className="space-y-3">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                    Pague via Pix para a organização
                  </span>
                  <dl className="text-xs text-zinc-300 space-y-1">
                    <div>
                      <dt className="inline text-zinc-500">Favorecido: </dt>
                      <dd className="inline font-bold">{activeGame?.pixBeneficiary || '—'}</dd>
                    </div>
                    <div>
                      <dt className="inline text-zinc-500">Chave Pix: </dt>
                      <dd className="inline font-mono font-bold break-all">{activeGame?.pixKey}</dd>
                    </div>
                    <div>
                      <dt className="inline text-zinc-500">Valor: </dt>
                      <dd className="inline font-bold">R$ {(currentCategory.price || 0).toFixed(2)}</dd>
                    </div>
                  </dl>
                  <p className="text-xs text-zinc-400 max-w-sm">
                    Abra o app do seu banco, escaneie o QR Code ou use o Pix copia e cola. Depois de pagar, a organização
                    confirma o pagamento e libera a sua vaga.
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(pixPayload);
                        setIsCopiedPix(true);
                        toast.success('Pix copia e cola copiado!');
                        setTimeout(() => setIsCopiedPix(false), 3000);
                      } catch {
                        toast.error('Não foi possível copiar. Use o QR Code ou digite a chave.');
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700"
                  >
                    {isCopiedPix ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopiedPix ? 'Copiado!' : 'Copiar Pix Copia e Cola'}</span>
                  </button>
                </div>

                <div className="bg-white p-3 rounded-2xl shadow-xl flex flex-col items-center shrink-0">
                  <QRCodeSVG value={pixPayload} size={140} />
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-zinc-950 border border-amber-500/30 text-xs text-zinc-300">
                A organização ainda não cadastrou a chave Pix deste campeonato. Você pode concluir a inscrição agora (ela
                fica pendente) e combinar o pagamento diretamente com a organização.
              </div>
            )}

            {/* FINALIZAÇÃO */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-800">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Voltar
              </button>

              <button
                onClick={handleConfirmRegistration}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-black text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-transform active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Concluir inscrição</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* PASSO 5: CONFIRMAÇÃO & CARTÃO DIGITAL DE CREDENCIAMENTO */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {step === 5 && createdRegistration && (
        <div className="space-y-6">
          <div className="glass-panel-gold rounded-3xl p-8 border-2 border-amber-500/60 text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-amber-500 text-black font-black text-2xl flex items-center justify-center mx-auto shadow-xl shadow-amber-500/40">
              ✓
            </div>

            <div>
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                INSCRIÇÃO REGISTRADA • AGUARDANDO CONFIRMAÇÃO DO PAGAMENTO PELA ORGANIZAÇÃO
              </span>

              <h2 className="text-3xl font-black text-white mt-2">
                Parabéns, {createdRegistration.teamName}!
              </h2>
              <p className="text-xs text-zinc-300 mt-1">
                {`Seu número de peito foi reservado para o ${activeGame?.name}. Depois de fazer o Pix, a organização confirma o pagamento e libera a sua vaga.`}
              </p>
            </div>

            {/* CARTÃO DO COMPETIDOR */}
            <div className="max-w-md mx-auto p-6 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-4 text-left">
              <div>
                <span className="text-xs font-bold text-amber-400">NÚMERO DE PEITO (BIB)</span>
                <div className="text-4xl font-black text-white font-mono">{createdRegistration.registerNumber}</div>
                <div className="text-xs text-zinc-400 mt-1">Categoria: <strong className="text-zinc-200">{createdRegistration.categoryName}</strong></div>
                <div className="text-[11px] text-zinc-300 mt-1">
                  Integrantes: {createdRegistration.athletes.map(a => `${a.name} (Camiseta: ${a.tshirtSize || 'M'})`).join(' • ')}
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-xl shrink-0 text-center">
                <QRCodeSVG
                  value={`ITGAMES:${activeGame?.code}:${createdRegistration.registerNumber}`}
                  size={90}
                />
                <span className="text-[9px] font-black text-black font-mono block mt-1">BIB: {createdRegistration.registerNumber}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-4 border-t border-zinc-800/80">
              <Link
                href="/athlete"
                className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2"
              >
                <span>Acessar Meu Painel de Atleta & Comprovante</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONSENTIMENTO LGPD */}
      <LgpdConsentModal
        isOpen={isLgpdModalOpen}
        onClose={() => setIsLgpdModalOpen(false)}
        onAccept={() => {
          setHasLgpdConsent(true);
          setIsLgpdModalOpen(false);
          setStep(4);
        }}
        athleteName={teamName || 'Capitão da Equipe'}
      />

    </div>
  );
}

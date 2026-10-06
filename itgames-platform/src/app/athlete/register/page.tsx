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
import { calculateAge, validateTeamAgainstCategoryRules, ValidationResult } from '@/lib/team-validation';
import { LgpdConsentModal } from '@/components/lgpd/LgpdConsentModal';
import { QRCodeSVG } from 'qrcode.react';
import { apiClient, ApiError } from '@/lib/api-client';
import { buildPixPayload } from '@/lib/pix';
import { toast } from 'sonner';

export default function AthleteRegistrationWizardPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [activeGame, setActiveGame] = useState<GameEvent | null>(null);
  const [games, setGames] = useState<GameEvent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Wizard Steps: 1 (Categoria), 2 (Atletas & Dados), 3 (Validação & LGPD), 4 (Pagamento Pix/Cartão), 5 (Confirmação)
  const [step, setStep] = useState<number>(1);

  // Seleções
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [teamName, setTeamName] = useState<string>('');
  const [athletes, setAthletes] = useState<Athlete[]>([]);

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
          spotsTotal: 30,
          spotsFilled: 0,
        }));
        setCategories(loadedCats);
      } else {
        // campeonato liberado sem categorias: lista vazia, nunca categorias de exemplo
        loadedCats = [];
        setCategories(loadedCats);
      }


      if (loadedCats.length > 0) {
        setSelectedCategoryId(loadedCats[0].id);
        initAthletesForCategory(loadedCats[0]);
      }
    }
  };

  useEffect(() => {
    setIsMounted(true);
    loadData();
    window.addEventListener('itgames_storage_updated', loadData);
    return () => window.removeEventListener('itgames_storage_updated', loadData);
  }, []);


  const currentCategory: Category | undefined = categories.find(c => c.id === selectedCategoryId) || categories[0];

  // Inicializar lista de atletas de acordo com a categoria
  const initAthletesForCategory = (cat?: Category) => {
    if (!cat) return;
    const maxCount = cat.maxAthletesPerTeam || 1;
    const list: Athlete[] = [];
    for (let i = 0; i < maxCount; i++) {
      list.push({
        id: `ath_${Date.now()}_${i}`,
        name: '',
        cpf: '',
        email: '',
        phone: '',
        birthDate: '1990-01-01',
        age: 36,
        gender: cat.genderComposition === 'female' ? 'F' : 'M',
        tshirtSize: 'M',
        boxOrAffiliate: '',
        checkIn: false
      });
    }
    setAthletes(list);
  };

  const handleSelectCategory = (catId: string) => {
    setSelectedCategoryId(catId);
    const cat = categories.find(c => c.id === catId);
    if (cat) {
      initAthletesForCategory(cat);
    }
  };

  // Atualizar dados de 1 atleta
  const handleUpdateAthlete = (index: number, field: keyof Athlete, value: any) => {
    const updated = [...athletes];
    if (!updated[index]) return;
    
    updated[index] = {
      ...updated[index],
      [field]: value
    };

    if (field === 'birthDate') {
      updated[index].age = calculateAge(value);
    }

    setAthletes(updated);
  };

  // Validar regras da equipe
  const validation: ValidationResult = currentCategory 
    ? validateTeamAgainstCategoryRules(currentCategory, athletes)
    : { isValid: false, message: 'Selecione uma categoria válida', calculatedAgeSum: 0, athleteAges: [] };

  // Avançar para pagamento
  const handleProceedToPayment = () => {
    if (!teamName.trim()) {
      toast.error('Informe o nome da equipe ou atleta');
      return;
    }

    const hasEmptyNames = athletes.some(a => !a.name.trim());
    if (hasEmptyNames) {
      toast.error('Preencha o nome completo de todos os integrantes');
      return;
    }

    if (!validation.isValid) {
      toast.error(validation.message);
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
        athletes: athletes.map((a) => ({
          name: a.name,
          cpf: a.cpf,
          phonenumber: a.phone,
          birthDate: a.birthDate,
          gender: a.gender,
          tshirtSize: a.tshirtSize || 'M',
        })),
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível concluir a inscrição. Tente novamente.');
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
      teamAgeSum: validation.calculatedAgeSum,
      validationStatus: 'valid',
      validationMessage: validation.message,
      athletes: athletes.map((a) => ({
        ...a,
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categories.map((cat) => {
                const isSelected = cat.id === selectedCategoryId;
                const formatLabel = (cat.teamFormat || 'individual').toUpperCase();
                const maxAthletes = cat.maxAthletesPerTeam || 1;
                const priceVal = cat.price || 0;

                return (
                  <button
                    key={cat.id}
                    onClick={() => handleSelectCategory(cat.id)}
                    className={`p-5 rounded-2xl text-left transition-all flex flex-col justify-between gap-4 ${
                      isSelected
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

                      <h4 className="text-base font-black text-white mt-2">{cat.name}</h4>
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
                      <span className="text-zinc-500 font-semibold">
                        {cat.spotsFilled || 0}/{cat.spotsTotal || 20} vagas
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-zinc-800">
              <button
                onClick={() => setStep(2)}
                disabled={!selectedCategoryId}
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

          {/* LISTA DE ATLETAS */}
          <div className="glass-panel rounded-3xl p-6 border border-zinc-800 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-purple-400" />
                Integrantes da Equipe ({athletes.length}/{currentCategory.maxAthletesPerTeam || 1})
              </h3>

              {/* SOMA DE IDADES ATUAL */}
              {currentCategory.ageRule === 'sum_team_age' && (
                <div className="px-3 py-1 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-400 text-xs font-bold">
                  Soma Atual: <strong>{validation.calculatedAgeSum} anos</strong> (Mínimo: {currentCategory.minSumTeamAge || 110})
                </div>
              )}
            </div>

            <div className="space-y-4">
              {athletes.map((athlete, idx) => (
                <div key={athlete.id} className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Atleta #{idx + 1}
                    </span>
                    <div className="text-[11px] text-zinc-400 font-semibold">
                      Idade Calculada: <strong className="text-white">{athlete.age || 0} anos</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 block mb-1">Nome Completo</label>
                      <input
                        type="text"
                        required
                        value={athlete.name}
                        onChange={(e) => handleUpdateAthlete(idx, 'name', e.target.value)}
                        placeholder="Nome do atleta"
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 block mb-1">Data de Nascimento</label>
                      <input
                        type="date"
                        required
                        value={athlete.birthDate || '1990-01-01'}
                        onChange={(e) => handleUpdateAthlete(idx, 'birthDate', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 block mb-1">Gênero</label>
                      <select
                        value={athlete.gender}
                        onChange={(e) => handleUpdateAthlete(idx, 'gender', e.target.value as 'M' | 'F')}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="M">Masculino (M)</option>
                        <option value="F">Feminino (F)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 block mb-1">Tamanho Camiseta</label>
                      <select
                        value={athlete.tshirtSize || 'M'}
                        onChange={(e) => handleUpdateAthlete(idx, 'tshirtSize', e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-amber-500/40 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                      >
                        <option value="PP">PP (Extra Pequeno)</option>
                        <option value="P">P (Pequeno)</option>
                        <option value="M">M (Médio)</option>
                        <option value="G">G (Grande)</option>
                        <option value="GG">GG (Extra Grande)</option>
                        <option value="XG">XG (Super Grande)</option>
                        <option value="XGG">XGG (Plus)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 block mb-1">CPF (Opcional p/ LGPD)</label>
                      <input
                        type="text"
                        value={athlete.cpf || ''}
                        onChange={(e) => handleUpdateAthlete(idx, 'cpf', e.target.value)}
                        placeholder="000.000.000-00"
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 block mb-1">WhatsApp / Telefone</label>
                      <input
                        type="text"
                        value={athlete.phone || ''}
                        onChange={(e) => handleUpdateAthlete(idx, 'phone', e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 block mb-1">Box / Academia</label>
                      <input
                        type="text"
                        value={athlete.boxOrAffiliate || ''}
                        onChange={(e) => handleUpdateAthlete(idx, 'boxOrAffiliate', e.target.value)}
                        placeholder="Ex: CrossFit Imperial"
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* STATUS DO MOTOR DE VALIDAÇÃO DE REGRAS */}
            <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
              validation.isValid ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-red-500/10 border-red-500/40 text-red-300'
            }`}>
              {validation.isValid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="text-xs">
                <div className="font-bold">
                  {validation.isValid ? 'Equipe Elegível para a Categoria' : 'Inconformidade com as Regras da Categoria'}
                </div>
                <div className="text-zinc-300 mt-0.5">{validation.message}</div>
              </div>
            </div>

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

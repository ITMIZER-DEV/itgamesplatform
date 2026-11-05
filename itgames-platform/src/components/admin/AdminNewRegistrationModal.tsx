'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Users, 
  User, 
  UserPlus, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  CreditCard, 
  Building2, 
  Calendar, 
  Phone, 
  Mail, 
  Shirt, 
  ShieldCheck, 
  Loader2, 
  DollarSign,
  Flame,
  Check
} from 'lucide-react';
import { Category, TeamRegistration, Athlete } from '@/types';
import { apiClient, AthleteAdminRow, ApiError } from '@/lib/api-client';
import { storage } from '@/lib/storage';
import { validateTeamAgainstCategoryRules, calculateAge, resolveCategoryRules } from '@/lib/team-validation';
import { toast } from 'sonner';

interface AdminNewRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  gameCode: string;
  onSuccess: (newTeam: TeamRegistration) => void;
}

interface AthleteFormState {
  name: string;
  cpf: string;
  email: string;
  phone: string;
  gender: 'M' | 'F';
  birthDate: string;
  tshirtSize: 'PP' | 'P' | 'M' | 'G' | 'GG' | 'XG' | 'XGG';
  boxOrAffiliate: string;
}

const TSHIRT_SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG'] as const;

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

export function AdminNewRegistrationModal({
  isOpen,
  onClose,
  categories,
  gameCode,
  onSuccess,
}: AdminNewRegistrationModalProps) {
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [teamName, setTeamName] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending' | 'free'>('paid');
  const [amountPaid, setAmountPaid] = useState<number>(150);
  const [activeAthleteTab, setActiveAthleteTab] = useState(0);
  const [athletes, setAthletes] = useState<AthleteFormState[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Busca e vínculo de atletas cadastrados
  const [athleteSearchQuery, setAthleteSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AthleteAdminRow[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Categoria selecionada
  const selectedCategory = useMemo(() => {
    return categories.find((c) => String(c.id) === selectedCatId) || categories[0] || null;
  }, [categories, selectedCatId]);

  // Determinar regras resolvidas da categoria
  const categoryRules = useMemo(() => {
    return resolveCategoryRules(selectedCategory);
  }, [selectedCategory]);

  const requiredAthletesCount = categoryRules.maxAthletes;

  // Inicializar formulário ao abrir
  useEffect(() => {
    if (isOpen && categories.length > 0) {
      const initialCat = categories[0];
      setSelectedCatId(String(initialCat.id));
      const price = (initialCat as any).priceBrl ?? initialCat.price ?? 150;
      setAmountPaid(price);
      setTeamName('');
      setPaymentStatus('paid');
      setActiveAthleteTab(0);
      setAthleteSearchQuery('');
      setSearchResults([]);
    }
  }, [isOpen, categories]);

  // Ajustar número de atletas quando mudar a categoria
  useEffect(() => {
    if (!selectedCategory) return;
    const price = (selectedCategory as any).priceBrl ?? selectedCategory.price ?? 150;
    setAmountPaid(price);

    setAthletes((prev) => {
      const next: AthleteFormState[] = [];
      for (let i = 0; i < requiredAthletesCount; i++) {
        if (prev[i]) {
          next.push(prev[i]);
        } else {
          next.push({
            name: '',
            cpf: '',
            email: '',
            phone: '',
            gender: categoryRules.gender === 'female' ? 'F' : 'M',
            birthDate: '',
            tshirtSize: 'M',
            boxOrAffiliate: '',
          });
        }
      }
      return next;
    });

    if (activeAthleteTab >= requiredAthletesCount) {
      setActiveAthleteTab(0);
    }
  }, [selectedCategory, requiredAthletesCount]);

  // Busca debounced de atletas cadastrados
  useEffect(() => {
    if (!athleteSearchQuery.trim() || athleteSearchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await apiClient.listAthletes(athleteSearchQuery.trim());
        setSearchResults(results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [athleteSearchQuery]);

  // Vincular atleta selecionado na aba ativa
  const handleSelectExistingAthlete = (ath: AthleteAdminRow) => {
    setAthletes((prev) =>
      prev.map((a, idx) => {
        if (idx !== activeAthleteTab) return a;
        let bDate = '';
        if (ath.birthDate) {
          try {
            const d = new Date(ath.birthDate);
            if (!isNaN(d.getTime())) bDate = d.toISOString().split('T')[0];
          } catch {
            bDate = '';
          }
        }
        return {
          name: ath.name || '',
          cpf: ath.cpfRaw || ath.cpfMasked || '',
          email: ath.email || '',
          phone: ath.phoneNumber || '',
          gender: (ath.gender === 'F' ? 'F' : 'M') as 'M' | 'F',
          birthDate: bDate,
          tshirtSize: (TSHIRT_SIZES.includes(ath.tshirtSize as any) ? ath.tshirtSize : 'M') as any,
          boxOrAffiliate: ath.boxOrGym || '',
        };
      })
    );
    setAthleteSearchQuery('');
    setSearchResults([]);
    toast.success(`Atleta "${ath.name}" vinculado ao Integrante #${activeAthleteTab + 1}!`);
  };

  const updateCurrentAthlete = (field: keyof AthleteFormState, value: any) => {
    setAthletes((prev) =>
      prev.map((a, idx) => (idx === activeAthleteTab ? { ...a, [field]: value } : a))
    );
  };

  // Validação em tempo real das regras da categoria
  const validationResult = useMemo(() => {
    if (!selectedCategory) {
      return { isValid: false, message: 'Selecione uma categoria válida.' };
    }

    const domainAthletes: Athlete[] = athletes.map((a, idx) => ({
      id: `ath_${idx + 1}`,
      name: a.name.trim() || `Atleta ${idx + 1}`,
      cpf: a.cpf.replace(/\D/g, '') || undefined,
      email: a.email.trim() || undefined,
      phone: a.phone.trim() || undefined,
      gender: a.gender,
      birthDate: a.birthDate || undefined,
      age: calculateAge(a.birthDate),
      tshirtSize: a.tshirtSize,
      boxOrAffiliate: a.boxOrAffiliate.trim() || undefined,
      checkIn: false,
    }));

    return validateTeamAgainstCategoryRules(selectedCategory, domainAthletes);
  }, [selectedCategory, athletes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCategory) {
      toast.error('Selecione uma categoria');
      return;
    }

    if (!teamName.trim()) {
      toast.error('Informe o nome da equipe ou competidor');
      return;
    }

    // Conferir se todos os nomes foram preenchidos
    const missingNameIdx = athletes.findIndex((a) => !a.name.trim());
    if (missingNameIdx !== -1) {
      setActiveAthleteTab(missingNameIdx);
      toast.error(`Informe o nome do Atleta #${missingNameIdx + 1}`);
      return;
    }

    // Validar regras da categoria
    if (!validationResult.isValid) {
      toast.error(`Inconformidade com a categoria: ${validationResult.message}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        categoryId: Number(selectedCategory.id),
        teamName: teamName.trim(),
        amount: Number(amountPaid) || 0,
        status: paymentStatus,
        athletes: athletes.map((a) => ({
          name: a.name.trim(),
          cpf: a.cpf.replace(/\D/g, '') || undefined,
          email: a.email.trim() || undefined,
          phoneNumber: a.phone.trim() || undefined,
          gender: a.gender,
          birthDate: a.birthDate || undefined,
          tshirtSize: a.tshirtSize,
          boxOrGym: a.boxOrAffiliate.trim() || undefined,
        })),
      };

      let createdReg: any = null;
      try {
        const res = await apiClient.adminCreateRegistration(gameCode, payload);
        createdReg = res?.registration || res;
      } catch (apiErr) {
        console.warn('[AdminNewRegistrationModal] API falhou, usando storage fallback:', apiErr);
      }

      const generatedCode = createdReg?.code || Math.floor(1000 + Math.random() * 9000);
      const generatedBib = createdReg?.number || `#${generatedCode}`;

      const newTeamObj: TeamRegistration = {
        id: `reg_${generatedCode}`,
        gameId: gameCode,
        categoryId: String(selectedCategory.id),
        categoryName: selectedCategory.name,
        teamName: teamName.trim(),
        registerNumber: generatedBib,
        amountPaid: Number(amountPaid) || 0,
        paymentStatus,
        registeredAt: new Date().toISOString(),
        checkedIn: false,
        validationStatus: 'valid',
        athletes: athletes.map((a, idx) => ({
          id: `ath_${idx + 1}`,
          name: a.name.trim(),
          cpf: a.cpf.replace(/\D/g, '') || undefined,
          email: a.email.trim() || undefined,
          phone: a.phone.trim() || undefined,
          gender: a.gender,
          birthDate: a.birthDate || undefined,
          age: calculateAge(a.birthDate),
          tshirtSize: a.tshirtSize,
          boxOrAffiliate: a.boxOrAffiliate.trim() || 'Box Filiada',
          checkIn: false,
        })),
      };

      storage.saveTeam(newTeamObj);
      toast.success(`🎉 Inscrição "${teamName}" (${generatedBib}) registrada com sucesso na categoria "${selectedCategory.name}"!`);
      onSuccess(newTeamObj);
      onClose();
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : 'Falha ao registrar inscrição';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentAthlete = athletes[activeAthleteTab] || athletes[0];
  const athleteAge = currentAthlete?.birthDate ? calculateAge(currentAthlete.birthDate) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl max-h-[94vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO */}
        <div className="p-6 border-b border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[11px] font-black border border-emerald-500/30">
                  Governança
                </span>
                <h2 className="text-lg font-black text-white tracking-tight">
                  Nova Inscrição Oficial de Equipe / Atleta
                </h2>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Cadastre e vincule competidores diretamente pelo painel administrativo com validação rigorosa de regras.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-9 h-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center border border-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* CORPO DO FORMULÁRIO */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* SELEÇÃO DE CATEGORIA E DADOS DA EQUIPE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Categoria */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Categoria Oficial do Campeonato *</span>
              </label>
              <select
                value={selectedCatId}
                onChange={(e) => setSelectedCatId(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700/80 focus:border-emerald-500 text-sm text-white rounded-xl px-3.5 py-2.5 focus:outline-none transition-colors"
              >
                {categories.map((c) => {
                  const formatLabel = c.teamFormat === 'individual' ? 'Individual' : c.teamFormat === 'duo' ? 'Dupla' : c.teamFormat === 'trio' ? 'Trio' : 'Quarteto';
                  const maxRegs = c.maxRegistrations ?? (c as any).spotsTotal ?? null;
                  const spotsText = maxRegs ? ` • Limite: ${maxRegs} vagas` : ' • Vagas Livres';
                  return (
                    <option key={c.id} value={String(c.id)}>
                      {c.name} ({formatLabel} - R$ {(c.price || (c as any).priceBrl || 150).toFixed(2)}){spotsText}
                    </option>
                  );
                })}
              </select>

              {selectedCategory && (
                <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-[11px] text-zinc-400 flex flex-wrap gap-x-4 gap-y-1">
                  <span>Formato: <strong className="text-zinc-200 uppercase">{categoryRules.maxAthletes === 1 ? 'INDIVIDUAL' : categoryRules.maxAthletes === 2 ? 'DUPLA' : categoryRules.maxAthletes === 3 ? 'TRIO' : 'QUARTETO'} ({requiredAthletesCount} atleta{requiredAthletesCount !== 1 ? 's' : ''})</strong></span>
                  <span>Gênero: <strong className="text-zinc-200 uppercase">{categoryRules.genderLabel}</strong></span>
                  {(categoryRules.minSumTeamAge || categoryRules.minIndividualAge || categoryRules.maxIndividualAge) && (
                    <span className="text-amber-400">
                      Regra de Idade: {categoryRules.minSumTeamAge ? `Soma ${categoryRules.minSumTeamAge}+ anos` : categoryRules.minIndividualAge ? `Mín ${categoryRules.minIndividualAge} anos` : `Até ${categoryRules.maxIndividualAge} anos`}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Nome da Equipe */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>Nome Oficial da Equipe / Competidor *</span>
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Ex: Box Titans Cross, As Poderosas..."
                className="w-full bg-zinc-900 border border-zinc-700/80 focus:border-emerald-500 text-sm text-white rounded-xl px-3.5 py-2.5 focus:outline-none transition-colors"
                required
              />

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-500">Status Pgto</label>
                  <select
                    value={paymentStatus}
                    onChange={(e: any) => setPaymentStatus(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                  >
                    <option value="paid">Confirmado (Pago)</option>
                    <option value="pending">Pendente (Aguardando)</option>
                    <option value="free">Cortesia (Isento)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-500">Valor Cobrado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* PAINEL DE VALIDAÇÃO DE REGRAS EM TEMPO REAL */}
          <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 transition-colors ${
            validationResult.isValid 
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' 
              : 'bg-red-950/20 border-red-500/30 text-red-300'
          }`}>
            {validationResult.isValid ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            )}
            <div>
              <strong className="font-bold block text-sm">
                {validationResult.isValid ? 'Conformidade de Categoria Aprovada' : 'Atenção às Regras da Categoria'}
              </strong>
              <p className="mt-0.5 opacity-90">{validationResult.message}</p>
            </div>
          </div>

          {/* SELEÇÃO E CADASTRO DE INTEGRANTES */}
          <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800">
              <span className="text-xs font-black uppercase text-zinc-300 tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Integrantes da Inscrição ({athletes.length} atleta{athletes.length !== 1 ? 's' : ''})</span>
              </span>

              {/* TABS DOS ATLETAS */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {athletes.map((a, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveAthleteTab(idx)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      activeAthleteTab === idx
                        ? 'bg-emerald-500 text-black shadow-md'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span>Atleta #{idx + 1}</span>
                    {a.name.trim() && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 ml-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* BUSCAR E VINCULAR ATLETA CADASTRADO NO SISTEMA */}
            <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase text-zinc-400 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-amber-400" />
                  <span>Vincular Atleta Cadastrado na Plataforma (Opcional)</span>
                </label>
                {isSearching && <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />}
              </div>
              <input
                type="text"
                value={athleteSearchQuery}
                onChange={(e) => setAthleteSearchQuery(e.target.value)}
                placeholder="Digite o nome, e-mail ou CPF para buscar..."
                className="w-full bg-zinc-900 border border-zinc-800 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
              />

              {/* LISTA DE RESULTADOS DE BUSCA */}
              {searchResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto divide-y divide-zinc-800 rounded-lg bg-zinc-900 border border-zinc-800 mt-1">
                  {searchResults.map((ath) => (
                    <button
                      key={ath.id}
                      type="button"
                      onClick={() => handleSelectExistingAthlete(ath)}
                      className="w-full p-2.5 text-left hover:bg-zinc-800/80 flex items-center justify-between gap-3 text-xs transition-colors"
                    >
                      <div>
                        <strong className="text-white font-bold block">{ath.name}</strong>
                        <span className="text-[10px] text-zinc-400">
                          {ath.email} • {ath.cpfMasked || 'Sem CPF'} • {ath.gender === 'F' ? 'Fem' : 'Masc'}
                        </span>
                      </div>
                      <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 shrink-0">
                        Vincular ao #{activeAthleteTab + 1}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* CAMPOS DETALHADOS DO ATLETA ATIVO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 pt-2">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-zinc-400 block mb-1">Nome Completo do Atleta *</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={currentAthlete?.name || ''}
                    onChange={(e) => updateCurrentAthlete('name', e.target.value)}
                    placeholder="Nome e Sobrenome"
                    className="w-full bg-zinc-950 border border-zinc-800 text-xs text-white rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1">Gênero *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateCurrentAthlete('gender', 'M')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      currentAthlete?.gender === 'M'
                        ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    Masculino (M)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateCurrentAthlete('gender', 'F')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      currentAthlete?.gender === 'F'
                        ? 'bg-pink-500/20 border-pink-500 text-pink-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    Feminino (F)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1">CPF</label>
                <input
                  type="text"
                  value={formatCpf(currentAthlete?.cpf || '')}
                  onChange={(e) => updateCurrentAthlete('cpf', e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full bg-zinc-950 border border-zinc-800 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1">Data de Nascimento</label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="date"
                    value={currentAthlete?.birthDate || ''}
                    onChange={(e) => updateCurrentAthlete('birthDate', e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-xs text-white rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                {athleteAge !== null && (
                  <span className="text-[10px] text-amber-400 block mt-1">
                    Idade calculada: <strong>{athleteAge} anos</strong>
                  </span>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1">Telefone / WhatsApp</label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={formatPhone(currentAthlete?.phone || '')}
                    onChange={(e) => updateCurrentAthlete('phone', e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full bg-zinc-950 border border-zinc-800 text-xs text-white rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1">E-mail</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    value={currentAthlete?.email || ''}
                    onChange={(e) => updateCurrentAthlete('email', e.target.value)}
                    placeholder="atleta@email.com"
                    className="w-full bg-zinc-950 border border-zinc-800 text-xs text-white rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1">Camiseta (Kit)</label>
                <div className="relative">
                  <Shirt className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
                  <select
                    value={currentAthlete?.tshirtSize || 'M'}
                    onChange={(e: any) => updateCurrentAthlete('tshirtSize', e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-xs text-white rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                  >
                    {TSHIRT_SIZES.map((sz) => (
                      <option key={sz} value={sz}>{sz}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1">Box / Centro de Treinamento</label>
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={currentAthlete?.boxOrAffiliate || ''}
                    onChange={(e) => updateCurrentAthlete('boxOrAffiliate', e.target.value)}
                    placeholder="Ex: CrossBox Alpha"
                    className="w-full bg-zinc-950 border border-zinc-800 text-xs text-white rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RODAPÉ E AÇÕES */}
          <div className="pt-4 border-t border-zinc-800 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold border border-zinc-800 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !validationResult.isValid}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/40 border border-emerald-400/40 transition-all cursor-pointer active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Registrando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Concluir Inscrição Oficial</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


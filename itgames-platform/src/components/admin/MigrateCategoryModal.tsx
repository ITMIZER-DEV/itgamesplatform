'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  ArrowRightLeft, 
  CheckCircle2, 
  AlertCircle, 
  Flame, 
  Users, 
  Loader2, 
  Check, 
  AlertTriangle,
  DollarSign,
  Calendar,
  Layers
} from 'lucide-react';
import { Category, TeamRegistration, Athlete } from '@/types';
import { apiClient, ApiError } from '@/lib/api-client';
import { storage } from '@/lib/storage';
import { validateTeamAgainstCategoryRules, calculateAge, resolveCategoryRules } from '@/lib/team-validation';
import { toast } from 'sonner';

interface MigrateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: TeamRegistration | null;
  categories: Category[];
  gameCode: string;
  onSuccess: (updatedTeam: TeamRegistration) => void;
}

export function MigrateCategoryModal({
  isOpen,
  onClose,
  team,
  categories,
  gameCode,
  onSuccess,
}: MigrateCategoryModalProps) {
  const [targetCatId, setTargetCatId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);

  // Categorias disponíveis para destino (excluindo a categoria atual da equipe)
  const availableTargetCategories = useMemo(() => {
    if (!team) return [];
    return categories.filter((c) => String(c.id) !== String(team.categoryId));
  }, [categories, team]);

  // Categoria atual
  const currentCategory = useMemo(() => {
    if (!team) return null;
    return categories.find((c) => String(c.id) === String(team.categoryId)) || null;
  }, [categories, team]);

  // Categoria selecionada como destino
  const targetCategory = useMemo(() => {
    return categories.find((c) => String(c.id) === targetCatId) || null;
  }, [categories, targetCatId]);

  // Inicializar seleção ao abrir
  useEffect(() => {
    if (isOpen && availableTargetCategories.length > 0) {
      setTargetCatId(String(availableTargetCategories[0].id));
      setReason('');
    }
  }, [isOpen, availableTargetCategories]);

  // Converter atletas da equipe para validação de domínio
  const teamAthletesDomain = useMemo<Athlete[]>(() => {
    if (!team || !team.athletes) return [];
    return team.athletes.map((a, idx) => ({
      id: a.id || `ath_${idx + 1}`,
      name: a.name || `Atleta ${idx + 1}`,
      cpf: a.cpf?.replace(/\D/g, '') || undefined,
      email: a.email || undefined,
      phone: a.phone || undefined,
      gender: a.gender || 'M',
      birthDate: a.birthDate || undefined,
      age: a.age || calculateAge(a.birthDate),
      tshirtSize: a.tshirtSize || 'M',
      boxOrAffiliate: a.boxOrAffiliate || 'Box Filiada',
      checkIn: a.checkIn || false,
    }));
  }, [team]);

  // Validação das regras da categoria de destino
  const eligibility = useMemo(() => {
    if (!targetCategory || !team) {
      return {
        isValid: false,
        formatOk: false,
        genderOk: false,
        ageOk: false,
        spotsOk: true,
        message: 'Selecione uma categoria de destino.',
        calculatedAgeSum: 0,
      };
    }

    const rules = resolveCategoryRules(targetCategory);
    const targetMaxAthletes = rules.maxAthletes;

    // 1. Compatibilidade de Formato
    const formatOk = teamAthletesDomain.length === targetMaxAthletes;

    // 2. Composição de Gênero
    const males = teamAthletesDomain.filter((a) => a.gender === 'M').length;
    const females = teamAthletesDomain.filter((a) => a.gender === 'F').length;

    let genderOk = true;
    let genderMsg = '';

    if (rules.gender === 'male' && females > 0) {
      genderOk = false;
      genderMsg = 'A categoria destino é exclusivamente Masculina.';
    } else if (rules.gender === 'female' && males > 0) {
      genderOk = false;
      genderMsg = 'A categoria destino é exclusivamente Feminina.';
    } else if (rules.gender === 'mixed_1m_1f' && (males !== 1 || females !== 1)) {
      genderOk = false;
      genderMsg = 'A Dupla Mista exige obrigatoriamente 1 Homem e 1 Mulher.';
    } else if (rules.gender === 'mixed_2m_2f' && (males !== 2 || females !== 2)) {
      genderOk = false;
      genderMsg = 'O Quarteto Misto exige obrigatoriamente 2 Homens e 2 Mulheres.';
    }

    // 3. Regras Etárias
    const athleteAges = teamAthletesDomain.map((a) => a.age || calculateAge(a.birthDate));
    const calculatedAgeSum = athleteAges.reduce((acc, age) => acc + age, 0);

    let ageOk = true;
    let ageMsg = '';

    if (rules.minSumTeamAge) {
      if (calculatedAgeSum < rules.minSumTeamAge) {
        ageOk = false;
        ageMsg = `Soma das idades atual é de ${calculatedAgeSum} anos (mínimo exigido: ${rules.minSumTeamAge} anos — faltam ${rules.minSumTeamAge - calculatedAgeSum} anos).`;
      }
    } else if (rules.minIndividualAge) {
      const underAgeAthlete = teamAthletesDomain.find((a) => (a.age || calculateAge(a.birthDate)) < rules.minIndividualAge!);
      if (underAgeAthlete) {
        ageOk = false;
        ageMsg = `O atleta "${underAgeAthlete.name}" possui ${underAgeAthlete.age || calculateAge(underAgeAthlete.birthDate)} anos (mínimo exigido: ${rules.minIndividualAge} anos).`;
      }
    } else if (rules.maxIndividualAge) {
      const overAgeAthlete = teamAthletesDomain.find((a) => (a.age || calculateAge(a.birthDate)) > rules.maxIndividualAge!);
      if (overAgeAthlete) {
        ageOk = false;
        ageMsg = `O atleta "${overAgeAthlete.name}" possui ${overAgeAthlete.age || calculateAge(overAgeAthlete.birthDate)} anos (máximo permitido: ${rules.maxIndividualAge} anos).`;
      }
    }

    // 4. Vagas na Categoria Destino
    const maxRegs = targetCategory.maxRegistrations ?? (targetCategory as any).spotsTotal ?? null;
    const currentRegs = targetCategory.registrationsCount ?? 0;
    const isSoldOut = maxRegs !== null && currentRegs >= maxRegs;
    const spotsOk = !isSoldOut;

    let overallMsg = 'Equipe 100% elegível para a categoria destino!';
    if (!formatOk) {
      overallMsg = `Incompatibilidade de formato: a categoria destino exige ${targetMaxAthletes} atleta(s), mas a equipe possui ${teamAthletesDomain.length}.`;
    } else if (!genderOk) {
      overallMsg = genderMsg;
    } else if (!ageOk) {
      overallMsg = ageMsg;
    } else if (isSoldOut) {
      overallMsg = 'Aviso: a categoria de destino atingiu o limite de vagas.';
    }

    const isValid = formatOk && genderOk && ageOk;

    return {
      isValid,
      formatOk,
      genderOk,
      ageOk,
      spotsOk,
      isSoldOut,
      message: overallMsg,
      calculatedAgeSum,
      targetMaxAthletes,
    };
  }, [targetCategory, team, teamAthletesDomain]);

  if (!isOpen || !team) return null;

  const currentPrice = currentCategory ? ((currentCategory as any).priceBrl ?? currentCategory.price ?? 150) : 150;
  const targetPrice = targetCategory ? ((targetCategory as any).priceBrl ?? targetCategory.price ?? 150) : 150;
  const priceDiff = targetPrice - currentPrice;

  const handleConfirmMigration = async () => {
    if (!targetCategory) {
      toast.error('Selecione uma categoria de destino');
      return;
    }

    if (!eligibility.isValid) {
      toast.error(`Não é possível migrar: ${eligibility.message}`);
      return;
    }

    setIsMigrating(true);
    try {
      const regCodeNumber = team.id.startsWith('reg_')
        ? parseInt(team.id.replace('reg_', ''), 10)
        : parseInt(team.registerNumber?.replace(/\D/g, '') || team.id, 10);

      // Tenta migrar no backend
      try {
        await apiClient.migrateRegistrationCategory(gameCode, regCodeNumber, {
          targetCategoryId: Number(targetCategory.id),
          reason: reason.trim() || undefined,
          overrideLimit: eligibility.isSoldOut,
        });
      } catch (apiErr) {
        console.warn('[MigrateCategoryModal] API indisponível, aplicando fallback local:', apiErr);
      }

      // Atualiza o objeto no storage local
      const updatedTeamObj: TeamRegistration = {
        ...team,
        categoryId: String(targetCategory.id),
        categoryName: targetCategory.name,
      };

      storage.saveTeam(updatedTeamObj);
      toast.success(`🎉 Equipe "${team.teamName}" migrada com sucesso para "${targetCategory.name}"!`);
      onSuccess(updatedTeamObj);
      onClose();
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : 'Falha ao migrar categoria da equipe';
      toast.error(msg);
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO */}
        <div className="p-6 border-b border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono text-[11px] font-black border border-amber-500/30">
                  {team.registerNumber}
                </span>
                <h2 className="text-lg font-black text-white tracking-tight">
                  Governança — Migração de Categoria
                </h2>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Equipe: <strong className="text-white">{team.teamName}</strong> • Categoria Atual: <strong className="text-amber-400">{team.categoryName}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isMigrating}
            className="w-9 h-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center border border-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* CORPO */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* INTEGRANTES ATUAIS */}
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>Integrantes da Equipe ({teamAthletesDomain.length} atleta{teamAthletesDomain.length !== 1 ? 's' : ''})</span>
              </span>
              <span className="text-[11px] text-amber-400 font-mono font-bold">
                Soma de Idades: {eligibility.calculatedAgeSum} anos
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {teamAthletesDomain.map((a, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-850 flex items-center justify-between text-xs">
                  <div>
                    <strong className="text-zinc-200 block">{a.name}</strong>
                    <span className="text-[10px] text-zinc-400">
                      Sexo: <strong className="text-zinc-300">{a.gender === 'F' ? 'Feminino' : 'Masculino'}</strong> • {a.age ? `${a.age} anos` : 'Idade não inf.'}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 text-[10px] font-mono">
                    {a.tshirtSize || 'M'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* SELEÇÃO DA CATEGORIA DESTINO */}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Selecione a Categoria de Destino *</span>
            </label>

            <select
              value={targetCatId}
              onChange={(e) => setTargetCatId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700/80 focus:border-amber-500 text-sm text-white rounded-xl px-3.5 py-2.5 focus:outline-none transition-colors"
            >
              {availableTargetCategories.map((c) => {
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
          </div>

          {/* QUADRO DE ANÁLISE DE ELEGIBILIDADE */}
          {targetCategory && (
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
                <span>Verificação de Regras da Categoria Destino</span>
                <span className="text-[11px] font-mono font-normal text-zinc-400">
                  {targetCategory.name}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {/* Formato */}
                <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                  eligibility.formatOk 
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' 
                    : 'bg-red-950/20 border-red-500/30 text-red-300'
                }`}>
                  {eligibility.formatOk ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
                  <div>
                    <strong className="block text-[11px]">Qtd Atletas</strong>
                    <span className="text-[10px] opacity-80">
                      {eligibility.formatOk ? `${teamAthletesDomain.length} atleta(s) OK` : `Exige ${eligibility.targetMaxAthletes} (tem ${teamAthletesDomain.length})`}
                    </span>
                  </div>
                </div>

                {/* Gênero */}
                <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                  eligibility.genderOk 
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' 
                    : 'bg-red-950/20 border-red-500/30 text-red-300'
                }`}>
                  {eligibility.genderOk ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
                  <div>
                    <strong className="block text-[11px]">Composição Gênero</strong>
                    <span className="text-[10px] opacity-80">
                      {eligibility.genderOk ? 'Compatível OK' : 'Incompatível'}
                    </span>
                  </div>
                </div>

                {/* Idade */}
                <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                  eligibility.ageOk 
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' 
                    : 'bg-red-950/20 border-red-500/30 text-red-300'
                }`}>
                  {eligibility.ageOk ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
                  <div>
                    <strong className="block text-[11px]">Faixa Etária</strong>
                    <span className="text-[10px] opacity-80">
                      {eligibility.ageOk ? 'Elegível OK' : 'Incompatível'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mensagem detalhada de elegibilidade */}
              <div className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                eligibility.isValid 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}>
                {eligibility.isValid ? <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
                <p>{eligibility.message}</p>
              </div>

              {/* Ajuste Financeiro se houver */}
              {priceDiff !== 0 && (
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs flex items-center justify-between">
                  <span className="text-zinc-400">Diferença de Valor da Categoria:</span>
                  <strong className={`font-mono ${priceDiff > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {priceDiff > 0 ? `+ R$ ${priceDiff.toFixed(2)} (Saldo a cobrar)` : `- R$ ${Math.abs(priceDiff).toFixed(2)} (Crédito)`}
                  </strong>
                </div>
              )}
            </div>
          )}

          {/* MOTIVO DA MIGRAÇÃO (PARA AUDITORIA) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider block">
              Justificativa / Motivo da Migração (Registrado em Auditoria)
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Mudança voluntária de nível técnico solicitada pelo atleta, acerto de faixa etária..."
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 text-xs text-white rounded-xl p-3 focus:outline-none resize-none transition-colors"
            />
          </div>
        </div>

        {/* RODAPÉ */}
        <div className="p-6 border-t border-zinc-800 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isMigrating}
            className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold border border-zinc-800 transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirmMigration}
            disabled={isMigrating || !eligibility.isValid}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 text-black text-xs font-black flex items-center gap-2 shadow-lg shadow-amber-950/40 border border-amber-400/40 transition-all cursor-pointer active:scale-95"
          >
            {isMigrating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Migrando Categoria...</span>
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4" />
                <span>Confirmar Migração de Categoria</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


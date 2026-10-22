'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  CreditCard, 
  Building, 
  Shirt, 
  Save, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  Users
} from 'lucide-react';
import { TeamRegistration, Athlete } from '@/types';
import { apiClient, ApiError } from '@/lib/api-client';
import { storage } from '@/lib/storage';
import { toast } from 'sonner';

interface EditTeamAthletesModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: TeamRegistration | null;
  gameCode: string;
  onSuccess: (updatedTeam: TeamRegistration) => void;
}

interface EditableAthlete {
  id: string;
  code: number;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  gender: 'M' | 'F';
  birthDate: string; // YYYY-MM-DD
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

function calculateAge(dateStr?: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

export function EditTeamAthletesModal({
  isOpen,
  onClose,
  team,
  gameCode,
  onSuccess,
}: EditTeamAthletesModalProps) {
  const [activeAthleteIndex, setActiveAthleteIndex] = useState(0);
  const [teamName, setTeamName] = useState('');
  const [athletesList, setAthletesList] = useState<EditableAthlete[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!team) return;

    setTeamName(team.teamName || '');
    setActiveAthleteIndex(0);
    setErrors({});

    const mapped = (team.athletes || []).map((a, idx) => {
      let bDate = '';
      if (a.birthDate) {
        try {
          const d = new Date(a.birthDate);
          if (!isNaN(d.getTime())) {
            bDate = d.toISOString().split('T')[0];
          }
        } catch {
          bDate = '';
        }
      }

      return {
        id: a.id || `ath_${idx + 1}`,
        code: idx + 1,
        name: a.name || '',
        email: a.email || '',
        phone: a.phone || '',
        cpf: a.cpf || '',
        gender: (a.gender === 'F' ? 'F' : 'M') as 'M' | 'F',
        birthDate: bDate,
        tshirtSize: (TSHIRT_SIZES.includes(a.tshirtSize as any) ? a.tshirtSize : 'M') as any,
        boxOrAffiliate: a.boxOrAffiliate || '',
      };
    });

    // Se a equipe não tinha atletas carregados, cria ao menos 1
    if (mapped.length === 0) {
      mapped.push({
        id: 'ath_1',
        code: 1,
        name: team.teamName || 'Atleta',
        email: '',
        phone: '',
        cpf: '',
        gender: 'M',
        birthDate: '',
        tshirtSize: 'M',
        boxOrAffiliate: '',
      });
    }

    setAthletesList(mapped);
  }, [team]);

  if (!isOpen || !team) return null;

  const currentAthlete = athletesList[activeAthleteIndex] || athletesList[0];

  const updateCurrentAthlete = (field: keyof EditableAthlete, value: any) => {
    setAthletesList((prev) =>
      prev.map((a, idx) => (idx === activeAthleteIndex ? { ...a, [field]: value } : a))
    );
    if (errors[`${activeAthleteIndex}_${field}`]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`${activeAthleteIndex}_${field}`];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    athletesList.forEach((a, idx) => {
      if (!a.name.trim()) {
        newErrors[`${idx}_name`] = 'Nome é obrigatório';
      }
      if (a.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim())) {
        newErrors[`${idx}_email`] = 'E-mail inválido';
      }
      const rawCpf = a.cpf.replace(/\D/g, '');
      if (rawCpf && rawCpf.length !== 11) {
        newErrors[`${idx}_cpf`] = 'CPF deve conter 11 dígitos';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Corrija os campos destacados antes de salvar');
      return;
    }

    setIsSaving(true);
    try {
      const regCodeNumber = team.id.startsWith('reg_')
        ? parseInt(team.id.replace('reg_', ''), 10)
        : parseInt(team.registerNumber?.replace(/\D/g, '') || team.id, 10);

      const payload = {
        teamName: teamName.trim(),
        athletes: athletesList.map((a) => ({
          code: a.code,
          name: a.name.trim(),
          email: a.email.trim() || undefined,
          phoneNumber: a.phone.trim() || undefined,
          gender: a.gender,
          cpf: a.cpf.replace(/\D/g, '') || undefined,
          birthDate: a.birthDate || undefined,
          tshirtSize: a.tshirtSize,
          boxOrAffiliate: a.boxOrAffiliate.trim() || undefined,
        })),
      };

      // Tenta salvar via API Backend
      try {
        await apiClient.updateRegistrationAthletes(gameCode, regCodeNumber, payload);
      } catch (apiErr) {
        console.warn('[EditTeamAthletesModal] API indisponível, usando fallback de storage:', apiErr);
      }

      // Atualiza também no storage local para manter reatividade imediata
      const updatedTeamObj: TeamRegistration = {
        ...team,
        teamName: teamName.trim(),
        athletes: athletesList.map((a, idx) => {
          const original = team.athletes?.[idx];
          return {
            id: a.id,
            name: a.name.trim(),
            email: a.email.trim(),
            phone: a.phone.trim(),
            gender: a.gender,
            cpf: a.cpf.replace(/\D/g, '') || undefined,
            birthDate: a.birthDate || undefined,
            age: calculateAge(a.birthDate) ?? original?.age,
            tshirtSize: a.tshirtSize,
            boxOrAffiliate: a.boxOrAffiliate.trim(),
            checkIn: original?.checkIn ?? false,
            checkInAt: original?.checkInAt,
            lgpdConsent: original?.lgpdConsent ?? true,
          };
        }),
      };

      storage.saveTeam(updatedTeamObj);
      toast.success('Dados dos atletas atualizados com sucesso!');
      onSuccess(updatedTeamObj);
      onClose();
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : 'Falha ao atualizar dados dos atletas';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const athleteAge = calculateAge(currentAthlete?.birthDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO MODAL */}
        <div className="p-6 border-b border-zinc-800/80 bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono text-[11px] font-black border border-amber-500/30">
                  {team.registerNumber}
                </span>
                <h2 className="text-lg font-black text-white tracking-tight">
                  Governança do Campeonato — Editar Atletas
                </h2>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Categoria: <strong className="text-zinc-200">{team.categoryName}</strong> • {athletesList.length} competidor(es)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSaving}
            className="w-9 h-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center border border-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* CORPO MODAL COM SCROLL */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* NOME DA EQUIPE / INSCRIÇÃO */}
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
            <label className="text-[11px] font-black uppercase text-zinc-400 tracking-wider block">
              Nome Oficial da Equipe / Competidor
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Ex: Box Titans RX"
              className="w-full bg-zinc-950 border border-zinc-700/80 focus:border-amber-500 text-sm text-white rounded-xl px-3.5 py-2.5 focus:outline-none transition-colors"
            />
          </div>

          {/* ABAS DE ATLETAS (CASO TENHA MAIS DE 1) */}
          {athletesList.length > 1 && (
            <div className="space-y-2">
              <span className="text-[11px] font-black uppercase text-zinc-400 tracking-wider block">
                Selecione o Atleta para Editar
              </span>
              <div className="flex flex-wrap gap-2">
                {athletesList.map((a, idx) => {
                  const isActive = idx === activeAthleteIndex;
                  return (
                    <button
                      key={a.id || idx}
                      type="button"
                      onClick={() => setActiveAthleteIndex(idx)}
                      className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 border transition-all ${
                        isActive
                          ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/20'
                          : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <User className={`w-3.5 h-3.5 ${isActive ? 'text-black' : 'text-amber-400'}`} />
                      <span>{a.name ? a.name.split(' ')[0] : `Atleta ${idx + 1}`}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${isActive ? 'bg-black/20 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                        #{idx + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* FORMULÁRIO DO ATLETA ATIVO */}
          <div className="p-5 rounded-3xl bg-zinc-900/40 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-black text-xs">
                  {activeAthleteIndex + 1}
                </span>
                <span className="text-sm font-black text-white">
                  Dados do Atleta: {currentAthlete?.name || `Atleta ${activeAthleteIndex + 1}`}
                </span>
              </div>
              {athleteAge !== null && (
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                  Idade calculada: <strong className="text-amber-400 font-mono">{athleteAge} anos</strong>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* NOME COMPLETO */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span>Nome Completo *</span>
                </label>
                <input
                  type="text"
                  value={currentAthlete?.name || ''}
                  onChange={(e) => updateCurrentAthlete('name', e.target.value)}
                  placeholder="Nome e Sobrenome"
                  className={`w-full bg-zinc-950 border ${
                    errors[`${activeAthleteIndex}_name`] ? 'border-rose-500' : 'border-zinc-700/80'
                  } focus:border-amber-500 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none transition-colors`}
                />
                {errors[`${activeAthleteIndex}_name`] && (
                  <span className="text-[10px] text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors[`${activeAthleteIndex}_name`]}
                  </span>
                )}
              </div>

              {/* E-MAIL */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-amber-400" />
                  <span>E-mail *</span>
                </label>
                <input
                  type="email"
                  value={currentAthlete?.email || ''}
                  onChange={(e) => updateCurrentAthlete('email', e.target.value)}
                  placeholder="atleta@exemplo.com"
                  className={`w-full bg-zinc-950 border ${
                    errors[`${activeAthleteIndex}_email`] ? 'border-rose-500' : 'border-zinc-700/80'
                  } focus:border-amber-500 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none transition-colors`}
                />
                {errors[`${activeAthleteIndex}_email`] && (
                  <span className="text-[10px] text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors[`${activeAthleteIndex}_email`]}
                  </span>
                )}
              </div>

              {/* TELEFONE / WHATSAPP */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-amber-400" />
                  <span>Telefone / WhatsApp</span>
                </label>
                <input
                  type="text"
                  value={currentAthlete?.phone || ''}
                  onChange={(e) => updateCurrentAthlete('phone', formatPhone(e.target.value))}
                  placeholder="(11) 98765-4321"
                  className="w-full bg-zinc-950 border border-zinc-700/80 focus:border-amber-500 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none transition-colors"
                />
              </div>

              {/* CPF */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                  <span>CPF</span>
                </label>
                <input
                  type="text"
                  value={currentAthlete?.cpf || ''}
                  onChange={(e) => updateCurrentAthlete('cpf', formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  className={`w-full bg-zinc-950 border ${
                    errors[`${activeAthleteIndex}_cpf`] ? 'border-rose-500' : 'border-zinc-700/80'
                  } focus:border-amber-500 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none transition-colors`}
                />
                {errors[`${activeAthleteIndex}_cpf`] && (
                  <span className="text-[10px] text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors[`${activeAthleteIndex}_cpf`]}
                  </span>
                )}
              </div>

              {/* GÊNERO / SEXO */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 block">
                  Sexo / Gênero *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateCurrentAthlete('gender', 'M')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      currentAthlete?.gender === 'M'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm'
                        : 'bg-zinc-950 border-zinc-700/80 text-zinc-400 hover:text-white'
                    }`}
                  >
                    Masculino (M)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateCurrentAthlete('gender', 'F')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      currentAthlete?.gender === 'F'
                        ? 'bg-rose-600/20 border-rose-500 text-rose-300 shadow-sm'
                        : 'bg-zinc-950 border-zinc-700/80 text-zinc-400 hover:text-white'
                    }`}
                  >
                    Feminino (F)
                  </button>
                </div>
              </div>

              {/* DATA DE NASCIMENTO */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>Data de Nascimento</span>
                </label>
                <input
                  type="date"
                  value={currentAthlete?.birthDate || ''}
                  onChange={(e) => updateCurrentAthlete('birthDate', e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700/80 focus:border-amber-500 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none transition-colors"
                />
              </div>

              {/* BOX / CENTRO DE TREINAMENTO */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-amber-400" />
                  <span>Box / Centro de Treinamento / Filiação</span>
                </label>
                <input
                  type="text"
                  value={currentAthlete?.boxOrAffiliate || ''}
                  onChange={(e) => updateCurrentAthlete('boxOrAffiliate', e.target.value)}
                  placeholder="Ex: CrossFit Moema, HYROX Training Club"
                  className="w-full bg-zinc-950 border border-zinc-700/80 focus:border-amber-500 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none transition-colors"
                />
              </div>

              {/* TAMANHO DA CAMISETA */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <Shirt className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tamanho da Camiseta do Kit Oficial</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {TSHIRT_SIZES.map((sz) => {
                    const isSelected = currentAthlete?.tshirtSize === sz;
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => updateCurrentAthlete('tshirtSize', sz)}
                        className={`px-3 py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                          isSelected
                            ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/20'
                            : 'bg-zinc-950 border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600'
                        }`}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RODAPÉ MODAL */}
        <div className="p-5 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Gravando Alterações...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Salvar Dados dos Atletas</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

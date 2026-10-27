'use client';

import React, { useEffect, useState } from 'react';
import { Copy, KeyRound, Search, Pencil, X, Save, Loader2, User, Mail, Phone, CreditCard, Building, Shirt, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiError, AthleteAdminRow } from '@/lib/api-client';

interface IssuedPassword {
  name: string;
  email: string;
  password: string;
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

// Aba "Atletas" do admin (super admin e organizadores): busca, edição cadastral e geração de senha temporária
export function AthletesPanel() {
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const [athletes, setAthletes] = useState<AthleteAdminRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [issued, setIssued] = useState<IssuedPassword | null>(null);

  // Modal de edição de atleta
  const [editingAthlete, setEditingAthlete] = useState<AthleteAdminRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [editGender, setEditGender] = useState<'M' | 'F'>('M');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editTshirtSize, setEditTshirtSize] = useState<string>('M');
  const [editBoxOrGym, setEditBoxOrGym] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    apiClient
      .listAthletes(query || undefined)
      .then(setAthletes)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao carregar atletas'))
      .finally(() => setIsLoading(false));
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setQuery(term.trim());
  };

  const handleOpenEdit = (a: AthleteAdminRow) => {
    setEditingAthlete(a);
    setEditName(a.name || '');
    setEditEmail(a.email || '');
    setEditPhone(a.phoneNumber || '');
    setEditCpf(a.cpfRaw || a.cpfMasked || '');
    setEditGender(a.gender === 'F' ? 'F' : 'M');
    setEditTshirtSize(a.tshirtSize || 'M');
    setEditBoxOrGym(a.boxOrGym || '');

    let bDate = '';
    if (a.birthDate) {
      try {
        bDate = new Date(a.birthDate).toISOString().split('T')[0];
      } catch {
        bDate = '';
      }
    }
    setEditBirthDate(bDate);
  };

  const handleSaveEdit = async () => {
    if (!editingAthlete) return;
    if (!editName.trim()) {
      toast.error('O nome do atleta é obrigatório');
      return;
    }
    if (!editEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())) {
      toast.error('Informe um e-mail válido');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await apiClient.updateAthleteAdmin(editingAthlete.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        phoneNumber: editPhone.trim() || undefined,
        cpf: editCpf.replace(/\D/g, '') || undefined,
        gender: editGender,
        birthDate: editBirthDate || undefined,
        tshirtSize: editTshirtSize,
        boxOrGym: editBoxOrGym.trim() || undefined,
      });

      setAthletes((prev) => prev.map((x) => (x.id === editingAthlete.id ? { ...x, ...updated } : x)));
      toast.success(`Atleta ${editName} atualizado com sucesso!`);
      setEditingAthlete(null);
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : 'Erro ao atualizar dados do atleta';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async (a: AthleteAdminRow) => {
    if (!window.confirm(`Gerar uma nova senha temporária para ${a.name}? A senha atual deixa de valer.`)) return;
    try {
      const res = await apiClient.resetAthletePassword(a.id);
      setIssued({ name: res.user.name, email: res.user.email, password: res.temporaryPassword });
      setAthletes((list) => list.map((x) => (x.id === a.id ? { ...x, mustChangePassword: true } : x)));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao gerar a senha temporária');
    }
  };

  const copyPassword = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.password);
      toast.success('Senha copiada!');
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie manualmente.');
    }
  };

  const inputClass =
    'flex-1 bg-zinc-950 border border-zinc-700 text-sm text-white rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500';

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center gap-3">
        <input
          className={inputClass}
          value={term}
          placeholder="Buscar por nome, e-mail ou CPF"
          onChange={(e) => setTerm(e.target.value)}
        />
        <button
          type="submit"
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black text-xs flex items-center gap-2"
        >
          <Search className="w-4 h-4" />
          <span>Buscar</span>
        </button>
      </form>

      {issued && (
        <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/40 space-y-3">
          <div className="text-sm font-black text-amber-300">Senha temporária de {issued.name}</div>
          <p className="text-xs text-zinc-300">
            Repasse ao atleta ({issued.email}). Ela só é exibida agora e precisará ser trocada no primeiro acesso.
          </p>
          <div className="flex items-center gap-2">
            <code className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-amber-300 font-mono text-base select-all">
              {issued.password}
            </code>
            <button
              onClick={copyPassword}
              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white flex items-center gap-1.5"
            >
              <Copy className="w-4 h-4" />
              <span>Copiar</span>
            </button>
            <button onClick={() => setIssued(null)} className="px-3 py-2 text-xs text-zinc-400 hover:text-white underline">
              Fechar
            </button>
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-zinc-900 border border-zinc-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px]">
            <tr>
              <th className="text-left px-4 py-3">Atleta</th>
              <th className="text-left px-4 py-3">CPF</th>
              <th className="text-left px-4 py-3">Telefone</th>
              <th className="text-left px-4 py-3">Sexo & Perfil</th>
              <th className="text-left px-4 py-3">Senha</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-zinc-500">Carregando...</td>
              </tr>
            )}
            {!isLoading && athletes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-zinc-500">Nenhum atleta encontrado.</td>
              </tr>
            )}
            {athletes.map((a) => (
              <tr key={a.id} className="border-t border-zinc-800 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-bold text-white">{a.name}</div>
                  <div className="text-zinc-400 font-mono text-[11px]">{a.email}</div>
                  {a.boxOrGym && <div className="text-[10px] text-zinc-500">Box: {a.boxOrGym}</div>}
                </td>
                <td className="px-4 py-3 text-zinc-300 font-mono">{a.cpfMasked ?? '—'}</td>
                <td className="px-4 py-3 text-zinc-300">{a.phoneNumber || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      a.gender === 'F' ? 'bg-rose-500/20 text-rose-300' : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {a.gender === 'F' ? 'Fem (F)' : 'Masc (M)'}
                    </span>
                    {a.tshirtSize && (
                      <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-mono">
                        Tam: {a.tshirtSize}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {a.mustChangePassword ? (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      Temporária
                    </span>
                  ) : (
                    <span className="text-zinc-500">Definida</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(a)}
                      className="px-3 py-1.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
                      title="Editar dados cadastrais do atleta"
                    >
                      <Pencil className="w-3.5 h-3.5 text-blue-400" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReset(a)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold flex items-center gap-1.5"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Senha</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL DE EDIÇÃO DE ATLETA (SUPER ADMIN) */}
      {editingAthlete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Editar Dados do Atleta</h3>
                  <p className="text-xs text-zinc-400 font-mono">{editingAthlete.email}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingAthlete(null)}
                className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* NOME */}
                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    <span>Nome Completo *</span>
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* E-MAIL */}
                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-amber-400" />
                    <span>E-mail *</span>
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* TELEFONE */}
                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-300 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-amber-400" />
                    <span>Telefone / WhatsApp</span>
                  </label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(formatPhone(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* CPF */}
                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-300 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                    <span>CPF</span>
                  </label>
                  <input
                    type="text"
                    value={editCpf}
                    onChange={(e) => setEditCpf(formatCpf(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* GÊNERO / SEXO */}
                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-300 block">
                    Sexo / Gênero *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditGender('M')}
                      className={`py-2 px-3 rounded-xl font-bold border transition-all ${
                        editGender === 'M'
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm'
                          : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'
                      }`}
                    >
                      Masculino (M)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditGender('F')}
                      className={`py-2 px-3 rounded-xl font-bold border transition-all ${
                        editGender === 'F'
                          ? 'bg-rose-600/20 border-rose-500 text-rose-300 shadow-sm'
                          : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'
                      }`}
                    >
                      Feminino (F)
                    </button>
                  </div>
                </div>

                {/* DATA DE NASCIMENTO */}
                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>Data de Nascimento</span>
                  </label>
                  <input
                    type="date"
                    value={editBirthDate}
                    onChange={(e) => setEditBirthDate(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* BOX / FILIAÇÃO */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="font-bold text-zinc-300 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-amber-400" />
                    <span>Box / Centro de Treinamento</span>
                  </label>
                  <input
                    type="text"
                    value={editBoxOrGym}
                    onChange={(e) => setEditBoxOrGym(e.target.value)}
                    placeholder="Ex: CrossFit Moema"
                    className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* TAMANHO CAMISETA */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="font-bold text-zinc-300 flex items-center gap-1.5">
                    <Shirt className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tamanho da Camiseta</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TSHIRT_SIZES.map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setEditTshirtSize(sz)}
                        className={`px-3 py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                          editTshirtSize === sz
                            ? 'bg-amber-500 text-black border-amber-400'
                            : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-white'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setEditingAthlete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

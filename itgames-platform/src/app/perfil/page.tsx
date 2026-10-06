'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Lock, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiError } from '@/lib/api-client';
import { getCurrentUserSession, saveSession } from '@/lib/acl';
import { formatCpf, isValidCpf, onlyDigits } from '@/lib/cpf';

const inputClass =
  'w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 disabled:opacity-60';

interface ProfileForm {
  name: string;
  email: string;
  phoneNumber: string;
  cpf: string;
  cpfLocked: boolean; // CPF já definido: não pode mais ser alterado
  birthDate: string;
  gender: 'M' | 'F';
  tshirtSize: string;
  boxOrGym: string;
}

// Destino depois de salvar (?next=/athlete/register). Só caminhos do próprio site.
function nextPath(): string | null {
  const next = new URLSearchParams(window.location.search).get('next');
  if (!next || next.includes('\\')) return null;
  try {
    const url = new URL(next, window.location.origin);
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : null;
  } catch {
    return null;
  }
}

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (getCurrentUserSession().role === 'GUEST') {
      router.replace('/login?next=/perfil');
      return;
    }
    apiClient
      .getMe()
      .then((me) => {
        const p = me.athleteProfile;
        setForm({
          name: me.name || '',
          email: me.email || '',
          phoneNumber: me.phoneNumber || '',
          cpf: formatCpf(me.ownCpf || ''),
          cpfLocked: !!me.ownCpf,
          birthDate: p?.birthDate ? String(p.birthDate).slice(0, 10) : '',
          gender: p?.gender === 'F' ? 'F' : 'M',
          tshirtSize: p?.tshirtSize || 'M',
          boxOrGym: p?.boxOrGym || '',
        });
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Não foi possível carregar o seu perfil'));
  }, [router]);

  if (!form) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center text-zinc-400">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <span className="text-sm">Carregando seu perfil...</span>
      </div>
    );
  }

  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => setForm({ ...form, [key]: value });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Informe o seu nome');
      return;
    }
    if (!form.cpfLocked && form.cpf && !isValidCpf(form.cpf)) {
      toast.error('CPF inválido');
      return;
    }
    setIsSaving(true);
    try {
      await apiClient.updateProfile({
        name: form.name,
        phoneNumber: form.phoneNumber,
        ...(!form.cpfLocked && form.cpf ? { cpf: onlyDigits(form.cpf) } : {}),
        ...(form.birthDate ? { birthDate: form.birthDate } : {}),
        gender: form.gender,
        tshirtSize: form.tshirtSize,
        boxOrGym: form.boxOrGym,
      });
      toast.success('Perfil atualizado');
      const next = nextPath();
      if (next) {
        router.push(next);
      } else if (!form.cpfLocked && form.cpf) {
        setForm({ ...form, cpfLocked: true });
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar o perfil');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('A nova senha deve ter no mínimo 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('A confirmação não confere com a nova senha');
      return;
    }
    setIsChangingPassword(true);
    try {
      const res = await apiClient.changePassword(currentPassword, newPassword);
      saveSession(res);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Senha alterada. Enviamos um aviso para o seu e-mail.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível trocar a senha');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
          <UserCog className="w-4 h-4" />
          <span>Meu perfil</span>
        </div>
        <h1 className="text-2xl font-black text-white mt-1">Complete o seu cadastro</h1>
        <p className="text-xs text-zinc-400 mt-1">
          O CPF identifica você nas inscrições de equipe. Nascimento, gênero e camiseta são usados para validar as regras da categoria.
        </p>
      </div>

      <form onSubmit={handleSave} className="glass-panel rounded-3xl p-6 border border-zinc-800 space-y-4">
        <h2 className="text-base font-bold text-white">Dados pessoais</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="sm:col-span-2">
            <label className="font-bold text-zinc-300 block mb-1">Nome completo</label>
            <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <label className="font-bold text-zinc-300 block mb-1">E-mail</label>
            <input className={inputClass} value={form.email} disabled />
          </div>
          <div>
            <label className="font-bold text-zinc-300 block mb-1">WhatsApp / Telefone</label>
            <input
              className={inputClass}
              value={form.phoneNumber}
              placeholder="(62) 99999-9999"
              onChange={(e) => set('phoneNumber', e.target.value)}
            />
          </div>
          <div>
            <label className="font-bold text-zinc-300 block mb-1">CPF</label>
            <input
              className={inputClass}
              inputMode="numeric"
              value={form.cpf}
              disabled={form.cpfLocked}
              placeholder="000.000.000-00"
              onChange={(e) => set('cpf', formatCpf(e.target.value))}
            />
            <p className="text-[10px] text-zinc-500 mt-1">
              {form.cpfLocked
                ? 'O CPF não pode ser alterado. Fale com a organização se precisar corrigir.'
                : 'Só pode ser definido uma vez. Confira antes de salvar.'}
            </p>
          </div>
          <div>
            <label className="font-bold text-zinc-300 block mb-1">Data de nascimento</label>
            <input
              className={inputClass}
              type="date"
              value={form.birthDate}
              onChange={(e) => set('birthDate', e.target.value)}
            />
          </div>
          <div>
            <label className="font-bold text-zinc-300 block mb-1">Gênero</label>
            <select className={inputClass} value={form.gender} onChange={(e) => set('gender', e.target.value as 'M' | 'F')}>
              <option value="M">Masculino (M)</option>
              <option value="F">Feminino (F)</option>
            </select>
          </div>
          <div>
            <label className="font-bold text-zinc-300 block mb-1">Tamanho da camiseta</label>
            <select className={inputClass} value={form.tshirtSize} onChange={(e) => set('tshirtSize', e.target.value)}>
              {['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="font-bold text-zinc-300 block mb-1">Box / Academia</label>
            <input
              className={inputClass}
              value={form.boxOrGym}
              placeholder="Ex: CrossFit Imperial"
              onChange={(e) => set('boxOrGym', e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end pt-2 border-t border-zinc-800">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black text-xs disabled:opacity-50"
          >
            {isSaving ? 'Salvando...' : 'Salvar perfil'}
          </button>
        </div>
      </form>

      <form onSubmit={handleChangePassword} className="glass-panel rounded-3xl p-6 border border-zinc-800 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-amber-400" />
          Alterar senha
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {[
            { label: 'Senha atual', value: currentPassword, set: setCurrentPassword, auto: 'current-password' },
            { label: 'Nova senha (mín. 8)', value: newPassword, set: setNewPassword, auto: 'new-password' },
            { label: 'Confirmar nova senha', value: confirmPassword, set: setConfirmPassword, auto: 'new-password' },
          ].map((f) => (
            <div key={f.label}>
              <label className="font-bold text-zinc-300 block mb-1">{f.label}</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                <input
                  className={`${inputClass} pl-9`}
                  type="password"
                  required
                  autoComplete={f.auto}
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-zinc-500">
          Depois da troca, enviamos um aviso para o seu e-mail. Esqueceu a senha atual? Saia e use &quot;Esqueci minha senha&quot; no login.
        </p>
        <div className="flex justify-end pt-2 border-t border-zinc-800">
          <button
            type="submit"
            disabled={isChangingPassword}
            className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-black text-xs disabled:opacity-50"
          >
            {isChangingPassword ? 'Alterando...' : 'Alterar senha'}
          </button>
        </div>
      </form>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User, 
  ArrowRight, 
  Lock, 
  Mail, 
  Trophy, 
  Phone, 
  Calendar, 
  Shirt, 
  Dumbbell
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiError } from '@/lib/api-client';
import { homeForRole, saveSession } from '@/lib/acl';

import { BrandLogo } from '@/components/brand/BrandLogo';

export default function LoginPage() {
  const router = useRouter();
  
  // Apenas 2 abas públicas: Entrar e Cadastro de Atleta
  const [activeTab, setActiveTab] = useState<'login' | 'register_athlete'>('login');

  // Estado de Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Estado de Cadastro de Atleta
  const [athName, setAthName] = useState('');
  const [athEmail, setAthEmail] = useState('');
  const [athPassword, setAthPassword] = useState('');
  const [athCpf, setAthCpf] = useState('');
  const [athPhone, setAthPhone] = useState('');
  const [athBirthDate, setAthBirthDate] = useState('1995-05-20');
  const [athGender, setAthGender] = useState<'M' | 'F'>('M');
  const [athBox, setAthBox] = useState('');
  const [athTshirtSize, setAthTshirtSize] = useState<'PP' | 'P' | 'M' | 'G' | 'GG' | 'XG' | 'XGG'>('M');

  // 1. Login real: o papel vem sempre do JWT emitido pela API
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      toast.error('Informe seu e-mail e senha');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.login(loginEmail.trim(), loginPassword);
      saveSession(res);

      if (res.user.mustChangePassword) {
        toast.info('Defina uma nova senha para continuar.');
        router.push('/trocar-senha');
        return;
      }

      toast.success(`Bem-vindo de volta, ${res.user.name}!`);
      router.push(homeForRole(res.user.role));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao entrar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Cadastro Exclusivo de Atleta Competidor (a API sempre cria ATHLETE)
  const handleRegisterAthlete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!athName.trim() || !athEmail.trim() || !athPassword.trim()) {
      toast.error('Preencha os campos obrigatórios (Nome, E-mail e Senha)');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.register({
        name: athName,
        email: athEmail,
        password: athPassword,
        cpf: athCpf ? athCpf.replace(/\D/g, '') : undefined,
        phoneNumber: athPhone,
        birthDate: athBirthDate,
        gender: athGender,
        boxOrGym: athBox,
        tshirtSize: athTshirtSize,
      });
      saveSession(res);
      toast.success(`Conta de Atleta criada com sucesso! Bem-vindo, ${athName}!`);
      router.push('/athlete');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao criar a conta. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      
      {/* CABEÇALHO */}
      <div className="text-center space-y-3 flex flex-col items-center">
        <BrandLogo variant="white" size="lg" className="items-center" />
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-wider">
          <Trophy className="w-4 h-4" />
          <span>Arena • Autenticação Unificada</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Acesse sua Conta ou Cadastre-se
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto">
          Faça login para gerenciar suas atividades ou crie seu perfil oficial de <strong>Atleta Competidor</strong> com escolha do tamanho da camiseta.
        </p>
      </div>

      {/* SELETOR DE ABAS (APENAS LOGIN E CADASTRO DE ATLETA) */}
      <div className="flex items-center justify-center gap-2 p-1.5 rounded-2xl bg-zinc-900 border border-zinc-800 max-w-md mx-auto">
        <button
          onClick={() => setActiveTab('login')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'login'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Entrar (Login)</span>
        </button>

        <button
          onClick={() => setActiveTab('register_athlete')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'register_athlete'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Cadastro de Atleta</span>
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1. ABA DE LOGIN (ENTRAR) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'login' && (
        <div className="max-w-md mx-auto space-y-5">
          <form onSubmit={handleLoginSubmit} className="glass-panel p-6 sm:p-8 rounded-3xl border border-zinc-800 space-y-4 shadow-2xl">
            <div className="text-center space-y-1 pb-2 border-b border-zinc-800/80">
              <h2 className="text-lg font-bold text-white">Entrar na Minha Conta</h2>
              <p className="text-xs text-zinc-400">Informe suas credenciais para acessar seu perfil</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-zinc-300 block mb-1">E-mail</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="seu.email@exemplo.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-amber-500 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-amber-500 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
              >
                <span>{isLoading ? 'Autenticando...' : 'Entrar no Sistema'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 2. ABA DE CADASTRO EXCLUSIVO DE ATLETA (COM TAMANHO DE CAMISETA) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'register_athlete' && (
        <div className="max-w-xl mx-auto">
          <form onSubmit={handleRegisterAthlete} className="glass-panel p-6 sm:p-8 rounded-3xl border border-purple-500/30 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Criar Cadastro de Atleta Competidor</h2>
                <p className="text-xs text-zinc-400">Dados do competidor para emissão de carteirinha, kits de camisa e inscrições</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Lucas Ferreira Silva"
                    value={athName}
                    onChange={(e) => setAthName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-zinc-300 block mb-1">E-mail de Acesso *</label>
                  <input
                    type="email"
                    required
                    placeholder="seu.email@exemplo.com"
                    value={athEmail}
                    onChange={(e) => setAthEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Senha de Acesso *</label>
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={athPassword}
                    onChange={(e) => setAthPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-zinc-300 block mb-1">CPF (Opcional p/ Validação)</label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={athCpf}
                    onChange={(e) => setAthCpf(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Data de Nascimento *</label>
                  <input
                    type="date"
                    required
                    value={athBirthDate}
                    onChange={(e) => setAthBirthDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Gênero *</label>
                  <select
                    value={athGender}
                    onChange={(e) => setAthGender(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="M">Masculino (M)</option>
                    <option value="F">Feminino (F)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-amber-400 block mb-1 flex items-center gap-1">
                    <Shirt className="w-3.5 h-3.5" />
                    <span>Tamanho Camiseta *</span>
                  </label>
                  <select
                    value={athTshirtSize}
                    onChange={(e) => setAthTshirtSize(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-amber-500/60 text-amber-300 font-bold focus:outline-none focus:border-amber-400"
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">WhatsApp / Telefone</label>
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    value={athPhone}
                    onChange={(e) => setAthPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Box / Academia Filiada</label>
                  <input
                    type="text"
                    placeholder="Ex: CrossFit Moema / CT Imperial"
                    value={athBox}
                    onChange={(e) => setAthBox(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
              >
                <span>{isLoading ? 'Cadastrando...' : 'Finalizar Cadastro de Atleta'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

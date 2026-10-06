'use client';

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Plus, 
  Building2, 
  Database,
  DollarSign, 
  Users, 
  ShieldCheck, 
  Settings, 
  FileText, 
  Activity, 
  Flame, 
  CheckCircle2, 
  XCircle,
  Download,
  Filter,
  Sparkles,
  TrendingUp,
  CreditCard,
  Camera,
  Eye,
  AlertTriangle,
  Clock,
  History,
  Check,
  X,
  Gavel,
  Key,
  Phone,
  Trash2,
  Copy,
  ExternalLink,
  Pencil,
  Shirt
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { GameEvent, Category, WorkoutRule, TeamRegistration, ScoreEntry, OrganizationTenant, AuditLogEntry, ContestTicket, JudgeStaff } from '@/types';
import { apiClient, ApiError, assetUrl } from '@/lib/api-client';
import { BANNER_MAX_ORIGINAL_BYTES, prepareBanner } from '@/lib/banner-image';
import { getCurrentUserSession } from '@/lib/acl';
import { OrganizersPanel } from '@/components/admin/OrganizersPanel';
import { GameOrganizersModal } from '@/components/admin/GameOrganizersModal';
import { BackupRestoreModal } from '@/components/admin/BackupRestoreModal';
import { toast } from 'sonner';
import { AclGuard } from '@/components/auth/AclGuard';

export default function AdminDashboardPage() {
  const [activeGame, setActiveGame] = useState<GameEvent | null>(null);
  const [games, setGames] = useState<GameEvent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutRule[]>([]);
  const [teams, setTeams] = useState<TeamRegistration[]>([]);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationTenant[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [contestTickets, setContestTickets] = useState<ContestTicket[]>([]);
  const [judges, setJudges] = useState<JudgeStaff[]>([]);
  const [selectedProofTeam, setSelectedProofTeam] = useState<TeamRegistration | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // Perfil Ativo: Super Admin (Plataforma Global & Liberações) vs Organizador (Meus Campeonatos)

  // Papel vem do JWT (sessão); não existe mais alternância manual de perfil
  const [userRole, setUserRole] = useState<'SUPER_ADMIN' | 'ORGANIZER'>('ORGANIZER');
  const [organizersGame, setOrganizersGame] = useState<{ code: string; name: string } | null>(null);

  // Abas do Painel: championships (Gestão de Campeonatos & Liberações), organizer (WODs & Categorias), registrations_financial (Inscrições, Pagamentos & Kits), judges_staff (Escala de Juízes), audit_center (Homologação de Súmulas), saas_owner (Monetização)
  const [adminTab, setAdminTab] = useState<'championships' | 'organizer' | 'registrations_financial' | 'judges_staff' | 'audit_center' | 'saas_owner' | 'organizers_mgmt'>('championships');

  // Modal de Criação / Edição de Campeonato Completo
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);
  const [newGameCode, setNewGameCode] = useState('');
  const [newGameName, setNewGameName] = useState('');
  const [newGameDate, setNewGameDate] = useState('2026-11-20');
  const [newGameLocation, setNewGameLocation] = useState('Arena Olímpica - São Paulo / SP');
  const [newGameFoto, setNewGameFoto] = useState('');
  const [newGameLanes, setNewGameLanes] = useState(8);
  const [newGameType, setNewGameType] = useState('crossfit');
  const [newGameDesc, setNewGameDesc] = useState('');
  const [newGameLowestPoints, setNewGameLowestPoints] = useState(false);
  const [newGameShowTime, setNewGameShowTime] = useState(true);
  const [newGameShowWeight, setNewGameShowWeight] = useState(true);
  const [newGameShowReps, setNewGameShowReps] = useState(true);
  const [newGameShowRevision, setNewGameShowRevision] = useState(false);
  const [editingGameCode, setEditingGameCode] = useState<string | null>(null);
  const [newGamePixKey, setNewGamePixKey] = useState('');
  const [newGamePixBeneficiary, setNewGamePixBeneficiary] = useState('');
  const [newGameFile, setNewGameFile] = useState<File | null>(null);
  const [newGamePreview, setNewGamePreview] = useState('');
  const [newGameBannerInfo, setNewGameBannerInfo] = useState<{ summary: string; warning?: string } | null>(null);

  // Modal de Criação / Edição de Categoria Real
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [catName, setCatName] = useState('');
  const [catTeamType, setCatTeamType] = useState<'individual' | 'duo' | 'trio' | 'quartet'>('individual');
  const [catGender, setCatGender] = useState<'open' | 'male' | 'female' | 'mixed_1m_1f' | 'mixed_2m_2f'>('open');
  const [catAmount, setCatAmount] = useState<number>(150);
  const [catMinAge, setCatMinAge] = useState('');
  const [catMaxAge, setCatMaxAge] = useState('');
  const [catMinSumAge, setCatMinSumAge] = useState('');
  const [catStandards, setCatStandards] = useState('');
  const [catDesc, setCatDesc] = useState('');

  // Modal de Exclusão em Cascata (Super Admin)
  const [gameToDelete, setGameToDelete] = useState<GameEvent | null>(null);
  const [isDeletingGame, setIsDeletingGame] = useState(false);

  // Modal de Auditoria e Foto da Súmula
  const [selectedAuditScore, setSelectedAuditScore] = useState<ScoreEntry | null>(null);
  const [auditNewTime, setAuditNewTime] = useState<string>('');
  const [auditNewPoints, setAuditNewPoints] = useState<number>(0);
  const [auditReason, setAuditReason] = useState<string>('');

  // Modal de Criação de Prova/Workout (WOD)
  const [isWodModalOpen, setIsWodModalOpen] = useState(false);
  const [wodTitle, setWodTitle] = useState('');
  const [wodType, setWodType] = useState<WorkoutRule['type']>('for_time');
  const [wodTimeCapMins, setWodTimeCapMins] = useState(10);
  const [wodDesc, setWodDesc] = useState('');

  // Modal de Cadastro de Juiz / Arbitragem
  const [isJudgeModalOpen, setIsJudgeModalOpen] = useState(false);
  const [judgeName, setJudgeName] = useState('');
  const [judgeEmail, setJudgeEmail] = useState('');
  const [judgePhone, setJudgePhone] = useState('');
  const [judgePin, setJudgePin] = useState('1234');
  const [judgeRole, setJudgeRole] = useState<'floor_judge' | 'head_judge' | 'hyrox_station_judge'>('floor_judge');
  const [judgeLanes, setJudgeLanes] = useState('1, 2');

  useEffect(() => {
    const sync = () => {
      setUserRole(getCurrentUserSession().role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ORGANIZER');
    };
    sync();
    window.addEventListener('itgames_auth_changed', sync);
    return () => window.removeEventListener('itgames_auth_changed', sync);
  }, []);

  useEffect(() => {
    if (userRole !== 'SUPER_ADMIN' && (adminTab === 'organizers_mgmt' || adminTab === 'saas_owner')) {
      setAdminTab('championships');
    }
  }, [userRole, adminTab]);

  const loadData = async () => {
    // 1. Campeonatos vêm sempre da API (organizador: os seus; super admin: todos)
    let apiGames: any[] = [];
    try {
      apiGames = await apiClient.listMyGames();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao carregar os campeonatos');
    }

    const loadedGames: any[] = apiGames.map((g) => ({
      id: g.code,
      organizationId: 'org_1',
      code: g.code,
      name: g.name,
      description: g.description || '',
      location: g.location || '',
      startDate: g.date || '2026-11-15',
      endDate: g.date || '2026-11-15',
      eventType: g.eventType || 'crossfit',
      status: (g.status as any) || 'draft',
      foto: g.foto || '',
      pixKey: g.pixKey || '',
      pixBeneficiary: g.pixBeneficiary || '',
      organizers: g.organizers || [],
      lanesCount: g.lanesCount || 8,
      scoringRules: {
        isLowestPointsBetter: g.isLowestPointsBetter || false,
        showTime: g.showTime !== false,
        showWeight: g.showWeight !== false,
        showReps: g.showReps !== false,
        showScoreRevision: g.showScoreRevision || false,
        hyroxChipTimingEnabled: g.eventType === 'hyrox',
      },
    }));
    setGames(loadedGames);

    const activeId = storage.getActiveGameId();
    const game = loadedGames.find(g => g.id === activeId || g.code === activeId) || loadedGames[0];
    setActiveGame(game || null);
    setOrganizations(storage.getOrganizations());

    if (game) {
      // Buscar categorias reais da API com fallback
      try {
        const apiCats = await apiClient.listCategories(game.code || game.id);
        if (apiCats && apiCats.length > 0) {
          const mappedCats = apiCats.map(c => ({
            id: String(c.code),
            gameId: c.gamesId,
            name: c.name,
            gender: c.genderRule || 'open',
            teamFormat: c.teamType || 'individual',
            maxAthletes: c.maxAthlete || 1,
            priceBrl: c.amount || 0,
            description: c.description || '',
            standards: c.standards || '',
            ageRule: {
              minAge: c.minIndividualAge,
              maxAge: c.maxIndividualAge,
              sumAge: c.minTeamSumAge
            }
          }));
          setCategories(mappedCats as any);
        } else {
          setCategories(storage.getCategories(game.id));
        }
      } catch (err) {
        setCategories(storage.getCategories(game.id));
      }

      let loadedTeams = storage.getTeams(game.id);
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
            paymentStatus: (r.status as any) || 'paid',
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

          const existingBibs = new Set(loadedTeams.map(t => t.registerNumber));
          apiMapped.forEach(m => {
            if (!existingBibs.has(m.registerNumber)) {
              loadedTeams.push(m);
            }
          });
        }
      } catch (err) {
        console.log('[Admin] Fallback storage para inscrições');
      }

      setWorkouts(storage.getWorkouts(game.id));
      setTeams([...loadedTeams]);
      setScores(storage.getScores(game.id));
      setAuditLogs(storage.getAuditLogs(game.id));
      setContestTickets(storage.getContestTickets(game.id));
      setJudges(storage.getJudges(game.id));
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('itgames_storage_updated', () => loadData());
    return () => window.removeEventListener('itgames_storage_updated', () => loadData());
  }, [userRole]);

  const handleSelectGame = async (gameCode: string) => {
    storage.setActiveGameId(gameCode);
    const game = games.find(g => g.code === gameCode || g.id === gameCode);
    if (game) {
      setActiveGame(game);
      try {
        const apiCats = await apiClient.listCategories(game.code || game.id);
        if (apiCats && apiCats.length > 0) {
          const mappedCats = apiCats.map(c => ({
            id: String(c.code),
            gameId: c.gamesId,
            name: c.name,
            gender: c.genderRule || 'open',
            teamFormat: c.teamType || 'individual',
            maxAthletes: c.maxAthlete || 1,
            priceBrl: c.amount || 0,
            description: c.description || '',
            standards: c.standards || '',
            ageRule: {
              minAge: c.minIndividualAge,
              maxAge: c.maxIndividualAge,
              sumAge: c.minTeamSumAge
            }
          }));
          setCategories(mappedCats as any);
        } else {
          setCategories(storage.getCategories(game.id));
        }
      } catch (err) {
        setCategories(storage.getCategories(game.id));
      }

      setWorkouts(storage.getWorkouts(game.id));
      setTeams(storage.getTeams(game.id));
      setScores(storage.getScores(game.id));
      toast.info(`Campeonato ativo alterado para: ${game.name}`);
    }
  };

  const handleOpenCreateCategory = () => {
    setEditingCategory(null);
    setCatName('');
    setCatTeamType('individual');
    setCatGender('open');
    setCatAmount(150);
    setCatMinAge('');
    setCatMaxAge('');
    setCatMinSumAge('');
    setCatStandards('');
    setCatDesc('');
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: any) => {
    setEditingCategory(cat);
    setCatName(cat.name || '');
    setCatTeamType(cat.teamFormat || cat.teamType || 'individual');
    setCatGender(cat.gender || cat.genderRule || 'open');
    setCatAmount(Number(cat.priceBrl || cat.price || cat.amount || 0));
    setCatMinAge(cat.ageRule?.minAge || cat.minIndividualAge ? String(cat.ageRule?.minAge || cat.minIndividualAge) : '');
    setCatMaxAge(cat.ageRule?.maxAge || cat.maxIndividualAge ? String(cat.ageRule?.maxAge || cat.maxIndividualAge) : '');
    setCatMinSumAge(cat.ageRule?.sumAge || cat.minTeamSumAge ? String(cat.ageRule?.sumAge || cat.minTeamSumAge) : '');
    setCatStandards(cat.standards || '');
    setCatDesc(cat.description || '');
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGame) {
      toast.error('Selecione um campeonato antes de gerenciar categorias');
      return;
    }
    if (!catName.trim()) {
      toast.error('Informe o nome da categoria');
      return;
    }

    const payload = {
      name: catName,
      teamType: catTeamType,
      genderRule: catGender,
      amount: Number(catAmount) || 0,
      maxAthlete: catTeamType === 'individual' ? 1 : catTeamType === 'duo' ? 2 : catTeamType === 'trio' ? 3 : 4,
      minIndividualAge: catMinAge ? Number(catMinAge) : undefined,
      maxIndividualAge: catMaxAge ? Number(catMaxAge) : undefined,
      minTeamSumAge: catMinSumAge ? Number(catMinSumAge) : undefined,
      description: catDesc || 'Regulamento oficial da categoria',
      standards: catStandards || undefined,
    };

    if (editingCategory) {
      // 1. Edição de Categoria Existente
      const catCode = editingCategory.code || editingCategory.id;
      try {
        await apiClient.updateCategory(activeGame.code || activeGame.id, catCode, payload);
        toast.success(`Categoria "${catName}" atualizada com sucesso!`);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Não foi possível atualizar a categoria');
        return;
      }

      const updatedCatObj: Category = {
        id: editingCategory.id,
        gameId: activeGame.id,
        name: catName,
        type: (activeGame.eventType as any) || 'crossfit',
        teamFormat: catTeamType as any,
        maxAthletesPerTeam: catTeamType === 'individual' ? 1 : catTeamType === 'duo' ? 2 : catTeamType === 'trio' ? 3 : 4,
        genderComposition: catGender as any,
        division: 'open',
        price: Number(catAmount) || 0,
        description: catDesc || '',
        standards: catStandards || '',
        ageRule: catMinSumAge ? 'sum_team_age' : catMinAge ? 'min_individual_age' : catMaxAge ? 'max_individual_age' : 'none',
        minIndividualAge: catMinAge ? Number(catMinAge) : undefined,
        maxIndividualAge: catMaxAge ? Number(catMaxAge) : undefined,
        minSumTeamAge: catMinSumAge ? Number(catMinSumAge) : undefined,
        spotsTotal: editingCategory.spotsTotal || 50,
        spotsFilled: editingCategory.spotsFilled || 0,
      };
      storage.saveCategory(updatedCatObj);
    } else {
      // 2. Criação de Nova Categoria
      try {
        await apiClient.createCategory(activeGame.code || activeGame.id, payload);
        toast.success(`Categoria "${catName}" criada com sucesso no campeonato!`);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Não foi possível criar a categoria');
        return;
      }

      const newCatObj: Category = {
        id: `cat_${Date.now()}`,
        gameId: activeGame.id,
        name: catName,
        type: (activeGame.eventType as any) || 'crossfit',
        teamFormat: catTeamType as any,
        maxAthletesPerTeam: catTeamType === 'individual' ? 1 : catTeamType === 'duo' ? 2 : catTeamType === 'trio' ? 3 : 4,
        genderComposition: catGender as any,
        division: 'open',
        price: Number(catAmount) || 0,
        description: catDesc || '',
        standards: catStandards || '',
        ageRule: catMinSumAge ? 'sum_team_age' : catMinAge ? 'min_individual_age' : catMaxAge ? 'max_individual_age' : 'none',
        minIndividualAge: catMinAge ? Number(catMinAge) : undefined,
        maxIndividualAge: catMaxAge ? Number(catMaxAge) : undefined,
        minSumTeamAge: catMinSumAge ? Number(catMinSumAge) : undefined,
        spotsTotal: 50,
        spotsFilled: 0,
      };
      storage.saveCategory(newCatObj);
    }

    setIsCategoryModalOpen(false);
    setEditingCategory(null);
    setCatName('');
    setCatDesc('');
    setCatStandards('');
    setCatMinAge('');
    setCatMaxAge('');
    setCatMinSumAge('');
    await loadData();
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!activeGame) return;
    if (confirm('Deseja realmente excluir esta categoria?')) {
      // Categorias só locais (id não numérico) não existem na API
      if (/^\d+$/.test(String(catId))) {
        try {
          await apiClient.deleteCategory(activeGame.code || activeGame.id, catId);
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : 'Não foi possível excluir a categoria');
          return;
        }
      }
      toast.success('Categoria excluída com sucesso!');
      storage.deleteCategory(catId);
      await loadData();
    }
  };

  const handleUpdateStatus = async (gameCode: string, newStatus: string) => {
    try {
      await apiClient.updateGameStatus(gameCode, newStatus);
      toast.success(`Campeonato ${gameCode}: status alterado para ${newStatus.toUpperCase()} com sucesso!`);
      await loadData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao atualizar status do campeonato');
    }
  };

  const handleDeleteGameCascade = async () => {
    if (!gameToDelete) return;
    setIsDeletingGame(true);
    try {
      const res = await apiClient.deleteGame(gameToDelete.code || gameToDelete.id);
      if (res) {
        toast.success(`Campeonato ${gameToDelete.name} excluído em cascata com sucesso!`);
        storage.deleteGame(gameToDelete.code || gameToDelete.id);
        setGameToDelete(null);
        await loadData();
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao excluir campeonato em cascata');
    } finally {
      setIsDeletingGame(false);
    }
  };

  const openNewGame = () => {
    setEditingGameCode(null);
    setNewGameCode('');
    setNewGameName('');
    setNewGameDate('2026-11-20');
    setNewGameLocation('Arena Olímpica - São Paulo / SP');
    setNewGameFoto('');
    setNewGameLanes(8);
    setNewGameType('crossfit');
    setNewGameDesc('');
    setNewGameLowestPoints(false);
    setNewGameShowTime(true);
    setNewGameShowWeight(true);
    setNewGameShowReps(true);
    setNewGameShowRevision(false);
    setNewGamePixKey('');
    setNewGamePixBeneficiary('');
    setNewGameFile(null);
    setNewGamePreview('');
    setNewGameBannerInfo(null);
    setIsNewGameModalOpen(true);
  };

  const openEditGame = (g: any) => {
    setEditingGameCode(g.code || g.id);
    setNewGameCode(g.code || g.id);
    setNewGameName(g.name || '');
    setNewGameDate(g.startDate || '');
    setNewGameLocation(g.location || '');
    setNewGameFoto(g.foto || '');
    setNewGameLanes(g.lanesCount || 8);
    setNewGameType(g.eventType || 'crossfit');
    setNewGameDesc(g.description || '');
    setNewGameLowestPoints(!!g.scoringRules?.isLowestPointsBetter);
    setNewGameShowTime(g.scoringRules?.showTime !== false);
    setNewGameShowWeight(g.scoringRules?.showWeight !== false);
    setNewGameShowReps(g.scoringRules?.showReps !== false);
    setNewGameShowRevision(!!g.scoringRules?.showScoreRevision);
    setNewGamePixKey(g.pixKey || '');
    setNewGamePixBeneficiary(g.pixBeneficiary || '');
    setNewGameFile(null);
    setNewGamePreview('');
    setNewGameBannerInfo(null);
    setIsNewGameModalOpen(true);
  };

  // Adequa a imagem escolhida (recorte 3:1, até 1920 px, JPG otimizado) e mostra a prévia do que será enviado
  const handleBannerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Formato inválido. Envie uma imagem JPG, PNG ou WebP.');
      return;
    }
    if (file.size > BANNER_MAX_ORIGINAL_BYTES) {
      toast.error('A imagem original deve ter no máximo 25 MB.');
      return;
    }
    try {
      const prepared = await prepareBanner(file);
      if (newGamePreview) URL.revokeObjectURL(newGamePreview);
      setNewGameFile(prepared.file);
      setNewGamePreview(prepared.previewUrl);
      setNewGameBannerInfo({ summary: prepared.summary, warning: prepared.warning });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível processar a imagem.');
    }
  };

  // Envia a imagem escolhida depois que o campeonato foi salvo
  const uploadPendingBanner = async (gameCode: string) => {
    if (!newGameFile) return;
    try {
      await apiClient.uploadGameBanner(gameCode, newGameFile);
    } catch (err) {
      toast.error(err instanceof ApiError ? `Campeonato salvo, mas a imagem falhou: ${err.message}` : 'Campeonato salvo, mas o envio da imagem falhou');
    }
  };

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGameCode.trim() || !newGameName.trim()) {
      toast.error('Informe o código e nome do campeonato');
      return;
    }

    const cleanCode = newGameCode.toUpperCase().replace(/\s+/g, '-').trim();

    // Edição de campeonato existente (o código e o status não mudam)
    if (editingGameCode) {
      try {
        await apiClient.updateGame(editingGameCode, {
          name: newGameName,
          date: newGameDate,
          location: newGameLocation,
          foto: newGameFoto,
          lanesCount: newGameLanes,
          eventType: newGameType,
          isLowestPointsBetter: newGameLowestPoints,
          showTime: newGameShowTime,
          showWeight: newGameShowWeight,
          showReps: newGameShowReps,
          showScoreRevision: newGameShowRevision,
          description: newGameDesc,
          pixKey: newGamePixKey.trim(),
          pixBeneficiary: newGamePixBeneficiary.trim(),
        });
        await uploadPendingBanner(editingGameCode);
        toast.success(`Campeonato ${newGameName} atualizado com sucesso!`);
        setIsNewGameModalOpen(false);
        setEditingGameCode(null);
        await loadData();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Falha ao atualizar o campeonato');
      }
      return;
    }

    // 1. Criar na API NestJS (PostgreSQL): o campeonato nasce como rascunho até a liberação do Super Admin
    try {
      await apiClient.createGame({
        code: cleanCode,
        name: newGameName,
        date: newGameDate,
        location: newGameLocation,
        foto: newGameFoto || undefined,
        lanesCount: newGameLanes,
        eventType: newGameType,
        isLowestPointsBetter: newGameLowestPoints,
        showTime: newGameShowTime,
        showWeight: newGameShowWeight,
        showReps: newGameShowReps,
        showScoreRevision: newGameShowRevision,
        description: newGameDesc || 'Campeonato oficial organizado na plataforma ITGames Arena',
        pixKey: newGamePixKey.trim() || undefined,
        pixBeneficiary: newGamePixBeneficiary.trim() || undefined,
      });
      await uploadPendingBanner(cleanCode);
      toast.success(`Campeonato ${newGameName} (${cleanCode}) cadastrado como rascunho. Aguarde a liberação do Super Admin.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao cadastrar o campeonato');
      return;
    }

    // 2. Salvar localmente
    const newGameObj: GameEvent = {
      id: cleanCode,
      organizationId: 'org_1',
      code: cleanCode,
      name: newGameName,
      description: newGameDesc || 'Campeonato oficial organizado na plataforma ITGames Arena',
      location: newGameLocation,
      startDate: newGameDate,
      endDate: newGameDate,
      eventType: newGameType as any,
      status: 'draft',
      lanesCount: newGameLanes,
      scoringRules: {
        isLowestPointsBetter: newGameLowestPoints,
        hyroxChipTimingEnabled: newGameType === 'hyrox'
      }
    };

    storage.saveGame(newGameObj);
    storage.setActiveGameId(cleanCode);
    setIsNewGameModalOpen(false);
    setNewGameCode('');
    setNewGameName('');
    setNewGameDesc('');
    setNewGameFoto('');
    await loadData();
  };

  const totalAthletesAllOrgs = organizations.reduce((acc, o) => acc + o.totalAthletesRegistered, 0);
  const totalRevenuePlatform = organizations.reduce((acc, o) => acc + (o.totalAthletesRegistered * o.feePerAthleteBrl), 0);
  const totalEventGMV = teams.reduce((acc, t) => acc + (t.amountPaid || 0), 0);

  const handleToggleCheckIn = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    const updatedTeam = {
      ...team,
      checkedIn: !team.checkedIn,
      athletes: team.athletes.map(a => ({ ...a, checkIn: !team.checkedIn }))
    };

    storage.saveTeam(updatedTeam);
    setTeams(storage.getTeams(activeGame?.id));
    toast.success(`Check-in de ${team.teamName} atualizado!`);
  };

  const handleCreateWorkout = () => {
    if (!activeGame || !categories[0]) return;
    if (!wodTitle.trim()) {
      toast.error('Informe o título do workout');
      return;
    }

    const newWod: WorkoutRule = {
      id: `wod_${Date.now()}`,
      gameId: activeGame.id,
      categoryId: categories[0].id,
      title: wodTitle,
      type: wodType,
      timeCapSeconds: wodTimeCapMins * 60,
      description: wodDesc || 'Conforme briefing da organização',
      movementStandards: []
    };

    storage.saveWorkout(newWod);
    setWorkouts(storage.getWorkouts(activeGame.id));
    setIsWodModalOpen(false);
    setWodTitle('');
    setWodDesc('');
    toast.success(`WOD "${newWod.title}" adicionado com sucesso!`);
  };

  const handleCreateJudge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGame) return;
    if (!judgeName.trim()) {
      toast.error('Informe o nome do árbitro');
      return;
    }

    const lanesArray = judgeLanes.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));

    const newJudge: JudgeStaff = {
      id: `judge_${Date.now()}`,
      gameId: activeGame.id,
      name: judgeName,
      email: judgeEmail || `${judgeName.toLowerCase().replace(/\s+/g, '.')}@itgames.com.br`,
      phone: judgePhone,
      pinCode: judgePin || '1234',
      assignedLanes: lanesArray.length > 0 ? lanesArray : [1, 2],
      status: 'active',
      role: judgeRole,
      createdAt: new Date().toISOString()
    };

    storage.saveJudge(newJudge);
    setJudges(storage.getJudges(activeGame.id));
    setIsJudgeModalOpen(false);
    setJudgeName('');
    setJudgeEmail('');
    setJudgePhone('');
    setJudgePin('1234');
    toast.success(`Árbitro ${newJudge.name} escalado para o evento com PIN ${newJudge.pinCode}!`);
  };

  const handleDeleteJudge = (judgeId: string) => {
    if (confirm('Deseja remover este árbitro da escala do evento?')) {
      storage.deleteJudge(judgeId);
      setJudges(storage.getJudges(activeGame?.id));
      toast.success('Árbitro removido da escala');
    }
  };

  // Homologar Score (Head Judge Approval)
  const handleApproveScore = (score: ScoreEntry) => {
    const updatedScore: ScoreEntry = {
      ...score,
      scoreStatus: 'approved_by_head_judge',
      approvedAt: new Date().toISOString(),
      approvedBy: 'Head Judge Carlos M.'
    };

    storage.saveScore(updatedScore, 'Head Judge Carlos M.', 'head_judge', 'Homologação oficial após conferência');
    setScores(storage.getScores(activeGame?.id));
    setAuditLogs(storage.getAuditLogs(activeGame?.id));
    toast.success(`Score de ${score.teamName} homologado com sucesso!`);
  };

  // Retificar Score com Justificativa e Trilha de Auditoria
  const handleRectifyScore = () => {
    if (!selectedAuditScore) return;
    if (!auditReason.trim()) {
      toast.error('Justificativa é obrigatória para retificação');
      return;
    }

    const updatedScore: ScoreEntry = {
      ...selectedAuditScore,
      timeFormatted: auditNewTime || selectedAuditScore.timeFormatted,
      finalPoints: auditNewPoints || selectedAuditScore.finalPoints,
      scoreStatus: 'approved_by_head_judge',
      approvedAt: new Date().toISOString(),
      approvedBy: 'Head Judge Carlos M.'
    };

    storage.saveScore(updatedScore, 'Head Judge Carlos M.', 'head_judge', auditReason);
    setScores(storage.getScores(activeGame?.id));
    setAuditLogs(storage.getAuditLogs(activeGame?.id));
    setSelectedAuditScore(null);
    setAuditReason('');
    toast.success('Score retificado e registrado no log imutável de auditoria!');
  };

  // 2. Baixar / Confirmar Pagamento Manualmente (Ação do Organizador)
  const handleTogglePaymentStatus = async (teamId: string) => {
    const targetTeam = teams.find(t => t.id === teamId);
    if (!targetTeam) return;

    const newStatus: 'paid' | 'pending' = targetTeam.paymentStatus === 'paid' ? 'pending' : 'paid';
    const cat = categories.find(c => c.id === targetTeam.categoryId);
    const amount = newStatus === 'paid' ? (targetTeam.amountPaid || cat?.price || 150) : 0;

    // 1. Tentar sincronizar via API NestJS
    if (activeGame) {
      try {
        await apiClient.updateRegistrationStatus(activeGame.code || activeGame.id, targetTeam.registerNumber, {
          status: newStatus,
          amount,
          check: newStatus === 'paid' ? true : false,
        });
      } catch (err) {
        console.log('[Admin] Fallback local para atualização de pagamento');
      }
    }

    const updatedTeam: TeamRegistration = {
      ...targetTeam,
      paymentStatus: newStatus,
      amountPaid: amount,
      checkedIn: newStatus === 'paid' ? true : targetTeam.checkedIn,
    };

    storage.saveTeam(updatedTeam);
    setTeams(storage.getTeams(activeGame?.id));
    if (selectedProofTeam?.id === teamId) {
      setSelectedProofTeam(updatedTeam);
    }

    if (newStatus === 'paid') {
      toast.success(`💰 Pagamento da equipe "${targetTeam.teamName}" (${targetTeam.registerNumber}) baixado e liberado com sucesso!`);
    } else {
      toast.info(`Status de pagamento da equipe "${targetTeam.teamName}" alterado para Pendente.`);
    }
  };


  // Cancelar (ou reativar) inscrição: a API tira a equipe das baterias e anula as súmulas
  const handleCancelRegistration = async (team: TeamRegistration, reactivate = false) => {
    if (!activeGame) return;
    if (
      !reactivate &&
      !confirm(
        `Cancelar a inscrição de "${team.teamName}" (${team.registerNumber})?\n\nA equipe sai das baterias e as súmulas dela serão ANULADAS (ficam no histórico). Depois, gere as baterias novamente.`,
      )
    ) {
      return;
    }
    const status = reactivate ? 'pending' : 'cancelled';
    try {
      await apiClient.updateRegistrationStatus(activeGame.code || activeGame.id, team.registerNumber, { status });
    } catch (err) {
      // 404 = inscrição só local (não existe na API); qualquer outro erro interrompe
      if (!(err instanceof ApiError && err.status === 404)) {
        toast.error(err instanceof ApiError ? err.message : 'Não foi possível atualizar a inscrição');
        return;
      }
    }
    storage.saveTeam({ ...team, paymentStatus: status as TeamRegistration['paymentStatus'], checkedIn: reactivate ? team.checkedIn : false });
    await loadData();
    toast.success(
      reactivate
        ? `Inscrição de "${team.teamName}" reativada (pendente). As súmulas anuladas não são restauradas.`
        : `Inscrição de "${team.teamName}" cancelada. Gere as baterias novamente.`,
    );
  };

  const handleDeleteRegistration = async (team: TeamRegistration) => {
    if (!activeGame) return;
    const extra =
      userRole === 'SUPER_ADMIN'
        ? ' Scores e vagas em bateria dessa equipe também serão apagados (os logs de auditoria permanecem).'
        : '';
    if (!confirm(`Excluir DEFINITIVAMENTE a inscrição de "${team.teamName}" (${team.registerNumber})? Esta ação não pode ser desfeita.${extra}`)) {
      return;
    }
    try {
      await apiClient.deleteRegistration(activeGame.code || activeGame.id, team.registerNumber);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        toast.error(err instanceof ApiError ? err.message : 'Não foi possível excluir a inscrição');
        return;
      }
    }
    storage.deleteTeam(team.id);
    await loadData();
    toast.success(`Inscrição de "${team.teamName}" excluída.`);
  };

  // 3. Exportar Relatório de Inscrições e Pagamentos em CSV
  const handleExportRegistrationsCSV = () => {
    if (!teams || teams.length === 0) {
      toast.error('Nenhuma inscrição encontrada para exportar');
      return;
    }

    const headers = ['BIB', 'Equipe/Atleta', 'Categoria', 'Box/Afiliação', 'Valor (R$)', 'Status Pagamento', 'Check-in', 'Integrantes', 'Camisetas (Kits)', 'Data Inscrição'];
    const rows = teams.map(t => [
      t.registerNumber,
      `"${t.teamName.replace(/"/g, '""')}"`,
      `"${(t.categoryName || t.categoryId).replace(/"/g, '""')}"`,
      `"${(t.athletes[0]?.boxOrAffiliate || '—').replace(/"/g, '""')}"`,
      (t.amountPaid || 0).toFixed(2),
      t.paymentStatus === 'paid' ? 'PAGO' : 'PENDENTE',
      t.checkedIn ? 'CONFIRMADO' : 'PENDENTE',
      `"${t.athletes.map(a => a.name).join('; ').replace(/"/g, '""')}"`,
      `"${t.athletes.map(a => `${a.name} (${a.tshirtSize || 'M'})`).join('; ').replace(/"/g, '""')}"`,
      t.registeredAt ? new Date(t.registeredAt).toLocaleDateString('pt-BR') : ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `inscricoes_${activeGame?.code || 'campeonato'}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('📊 Relatório completo de inscrições e pagamentos exportado com sucesso!');
  };


  return (
    <AclGuard resource="admin" requiredRoleLabel="Organizadores e Administradores">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* SELETOR DE PERFIL (SUPER ADMIN VS ORGANIZADOR) & SELETOR DE CAMPEONATO */}
      <div className="p-4 rounded-3xl bg-zinc-900 border border-zinc-800 flex flex-wrap items-center justify-between gap-4">
        {/* Perfil da sessão (somente leitura) */}
        <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800">
          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 ${
              userRole === 'SUPER_ADMIN' ? 'bg-amber-500 text-black' : 'bg-orange-500 text-black'
            }`}
          >
            {userRole === 'SUPER_ADMIN' ? <ShieldCheck className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
            <span>{userRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Organizador'}</span>
          </span>
        </div>

        {/* Seletor do Campeonato Ativo */}
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="flex-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Campeonato em Foco ({games.length} disponíveis):
            </label>
            <select
              value={activeGame?.code || activeGame?.id || ''}
              onChange={(e) => handleSelectGame(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 text-amber-400 font-bold text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500 mt-0.5"
            >
              {games.map(g => (
                <option key={g.code || g.id} value={g.code || g.id}>
                  {g.name} ({g.code}) — {g.status === 'live' ? '🟢 LIVE' : g.status === 'draft' ? '🟡 RASCUNHO' : '🔴 BLOQUEADO'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBackupModalOpen(true)}
            className="px-3.5 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-bold text-xs border border-zinc-700 flex items-center gap-2 transition-colors"
            title="Backup e sincronização de dados (Exportar / Importar Snapshot)"
          >
            <Database className="w-4 h-4 text-amber-400" />
            <span>Backup & Sincronização</span>
          </button>

          <button
            onClick={openNewGame}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Cadastrar Campeonato</span>
          </button>
        </div>
      </div>

      {/* CABEÇALHO DO PAINEL ADMIN */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <LayoutDashboard className="w-4 h-4" />
            <span>
              {userRole === 'SUPER_ADMIN' ? 'Painel Super Admin — Governança & Liberações' : 'Painel do Organizador — Meus Eventos'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
            {activeGame?.name || 'Painel da Organização & Arbitragem'}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {activeGame?.description || 'WODs das provas, escala de juízes com PIN, credenciamento, homologação com foto e auditoria.'}
          </p>
        </div>

        {/* ABAS DO PAINEL */}
        <div className="flex flex-wrap items-center gap-2 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800">
          <button
            onClick={() => setAdminTab('championships')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              adminTab === 'championships' 
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Campeonatos & Liberações ({games.length})</span>
          </button>
          <button
            onClick={() => setAdminTab('organizer')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              adminTab === 'organizer' 
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            WODs & Categorias
          </button>
          <button
            onClick={() => setAdminTab('registrations_financial')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              adminTab === 'registrations_financial' 
                ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Inscrições & Financeiro ({teams.length})</span>
          </button>
          <button
            onClick={() => setAdminTab('judges_staff')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              adminTab === 'judges_staff' 
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Gavel className="w-3.5 h-3.5" />
            <span>Corpo de Juízes ({judges.length})</span>
          </button>
          <button
            onClick={() => setAdminTab('audit_center')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              adminTab === 'audit_center' 
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Auditoria & Súmulas c/ Foto
          </button>
          {userRole === 'SUPER_ADMIN' && (
            <>
              <button
                onClick={() => setAdminTab('organizers_mgmt')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  adminTab === 'organizers_mgmt'
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Organizadores
              </button>
              <button
                onClick={() => setAdminTab('saas_owner')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  adminTab === 'saas_owner'
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Dono do SaaS
              </button>
            </>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 0. ABA DE GESTÃO DE CAMPEONATOS & LIBERAÇÕES DO SUPER ADMIN */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {adminTab === 'organizers_mgmt' && userRole === 'SUPER_ADMIN' && <OrganizersPanel />}

      {adminTab === 'championships' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl bg-zinc-900 border border-zinc-800">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-400" />
                <span>Gestão Central de Campeonatos ({games.length})</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                {userRole === 'SUPER_ADMIN' 
                  ? 'Como Super Admin, você tem o poder de liberar/aprovar a execução dos campeonatos, suspender ou excluir em cascata.'
                  : 'Como Organizador, você cadastra seus campeonatos e acompanha o status de liberação. A execução só é liberada pelo Super Admin.'}
              </p>
            </div>
            <button
              onClick={openNewGame}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>+ Cadastrar Novo Campeonato</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {games.map((g) => {
              const isSelected = activeGame?.code === g.code || activeGame?.id === g.code;
              return (
                <div
                  key={g.code || g.id}
                  className={`p-6 rounded-3xl border transition-all space-y-4 ${
                    isSelected
                      ? 'bg-zinc-900/90 border-amber-500/60 shadow-xl shadow-amber-500/10'
                      : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-black text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                          {g.code}
                        </span>
                        <span className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-lg border ${
                          g.status === 'live'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : g.status === 'draft'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}>
                          {g.status === 'live' ? '🟢 Liberado (LIVE)' : g.status === 'draft' ? '🟡 Rascunho (DRAFT)' : '🔴 Bloqueado (BLOCKED)'}
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-white mt-2">{g.name}</h3>
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{g.description || 'Sem descrição informada.'}</p>
                    </div>

                    <button
                      onClick={() => handleSelectGame(g.code || g.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-amber-500 text-black'
                          : 'bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700'
                      }`}
                    >
                      {isSelected ? 'Ativo na Arena' : 'Selecionar'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-800/80 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Modalidade</span>
                      <span className="font-bold text-zinc-300 uppercase">{g.eventType || 'CrossFit'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Raias na Arena</span>
                      <span className="font-bold text-zinc-300">{g.lanesCount || 8} raias</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Data do Evento</span>
                      <span className="font-bold text-zinc-300">{g.startDate || 'A definir'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Local</span>
                      <span className="font-bold text-zinc-300 truncate block">{g.location || 'Brasil'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="text-zinc-400 truncate">
                      <span className="text-[10px] text-zinc-500 uppercase mr-1">Organizadores:</span>
                      <span className="font-bold text-zinc-300">
                        {(g.organizers || []).map((o: { name: string }) => o.name).join(', ') || 'Nenhum vinculado'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => openEditGame(g)}
                        className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold"
                      >
                        Editar campeonato
                      </button>
                      {userRole === 'SUPER_ADMIN' && (
                        <button
                          onClick={() => setOrganizersGame({ code: g.code || g.id, name: g.name })}
                          className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold"
                        >
                          Gerenciar organizadores
                        </button>
                      )}
                    </div>
                  </div>

                  {/* AÇÕES DE GOVERNANÇA (SUPER ADMIN & ORGANIZADOR) */}
                  <div className="pt-3 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                    {userRole === 'SUPER_ADMIN' ? (
                      <div className="flex flex-wrap items-center gap-2 w-full justify-between">
                        <div className="flex items-center gap-1.5">
                          {g.status !== 'live' && (
                            <button
                              onClick={() => handleUpdateStatus(g.code || g.id, 'live')}
                              className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1 transition-all"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Liberar Execução</span>
                            </button>
                          )}
                          {g.status !== 'draft' && (
                            <button
                              onClick={() => handleUpdateStatus(g.code || g.id, 'draft')}
                              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1 transition-all"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span>Pausar (Rascunho)</span>
                            </button>
                          )}
                          {g.status !== 'blocked' && (
                            <button
                              onClick={() => handleUpdateStatus(g.code || g.id, 'blocked')}
                              className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1 transition-all"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Bloquear</span>
                            </button>
                          )}
                        </div>

                        {/* Botão de Excluir em Cascata */}
                        <button
                          onClick={() => setGameToDelete(g)}
                          className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 text-xs font-bold flex items-center gap-1.5 transition-all ml-auto"
                          title="Excluir campeonato e todos os seus dados dependentes em cascata"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Excluir Cascata</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full text-xs text-zinc-400">
                        <span>Status: <strong className="text-zinc-200">{g.status === 'live' ? 'Liberado pelo Super Admin' : 'Aguardando Liberação do Super Admin'}</strong></span>
                        <span className="text-[11px] text-zinc-500">Gestão pelo Organizador</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1. ABA DO ORGANIZADOR (WODs, CHECK-IN & INSCRIÇÕES) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {adminTab === 'organizer' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-panel rounded-3xl p-5 border border-zinc-800">
              <div className="text-xs font-bold text-zinc-400 uppercase">Receita Bruta de Inscrições</div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
                R$ {totalEventGMV.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">{teams.length} equipes confirmadas</div>
            </div>

            <div className="glass-panel rounded-3xl p-5 border border-zinc-800">
              <div className="text-xs font-bold text-zinc-400 uppercase">Credenciamento / Check-in</div>
              <div className="text-2xl sm:text-3xl font-black text-white mt-1">
                {teams.filter(t => t.checkedIn).length} / {teams.length}
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">Atletas presentes na arena</div>
            </div>

            <div className="glass-panel rounded-3xl p-5 border border-zinc-800">
              <div className="text-xs font-bold text-zinc-400 uppercase">Workouts Cadastrados</div>
              <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">
                {workouts.length} Provas
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">{categories.length} categorias oficiais</div>
            </div>
          </div>

          {/* CATEGORIAS OFICIAIS DO CAMPEONATO */}
          <div className="glass-panel rounded-3xl p-6 border border-zinc-800 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-lg font-bold text-white">Categorias do Campeonato ({categories.length})</h3>
                  <p className="text-xs text-zinc-400">Regras de time, limites de idade e taxas de inscrição</p>
                </div>
              </div>
              <button
                onClick={handleOpenCreateCategory}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-xs shadow-lg shadow-amber-500/20 transition-transform active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Criar Nova Categoria</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((cat: any) => (
                <div key={cat.id || cat.code} className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {cat.teamFormat === 'individual' ? 'Individual (1 Atleta)' : cat.teamFormat === 'duo' ? 'Dupla (2 Atletas)' : cat.teamFormat === 'trio' ? 'Trio (3 Atletas)' : 'Quarteto (4 Atletas)'}
                      </span>
                      <span className="text-xs font-black text-emerald-400 font-mono">
                        R$ {Number(cat.priceBrl || cat.amount || 0).toFixed(2)}
                      </span>
                    </div>

                    <h4 className="font-bold text-white text-sm mt-2">{cat.name}</h4>
                    <p className="text-xs text-zinc-400 line-clamp-2 mt-0.5">{cat.description || 'Regulamento oficial da categoria'}</p>
                  </div>

                  <div className="pt-2 border-t border-zinc-850 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-zinc-400">
                      <span>Composição:</span>
                      <strong className="text-zinc-200 uppercase">
                        {cat.gender === 'male' ? 'Masculino' : cat.gender === 'female' ? 'Feminino' : cat.gender === 'mixed_1m_1f' ? '1H + 1M' : cat.gender === 'mixed_2m_2f' ? '2H + 2M' : 'Aberto'}
                      </strong>
                    </div>

                    {(cat.ageRule?.minAge || cat.ageRule?.maxAge || cat.ageRule?.sumAge || cat.minIndividualAge || cat.minTeamSumAge) && (
                      <div className="flex items-center justify-between text-amber-400/90 font-mono">
                        <span>Regra Etária:</span>
                        <strong>
                          {cat.ageRule?.sumAge || cat.minTeamSumAge ? `Soma ${cat.ageRule?.sumAge || cat.minTeamSumAge}+ anos` : cat.ageRule?.minAge || cat.minIndividualAge ? `Mín ${cat.ageRule?.minAge || cat.minIndividualAge} anos` : `Até ${cat.ageRule?.maxAge || cat.maxIndividualAge} anos`}
                        </strong>
                      </div>
                    )}

                    <div className="pt-2 flex items-center justify-between border-t border-zinc-800/80">
                      <button
                        onClick={() => handleOpenEditCategory(cat)}
                        className="text-amber-400 hover:text-amber-300 text-[11px] font-bold flex items-center gap-1 transition-colors px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Editar Categoria</span>
                      </button>

                      <button
                        onClick={() => handleDeleteCategory(cat.id || cat.code)}
                        className="text-rose-400 hover:text-rose-300 text-[11px] font-semibold flex items-center gap-1 transition-colors px-2 py-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* WORKOUTS CADASTRADOS */}
          <div className="glass-panel rounded-3xl p-6 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white">Workouts & Provas do Evento</h3>
              </div>
              <button
                onClick={() => setIsWodModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg shadow-amber-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>+ Adicionar Novo WOD</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {workouts.map((wod) => (
                <div key={wod.id} className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-zinc-800 text-amber-400">
                      {wod.type.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">
                      CAP: {Math.floor(wod.timeCapSeconds / 60)}:00
                    </span>
                  </div>

                  <h4 className="font-bold text-white text-sm">{wod.title}</h4>
                  <p className="text-xs text-zinc-400 line-clamp-2">{wod.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* LISTA DE INSCRIÇÕES & CHECK-IN */}
          <div className="glass-panel rounded-3xl p-6 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-bold text-white">Lista de Inscrições, Camisetas & Check-in</h3>
              </div>
              <span className="text-xs text-zinc-400">Clique para alternar o status de presença na arena</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px]">
                    <th className="py-3 px-4">BIB</th>
                    <th className="py-3 px-4">Equipe / Atleta</th>
                    <th className="py-3 px-4">Camisetas (Kits)</th>
                    <th className="py-3 px-4">Box / Afiliação</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4">Valor Pago</th>
                    <th className="py-3 px-4">Status Check-in</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-200">
                  {teams.map((t) => (
                    <tr key={t.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-bold text-amber-400">{t.registerNumber}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{t.teamName}</div>
                        <div className="text-[10px] text-zinc-400">{t.athletes.map(a => a.name).join(', ')}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {t.athletes.map((a, i) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-amber-300 font-mono font-bold text-[10px]" title={`${a.name}: Camiseta ${a.tshirtSize || 'M'}`}>
                              {a.name.split(' ')[0]}: {a.tshirtSize || 'M'}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-400">{t.athletes[0]?.boxOrAffiliate || '—'}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-300">{t.categoryName || t.categoryId}</td>
                      <td className="py-3 px-4 text-emerald-400 font-bold">
                        R$ {(t.amountPaid || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleCheckIn(t.id)}
                          className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                            t.checkedIn 
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                              : 'bg-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {t.checkedIn ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                          <span>{t.checkedIn ? 'Confirmado' : 'Pendente'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1.5 ABA DE INSCRIÇÕES & GESTÃO FINANCEIRA / BAIXA DE PAGAMENTOS */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {adminTab === 'registrations_financial' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* CARDS DE MÉTRICAS FINANCEIRAS DO CAMPEONATO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-panel p-5 rounded-3xl border border-emerald-500/30 bg-emerald-950/10 space-y-2">
              <div className="text-xs font-bold text-emerald-400 uppercase flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" />
                  Total Arrecadado (Pago)
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                  {teams.filter(t => t.paymentStatus === 'paid').length} pagos
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                R$ {teams.filter(t => t.paymentStatus === 'paid').reduce((acc, t) => acc + (t.amountPaid || 0), 0).toFixed(2)}
              </div>
              <div className="text-[11px] text-zinc-400">Valores baixados e confirmados</div>
            </div>

            <div className="glass-panel p-5 rounded-3xl border border-amber-500/30 bg-amber-950/10 space-y-2">
              <div className="text-xs font-bold text-amber-400 uppercase flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  A Receber (Pendente)
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                  {teams.filter(t => t.paymentStatus !== 'paid').length} pendentes
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                R$ {teams.filter(t => t.paymentStatus !== 'paid').reduce((acc, t) => {
                  const cat = categories.find(c => c.id === t.categoryId);
                  return acc + (cat?.price || 150);
                }, 0).toFixed(2)}
              </div>
              <div className="text-[11px] text-zinc-400">Inscrições aguardando baixa de pagamento</div>
            </div>

            <div className="glass-panel p-5 rounded-3xl border border-purple-500/30 bg-purple-950/10 space-y-2">
              <div className="text-xs font-bold text-purple-400 uppercase flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span>Total de Inscrições</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {teams.length} Equipes / Atletas
              </div>
              <div className="text-[11px] text-zinc-400">
                {teams.reduce((acc, t) => acc + (t.athletes?.length || 1), 0)} competidores cadastrados
              </div>
            </div>

            <div className="glass-panel p-5 rounded-3xl border border-blue-500/30 bg-blue-950/10 space-y-2">
              <div className="text-xs font-bold text-blue-400 uppercase flex items-center gap-1.5">
                <Shirt className="w-4 h-4" />
                <span>Kits & Camisetas</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG'].map((sz) => {
                  let count = 0;
                  teams.forEach(t => t.athletes?.forEach(a => { if ((a.tshirtSize || 'M') === sz) count++; }));
                  if (count === 0) return null;
                  return (
                    <span key={sz} className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] font-mono font-bold">
                      {sz}: <strong className="text-amber-400">{count}</strong>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* TABELA DE GESTÃO DE INSCRIÇÕES E BAIXA DE PAGAMENTOS */}
          <div className="glass-panel rounded-3xl p-6 border border-zinc-800 space-y-4 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                  <span>Gestão de Inscrições & Baixa Financeira</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Veja todos os atletas e equipes inscritos no campeonato. Você pode dar baixa manual no pagamento após conferência do Pix ou comprovante.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportRegistrationsCSV}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700 flex items-center gap-1.5 transition-colors shadow-md"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Baixar Planilha (.CSV / Excel)</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px] bg-zinc-950/60">
                    <th className="py-3 px-4">BIB</th>
                    <th className="py-3 px-4">Equipe / Competidor</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4">Camisetas (Kits)</th>
                    <th className="py-3 px-4">Comprovante Pix</th>
                    <th className="py-3 px-4">Valor Inscrição</th>
                    <th className="py-3 px-4">Status do Pagamento</th>
                    <th className="py-3 px-4 text-center">Ação do Organizador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-200">
                  {teams.map((t) => {
                    const isPaid = t.paymentStatus === 'paid';
                    const cat = categories.find(c => c.id === t.categoryId);
                    const amountVal = isPaid ? (t.amountPaid || cat?.price || 150) : (cat?.price || 150);

                    return (
                      <tr key={t.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-bold text-amber-400 font-mono">
                          {t.registerNumber}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-white text-sm">{t.teamName}</div>
                          <div className="text-[11px] text-zinc-400">
                            {t.athletes.map(a => a.name).join(', ')}
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-0.5">
                            Box: {t.athletes[0]?.boxOrAffiliate || 'Box Filiada'} • Tel: {t.athletes[0]?.phone || '—'}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-bold text-zinc-200">{t.categoryName || t.categoryId}</span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {t.athletes.map((a, i) => (
                              <span 
                                key={i} 
                                className="px-2 py-0.5 rounded bg-zinc-900 border border-amber-500/30 text-amber-300 font-mono font-bold text-[10px]"
                                title={`${a.name}: Camiseta ${a.tshirtSize || 'M'}`}
                              >
                                {a.name.split(' ')[0]}: <strong>{a.tshirtSize || 'M'}</strong>
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* COMPROVANTE DE PAGAMENTO PIX */}
                        <td className="py-3 px-4">
                          {t.proofOfPaymentUrl ? (
                            <button
                              onClick={() => setSelectedProofTeam(t)}
                              className="px-2.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                              title="Clique para inspecionar o comprovante enviado pelo atleta"
                            >
                              <FileText className="w-3.5 h-3.5 text-purple-400" />
                              <span>Ver Comprovante</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-zinc-500 italic">
                              Sem anexo
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 font-mono font-black text-sm">
                          <span className={isPaid ? 'text-emerald-400' : 'text-zinc-400'}>
                            R$ {amountVal.toFixed(2)}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                            t.paymentStatus === 'cancelled'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : isPaid
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}>
                            {isPaid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                            <span>{t.paymentStatus === 'cancelled' ? 'Cancelada' : isPaid ? 'Pago (Confirmado)' : 'Pendente de Pagamento'}</span>
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center space-y-1.5">
                          {t.paymentStatus !== 'cancelled' && (
                          <button
                            onClick={() => handleTogglePaymentStatus(t.id)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 mx-auto ${
                              isPaid
                                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/20'
                            }`}
                          >
                            {isPaid ? (
                              <>
                                <History className="w-3.5 h-3.5 text-zinc-400" />
                                <span>Alterar p/ Pendente</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5 text-white" />
                                <span>Baixar Pagamento</span>
                              </>
                            )}
                          </button>
                          )}
                          <div className="flex items-center justify-center gap-1.5">
                            {t.paymentStatus === 'cancelled' ? (
                              <button
                                onClick={() => handleCancelRegistration(t, true)}
                                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold"
                              >
                                Reativar
                              </button>
                            ) : (
                              <button
                                onClick={() => handleCancelRegistration(t)}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-bold"
                              >
                                Cancelar
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteRegistration(t)}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-bold"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                </tbody>
              </table>

              {teams.length === 0 && (
                <div className="p-8 text-center text-zinc-500 space-y-2">
                  <Users className="w-8 h-8 mx-auto text-zinc-600" />
                  <p className="text-xs">Nenhuma inscrição registrada neste campeonato até o momento.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 2. ABA DE ESCALA DE JUÍZES & ARBITRAGEM (CONTROLE DA ORGANIZAÇÃO) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {adminTab === 'judges_staff' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel rounded-3xl p-6 border border-zinc-800">
            <div>
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Gavel className="w-4 h-4" />
                <span>Escala Oficial de Arbitragem</span>
              </div>
              <h3 className="text-xl font-black text-white mt-1">Corpo de Juízes do Campeonato</h3>
              <p className="text-xs text-zinc-400 mt-1">
                A organização define e escala os árbitros que atuarão nas raias. Cada juiz recebe um PIN para autenticação rápida nos tablets da arena.
              </p>
            </div>

            <button
              onClick={() => setIsJudgeModalOpen(true)}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-transform active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Escalar Novo Juiz</span>
            </button>
          </div>

          {/* GRID DE JUÍZES */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {judges.map((j) => (
              <div key={j.id} className="glass-panel rounded-3xl p-5 border border-zinc-800 space-y-4 relative group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 font-black text-sm">
                      {j.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{j.name}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-bold uppercase">
                        {j.role === 'head_judge' ? 'Head Judge' : 'Juiz de Raia'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteJudge(j.id)}
                    className="text-zinc-600 hover:text-red-400 p-1 rounded-lg transition-colors"
                    title="Remover da escala"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      PIN do Tablet:
                    </span>
                    <strong className="text-amber-400 font-mono text-sm tracking-wider">{j.pinCode}</strong>
                  </div>

                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Raias Atribuídas:</span>
                    <strong className="text-white font-mono">
                      {j.assignedLanes.map(l => `Raia #${l}`).join(', ')}
                    </strong>
                  </div>

                  {j.phone && (
                    <div className="flex items-center justify-between text-zinc-400">
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-zinc-500" />
                        Contato:
                      </span>
                      <span className="text-zinc-300">{j.phone}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Credenciado na Arena
                  </span>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`http://localhost:3000/judge?pin=${j.pinCode}`);
                      toast.success(`Link de acesso do Juiz ${j.name} copiado!`);
                    }}
                    className="flex items-center gap-1 text-xs text-zinc-400 hover:text-amber-400 font-semibold transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Link</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 3. ABA DE AUDITORIA & HOMOLOGAÇÃO COM FOTO DA SÚMULA (HEAD JUDGE) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {adminTab === 'audit_center' && (
        <div className="space-y-6">
          <div className="glass-panel rounded-3xl p-6 border border-zinc-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Camera className="w-5 h-5 text-amber-400" />
              Súmulas de Campo & Scores Aguardando Homologação
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scores.map((score) => (
                <div 
                  key={score.id}
                  className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 flex flex-col justify-between gap-4 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-400">{score.registerNumber}</span>
                        <span className="font-bold text-white">{score.teamName}</span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-1">
                        Árbitro: <strong>{score.judgeName}</strong> • Raia: <strong>#{score.lane}</strong> • Bateria: <strong>#{score.heatNumber}</strong>
                      </div>
                      <div className="text-xs text-zinc-300 mt-1 font-semibold">
                        Score: <strong className="text-emerald-400">{score.timeFormatted || `${score.weightLoadedKg || score.repsCount} pts`}</strong>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                        {score.scoreStatus === 'approved_by_head_judge' ? 'Homologado' : 'Aguardando'}
                      </span>
                    </div>
                  </div>

                  {/* FOTO ANEXADA OU ALERTA */}
                  <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                    {score.photoSumulaUrl ? (
                      <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
                        <Check className="w-4 h-4" />
                        Foto da Súmula Anexada
                      </span>
                    ) : (
                      <span className="text-zinc-500 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Sem foto física anexada
                      </span>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApproveScore(score)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-xs border border-emerald-500/40"
                      >
                        Homologar
                      </button>
                      <button
                        onClick={() => {
                          setSelectedAuditScore(score);
                          setAuditNewTime(score.timeFormatted || '');
                          setAuditNewPoints(score.finalPoints || 0);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-bold text-xs border border-zinc-700 flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Auditar</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* LOG IMUTÁVEL DE AUDITORIA */}
          <div className="glass-panel rounded-3xl p-6 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-blue-400" />
              Log Imutável de Auditoria (Trilha de Alterações)
            </h3>

            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{log.changedBy}</span>
                      <span className="text-[10px] px-2 py-0.2 rounded bg-zinc-800 text-zinc-400 uppercase font-bold">
                        {log.role}
                      </span>
                      <span className="text-zinc-400">• {log.action}</span>
                    </div>
                    <div className="text-zinc-400">
                      Motivo: <strong className="text-zinc-200">{log.reason}</strong> • Novo Valor: <strong className="text-emerald-400">{log.newValue}</strong>
                    </div>
                  </div>

                  <div className="text-right text-[10px] text-zinc-500 font-mono whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 4. ABA DO DONO DO SAAS (SUPER ADMIN MONETIZAÇÃO) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {adminTab === 'saas_owner' && userRole === 'SUPER_ADMIN' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-panel-gold rounded-3xl p-5 border border-amber-500/40">
              <div className="text-xs font-bold text-amber-400 uppercase flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" />
                Receita Total da Plataforma (Take Rate)
              </div>
              <div className="text-3xl font-black text-amber-400 mt-2">
                R$ {totalRevenuePlatform.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-zinc-400 mt-1">Taxas automáticas por atleta cadastrado</div>
            </div>

            <div className="glass-panel rounded-3xl p-5 border border-zinc-800">
              <div className="text-xs font-bold text-zinc-400 uppercase flex items-center gap-1.5">
                <Users className="w-4 h-4 text-purple-400" />
                Volume Global de Atletas
              </div>
              <div className="text-3xl font-black text-white mt-2">
                {totalAthletesAllOrgs.toLocaleString('pt-BR')}
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">Base total de participantes</div>
            </div>

            <div className="glass-panel rounded-3xl p-5 border border-zinc-800">
              <div className="text-xs font-bold text-zinc-400 uppercase flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-400" />
                Organizadores & Contratantes
              </div>
              <div className="text-3xl font-black text-white mt-2">
                {organizations.length} Tenancies
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">Contas corporativas ativas</div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: ADICIONAR NOVO WOD */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {isWodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">Novo Workout / WOD do Evento</h3>
              </div>
              <button onClick={() => setIsWodModalOpen(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">Título do WOD</label>
                <input
                  type="text"
                  required
                  value={wodTitle}
                  onChange={(e) => setWodTitle(e.target.value)}
                  placeholder="Ex: WOD 1 - THE SNATCH LADDER"
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">Tipo de Prova</label>
                  <select
                    value={wodType}
                    onChange={(e) => setWodType(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="for_time">For Time (Menor Tempo)</option>
                    <option value="amrap">AMRAP (Mais Repetições)</option>
                    <option value="max_load">Max Load (Carga Máxima)</option>
                    <option value="complex">Complex LPO</option>
                    <option value="hyrox_standard">HYROX Standard (8 Estações)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">Time Cap (Minutos)</label>
                  <input
                    type="number"
                    value={wodTimeCapMins}
                    onChange={(e) => setWodTimeCapMins(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">Descrição dos Exercícios & Cargas</label>
                <textarea
                  rows={4}
                  value={wodDesc}
                  onChange={(e) => setWodDesc(e.target.value)}
                  placeholder="21-15-9 Snatch (60/40kg) + Burpee Over Bar..."
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                onClick={() => setIsWodModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateWorkout}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs shadow-lg shadow-amber-500/20"
              >
                Salvar WOD
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: ESCALAR NOVO JUIZ / ÁRBITRO */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {isJudgeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <form onSubmit={handleCreateJudge} className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-red-400" />
                <h3 className="font-bold text-white text-base">Escalar Árbitro de Arena</h3>
              </div>
              <button type="button" onClick={() => setIsJudgeModalOpen(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">Nome Completo do Árbitro</label>
                <input
                  type="text"
                  required
                  value={judgeName}
                  onChange={(e) => setJudgeName(e.target.value)}
                  placeholder="Ex: Roberto Silveira"
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">Função</label>
                  <select
                    value={judgeRole}
                    onChange={(e) => setJudgeRole(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="floor_judge">Juiz de Raia</option>
                    <option value="head_judge">Head Judge</option>
                    <option value="hyrox_station_judge">Fiscal de Estação HYROX</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">PIN de Acesso (4 Dígitos)</label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    value={judgePin}
                    onChange={(e) => setJudgePin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ex: 1234"
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">Raias Atribuídas (Separadas por vírgula)</label>
                <input
                  type="text"
                  required
                  value={judgeLanes}
                  onChange={(e) => setJudgeLanes(e.target.value)}
                  placeholder="Ex: 1, 2 ou 1, 2, 3, 4"
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">WhatsApp / Telefone</label>
                <input
                  type="text"
                  value={judgePhone}
                  onChange={(e) => setJudgePhone(e.target.value)}
                  placeholder="(11) 98888-7777"
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsJudgeModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-black text-xs shadow-lg"
              >
                Confirmar Escala
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: AUDITORIA SPLIT-SCREEN COM FOTO, ZOOM, ROTAÇÃO E CONFERÊNCIA */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {selectedAuditScore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-5xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] flex flex-col justify-between overflow-y-auto">
            {/* TOPO DO MODAL */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    Mesa de Triagem Split-Screen • Homologação de Súmula
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Atleta: <strong className="text-white">{selectedAuditScore.teamName}</strong> ({selectedAuditScore.registerNumber}) • Raia #{selectedAuditScore.lane} • Bateria #{selectedAuditScore.heatNumber} • Árbitro: {selectedAuditScore.judgeName}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedAuditScore(null)} className="text-zinc-500 hover:text-white text-lg p-1">✕</button>
            </div>

            {/* CONTEÚDO SPLIT SCREEN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* LADO ESQUERDO: FOTO DA SÚMULA FÍSICA */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400 uppercase flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    Comprovante Fotográfico de Campo
                  </span>
                  {selectedAuditScore.photoSumulaUrl && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                      Foto HD Presente
                    </span>
                  )}
                </div>

                {selectedAuditScore.photoSumulaUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/50 flex items-center justify-center min-h-[260px] max-h-[320px]">
                    <img 
                      src={selectedAuditScore.photoSumulaUrl} 
                      alt="Súmula Física" 
                      className="w-full h-full object-contain max-h-[320px]"
                    />
                  </div>
                ) : (
                  <div className="w-full h-64 rounded-xl bg-zinc-900/60 flex flex-col items-center justify-center text-zinc-500 border border-dashed border-zinc-800 p-6 text-center">
                    <Camera className="w-10 h-10 mb-2 text-zinc-600" />
                    <span className="text-xs font-semibold text-zinc-400">Nenhuma foto anexada pelo juiz</span>
                    <span className="text-[11px] text-zinc-600 mt-1">Conferência baseada na assinatura touch e registros do cronômetro</span>
                  </div>
                )}

                <div className="text-[11px] text-zinc-500 text-center">
                  Horário de submissão do campo: {new Date(selectedAuditScore.submittedAt).toLocaleTimeString('pt-BR')}
                </div>
              </div>

              {/* LADO DIREITO: SCORE DIGITADO & RETIFICAÇÃO */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                  <span className="text-xs font-bold text-zinc-400 uppercase">Validação dos Dados da Prova</span>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    Status: {selectedAuditScore.scoreStatus === 'approved_by_head_judge' ? 'Homologado' : 'Em Análise'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 block mb-1">Tempo / Resultado</label>
                    <input
                      type="text"
                      value={auditNewTime}
                      onChange={(e) => setAuditNewTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 block mb-1">Pontuação / Colocação</label>
                    <input
                      type="number"
                      value={auditNewPoints}
                      onChange={(e) => setAuditNewPoints(parseFloat(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500 font-mono font-bold"
                    />
                  </div>
                </div>

                {selectedAuditScore.penaltyNotes && (
                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                    <strong>Penalidades Registradas:</strong> {selectedAuditScore.penaltyNotes} ({selectedAuditScore.penaltiesSeconds}s)
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1">
                    Justificativa Formal da Mesa (Audit Trail):
                  </label>
                  <textarea
                    rows={3}
                    value={auditReason}
                    onChange={(e) => setAuditReason(e.target.value)}
                    placeholder="Ex: Conferido e homologado pelo Head Judge com base na súmula física."
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500 placeholder:text-zinc-600"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      handleApproveScore(selectedAuditScore);
                      setSelectedAuditScore(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-transform active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    <span>HOMOLOGAR COM 1 CLIQUE</span>
                  </button>

                  <button
                    onClick={handleRectifyScore}
                    className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs shadow-lg shadow-amber-500/20 transition-transform active:scale-95"
                  >
                    Salvar Retificação
                  </button>
                </div>
              </div>
            </div>

            {/* RODAPÉ */}
            {/* RODAPÉ */}
            <div className="flex items-center justify-between pt-3 border-t border-zinc-800 text-xs text-zinc-500">
              <span>Todas as homologações geram hash imutável no AuditLog do sistema.</span>
              <button
                onClick={() => setSelectedAuditScore(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: CRIAR NOVO CAMPEONATO REAL (ORGANIZADOR / SUPER ADMIN) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}

      {isNewGameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <form onSubmit={handleCreateGame} className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">{editingGameCode ? 'Editar Campeonato' : 'Criar Novo Campeonato / Evento Real'}</h3>
              </div>
              <button type="button" onClick={() => setIsNewGameModalOpen(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">Código Único (Sem Espaços)</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingGameCode}
                    placeholder="Ex: COPA-CROSS-2026"
                    value={newGameCode}
                    onChange={(e) => setNewGameCode(e.target.value.toUpperCase().replace(/\s+/g, '-'))}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">Tipo de Evento</label>
                  <select
                    value={newGameType}
                    onChange={(e) => setNewGameType(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="crossfit">CrossFit / Fitness Games</option>
                    <option value="hyrox">HYROX / Fitness Racing</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">Nome Oficial do Campeonato</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Copa Paulista de CrossFit 2026"
                  value={newGameName}
                  onChange={(e) => setNewGameName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">Data do Evento</label>
                  <input
                    type="date"
                    required
                    value={newGameDate}
                    onChange={(e) => setNewGameDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">Quantidade de Raias na Arena</label>
                  <input
                    type="number"
                    min={2}
                    max={30}
                    required
                    value={newGameLanes}
                    onChange={(e) => setNewGameLanes(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">Local / Arena</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Ginásio do Ibirapuera - São Paulo / SP"
                  value={newGameLocation}
                  onChange={(e) => setNewGameLocation(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-300 block">Imagem / Banner do Evento</label>

                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                  <div className="font-bold text-zinc-200">Especificação da imagem</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>
                      Formato: <strong className="text-zinc-200">JPG</strong> (também aceita PNG e WebP), original de até 25 MB.
                    </li>
                    <li>
                      Proporção <strong className="text-zinc-200">3:1</strong> (faixa larga). Ideal:{' '}
                      <strong className="text-zinc-200">1920 × 640 px</strong>; mínimo recomendado: 1200 px de largura.
                    </li>
                    <li>
                      Deixe logo e textos importantes no <strong className="text-zinc-200">centro</strong>: o corte é centralizado.
                    </li>
                    <li>Ao enviar, o sistema recorta, reduz para no máximo 1920 px e converte para JPG otimizado (cerca de 500 KB).</li>
                  </ul>
                </div>

                {(newGamePreview || newGameFoto) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={newGamePreview || assetUrl(newGameFoto)}
                    alt="Pré-visualização do banner do campeonato"
                    className="w-full aspect-[3/1] object-cover rounded-xl border border-zinc-700"
                  />
                )}

                <div className="flex items-center gap-2">
                  <label className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-amber-500">
                    Enviar imagem do computador
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={handleBannerFile}
                    />
                  </label>
                </div>

                {newGameBannerInfo && (
                  <div className="text-[11px] space-y-1" role="status">
                    <p className="text-emerald-400">{newGameBannerInfo.summary}</p>
                    {newGameBannerInfo.warning && <p className="text-amber-400">{newGameBannerInfo.warning}</p>}
                  </div>
                )}

                <input
                  type="text"
                  aria-label="URL da imagem hospedada"
                  placeholder="…ou cole a URL de uma imagem hospedada"
                  value={newGameFoto}
                  onChange={(e) => setNewGameFoto(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-zinc-500">A imagem enviada substitui a URL.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
                <span className="text-[11px] font-black uppercase text-amber-400 block">Chave Pix do Campeonato</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-zinc-300 block mb-1">Chave Pix</label>
                    <input
                      type="text"
                      placeholder="CPF/CNPJ, e-mail, +5511999999999 ou aleatória"
                      value={newGamePixKey}
                      onChange={(e) => setNewGamePixKey(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-300 block mb-1">Favorecido (titular)</label>
                    <input
                      type="text"
                      placeholder="Nome que aparece no banco"
                      value={newGamePixBeneficiary}
                      onChange={(e) => setNewGamePixBeneficiary(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500">
                  Digite a chave exatamente como está cadastrada no banco. Ela é usada para gerar o Pix copia e cola e o QR da inscrição.
                </p>
              </div>

              {/* REGRAS DE PONTUAÇÃO & CRITÉRIOS DA ARENA */}
              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
                <span className="text-[11px] font-black uppercase text-amber-400 block">Regras de Pontuação & Exibição</span>
                
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium">Critério de Vitória no Leaderboard:</span>
                  <select
                    value={newGameLowestPoints ? 'lowest' : 'highest'}
                    onChange={(e) => setNewGameLowestPoints(e.target.value === 'lowest')}
                    className="bg-zinc-900 border border-zinc-700 text-xs text-white rounded-lg px-2 py-1"
                  >
                    <option value="highest">Maior Pontuação Ganha (Padrão Pontos)</option>
                    <option value="lowest">Menor Pontuação Ganha (Padrão CrossFit Games)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newGameShowTime}
                      onChange={(e) => setNewGameShowTime(e.target.checked)}
                      className="rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-0"
                    />
                    <span>Exibir Tempo</span>
                  </label>

                  <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newGameShowWeight}
                      onChange={(e) => setNewGameShowWeight(e.target.checked)}
                      className="rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-0"
                    />
                    <span>Exibir Cargas (kg)</span>
                  </label>

                  <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newGameShowReps}
                      onChange={(e) => setNewGameShowReps(e.target.checked)}
                      className="rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-0"
                    />
                    <span>Exibir Repetições</span>
                  </label>

                  <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newGameShowRevision}
                      onChange={(e) => setNewGameShowRevision(e.target.checked)}
                      className="rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-0"
                    />
                    <span>Permitir Revisões</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">Descrição / Informações Gerais</label>
                <textarea
                  rows={2}
                  placeholder="Regras gerais, premiação e cronograma da arena..."
                  value={newGameDesc}
                  onChange={(e) => setNewGameDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsNewGameModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-xs shadow-lg shadow-amber-500/20"
              >
                {editingGameCode ? 'Salvar Alterações' : 'Cadastrar Campeonato no Banco'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: CONFIRMAÇÃO DE EXCLUSÃO EM CASCATA (SUPER ADMIN) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {gameToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-rose-800/80 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Exclusão em Cascata</h3>
                <span className="text-xs text-rose-400 font-mono font-bold">{gameToDelete.code}</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-800/40 text-xs text-zinc-300 space-y-2">
              <p className="font-bold text-rose-300">
                Atenção: Você está prestes a excluir permanentemente o campeonato "{gameToDelete.name}".
              </p>
              <p className="text-[11px] text-zinc-400">
                Esta ação de Super Admin excluirá em cascata do banco de dados PostgreSQL:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-zinc-400">
                <li>Todas as Categorias e regras de idade/gênero</li>
                <li>Todos os WODs, Provas e Súmulas de Evento</li>
                <li>Todas as Inscrições e Atletas vinculados</li>
                <li>Todas as Baterias (Heats) e Raias alocadas</li>
                <li>Todos os Scores, fotos anexadas e Logs de Auditoria</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                disabled={isDeletingGame}
                onClick={() => setGameToDelete(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingGame}
                onClick={handleDeleteGameCascade}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingGame ? 'Excluindo dados...' : 'Confirmar Exclusão em Cascata'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: CRIAR OU EDITAR CATEGORIA (ORGANIZADOR / SUPER ADMIN) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <form onSubmit={handleSaveCategory} className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">
                  {editingCategory ? `Editar Categoria • ${editingCategory.name}` : 'Nova Categoria Oficial do Campeonato'}
                </h3>
              </div>
              <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-zinc-300 block mb-1">Nome da Categoria</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Trio Masculino RX, Master 40+ Individual, Dupla Mista"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Formato da Equipe</label>
                  <select
                    value={catTeamType}
                    onChange={(e) => setCatTeamType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="individual">Individual (1 Atleta)</option>
                    <option value="duo">Dupla (2 Atletas)</option>
                    <option value="trio">Trio (3 Atletas)</option>
                    <option value="quartet">Quarteto (4 Atletas)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Composição de Gênero</label>
                  <select
                    value={catGender}
                    onChange={(e) => setCatGender(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="open">Aberto / Livre</option>
                    <option value="male">Exclusivo Masculino</option>
                    <option value="female">Exclusivo Feminino</option>
                    <option value="mixed_1m_1f">Misto (1 Homem + 1 Mulher)</option>
                    <option value="mixed_2m_2f">Misto (2 Homens + 2 Mulheres)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Taxa de Inscrição por Equipe (R$)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={catAmount}
                  onChange={(e) => setCatAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* REGRAS ETÁRIAS */}
              <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-[11px] font-bold text-amber-400 block uppercase">Regras de Faixa Etária (Opcionais)</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-0.5">Idade Mín (ex: 35+)</label>
                    <input
                      type="number"
                      placeholder="Ex: 35"
                      value={catMinAge}
                      onChange={(e) => setCatMinAge(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-0.5">Idade Máx (ex: 18)</label>
                    <input
                      type="number"
                      placeholder="Ex: 18"
                      value={catMaxAge}
                      onChange={(e) => setCatMaxAge(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-0.5">Soma Mín Time</label>
                    <input
                      type="number"
                      placeholder="Ex: 110"
                      value={catMinSumAge}
                      onChange={(e) => setCatMinSumAge(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-xs"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Padrões de Movimento / Standards</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Clean & Jerk (60/40kg), Pull-ups, Box Jump 24/20..."
                  value={catStandards}
                  onChange={(e) => setCatStandards(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-xs shadow-lg shadow-amber-500/20"
              >
                {editingCategory ? 'Salvar Alterações da Categoria' : 'Cadastrar Categoria no Campeonato'}
              </button>
            </div>
          </form>
        </div>
      )}

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* MODAL DO ORGANIZADOR: VISUALIZAR COMPROVANTE & BAIXAR PAGAMENTO */}
        {/* ────────────────────────────────────────────────────────────────────────── */}
        {selectedProofTeam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="bg-zinc-900 border border-purple-500/40 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Comprovante de Pagamento do Atleta</h3>
                    <p className="text-xs text-zinc-400 font-mono">
                      Inscrição: {selectedProofTeam.registerNumber} • {selectedProofTeam.teamName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProofTeam(null)}
                  className="text-zinc-500 hover:text-white text-sm p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                {/* DADOS DA EQUIPE / INSCRIÇÃO */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">Categoria</span>
                    <strong className="text-zinc-200">{selectedProofTeam.categoryName || selectedProofTeam.categoryId}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">Valor da Inscrição</span>
                    <strong className="text-emerald-400 font-mono">
                      R$ {Number(selectedProofTeam.amountPaid || 150).toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">Status Atual</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedProofTeam.paymentStatus === 'paid'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {selectedProofTeam.paymentStatus === 'paid' ? 'Pago (Liberado)' : 'Aguardando Baixa'}
                    </span>
                  </div>
                </div>

                {/* VISUALIZAÇÃO DO COMPROVANTE ANEXADO */}
                <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-center">
                  {selectedProofTeam.proofOfPaymentUrl ? (
                    selectedProofTeam.proofOfPaymentUrl.startsWith('data:image') || selectedProofTeam.proofOfPaymentUrl.startsWith('http') ? (
                      <img
                        src={selectedProofTeam.proofOfPaymentUrl}
                        alt="Comprovante Pix"
                        className="max-h-80 mx-auto rounded-xl object-contain border border-zinc-700 shadow-md"
                      />
                    ) : (
                      <div className="p-4 bg-zinc-900 rounded-xl text-left space-y-1.5">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase block">Código / Autenticação Pix Informada pelo Atleta:</span>
                        <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-amber-300 break-all select-all font-bold">
                          {selectedProofTeam.proofOfPaymentUrl}
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="p-6 text-zinc-500 text-xs">
                      O atleta ainda não anexou foto ou código do comprovante.
                    </div>
                  )}
                </div>

                {selectedProofTeam.proofUploadedAt && (
                  <div className="text-[11px] text-zinc-400 flex items-center justify-between px-2">
                    <span>Data/Hora do Envio pelo Atleta:</span>
                    <strong className="text-zinc-200">
                      {new Date(selectedProofTeam.proofUploadedAt).toLocaleString('pt-BR')}
                    </strong>
                  </div>
                )}
              </div>

              {/* AÇÕES DO ORGANIZADOR */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSelectedProofTeam(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  Fechar
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleTogglePaymentStatus(selectedProofTeam.id);
                    }}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg flex items-center gap-2 transition-all active:scale-95 ${
                      selectedProofTeam.paymentStatus === 'paid'
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-black shadow-emerald-500/20'
                    }`}
                  >
                    {selectedProofTeam.paymentStatus === 'paid' ? (
                      <>
                        <History className="w-4 h-4 text-zinc-400" />
                        <span>Alterar para Pendente</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 text-black" />
                        <span>Baixar Pagamento & Liberar Atleta Imediatamente</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {organizersGame && (
        <GameOrganizersModal
          game={organizersGame}
          onClose={() => setOrganizersGame(null)}
          onChanged={() => loadData()}
        />
      )}

      <BackupRestoreModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onSuccess={() => loadData()}
      />
      </div>
    </AclGuard>
  );
}



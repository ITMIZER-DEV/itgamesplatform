'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Printer, 
  Download, 
  Eye, 
  Edit3, 
  Sparkles, 
  Layers, 
  Users, 
  Filter,
  CheckCircle,
  Copy,
  ChevronRight,
  Flame,
  Plus,
  Save,
  RotateCcw,
  Tag,
  Dumbbell,
  ShieldCheck,
  Layout,
  Code,
  Trash2,
  Link2,
  Trophy,
  Sliders,
  Camera,
  Image as ImageIcon,
  AlertTriangle,
  ZoomIn,
  Check,
  X,
  FileCheck
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { useGames } from '@/lib/use-games';
import { apiClient } from '@/lib/api-client';
import { GameEvent, Category, WorkoutRule, TeamRegistration, Heat, SumulaTemplate, WorkoutType, EventType, ScoreEntry } from '@/types';
import { replaceSumulaVariables, DEFAULT_SUMULA_TEMPLATES } from '@/lib/sumula-presets';
import { OFFICIAL_WOD_PRESETS, WodPreset } from '@/lib/wod-presets';
import { toast } from 'sonner';
import { AclGuard } from '@/components/auth/AclGuard';

export default function SumulasStudioPage() {
  const { games, activeGame } = useGames();
  const [categories, setCategories] = useState<Category[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutRule[]>([]);
  const [teams, setTeams] = useState<TeamRegistration[]>([]);
  const [heats, setHeats] = useState<Heat[]>([]);
  const [templates, setTemplates] = useState<SumulaTemplate[]>([]);
  const [scores, setScores] = useState<ScoreEntry[]>([]);

  // Aba ativa: 'print_batch' | 'template_studio' | 'wod_builder' | 'head_judge_desk'
  const [activeTab, setActiveTab] = useState<'print_batch' | 'template_studio' | 'wod_builder' | 'head_judge_desk'>('print_batch');

  // Estados da Mesa do Head Judge
  const [zoomPhotoUrl, setZoomPhotoUrl] = useState<string | null>(null);
  const [deskHeatNumber, setDeskHeatNumber] = useState<string>('1');
  const [deskScoresState, setDeskScoresState] = useState<Record<string, {
    time: string;
    isCap: boolean;
    reps: string;
    weightA: string;
    weightB: string;
    rounds: number;
    tiebreak: string;
    photoUrl: string | null;
  }>>({});

  // Filtros de Impressão
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>('');
  const [selectedHeatNumber, setSelectedHeatNumber] = useState<string>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Estados do Editor de Template de Súmula
  const [editingTemplateId, setEditingTemplateId] = useState<string>('');
  const [editingTemplateName, setEditingTemplateName] = useState<string>('');
  const [editingHtmlContent, setEditingHtmlContent] = useState<string>('');
  const [editingEventType, setEditingEventType] = useState<EventType>('crossfit');
  const [editingGameId, setEditingGameId] = useState<string>('');
  const [editingCategoryId, setEditingCategoryId] = useState<string>('');
  const [editingWorkoutId, setEditingWorkoutId] = useState<string>('');

  // Estados do Construtor de WODs
  const [wodCategoryId, setWodCategoryId] = useState<string>('');
  const [wodTitle, setWodTitle] = useState<string>('');
  const [wodType, setWodType] = useState<WorkoutType>('for_time');
  const [wodTimeCapMinutes, setWodTimeCapMinutes] = useState<number>(12);
  const [wodDescription, setWodDescription] = useState<string>('');
  const [wodStandards, setWodStandards] = useState<string>('');
  const [wodTieBreak, setWodTieBreak] = useState<'time' | 'reps' | 'none'>('time');

  const printContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    storage.initDefaultsIfEmpty();

    const loadData = async () => {
      const game = activeGame;

      if (game) {
        const gId = game.code || game.id;
        let cats = storage.getCategories(game.id);
        let wods = storage.getWorkouts(game.id);
        let tms = storage.getTeams(game.id);
        let hts = storage.getHeats(game.id);
        let tmpls = storage.getSumulaTemplates();

        try {
          const [apiCats, apiWods, apiRegs, apiTmpls] = await Promise.all([
            apiClient.listCategories(gId).catch(() => null),
            apiClient.listWorkouts(gId).catch(() => null),
            apiClient.listRegistrations(gId).catch(() => null),
            apiClient.getSumulaTemplates().catch(() => null),
          ]);

          if (apiTmpls && apiTmpls.length > 0) {
            const byId = new Map(tmpls.map((t) => [t.id, t]));
            for (const t of apiTmpls) {
              byId.set(t.id, t);
              storage.saveSumulaTemplate(t);
            }
            tmpls = Array.from(byId.values());
          }

          if (apiCats && apiCats.length > 0) {
            cats = apiCats.map((c: any) => ({
              id: String(c.code),
              gameId: c.gamesId,
              name: c.name,
              gender: c.genderRule || 'open',
              genderRule: c.genderRule || 'open',
              genderComposition: c.genderRule || 'open',
              teamFormat: c.teamType || 'individual',
              maxAthletes: c.maxAthlete || 1,
              maxAthlete: c.maxAthlete || 1,
              maxAthletesPerTeam: c.maxAthlete || 1,
              price: c.amount || 0,
              priceBrl: c.amount || 0,
              description: c.description || '',
              standards: c.standards || '',
              spotsTotal: c.maxRegistrations || 100,
              spotsFilled: c.registrationsCount || 0,
              maxRegistrations: c.maxRegistrations ?? null,
              registrationsCount: c.registrationsCount ?? 0,
            })) as any;
            storage.setCategoriesForGame(game.id, cats);
          }

          if (apiWods && apiWods.length > 0) {
            wods = apiWods.map((w: any) => ({
              id: String(w.code),
              gameId: w.game,
              gameName: game.name,
              categoryId: String(w.category),
              categoryIds: [String(w.category)],
              categoryNames: [cats.find(c => c.id === String(w.category))?.name || `Categoria ${w.category}`],
              categoryName: cats.find(c => c.id === String(w.category))?.name || `Categoria ${w.category}`,
              title: w.title || `WOD ${w.code}`,
              type: w.type || 'for_time',
              timeCapSeconds: 21 * 60,
              description: w.description || '',
              sumulaTemplateId: w.sumulaTemplate || 'crossfit-wod1-combo-row-deathby',
              sumulaTemplateName: tmpls.find(t => t.id === w.sumulaTemplate)?.name || 'Súmula Padrão A4',
              movementStandards: [],
              pointsScale: 'standard_100',
            })) as any;
          }

          if (apiRegs && apiRegs.length > 0) {
            tms = apiRegs.map((r: any) => ({
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
              })),
            })) as any;
            storage.setTeamsForGame(game.id, tms);
          }
        } catch (err) {
          console.warn('[Sumulas] Fallback para storage local', err);
        }

        setCategories(cats);
        setWorkouts(wods);
        setTeams(tms);
        setHeats(hts);
        setTemplates(tmpls);
        const scs = storage.getScores(game.id);
        setScores(scs);

        // Priorizar categoria 2 (Iniciante Dupla Feminina) se disponível
        const defaultCat = cats.find(c => c.id === '2') || cats[0];
        if (cats.length > 0 && !selectedCategoryId) {
          setSelectedCategoryId(defaultCat?.id || cats[0].id);
          setWodCategoryId(defaultCat?.id || cats[0].id);
        }
        if (wods.length > 0 && !selectedWorkoutId) {
          setSelectedWorkoutId(wods[0].id);
        }
        if (tmpls.length > 0 && !selectedTemplateId) {
          const comboTmpl = tmpls.find(t => t.id === 'crossfit-wod1-combo-row-deathby');
          const defaultTmpl = comboTmpl || tmpls.find(t => t.type === game.eventType) || tmpls[0];
          setSelectedTemplateId(defaultTmpl.id);
          setEditingTemplateId(defaultTmpl.id);
          setEditingTemplateName(defaultTmpl.name);
          setEditingHtmlContent(defaultTmpl.htmlContent);
          setEditingEventType(defaultTmpl.type || 'crossfit');
          setEditingGameId(defaultTmpl.gameId || '');
          setEditingCategoryId(defaultTmpl.categoryId || '');
          setEditingWorkoutId(defaultTmpl.workoutId || '');
        }

        // Pré-seleção via URL Query Params (vindo do painel de governança /admin)
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const qWod = params.get('workoutId');
          const qCat = params.get('categoryId');
          const qTmpl = params.get('templateId');
          const qTab = params.get('tab');

          if (qTab === 'head_judge_desk' || qTab === 'template_studio' || qTab === 'wod_builder' || qTab === 'print_batch') {
            setActiveTab(qTab);
          }

          if (qWod && wods.some(w => w.id === qWod)) {
            setSelectedWorkoutId(qWod);
            const targetWod = wods.find(w => w.id === qWod);
            if (targetWod) {
              if (targetWod.categoryId && cats.some(c => c.id === targetWod.categoryId)) {
                setSelectedCategoryId(targetWod.categoryId);
                setWodCategoryId(targetWod.categoryId);
              }
              if (targetWod.sumulaTemplateId && tmpls.some(t => t.id === targetWod.sumulaTemplateId)) {
                setSelectedTemplateId(targetWod.sumulaTemplateId);
              }
            }
          }
          if (qCat && cats.some(c => c.id === qCat)) {
            setSelectedCategoryId(qCat);
            setWodCategoryId(qCat);
          }
          if (qTmpl && tmpls.some(t => t.id === qTmpl)) {
            setSelectedTemplateId(qTmpl);
          }
        }
      }
    };

    loadData();
    window.addEventListener('itgames_storage_updated', loadData);
    return () => window.removeEventListener('itgames_storage_updated', loadData);
  }, [activeGame]);

  const currentCategory = categories.find(c => c.id === selectedCategoryId) || categories[0];
  const categoryWorkouts = workouts.filter(w => !w.categoryId || w.categoryId === currentCategory?.id || w.categoryIds?.includes(currentCategory?.id));
  const currentWorkout = categoryWorkouts.find(w => w.id === selectedWorkoutId) || workouts.find(w => w.id === selectedWorkoutId) || categoryWorkouts[0] || workouts[0];
  const currentTemplate = templates.find(t => t.id === selectedTemplateId) || templates.find(t => t.id === 'crossfit-wod1-combo-row-deathby') || templates[0];

  const filteredTeams = teams.filter(t => t.categoryId === currentCategory?.id && t.paymentStatus !== 'cancelled');
  const workoutHeats = heats.filter(h => h.workoutId === currentWorkout?.id);

  // Mapear itens para impressão em lote
  interface SumulaItemData {
    team: TeamRegistration;
    heatNumber: number | string;
    laneNumber: number | string;
    heatTime: string;
  }

  const sumulasToPrint: SumulaItemData[] = [];

  if (workoutHeats.length > 0) {
    workoutHeats.forEach(heat => {
      if (selectedHeatNumber === 'all' || selectedHeatNumber === String(heat.heatNumber)) {
        heat.laneAssignments.forEach(lane => {
          const team = filteredTeams.find(t => t.id === lane.registrationId);
          if (team) {
            sumulasToPrint.push({
              team,
              heatNumber: heat.heatNumber,
              laneNumber: lane.lane,
              heatTime: heat.startTime
            });
          }
        });
      }
    });
  } else {
    const lanesPerHeat = activeGame?.lanesCount || 4;
    filteredTeams.forEach((team, idx) => {
      const heatNum = Math.floor(idx / lanesPerHeat) + 1;
      const laneNum = (idx % lanesPerHeat) + 1;
      if (selectedHeatNumber === 'all' || selectedHeatNumber === String(heatNum)) {
        sumulasToPrint.push({
          team,
          heatNumber: heatNum,
          laneNumber: laneNum,
          heatTime: `${String(8 + Math.floor((idx * 25) / 60)).padStart(2, '0')}:${String((idx * 25) % 60).padStart(2, '0')}`
        });
      }
    });
  }

  // Baterias e Raias da Categoria para a Mesa do Head Judge
  const allCategoryLanes: SumulaItemData[] = [];
  if (workoutHeats.length > 0) {
    workoutHeats.forEach(heat => {
      heat.laneAssignments.forEach(lane => {
        const team = filteredTeams.find(t => t.id === lane.registrationId);
        if (team) {
          allCategoryLanes.push({
            team,
            heatNumber: heat.heatNumber,
            laneNumber: lane.lane,
            heatTime: heat.startTime
          });
        }
      });
    });
  } else {
    const lanesPerHeat = activeGame?.lanesCount || 4;
    filteredTeams.forEach((team, idx) => {
      const heatNum = Math.floor(idx / lanesPerHeat) + 1;
      const laneNum = (idx % lanesPerHeat) + 1;
      allCategoryLanes.push({
        team,
        heatNumber: heatNum,
        laneNumber: laneNum,
        heatTime: `${String(8 + Math.floor((idx * 25) / 60)).padStart(2, '0')}:${String((idx * 25) % 60).padStart(2, '0')}`
      });
    });
  }

  const distinctHeats = Array.from(new Set(allCategoryLanes.map(item => Number(item.heatNumber)))).sort((a, b) => a - b);
  const activeDeskHeatLanes = allCategoryLanes.filter(item => String(item.heatNumber) === String(deskHeatNumber));
  const deskHeatHomologatedCount = activeDeskHeatLanes.filter(item => {
    return scores.some(s => s.workoutId === currentWorkout?.id && s.registrationId === item.team.id && s.scoreStatus === 'approved_by_head_judge');
  }).length;

  // Tags disponíveis para inserção com 1 clique
  const AVAILABLE_TAGS = [
    { tag: '#GAMENAME#', label: 'Nome do Evento' },
    { tag: '#CATEGORYNAME#', label: 'Categoria' },
    { tag: '#REGISTERNUMBER#', label: 'Nº Inscrição (BIB)' },
    { tag: '#TEAMNAME#', label: 'Equipe / Atleta' },
    { tag: '#ATHLETES_LIST#', label: 'Lista de Atletas' },
    { tag: '#BOX_AFFILIATE#', label: 'Box / Afiliação' },
    { tag: '#EVENTTITLE#', label: 'Título do WOD' },
    { tag: '#WORKOUT_DESCRIPTION#', label: 'Descrição da Prova' },
    { tag: '#TIME_CAP#', label: 'Time Cap' },
    { tag: '#TIE_BREAK_RULE#', label: 'Critério Tie-break' },
    { tag: '#HEAT_NUMBER#', label: 'Nº Bateria' },
    { tag: '#LANE_NUMBER#', label: 'Nº Raia' },
    { tag: '#HEAT_TIME#', label: 'Horário Previsto' }
  ];

  const handleInsertTag = (tag: string) => {
    setEditingHtmlContent(prev => prev + `\n<span style="font-weight: bold; color: #d97706;">${tag}</span>`);
    toast.info(`Tag ${tag} inserida no template!`);
  };

  const handleSelectTemplateForEdit = (templateId: string) => {
    const tmpl = templates.find(t => t.id === templateId);
    if (tmpl) {
      setEditingTemplateId(tmpl.id);
      setEditingTemplateName(tmpl.name);
      setEditingHtmlContent(tmpl.htmlContent);
      setEditingEventType(tmpl.type || 'crossfit');
      setEditingGameId(tmpl.gameId || '');
      setEditingCategoryId(tmpl.categoryId || '');
      setEditingWorkoutId(tmpl.workoutId || '');
    }
  };

  // DUPLICAR SÚMULA
  const handleDuplicateTemplate = (targetTemplate?: SumulaTemplate) => {
    const base = targetTemplate || templates.find(t => t.id === editingTemplateId) || templates[0];
    if (!base) return;

    const newId = `template_dup_${Date.now()}`;
    const duplicated: SumulaTemplate = {
      id: newId,
      name: `${base.name} (Cópia)`,
      type: base.type,
      workoutType: base.workoutType,
      gameId: activeGame?.id || base.gameId,
      categoryId: selectedCategoryId || base.categoryId,
      workoutId: selectedWorkoutId || base.workoutId,
      htmlContent: base.htmlContent,
      isDefault: false,
      createdAt: new Date().toISOString()
    };

    storage.saveSumulaTemplate(duplicated);
    const updated = storage.getSumulaTemplates();
    setTemplates(updated);

    // Selecionar imediatamente para edição
    setEditingTemplateId(duplicated.id);
    setEditingTemplateName(duplicated.name);
    setEditingHtmlContent(duplicated.htmlContent);
    setEditingEventType(duplicated.type);
    setEditingGameId(duplicated.gameId || '');
    setEditingCategoryId(duplicated.categoryId || '');
    setEditingWorkoutId(duplicated.workoutId || '');
    setSelectedTemplateId(duplicated.id);

    setActiveTab('template_studio');
    toast.success(`Súmula duplicada como "${duplicated.name}" e pronta para edição!`);
  };

  // CRIAR NOVA SÚMULA EM BRANCO
  const handleCreateNewTemplate = () => {
    const newId = `template_new_${Date.now()}`;
    const defaultNewHtml = `<div style="font-family: Arial, sans-serif; font-size: 13px; color: #111827; border: 2px solid #111827; padding: 20px; border-radius: 8px; background: #ffffff;">
  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 16px;">
    <div>
      <h2 style="margin: 0; font-size: 18px; font-weight: 900; text-transform: uppercase;">#GAMENAME#</h2>
      <p style="margin: 3px 0 0 0; font-size: 13px; color: #4b5563; font-weight: bold;">CATEGORIA: #CATEGORYNAME#</p>
    </div>
    <div style="text-align: right; background: #f3f4f6; padding: 8px 14px; border-radius: 6px; border: 1px solid #d1d5db;">
      <div style="font-size: 11px; font-weight: bold; color: #6b7280; text-transform: uppercase;">BATERIA / RAIA</div>
      <div style="font-size: 16px; font-weight: 900; color: #111827;">HEAT #HEAT_NUMBER# • RAIA #LANE_NUMBER#</div>
    </div>
  </div>

  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin-bottom: 16px;">
    <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
      <tr>
        <td style="padding: 4px; font-weight: bold; width: 120px;">ATLETA / EQUIPE:</td>
        <td style="padding: 4px; font-size: 14px; font-weight: 900;">#TEAMNAME# (#REGISTERNUMBER#)</td>
      </tr>
      <tr>
        <td style="padding: 4px; font-weight: bold;">BOX / AFILIAÇÃO:</td>
        <td style="padding: 4px;">#BOX_AFFILIATE#</td>
      </tr>
      <tr>
        <td style="padding: 4px; font-weight: bold;">INTEGRANTES:</td>
        <td style="padding: 4px;">#ATHLETES_LIST#</td>
      </tr>
    </table>
  </div>

  <div style="border: 1px solid #111827; border-radius: 6px; padding: 12px; margin-bottom: 16px;">
    <h3 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 900; text-transform: uppercase; color: #b45309;">#EVENTTITLE#</h3>
    <div style="font-size: 12px; white-space: pre-line; line-height: 1.5; color: #374151;">#WORKOUT_DESCRIPTION#</div>
    <div style="margin-top: 8px; font-size: 11px; font-weight: bold; color: #6b7280;">TIME CAP: #TIME_CAP# | TIE-BREAK: #TIE_BREAK_RULE#</div>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; text-align: center;">
    <thead>
      <tr style="background: #111827; color: #ffffff;">
        <th style="padding: 8px; border: 1px solid #111827;">ROUND</th>
        <th style="padding: 8px; border: 1px solid #111827;">REPETIÇÕES</th>
        <th style="padding: 8px; border: 1px solid #111827;">SPLIT TIME</th>
        <th style="padding: 8px; border: 1px solid #111827;">VISTO JUIZ</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 10px; border: 1px solid #d1d5db; font-weight: bold;">ROUND 1</td>
        <td style="padding: 10px; border: 1px solid #d1d5db;"></td>
        <td style="padding: 10px; border: 1px solid #d1d5db;"></td>
        <td style="padding: 10px; border: 1px solid #d1d5db;"></td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #d1d5db; font-weight: bold;">ROUND 2</td>
        <td style="padding: 10px; border: 1px solid #d1d5db;"></td>
        <td style="padding: 10px; border: 1px solid #d1d5db;"></td>
        <td style="padding: 10px; border: 1px solid #d1d5db;"></td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #d1d5db; font-weight: bold;">ROUND 3</td>
        <td style="padding: 10px; border: 1px solid #d1d5db;"></td>
        <td style="padding: 10px; border: 1px solid #d1d5db;"></td>
        <td style="padding: 10px; border: 1px solid #d1d5db;"></td>
      </tr>
    </tbody>
  </table>

  <div style="display: flex; justify-content: space-between; margin-top: 24px; padding-top: 14px; border-top: 2px dashed #9ca3af; font-size: 12px;">
    <div style="width: 45%; text-align: center;">
      <div style="border-bottom: 1px solid #000000; height: 35px; margin-bottom: 6px;"></div>
      <strong>Assinatura do Juiz de Raia</strong>
    </div>
    <div style="width: 45%; text-align: center;">
      <div style="border-bottom: 1px solid #000000; height: 35px; margin-bottom: 6px;"></div>
      <strong>Assinatura do Capitão / Atleta</strong>
    </div>
  </div>
</div>`;

    const newTemplate: SumulaTemplate = {
      id: newId,
      name: `Nova Súmula - ${activeGame?.name || 'Personalizada'}`,
      type: activeGame?.eventType || 'crossfit',
      workoutType: 'for_time',
      gameId: activeGame?.id || '',
      categoryId: selectedCategoryId || '',
      workoutId: selectedWorkoutId || '',
      htmlContent: defaultNewHtml,
      isDefault: false,
      createdAt: new Date().toISOString()
    };

    storage.saveSumulaTemplate(newTemplate);
    const updated = storage.getSumulaTemplates();
    setTemplates(updated);

    setEditingTemplateId(newTemplate.id);
    setEditingTemplateName(newTemplate.name);
    setEditingHtmlContent(newTemplate.htmlContent);
    setEditingEventType(newTemplate.type);
    setEditingGameId(newTemplate.gameId || '');
    setEditingCategoryId(newTemplate.categoryId || '');
    setEditingWorkoutId(newTemplate.workoutId || '');
    setSelectedTemplateId(newTemplate.id);

    setActiveTab('template_studio');
    toast.success('Nova Súmula criada com sucesso! Vincule a um WOD ou Categoria abaixo.');
  };

  // EXCLUIR TEMPLATE
  const handleDeleteTemplate = (templateId: string) => {
    const tmpl = templates.find(t => t.id === templateId);
    if (!tmpl) return;

    if (templates.length <= 1) {
      toast.error('É necessário manter ao menos 1 template no sistema.');
      return;
    }

    storage.deleteSumulaTemplate(templateId);
    apiClient.deleteSumulaTemplate(templateId).catch(() => null);
    const updated = storage.getSumulaTemplates();
    setTemplates(updated);

    const nextTmpl = updated[0];
    if (nextTmpl) {
      handleSelectTemplateForEdit(nextTmpl.id);
      setSelectedTemplateId(nextTmpl.id);
    }

    toast.success(`Template "${tmpl.name}" excluído com sucesso!`);
  };

  // SALVAR TEMPLATE
  const handleSaveTemplate = async () => {
    if (!editingTemplateName.trim()) {
      toast.error('Informe o nome do template');
      return;
    }

    const updatedTemplate: SumulaTemplate = {
      id: editingTemplateId || `template_${Date.now()}`,
      name: editingTemplateName,
      type: editingEventType,
      workoutType: 'for_time',
      gameId: editingGameId || undefined,
      categoryId: editingCategoryId || undefined,
      workoutId: editingWorkoutId || undefined,
      htmlContent: editingHtmlContent,
      isDefault: false,
      createdAt: new Date().toISOString()
    };

    try {
      await apiClient.saveSumulaTemplate(updatedTemplate);
      storage.saveSumulaTemplate(updatedTemplate);
      setEditingTemplateId(updatedTemplate.id);
      setTemplates(storage.getSumulaTemplates());
      toast.success('Template de Súmula salvo no banco com sucesso!');
    } catch {
      storage.saveSumulaTemplate(updatedTemplate);
      setEditingTemplateId(updatedTemplate.id);
      setTemplates(storage.getSumulaTemplates());
      toast.error('Salvo localmente, mas houve erro ao sincronizar com o banco.');
    }
  };

  // Carregar preset de WOD no construtor
  const handleLoadWodPreset = (preset: WodPreset) => {
    setWodTitle(preset.defaultTitle);
    setWodType(preset.type);
    setWodTimeCapMinutes(preset.defaultTimeCapMinutes);
    setWodDescription(preset.description);
    setWodStandards(preset.standards.join('\n'));
    setSelectedTemplateId(preset.suggestedSumulaTemplateId);
    toast.success(`Preset "${preset.name}" carregado no formulário!`);
  };

  // Salvar novo WOD criado
  const handleSaveWod = () => {
    if (!activeGame || !wodTitle.trim() || !wodDescription.trim()) {
      toast.error('Preencha o título e a descrição do WOD');
      return;
    }

    const newWod: WorkoutRule = {
      id: `wod_${Date.now()}`,
      gameId: activeGame.id,
      categoryId: wodCategoryId || categories[0]?.id,
      title: wodTitle,
      type: wodType,
      timeCapSeconds: wodTimeCapMinutes * 60,
      description: wodDescription,
      movementStandards: wodStandards.split('\n').filter(s => s.trim()),
      tieBreakMetric: wodTieBreak,
      pointsScale: 'standard_100'
    };

    storage.saveWorkout(newWod);
    setWorkouts(storage.getWorkouts(activeGame.id));
    toast.success(`WOD "${newWod.title}" criado e vinculado com sucesso!`);
    setActiveTab('print_batch');
  };

  // Helper para buscar nome do vínculo
  const getGameName = (id?: string) => games.find(g => g.id === id)?.name;
  const getCatName = (id?: string) => categories.find(c => c.id === id)?.name;
  const getWodName = (id?: string) => workouts.find(w => w.id === id)?.title;

  // Upload e leitura de foto da súmula em Base64
  const handlePhotoUpload = (regId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('O arquivo selecionado deve ser uma imagem (JPG, PNG, WEBP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setDeskScoresState(prev => ({
        ...prev,
        [regId]: {
          ...(prev[regId] || {
            time: '04:30',
            isCap: false,
            reps: '0',
            weightA: '0',
            weightB: '0',
            rounds: 3,
            tiebreak: '',
            photoUrl: null
          }),
          photoUrl: base64
        }
      }));
      toast.success('Foto da súmula física anexada com sucesso!');
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateDeskField = (regId: string, field: string, value: any) => {
    setDeskScoresState(prev => ({
      ...prev,
      [regId]: {
        ...(prev[regId] || {
          time: '04:30',
          isCap: false,
          reps: '0',
          weightA: '0',
          weightB: '0',
          rounds: 3,
          tiebreak: '',
          photoUrl: null
        }),
        [field]: value
      }
    }));
  };

  const handleHomologateScore = async (team: TeamRegistration, laneNum: number, heatNum: number) => {
    const state = deskScoresState[team.id];
    if (!state?.photoUrl) {
      toast.error('REGRA OBRIGATÓRIA: Anexe a foto da súmula física assinada antes de homologar!', {
        duration: 5000,
        icon: '⚠️'
      });
      return;
    }

    if (!currentWorkout || !activeGame) return;

    const isWod1A = currentWorkout.title.includes('1-A') || currentWorkout.title.toLowerCase().includes('row') || currentWorkout.title.toLowerCase().includes('remo');
    const isWod1B = currentWorkout.title.includes('1-B') || currentWorkout.title.toLowerCase().includes('death by');
    const isWod3 = currentWorkout.title.includes('3') || currentWorkout.title.toLowerCase().includes('hang clean') || currentWorkout.title.toLowerCase().includes('lift') || currentWorkout.type === 'max_load' || currentWorkout.type === 'complex';

    let timeFormatted: string | undefined = undefined;
    let timeSeconds: number | undefined = undefined;
    let repsCount: number | undefined = undefined;
    let roundsCount: number | undefined = undefined;
    let weightLoadedKg: number | undefined = undefined;
    let isCompleted = true;

    if (isWod1A) {
      if (state.isCap) {
        isCompleted = false;
        const missingMeters = Number(state.reps) || 0;
        timeFormatted = `CAP +${missingMeters}m`;
        timeSeconds = 5 * 60 + missingMeters;
        repsCount = missingMeters;
      } else {
        timeFormatted = state.time || '04:30';
        const parts = (timeFormatted || '0:0').split(':').map(Number);
        timeSeconds = (parts[0] || 0) * 60 + (parts[1] || 0);
      }
    } else if (isWod1B) {
      roundsCount = state.rounds ?? 3;
      timeFormatted = `${roundsCount} rounds`;
      timeSeconds = 21 * 60;
      repsCount = Number(state.reps) || 0;
      isCompleted = roundsCount === 5;
    } else if (isWod3) {
      const wA = Number(state.weightA) || 0;
      const wB = Number(state.weightB) || 0;
      weightLoadedKg = wA + wB;
      timeFormatted = `${weightLoadedKg} kg`;
    } else {
      if (state.isCap) {
        isCompleted = false;
        const missingReps = Number(state.reps) || 0;
        timeFormatted = `CAP +${missingReps}`;
        timeSeconds = 10 * 60 + missingReps;
        repsCount = missingReps;
      } else {
        timeFormatted = state.time || '08:30';
        const parts = (timeFormatted || '0:0').split(':').map(Number);
        timeSeconds = (parts[0] || 0) * 60 + (parts[1] || 0);
      }
    }

    const targetTeamName = team.teamName || (team as any).name || 'Equipe';

    const newScore: ScoreEntry = {
      id: `score_${activeGame.id}_${currentWorkout.id}_${team.id}`,
      gameId: activeGame.id,
      workoutId: currentWorkout.id,
      categoryId: team.categoryId,
      registrationId: team.id,
      teamName: targetTeamName,
      registerNumber: team.registerNumber || team.id,
      heatNumber: heatNum,
      lane: laneNum,
      judgeName: 'Head Judge Oficial',
      timeFormatted,
      timeSeconds,
      repsCount,
      roundsCount,
      weightLoadedKg,
      tieBreakTimeFormatted: state.tiebreak || undefined,
      isCompleted,
      isWO: false,
      isDisqualified: false,
      photoSumulaUrl: state.photoUrl,
      scoreStatus: 'approved_by_head_judge',
      approvedBy: 'Head Judge Oficial',
      approvedAt: new Date().toISOString(),
      submittedAt: new Date().toISOString()
    };

    storage.saveScore(newScore, 'Head Judge Oficial', 'head_judge', `Homologação de súmula física com foto comprovatória`);
    setScores(storage.getScores(activeGame.id));

    try {
      await apiClient.submitScore({
        game: activeGame.code || activeGame.id,
        category: Number(team.categoryId) || 1,
        codeTeam: Number(team.id) || 1,
        idEvent: Number(currentWorkout.id) || 1,
        time: timeSeconds,
        reps: repsCount,
        weight: weightLoadedKg,
        tieBreakTime: state.tiebreak ? 100 : undefined,
        scoreStatus: 'approved_by_head_judge',
        photo: state.photoUrl
      });
    } catch (e) {
      console.warn('Persistência remota da API não executada ou offline, score salvo localmente com sucesso.');
    }

    toast.success(`Súmula da equipe ${targetTeamName} (Raia ${laneNum}) HOMOLOGADA com foto! Placar atualizado.`, {
      icon: '✅'
    });
  };

  return (
    <AclGuard resource="sumulas" requiredRoleLabel="Organizadores e Mesa Técnica">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {(!activeGame || categories.length === 0) && (
        <div className="no-print p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
          {activeGame
            ? 'Os dados deste campeonato (categorias, WODs, equipes e baterias) ainda não estão disponíveis nesta tela.'
            : 'Nenhum campeonato disponível.'}
        </div>
      )}

      {/* CABEÇALHO PRINCIPAL DO ESTÚDIO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6 no-print">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Estúdio Profissional de Súmulas & WODs</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
            Gestão & Criação de Súmulas Inteligentes
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Crie provas com presets oficiais, duplique ou vincule súmulas a WODs e Categorias, e imprima em lote no formato A4.
          </p>
        </div>

        {/* BOTÕES DE AÇÃO RÁPIDA */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleDuplicateTemplate()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-bold text-xs border border-zinc-700 transition-transform active:scale-95"
            title="Duplicar súmula selecionada para criar uma nova variação"
          >
            <Copy className="w-4 h-4" />
            <span>Duplicar Súmula</span>
          </button>

          <button
            onClick={handleCreateNewTemplate}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs border border-zinc-700 transition-transform active:scale-95"
            title="Criar nova súmula em branco"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>+ Nova Súmula</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-xs shadow-lg shadow-amber-500/20 transition-transform active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>IMPRIMIR EM LOTE ({sumulasToPrint.length} FOLHAS A4)</span>
          </button>
        </div>
      </div>

      {/* ABAS DO ESTÚDIO (RESPONSIVA MOBILE) */}
      <div className="flex overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-2 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800 no-print w-full [&>*]:shrink-0 [&>*]:whitespace-nowrap">
        <button
          onClick={() => setActiveTab('print_batch')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'print_batch' 
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' 
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>1. Impressão em Lote (A4)</span>
        </button>

        <button
          onClick={() => setActiveTab('template_studio')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'template_studio' 
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' 
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          <span>2. Editor & Vínculo de Súmulas</span>
        </button>

        <button
          onClick={() => setActiveTab('wod_builder')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'wod_builder' 
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' 
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Dumbbell className="w-4 h-4" />
          <span>3. Construtor de WODs & Presets</span>
        </button>

        <button
          onClick={() => setActiveTab('head_judge_desk')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'head_judge_desk' 
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-lg shadow-emerald-500/20 font-black' 
              : 'text-zinc-400 hover:text-emerald-400'
          }`}
        >
          <FileCheck className="w-4 h-4 text-emerald-400" />
          <span>4. Mesa do Head Judge (Lançamento & Auditoria)</span>
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-950 text-emerald-300 border border-emerald-500/40">
            FOTO OBRIGATÓRIA
          </span>
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1. ABA DE IMPRESSÃO EM LOTE */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'print_batch' && (
        <div className="space-y-6">
          
          {/* BARRA DE FILTROS */}
          <div className="glass-panel rounded-2xl p-5 border border-zinc-800 space-y-4 no-print">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                <Filter className="w-4 h-4 text-amber-400" />
                <span>Filtros de Configuração da Impressão:</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-400">Campeonato:</span>
                <span className="font-bold text-amber-400">{activeGame?.name}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  1. Categoria
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => {
                    const newCatId = e.target.value;
                    setSelectedCategoryId(newCatId);
                    // Sugerir template vinculado à categoria se houver
                    const bound = templates.find(t => t.categoryId === newCatId);
                    if (bound) setSelectedTemplateId(bound.id);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-medium text-white focus:outline-none focus:border-amber-500"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  2. Workout / Evento
                </label>
                <select
                  value={selectedWorkoutId}
                  onChange={(e) => {
                    const newWodId = e.target.value;
                    setSelectedWorkoutId(newWodId);
                    const targetWod = workouts.find(w => w.id === newWodId);
                    if (targetWod) {
                      if (targetWod.categoryId && categories.some(c => c.id === targetWod.categoryId)) {
                        setSelectedCategoryId(targetWod.categoryId);
                      }
                      if (targetWod.sumulaTemplateId && templates.some(t => t.id === targetWod.sumulaTemplateId)) {
                        setSelectedTemplateId(targetWod.sumulaTemplateId);
                      } else {
                        const bound = templates.find(t => t.workoutId === newWodId);
                        if (bound) setSelectedTemplateId(bound.id);
                      }
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-medium text-white focus:outline-none focus:border-amber-500"
                >
                  {(categoryWorkouts.length > 0 ? categoryWorkouts : workouts).map(wod => (
                    <option key={wod.id} value={wod.id}>{wod.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  3. Bateria (Heat)
                </label>
                <select
                  value={selectedHeatNumber}
                  onChange={(e) => setSelectedHeatNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-medium text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="all">Todas as Baterias ({sumulasToPrint.length} Equipes)</option>
                  {workoutHeats.length > 0 ? (
                    workoutHeats.map(h => (
                      <option key={h.id} value={String(h.heatNumber)}>
                        Bateria #{h.heatNumber} ({h.startTime})
                      </option>
                    ))
                  ) : (
                    Array.from({ length: Math.ceil(filteredTeams.length / (activeGame?.lanesCount || 4)) }, (_, i) => i + 1).map(hNum => (
                      <option key={hNum} value={String(hNum)}>
                        Bateria #{hNum} ({filteredTeams.slice((hNum - 1) * (activeGame?.lanesCount || 4), hNum * (activeGame?.lanesCount || 4)).length} Equipes)
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  4. Layout da Súmula
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-medium text-white focus:outline-none focus:border-amber-500"
                >
                  {templates.map(tmpl => {
                    let labelExtra = '';
                    if (tmpl.workoutId) labelExtra = ` [WOD: ${getWodName(tmpl.workoutId) || 'Vinculado'}]`;
                    else if (tmpl.categoryId) labelExtra = ` [Cat: ${getCatName(tmpl.categoryId) || 'Vinculada'}]`;
                    return (
                      <option key={tmpl.id} value={tmpl.id}>
                        {tmpl.name} ({tmpl.type.toUpperCase()}){labelExtra}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-zinc-800/80 text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Formatado para folha <strong>A4</strong> com quebra de página automática por prancheta.</span>
              </div>
              <div className="flex items-center gap-2">
                {currentTemplate?.workoutId && (
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
                    ⚡ Vinculado ao {getWodName(currentTemplate.workoutId)}
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                  {sumulasToPrint.length} súmulas prontas
                </span>
              </div>
            </div>
          </div>

          {/* RENDERIZAÇÃO DAS SÚMULAS PRONTAS */}
          <div className="space-y-6" ref={printContainerRef}>
            {sumulasToPrint.map((item, index) => {
              const athletesNames = item.team.athletes.map(a => a.name).join(' • ');
              const renderedHtml = replaceSumulaVariables(currentTemplate?.htmlContent || '', {
                gameName: activeGame?.name,
                categoryName: currentCategory?.name,
                registerNumber: item.team.registerNumber,
                teamName: item.team.teamName,
                athletesList: athletesNames,
                boxAffiliate: item.team.athletes[0]?.boxOrAffiliate || 'Independente',
                eventTitle: currentWorkout?.title,
                workoutDescription: currentWorkout?.description,
                timeCap: `${Math.floor((currentWorkout?.timeCapSeconds || 600) / 60)}:00`,
                tieBreakRule: currentWorkout?.tieBreakMetric === 'time' ? 'Tempo do Round 2' : 'Repetições válidas',
                heatNumber: item.heatNumber,
                laneNumber: item.laneNumber,
                heatTime: item.heatTime
              });

              return (
                <div 
                  key={`${item.team.id}-${index}`}
                  className="sumula-page-break bg-white text-black p-4 sm:p-6 rounded-2xl shadow-xl border border-zinc-300 max-w-4xl mx-auto my-4"
                >
                  <div className="no-print mb-2 pb-2 border-b border-zinc-200 flex items-center justify-between text-xs text-zinc-500 font-semibold">
                    <span>Súmula {index + 1} de {sumulasToPrint.length} • Bateria #{item.heatNumber} | Raia #{item.laneNumber}</span>
                    <span className="text-amber-700 font-bold">{item.team.teamName} ({item.team.registerNumber})</span>
                  </div>

                  <div className="overflow-x-auto print:overflow-visible">
                    <div className="min-w-[660px] sm:min-w-0 print:min-w-0" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 2. ABA DO EDITOR E VÍNCULO DE SÚMULAS */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'template_studio' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* PAINEL LATERAL: TEMPLATES E TAGS DINÂMICAS */}
          <div className="space-y-6">
            
            {/* SELEÇÃO DO TEMPLATE PARA EDITAR */}
            <div className="glass-panel rounded-3xl p-5 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                  Templates ({templates.length}):
                </label>
                <button
                  onClick={handleCreateNewTemplate}
                  className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo</span>
                </button>
              </div>

              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {templates.map(tmpl => {
                  const isSelected = tmpl.id === editingTemplateId;
                  const boundCat = categories.find(c => c.id === tmpl.categoryId);
                  const boundWod = workouts.find(w => w.id === tmpl.workoutId);

                  return (
                    <div
                      key={tmpl.id}
                      className={`p-3 rounded-2xl text-xs font-bold transition-all border flex flex-col gap-2 ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/60 text-white shadow-md'
                          : 'bg-zinc-950 hover:bg-zinc-900 border-zinc-800 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => handleSelectTemplateForEdit(tmpl.id)}
                          className="text-left font-bold truncate flex-1 hover:text-amber-400"
                        >
                          {tmpl.name}
                        </button>
                        <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                          {tmpl.type}
                        </span>
                      </div>

                      {/* VÍNCULOS EM BADGES */}
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        {boundWod && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-800/60 truncate max-w-[140px]">
                            ⚡ {boundWod.title}
                          </span>
                        )}
                        {boundCat && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-800/60 truncate max-w-[140px]">
                            🏷️ {boundCat.name}
                          </span>
                        )}
                        {tmpl.isDefault && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                            Padrão
                          </span>
                        )}
                      </div>

                      {/* AÇÕES DO CARD */}
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800/50">
                        <button
                          onClick={() => handleDuplicateTemplate(tmpl)}
                          className="p-1 rounded text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-colors"
                          title="Duplicar esta súmula"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {!tmpl.isDefault && (
                          <button
                            onClick={() => handleDeleteTemplate(tmpl.id)}
                            className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                            title="Excluir súmula customizada"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* INSERÇÃO DE TAGS DINÂMICAS COM 1 CLIQUE */}
            <div className="glass-panel rounded-3xl p-5 border border-zinc-800 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
                <Tag className="w-4 h-4" />
                <span>Tags Dinâmicas (1 Clique):</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Clique na tag para adicioná-la à súmula. O sistema preenche automaticamente os dados do atleta na impressão:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_TAGS.map(t => (
                  <button
                    key={t.tag}
                    onClick={() => handleInsertTag(t.tag)}
                    className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-amber-500 hover:text-black border border-zinc-800 text-[11px] font-mono font-bold text-zinc-300 transition-colors"
                    title={`Inserir ${t.label}`}
                  >
                    {t.tag}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* ÁREA CENTRAL: EDITOR, VÍNCULOS & PRÉVIA */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* CABEÇALHO DO EDITOR E VÍNCULOS */}
            <div className="glass-panel rounded-3xl p-5 border border-zinc-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Nome da Súmula:
                  </label>
                  <input
                    type="text"
                    value={editingTemplateName}
                    onChange={(e) => setEditingTemplateName(e.target.value)}
                    placeholder="Nome do Template de Súmula"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <button
                    onClick={() => handleDuplicateTemplate()}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-bold text-xs border border-zinc-700 transition-transform active:scale-95"
                    title="Duplicar esta súmula para criar outra"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Duplicar</span>
                  </button>

                  <button
                    onClick={handleSaveTemplate}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-transform active:scale-95"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar Súmula</span>
                  </button>
                </div>
              </div>

              {/* VÍNCULO DIRETO: CAMPEONATO / CATEGORIA / WOD */}
              <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <Link2 className="w-4 h-4" />
                  <span>Vincular Súmula a Evento, Categoria ou WOD Específico:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                      1. Campeonato / Evento
                    </label>
                    <select
                      value={editingGameId}
                      onChange={(e) => setEditingGameId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white"
                    >
                      <option value="">Global (Todos os Eventos)</option>
                      {games.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                      2. Categoria Vinculada
                    </label>
                    <select
                      value={editingCategoryId}
                      onChange={(e) => setEditingCategoryId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white"
                    >
                      <option value="">Geral (Todas as Categorias)</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                      3. WOD / Prova Específica
                    </label>
                    <select
                      value={editingWorkoutId}
                      onChange={(e) => setEditingWorkoutId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white"
                    >
                      <option value="">Qualquer WOD (Genérico)</option>
                      {workouts.map(w => (
                        <option key={w.id} value={w.id}>{w.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

            </div>

            {/* CÓDIGO HTML / EDITOR */}
            <div className="glass-panel rounded-3xl p-4 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Estrutura HTML / CSS do Layout da Prancheta:
                </label>
                <span className="text-[10px] text-zinc-500 font-mono">Suporta estilos inline (A4)</span>
              </div>
              <textarea
                rows={12}
                value={editingHtmlContent}
                onChange={(e) => setEditingHtmlContent(e.target.value)}
                className="w-full p-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* PRÉVIA EM TEMPO REAL DA PRANCHETA */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                Prévia em Tempo Real (Formato A4):
              </label>
              <div className="bg-white text-black p-6 rounded-2xl shadow-2xl border border-zinc-400 max-w-3xl mx-auto">
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: replaceSumulaVariables(editingHtmlContent, {
                      gameName: activeGame?.name || 'ItGames CrossFit Championship',
                      categoryName: categories.find(c => c.id === editingCategoryId)?.name || currentCategory?.name || 'Trio Scale',
                      registerNumber: '#101',
                      teamName: 'Lucas Silveira (Exemplo)',
                      athletesList: 'Lucas Silveira • Mateus Rossi • Carlos Lima',
                      boxAffiliate: 'CrossFit IronSP',
                      eventTitle: workouts.find(w => w.id === editingWorkoutId)?.title || 'WOD 1 - The Inferno',
                      workoutDescription: workouts.find(w => w.id === editingWorkoutId)?.description || '3 Rounds For Time:\n• 21 Cal Echo Bike\n• 15 Toes-to-Bar\n• 9 Thrusters (60kg)',
                      timeCap: '10:00',
                      tieBreakRule: 'Tempo Round 2',
                      heatNumber: 1,
                      laneNumber: 4,
                      heatTime: '09:00'
                    }) 
                  }} 
                />
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 3. ABA DO CONSTRUTOR DE WODS & PRESETS OFICIAIS */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'wod_builder' && (
        <div className="space-y-6">
          
          {/* BANNER DOS PRESETS RÁPIDOS */}
          <div className="glass-panel rounded-3xl p-6 border border-amber-500/30 bg-gradient-to-r from-amber-950/30 via-zinc-900 to-zinc-900 space-y-4">
            <div>
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Flame className="w-4 h-4" />
                <span>Biblioteca de Presets Oficiais (1 Clique)</span>
              </div>
              <h3 className="text-xl font-black text-white mt-1">
                Selecione um Padrão Oficial de Competição:
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Carregue modelos prontos para CrossFit (For Time, AMRAP, Max Load) e HYROX (8 estações).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {OFFICIAL_WOD_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleLoadWodPreset(preset)}
                  className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 hover:border-amber-500/60 text-left transition-all hover:scale-[1.02] flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-zinc-800 text-amber-400">
                        {preset.eventType.toUpperCase()}
                      </span>
                      <span className="text-[11px] font-bold text-zinc-400">
                        Cap: {preset.defaultTimeCapMinutes} min
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white mt-1.5">{preset.name}</h4>
                    <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2">{preset.description}</p>
                  </div>
                  <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                    <span>Carregar no Formulário</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* FORMULÁRIO COMPLETO DO CONSTRUTOR DE WODS */}
          <div className="glass-panel rounded-3xl p-6 border border-zinc-800 space-y-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-amber-400" />
              Especificações do Workout / Prova
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">Categoria Alvo:</label>
                <select
                  value={wodCategoryId}
                  onChange={(e) => setWodCategoryId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-bold text-xs"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">Título da Prova:</label>
                <input
                  type="text"
                  value={wodTitle}
                  onChange={(e) => setWodTitle(e.target.value)}
                  placeholder="Ex: WOD 1 - The Inferno"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-bold text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">Tipo de Prova:</label>
                <select
                  value={wodType}
                  onChange={(e) => setWodType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-bold text-xs"
                >
                  <option value="for_time">For Time (Menor Tempo)</option>
                  <option value="amrap">AMRAP (Mais Repetições)</option>
                  <option value="max_load">Carga Máxima (1RM / Complex)</option>
                  <option value="emom">EMOM</option>
                  <option value="hyrox_standard">HYROX Oficial (8 Estações)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">Time Cap (Minutos):</label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={wodTimeCapMinutes}
                  onChange={(e) => setWodTimeCapMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-bold text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">Métrica de Desempate (Tie-Break):</label>
                <select
                  value={wodTieBreak}
                  onChange={(e) => setWodTieBreak(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-bold text-xs"
                >
                  <option value="time">Tempo Parcial de Split (Ex: Fim do Round 2)</option>
                  <option value="reps">Contagem de Repetições Válidas</option>
                  <option value="none">Sem Critério de Desempate</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1">
                Sequência de Exercícios, Rounds e Cargas:
              </label>
              <textarea
                rows={4}
                value={wodDescription}
                onChange={(e) => setWodDescription(e.target.value)}
                placeholder="Ex: 3 Rounds For Time:\n• 21 Cal Echo Bike\n• 15 Toes-to-Bar\n• 9 Thrusters (60kg)"
                className="w-full p-3 rounded-2xl bg-zinc-900 border border-zinc-700 text-white text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1">
                Padrões de Movimento & Critérios de No-Rep para os Juízes:
              </label>
              <textarea
                rows={3}
                value={wodStandards}
                onChange={(e) => setWodStandards(e.target.value)}
                placeholder="Ex: Extensão completa de joelhos e quadril no topo do thruster. Pés tocam a barra simultaneamente no toes-to-bar."
                className="w-full p-3 rounded-2xl bg-zinc-900 border border-zinc-700 text-white text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                onClick={handleSaveWod}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-transform active:scale-95"
              >
                <CheckCircle className="w-4 h-4" />
                <span>CRIAR WOD E VINCULAR À SÚMULA</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 4. ABA DA MESA DO HEAD JUDGE (LANÇAMENTO & AUDITORIA COM FOTO OBRIGATÓRIA) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'head_judge_desk' && (
        <div className="space-y-6">

          {/* CABEÇALHO & SELETORES DA MESA */}
          <div className="glass-panel rounded-2xl p-6 border border-zinc-800 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider">
                  <FileCheck className="w-4 h-4" />
                  <span>Central Oficial de Homologação</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                  Mesa do Head Judge: Lançamento de Súmulas Físicas
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Receba as súmulas de papel preenchidas pelos juízes de pista, anexe a foto comprovatória assinada e homologue para atualizar o Leaderboard instantaneamente.
                </p>
              </div>

              {/* BADGE DE REGRA MANDATÓRIA */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                <Camera className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Foto física obrigatória por súmula</span>
              </div>
            </div>

            {/* SELETORES: CATEGORIA, WOD E BATERIA */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  1. Categoria
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => {
                    setSelectedCategoryId(e.target.value);
                    setDeskHeatNumber('1');
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-bold text-xs"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  2. Workout / Prova
                </label>
                <select
                  value={selectedWorkoutId}
                  onChange={(e) => setSelectedWorkoutId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-bold text-xs"
                >
                  {categoryWorkouts.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  3. Bateria (Heat da Mesa)
                </label>
                <select
                  value={deskHeatNumber}
                  onChange={(e) => setDeskHeatNumber(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-emerald-500/50 text-emerald-400 font-bold text-xs"
                >
                  {distinctHeats.length > 0 ? (
                    distinctHeats.map(hNum => (
                      <option key={hNum} value={String(hNum)}>
                        BATERIA (HEAT) #{hNum}
                      </option>
                    ))
                  ) : (
                    <option value="1">BATERIA (HEAT) #1</option>
                  )}
                </select>
              </div>
            </div>

            {/* BARRA DE PROGRESSO DA BATERIA */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-xs font-bold mb-2">
                <span className="text-zinc-300">
                  Progresso da Bateria #{deskHeatNumber}: {deskHeatHomologatedCount} de {activeDeskHeatLanes.length} súmulas homologadas
                </span>
                <span className="text-emerald-400">
                  {activeDeskHeatLanes.length > 0
                    ? Math.round((deskHeatHomologatedCount / activeDeskHeatLanes.length) * 100)
                    : 0}% Concluído
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                  style={{
                    width: `${activeDeskHeatLanes.length > 0 ? (deskHeatHomologatedCount / activeDeskHeatLanes.length) * 100 : 0}%`
                  }}
                />
              </div>
            </div>
          </div>

          {/* LISTA DE RAIAS DA BATERIA */}
          <div className="space-y-4">
            {activeDeskHeatLanes.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-zinc-900/60 border border-zinc-800 text-zinc-400 text-xs">
                Nenhuma equipe encontrada para a Bateria #{deskHeatNumber} nesta categoria.
              </div>
            ) : (
              activeDeskHeatLanes.map((item) => {
                const team = item.team;
                const regId = team.id;
                const existingScore = scores.find(s => s.workoutId === currentWorkout?.id && s.registrationId === regId);
                const isHomologated = Boolean(existingScore && existingScore.scoreStatus === 'approved_by_head_judge');
                const currentState = deskScoresState[regId] || {
                  time: existingScore?.timeFormatted || '04:30',
                  isCap: existingScore ? !existingScore.isCompleted : false,
                  reps: String(existingScore?.repsCount || '0'),
                  weightA: '0',
                  weightB: '0',
                  rounds: existingScore?.roundsCount || 3,
                  tiebreak: existingScore?.tieBreakTimeFormatted || '',
                  photoUrl: existingScore?.photoSumulaUrl || null
                };

                const currentPhoto = currentState.photoUrl || existingScore?.photoSumulaUrl;

                const isWod1A = currentWorkout?.title.includes('1-A') || currentWorkout?.title.toLowerCase().includes('row') || currentWorkout?.title.toLowerCase().includes('remo');
                const isWod1B = currentWorkout?.title.includes('1-B') || currentWorkout?.title.toLowerCase().includes('death by');
                const isWod3 = currentWorkout?.title.includes('3') || currentWorkout?.title.toLowerCase().includes('hang clean') || currentWorkout?.title.toLowerCase().includes('lift') || currentWorkout?.type === 'max_load' || currentWorkout?.type === 'complex';

                const teamDisplayName = team.teamName || (team as any).name || 'Equipe';
                const teamBox = team.athletes?.[0]?.boxOrAffiliate || (team as any).boxOrGym;

                return (
                  <div
                    key={regId}
                    className={`rounded-2xl border transition-all p-5 ${
                      isHomologated 
                        ? 'bg-zinc-900/90 border-emerald-500/40 shadow-lg shadow-emerald-950/20' 
                        : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

                      {/* COLUNA 1: DADOS DA EQUIPE & RAIA */}
                      <div className="lg:col-span-3 space-y-2 border-b lg:border-b-0 lg:border-r border-zinc-800 pb-4 lg:pb-0 lg:pr-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-xs">
                            RAIA #{item.laneNumber}
                          </span>
                          <span className="text-[11px] font-bold text-zinc-400">
                            HEAT #{item.heatNumber}
                          </span>
                        </div>

                        <div>
                          <div className="text-base font-black text-white flex items-center gap-1.5">
                            <span>{teamDisplayName}</span>
                            <span className="text-xs text-amber-400 font-bold">
                              (#{team.registerNumber || team.id})
                            </span>
                          </div>
                          {team.athletes && team.athletes.length > 0 && (
                            <p className="text-xs text-zinc-400 mt-0.5">
                              {team.athletes.map(a => a.name).join(' • ')}
                            </p>
                          )}
                          {teamBox && (
                            <p className="text-[11px] text-zinc-500 font-semibold mt-0.5">
                              Box: {teamBox}
                            </p>
                          )}
                        </div>

                        <div className="pt-2">
                          {isHomologated ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                              <span>HOMOLOGADO</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                              <span>PENDENTE DE SÚMULA</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* COLUNA 2: FOTO COMPROBATÓRIA OBRIGATÓRIA */}
                      <div className="lg:col-span-4 space-y-2 border-b lg:border-b-0 lg:border-r border-zinc-800 pb-4 lg:pb-0 lg:pr-4">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1">
                            <Camera className="w-3.5 h-3.5 text-amber-400" />
                            <span>Foto da Súmula Física:</span>
                          </label>
                          <span className="text-[10px] font-black text-rose-400 uppercase">
                            *Obrigatório
                          </span>
                        </div>

                        {currentPhoto ? (
                          <div className="space-y-2">
                            <div className="relative group rounded-xl overflow-hidden border border-emerald-500/40 bg-zinc-950 h-28 flex items-center justify-center">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={currentPhoto}
                                alt={`Súmula ${teamDisplayName}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                  onClick={() => setZoomPhotoUrl(currentPhoto)}
                                  className="p-2 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 text-xs font-bold flex items-center gap-1"
                                >
                                  <ZoomIn className="w-4 h-4 text-amber-400" />
                                  <span>Ampliar</span>
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <button
                                onClick={() => setZoomPhotoUrl(currentPhoto)}
                                className="text-[11px] font-bold text-amber-400 hover:underline flex items-center gap-1"
                              >
                                <ZoomIn className="w-3.5 h-3.5" />
                                <span>Ver em Tela Cheia (Zoom)</span>
                              </button>

                              <label className="text-[11px] font-bold text-zinc-400 hover:text-white cursor-pointer">
                                <span>Substituir</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="hidden"
                                  onChange={(e) => handlePhotoUpload(regId, e)}
                                />
                              </label>
                            </div>
                          </div>
                        ) : (
                          <label className="border-2 border-dashed border-zinc-700 hover:border-amber-500/80 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-zinc-950/40 h-28">
                            <Camera className="w-6 h-6 text-amber-400" />
                            <span className="text-xs font-bold text-zinc-300 text-center">
                              Fotografar / Anexar Súmula Assinada
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              (Câmera do celular ou arquivo JPG/PNG)
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => handlePhotoUpload(regId, e)}
                            />
                          </label>
                        )}
                      </div>

                      {/* COLUNA 3: INPUTS ESPECÍFICOS DO WOD & BOTÃO DE HOMOLOGAÇÃO */}
                      <div className="lg:col-span-5 space-y-3 flex flex-col justify-between">
                        
                        {/* WOD 1-A: 800M ROW (TEMPO OU CAP + METROS) */}
                        {isWod1A && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-amber-400">
                                WOD 1-A (800m Row):
                              </span>
                              <div className="flex items-center gap-2 text-xs">
                                <label className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={currentState.isCap}
                                    onChange={(e) => handleUpdateDeskField(regId, 'isCap', e.target.checked)}
                                    className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500"
                                  />
                                  <span className="text-zinc-300 font-bold">Deu TIME CAP (5:00)?</span>
                                </label>
                              </div>
                            </div>

                            {currentState.isCap ? (
                              <div>
                                <label className="text-[11px] text-zinc-400 block mb-1">
                                  Quantos metros FALTARAM para completar os 800m?
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    placeholder="Ex: 188"
                                    value={currentState.reps}
                                    onChange={(e) => handleUpdateDeskField(regId, 'reps', e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-bold text-xs"
                                  />
                                  <span className="text-xs text-zinc-400 font-bold">metros</span>
                                </div>
                                <p className="text-[10px] text-amber-400 font-semibold mt-1">
                                  Resultado Oficial: 5:00 + {currentState.reps || 0}m
                                </p>
                              </div>
                            ) : (
                              <div>
                                <label className="text-[11px] text-zinc-400 block mb-1">
                                  Tempo de Conclusão dos 800m (mm:ss):
                                </label>
                                <input
                                  type="text"
                                  placeholder="04:32"
                                  value={currentState.time}
                                  onChange={(e) => handleUpdateDeskField(regId, 'time', e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-bold text-xs"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* WOD 1-B: DEATH BY (ROUNDS FECHADOS 1 A 5) */}
                        {isWod1B && (
                          <div className="space-y-2">
                            <span className="text-xs font-bold text-amber-400 block">
                              WOD 1-B (Death By Thrusters + Pull-ups):
                            </span>
                            <div>
                              <label className="text-[11px] text-zinc-400 block mb-1.5">
                                Quantos Rounds Completos a equipe fechou dentro do tempo?
                              </label>
                              <div className="grid grid-cols-5 gap-1.5">
                                {[1, 2, 3, 4, 5].map(r => (
                                  <button
                                    key={r}
                                    type="button"
                                    onClick={() => handleUpdateDeskField(regId, 'rounds', r)}
                                    className={`py-1.5 rounded-lg text-xs font-black transition-all ${
                                      currentState.rounds === r
                                        ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                    }`}
                                  >
                                    {r} {r === 1 ? 'Round' : 'Rounds'}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="text-[11px] text-zinc-400 block mb-1">
                                Tie-Break (Tempo do último round fechado ou repetições extras):
                              </label>
                              <input
                                type="text"
                                placeholder="Ex: 01:45 ou 12 reps"
                                value={currentState.tiebreak}
                                onChange={(e) => handleUpdateDeskField(regId, 'tiebreak', e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-bold text-xs"
                              />
                            </div>
                          </div>
                        )}

                        {/* WOD 3: MAXIMUM LIFT (HANG CLEAN N' JERK - ATLETA A + B = TOTAL) */}
                        {isWod3 && (
                          <div className="space-y-2">
                            <span className="text-xs font-bold text-amber-400 block">
                              WOD 3: Maximum Lift (Hang Clean n&apos; Jerk):
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-zinc-400 block mb-1">
                                  Atleta A (kg):
                                </label>
                                <input
                                  type="number"
                                  placeholder="Ex: 75"
                                  value={currentState.weightA}
                                  onChange={(e) => handleUpdateDeskField(regId, 'weightA', e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-bold text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-zinc-400 block mb-1">
                                  Atleta B (kg):
                                </label>
                                <input
                                  type="number"
                                  placeholder="Ex: 60"
                                  value={currentState.weightB}
                                  onChange={(e) => handleUpdateDeskField(regId, 'weightB', e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-bold text-xs"
                                />
                              </div>
                            </div>

                            {/* TOTAL AUTOMÁTICO DA DUPLA */}
                            <div className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
                              <span className="text-xs font-bold text-zinc-300">
                                Carga Total da Dupla (A + B):
                              </span>
                              <span className="text-base font-black text-amber-400">
                                {(Number(currentState.weightA) || 0) + (Number(currentState.weightB) || 0)} kg
                              </span>
                            </div>

                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-1">
                                Tie-Break (Nº da Tentativa Válida ou Tempo):
                              </label>
                              <input
                                type="text"
                                placeholder="Ex: 4ª Tentativa (02:10)"
                                value={currentState.tiebreak}
                                onChange={(e) => handleUpdateDeskField(regId, 'tiebreak', e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-bold text-xs"
                              />
                            </div>
                          </div>
                        )}

                        {/* WOD 2 OU OUTROS: SYNC & BURN (TIME CAP 10:00 + REPS) */}
                        {!isWod1A && !isWod1B && !isWod3 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-amber-400">
                                Resultado da Prova:
                              </span>
                              <label className="flex items-center gap-1 cursor-pointer text-xs">
                                <input
                                  type="checkbox"
                                  checked={currentState.isCap}
                                  onChange={(e) => handleUpdateDeskField(regId, 'isCap', e.target.checked)}
                                  className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500"
                                />
                                <span className="text-zinc-300 font-bold">Deu TIME CAP?</span>
                              </label>
                            </div>

                            {currentState.isCap ? (
                              <div>
                                <label className="text-[11px] text-zinc-400 block mb-1">
                                  Quantas repetições FALTARAM para fechar a prova?
                                </label>
                                <input
                                  type="number"
                                  placeholder="Ex: 15 reps"
                                  value={currentState.reps}
                                  onChange={(e) => handleUpdateDeskField(regId, 'reps', e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-bold text-xs"
                                />
                              </div>
                            ) : (
                              <div>
                                <label className="text-[11px] text-zinc-400 block mb-1">
                                  Tempo de Conclusão (mm:ss):
                                </label>
                                <input
                                  type="text"
                                  placeholder="08:45"
                                  value={currentState.time}
                                  onChange={(e) => handleUpdateDeskField(regId, 'time', e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-bold text-xs"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* BOTÃO DE HOMOLOGAÇÃO COM VALIDAÇÃO DE FOTO */}
                        <div className="pt-2">
                          {currentPhoto ? (
                            <button
                              onClick={() => handleHomologateScore(team, Number(item.laneNumber), Number(item.heatNumber))}
                              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>{isHomologated ? 'ATUALIZAR HOMOLOGAÇÃO & PLACAR' : 'HOMOLOGAR SÚMULA & ATUALIZAR PLACAR'}</span>
                            </button>
                          ) : (
                            <div className="w-full p-2.5 rounded-xl bg-zinc-800/80 border border-amber-500/40 text-amber-300 text-xs font-bold text-center flex items-center justify-center gap-2 cursor-not-allowed">
                              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                              <span>Anexe a foto da súmula física para liberar a homologação</span>
                            </div>
                          )}
                        </div>

                      </div>

                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL DE ZOOM DE FOTO DA SÚMULA (LIGHTBOX EM TELA CHEIA) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {zoomPhotoUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setZoomPhotoUrl(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] w-full bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Camera className="w-4 h-4 text-amber-400" />
                <span>Auditoria Visual de Súmula Física Assinada</span>
              </div>
              <button
                onClick={() => setZoomPhotoUrl(null)}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-auto flex items-center justify-center bg-black/40 min-h-[400px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoomPhotoUrl}
                alt="Súmula Ampliada"
                className="max-h-[75vh] w-auto object-contain rounded-lg shadow-2xl"
              />
            </div>

            <div className="p-3 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
              <span>Verifique a assinatura dos atletas e do juiz antes de homologar.</span>
              <button
                onClick={() => setZoomPhotoUrl(null)}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs"
              >
                Fechar Visualização
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </AclGuard>
  );
}

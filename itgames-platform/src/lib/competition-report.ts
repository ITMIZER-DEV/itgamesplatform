import { GameEvent, Category, TeamRegistration, Athlete } from '@/types';

// Helper de escape para XML do Excel SpreadsheetML
function escapeXml(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Formatar data para exibição pt-BR
function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

// Formato de moeda BRL
function formatMoney(val: number): string {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export interface CategoryOccupancyRow {
  categoryId: string;
  categoryName: string;
  teamFormat: string;
  genderComposition: string;
  price: number;
  spotsTotal: number | null; // null = sem limite
  paidTeamsCount: number;
  pendingTeamsCount: number;
  totalTeamsCount: number;
  spotsRemaining: number | null;
  occupancyPercent: number | null; // null se sem limite
  status: 'Esgotado' | 'Alta Demanda' | 'Moderada' | 'Aberta' | 'Sem Limite';
  totalAthletesCount: number;
  revenueCollected: number;
  revenuePending: number;
  projectedRevenue: number;
  potentialMaxRevenue: number | null;
}

export interface CompetitionAnalytics {
  totalPaidAmount: number;
  totalPendingAmount: number;
  totalProjectedAmount: number;
  totalPotentialMaxAmount: number;
  paidTeamsCount: number;
  pendingTeamsCount: number;
  totalTeamsCount: number;
  totalAthletesCount: number;
  totalSpotsAvailable: number | null;
  globalOccupancyPercent: number | null;
  tshirtCounts: { [size: string]: number };
  categoryRows: CategoryOccupancyRow[];
}

export function calculateCompetitionAnalytics(
  game: GameEvent | null,
  categories: Category[],
  teams: TeamRegistration[]
): CompetitionAnalytics {
  const tshirtSizes = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG'];
  const tshirtCounts: { [size: string]: number } = {};
  tshirtSizes.forEach((sz) => (tshirtCounts[sz] = 0));

  // Mapa de categorias existentes
  const catMap = new Map<string, Category>();
  categories.forEach((c) => {
    catMap.set(String(c.id), c);
    catMap.set(c.name.trim().toLowerCase(), c);
  });

  // Agrupar equipes por categoria
  const teamsByCat = new Map<string, TeamRegistration[]>();
  categories.forEach((c) => {
    teamsByCat.set(String(c.id), []);
  });

  // Também rastrear categorias que possam estar em equipes mas não na lista oficial
  teams.forEach((t) => {
    // Camisetas dos atletas
    t.athletes?.forEach((a) => {
      const sz = (a.tshirtSize || 'M').toUpperCase();
      tshirtCounts[sz] = (tshirtCounts[sz] || 0) + 1;
    });

    const catKey = String(t.categoryId || '');
    if (teamsByCat.has(catKey)) {
      teamsByCat.get(catKey)!.push(t);
    } else {
      // Tentar match por nome
      const matchedByName = categories.find(
        (c) => c.name.trim().toLowerCase() === (t.categoryName || '').trim().toLowerCase()
      );
      if (matchedByName) {
        teamsByCat.get(String(matchedByName.id))!.push(t);
      } else {
        // Categoria avulsa
        const fallbackKey = t.categoryName || t.categoryId || 'Outros';
        if (!teamsByCat.has(fallbackKey)) {
          teamsByCat.set(fallbackKey, []);
        }
        teamsByCat.get(fallbackKey)!.push(t);
      }
    }
  });

  let totalPaidAmount = 0;
  let totalPendingAmount = 0;
  let totalAthletesCount = 0;
  let totalSpotsSum = 0;
  let hasAnySpotLimit = false;

  const categoryRows: CategoryOccupancyRow[] = [];

  // 1. Processar categorias oficiais
  categories.forEach((cat) => {
    const catIdStr = String(cat.id);
    const catTeams = teamsByCat.get(catIdStr) || [];
    const unitPrice = (cat as any).priceBrl ?? cat.price ?? 150;
    const maxRegs = cat.maxRegistrations ?? (cat as any).spotsTotal ?? null;

    let paidCount = 0;
    let pendingCount = 0;
    let catRevenueCollected = 0;
    let catRevenuePending = 0;
    let catAthletesCount = 0;

    catTeams.forEach((t) => {
      const isPaid = t.paymentStatus === 'paid' || t.paymentStatus === 'free';
      const amt = t.amountPaid !== undefined && t.amountPaid !== null && t.amountPaid > 0 ? t.amountPaid : unitPrice;
      if (isPaid) {
        paidCount++;
        catRevenueCollected += amt;
      } else if (t.paymentStatus === 'pending') {
        pendingCount++;
        catRevenuePending += amt;
      }
      catAthletesCount += t.athletes?.length || 1;
    });

    const totalTeams = catTeams.length;
    totalPaidAmount += catRevenueCollected;
    totalPendingAmount += catRevenuePending;
    totalAthletesCount += catAthletesCount;

    let spotsRemaining: number | null = null;
    let occupancyPercent: number | null = null;
    let status: CategoryOccupancyRow['status'] = 'Sem Limite';
    let potentialMaxRevenue: number | null = null;

    if (maxRegs !== null && maxRegs > 0) {
      hasAnySpotLimit = true;
      totalSpotsSum += maxRegs;
      spotsRemaining = Math.max(0, maxRegs - totalTeams);
      occupancyPercent = (totalTeams / maxRegs) * 100;
      potentialMaxRevenue = maxRegs * unitPrice;

      if (totalTeams >= maxRegs) {
        status = 'Esgotado';
      } else if (occupancyPercent >= 80) {
        status = 'Alta Demanda';
      } else if (occupancyPercent >= 40) {
        status = 'Moderada';
      } else {
        status = 'Aberta';
      }
    }

    const projectedRevenue = catRevenueCollected + catRevenuePending;

    // Formato e Composição amigáveis
    const teamFormatLabel =
      cat.teamFormat === 'individual'
        ? 'Individual'
        : cat.teamFormat === 'duo'
        ? 'Dupla'
        : cat.teamFormat === 'trio'
        ? 'Trio'
        : cat.teamFormat === 'quartet'
        ? 'Quarteto'
        : cat.teamFormat || 'Equipe';

    const genderLabel =
      cat.genderComposition === 'male' || (cat as any).gender === 'male'
        ? 'Masculino'
        : cat.genderComposition === 'female' || (cat as any).gender === 'female'
        ? 'Feminino'
        : cat.genderComposition === 'mixed_1m_1f' || (cat as any).gender === 'mixed_1m_1f'
        ? 'Misto (1H + 1M)'
        : cat.genderComposition === 'mixed_2m_2f' || (cat as any).gender === 'mixed_2m_2f'
        ? 'Misto (2H + 2M)'
        : 'Aberto / Open';

    categoryRows.push({
      categoryId: catIdStr,
      categoryName: cat.name,
      teamFormat: teamFormatLabel,
      genderComposition: genderLabel,
      price: unitPrice,
      spotsTotal: maxRegs,
      paidTeamsCount: paidCount,
      pendingTeamsCount: pendingCount,
      totalTeamsCount: totalTeams,
      spotsRemaining,
      occupancyPercent,
      status,
      totalAthletesCount: catAthletesCount,
      revenueCollected: catRevenueCollected,
      revenuePending: catRevenuePending,
      projectedRevenue,
      potentialMaxRevenue,
    });
  });

  // 2. Processar categorias avulsas que não estavam cadastradas formalmente
  teamsByCat.forEach((catTeams, key) => {
    const isAlreadyProcessed = categories.some((c) => String(c.id) === key);
    if (!isAlreadyProcessed && catTeams.length > 0) {
      let paidCount = 0;
      let pendingCount = 0;
      let catRevenueCollected = 0;
      let catRevenuePending = 0;
      let catAthletesCount = 0;

      catTeams.forEach((t) => {
        const isPaid = t.paymentStatus === 'paid' || t.paymentStatus === 'free';
        const amt = t.amountPaid || 150;
        if (isPaid) {
          paidCount++;
          catRevenueCollected += amt;
        } else if (t.paymentStatus === 'pending') {
          pendingCount++;
          catRevenuePending += amt;
        }
        catAthletesCount += t.athletes?.length || 1;
      });

      totalPaidAmount += catRevenueCollected;
      totalPendingAmount += catRevenuePending;
      totalAthletesCount += catAthletesCount;

      categoryRows.push({
        categoryId: key,
        categoryName: catTeams[0]?.categoryName || key,
        teamFormat: 'Equipe',
        genderComposition: 'Aberto',
        price: 150,
        spotsTotal: null,
        paidTeamsCount: paidCount,
        pendingTeamsCount: pendingCount,
        totalTeamsCount: catTeams.length,
        spotsRemaining: null,
        occupancyPercent: null,
        status: 'Sem Limite',
        totalAthletesCount: catAthletesCount,
        revenueCollected: catRevenueCollected,
        revenuePending: catRevenuePending,
        projectedRevenue: catRevenueCollected + catRevenuePending,
        potentialMaxRevenue: null,
      });
    }
  });

  const totalTeamsCount = teams.length;
  const totalProjectedAmount = totalPaidAmount + totalPendingAmount;
  const totalPotentialMaxAmount = categoryRows.reduce(
    (acc, r) => acc + (r.potentialMaxRevenue !== null ? r.potentialMaxRevenue : r.projectedRevenue),
    0
  );

  const globalOccupancyPercent =
    hasAnySpotLimit && totalSpotsSum > 0 ? (totalTeamsCount / totalSpotsSum) * 100 : null;

  return {
    totalPaidAmount,
    totalPendingAmount,
    totalProjectedAmount,
    totalPotentialMaxAmount,
    paidTeamsCount: teams.filter((t) => t.paymentStatus === 'paid' || t.paymentStatus === 'free').length,
    pendingTeamsCount: teams.filter((t) => t.paymentStatus === 'pending').length,
    totalTeamsCount,
    totalAthletesCount,
    totalSpotsAvailable: hasAnySpotLimit ? totalSpotsSum : null,
    globalOccupancyPercent,
    tshirtCounts,
    categoryRows,
  };
}

/**
 * Gera e dispara o download da Planilha Excel (.xls em formato XML Spreadsheet 2003 nativo com 4 abas).
 * Compatível com Microsoft Excel, LibreOffice Calc, Apple Numbers e Google Planilhas.
 * Elimina totalmente problemas de fragmentos '#' na URL pois usa Blob binário.
 */
export function exportCompetitionAnalyticsExcel(
  game: GameEvent | null,
  categories: Category[],
  teams: TeamRegistration[]
) {
  const analytics = calculateCompetitionAnalytics(game, categories, teams);
  const gameName = game?.name || 'Campeonato Arena';
  const gameCode = game?.code || 'ITGAMES';
  const gameDate = formatDate(game?.startDate || (game as any)?.date);
  const gameLocation = game?.location || 'Arena Oficial';
  const gameType = (game?.eventType || 'crossfit').toUpperCase();
  const generationTimestamp = new Date().toLocaleString('pt-BR');

  // Cabeçalho e Estilos SpreadsheetML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">

  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Author>ITGames Arena</Author>
    <LastAuthor>ITGames Arena</LastAuthor>
    <Created>${new Date().toISOString()}</Created>
    <Company>ITGames Plataforma</Company>
    <Version>16.00</Version>
  </DocumentProperties>

  <Styles>
    <!-- Padrão -->
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Borders/>
      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>
      <Interior/>
      <NumberFormat/>
      <Protection/>
    </Style>

    <!-- Banner Principal -->
    <Style ss:ID="sBanner">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="16" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#F59E0B"/>
      </Borders>
    </Style>

    <Style ss:ID="sBannerSubtitle">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Italic="1" ss:Color="#94A3B8"/>
      <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
    </Style>

    <!-- Títulos de Seção -->
    <Style ss:ID="sSectionHeader">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="12" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
      </Borders>
    </Style>

    <!-- Cabeçalho de Tabela -->
    <Style ss:ID="sColHeader">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#334155"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#334155"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#334155"/>
      </Borders>
    </Style>

    <!-- Célula Normal Texto -->
    <Style ss:ID="sCellText">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="9" ss:Color="#1E293B"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>

    <!-- Célula Zebra Texto -->
    <Style ss:ID="sCellTextZebra">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="9" ss:Color="#1E293B"/>
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>

    <!-- Célula Centralizada -->
    <Style ss:ID="sCellCenter">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="9" ss:Color="#1E293B"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>

    <Style ss:ID="sCellCenterZebra">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="9" ss:Color="#1E293B"/>
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>

    <!-- Célula Inteiro -->
    <Style ss:ID="sCellInt">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="9" ss:Color="#1E293B"/>
      <NumberFormat ss:Format="#,##0"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>

    <Style ss:ID="sCellIntZebra">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="9" ss:Color="#1E293B"/>
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
      <NumberFormat ss:Format="#,##0"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>

    <!-- Célula Moeda -->
    <Style ss:ID="sCellMoney">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="9" ss:Color="#1E293B"/>
      <NumberFormat ss:Format="R$ #,##0.00"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>

    <Style ss:ID="sCellMoneyZebra">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="9" ss:Color="#1E293B"/>
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
      <NumberFormat ss:Format="R$ #,##0.00"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>

    <!-- Célula Percentual -->
    <Style ss:ID="sCellPercent">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="9" ss:Bold="1" ss:Color="#1E293B"/>
      <NumberFormat ss:Format="0.0%"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>

    <Style ss:ID="sCellPercentZebra">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="9" ss:Bold="1" ss:Color="#1E293B"/>
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
      <NumberFormat ss:Format="0.0%"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>

    <!-- Status de Ocupação & Pagamento -->
    <Style ss:ID="sStatusPaid">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="9" ss:Bold="1" ss:Color="#166534"/>
      <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
      </Borders>
    </Style>

    <Style ss:ID="sStatusPending">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="9" ss:Bold="1" ss:Color="#854D0E"/>
      <Interior ss:Color="#FEF9C3" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FEF08A"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FEF08A"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FEF08A"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FEF08A"/>
      </Borders>
    </Style>

    <Style ss:ID="sStatusDanger">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="9" ss:Bold="1" ss:Color="#991B1B"/>
      <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECACA"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECACA"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECACA"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECACA"/>
      </Borders>
    </Style>

    <Style ss:ID="sStatusOrange">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="9" ss:Bold="1" ss:Color="#9A3412"/>
      <Interior ss:Color="#FFEDD5" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FED7AA"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FED7AA"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FED7AA"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FED7AA"/>
      </Borders>
    </Style>

    <!-- Rodapé de Totais -->
    <Style ss:ID="sTotalRow">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
      <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#0F172A"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0F172A"/>
      </Borders>
    </Style>

    <Style ss:ID="sTotalRowText">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
      <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#0F172A"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0F172A"/>
      </Borders>
    </Style>

    <Style ss:ID="sTotalRowMoney">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
      <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
      <NumberFormat ss:Format="R$ #,##0.00"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#0F172A"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0F172A"/>
      </Borders>
    </Style>

    <Style ss:ID="sTotalRowPercent">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
      <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
      <NumberFormat ss:Format="0.0%"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#0F172A"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0F172A"/>
      </Borders>
    </Style>

    <!-- Card de KPI Resumo -->
    <Style ss:ID="sCardLabel">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="9" ss:Bold="1" ss:Color="#64748B"/>
      <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
      </Borders>
    </Style>

    <Style ss:ID="sCardValueMoney">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="13" ss:Bold="1" ss:Color="#0F172A"/>
      <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
      <NumberFormat ss:Format="R$ #,##0.00"/>
      <Borders>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
      </Borders>
    </Style>

    <Style ss:ID="sCardValueInt">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="13" ss:Bold="1" ss:Color="#0F172A"/>
      <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
      <NumberFormat ss:Format="#,##0"/>
      <Borders>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
      </Borders>
    </Style>
  </Styles>
`;

  // ==========================================
  // ABA 1: RESUMO EXECUTIVO (Painel de KPIs)
  // ==========================================
  xml += `
  <Worksheet ss:Name="Resumo Executivo">
    <Table ss:DefaultRowHeight="20">
      <Column ss:Width="200"/>
      <Column ss:Width="160"/>
      <Column ss:Width="160"/>
      <Column ss:Width="160"/>
      <Column ss:Width="160"/>
      <Column ss:Width="160"/>

      <!-- Banner Superior -->
      <Row ss:Height="36">
        <Cell ss:MergeAcross="5" ss:StyleID="sBanner">
          <Data ss:Type="String">  📊 RELATÓRIO ANALÍTICO DA COMPETIÇÃO — ITGAMES ARENA</Data>
        </Cell>
      </Row>
      <Row ss:Height="22">
        <Cell ss:MergeAcross="5" ss:StyleID="sBannerSubtitle">
          <Data ss:Type="String">  Evento: ${escapeXml(gameName)} (${escapeXml(gameCode)}) | Modalidade: ${escapeXml(gameType)} | Gerado em: ${escapeXml(generationTimestamp)}</Data>
        </Cell>
      </Row>
      <Row ss:Height="12"><Cell><Data ss:Type="String"/></Cell></Row>

      <!-- Metadados do Evento -->
      <Row ss:Height="24">
        <Cell ss:MergeAcross="5" ss:StyleID="sSectionHeader">
          <Data ss:Type="String">  1. INFORMAÇÕES GERAIS DO CAMPEONATO</Data>
        </Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="sCellTextZebra"><Data ss:Type="String">Campeonato Oficial:</Data></Cell>
        <Cell ss:MergeAcross="2" ss:StyleID="sCellText"><Data ss:Type="String">${escapeXml(gameName)}</Data></Cell>
        <Cell ss:StyleID="sCellTextZebra"><Data ss:Type="String">Código do Evento:</Data></Cell>
        <Cell ss:StyleID="sCellText"><Data ss:Type="String">${escapeXml(gameCode)}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="sCellTextZebra"><Data ss:Type="String">Data do Evento:</Data></Cell>
        <Cell ss:MergeAcross="2" ss:StyleID="sCellText"><Data ss:Type="String">${escapeXml(gameDate)}</Data></Cell>
        <Cell ss:StyleID="sCellTextZebra"><Data ss:Type="String">Modalidade Esportiva:</Data></Cell>
        <Cell ss:StyleID="sCellText"><Data ss:Type="String">${escapeXml(gameType)}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="sCellTextZebra"><Data ss:Type="String">Local / Arena:</Data></Cell>
        <Cell ss:MergeAcross="2" ss:StyleID="sCellText"><Data ss:Type="String">${escapeXml(gameLocation)}</Data></Cell>
        <Cell ss:StyleID="sCellTextZebra"><Data ss:Type="String">Chave Pix Oficial:</Data></Cell>
        <Cell ss:StyleID="sCellText"><Data ss:Type="String">${escapeXml(game?.pixKey || 'Não cadastrada')}</Data></Cell>
      </Row>
      <Row ss:Height="14"><Cell><Data ss:Type="String"/></Cell></Row>

      <!-- Seção Financeira -->
      <Row ss:Height="24">
        <Cell ss:MergeAcross="5" ss:StyleID="sSectionHeader">
          <Data ss:Type="String">  2. CONSOLIDAÇÃO FINANCEIRA &amp; RECEITAS</Data>
        </Cell>
      </Row>
      <Row ss:Height="22">
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Métrica Financeira</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Inscrições (Qtd)</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Valor Total (R$)</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">% do Projetado</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="sColHeader"><Data ss:Type="String">Status Operacional</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="sCellText"><Data ss:Type="String">Total Arrecadado (Confirmado / Baixado)</Data></Cell>
        <Cell ss:StyleID="sCellInt"><Data ss:Type="Number">${analytics.paidTeamsCount}</Data></Cell>
        <Cell ss:StyleID="sCellMoney"><Data ss:Type="Number">${analytics.totalPaidAmount}</Data></Cell>
        <Cell ss:StyleID="sCellPercent"><Data ss:Type="Number">${analytics.totalProjectedAmount > 0 ? analytics.totalPaidAmount / analytics.totalProjectedAmount : 0}</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="sStatusPaid"><Data ss:Type="String">CONFIRMADO / EM CAIXA</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="sCellTextZebra"><Data ss:Type="String">A Receber (Inscrições Pendentes)</Data></Cell>
        <Cell ss:StyleID="sCellIntZebra"><Data ss:Type="Number">${analytics.pendingTeamsCount}</Data></Cell>
        <Cell ss:StyleID="sCellMoneyZebra"><Data ss:Type="Number">${analytics.totalPendingAmount}</Data></Cell>
        <Cell ss:StyleID="sCellPercentZebra"><Data ss:Type="Number">${analytics.totalProjectedAmount > 0 ? analytics.totalPendingAmount / analytics.totalProjectedAmount : 0}</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="sStatusPending"><Data ss:Type="String">AGUARDANDO COMPROVANTE</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="sTotalRowText"><Data ss:Type="String">RECEITA TOTAL ATUAL PROJETADA</Data></Cell>
        <Cell ss:StyleID="sTotalRow"><Data ss:Type="Number">${analytics.totalTeamsCount}</Data></Cell>
        <Cell ss:StyleID="sTotalRowMoney"><Data ss:Type="Number">${analytics.totalProjectedAmount}</Data></Cell>
        <Cell ss:StyleID="sTotalRowPercent"><Data ss:Type="Number">1.0</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="sTotalRowText"><Data ss:Type="String">100% DAS INSCRIÇÕES FEITAS</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="sCellTextZebra"><Data ss:Type="String">Potencial Máximo de Arrecadação (Lotação 100%)</Data></Cell>
        <Cell ss:StyleID="sCellIntZebra"><Data ss:Type="Number">${analytics.totalSpotsAvailable ?? analytics.totalTeamsCount}</Data></Cell>
        <Cell ss:StyleID="sCellMoneyZebra"><Data ss:Type="Number">${analytics.totalPotentialMaxAmount}</Data></Cell>
        <Cell ss:StyleID="sCellPercentZebra"><Data ss:Type="Number">${analytics.totalPotentialMaxAmount > 0 ? analytics.totalProjectedAmount / analytics.totalPotentialMaxAmount : 1}</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="sCellCenterZebra"><Data ss:Type="String">${analytics.totalSpotsAvailable ? 'Capacidade Máxima Definida' : 'Vagas Ilimitadas / Livre'}</Data></Cell>
      </Row>
      <Row ss:Height="14"><Cell><Data ss:Type="String"/></Cell></Row>

      <!-- Seção Ocupação & Participação -->
      <Row ss:Height="24">
        <Cell ss:MergeAcross="5" ss:StyleID="sSectionHeader">
          <Data ss:Type="String">  3. INDICADORES DE OCUPAÇÃO &amp; PARTICIPAÇÃO</Data>
        </Cell>
      </Row>
      <Row ss:Height="22">
        <Cell ss:MergeAcross="1" ss:StyleID="sColHeader"><Data ss:Type="String">Indicador</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="sColHeader"><Data ss:Type="String">Valor Realizado</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="sColHeader"><Data ss:Type="String">Observações</Data></Cell>
      </Row>
      <Row>
        <Cell ss:MergeAcross="1" ss:StyleID="sCellText"><Data ss:Type="String">Total de Equipes / Inscrições Cadastradas</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="sCellInt"><Data ss:Type="Number">${analytics.totalTeamsCount}</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="sCellText"><Data ss:Type="String">${analytics.paidTeamsCount} pagas e ${analytics.pendingTeamsCount} pendentes</Data></Cell>
      </Row>
      <Row>
        <Cell ss:MergeAcross="1" ss:StyleID="sCellTextZebra"><Data ss:Type="String">Total de Atletas / Competidores no Evento</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="sCellIntZebra"><Data ss:Type="Number">${analytics.totalAthletesCount}</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="sCellTextZebra"><Data ss:Type="String">Média de ${(analytics.totalAthletesCount / (analytics.totalTeamsCount || 1)).toFixed(1)} atletas por equipe</Data></Cell>
      </Row>
      <Row>
        <Cell ss:MergeAcross="1" ss:StyleID="sCellText"><Data ss:Type="String">Total de Categorias no Campeonato</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="sCellInt"><Data ss:Type="Number">${categories.length}</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="sCellText"><Data ss:Type="String">Divisões oficiais cadastradas</Data></Cell>
      </Row>
      <Row>
        <Cell ss:MergeAcross="1" ss:StyleID="sCellTextZebra"><Data ss:Type="String">Capacidade Total de Vagas Oferecidas</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="sCellCenterZebra"><Data ss:Type="String">${analytics.totalSpotsAvailable !== null ? analytics.totalSpotsAvailable : 'Sem Limite (Livre)'}</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="sCellTextZebra"><Data ss:Type="String">${analytics.totalSpotsAvailable ? 'Soma das vagas configuradas por categoria' : 'Nenhum limite rígido cadastrado'}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:MergeAcross="1" ss:StyleID="sTotalRowText"><Data ss:Type="String">TAXA GLOBAL DE OCUPAÇÃO DO CAMPEONATO</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="sTotalRowPercent"><Data ss:Type="Number">${analytics.globalOccupancyPercent !== null ? analytics.globalOccupancyPercent / 100 : 1}</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="sTotalRowText"><Data ss:Type="String">${analytics.globalOccupancyPercent !== null ? `${analytics.totalTeamsCount} vagas preenchidas de ${analytics.totalSpotsAvailable}` : 'Livre'}</Data></Cell>
      </Row>
      <Row ss:Height="14"><Cell><Data ss:Type="String"/></Cell></Row>

      <!-- Grade de Camisetas e Kits -->
      <Row ss:Height="24">
        <Cell ss:MergeAcross="5" ss:StyleID="sSectionHeader">
          <Data ss:Type="String">  4. GRADE LOGÍSTICA DE KITS &amp; CAMISETAS</Data>
        </Cell>
      </Row>
      <Row ss:Height="22">
        <Cell ss:MergeAcross="1" ss:StyleID="sColHeader"><Data ss:Type="String">Tamanho da Camiseta</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="sColHeader"><Data ss:Type="String">Quantidade Necessária</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="sColHeader"><Data ss:Type="String">% da Grade</Data></Cell>
      </Row>`;

  let totalShirts = 0;
  Object.values(analytics.tshirtCounts).forEach((c) => (totalShirts += c));

  Object.entries(analytics.tshirtCounts).forEach(([size, count], idx) => {
    const isZebra = idx % 2 === 1;
    const pct = totalShirts > 0 ? count / totalShirts : 0;
    xml += `
      <Row>
        <Cell ss:MergeAcross="1" ss:StyleID="${isZebra ? 'sCellCenterZebra' : 'sCellCenter'}"><Data ss:Type="String">${escapeXml(size)}</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="${isZebra ? 'sCellIntZebra' : 'sCellInt'}"><Data ss:Type="Number">${count}</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="${isZebra ? 'sCellPercentZebra' : 'sCellPercent'}"><Data ss:Type="Number">${pct}</Data></Cell>
      </Row>`;
  });

  xml += `
      <Row>
        <Cell ss:MergeAcross="1" ss:StyleID="sTotalRowText"><Data ss:Type="String">TOTAL DE CAMISETAS / KITS</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="sTotalRow"><Data ss:Type="Number">${totalShirts}</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="sTotalRowPercent"><Data ss:Type="Number">1.0</Data></Cell>
      </Row>
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <FreezePanes/>
      <FrozenNoSplit/>
      <SplitHorizontal>2</SplitHorizontal>
      <TopRowBottomPane>2</TopRowBottomPane>
      <ActivePane>2</ActivePane>
    </WorksheetOptions>
  </Worksheet>
`;

  // ==========================================
  // ABA 2: OCUPAÇÃO POR CATEGORIA (Analítico Central)
  // ==========================================
  xml += `
  <Worksheet ss:Name="Ocupacao por Categoria">
    <Table ss:DefaultRowHeight="20">
      <Column ss:Width="200"/> <!-- Categoria -->
      <Column ss:Width="90"/>  <!-- Formato -->
      <Column ss:Width="110"/> <!-- Composição -->
      <Column ss:Width="100"/> <!-- Valor Un. -->
      <Column ss:Width="80"/>  <!-- Vagas Totais -->
      <Column ss:Width="80"/>  <!-- Confirmadas -->
      <Column ss:Width="80"/>  <!-- Pendentes -->
      <Column ss:Width="85"/>  <!-- Total Inscritos -->
      <Column ss:Width="80"/>  <!-- Vagas Restantes -->
      <Column ss:Width="95"/>  <!-- % Ocupação -->
      <Column ss:Width="100"/> <!-- Status -->
      <Column ss:Width="80"/>  <!-- Atletas -->
      <Column ss:Width="110"/> <!-- Arrecadado -->
      <Column ss:Width="110"/> <!-- A Receber -->
      <Column ss:Width="115"/> <!-- Receita Total -->

      <!-- Header -->
      <Row ss:Height="30">
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Categoria Oficial</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Formato</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Gênero / Tipo</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Valor Inscr. (R$)</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Vagas Limite</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Pagas (Conf.)</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Pendentes</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Total Inscritos</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Vagas Livres</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Taxa Ocupação</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Status</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Total Atletas</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Arrecadado (R$)</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">A Receber (R$)</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Receita Projetada</Data></Cell>
      </Row>
`;

  let sumSpots = 0;
  let sumPaid = 0;
  let sumPending = 0;
  let sumTotal = 0;
  let sumFree = 0;
  let sumAthletes = 0;
  let sumCollected = 0;
  let sumToCollect = 0;
  let sumProjected = 0;

  analytics.categoryRows.forEach((row, idx) => {
    const isZebra = idx % 2 === 1;
    const txtStyle = isZebra ? 'sCellTextZebra' : 'sCellText';
    const centerStyle = isZebra ? 'sCellCenterZebra' : 'sCellCenter';
    const intStyle = isZebra ? 'sCellIntZebra' : 'sCellInt';
    const moneyStyle = isZebra ? 'sCellMoneyZebra' : 'sCellMoney';
    const pctStyle = isZebra ? 'sCellPercentZebra' : 'sCellPercent';

    sumSpots += row.spotsTotal || 0;
    sumPaid += row.paidTeamsCount;
    sumPending += row.pendingTeamsCount;
    sumTotal += row.totalTeamsCount;
    sumFree += row.spotsRemaining || 0;
    sumAthletes += row.totalAthletesCount;
    sumCollected += row.revenueCollected;
    sumToCollect += row.revenuePending;
    sumProjected += row.projectedRevenue;

    // Estilo de status
    let statusStyle = centerStyle;
    if (row.status === 'Esgotado') statusStyle = 'sStatusDanger';
    else if (row.status === 'Alta Demanda') statusStyle = 'sStatusOrange';
    else if (row.status === 'Moderada') statusStyle = 'sStatusPending';
    else if (row.status === 'Aberta') statusStyle = 'sStatusPaid';

    xml += `
      <Row>
        <Cell ss:StyleID="${txtStyle}"><Data ss:Type="String">${escapeXml(row.categoryName)}</Data></Cell>
        <Cell ss:StyleID="${centerStyle}"><Data ss:Type="String">${escapeXml(row.teamFormat)}</Data></Cell>
        <Cell ss:StyleID="${centerStyle}"><Data ss:Type="String">${escapeXml(row.genderComposition)}</Data></Cell>
        <Cell ss:StyleID="${moneyStyle}"><Data ss:Type="Number">${row.price}</Data></Cell>
        <Cell ss:StyleID="${row.spotsTotal !== null ? intStyle : centerStyle}"><Data ss:Type="${row.spotsTotal !== null ? 'Number' : 'String'}">${row.spotsTotal !== null ? row.spotsTotal : 'Livre'}</Data></Cell>
        <Cell ss:StyleID="${intStyle}"><Data ss:Type="Number">${row.paidTeamsCount}</Data></Cell>
        <Cell ss:StyleID="${intStyle}"><Data ss:Type="Number">${row.pendingTeamsCount}</Data></Cell>
        <Cell ss:StyleID="${intStyle}"><Data ss:Type="Number">${row.totalTeamsCount}</Data></Cell>
        <Cell ss:StyleID="${row.spotsRemaining !== null ? intStyle : centerStyle}"><Data ss:Type="${row.spotsRemaining !== null ? 'Number' : 'String'}">${row.spotsRemaining !== null ? row.spotsRemaining : '—'}</Data></Cell>
        <Cell ss:StyleID="${row.occupancyPercent !== null ? pctStyle : centerStyle}"><Data ss:Type="${row.occupancyPercent !== null ? 'Number' : 'String'}">${row.occupancyPercent !== null ? (row.occupancyPercent / 100) : '—'}</Data></Cell>
        <Cell ss:StyleID="${statusStyle}"><Data ss:Type="String">${escapeXml(row.status)}</Data></Cell>
        <Cell ss:StyleID="${intStyle}"><Data ss:Type="Number">${row.totalAthletesCount}</Data></Cell>
        <Cell ss:StyleID="${moneyStyle}"><Data ss:Type="Number">${row.revenueCollected}</Data></Cell>
        <Cell ss:StyleID="${moneyStyle}"><Data ss:Type="Number">${row.revenuePending}</Data></Cell>
        <Cell ss:StyleID="${moneyStyle}"><Data ss:Type="Number">${row.projectedRevenue}</Data></Cell>
      </Row>`;
  });

  // Linha de Totais da Categoria
  const avgOccupancy = sumSpots > 0 ? (sumTotal / sumSpots) : 0;
  xml += `
      <Row ss:Height="24">
        <Cell ss:StyleID="sTotalRowText"><Data ss:Type="String">TOTAL GERAL CONSOLIDADO</Data></Cell>
        <Cell ss:StyleID="sTotalRowText"><Data ss:Type="String">—</Data></Cell>
        <Cell ss:StyleID="sTotalRowText"><Data ss:Type="String">—</Data></Cell>
        <Cell ss:StyleID="sTotalRowText"><Data ss:Type="String">—</Data></Cell>
        <Cell ss:StyleID="sTotalRow"><Data ss:Type="Number">${sumSpots}</Data></Cell>
        <Cell ss:StyleID="sTotalRow"><Data ss:Type="Number">${sumPaid}</Data></Cell>
        <Cell ss:StyleID="sTotalRow"><Data ss:Type="Number">${sumPending}</Data></Cell>
        <Cell ss:StyleID="sTotalRow"><Data ss:Type="Number">${sumTotal}</Data></Cell>
        <Cell ss:StyleID="sTotalRow"><Data ss:Type="Number">${sumFree}</Data></Cell>
        <Cell ss:StyleID="sTotalRowPercent"><Data ss:Type="Number">${avgOccupancy}</Data></Cell>
        <Cell ss:StyleID="sTotalRowText"><Data ss:Type="String">${avgOccupancy >= 1 ? 'ESGOTADO' : avgOccupancy >= 0.8 ? 'ALTA' : 'NORMAL'}</Data></Cell>
        <Cell ss:StyleID="sTotalRow"><Data ss:Type="Number">${sumAthletes}</Data></Cell>
        <Cell ss:StyleID="sTotalRowMoney"><Data ss:Type="Number">${sumCollected}</Data></Cell>
        <Cell ss:StyleID="sTotalRowMoney"><Data ss:Type="Number">${sumToCollect}</Data></Cell>
        <Cell ss:StyleID="sTotalRowMoney"><Data ss:Type="Number">${sumProjected}</Data></Cell>
      </Row>
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <FreezePanes/>
      <FrozenNoSplit/>
      <SplitHorizontal>1</SplitHorizontal>
      <TopRowBottomPane>1</TopRowBottomPane>
      <ActivePane>2</ActivePane>
    </WorksheetOptions>
  </Worksheet>
`;

  // ==========================================
  // ABA 3: INSCRIÇÕES DETALHADAS (Equipes)
  // ==========================================
  xml += `
  <Worksheet ss:Name="Inscricoes Detalhadas">
    <Table ss:DefaultRowHeight="20">
      <Column ss:Width="70"/>  <!-- BIB -->
      <Column ss:Width="180"/> <!-- Equipe / Competidor -->
      <Column ss:Width="150"/> <!-- Categoria -->
      <Column ss:Width="95"/>  <!-- Status Pgto -->
      <Column ss:Width="95"/>  <!-- Valor Inscr. -->
      <Column ss:Width="90"/>  <!-- Check-in -->
      <Column ss:Width="140"/> <!-- Box / Afiliação -->
      <Column ss:Width="70"/>  <!-- Qtd Atletas -->
      <Column ss:Width="250"/> <!-- Integrantes -->
      <Column ss:Width="220"/> <!-- Camisetas / Kits -->
      <Column ss:Width="110"/> <!-- Telefone Contato -->
      <Column ss:Width="160"/> <!-- E-mail Responsável -->
      <Column ss:Width="90"/>  <!-- Data Inscrição -->

      <!-- Header -->
      <Row ss:Height="28">
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">BIB</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Equipe / Competidor</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Categoria</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Status Pagamento</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Valor (R$)</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Check-in Evento</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Box / Afiliação</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Integrantes</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Nomes dos Atletas</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Camisetas (Kits)</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Telefone</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">E-mail</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Data Inscrição</Data></Cell>
      </Row>
`;

  teams.forEach((t, idx) => {
    const isZebra = idx % 2 === 1;
    const txtStyle = isZebra ? 'sCellTextZebra' : 'sCellText';
    const centerStyle = isZebra ? 'sCellCenterZebra' : 'sCellCenter';
    const intStyle = isZebra ? 'sCellIntZebra' : 'sCellInt';
    const moneyStyle = isZebra ? 'sCellMoneyZebra' : 'sCellMoney';

    const isPaid = t.paymentStatus === 'paid' || t.paymentStatus === 'free';
    const cat = categories.find((c) => String(c.id) === String(t.categoryId));
    const amountVal = isPaid ? (t.amountPaid || (cat as any)?.priceBrl || cat?.price || 150) : ((cat as any)?.priceBrl || cat?.price || 150);

    const athletesNames = (t.athletes || []).map((a) => a.name).join('; ');
    const athletesShirts = (t.athletes || []).map((a) => `${a.name} (${a.tshirtSize || 'M'})`).join('; ');
    const box = t.athletes?.[0]?.boxOrAffiliate || 'Box Filiada';
    const phone = t.athletes?.[0]?.phone || '—';
    const email = t.athletes?.[0]?.email || '—';
    const regDate = formatDate(t.registeredAt);

    xml += `
      <Row>
        <Cell ss:StyleID="${centerStyle}"><Data ss:Type="String">${escapeXml(t.registerNumber)}</Data></Cell>
        <Cell ss:StyleID="${txtStyle}"><Data ss:Type="String">${escapeXml(t.teamName)}</Data></Cell>
        <Cell ss:StyleID="${txtStyle}"><Data ss:Type="String">${escapeXml(t.categoryName || cat?.name || t.categoryId)}</Data></Cell>
        <Cell ss:StyleID="${isPaid ? 'sStatusPaid' : 'sStatusPending'}"><Data ss:Type="String">${isPaid ? 'PAGO' : 'PENDENTE'}</Data></Cell>
        <Cell ss:StyleID="${moneyStyle}"><Data ss:Type="Number">${amountVal}</Data></Cell>
        <Cell ss:StyleID="${t.checkedIn ? 'sStatusPaid' : centerStyle}"><Data ss:Type="String">${t.checkedIn ? 'CONFIRMADO' : 'PENDENTE'}</Data></Cell>
        <Cell ss:StyleID="${txtStyle}"><Data ss:Type="String">${escapeXml(box)}</Data></Cell>
        <Cell ss:StyleID="${intStyle}"><Data ss:Type="Number">${t.athletes?.length || 1}</Data></Cell>
        <Cell ss:StyleID="${txtStyle}"><Data ss:Type="String">${escapeXml(athletesNames)}</Data></Cell>
        <Cell ss:StyleID="${txtStyle}"><Data ss:Type="String">${escapeXml(athletesShirts)}</Data></Cell>
        <Cell ss:StyleID="${centerStyle}"><Data ss:Type="String">${escapeXml(phone)}</Data></Cell>
        <Cell ss:StyleID="${txtStyle}"><Data ss:Type="String">${escapeXml(email)}</Data></Cell>
        <Cell ss:StyleID="${centerStyle}"><Data ss:Type="String">${escapeXml(regDate)}</Data></Cell>
      </Row>`;
  });

  xml += `
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <FreezePanes/>
      <FrozenNoSplit/>
      <SplitHorizontal>1</SplitHorizontal>
      <TopRowBottomPane>1</TopRowBottomPane>
      <ActivePane>2</ActivePane>
    </WorksheetOptions>
  </Worksheet>
`;

  // ==========================================
  // ABA 4: GRADE NOMINAL DE ATLETAS E KITS
  // ==========================================
  xml += `
  <Worksheet ss:Name="Grade Atletas e Kits">
    <Table ss:DefaultRowHeight="20">
      <Column ss:Width="70"/>  <!-- BIB -->
      <Column ss:Width="160"/> <!-- Equipe -->
      <Column ss:Width="140"/> <!-- Categoria -->
      <Column ss:Width="180"/> <!-- Nome Atleta -->
      <Column ss:Width="110"/> <!-- CPF -->
      <Column ss:Width="60"/>  <!-- Gênero -->
      <Column ss:Width="90"/>  <!-- Camiseta -->
      <Column ss:Width="95"/>  <!-- Check-in Atleta -->
      <Column ss:Width="110"/> <!-- Telefone -->
      <Column ss:Width="160"/> <!-- E-mail -->
      <Column ss:Width="140"/> <!-- Box -->

      <!-- Header -->
      <Row ss:Height="28">
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">BIB</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Equipe</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Categoria</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Nome Completo do Atleta</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">CPF</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Gênero</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Camiseta (Kit)</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Check-in Individual</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Telefone</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">E-mail</Data></Cell>
        <Cell ss:StyleID="sColHeader"><Data ss:Type="String">Box / Afiliação</Data></Cell>
      </Row>
`;

  let athleteRowIndex = 0;
  teams.forEach((t) => {
    const cat = categories.find((c) => String(c.id) === String(t.categoryId));
    const catLabel = t.categoryName || cat?.name || t.categoryId;

    (t.athletes || []).forEach((a) => {
      const isZebra = athleteRowIndex % 2 === 1;
      athleteRowIndex++;
      const txtStyle = isZebra ? 'sCellTextZebra' : 'sCellText';
      const centerStyle = isZebra ? 'sCellCenterZebra' : 'sCellCenter';

      xml += `
      <Row>
        <Cell ss:StyleID="${centerStyle}"><Data ss:Type="String">${escapeXml(t.registerNumber)}</Data></Cell>
        <Cell ss:StyleID="${txtStyle}"><Data ss:Type="String">${escapeXml(t.teamName)}</Data></Cell>
        <Cell ss:StyleID="${txtStyle}"><Data ss:Type="String">${escapeXml(catLabel)}</Data></Cell>
        <Cell ss:StyleID="${txtStyle}"><Data ss:Type="String">${escapeXml(a.name)}</Data></Cell>
        <Cell ss:StyleID="${centerStyle}"><Data ss:Type="String">${escapeXml(a.cpf || '—')}</Data></Cell>
        <Cell ss:StyleID="${centerStyle}"><Data ss:Type="String">${escapeXml(a.gender || 'M')}</Data></Cell>
        <Cell ss:StyleID="${centerStyle}"><Data ss:Type="String">${escapeXml(a.tshirtSize || 'M')}</Data></Cell>
        <Cell ss:StyleID="${a.checkIn ? 'sStatusPaid' : centerStyle}"><Data ss:Type="String">${a.checkIn ? 'CONFIRMADO' : 'PENDENTE'}</Data></Cell>
        <Cell ss:StyleID="${centerStyle}"><Data ss:Type="String">${escapeXml(a.phone || '—')}</Data></Cell>
        <Cell ss:StyleID="${txtStyle}"><Data ss:Type="String">${escapeXml(a.email || '—')}</Data></Cell>
        <Cell ss:StyleID="${txtStyle}"><Data ss:Type="String">${escapeXml(a.boxOrAffiliate || t.athletes?.[0]?.boxOrAffiliate || 'Box Filiada')}</Data></Cell>
      </Row>`;
    });
  });

  xml += `
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <FreezePanes/>
      <FrozenNoSplit/>
      <SplitHorizontal>1</SplitHorizontal>
      <TopRowBottomPane>1</TopRowBottomPane>
      <ActivePane>2</ActivePane>
    </WorksheetOptions>
  </Worksheet>
</Workbook>`;

  // Criar Blob binário e disparar download seguro sem cortar caracteres '#'
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `relatorio_analitico_${gameCode.toLowerCase()}_${Date.now()}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exportação em CSV Estruturado (Padrão Excel Brasil com separador ';' e UTF-8 BOM).
 * Utiliza Blob para prevenir truncamento de dados com caracteres '#'.
 */
export function exportRegistrationsCSV(
  game: GameEvent | null,
  categories: Category[],
  teams: TeamRegistration[]
) {
  const headers = [
    'BIB',
    'Equipe/Atleta',
    'Categoria',
    'Status Pagamento',
    'Valor Inscrição (R$)',
    'Check-in Evento',
    'Box/Afiliação',
    'Total Integrantes',
    'Nomes dos Atletas',
    'Camisetas (Kits)',
    'Telefone Contato',
    'E-mail',
    'Data Inscrição'
  ];

  const rows = teams.map((t) => {
    const isPaid = t.paymentStatus === 'paid' || t.paymentStatus === 'free';
    const cat = categories.find((c) => String(c.id) === String(t.categoryId));
    const amountVal = isPaid ? (t.amountPaid || (cat as any)?.priceBrl || cat?.price || 150) : ((cat as any)?.priceBrl || cat?.price || 150);

    const athletesNames = (t.athletes || []).map((a) => a.name).join(' / ');
    const athletesShirts = (t.athletes || []).map((a) => `${a.name} (${a.tshirtSize || 'M'})`).join(' / ');
    const box = t.athletes?.[0]?.boxOrAffiliate || 'Box Filiada';
    const phone = t.athletes?.[0]?.phone || '—';
    const email = t.athletes?.[0]?.email || '—';
    const regDate = formatDate(t.registeredAt);

    return [
      t.registerNumber,
      `"${t.teamName.replace(/"/g, '""')}"`,
      `"${(t.categoryName || cat?.name || t.categoryId).replace(/"/g, '""')}"`,
      isPaid ? 'PAGO' : 'PENDENTE',
      amountVal.toFixed(2).replace('.', ','),
      t.checkedIn ? 'CONFIRMADO' : 'PENDENTE',
      `"${box.replace(/"/g, '""')}"`,
      (t.athletes?.length || 1).toString(),
      `"${athletesNames.replace(/"/g, '""')}"`,
      `"${athletesShirts.replace(/"/g, '""')}"`,
      `"${phone.replace(/"/g, '""')}"`,
      `"${email.replace(/"/g, '""')}"`,
      regDate
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `inscricoes_${game?.code?.toLowerCase() || 'campeonato'}_${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


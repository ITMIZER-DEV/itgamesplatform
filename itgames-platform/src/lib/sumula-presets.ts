import { SumulaTemplate } from '@/types';

export const DEFAULT_SUMULA_TEMPLATES: SumulaTemplate[] = [
  {
    id: 'crossfit-for-time',
    name: 'CrossFit - Padrão For Time & AMRAP',
    type: 'crossfit',
    workoutType: 'for_time',
    isDefault: true,
    createdAt: new Date().toISOString(),
    htmlContent: `
<div class="sumula-card" style="font-family: Arial, sans-serif; max-width: 190mm; margin: 0 auto; border: 2px solid #000; padding: 14px; background: #fff; color: #000;">
  <!-- CABEÇALHO -->
  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <img src="/brand/logo-itgames-black.png" alt="ITGAMES" style="height: 32px; width: auto; object-fit: contain;" />
      <div>
        <h1 style="font-size: 16px; font-weight: 900; margin: 0; text-transform: uppercase;">#GAMENAME#</h1>
        <p style="font-size: 11px; margin: 2px 0 0 0; color: #333;">SÚMULA OFICIAL DE PROVA | #CATEGORYNAME#</p>
      </div>
    </div>
    <div style="text-align: right; background: #000; color: #fff; padding: 4px 10px; border-radius: 4px;">
      <span style="font-size: 14px; font-weight: bold;">INSCRIÇÃO: #REGISTERNUMBER#</span>
    </div>
  </div>

  <!-- DADOS DA BATERIA E RAIA -->
  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; background: #f2f2f2; padding: 8px; border-radius: 4px; margin-bottom: 12px; border: 1px solid #ddd;">
    <div><strong>BATERIA (HEAT):</strong> <span style="font-size: 14px; font-weight: bold; color: #d97706;">#HEAT_NUMBER#</span></div>
    <div><strong>RAIA (LANE):</strong> <span style="font-size: 14px; font-weight: bold; color: #2563eb;">#LANE_NUMBER#</span></div>
    <div><strong>HORÁRIO PREVISTO:</strong> #HEAT_TIME#</div>
  </div>

  <!-- IDENTIFICAÇÃO DO TIME / ATLETA -->
  <div style="border: 1px solid #000; padding: 8px; margin-bottom: 12px;">
    <div style="font-size: 14px; font-weight: bold; margin-bottom: 4px;">EQUIPE / ATLETA: #TEAMNAME#</div>
    <div style="font-size: 12px; color: #222;"><strong>Integrantes:</strong> #ATHLETES_LIST#</div>
    <div style="font-size: 11px; color: #555;"><strong>Box / Afiliação:</strong> #BOX_AFFILIATE#</div>
  </div>

  <!-- INFORMAÇÕES DO WORKOUT -->
  <div style="border-left: 4px solid #000; padding-left: 8px; margin-bottom: 12px;">
    <h2 style="font-size: 14px; margin: 0 0 4px 0; font-weight: bold;">PROVA: #EVENTTITLE#</h2>
    <div style="font-size: 11px; color: #444; line-height: 1.4;">#WORKOUT_DESCRIPTION#</div>
    <div style="font-size: 11px; margin-top: 4px;"><strong>TIME CAP:</strong> #TIME_CAP# | <strong>CRITÉRIO DE DESEMPATE:</strong> #TIE_BREAK_RULE#</div>
  </div>

  <!-- GRID DE CONTAGEM DE REPS / ROUNDS -->
  <div style="margin-bottom: 14px;">
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: center;" border="1">
      <thead>
        <tr style="background: #e5e7eb;">
          <th style="padding: 5px;">ROUND / BLOCO</th>
          <th style="padding: 5px;">MOVIMENTO & CARGA</th>
          <th style="padding: 5px; width: 80px;">REPS PREVISTAS</th>
          <th style="padding: 5px; width: 120px;">CHECKPOINT / TEMPO</th>
          <th style="padding: 5px; width: 90px;">VISTO JUIZ</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 8px;">ROUND 1</td>
          <td style="text-align: left; padding: 4px 8px;">Conforme briefing oficial da categoria</td>
          <td>-</td>
          <td>____ : ____</td>
          <td>[ &nbsp; ]</td>
        </tr>
        <tr>
          <td style="padding: 8px;">ROUND 2</td>
          <td style="text-align: left; padding: 4px 8px;">Conforme briefing oficial da categoria</td>
          <td>-</td>
          <td>____ : ____</td>
          <td>[ &nbsp; ]</td>
        </tr>
        <tr>
          <td style="padding: 8px;">ROUND 3</td>
          <td style="text-align: left; padding: 4px 8px;">Conforme briefing oficial da categoria</td>
          <td>-</td>
          <td>____ : ____</td>
          <td>[ &nbsp; ]</td>
        </tr>
        <tr>
          <td style="padding: 8px;">ROUND 4 (Se houver)</td>
          <td style="text-align: left; padding: 4px 8px;">Conforme briefing oficial da categoria</td>
          <td>-</td>
          <td>____ : ____</td>
          <td>[ &nbsp; ]</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- ÁREA DE REGISTRO DO RESULTADO FINAL -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; border: 2px dashed #000; padding: 10px; margin-bottom: 14px; background: #fafafa;">
    <div>
      <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px;">TEMPO FINAL / REPS TOTAIS:</div>
      <div style="font-size: 20px; font-weight: 900; border-bottom: 2px solid #000; padding-bottom: 2px;">
        ____ : ____ . ____
      </div>
      <div style="font-size: 10px; color: #666; margin-top: 4px;">(Caso Time Cap: registrar Repetições restantes)</div>
    </div>
    <div>
      <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px;">TEMPO DE TIE-BREAK:</div>
      <div style="font-size: 18px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 2px;">
        ____ : ____
      </div>
      <div style="font-size: 10px; color: #666; margin-top: 4px;">Penalidades: + _____ seg (Motivo: ________________)</div>
    </div>
  </div>

  <!-- ASSINATURAS -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px; padding-top: 10px; border-top: 1px solid #aaa;">
    <div style="text-align: center;">
      <div style="border-top: 1px solid #000; margin-top: 25px; padding-top: 4px; font-size: 11px;">
        <strong>ASSINATURA DO JUIZ DE CAMPO</strong><br/>
        Nome: ____________________________
      </div>
    </div>
    <div style="text-align: center;">
      <div style="border-top: 1px solid #000; margin-top: 25px; padding-top: 4px; font-size: 11px;">
        <strong>VISTO / ASSINATURA DO ATLETA (CAPITÃO)</strong><br/>
        (Concordo com o resultado anotado acima)
      </div>
    </div>
  </div>
</div>
    `
  },
  {
    id: 'hyrox-official-splits',
    name: 'HYROX - 8 Estações + Roxzone & Corridas',
    type: 'hyrox',
    workoutType: 'hyrox_standard',
    isDefault: true,
    createdAt: new Date().toISOString(),
    htmlContent: `
<div class="sumula-card" style="font-family: Arial, sans-serif; max-width: 190mm; margin: 0 auto; border: 2px solid #eab308; padding: 14px; background: #fff; color: #000;">
  <!-- CABEÇALHO HYROX STYLE -->
  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #eab308; padding-bottom: 8px; margin-bottom: 10px;">
    <div>
      <h1 style="font-size: 20px; font-weight: 900; margin: 0; color: #000; letter-spacing: 1px;">#GAMENAME# • HYROX RACE</h1>
      <p style="font-size: 12px; margin: 2px 0 0 0; color: #555;">SÚMULA OFICIAL DE TEMPOS E SPLITS | #CATEGORYNAME#</p>
    </div>
    <div style="text-align: right; background: #eab308; color: #000; padding: 4px 12px; border-radius: 4px; font-weight: 900;">
      BIB / PEITO: #REGISTERNUMBER#
    </div>
  </div>

  <!-- DADOS DO ATLETA E LARGADA -->
  <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px; background: #fefce8; padding: 8px; border-radius: 4px; margin-bottom: 12px; border: 1px solid #fef08a;">
    <div><strong>ATLETA / DUPLA:</strong> <span style="font-size: 13px; font-weight: bold;">#TEAMNAME#</span> (#ATHLETES_LIST#)</div>
    <div><strong>WAVE (ONDA):</strong> <span style="font-weight: bold; color: #b45309;">#HEAT_NUMBER#</span></div>
    <div><strong>LARGADA:</strong> #HEAT_TIME#</div>
  </div>

  <!-- TABELA DAS 8 ESTAÇÕES HYROX -->
  <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px;" border="1">
    <thead>
      <tr style="background: #000; color: #fff; text-align: center;">
        <th style="padding: 6px; width: 40px;">ETAPA</th>
        <th style="padding: 6px; text-align: left;">DESAFIO / ESTAÇÃO</th>
        <th style="padding: 6px; width: 95px;">TEMPO CORRIDA 1KM</th>
        <th style="padding: 6px; width: 95px;">TEMPO ESTAÇÃO</th>
        <th style="padding: 6px; width: 70px;">PENALIDADE</th>
        <th style="padding: 6px; width: 50px;">VISTO</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="text-align: center; font-weight: bold;">1</td>
        <td style="padding: 4px 6px;">1km Run + <strong>1000m SkiErg</strong></td>
        <td style="text-align: center;">___ : ___</td>
        <td style="text-align: center;">___ : ___</td>
        <td style="text-align: center;">+ ___ seg</td>
        <td style="text-align: center;">[ &nbsp; ]</td>
      </tr>
      <tr>
        <td style="text-align: center; font-weight: bold;">2</td>
        <td style="padding: 4px 6px;">1km Run + <strong>50m Sled Push</strong></td>
        <td style="text-align: center;">___ : ___</td>
        <td style="text-align: center;">___ : ___</td>
        <td style="text-align: center;">+ ___ seg</td>
        <td style="text-align: center;">[ &nbsp; ]</td>
      </tr>
      <tr>
        <td style="text-align: center; font-weight: bold;">3</td>
        <td style="padding: 4px 6px;">1km Run + <strong>50m Sled Pull</strong></td>
        <td style="text-align: center;">___ : ___</td>
        <td style="text-align: center;">___ : ___</td>
        <td style="text-align: center;">+ ___ seg</td>
        <td style="text-align: center;">[ &nbsp; ]</td>
      </tr>
      <tr>
        <td style="text-align: center; font-weight: bold;">4</td>
        <td style="padding: 4px 6px;">1km Run + <strong>80m Burpee Broad Jumps</strong></td>
        <td style="text-align: center;">___ : ___</td>
        <td style="text-align: center;">___ : ___</td>
        <td style="text-align: center;">+ ___ seg</td>
        <td style="text-align: center;">[ &nbsp; ]</td>
      </tr>
      <tr>
        <td style="text-align: center; font-weight: bold;">5</td>
        <td style="padding: 4px 6px;">1km Run + <strong>1000m Rowing</strong></td>
        <td style="text-align: center;">___ : ___</td>
        <td style="text-align: center;">___ : ___</td>
        <td style="text-align: center;">+ ___ seg</td>
        <td style="text-align: center;">[ &nbsp; ]</td>
      </tr>
      <tr>
        <td style="text-align: center; font-weight: bold;">6</td>
        <td style="padding: 4px 6px;">1km Run + <strong>200m Farmers Carry</strong></td>
        <td style="text-align: center;">___ : ___</td>
        <td style="text-align: center;">___ : ___</td>
        <td style="text-align: center;">+ ___ seg</td>
        <td style="text-align: center;">[ &nbsp; ]</td>
      </tr>
      <tr>
        <td style="text-align: center; font-weight: bold;">7</td>
        <td style="padding: 4px 6px;">1km Run + <strong>100m Sandbag Lunges</strong></td>
        <td style="text-align: center;">___ : ___</td>
        <td style="text-align: center;">___ : ___</td>
        <td style="text-align: center;">+ ___ seg</td>
        <td style="text-align: center;">[ &nbsp; ]</td>
      </tr>
      <tr>
        <td style="text-align: center; font-weight: bold;">8</td>
        <td style="padding: 4px 6px;">1km Run + <strong>100 / 75 Wall Balls</strong></td>
        <td style="text-align: center;">___ : ___</td>
        <td style="text-align: center;">___ : ___</td>
        <td style="text-align: center;">+ ___ seg</td>
        <td style="text-align: center;">[ &nbsp; ]</td>
      </tr>
    </tbody>
  </table>

  <!-- TOTAL FINAL HYROX -->
  <div style="background: #000; color: #fff; padding: 10px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
    <div>
      <div style="font-size: 11px; text-transform: uppercase; color: #eab308; font-weight: bold;">TEMPO OFICIAL LÍQUIDO (TOTAL RACE TIME)</div>
      <div style="font-size: 22px; font-weight: 900;">____ h ____ min ____ seg</div>
    </div>
    <div style="text-align: right; font-size: 11px;">
      ROXZONE TOTAL: ____ min ____ seg<br/>
      PENALIDADES TOTAIS: + ____ seg
    </div>
  </div>

  <!-- ASSINATURAS -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 11px; text-align: center; margin-top: 10px;">
    <div>
      <div style="border-top: 1px solid #000; margin-top: 20px; padding-top: 4px;">
        <strong>FISCAL GERAL / HEAD JUDGE</strong>
      </div>
    </div>
    <div>
      <div style="border-top: 1px solid #000; margin-top: 20px; padding-top: 4px;">
        <strong>ATLETA (CONFERÊNCIA)</strong>
      </div>
    </div>
  </div>
</div>
    `
  },
  {
    id: 'crossfit-max-load',
    name: 'CrossFit - Carga Máxima (1RM & Complex)',
    type: 'crossfit',
    workoutType: 'max_load',
    isDefault: false,
    createdAt: new Date().toISOString(),
    htmlContent: `
<div class="sumula-card" style="font-family: Arial, sans-serif; max-width: 190mm; margin: 0 auto; border: 2px solid #000; padding: 14px; background: #fff; color: #000;">
  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px;">
    <div>
      <h1 style="font-size: 18px; font-weight: 900; margin: 0; text-transform: uppercase;">#GAMENAME#</h1>
      <p style="font-size: 12px; margin: 2px 0 0 0; color: #333;">SÚMULA DE CARGA MÁXIMA / COMPLEX | #CATEGORYNAME#</p>
    </div>
    <div style="background: #dc2626; color: #fff; padding: 4px 10px; border-radius: 4px; font-weight: bold;">
      INSCRIÇÃO: #REGISTERNUMBER#
    </div>
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; background: #fef2f2; padding: 8px; border-radius: 4px; margin-bottom: 12px; border: 1px solid #fecaca;">
    <div><strong>BATERIA:</strong> #HEAT_NUMBER#</div>
    <div><strong>RAIA:</strong> #LANE_NUMBER#</div>
    <div><strong>EQUIPE:</strong> #TEAMNAME#</div>
  </div>

  <div style="border: 1px solid #000; padding: 10px; margin-bottom: 14px;">
    <h3 style="margin: 0 0 6px 0; font-size: 14px;">COMPLEX: #EVENTTITLE#</h3>
    <p style="margin: 0; font-size: 12px; color: #555;">#WORKOUT_DESCRIPTION#</p>
    <div style="margin-top: 6px; font-size: 12px;"><strong>JANELA DE TEMPO (WINDOW):</strong> #TIME_CAP#</div>
  </div>

  <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: center; margin-bottom: 15px;" border="1">
    <thead>
      <tr style="background: #fee2e2;">
        <th style="padding: 8px;">TENTATIVA</th>
        <th style="padding: 8px;">CARGA DECLARADA (KG)</th>
        <th style="padding: 8px; width: 120px;">STATUS (VALIDADA / NO-REP)</th>
        <th style="padding: 8px; width: 100px;">VISTO JUIZ</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 10px; font-weight: bold;">TENTATIVA 1</td>
        <td style="font-size: 16px; font-weight: bold;">_________ KG</td>
        <td>[ &nbsp; ] VÁLIDA &nbsp; [ &nbsp; ] NO-REP</td>
        <td>__________</td>
      </tr>
      <tr>
        <td style="padding: 10px; font-weight: bold;">TENTATIVA 2</td>
        <td style="font-size: 16px; font-weight: bold;">_________ KG</td>
        <td>[ &nbsp; ] VÁLIDA &nbsp; [ &nbsp; ] NO-REP</td>
        <td>__________</td>
      </tr>
      <tr>
        <td style="padding: 10px; font-weight: bold;">TENTATIVA 3</td>
        <td style="font-size: 16px; font-weight: bold;">_________ KG</td>
        <td>[ &nbsp; ] VÁLIDA &nbsp; [ &nbsp; ] NO-REP</td>
        <td>__________</td>
      </tr>
    </tbody>
  </table>

  <div style="border: 2px solid #000; padding: 10px; background: #fff; text-align: center; margin-bottom: 15px;">
    <div style="font-size: 12px; font-weight: bold; color: #555;">MAIOR CARGA VÁLIDA HOMOLOGADA:</div>
    <div style="font-size: 26px; font-weight: 900; color: #dc2626; margin-top: 4px;">_________ KG</div>
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 11px; text-align: center;">
    <div>
      <div style="border-top: 1px solid #000; margin-top: 25px; padding-top: 4px;">
        <strong>ASSINATURA DO JUIZ</strong>
      </div>
    </div>
    <div>
      <div style="border-top: 1px solid #000; margin-top: 25px; padding-top: 4px;">
        <strong>ASSINATURA DO ATLETA</strong>
      </div>
    </div>
  </div>
</div>
    `
  }
];

export function replaceSumulaVariables(
  htmlTemplate: string,
  variables: {
    gameName?: string;
    categoryName?: string;
    registerNumber?: string;
    teamName?: string;
    athletesList?: string;
    boxAffiliate?: string;
    eventTitle?: string;
    workoutDescription?: string;
    timeCap?: string;
    tieBreakRule?: string;
    heatNumber?: string | number;
    laneNumber?: string | number;
    heatTime?: string;
  }
): string {
  let result = htmlTemplate;

  result = result.replace(/#GAMENAME#/g, variables.gameName || 'ITGames Arena 2026');
  result = result.replace(/#CATEGORYNAME#/g, variables.categoryName || 'Geral');
  result = result.replace(/#REGISTERNUMBER#/g, variables.registerNumber || '#000');
  result = result.replace(/#TEAMNAME#/g, variables.teamName || 'Time');
  result = result.replace(/#ATHLETES_LIST#/g, variables.athletesList || 'Atleta');
  result = result.replace(/#BOX_AFFILIATE#/g, variables.boxAffiliate || 'Box / Afiliação');
  result = result.replace(/#EVENTTITLE#/g, variables.eventTitle || 'Evento Principal');
  result = result.replace(/#WORKOUT_DESCRIPTION#/g, variables.workoutDescription || 'Conforme briefing oficial');
  result = result.replace(/#TIME_CAP#/g, variables.timeCap || '12:00');
  result = result.replace(/#TIE_BREAK_RULE#/g, variables.tieBreakRule || 'Tempo do Round 2');
  result = result.replace(/#HEAT_NUMBER#/g, String(variables.heatNumber || '1'));
  result = result.replace(/#LANE_NUMBER#/g, String(variables.laneNumber || '1'));
  result = result.replace(/#HEAT_TIME#/g, variables.heatTime || '09:00');

  return result;
}

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
  },
  {
    id: 'crossfit-wod1-combo-row-deathby',
    name: 'CrossFit - Combo Duplo WOD 1-A (800m Row) & WOD 1-B (Death By)',
    type: 'crossfit',
    workoutType: 'for_time',
    isDefault: true,
    createdAt: new Date().toISOString(),
    htmlContent: `
<div class="sumula-card" style="font-family: Arial, sans-serif; max-width: 190mm; margin: 0 auto; border: 2px solid #000; padding: 10px 12px; background: #fff; color: #000; font-size: 11px;">
  <!-- CABEÇALHO -->
  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px;">
    <div style="display: flex; align-items: center; gap: 10px;">
      <img src="/brand/logo-itgames-black.png" alt="ITGAMES" style="height: 28px; width: auto; object-fit: contain;" />
      <div>
        <h1 style="font-size: 15px; font-weight: 900; margin: 0; text-transform: uppercase;">#GAMENAME#</h1>
        <p style="font-size: 10px; margin: 1px 0 0 0; color: #333; font-weight: bold;">SÚMULA UNIFICADA OFICIAL | #CATEGORYNAME#</p>
      </div>
    </div>
    <div style="text-align: right; background: #000; color: #fff; padding: 3px 8px; border-radius: 4px;">
      <span style="font-size: 13px; font-weight: 900;">INSCRIÇÃO: #REGISTERNUMBER#</span>
    </div>
  </div>

  <!-- DADOS DA BATERIA, RAIA E EQUIPE -->
  <div style="display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 6px; background: #f4f4f5; padding: 6px 8px; border-radius: 4px; margin-bottom: 8px; border: 1px solid #d4d4d8; font-size: 10.5px;">
    <div><strong>BATERIA:</strong> <span style="font-size: 13px; font-weight: 900; color: #d97706;">#HEAT_NUMBER#</span></div>
    <div><strong>RAIA:</strong> <span style="font-size: 13px; font-weight: 900; color: #2563eb;">#LANE_NUMBER#</span></div>
    <div><strong>EQUIPE:</strong> <strong style="font-size: 12px;">#TEAMNAME#</strong></div>
  </div>
  <div style="background: #fafafa; border: 1px solid #e4e4e7; padding: 4px 8px; border-radius: 4px; margin-bottom: 8px; font-size: 10px; color: #444;">
    <strong>Integrantes:</strong> #ATHLETES_LIST# &nbsp;|&nbsp; <strong>Box:</strong> #BOX_AFFILIATE# &nbsp;|&nbsp; <strong>Horário Bateria:</strong> #HEAT_TIME#
  </div>

  <!-- ═══════════════════════════════════════════════════════════ -->
  <!-- BLOCO WOD 1-A: FOR TIME (800m ROW) -->
  <!-- ═══════════════════════════════════════════════════════════ -->
  <div style="border: 2px solid #dc2626; border-radius: 4px; padding: 8px; margin-bottom: 8px; background: #fffdfd;">
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #dc2626; padding-bottom: 4px; margin-bottom: 6px;">
      <span style="background: #dc2626; color: #fff; font-weight: 900; font-size: 11px; padding: 2px 6px; border-radius: 3px;">WOD 1 - A</span>
      <strong style="font-size: 12px; text-transform: uppercase;">FOR TIME — 800m ROW (REMO)</strong>
      <span style="font-size: 10px; font-weight: bold; color: #7f1d1d;">⏱️ MIN 0:00 AO 5:00 (CAP 5:00)</span>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 10.5px;">
      <div style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px; background: #f8fafc;">
        <div style="font-weight: bold; color: #15803d; margin-bottom: 4px;">[ &nbsp; ] FINALIZOU OS 800 METROS:</div>
        <div style="font-size: 18px; font-weight: 900; font-family: monospace; border-bottom: 1.5px solid #000; padding: 2px 0;">
          ____ : ____ . ____
        </div>
        <span style="font-size: 9px; color: #64748b;">(Anotar tempo exato no painel do Remo)</span>
      </div>

      <div style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px; background: #fef2f2;">
        <div style="font-weight: bold; color: #b91c1c; margin-bottom: 4px;">[ &nbsp; ] NÃO FINALIZOU (TIME CAP 05:00):</div>
        <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
          <span>Metros Faltantes:</span>
          <span style="font-size: 16px; font-weight: 900; border-bottom: 1.5px solid #000; width: 80px; text-align: center;">_______ m</span>
        </div>
        <span style="font-size: 9px; color: #64748b;">(Ex: Faltou 188m → Resultado oficial: 5:00 + 188m)</span>
      </div>
    </div>
  </div>

  <!-- FAIXA DE TRANSIÇÃO / DESCANSO -->
  <div style="background: #e4e4e7; border: 1px dashed #71717a; text-align: center; padding: 3px 0; margin-bottom: 8px; font-weight: bold; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">
    ⏳ MIN 05:00 AO 06:00: REST / TRANSIÇÃO OBRIGATÓRIA (1 MINUTO)
  </div>

  <!-- ═══════════════════════════════════════════════════════════ -->
  <!-- BLOCO WOD 1-B: DEATH BY (5 ROUNDS) -->
  <!-- ═══════════════════════════════════════════════════════════ -->
  <div style="border: 2px solid #2563eb; border-radius: 4px; padding: 8px; margin-bottom: 8px; background: #fcfdfe;">
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #2563eb; padding-bottom: 4px; margin-bottom: 6px;">
      <span style="background: #2563eb; color: #fff; font-weight: 900; font-size: 11px; padding: 2px 6px; border-radius: 3px;">WOD 1 - B</span>
      <strong style="font-size: 12px; text-transform: uppercase;">DEATH BY — THRUSTER + JUMPING PULL-UP</strong>
      <span style="font-size: 10px; font-weight: bold; color: #1e3a8a;">⏱️ MIN 6:00 AO 21:00 (CARGA: 25 / 18 KG)</span>
    </div>

    <!-- TABELA DOS 5 ROUNDS -->
    <table style="width: 100%; border-collapse: collapse; font-size: 10px; text-align: center; margin-bottom: 6px;" border="1">
      <thead>
        <tr style="background: #dbeafe; font-weight: bold;">
          <th style="padding: 4px; width: 70px;">ROUND</th>
          <th style="padding: 4px; width: 110px;">JANELA</th>
          <th style="padding: 4px; text-align: left;">REQUERIMENTO DO ROUND</th>
          <th style="padding: 4px; width: 100px;">TEMPO DO ROUND</th>
          <th style="padding: 4px; width: 130px;">STATUS DE CONCLUSÃO</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 4px; font-weight: bold;">ROUND 1</td>
          <td>Min 06:00 ao 09:00</td>
          <td style="text-align: left; padding: 2px 6px;">10 Thruster + 5 Jumping Pull-up (15 reps)</td>
          <td style="font-family: monospace; font-weight: bold;">____ : ____</td>
          <td>[ &nbsp; ] FECHOU &nbsp; [ &nbsp; ] CAP (reps: ___)</td>
        </tr>
        <tr>
          <td style="padding: 4px; font-weight: bold;">ROUND 2</td>
          <td>Min 09:00 ao 12:00</td>
          <td style="text-align: left; padding: 2px 6px;">15 Thruster + 10 Jumping Pull-up (25 reps)</td>
          <td style="font-family: monospace; font-weight: bold;">____ : ____</td>
          <td>[ &nbsp; ] FECHOU &nbsp; [ &nbsp; ] CAP (reps: ___)</td>
        </tr>
        <tr>
          <td style="padding: 4px; font-weight: bold;">ROUND 3</td>
          <td>Min 12:00 ao 15:00</td>
          <td style="text-align: left; padding: 2px 6px;">20 Thruster + 15 Jumping Pull-up (35 reps)</td>
          <td style="font-family: monospace; font-weight: bold;">____ : ____</td>
          <td>[ &nbsp; ] FECHOU &nbsp; [ &nbsp; ] CAP (reps: ___)</td>
        </tr>
        <tr>
          <td style="padding: 4px; font-weight: bold;">ROUND 4</td>
          <td>Min 15:00 ao 18:00</td>
          <td style="text-align: left; padding: 2px 6px;">25 Thruster + 25 Jumping Pull-up (50 reps)</td>
          <td style="font-family: monospace; font-weight: bold;">____ : ____</td>
          <td>[ &nbsp; ] FECHOU &nbsp; [ &nbsp; ] CAP (reps: ___)</td>
        </tr>
        <tr>
          <td style="padding: 4px; font-weight: bold;">ROUND 5</td>
          <td>Min 18:00 ao 21:00</td>
          <td style="text-align: left; padding: 2px 6px;">30 Thruster + 30 Jumping Pull-up (60 reps)</td>
          <td style="font-family: monospace; font-weight: bold;">____ : ____</td>
          <td>[ &nbsp; ] FECHOU &nbsp; [ &nbsp; ] CAP (reps: ___)</td>
        </tr>
      </tbody>
    </table>

    <!-- RESUMO FINAL DO WOD 1-B -->
    <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 8px; background: #eff6ff; border: 1px solid #bfdbfe; padding: 6px 10px; border-radius: 4px; font-size: 11px;">
      <div>
        <strong>TOTAL DE ROUNDS FECHADOS:</strong>
        <div style="font-size: 16px; font-weight: 900; color: #1d4ed8; margin-top: 2px;">
          [ &nbsp; ] 1 &nbsp; [ &nbsp; ] 2 &nbsp; [ &nbsp; ] 3 &nbsp; [ &nbsp; ] 4 &nbsp; [ &nbsp; ] 5 Rounds
        </div>
      </div>
      <div>
        <strong>TEMPO ACUMULADO (DESEMPATE):</strong>
        <div style="font-size: 16px; font-weight: 900; font-family: monospace; border-bottom: 1.5px solid #000; padding: 2px 0;">
          ____ : ____ . ____
        </div>
        <span style="font-size: 9px; color: #64748b;">(Soma dos tempos dos rounds fechados)</span>
      </div>
    </div>
  </div>

  <!-- ASSINATURAS E VALIDAÇÃO -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 10px; text-align: center; margin-top: 8px; padding-top: 6px; border-top: 1px solid #d4d4d8;">
    <div>
      <div style="border-top: 1.5px solid #000; margin-top: 20px; padding-top: 2px;">
        <strong>ÁRBITRO OFICIAL DE RAIA (JUIZ)</strong><br/>
        <span style="font-size: 9px; color: #555;">Nome legível e rubrica</span>
      </div>
    </div>
    <div>
      <div style="border-top: 1.5px solid #000; margin-top: 20px; padding-top: 2px;">
        <strong>CAPITÃO DA EQUIPE / ATLETA</strong><br/>
        <span style="font-size: 9px; color: #555;">Concordo com os tempos e contagens anotados</span>
      </div>
    </div>
  </div>
</div>
    `
  },
  {
    id: 'crossfit-wod2-sync-burn',
    name: 'CrossFit - WOD 2: SYNC & BURN (Knee Raises, Bike, Burpee Step Over, Snatch)',
    type: 'crossfit',
    workoutType: 'for_time',
    isDefault: true,
    createdAt: new Date().toISOString(),
    htmlContent: `
<div class="sumula-card" style="font-family: Arial, sans-serif; max-width: 190mm; margin: 0 auto; border: 2px solid #000; padding: 10px 12px; background: #fff; color: #000; font-size: 11px;">
  <!-- CABEÇALHO -->
  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px;">
    <div style="display: flex; align-items: center; gap: 10px;">
      <img src="/brand/logo-itgames-black.png" alt="ITGAMES" style="height: 28px; width: auto; object-fit: contain;" />
      <div>
        <h1 style="font-size: 15px; font-weight: 900; margin: 0; text-transform: uppercase;">#GAMENAME#</h1>
        <p style="font-size: 10px; margin: 1px 0 0 0; color: #333; font-weight: bold;">SÚMULA OFICIAL DE PROVA | #CATEGORYNAME#</p>
      </div>
    </div>
    <div style="text-align: right; background: #000; color: #fff; padding: 3px 8px; border-radius: 4px;">
      <span style="font-size: 13px; font-weight: 900;">INSCRIÇÃO: #REGISTERNUMBER#</span>
    </div>
  </div>

  <!-- DADOS DA BATERIA, RAIA E EQUIPE -->
  <div style="display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 6px; background: #f4f4f5; padding: 6px 8px; border-radius: 4px; margin-bottom: 8px; border: 1px solid #d4d4d8; font-size: 10.5px;">
    <div><strong>BATERIA:</strong> <span style="font-size: 13px; font-weight: 900; color: #d97706;">#HEAT_NUMBER#</span></div>
    <div><strong>RAIA:</strong> <span style="font-size: 13px; font-weight: 900; color: #2563eb;">#LANE_NUMBER#</span></div>
    <div><strong>EQUIPE:</strong> <strong style="font-size: 12px;">#TEAMNAME#</strong></div>
  </div>
  <div style="background: #fafafa; border: 1px solid #e4e4e7; padding: 4px 8px; border-radius: 4px; margin-bottom: 8px; font-size: 10px; color: #444;">
    <strong>Integrantes:</strong> #ATHLETES_LIST# &nbsp;|&nbsp; <strong>Box:</strong> #BOX_AFFILIATE# &nbsp;|&nbsp; <strong>Horário Bateria:</strong> #HEAT_TIME#
  </div>

  <!-- ═══════════════════════════════════════════════════════════ -->
  <!-- BLOCO WOD 2: SYNC & BURN -->
  <!-- ═══════════════════════════════════════════════════════════ -->
  <div style="border: 2px solid #b91c1c; border-radius: 4px; padding: 8px; margin-bottom: 8px; background: #fffcfc;">
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #b91c1c; padding-bottom: 4px; margin-bottom: 6px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="background: #b91c1c; color: #fff; font-weight: 900; font-size: 12px; padding: 2px 8px; border-radius: 3px;">WOD 2</span>
        <strong style="font-size: 13px; text-transform: uppercase; color: #7f1d1d;">SYNC & BURN (FOR TIME)</strong>
      </div>
      <div style="background: #fee2e2; border: 1px solid #f87171; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-weight: 900; font-size: 11px;">
        ⏱️ TIME CAP: 10 MIN (10:00) • TOTAL: 130 REPS
      </div>
    </div>

    <!-- TABELA DOS MOVIMENTOS COM CHECKPOINTS -->
    <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; text-align: center; margin-bottom: 8px;" border="1">
      <thead>
        <tr style="background: #fecaca; font-weight: bold; color: #7f1d1d;">
          <th style="padding: 5px; width: 60px;">ETAPA</th>
          <th style="padding: 5px; text-align: left;">MOVIMENTO / EXERCÍCIO</th>
          <th style="padding: 5px; width: 90px;">REPS ETAPA</th>
          <th style="padding: 5px; width: 100px;">ACUMULADO</th>
          <th style="padding: 5px; width: 110px;">VISTO DO JUIZ</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 6px; font-weight: bold; background: #fff;">1</td>
          <td style="padding: 6px; text-align: left; font-weight: bold;">50 KNEE RAISES <span style="font-size: 9px; color: #64748b; font-weight: normal;">(Ou Toes to Bar conf. categoria)</span></td>
          <td style="padding: 6px; font-weight: bold;">50</td>
          <td style="padding: 6px; font-weight: bold; font-family: monospace;">50 REPS</td>
          <td style="padding: 6px; font-size: 9px; color: #666;">[ &nbsp; ] OK</td>
        </tr>
        <tr style="background: #fafafa;">
          <td style="padding: 6px; font-weight: bold;">2</td>
          <td style="padding: 6px; text-align: left; font-weight: bold;">30 CAL AIR BIKE</td>
          <td style="padding: 6px; font-weight: bold;">30</td>
          <td style="padding: 6px; font-weight: bold; font-family: monospace;">80 REPS</td>
          <td style="padding: 6px; font-size: 9px; color: #666;">[ &nbsp; ] OK &nbsp; (Tie: ___:___)</td>
        </tr>
        <tr>
          <td style="padding: 6px; font-weight: bold; background: #fff;">3</td>
          <td style="padding: 6px; text-align: left; font-weight: bold;">30 SYNC BURPEE STEP OVER</td>
          <td style="padding: 6px; font-weight: bold;">30</td>
          <td style="padding: 6px; font-weight: bold; font-family: monospace;">110 REPS</td>
          <td style="padding: 6px; font-size: 9px; color: #666;">[ &nbsp; ] OK</td>
        </tr>
        <tr style="background: #fafafa;">
          <td style="padding: 6px; font-weight: bold;">4</td>
          <td style="padding: 6px; text-align: left; font-weight: bold;">
            20 SYNC SNATCH 
            <span style="background: #000; color: #fff; font-size: 9.5px; padding: 1px 5px; border-radius: 3px; margin-left: 6px;">CARGAS SCALED: 40/29 KG</span>
          </td>
          <td style="padding: 6px; font-weight: bold;">20</td>
          <td style="padding: 6px; font-weight: bold; font-family: monospace; color: #b91c1c;">130 REPS</td>
          <td style="padding: 6px; font-size: 9px; color: #666;">[ &nbsp; ] OK</td>
        </tr>
      </tbody>
    </table>

    <!-- APURAÇÃO E CRITÉRIO OFICIAL DE PONTUAÇÃO -->
    <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 4px; padding: 8px;">
      <div style="font-weight: 900; font-size: 11px; text-transform: uppercase; margin-bottom: 6px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
        📋 APURAÇÃO OFICIAL DO RESULTADO (PREENCHER UMA DAS DUAS OPÇÕES):
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <!-- OPÇÃO 1: FECHOU O WOD -->
        <div style="border: 1.5px solid #16a34a; border-radius: 4px; padding: 6px; background: #f0fdf4;">
          <div style="font-weight: 900; color: #15803d; font-size: 11px; margin-bottom: 4px;">
            [ &nbsp; ] OPÇÃO 1 — FINALIZOU OS 130 MOVIMENTOS:
          </div>
          <div style="margin-top: 4px;">
            <span style="font-size: 10px; color: #333;">TEMPO FINAL DE PROVA:</span>
            <div style="font-size: 20px; font-weight: 900; font-family: monospace; border-bottom: 2px solid #000; padding: 2px 0; margin-top: 2px;">
              ____ : ____ . ____
            </div>
            <span style="font-size: 9px; color: #166534; font-weight: bold;">(Registrar cronômetro oficial antes do CAP 10:00)</span>
          </div>
        </div>

        <!-- OPÇÃO 2: TOMOU CAP -->
        <div style="border: 1.5px solid #dc2626; border-radius: 4px; padding: 6px; background: #fef2f2;">
          <div style="font-weight: 900; color: #b91c1c; font-size: 11px; margin-bottom: 4px;">
            [ &nbsp; ] OPÇÃO 2 — TIME CAP (NÃO FINALIZOU EM 10:00):
          </div>
          <div style="font-size: 10px; line-height: 1.4;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
              <span>Total de Reps Feitas:</span>
              <strong style="border-bottom: 1.5px solid #000; width: 65px; text-align: center; font-size: 12px;">_____ / 130</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; background: #fee2e2; padding: 2px 4px; border-radius: 3px;">
              <strong style="color: #991b1b;">Reps Faltantes para Fechar:</strong>
              <strong style="border-bottom: 1.5px solid #991b1b; width: 65px; text-align: center; font-size: 13px; color: #991b1b;">_____ reps</strong>
            </div>
            <div style="font-size: 9px; color: #7f1d1d; font-weight: bold; margin-top: 4px;">
              ⚡ Critério Oficial: 10:00 + Reps Faltantes (Ex: Faltou 12 reps → Resultado: CAP +12 / 10:12)
            </div>
          </div>
        </div>
      </div>

      <!-- TIE BREAK / DESEMPATE -->
      <div style="margin-top: 6px; padding-top: 4px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: center; font-size: 10px;">
        <span><strong>TIE-BREAK SECUNDÁRIO:</strong> Tempo ao finalizar os 30 cal Air Bike (80 reps):</span>
        <span style="font-family: monospace; font-size: 12px; font-weight: bold; border-bottom: 1.5px solid #000; width: 90px; text-align: center;">____ : ____</span>
      </div>
    </div>
  </div>

  <!-- ASSINATURAS E VALIDAÇÃO -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 10px; text-align: center; margin-top: 8px; padding-top: 6px; border-top: 1px solid #d4d4d8;">
    <div>
      <div style="border-top: 1.5px solid #000; margin-top: 20px; padding-top: 2px;">
        <strong>ÁRBITRO OFICIAL DE RAIA (JUIZ)</strong><br/>
        <span style="font-size: 9px; color: #555;">Nome legível e rubrica</span>
      </div>
    </div>
    <div>
      <div style="border-top: 1.5px solid #000; margin-top: 20px; padding-top: 2px;">
        <strong>CAPITÃO DA EQUIPE / ATLETA</strong><br/>
        <span style="font-size: 9px; color: #555;">Concordo com os tempos e repetições anotados</span>
      </div>
    </div>
  </div>
</div>
    `
  },
  {
    id: 'crossfit-wod3-maximum-lift',
    name: 'CrossFit - WOD 3: MAXIMUM LIFT (1 Hang Clean n\' Jerk - Escada de Carga)',
    type: 'crossfit',
    workoutType: 'max_load',
    isDefault: true,
    createdAt: new Date().toISOString(),
    htmlContent: `
<div class="sumula-card" style="font-family: Arial, sans-serif; max-width: 190mm; margin: 0 auto; border: 2px solid #000; padding: 10px 12px; background: #fff; color: #000; font-size: 11px;">
  <!-- CABEÇALHO -->
  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px;">
    <div style="display: flex; align-items: center; gap: 10px;">
      <img src="/brand/logo-itgames-black.png" alt="ITGAMES" style="height: 28px; width: auto; object-fit: contain;" />
      <div>
        <h1 style="font-size: 15px; font-weight: 900; margin: 0; text-transform: uppercase;">#GAMENAME#</h1>
        <p style="font-size: 10px; margin: 1px 0 0 0; color: #333; font-weight: bold;">SÚMULA OFICIAL DE PROVA | #CATEGORYNAME#</p>
      </div>
    </div>
    <div style="text-align: right; background: #000; color: #fff; padding: 3px 8px; border-radius: 4px;">
      <span style="font-size: 13px; font-weight: 900;">INSCRIÇÃO: #REGISTERNUMBER#</span>
    </div>
  </div>

  <!-- DADOS DA BATERIA, RAIA E EQUIPE -->
  <div style="display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 6px; background: #f4f4f5; padding: 6px 8px; border-radius: 4px; margin-bottom: 8px; border: 1px solid #d4d4d8; font-size: 10.5px;">
    <div><strong>BATERIA:</strong> <span style="font-size: 13px; font-weight: 900; color: #d97706;">#HEAT_NUMBER#</span></div>
    <div><strong>RAIA:</strong> <span style="font-size: 13px; font-weight: 900; color: #2563eb;">#LANE_NUMBER#</span></div>
    <div><strong>EQUIPE:</strong> <strong style="font-size: 12px;">#TEAMNAME#</strong></div>
  </div>
  <div style="background: #fafafa; border: 1px solid #e4e4e7; padding: 4px 8px; border-radius: 4px; margin-bottom: 8px; font-size: 10px; color: #444;">
    <strong>Integrantes:</strong> #ATHLETES_LIST# &nbsp;|&nbsp; <strong>Box:</strong> #BOX_AFFILIATE# &nbsp;|&nbsp; <strong>Horário Bateria:</strong> #HEAT_TIME#
  </div>

  <!-- ═══════════════════════════════════════════════════════════ -->
  <!-- BLOCO WOD 3: MAXIMUM LIFT -->
  <!-- ═══════════════════════════════════════════════════════════ -->
  <div style="border: 2px solid #b91c1c; border-radius: 4px; padding: 8px; margin-bottom: 8px; background: #fffcfc;">
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #b91c1c; padding-bottom: 4px; margin-bottom: 6px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="background: #b91c1c; color: #fff; font-weight: 900; font-size: 12px; padding: 2px 8px; border-radius: 3px;">WOD 3</span>
        <strong style="font-size: 13px; text-transform: uppercase; color: #7f1d1d;">MAXIMUM LIFT — 1 HANG CLEAN N' JERK</strong>
      </div>
      <div style="background: #fee2e2; border: 1px solid #f87171; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-weight: 900; font-size: 11px;">
        🏋️ ESCADA DE CARGA EM DUPLA • MAIOR CARGA VENCE (KG)
      </div>
    </div>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px 8px; margin-bottom: 8px; font-size: 10px; color: #334155;">
      <strong>PADRÃO DO MOVIMENTO:</strong> A barra sai suspensa acima dos joelhos (Hang). Clean válido com recepção em Power ou Squat. Finalização com Jerk (Push Jerk ou Split) com bloqueio completo de joelhos, quadris e cotovelos alinhados com a barra sobre a cabeça. Aguardar sinal de "DOWN" do árbitro.
    </div>

    <!-- TABELA DAS 10 TENTATIVAS DA ESCADA DE CARGA -->
    <table style="width: 100%; border-collapse: collapse; font-size: 9.5px; text-align: center; margin-bottom: 6px;" border="1">
      <thead>
        <tr style="background: #fecaca; font-weight: bold; color: #7f1d1d;">
          <th style="padding: 3px; width: 50px;">TENT.</th>
          <th style="padding: 3px; width: 100px;">ATLETA A (KG)</th>
          <th style="padding: 3px; width: 100px;">ATLETA B (KG)</th>
          <th style="padding: 3px; width: 120px; background: #fee2e2; color: #991b1b;">TOTAL DUPLA (KG)</th>
          <th style="padding: 3px; width: 120px;">VALIDAÇÃO JUIZ</th>
          <th style="padding: 3px;">CRONÔMETRO / TIE</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 2.5px; font-weight: bold; background: #fff;">1ª</td>
          <td style="padding: 2.5px; font-family: monospace;">______ kg</td>
          <td style="padding: 2.5px; font-family: monospace;">______ kg</td>
          <td style="padding: 2.5px; font-weight: 900; font-family: monospace; background: #fff5f5;">_______ kg</td>
          <td style="padding: 2.5px;">[ &nbsp; ] BOM &nbsp; [ &nbsp; ] NO-REP</td>
          <td style="padding: 2.5px; font-family: monospace;">___ : ___</td>
        </tr>
        <tr style="background: #fafafa;">
          <td style="padding: 2.5px; font-weight: bold;">2ª</td>
          <td style="padding: 2.5px; font-family: monospace;">______ kg</td>
          <td style="padding: 2.5px; font-family: monospace;">______ kg</td>
          <td style="padding: 2.5px; font-weight: 900; font-family: monospace; background: #fff5f5;">_______ kg</td>
          <td style="padding: 2.5px;">[ &nbsp; ] BOM &nbsp; [ &nbsp; ] NO-REP</td>
          <td style="padding: 2.5px; font-family: monospace;">___ : ___</td>
        </tr>
        <tr>
          <td style="padding: 2.5px; font-weight: bold; background: #fff;">3ª</td>
          <td style="padding: 2.5px; font-family: monospace;">______ kg</td>
          <td style="padding: 2.5px; font-family: monospace;">______ kg</td>
          <td style="padding: 2.5px; font-weight: 900; font-family: monospace; background: #fff5f5;">_______ kg</td>
          <td style="padding: 2.5px;">[ &nbsp; ] BOM &nbsp; [ &nbsp; ] NO-REP</td>
          <td style="padding: 2.5px; font-family: monospace;">___ : ___</td>
        </tr>
        <tr style="background: #fafafa;">
          <td style="padding: 2.5px; font-weight: bold;">4ª</td>
          <td style="padding: 2.5px; font-family: monospace;">______ kg</td>
          <td style="padding: 2.5px; font-family: monospace;">______ kg</td>
          <td style="padding: 2.5px; font-weight: 900; font-family: monospace; background: #fff5f5;">_______ kg</td>
          <td style="padding: 2.5px;">[ &nbsp; ] BOM &nbsp; [ &nbsp; ] NO-REP</td>
          <td style="padding: 2.5px; font-family: monospace;">___ : ___</td>
        </tr>
        <tr>
          <td style="padding: 2.5px; font-weight: bold; background: #fff;">5ª</td>
          <td style="padding: 2.5px; font-family: monospace;">______ kg</td>
          <td style="padding: 2.5px; font-family: monospace;">______ kg</td>
          <td style="padding: 2.5px; font-weight: 900; font-family: monospace; background: #fff5f5;">_______ kg</td>
          <td style="padding: 2.5px;">[ &nbsp; ] BOM &nbsp; [ &nbsp; ] NO-REP</td>
          <td style="padding: 2.5px; font-family: monospace;">___ : ___</td>
        </tr>
        <tr style="background: #fafafa;">
          <td style="padding: 2.5px; font-weight: bold;">6ª</td>
          <td style="padding: 2.5px; font-family: monospace;">______ kg</td>
          <td style="padding: 2.5px; font-family: monospace;">______ kg</td>
          <td style="padding: 2.5px; font-weight: 900; font-family: monospace; background: #fff5f5;">_______ kg</td>
          <td style="padding: 2.5px;">[ &nbsp; ] BOM &nbsp; [ &nbsp; ] NO-REP</td>
          <td style="padding: 2.5px; font-family: monospace;">___ : ___</td>
        </tr>
        <tr>
          <td style="padding: 2.5px; font-weight: bold; background: #fff;">7ª</td>
          <td style="padding: 2.5px; font-family: monospace;">______ kg</td>
          <td style="padding: 2.5px; font-family: monospace;">______ kg</td>
          <td style="padding: 2.5px; font-weight: 900; font-family: monospace; background: #fff5f5;">_______ kg</td>
          <td style="padding: 2.5px;">[ &nbsp; ] BOM &nbsp; [ &nbsp; ] NO-REP</td>
          <td style="padding: 2.5px; font-family: monospace;">___ : ___</td>
        </tr>
        <tr style="background: #fafafa;">
          <td style="padding: 2.5px; font-weight: bold;">8ª</td>
          <td style="padding: 2.5px; font-family: monospace;">______ kg</td>
          <td style="padding: 2.5px; font-family: monospace;">______ kg</td>
          <td style="padding: 2.5px; font-weight: 900; font-family: monospace; background: #fff5f5;">_______ kg</td>
          <td style="padding: 2.5px;">[ &nbsp; ] BOM &nbsp; [ &nbsp; ] NO-REP</td>
          <td style="padding: 2.5px; font-family: monospace;">___ : ___</td>
        </tr>
        <tr>
          <td style="padding: 2.5px; font-weight: bold; background: #fff;">9ª</td>
          <td style="padding: 2.5px; font-family: monospace;">______ kg</td>
          <td style="padding: 2.5px; font-family: monospace;">______ kg</td>
          <td style="padding: 2.5px; font-weight: 900; font-family: monospace; background: #fff5f5;">_______ kg</td>
          <td style="padding: 2.5px;">[ &nbsp; ] BOM &nbsp; [ &nbsp; ] NO-REP</td>
          <td style="padding: 2.5px; font-family: monospace;">___ : ___</td>
        </tr>
        <tr style="background: #fafafa;">
          <td style="padding: 2.5px; font-weight: bold;">10ª</td>
          <td style="padding: 2.5px; font-family: monospace;">______ kg</td>
          <td style="padding: 2.5px; font-family: monospace;">______ kg</td>
          <td style="padding: 2.5px; font-weight: 900; font-family: monospace; background: #fff5f5;">_______ kg</td>
          <td style="padding: 2.5px;">[ &nbsp; ] BOM &nbsp; [ &nbsp; ] NO-REP</td>
          <td style="padding: 2.5px; font-family: monospace;">___ : ___</td>
        </tr>
      </tbody>
    </table>

    <!-- APURAÇÃO E CARGA MÁXIMA HOMOLOGADA -->
    <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 4px; padding: 8px;">
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px; align-items: center;">
        <div style="border: 2px solid #b91c1c; background: #fef2f2; border-radius: 4px; padding: 8px; text-align: center;">
          <span style="font-size: 11px; font-weight: 900; color: #991b1b; text-transform: uppercase;">
            🏆 MAIOR CARGA TOTAL VÁLIDA DA DUPLA (ATLETA A + B):
          </span>
          <div style="font-size: 26px; font-weight: 900; font-family: monospace; color: #000; border-bottom: 2px solid #b91c1c; padding: 2px 0; margin-top: 2px;">
            ________ KG
          </div>
          <span style="font-size: 9px; color: #7f1d1d;">(Soma das maiores cargas válidas ou maior peso levantado com sucesso)</span>
        </div>

        <div style="border: 1px solid #cbd5e1; background: #fff; border-radius: 4px; padding: 8px; text-align: center;">
          <span style="font-size: 10px; font-weight: bold; color: #475569; text-transform: uppercase;">
            ⏱️ TIE-BREAK (DESEMPATE):
          </span>
          <div style="font-size: 18px; font-weight: 900; font-family: monospace; color: #000; border-bottom: 1.5px solid #000; padding: 2px 0; margin-top: 2px;">
            ___ : ___ . ___
          </div>
          <span style="font-size: 8.5px; color: #64748b;">(Tempo em que a maior carga foi levantada)</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ASSINATURAS E VALIDAÇÃO -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 10px; text-align: center; margin-top: 8px; padding-top: 6px; border-top: 1px solid #d4d4d8;">
    <div>
      <div style="border-top: 1.5px solid #000; margin-top: 20px; padding-top: 2px;">
        <strong>ÁRBITRO OFICIAL DE RAIA (JUIZ)</strong><br/>
        <span style="font-size: 9px; color: #555;">Nome legível e rubrica</span>
      </div>
    </div>
    <div>
      <div style="border-top: 1.5px solid #000; margin-top: 20px; padding-top: 2px;">
        <strong>CAPITÃO DA EQUIPE / ATLETA</strong><br/>
        <span style="font-size: 9px; color: #555;">Concordo com as cargas e validações anotadas</span>
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

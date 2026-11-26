"""
Gera os layouts de súmula do SUMMER2026 num padrão único e minimalista:
cabeçalho com a logo do campeonato, tons neutros (sem cores fortes), caixas de marcação simples,
QR code de lançamento e assinaturas. Cada súmula cabe numa folha A4 (retrato).

Uso (na raiz do repositório):
  python itgames-api/scripts/sumulas/gerar_sumulas_summer2026.py            # gera os .html em scripts/sumulas/out
  python itgames-api/scripts/sumulas/gerar_sumulas_summer2026.py --sql      # também gera o .sql de atualização

As tags (#TEAMNAME#, #HEAT_TIME#, #QRCODE#...) são preenchidas pela tela de súmulas.
"""
import os
import sys

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')

INK = '#111827'
MUTED = '#6b7280'
LINE = '#d1d5db'
SOFT = '#f3f4f6'


def box():
    """Caixa de marcação vazia (o juiz marca com X)."""
    return f'<span style="display: inline-block; width: 13px; height: 13px; border: 1.5px solid {INK}; border-radius: 2px; vertical-align: -3px; margin-right: 6px;"></span>'


def blank(width=70):
    return f'<span style="display: inline-block; min-width: {width}px; border-bottom: 1px solid {INK};">&nbsp;</span>'


TIME = f'<span style="font-family: monospace; font-size: 16px; letter-spacing: 1px;">___ : ___ . ___</span>'
TIME_MS = f'<span style="font-family: monospace; font-size: 15px; letter-spacing: 1px;">___ : ___</span>'


def card(body):
    return (f'<div class="sumula-card" style="font-family: Arial, Helvetica, sans-serif; width: 100%; max-width: 194mm; margin: 0 auto; '
            f'padding: 14px 16px; background: #ffffff; color: {INK}; font-size: 12px; line-height: 1.4; box-sizing: border-box;">\n{body}\n</div>')


def header(title, subtitle):
    return f'''
  <!-- CABEÇALHO PADRÃO -->
  <div style="display: flex; align-items: center; gap: 12px; border-bottom: 2px solid {INK}; padding-bottom: 10px; margin-bottom: 10px;">
    <img src="#GAMELOGO#" alt="Logo do campeonato" style="height: 56px; max-width: 160px; object-fit: contain; display: block;" />
    <div style="flex: 1; min-width: 0;">
      <div style="font-size: 9px; font-weight: 700; letter-spacing: 1px; color: {MUTED}; text-transform: uppercase;">#GAMENAME# · Súmula oficial de prova</div>
      <div style="font-size: 19px; font-weight: 900; text-transform: uppercase; margin-top: 1px;">{title}</div>
      <div style="font-size: 10px; color: #4b5563;">{subtitle}</div>
    </div>
    <div style="text-align: right; flex-shrink: 0;">
      <div style="display: inline-block; border: 1.5px solid {INK}; border-radius: 4px; padding: 2px 8px; font-size: 10px; font-weight: 800; text-transform: uppercase; white-space: nowrap;">#CATEGORYNAME#</div>
      <div style="margin-top: 4px; font-size: 10px; color: {MUTED};">Inscrição <strong style="color: {INK}; font-size: 14px;">#REGISTERNUMBER#</strong></div>
    </div>
  </div>

  <!-- BATERIA / RAIA / HORÁRIO / EQUIPE -->
  <div style="border: 1px solid {LINE}; border-radius: 4px; padding: 8px 12px; margin-bottom: 10px;">
    <div style="display: grid; grid-template-columns: 0.8fr 0.8fr 1fr 2.6fr; gap: 8px; align-items: baseline;">
      <div><span style="color: {MUTED};">Bateria</span> <strong style="font-size: 15px;">#HEAT_NUMBER#</strong></div>
      <div><span style="color: {MUTED};">Raia</span> <strong style="font-size: 15px;">#LANE_NUMBER#</strong></div>
      <div><span style="color: {MUTED};">Horário</span> <strong style="font-size: 15px;">#HEAT_TIME#</strong></div>
      <div><span style="color: {MUTED};">Equipe</span> <strong style="font-size: 13px;">#TEAMNAME#</strong></div>
    </div>
    <div style="border-top: 1px solid #e5e7eb; margin-top: 5px; padding-top: 4px; font-size: 10px; color: #374151;">
      <strong>Integrantes:</strong> #ATHLETES_LIST# &nbsp;·&nbsp; <strong>Box:</strong> #BOX_AFFILIATE#
    </div>
  </div>'''


def section(label, title, meta=''):
    m = f'<span style="font-size: 10px; color: {MUTED}; font-weight: 600;">{meta}</span>' if meta else ''
    return f'''
  <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px; border-bottom: 1px solid {INK}; padding-bottom: 3px; margin: 16px 0 8px 0;">
    <div><span style="display: inline-block; background: {INK}; color: #ffffff; font-weight: 800; font-size: 11px; padding: 2px 7px; border-radius: 3px; margin-right: 7px;">{label}</span><strong style="font-size: 13.5px; text-transform: uppercase;">{title}</strong></div>
    {m}
  </div>'''


def qr(tag, label):
    return f'''<div style="text-align: center; flex-shrink: 0; width: 86px;">
      <img src="#{tag}#" alt="QR {label}" style="width: 74px; height: 74px; display: block; margin: 0 auto;" />
      <div style="font-size: 8px; color: {MUTED}; margin-top: 2px; text-transform: uppercase;">Lançar {label}</div>
    </div>'''


def signatures():
    return f'''
  <!-- ASSINATURAS -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 36px; font-size: 11px; text-align: center; margin-top: 40px;">
    <div>
      <div style="border-top: 1.5px solid {INK}; padding-top: 2px; font-weight: bold;">JUIZ DE RAIA</div>
      <span style="font-size: 9px; color: {MUTED};">Nome legível e rubrica</span>
    </div>
    <div>
      <div style="border-top: 1.5px solid {INK}; padding-top: 2px; font-weight: bold;">CAPITÃO / ATLETA</div>
      <span style="font-size: 9px; color: {MUTED};">Concordo com o resultado anotado</span>
    </div>
  </div>'''


def table(head, rows, widths, pad=10):
    th = ''.join(f'<th style="padding: 6px 5px; text-align: {"left" if i == 1 else "center"}; width: {w};">{h}</th>' for i, (h, w) in enumerate(zip(head, widths)))
    trs = []
    for r_i, r in enumerate(rows):
        zebra = f' background: #fafafa;' if r_i % 2 else ''
        tds = ''.join(f'<td style="padding: {pad}px 5px; border-top: 1px solid #e5e7eb; text-align: {"left" if i == 1 else "center"};">{c}</td>' for i, c in enumerate(r))
        trs.append(f'<tr style="{zebra}">{tds}</tr>')
    return (f'<table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid {LINE};">'
            f'<thead><tr style="background: {SOFT}; font-size: 9.5px; text-transform: uppercase; color: #374151;">{th}</tr></thead>'
            f'<tbody>{"".join(trs)}</tbody></table>')


# ───────────────────────── WOD 1 (1-A Remo + 1-B Death By) ─────────────────────────
def wod1(meters, load, rounds):
    a = section('1-A', f'For Time — {meters} m Remo em dupla', 'Min 0:00 a 5:00 · Cap 5:00') + f'''
  <div style="display: flex; gap: 10px; align-items: stretch;">
    <div style="flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
      <div style="border: 1px solid {LINE}; border-radius: 4px; padding: 10px 12px;">
        <div>{box()}<strong>Finalizou os {meters} m</strong></div>
        <div style="margin-top: 10px;">Tempo: {TIME}</div>
        <div style="font-size: 9px; color: {MUTED}; margin-top: 3px;">Tempo do painel do remo</div>
      </div>
      <div style="border: 1px solid {LINE}; border-radius: 4px; padding: 10px 12px;">
        <div>{box()}<strong>Não finalizou (cap 5:00)</strong></div>
        <div style="margin-top: 6px;">Metros faltantes: {blank(60)} m</div>
        <div style="font-size: 9px; color: {MUTED}; margin-top: 3px;">Resultado: 5:00 + metros faltantes</div>
      </div>
    </div>
    {qr('QRCODE_A', '1-A')}
  </div>
  <div style="text-align: center; font-size: 9.5px; color: {MUTED}; margin: 6px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">Min 5:00 a 6:00 · descanso obrigatório (1 min)</div>'''

    rows = []
    for i, (window, req) in enumerate(rounds, start=1):
        rows.append([f'<strong>{i}</strong>', f'{req}<div style="font-size: 9px; color: {MUTED};">{window}</div>', TIME_MS,
                     f'{box()}Fechou &nbsp; {box()}Cap: {blank(28)} reps'])
    b = section('1-B', 'Death By em dupla — 5 blocos de 3 min', f'Min 6:00 a 21:00 · Carga {load}') + table(
        ['Round', 'Requerimento', 'Tempo do round', 'Conclusão'], rows, ['44px', 'auto', '100px', '190px']) + f'''
  <div style="display: flex; gap: 10px; align-items: stretch; margin-top: 8px;">
    <div style="flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
      <div style="border: 1.5px solid {INK}; border-radius: 4px; padding: 10px 12px;">
        <div style="font-size: 9px; color: {MUTED}; text-transform: uppercase; font-weight: 700;">Rounds fechados</div>
        <div style="margin-top: 6px;">{box()}1 &nbsp; {box()}2 &nbsp; {box()}3 &nbsp; {box()}4 &nbsp; {box()}5</div>
      </div>
      <div style="border: 1.5px solid {INK}; border-radius: 4px; padding: 10px 12px;">
        <div style="font-size: 9px; color: {MUTED}; text-transform: uppercase; font-weight: 700;">Tie-break: soma dos tempos dos rounds fechados</div>
        <div style="margin-top: 5px;">{TIME}</div>
      </div>
    </div>
    {qr('QRCODE_B', '1-B')}
  </div>'''
    return card(header('WOD 1: Remo + Death By', '1-A For Time · 1-B Death By em dupla · Prova combinada') + a + b + signatures())


# ───────────────────────── WOD 2 (Sync & Burn) ─────────────────────────
def wod2(movs, load):
    acc = 0
    rows = []
    for i, (reps, mov) in enumerate(movs, start=1):
        acc += reps
        extra = f'<div style="font-size: 9px; color: {MUTED};">Carga {load}</div>' if 'SNATCH' in mov.upper() else ''
        rows.append([f'<strong>{i}</strong>', f'<strong>{reps}</strong> {mov}{extra}', f'{acc}', f'{box()}OK'])
    body = section('WOD 2', 'Sync & Burn — For Time', f'Cap 10:00 · {acc} reps') + table(
        ['Etapa', 'Movimento', 'Acumulado', 'Visto do juiz'], rows, ['48px', 'auto', '80px', '190px'], pad=20) + f'''
  <div style="display: flex; gap: 10px; align-items: stretch; margin-top: 18px;">
    <div style="flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
      <div style="border: 1.5px solid {INK}; border-radius: 4px; padding: 14px 12px;">
        <div>{box()}<strong>Finalizou as {acc} reps</strong></div>
        <div style="margin-top: 12px;">Tempo final: {TIME}</div>
      </div>
      <div style="border: 1.5px solid {INK}; border-radius: 4px; padding: 14px 12px;">
        <div>{box()}<strong>Time cap (não finalizou)</strong></div>
        <div style="margin-top: 12px;">Reps feitas: {blank(40)} / {acc} &nbsp; Faltaram: {blank(36)}</div>
        <div style="font-size: 9px; color: {MUTED}; margin-top: 3px;">Resultado: CAP + reps faltantes (ex.: faltaram 12 → CAP +12)</div>
      </div>
    </div>
    {qr('QRCODE', 'WOD 2')}
  </div>
  <div style="font-size: 11px; margin-top: 12px;"><strong>Classificação:</strong> vence o menor tempo. Quem não termina fica atrás de todos que terminaram; entre os CAPs, fica na frente quem deixou menos reps faltando.</div>'''
    return card(header('WOD 2: Sync & Burn', f'For Time em dupla · Time cap 10:00 · {acc} repetições') + body + signatures())


# ───────────────────────── WOD 3 (Maximum Lift) ─────────────────────────
PLATES = [('20k', '#2563eb'), ('15k', '#eab308'), ('10k', INK), ('5k', '#6b7280'), ('2k', '#9ca3af'), ('1k', '#d1d5db')]


def dot(color):
    return f'<span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: {color}; vertical-align: 0px; margin-right: 2px;"></span>'


def athlete_table(n):
    head = ['Tent.'] + [f'{dot(c)}{p}' for p, c in PLATES] + ['Carga total', 'Válida?']
    th = ''.join(f'<th style="padding: 3px; text-align: center;">{h}</th>' for h in head)
    trs = []
    for i in range(1, 7):
        zebra = ' background: #fafafa;' if i % 2 == 0 else ''
        cells = [f'<strong>{i}ª</strong>'] + [''] * len(PLATES) + [f'{blank(36)} kg', f'{box()}OK &nbsp;{box()}NO']
        tds = ''.join(f'<td style="padding: 0 3px; height: 27px; border-top: 1px solid #e5e7eb; border-left: 1px solid #f1f5f9; text-align: center;">{c}</td>' for c in cells)
        trs.append(f'<tr style="{zebra}">{tds}</tr>')
    return f'''
  <div style="margin-top: 7px;">
    <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
      <strong>ATLETA {n}: #ATHLETE_{n}_NAME#</strong>
      <span style="color: #374151;">Barra base: <strong>#ATHLETE_{n}_BAR#</strong></span>
    </div>
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid {LINE};">
      <thead><tr style="background: {SOFT}; font-size: 10px; color: #374151;">{th}</tr></thead>
      <tbody>{"".join(trs)}</tbody>
    </table>
    <div style="text-align: right; font-size: 10px; margin-top: 3px;"><strong>Maior carga válida do atleta {n}:</strong> {blank(60)} kg</div>
  </div>'''


def wod3():
    legend = ' &nbsp; '.join(f'{dot(c)}{p}' for p, c in PLATES)
    body = f'''
  <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; border: 1px solid {LINE}; border-radius: 4px; padding: 5px 10px; font-size: 10px;">
    <div><strong>Barra base:</strong> &nbsp; [#BAR_MASC_MARK#] Masc 20 kg &nbsp; [#BAR_FEM_MARK#] Fem 15 kg</div>
    <div style="white-space: nowrap; color: #374151;">{legend}</div>
  </div>
  <div style="font-size: 9px; color: {MUTED}; margin-top: 3px;">Anote em cada coluna a quantidade de anilhas daquele peso na barra (ex.: duas de 20k + quatro de 10k + barra 20 kg = 100 kg).</div>
  {athlete_table(1)}
  {athlete_table(2)}
  <div style="display: flex; gap: 10px; align-items: stretch; margin-top: 10px;">
    <div style="flex: 1; display: grid; grid-template-columns: 1.6fr 1fr; gap: 8px;">
      <div style="border: 1.5px solid {INK}; border-radius: 4px; padding: 10px 12px;">
        <div style="font-size: 9px; color: {MUTED}; text-transform: uppercase; font-weight: 700;">Score oficial · carga total da dupla (atleta 1 + atleta 2)</div>
        <div style="margin-top: 6px; font-size: 14px; font-weight: 800;">{blank(110)} kg</div>
      </div>
      <div style="border: 1.5px solid {INK}; border-radius: 4px; padding: 10px 12px;">
        <div style="font-size: 9px; color: {MUTED}; text-transform: uppercase; font-weight: 700;">Tie-break</div>
        <div style="margin-top: 6px;">{TIME}</div>
      </div>
    </div>
    {qr('QRCODE', 'WOD 3')}
  </div>'''
    return card(header("WOD 3: Maximum Lift", "1 Hang Clean n' Jerk · Carga máxima válida da dupla em kg · até 6 tentativas por atleta") + body + signatures())


# Death By do 1-B: thrusters sobem 10/15/20/25/30 em todas as categorias (cards oficiais)
DEATH_BY_THRUSTERS = [10, 15, 20, 25, 30]
DEATH_BY_WINDOWS = ['Min 6:00 a 9:00', 'Min 9:00 a 12:00', 'Min 12:00 a 15:00', 'Min 15:00 a 18:00', 'Min 18:00 a 21:00']


def DEATH_BY(reps, movement):
    return [(w, f'{t} Thruster + {r} {movement} ({t + r} reps)') for w, t, r in zip(DEATH_BY_WINDOWS, DEATH_BY_THRUSTERS, reps)]


TEMPLATES = {
    # WOD 1 — janelas de 3 minutos
    'crossfit-wod1-combo-iniciante': ('WOD 1 • Iniciante: 1-A (800 m Remo) & 1-B (Death By Thruster + Jumping Pull-up • 18 kg)', 'for_time',
        wod1(800, 'Fem 18 kg', DEATH_BY([5, 10, 15, 25, 30], 'Jumping Pull-up'))),
    'crossfit-wod1-combo-scaled': ('WOD 1 • Scaled: 1-A (1000 m Remo) & 1-B (Death By Thruster + Pull-up • 35/25 kg)', 'for_time',
        wod1(1000, 'Masc 35 kg · Fem 25 kg', DEATH_BY([6, 12, 18, 24, 30], 'Pull-up'))),
    'crossfit-wod1-combo-amador': ('WOD 1 • Amador: 1-A (1200 m Remo) & 1-B (Death By Thruster + Bar Muscle Up • 45/30 kg)', 'for_time',
        wod1(1200, 'Masc 45 kg · Fem 30 kg', DEATH_BY([2, 4, 6, 8, 10], 'Bar Muscle Up'))),
    'crossfit-wod2-sync-burn-iniciante': ('WOD 2 • Iniciante: Sync & Burn (50 Sit Up + 30 Bike + 30 Burpee Line + 20 Snatch 21 kg)', 'for_time',
        wod2([(50, 'Ab Sit Up'), (30, 'Cal Air Bike'), (30, 'Sync Burpee Line'), (20, 'Snatch Sync')], 'Fem 21 kg')),
    'crossfit-wod2-sync-burn-scaled': ('WOD 2 • Scaled: Sync & Burn (50 Knee Raises + 30 Bike + 30 Burpee Step Over + 20 Snatch 40/29 kg)', 'for_time',
        wod2([(50, 'Knees Raises'), (30, 'Cal Air Bike'), (30, 'Sync Burpee Step Over'), (20, 'Snatch Sync')], 'Masc 40 kg · Fem 29 kg')),
    'crossfit-wod2-sync-burn-amador': ('WOD 2 • Amador: Sync & Burn (50 T2B + 30 Bike + 30 BBJO Sync + 20 Snatch 50/37 kg)', 'for_time',
        wod2([(50, 'Toes-to-Bar (T2B)'), (30, 'Cal Air Bike'), (30, 'Sync Burpee Box Jump Over'), (20, 'Snatch Sync')], 'Masc 50 kg · Fem 37 kg')),
    'crossfit-wod3-maximum-lift': ("WOD 3 • Maximum Lift: anilhas por atleta (1 Hang Clean n' Jerk em Dupla A4)", 'max_load', wod3()),
}


def main():
    os.makedirs(OUT, exist_ok=True)
    sql = []
    for tid, (name, wtype, html) in TEMPLATES.items():
        with open(os.path.join(OUT, f'{tid}.html'), 'w', encoding='utf-8', newline='') as f:
            f.write(html)
        assert '$tpl$' not in html
        sql.append(f"update sumula_templates set \"htmlContent\" = $tpl${html}$tpl$, name = $n${name}$n$, \"workoutType\" = '{wtype}', \"updatedAt\" = now() where id = '{tid}';")
    if '--sql' in sys.argv:
        with open(os.path.join(OUT, 'atualizar_sumulas.sql'), 'w', encoding='utf-8', newline='') as f:
            f.write('\n'.join(sql) + '\n')
    print(f'{len(TEMPLATES)} layouts gerados em {OUT}')


if __name__ == '__main__':
    main()

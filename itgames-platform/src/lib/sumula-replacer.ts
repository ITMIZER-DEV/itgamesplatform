import { generateQrSvgDataUri, generateBarcodeSvgDataUri } from '@/lib/qr-generator';
import { SUMMER_GAMES_LOGO_BASE64 } from '@/lib/summer-logo-base64';

export interface SumulaVariables {
  gameName?: string;
  gameCode?: string;
  gameLogo?: string;
  categoryName?: string;
  categoryId?: string | number;
  registerNumber?: string;
  teamName?: string;
  athletesList?: string;
  // Atletas na ordem da inscrição (nome e sexo) para súmulas por atleta, como a do WOD 3
  athletes?: { name: string; gender?: string }[];
  boxAffiliate?: string;
  eventTitle?: string;
  workoutDescription?: string;
  timeCap?: string;
  tieBreakRule?: string;
  heatNumber?: string | number;
  laneNumber?: string | number;
  heatTime?: string;
  wodCodeA?: string | number;
  wodCodeB?: string | number;
  originUrl?: string;
}

// Escapa texto vindo de cadastro (nomes de equipe/atleta, box, títulos) antes de entrar no HTML da súmula
const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function replaceSumulaVariables(
  htmlTemplate: string,
  variables: SumulaVariables
): string {
  if (!htmlTemplate) return '';
  let result = htmlTemplate;

  // 1. Logo Oficial em Base64 para máxima fidelidade e nunca quebrar
  let logo = variables.gameLogo;
  if (!logo || logo.startsWith('/uploads/') || logo.includes('SUMMER2026') || logo.includes('banner')) {
    logo = SUMMER_GAMES_LOGO_BASE64;
  }
  // Substitui com função callback e adiciona fallback seguro caso o base64 falhe no browser
  result = result.replaceAll('src="#GAMELOGO#"', () => `src="${logo}" onerror="this.onerror=null;this.src='/brand/summer-games-logo.png'"`);
  result = result.replaceAll('#GAMELOGO#', () => logo);

  const gameName = variables.gameName || 'SUMMER CROSS 2026 INTERBOX';
  const catName = variables.categoryName || 'Geral';
  const regNum = variables.registerNumber || '#000';
  const team = variables.teamName || 'Time';
  const athletes = variables.athletesList || 'Atleta';
  const box = variables.boxAffiliate || 'Box / Afiliação';
  const title = variables.eventTitle || 'Evento Principal';
  const desc = variables.workoutDescription || 'Conforme briefing oficial';
  const cap = variables.timeCap || '12:00';
  const tie = variables.tieBreakRule || 'Tempo do Round 2';
  const heat = String(variables.heatNumber || '1');
  const lane = String(variables.laneNumber || '1');
  const time = variables.heatTime || '09:00';

  result = result.replaceAll('#GAMENAME#', () => esc(gameName));
  result = result.replaceAll('#CATEGORYNAME#', () => esc(catName));
  result = result.replaceAll('#REGISTERNUMBER#', () => esc(regNum));
  result = result.replaceAll('#TEAMNAME#', () => esc(team));
  result = result.replaceAll('#ATHLETES_LIST#', () => esc(athletes));
  result = result.replaceAll('#BOX_AFFILIATE#', () => esc(box));
  result = result.replaceAll('#EVENTTITLE#', () => esc(title));
  result = result.replaceAll('#WORKOUT_DESCRIPTION#', () => esc(desc));
  result = result.replaceAll('#TIME_CAP#', () => esc(cap));
  result = result.replaceAll('#TIE_BREAK_RULE#', () => esc(tie));
  result = result.replaceAll('#HEAT_NUMBER#', () => esc(heat));
  result = result.replaceAll('#LANE_NUMBER#', () => esc(lane));
  result = result.replaceAll('#HEAT_TIME#', () => esc(time));

  // Atletas e barra base: categoria masculina = 20 kg, feminina = 15 kg; mista segue o sexo do atleta
  const upperCat = catName.toUpperCase();
  const catBar = upperCat.includes('MASC') ? 20 : upperCat.includes('FEM') ? 15 : null;
  const athletesArr = variables.athletes || [];
  const barOf = (a?: { gender?: string }) => {
    if (catBar) return catBar;
    const g = String(a?.gender || '').toUpperCase();
    return g === 'M' ? 20 : g === 'F' ? 15 : null;
  };
  const bars = [0, 1].map((i) => barOf(athletesArr[i]));
  [0, 1].forEach((i) => {
    const name = esc(athletesArr[i]?.name || '_______________________________');
    const bar = bars[i] ? `${bars[i]} kg` : '[ ] 20 kg &nbsp; [ ] 15 kg';
    result = result.replaceAll(`#ATHLETE_${i + 1}_NAME#`, () => name);
    result = result.replaceAll(`#ATHLETE_${i + 1}_BAR#`, () => bar);
  });
  result = result.replaceAll('#BAR_MASC_MARK#', () => (bars.includes(20) ? 'X' : '&nbsp;&nbsp;'));
  result = result.replaceAll('#BAR_FEM_MARK#', () => (bars.includes(15) ? 'X' : '&nbsp;&nbsp;'));

  // 2. GERAÇÃO DOS QR CODES E CÓDIGOS DE BARRAS INTELIGENTES DO ÁRBITRO
  const baseHost = variables.originUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  const catId = variables.categoryId ? encodeURIComponent(String(variables.categoryId)) : '';
  const cleanReg = encodeURIComponent(regNum.replace('#', ''));

  // Determina códigos de prova para WOD Combo (1-A / 1-B ou 4-A / 4-B)
  const isWod4 = title.includes('WOD 4') || title.includes('4-A') || title.includes('DOUBLE TROUBLE');
  const defaultCodeA = isWod4 ? 'WOD 4-A' : 'WOD 1-A';
  const defaultCodeB = isWod4 ? 'WOD 4-B' : 'WOD 1-B';

  const codeA = variables.wodCodeA ? String(variables.wodCodeA) : defaultCodeA;
  const codeB = variables.wodCodeB ? String(variables.wodCodeB) : defaultCodeB;

  const urlA = `${baseHost}/judge?cat=${catId}&wod=${encodeURIComponent(codeA)}&heat=${heat}&lane=${lane}&reg=${cleanReg}`;
  const urlB = `${baseHost}/judge?cat=${catId}&wod=${encodeURIComponent(codeB)}&heat=${heat}&lane=${lane}&reg=${cleanReg}`;
  const urlSingle = `${baseHost}/judge?cat=${catId}&wod=${encodeURIComponent(title)}&heat=${heat}&lane=${lane}&reg=${cleanReg}`;

  const qrA = generateQrSvgDataUri(urlA, 66);
  const qrB = generateQrSvgDataUri(urlB, 66);
  const qrSingle = generateQrSvgDataUri(urlSingle, 72);

  const barA = generateBarcodeSvgDataUri(`${isWod4 ? 'W4A' : 'W1A'}-C${catId}-H${heat}-L${lane}`, 130, 20);
  const barB = generateBarcodeSvgDataUri(`${isWod4 ? 'W4B' : 'W1B'}-C${catId}-H${heat}-L${lane}`, 130, 20);
  const barSingle = generateBarcodeSvgDataUri(`PROVA-C${catId}-H${heat}-L${lane}`, 130, 20);

  result = result.replaceAll('#QRCODE_A#', () => qrA);
  result = result.replaceAll('#QRCODE_B#', () => qrB);
  result = result.replaceAll('#BARCODE_A#', () => barA);
  result = result.replaceAll('#BARCODE_B#', () => barB);

  result = result.replaceAll('#QRCODE#', () => qrSingle);
  result = result.replaceAll('#BARCODE#', () => barSingle);

  return result;
}

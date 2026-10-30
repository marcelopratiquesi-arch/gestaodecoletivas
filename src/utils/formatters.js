// Formatação única do sistema (data, hora, moeda, percentual e dia da semana).
// Regras:
//  - O FORMATO segue o idioma escolhido por quem está usando (pt-BR, es-AR, en-US).
//  - A MOEDA segue o país da unidade (BR -> R$, AR -> $ ARS, US -> US$), nunca o idioma.
//  - Datas "AAAA-MM-DD" do banco são lidas como data local, sem o bug de voltar um dia por causa do UTC.
//  - Dias da semana continuam gravados em português no banco ("Segunda"...); aqui só traduzimos para exibir.
import i18n from '../i18n';

export const LANGUAGES = [
  { code: 'pt-BR', name: 'Português', region: '(Brasil)', short: 'PT', flag: 'https://flagcdn.com/w40/br.png' },
  { code: 'en-US', name: 'English', region: '(US)', short: 'EN', flag: 'https://flagcdn.com/w40/us.png' },
  { code: 'es-AR', name: 'Español', region: '(Argentina)', short: 'ES', flag: 'https://flagcdn.com/w40/ar.png' },
];

export const getLocale = () => {
  const lang = i18n.language || 'pt-BR';
  return LANGUAGES.some(l => l.code === lang) ? lang : 'pt-BR';
};

// --- DIAS DA SEMANA (chave = valor gravado no banco) ---
// Índice igual ao Date.getDay(): 0 = Domingo.
export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
// Ordem de exibição da grade (segunda a domingo).
export const DIAS_SEMANA_GRADE = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

export const getDiaSemana = (value) => {
  const d = toDate(value);
  return d ? DIAS_SEMANA[d.getDay()] : '';
};

export const formatWeekday = (diaBanco, { short = false } = {}) => {
  if (!diaBanco) return '';
  return i18n.t(`common.${short ? 'weekdaysShort' : 'weekdays'}.${diaBanco}`, diaBanco);
};

// --- VALORES GRAVADOS EM PORTUGUÊS NO BANCO (traduzidos só na exibição) ---
// Mapa: valor no banco -> chave em common.json. Textos livres ("Outros" descritos) aparecem como foram digitados.
export const MOTIVOS_CANCELAMENTO = {
  'Feriado': 'holiday',
  'Férias Professor': 'teacherVacation',
  'Atestado Médico': 'medicalLeave',
  'Manutenção Unidade': 'unitMaintenance',
  'Falta sem Justificativa': 'unjustifiedAbsence',
  'Chuva/Clima': 'weather',
  'Outros': 'other',
  'Recesso/Feriado': 'recessHoliday',
  'RECESSO/FERIADO AUTOMÁTICO': 'autoRecess',
};

export const MOTIVOS_SUBSTITUICAO = {
  'Atestado do Titular': 'holderMedicalLeave',
  'Férias': 'vacation',
  'Folga Programada': 'scheduledDayOff',
  'Emergência': 'emergency',
  'Outros': 'other',
};

export const formatCancelReason = (motivo) => {
  if (!motivo) return '';
  if (MOTIVOS_CANCELAMENTO[motivo]) return i18n.t(`common.cancelReasons.${MOTIVOS_CANCELAMENTO[motivo]}`);
  // Gravado pelo cadastro de feriados: "Recesso: <nome do feriado>"
  if (motivo.startsWith('Recesso: ')) return i18n.t('common.cancelReasons.recessNamed', { name: motivo.slice(9) });
  return motivo;
};

export const formatSubstitutionReason = (motivo) =>
  MOTIVOS_SUBSTITUICAO[motivo] ? i18n.t(`common.substitutionReasons.${MOTIVOS_SUBSTITUICAO[motivo]}`) : (motivo || '');

export const formatRole = (role) => {
  if (!role) return '';
  const chave = String(role).toLowerCase() === 'sistema' ? 'system' : String(role).toLowerCase();
  return i18n.t(`common.roles.${chave}`, role);
};

// --- DATAS ---
// Aceita "AAAA-MM-DD", "AAAA-MM-DDTHH:mm...", Date, Timestamp do Firestore ou { seconds }.
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value) ? null : value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  if (typeof value === 'string') {
    const soData = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (soData) return new Date(Number(soData[1]), Number(soData[2]) - 1, Number(soData[3]));
  }
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

const PRESETS_DATA = {
  short: { day: '2-digit', month: '2-digit', year: 'numeric' },   // 29/10/2026 | 10/29/2026
  dayMonth: { day: '2-digit', month: '2-digit' },                   // 29/10 | 10/29
  long: { day: 'numeric', month: 'long', year: 'numeric' },         // 29 de outubro de 2026
  monthYear: { month: 'long', year: 'numeric' },                    // outubro de 2026
};

export const formatDate = (value, preset = 'short') => {
  const d = toDate(value);
  if (!d) return '-';
  const options = typeof preset === 'string' ? PRESETS_DATA[preset] : preset;
  return d.toLocaleDateString(getLocale(), options);
};

export const formatTime = (value) => {
  const d = toDate(value);
  if (!d) return '-';
  return d.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
};

export const formatDateTime = (value) => {
  const d = toDate(value);
  if (!d) return '-';
  return `${formatDate(d)} ${formatTime(d)}`;
};

export const formatPeriod = (inicio, fim, preset = 'short') => {
  if (!inicio || !fim) return '';
  if (inicio === fim) return formatDate(inicio, preset);
  return `${formatDate(inicio, preset)} – ${formatDate(fim, preset)}`;
};

// --- MOEDA ---
const MOEDA_POR_PAIS = {
  BR: 'BRL', BRASIL: 'BRL',
  AR: 'ARS', ARGENTINA: 'ARS',
  US: 'USD', 'ESTADOS UNIDOS': 'USD', EUA: 'USD',
};

// Símbolo fixo por moeda, igual em qualquer idioma (o Intl mostraria "BRL", "ARS" ou "$" dependendo do idioma).
const SIMBOLO_MOEDA = { BRL: 'R$', ARS: 'AR$', USD: 'US$' };

export const getCurrencyCode = (pais) => MOEDA_POR_PAIS[String(pais || '').trim().toUpperCase()] || 'BRL';

// Só o símbolo, para rótulos de campo: "Valor (R$)".
export const getCurrencySymbol = (pais) => SIMBOLO_MOEDA[getCurrencyCode(pais)];

// Separadores de milhar/decimal seguem o idioma; o símbolo segue o país da unidade.
export const formatCurrency = (value, pais, options = {}) => {
  const code = getCurrencyCode(pais);
  return new Intl.NumberFormat(getLocale(), { style: 'currency', currency: code, currencyDisplay: 'code', ...options })
    .formatToParts(Number(value) || 0)
    .map(p => (p.type === 'currency' ? SIMBOLO_MOEDA[code] : p.value))
    .join('')
    .replace(/ /g, ' ');
};

// --- NÚMEROS ---
export const formatNumber = (value, options = {}) =>
  new Intl.NumberFormat(getLocale(), options).format(Number(value) || 0);

// Recebe o valor em pontos percentuais (12.5 -> "12,5%").
export const formatPercent = (value, casas = 1) =>
  new Intl.NumberFormat(getLocale(), { style: 'percent', minimumFractionDigits: casas, maximumFractionDigits: casas })
    .format((Number(value) || 0) / 100);

// Lista SUGERIDA de feriados nacionais (BR, AR, US) para o admin aplicar ou dispensar, ano a ano.
// Nada é aplicado sozinho: cada item vira um feriado de abrangência "país" só quando o admin manda.
//
// Datas fixas e móveis (Páscoa, Carnaval...) são calculadas aqui. O que o governo decreta a cada ano
// (feriados-ponte da Argentina, mudanças de data) NÃO dá para saber: esses itens vêm com conferir=true.

export const PAISES_SUGERIDOS = ['BR', 'AR', 'US'];

// ---------- datas (sempre em UTC para não sofrer com fuso) ----------
const dataStr = (d) => d.toISOString().slice(0, 10);
const criar = (ano, mes, dia) => new Date(Date.UTC(ano, mes - 1, dia));
const somar = (d, dias) => new Date(d.getTime() + dias * 86400000);
const fixa = (ano, mes, dia) => dataStr(criar(ano, mes, dia));

// Páscoa (algoritmo gregoriano de Meeus/Jones/Butcher).
export function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return criar(ano, mes, dia);
}

// n-ésimo dia da semana do mês (diaSemana: 0 = domingo ... 6 = sábado). n = -1 → o último.
function enesimoDiaDaSemana(ano, mes, diaSemana, n) {
  if (n > 0) {
    const primeiro = criar(ano, mes, 1);
    const desloc = (diaSemana - primeiro.getUTCDay() + 7) % 7;
    return somar(primeiro, desloc + (n - 1) * 7);
  }
  const ultimo = criar(ano, mes + 1, 0);
  return somar(ultimo, -((ultimo.getUTCDay() - diaSemana + 7) % 7));
}

// EUA: feriado fixo que cai no fim de semana é "observado" na sexta (sábado) ou na segunda (domingo).
function observadoEUA(ano, mes, dia) {
  const d = criar(ano, mes, dia);
  const dow = d.getUTCDay();
  if (dow === 6) return { data: dataStr(somar(d, -1)), observado: true };
  if (dow === 0) return { data: dataStr(somar(d, 1)), observado: true };
  return { data: dataStr(d), observado: false };
}

// Argentina (Lei 27.399), feriados "trasladables": terça/quarta → segunda anterior; quinta/sexta → segunda seguinte.
function trasladavelAR(ano, mes, dia) {
  const d = criar(ano, mes, dia);
  const dow = d.getUTCDay();
  if (dow === 2 || dow === 3) return dataStr(somar(d, -(dow - 1)));
  if (dow === 4 || dow === 5) return dataStr(somar(d, 8 - dow));
  return dataStr(d);
}

const item = (pais, ano, slug, nome, dataInicio, extra = {}) => ({
  chave: `${pais}-${ano}-${slug}`, pais, ano, nome, dataInicio, dataFim: extra.dataFim || dataInicio,
  tipo: extra.tipo || 'Feriado Nacional', conferir: Boolean(extra.conferir), nota: extra.nota || null,
});

function feriadosBR(ano) {
  const p = pascoa(ano);
  const lista = [
    item('BR', ano, 'ano-novo', 'Confraternização Universal', fixa(ano, 1, 1)),
    item('BR', ano, 'carnaval', 'Carnaval', dataStr(somar(p, -48)), { dataFim: dataStr(somar(p, -47)), tipo: 'Recesso', nota: 'Ponto facultativo (segunda e terça)' }),
    item('BR', ano, 'sexta-santa', 'Sexta-feira Santa', dataStr(somar(p, -2))),
    item('BR', ano, 'tiradentes', 'Tiradentes', fixa(ano, 4, 21)),
    item('BR', ano, 'trabalho', 'Dia do Trabalho', fixa(ano, 5, 1)),
    item('BR', ano, 'corpus-christi', 'Corpus Christi', dataStr(somar(p, 60)), { tipo: 'Recesso', nota: 'Ponto facultativo' }),
    item('BR', ano, 'independencia', 'Independência do Brasil', fixa(ano, 9, 7)),
    item('BR', ano, 'aparecida', 'Nossa Senhora Aparecida', fixa(ano, 10, 12)),
    item('BR', ano, 'finados', 'Finados', fixa(ano, 11, 2)),
    item('BR', ano, 'republica', 'Proclamação da República', fixa(ano, 11, 15)),
    item('BR', ano, 'natal', 'Natal', fixa(ano, 12, 25)),
  ];
  // Dia da Consciência Negra é feriado nacional desde 2024 (Lei 14.759/2023).
  if (ano >= 2024) lista.push(item('BR', ano, 'consciencia-negra', 'Dia da Consciência Negra', fixa(ano, 11, 20)));
  return lista;
}

function feriadosAR(ano) {
  const p = pascoa(ano);
  const movel = (slug, nome, mes, dia) => {
    const data = trasladavelAR(ano, mes, dia);
    return item('AR', ano, slug, nome, data, { conferir: true, nota: data === fixa(ano, mes, dia) ? 'Feriado trasladable: o governo pode mover' : `Trasladado (data original ${fixa(ano, mes, dia).split('-').reverse().join('/')})` });
  };
  return [
    item('AR', ano, 'ano-novo', 'Año Nuevo', fixa(ano, 1, 1)),
    item('AR', ano, 'carnaval', 'Carnaval', dataStr(somar(p, -48)), { dataFim: dataStr(somar(p, -47)) }),
    item('AR', ano, 'memoria', 'Día Nacional de la Memoria', fixa(ano, 3, 24)),
    item('AR', ano, 'malvinas', 'Día del Veterano y de los Caídos en Malvinas', fixa(ano, 4, 2)),
    item('AR', ano, 'jueves-santo', 'Jueves Santo', dataStr(somar(p, -3)), { tipo: 'Recesso', conferir: true, nota: 'Día no laborable (opcional para empresas)' }),
    item('AR', ano, 'viernes-santo', 'Viernes Santo', dataStr(somar(p, -2))),
    item('AR', ano, 'trabajo', 'Día del Trabajador', fixa(ano, 5, 1)),
    item('AR', ano, 'revolucion', 'Día de la Revolución de Mayo', fixa(ano, 5, 25)),
    movel('guemes', 'Paso a la Inmortalidad del Gral. Güemes', 6, 17),
    item('AR', ano, 'belgrano', 'Paso a la Inmortalidad del Gral. Belgrano', fixa(ano, 6, 20)),
    item('AR', ano, 'independencia', 'Día de la Independencia', fixa(ano, 7, 9)),
    movel('san-martin', 'Paso a la Inmortalidad del Gral. San Martín', 8, 17),
    movel('diversidad', 'Día del Respeto a la Diversidad Cultural', 10, 12),
    movel('soberania', 'Día de la Soberanía Nacional', 11, 20),
    item('AR', ano, 'inmaculada', 'Inmaculada Concepción de María', fixa(ano, 12, 8)),
    item('AR', ano, 'navidad', 'Navidad', fixa(ano, 12, 25)),
  ];
}

function feriadosUS(ano) {
  const fixo = (slug, nome, mes, dia) => {
    const o = observadoEUA(ano, mes, dia);
    return item('US', ano, slug, nome, o.data, { nota: o.observado ? `Observado (data original ${fixa(ano, mes, dia).split('-').reverse().join('/')})` : null });
  };
  const seg = (slug, nome, mes, n) => item('US', ano, slug, nome, dataStr(enesimoDiaDaSemana(ano, mes, 1, n)));
  return [
    fixo('new-year', "New Year's Day", 1, 1),
    seg('mlk', 'Martin Luther King Jr. Day', 1, 3),
    seg('presidents', "Washington's Birthday (Presidents' Day)", 2, 3),
    seg('memorial', 'Memorial Day', 5, -1),
    fixo('juneteenth', 'Juneteenth', 6, 19),
    fixo('independence', 'Independence Day', 7, 4),
    seg('labor', 'Labor Day', 9, 1),
    seg('columbus', "Columbus Day / Indigenous Peoples' Day", 10, 2),
    fixo('veterans', 'Veterans Day', 11, 11),
    item('US', ano, 'thanksgiving', 'Thanksgiving Day', dataStr(enesimoDiaDaSemana(ano, 11, 4, 4))),
    fixo('christmas', 'Christmas Day', 12, 25),
  ];
}

const POR_PAIS = { BR: feriadosBR, AR: feriadosAR, US: feriadosUS };

/** Feriados sugeridos de um país e ano, em ordem de data. */
export function feriadosSugeridos(pais, ano) {
  const fabrica = POR_PAIS[pais];
  if (!fabrica || !Number.isInteger(ano)) return [];
  return fabrica(ano).sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));
}

/** Feriado cadastrado que já cobre esta sugestão: mesmo país (ou rede) e mesmo período. */
export function sugestaoJaAplicada(sugestao, cadastrados = []) {
  return cadastrados.some(f => {
    const escopo = f.escopo || (f.unidadeId ? 'unidades' : 'rede');
    const ini = f.dataInicio || f.data;
    const fim = f.dataFim || f.data || ini;
    const mesmoPeriodo = ini === sugestao.dataInicio && fim === sugestao.dataFim;
    const mesmoAlcance = escopo === 'rede' || (escopo === 'pais' && String(f.pais || '').toUpperCase() === sugestao.pais);
    return mesmoPeriodo && mesmoAlcance;
  });
}

// Dinheiro de países diferentes NUNCA se soma: real, peso e dólar valem coisas diferentes.
// Estas funções agrupam por moeda (a moeda vem do país da unidade) e devolvem um total para cada uma.
import { getCurrencyCode, formatCurrency } from './formatters';

// País "de referência" de cada moeda, só para o formatador escolher o símbolo certo.
const PAIS_DA_MOEDA = { BRL: 'BR', ARS: 'AR', USD: 'US' };

export const moedaDoPais = (pais) => getCurrencyCode(pais);

/** Soma `pegarValor(item)` agrupando pela moeda do país de `pegarPais(item)`. Ex.: { BRL: 1200, ARS: 80000 }. */
export function somarPorMoeda(itens = [], pegarPais, pegarValor) {
  const totais = {};
  itens.forEach((item) => {
    const valor = Number(pegarValor(item)) || 0;
    const moeda = moedaDoPais(pegarPais(item));
    totais[moeda] = (totais[moeda] || 0) + valor;
  });
  return totais;
}

/** Junta dois mapas de totais (soma moeda a moeda). */
export function juntarTotais(a = {}, b = {}) {
  const r = { ...a };
  Object.entries(b).forEach(([moeda, v]) => { r[moeda] = (r[moeda] || 0) + v; });
  return r;
}

/** Moedas presentes, a de maior total primeiro (desempate por nome, para ficar estável). */
export const moedasEmOrdem = (totais = {}) =>
  Object.keys(totais).sort((x, y) => (Math.abs(totais[y]) - Math.abs(totais[x])) || x.localeCompare(y));

/** Divide total por contagem, moeda a moeda (média por aula). Contagem zero vira 0. */
export function dividirPorMoeda(totais = {}, contagens = {}) {
  const r = {};
  Object.keys(totais).forEach((m) => { r[m] = contagens[m] > 0 ? totais[m] / contagens[m] : 0; });
  return r;
}

export const formatarMoeda = (valor, moeda) => formatCurrency(valor, PAIS_DA_MOEDA[moeda]);

/** Texto com todas as moedas: "R$ 1.200,00 · AR$ 80.000,00". Sem nada, mostra zero na moeda padrão. */
export function textoPorMoeda(totais = {}, separador = ' · ') {
  const moedas = moedasEmOrdem(totais);
  if (moedas.length === 0) return formatarMoeda(0, 'BRL');
  return moedas.map((m) => formatarMoeda(totais[m], m)).join(separador);
}

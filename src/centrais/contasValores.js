// Contas de VALORES das Centrais: quanto a unidade gastou, quanto cada professor recebeu, evolução por mês.
// Conta pura (sem banco e sem tela), com teste.
//
// Mesmas regras do Relatório e do Financeiro:
//   - só aula REALIZADA tem valor; vale o valor em vigor no dia da aula (src/utils/valores.js);
//   - aulão vale o valor pago lançado nele;
//   - validação repetida da mesma aula/dia conta uma vez (src/utils/validacoes.js);
//   - validação de aula que não existe mais no cadastro de aulas fica de fora (como no Relatório);
//   - quem recebe é o professor QUE DEU a aula (na substituição, o substituto);
//   - real, peso e dólar nunca se somam: totais são separados por moeda.
import { deduplicarValidacoes } from '../utils/validacoes';
import { valorDaValidacao } from '../utils/valores';
import { getCurrencyCode } from '../utils/formatters';

const doisDigitos = (n) => String(n).padStart(2, '0');

export function limitesDoMes(mes) {
  const [ano, m] = mes.split('-').map(Number);
  return [`${mes}-01`, `${mes}-${doisDigitos(new Date(ano, m, 0).getDate())}`];
}

// O mês escolhido e os dois anteriores, do mais antigo para o mais novo.
export function mesesDoTrimestre(mes) {
  const [ano, m] = mes.split('-').map(Number);
  return [2, 1, 0].map((atras) => {
    const d = new Date(ano, m - 1 - atras, 1);
    return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}`;
  });
}

// Validações realizadas "que contam", já com a aula e o valor de cada uma.
function realizadasComValor(validacoes = [], aulasTodas = [], inicio = '', fim = '9999') {
  const aulaPorId = new Map(aulasTodas.map((a) => [String(a.id), a]));
  const lista = [];
  deduplicarValidacoes(validacoes.filter((v) => v && v.data >= inicio && v.data <= fim)).forEach((v) => {
    if (v.status !== 'realizada') return;
    const aula = v.isAulao ? null : aulaPorId.get(String(v.aulaId));
    if (!v.isAulao && !aula) return;
    lista.push({
      v,
      aula,
      valor: valorDaValidacao(v, aula),
      alunos: Number(v.alunos) || 0,
      unidadeId: String(v.unidadeId ?? aula?.unidadeId ?? ''),
      professorId: String(v.professorId || aula?.professorId || ''),
    });
  });
  return lista;
}

const somar = (lista) => {
  const realizadas = lista.length;
  const alunos = lista.reduce((s, x) => s + x.alunos, 0);
  return { valor: lista.reduce((s, x) => s + x.valor, 0), realizadas, alunos, media: realizadas > 0 ? Math.round(alunos / realizadas) : 0 };
};

// ---------- Unidade ----------
// Um registro por mês: { mes, valor, realizadas, alunos, media }.
export function gastoPorMes({ validacoes, meses, aulasTodas }) {
  return meses.map((mes) => {
    const [inicio, fim] = limitesDoMes(mes);
    return { mes, ...somar(realizadasComValor(validacoes, aulasTodas, inicio, fim)) };
  });
}

// Quanto cada professor recebeu no período, do maior para o menor: [{ professorId, valor, realizadas, alunos, media }].
export function gastoPorProfessor({ validacoes, inicio, fim, aulasTodas }) {
  const porProfessor = new Map();
  realizadasComValor(validacoes, aulasTodas, inicio, fim).forEach((x) => {
    if (!porProfessor.has(x.professorId)) porProfessor.set(x.professorId, []);
    porProfessor.get(x.professorId).push(x);
  });
  return [...porProfessor.entries()]
    .map(([professorId, lista]) => ({ professorId, ...somar(lista) }))
    .sort((a, b) => b.valor - a.valor || b.realizadas - a.realizadas);
}

// ---------- Mentor ----------
// Gasto de cada unidade no período, a partir das validações: Map unidadeId -> { valor, realizadas, alunos, media }.
export function gastoPorUnidade({ validacoes, inicio, fim, aulasTodas, unidades = [] }) {
  const todas = realizadasComValor(validacoes, aulasTodas, inicio, fim);
  return new Map(unidades.map((u) => [String(u.id), somar(todas.filter((x) => x.unidadeId === String(u.id)))]));
}

// O mesmo, a partir do "fechamento do mês" (resumos_mensais: 1 documento por mês já fechado).
export function gastoPorUnidadeDoResumo(resumo, unidades = []) {
  const zerado = () => ({ valor: 0, realizadas: 0, alunos: 0 });
  const porUnidade = new Map(unidades.map((u) => [String(u.id), zerado()]));
  const juntar = (item) => {
    const alvo = porUnidade.get(String(item?.u));
    if (!alvo) return;
    alvo.valor += Number(item.v) || 0;
    alvo.realizadas += Number(item.r) || 0;
    alvo.alunos += Number(item.a) || 0;
  };
  Object.values(resumo?.porAula || {}).forEach(juntar);
  Object.values(resumo?.auloes || {}).forEach(juntar);
  porUnidade.forEach((x) => { x.media = x.realizadas > 0 ? Math.round(x.alunos / x.realizadas) : 0; });
  return porUnidade;
}

// Totais separados por moeda: [{ pais, valor }] (maior primeiro). linhas: [{ pais, valor }].
export function totaisPorMoeda(linhas = []) {
  const porMoeda = {};
  linhas.forEach(({ pais, valor }) => {
    const moeda = getCurrencyCode(pais);
    if (!porMoeda[moeda]) porMoeda[moeda] = { pais, valor: 0 };
    porMoeda[moeda].valor += Number(valor) || 0;
  });
  return Object.values(porMoeda).sort((a, b) => b.valor - a.valor);
}

// ---------- Professor ----------
// Aulas que ELE deu (titular ou substituto), só nas unidades que quem está olhando enxerga.
function aulasDadasPor({ validacoes, professorId, aulasTodas, unidades = [], inicio, fim }) {
  const unidadePorId = new Map(unidades.map((u) => [String(u.id), u]));
  return realizadasComValor(validacoes, aulasTodas, inicio, fim)
    .filter((x) => String(x.v.professorId) === String(professorId) && unidadePorId.has(x.unidadeId))
    .map((x) => ({ ...x, unidade: unidadePorId.get(x.unidadeId) }));
}

// Um registro por mês: { mes, realizadas, alunos, media, valores: [{ pais, valor }] }.
export function ganhoDoProfessorPorMes({ validacoes, meses, professorId, aulasTodas, unidades }) {
  return meses.map((mes) => {
    const [inicio, fim] = limitesDoMes(mes);
    const lista = aulasDadasPor({ validacoes, professorId, aulasTodas, unidades, inicio, fim });
    const { realizadas, alunos, media } = somar(lista);
    return { mes, realizadas, alunos, media, valores: totaisPorMoeda(lista.map((x) => ({ pais: x.unidade.pais, valor: x.valor }))) };
  });
}

// Quanto ele recebeu em cada unidade no período: [{ unidade, valor, realizadas, alunos, media }] (maior primeiro).
export function ganhoDoProfessorPorUnidade({ validacoes, inicio, fim, professorId, aulasTodas, unidades }) {
  const porUnidade = new Map();
  aulasDadasPor({ validacoes, professorId, aulasTodas, unidades, inicio, fim }).forEach((x) => {
    if (!porUnidade.has(x.unidadeId)) porUnidade.set(x.unidadeId, { unidade: x.unidade, lista: [] });
    porUnidade.get(x.unidadeId).lista.push(x);
  });
  return [...porUnidade.values()]
    .map(({ unidade, lista }) => ({ unidade, ...somar(lista) }))
    .sort((a, b) => b.valor - a.valor);
}

// As últimas aulas que ele deu (mais recente primeiro).
export function ultimasAulasDoProfessor({ validacoes, professorId, aulasTodas, unidades, limite = 12 }) {
  return aulasDadasPor({ validacoes, professorId, aulasTodas, unidades })
    .sort((a, b) => String(b.v.data).localeCompare(String(a.v.data)) || String(b.v.hora || b.aula?.hora || '').localeCompare(String(a.v.hora || a.aula?.hora || '')))
    .slice(0, limite)
    .map((x) => ({
      id: x.v.id,
      data: x.v.data,
      hora: x.aula?.hora || x.v.hora || '',
      unidade: x.unidade,
      modalidadeId: x.aula?.modalidadeId ?? x.v.modalidadeId ?? null,
      alunos: x.alunos,
      valor: x.valor,
      substituicao: x.v.substituicao === true,
      aulao: x.v.isAulao === true,
    }));
}

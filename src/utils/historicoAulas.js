// Histórico de aulas (aba "Histórico" do Cronograma): regras puras, sem tela e sem banco.
//  - quem pode ver: professor NUNCA; líder/mentor só das unidades deles; admin de todas;
//  - o que entra: aulas que já terminaram (dataFim anterior a hoje) e, só para o admin, as excluídas (lixeira);
//  - o que explica: se a fase foi continuada por outra (nova fase) e o que mudou.
import { diaSeguinte } from './cronogramaRegras';

export const podeVerHistorico = (role, ehLiderPapel = false) => {
  const r = String(role || '').trim().toLowerCase();
  return r === 'admin' || r === 'mentor' || Boolean(ehLiderPapel);
};

const mesmoDia = (a, b) => [...(a || [])].sort().join('|') === [...(b || [])].sort().join('|');
const numero = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : null);

/**
 * Aulas do histórico, da mais recente para a mais antiga.
 * `unidadesPermitidas`: ids das unidades que a pessoa pode ver. `unidadeId`: filtro opcional de uma só.
 */
export function aulasDoHistorico({ aulasTodas = [], unidadesPermitidas = [], unidadeId = '', ehAdmin = false, hoje }) {
  const permitidas = new Set(unidadesPermitidas.map(String));
  return aulasTodas
    .filter((a) => {
      if (!permitidas.has(String(a.unidadeId))) return false;
      if (unidadeId && String(a.unidadeId) !== String(unidadeId)) return false;
      if (a.excluido === true) return ehAdmin;
      return Boolean(a.dataFim) && a.dataFim < hoje;
    })
    .sort((x, y) => String(y.dataFim || y.dataInicio || '').localeCompare(String(x.dataFim || x.dataInicio || '')));
}

/**
 * Para cada aula encerrada, acha a fase que a continuou (mesma unidade e modalidade, começando no dia seguinte
 * ao fim) e diz o que mudou. Devolve Map(idDaAula -> { continuadaPor, mudou: ['professor','valor','hora','dias'] }).
 */
export function continuidadeDasAulas(aulasTodas = []) {
  const porInicio = new Map();
  aulasTodas.forEach((a) => {
    if (a.excluido === true || !a.dataInicio) return;
    const k = `${a.unidadeId}|${a.modalidadeId}|${a.dataInicio}`;
    if (!porInicio.has(k)) porInicio.set(k, []);
    porInicio.get(k).push(a);
  });
  const resultado = new Map();
  aulasTodas.forEach((a) => {
    if (!a.dataFim) return;
    const candidatas = porInicio.get(`${a.unidadeId}|${a.modalidadeId}|${diaSeguinte(a.dataFim)}`) || [];
    const sucessora = candidatas.find((c) => c.id !== a.id && c.hora === a.hora)
      || candidatas.find((c) => c.id !== a.id && (c.dias || []).some((d) => (a.dias || []).includes(d)));
    if (!sucessora) return;
    const mudou = [];
    if (String(sucessora.professorId) !== String(a.professorId)) mudou.push('professor');
    if (numero(sucessora.valor) !== numero(a.valor)) mudou.push('valor');
    if (sucessora.hora !== a.hora) mudou.push('hora');
    if (!mesmoDia(sucessora.dias, a.dias)) mudou.push('dias');
    resultado.set(a.id, { continuadaPor: sucessora, mudou });
  });
  return resultado;
}

/** Filtros da tela: professor, modalidade e período em que a aula terminou (datas yyyy-mm-dd, inclusivas). */
export function filtrarHistorico(linhas = [], { professorId = '', modalidadeId = '', de = '', ate = '' } = {}) {
  return linhas.filter((a) => {
    if (professorId && String(a.professorId) !== String(professorId)) return false;
    if (modalidadeId && String(a.modalidadeId) !== String(modalidadeId)) return false;
    const fim = a.dataFim || '';
    if (de && (!fim || fim < de)) return false;
    if (ate && (!fim || fim > ate)) return false;
    return true;
  });
}

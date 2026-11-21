// Regra única de feriados. Todas as telas (Validação Diária, Validação Coletiva, Relatórios, Sidebar)
// usam estas funções; nenhuma tela deve ter regra própria.
//
// Um feriado tem abrangência ("escopo"):
//   rede      -> todas as unidades (também é o caso dos feriados antigos, gravados sem escopo)
//   pais      -> unidades do país (BR, AR, US)
//   estado    -> unidades do estado
//   cidade    -> unidades confirmadas no cadastro (unidadeIds) daquela cidade
//   unidades  -> unidades escolhidas (unidadeIds)
// Em rede, país, estado e cidade o admin pode marcar "exceto estas unidades" (unidadesExcecao): elas não folgam.
// O feriado é calculado na hora: aula ativa em dia de feriado = cancelada (feriado), sem pagamento e sem pendência.
// Se uma pessoa validou a aula como realizada, a validação da pessoa vale.

export const ESCOPOS_FERIADO = ['rede', 'pais', 'estado', 'cidade', 'unidades'];

const PAISES = {
  BR: 'BR', BRASIL: 'BR', BRAZIL: 'BR',
  AR: 'AR', ARGENTINA: 'AR',
  US: 'US', USA: 'US', EUA: 'US', 'ESTADOS UNIDOS': 'US', 'UNITED STATES': 'US',
};

// Unidades sem país cadastrado são brasileiras (mesmo padrão do cadastro de unidades).
export const normalizarPais = (pais) => {
  const chave = String(pais || '').trim().toUpperCase();
  return PAISES[chave] || chave || 'BR';
};

export const normalizarTexto = (texto) =>
  String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// Aceita "AAAA-MM-DD", "DD/MM/AAAA" e Timestamp do Firestore. Devolve "AAAA-MM-DD" ou null.
const normalizarData = (valor) => {
  if (!valor) return null;
  if (typeof valor.toDate === 'function') return valor.toDate().toLocaleDateString('en-CA');
  if (typeof valor.seconds === 'number') return new Date(valor.seconds * 1000).toLocaleDateString('en-CA');
  const texto = String(valor);
  if (texto.includes('/')) {
    const [dia, mes, ano] = texto.split('/');
    if (ano && mes && dia) return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }
  return texto.substring(0, 10);
};

export const escopoDoFeriado = (feriado) => feriado?.escopo || (feriado?.unidadeId ? 'unidades' : 'rede');

const unidadesDoFeriado = (feriado) => {
  if (Array.isArray(feriado.unidadeIds)) return feriado.unidadeIds.map(String);
  return feriado.unidadeId ? [String(feriado.unidadeId)] : [];
};

export const unidadesDeExcecao = (feriado) => (Array.isArray(feriado?.unidadesExcecao) ? feriado.unidadesExcecao.map(String) : []);

export function feriadoAplicaNaUnidade(feriado, unidade) {
  if (!feriado) return false;
  if (unidadesDeExcecao(feriado).includes(String(unidade?.id))) return false;
  switch (escopoDoFeriado(feriado)) {
    case 'pais':
      return normalizarPais(unidade?.pais) === normalizarPais(feriado.pais);
    case 'estado':
      return Boolean(feriado.estado) && normalizarTexto(unidade?.estado) === normalizarTexto(feriado.estado);
    case 'cidade':
    case 'unidades':
      return unidadesDoFeriado(feriado).includes(String(unidade?.id));
    case 'rede':
    default:
      return true;
  }
}

// Devolve o feriado que cai em "dataAAAAMMDD" para a unidade, ou null.
export function feriadoNoDia(dataAAAAMMDD, unidade, feriados = []) {
  if (!dataAAAAMMDD) return null;
  return feriados.find(f => {
    const inicio = normalizarData(f.dataInicio || f.inicio || f.data);
    const fim = normalizarData(f.dataFim || f.fim || f.data) || inicio;
    if (!inicio) return false;
    return dataAAAAMMDD >= inicio && dataAAAAMMDD <= fim && feriadoAplicaNaUnidade(f, unidade);
  }) || null;
}

// REFORMA: tipo de recesso para unidade fechada em obra. Funciona igual aos outros (a aula do período é cancelada, sem
// pagamento e sem pendência), mas só vale para unidades escolhidas e as telas dizem "unidade em reforma" em vez de "feriado".
export const TIPO_REFORMA = 'Reforma';
export const ehReforma = (feriado) => feriado?.tipo === TIPO_REFORMA;

// Esta reforma está valendo hoje? (`hoje` = "AAAA-MM-DD")
export function reformaEmAndamento(feriado, hoje) {
  if (!ehReforma(feriado)) return false;
  const inicio = normalizarData(feriado.dataInicio);
  const fim = normalizarData(feriado.dataFim) || inicio;
  return Boolean(inicio) && hoje >= inicio && hoje <= fim;
}

// Cancelamentos que o sistema antigo gravava no banco ao criar um feriado.
export const ehCancelamentoAutomaticoDeFeriado = (validacao) => validacao?.validadoPor === 'SISTEMA_FERIADO';

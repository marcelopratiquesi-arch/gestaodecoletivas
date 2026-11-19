// Quem pode abrir cada Central (e achar o cadastro pedido). Conta pura, com teste.
//
//   'editar' = vê tudo e tem os atalhos de edição;  'ver' = modo leitura;  null = não pode abrir.
//
//   Unidade   -> admin: todas · mentor: as dele · líder: só as que ele lidera (leitura)
//   Líder     -> igual à unidade dele (o líder fica gravado dentro da unidade).
//                tipo 'lider' = 1º líder da unidade; tipo 'lider2' = 2º líder da unidade.
//   Mentor    -> admin: todos · o próprio mentor: a dele (leitura)
//   Professor -> admin: todos · mentor e líder: os professores vinculados às unidades deles ·
//                o próprio professor: a dele (leitura)
import { ehLider, unidadesDoLider, escopoMentor, ehDoMeuEscopo } from '../permissions';
import { acessoUnidade, acharUnidade, ehAdmin, liderDaVaga } from './contasUnidade';

// Vaga de líder de cada tipo de ficha.
export const VAGA_DO_TIPO = { lider: 1, lider2: 2 };
export const tipoDaVaga = (vaga) => (vaga === 2 ? 'lider2' : 'lider');

const texto = (v) => String(v ?? '').trim();
const papelDe = (userData) => texto(userData?.role).toLowerCase();
const idDe = (userData) => userData?.id || userData?.uid;

const acharPorIdOuNome = (lista = [], alvo) => {
  if (!alvo) return null;
  const id = typeof alvo === 'object' ? (alvo.id ?? alvo.uid) : alvo;
  const porId = lista.find((x) => String(x.id) === String(id));
  if (porId) return porId;
  const nome = texto(typeof alvo === 'object' ? alvo.nome : alvo).toLowerCase();
  return nome ? lista.find((x) => texto(x.nome).toLowerCase() === nome) || null : null;
};

// Unidades que a pessoa enxerga.
export function unidadesVisiveis(userData, unidades = []) {
  const papel = papelDe(userData);
  if (ehAdmin(papel)) return unidades;
  if (papel === 'mentor') return unidades.filter((u) => ehDoMeuEscopo(userData, u.mentorId));
  if (ehLider(papel)) { const minhas = unidadesDoLider(userData); return unidades.filter((u) => minhas.includes(String(u.id))); }
  return [];
}

export function ehOProprioProfessor(userData, professor) {
  if (papelDe(userData) !== 'professor' || !professor) return false;
  return String(userData.professorId || '') === String(professor.id) || (!!professor.uidLogin && professor.uidLogin === idDe(userData));
}

// Devolve o cadastro pedido (ou null). O líder é identificado pela unidade dele.
export function resolverAlvo(tipo, alvo, catalogs) {
  if (!alvo || !catalogs) return null;
  if (tipo === 'unidade') return acharUnidade(catalogs.unidades, alvo);
  if (VAGA_DO_TIPO[tipo]) {
    const campo = tipo === 'lider2' ? 'lider2Uid' : 'liderUid';
    const uid = typeof alvo === 'object' ? alvo[campo] : alvo;
    return acharUnidade(catalogs.unidades, alvo) || (catalogs.unidades || []).find((u) => u[campo] && u[campo] === uid) || null;
  }
  if (tipo === 'mentor') return acharPorIdOuNome(catalogs.mentores, alvo);
  if (tipo === 'professor') return acharPorIdOuNome(catalogs.professores, alvo);
  return null;
}

export function acessoCentral(tipo, registro, userData, catalogs) {
  if (!registro || !userData) return null;
  const papel = papelDe(userData);
  if (tipo === 'unidade') return acessoUnidade(userData, registro);
  if (VAGA_DO_TIPO[tipo]) return liderDaVaga(registro, VAGA_DO_TIPO[tipo]) ? acessoUnidade(userData, registro) : null;
  if (tipo === 'mentor') {
    if (ehAdmin(papel)) return 'editar';
    // O mentor vê a própria ficha; o 1º e o 2º mentor (mesma equipe) veem a ficha um do outro.
    return papel === 'mentor' && (registro.id === idDe(userData) || escopoMentor(registro) === escopoMentor(userData)) ? 'ver' : null;
  }
  if (tipo === 'professor') {
    if (ehAdmin(papel)) return 'editar';
    if (ehOProprioProfessor(userData, registro)) return 'ver';
    if (papel === 'mentor' || ehLider(papel)) {
      const minhas = new Set(unidadesVisiveis(userData, catalogs?.unidades).map((u) => String(u.id)));
      const vinculado = (catalogs?.vinculos || []).some((v) => String(v.professorId) === String(registro.id) && minhas.has(String(v.unidadeId)));
      return vinculado ? 'editar' : null;
    }
  }
  return null;
}

// Nome mostrado no botão "Voltar para ..." da ficha de cima.
export function nomeDoRegistro(tipo, registro) {
  if (!registro) return '';
  return VAGA_DO_TIPO[tipo] ? (liderDaVaga(registro, VAGA_DO_TIPO[tipo])?.nome || registro.nome) : registro.nome;
}

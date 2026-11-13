// Quem pode abrir cada Central (e achar o cadastro pedido). Conta pura, com teste.
//
//   'editar' = vê tudo e tem os atalhos de edição;  'ver' = modo leitura;  null = não pode abrir.
//
//   Unidade   -> admin: todas · mentor: as dele · líder: só a própria (leitura)
//   Líder     -> igual à unidade dele (o líder fica gravado dentro da unidade)
//   Mentor    -> admin: todos · o próprio mentor: a dele (leitura)
//   Professor -> admin: todos · mentor e líder: os professores vinculados às unidades deles ·
//                o próprio professor: a dele (leitura)
import { ehLider } from '../permissions';
import { acessoUnidade, acharUnidade, ehAdmin } from './contasUnidade';

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
  if (papel === 'mentor') return unidades.filter((u) => u.mentorId && u.mentorId === idDe(userData));
  if (ehLider(papel)) return unidades.filter((u) => String(u.id) === String(userData?.unidadeId || ''));
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
  if (tipo === 'lider') {
    const uid = typeof alvo === 'object' ? alvo.liderUid : alvo;
    return acharUnidade(catalogs.unidades, alvo) || (catalogs.unidades || []).find((u) => u.liderUid && u.liderUid === uid) || null;
  }
  if (tipo === 'mentor') return acharPorIdOuNome(catalogs.mentores, alvo);
  if (tipo === 'professor') return acharPorIdOuNome(catalogs.professores, alvo);
  return null;
}

export function acessoCentral(tipo, registro, userData, catalogs) {
  if (!registro || !userData) return null;
  const papel = papelDe(userData);
  if (tipo === 'unidade') return acessoUnidade(userData, registro);
  if (tipo === 'lider') return registro.liderUid ? acessoUnidade(userData, registro) : null;
  if (tipo === 'mentor') {
    if (ehAdmin(papel)) return 'editar';
    return papel === 'mentor' && registro.id === idDe(userData) ? 'ver' : null;
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
  return tipo === 'lider' ? (registro.liderNome || registro.liderEmail || registro.nome) : registro.nome;
}

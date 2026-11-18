// Reservas de e-mail e telefone (F3 da chave CPF): um e-mail / um telefone = uma pessoa.
// A chave da reserva usa a MESMA comparação do relatório de repetidos (utils/repetidos.js):
//  - e-mail: minúsculo e sem espaços; e-mail de mentira ou fora do formato não reserva;
//  - telefone: chave por país (BR sem o 9 e sem 55; AR sem 54/9/0; US sem 1); inválido não reserva.
// "Dono" = a pessoa: o crachá (uid) e/ou a ficha da grade (professorId) ligada a ele.
import { chaveTelefone, emailDeMentira, emailFormatoValido, normalizarEmail } from './repetidos';
import { normalizarPais } from './feriados';

export const idContatoEmail = (email) => {
  const e = normalizarEmail(email);
  return e && emailFormatoValido(e) && !emailDeMentira(e) ? `email_${e}` : null;
};

export const idContatoTelefone = (telefone, pais = 'BR') => {
  const k = telefone ? chaveTelefone(telefone, normalizarPais(pais)) : null;
  return k ? `tel_${k}` : null;
};

/** Chaves de reserva de uma pessoa: [{ id, tipo: 'email'|'tel' }] (só as que valem). */
export function chavesDeContato({ email, telefone, pais = 'BR' } = {}) {
  const lista = [];
  const e = idContatoEmail(email);
  if (e) lista.push({ id: e, tipo: 'email' });
  const t = idContatoTelefone(telefone, pais);
  if (t) lista.push({ id: t, tipo: 'tel' });
  return lista;
}

/** A reserva `r` é desta pessoa? (mesmo crachá ou mesma ficha) */
export const mesmoDono = (r, dono) =>
  !!r && !!dono && ((!!r.uid && r.uid === dono.uid) || (!!r.professorId && String(r.professorId) === String(dono.professorId ?? '')));

/** Dados da reserva para gravar: tipo + só os donos preenchidos. */
export function dadosDaReserva(tipo, { uid, professorId } = {}) {
  const d = { tipo };
  if (uid) d.uid = String(uid);
  if (professorId) d.professorId = String(professorId);
  return d;
}

/**
 * Plano para criar as reservas dos cadastros atuais (botão do admin no relatório de repetidos).
 * registros: os mesmos do relatório — { origem: 'professor'|'cracha', id, email, telefone, pais, uidLogin?, professorId? }.
 * Pessoa = ficha + crachá ligados (uidLogin / professorId); NÃO junta por e-mail parecido (isso é a limpeza).
 * Devolve { reservas: Map(id → dados), conflitos: [{ id, tipo, itens }] } — conflito = 2+ pessoas com a mesma chave.
 */
export function planejarReservas(registros) {
  const lista = (registros || []).filter(r => r.origem === 'professor' || r.origem === 'cracha');
  const pai = new Map();
  const garantir = (k) => { if (!pai.has(k)) pai.set(k, k); return k; };
  const achar = (k) => { while (pai.get(k) !== k) { pai.set(k, pai.get(pai.get(k))); k = pai.get(k); } return k; };
  const unir = (a, b) => { const ra = achar(garantir(a)), rb = achar(garantir(b)); if (ra !== rb) pai.set(ra, rb); };
  const pessoaDe = (r) => (r.origem === 'professor' ? `p:${r.id}` : `u:${r.id}`);
  const crachas = new Set(lista.filter(r => r.origem === 'cracha').map(r => String(r.id)));
  for (const r of lista) {
    garantir(pessoaDe(r));
    // Só liga a crachás que existem na lista (login antigo da senha 123456 não conta como dono).
    if (r.origem === 'professor' && r.uidLogin && crachas.has(String(r.uidLogin))) unir(pessoaDe(r), `u:${r.uidLogin}`);
    if (r.origem === 'cracha' && r.professorId) unir(pessoaDe(r), `p:${r.professorId}`);
  }

  // chave → { tipo, pessoas: Map(raiz → registros) }
  const porChave = new Map();
  for (const r of lista) {
    for (const { id, tipo } of chavesDeContato({ email: r.email, telefone: r.telefone, pais: r.pais })) {
      if (!porChave.has(id)) porChave.set(id, { tipo, pessoas: new Map() });
      const raiz = achar(pessoaDe(r));
      const pessoas = porChave.get(id).pessoas;
      if (!pessoas.has(raiz)) pessoas.set(raiz, []);
      pessoas.get(raiz).push(r);
    }
  }

  const reservas = new Map();
  const conflitos = [];
  for (const [id, { tipo, pessoas }] of porChave) {
    if (pessoas.size >= 2) {
      conflitos.push({ id, tipo, itens: [...pessoas.values()].flat() });
      continue;
    }
    const itens = [...pessoas.values()][0];
    const cracha = itens.find(i => i.origem === 'cracha');
    // Ficha: a que o crachá aponta; senão a primeira ficha da pessoa que tem o dado.
    const ficha = (cracha?.professorId && itens.find(i => i.origem === 'professor' && String(i.id) === String(cracha.professorId)))
      || itens.find(i => i.origem === 'professor');
    // Login da pessoa: o crachá que tem o dado, ou o crachá ligado à ficha.
    const uid = cracha?.id || (ficha?.uidLogin && crachas.has(String(ficha.uidLogin)) ? String(ficha.uidLogin) : '');
    // Com login e ficha: a ficha precisa estar ligada a este login (a regra do banco confere).
    const professorId = ficha && (!uid || String(ficha.uidLogin || '') === uid) ? ficha.id : '';
    reservas.set(id, dadosDaReserva(tipo, { uid, professorId }));
  }
  conflitos.sort((a, b) => a.id.localeCompare(b.id));
  return { reservas, conflitos };
}

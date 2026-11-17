// Juntar fichas duplicadas de professor da grade (a mesma pessoa cadastrada mais de uma vez).
// Só a conta do que muda (sem banco): a leitura e a gravação ficam em services/juntarFichasService.js.
//
// Tudo o que aponta para as fichas que somem passa a apontar para a ficha que fica:
//   aulas.professorId, vinculos.professorId (unidade repetida = vínculo apagado),
//   validacoes.professorId e validacoes.professorOriginalId (histórico e pagamentos vão junto),
//   usuarios.professorId (crachá). Resumos mensais com aulão do professor são refeitos.

const mesDe = (data) => String(data || '').slice(0, 7);

/**
 * @param {object} p
 * @param {object}   p.principal   ficha que fica { id, email, telefone, pais, status, uidLogin }
 * @param {object[]} p.outras      fichas que somem (mesmo formato)
 * @param {object[]} p.aulas       aulas com professorId de alguma das outras
 * @param {object[]} p.vinculos    vínculos da principal E das outras
 * @param {object[]} p.validacoes  validações com professorId OU professorOriginalId de alguma das outras
 * @param {object[]} p.crachas     crachás com professorId de alguma das outras
 * @param {object}   p.crachaDoLogin  { [uid]: crachá | null } dos uidLogin das fichas
 */
export function montarPlanoJuncao({ principal, outras, aulas = [], vinculos = [], validacoes = [], crachas = [], crachaDoLogin = {}, documentos = {} }) {
  const idPrincipal = String(principal.id);
  const idsOutras = new Set(outras.map(o => String(o.id)));
  idsOutras.delete(idPrincipal);

  // Vínculos: a principal fica com uma ligação por unidade.
  const unidadesDaPrincipal = new Set(
    vinculos.filter(v => String(v.professorId) === idPrincipal).map(v => String(v.unidadeId))
  );
  const vinculosMover = [];
  const vinculosApagar = [];
  for (const v of vinculos) {
    if (!idsOutras.has(String(v.professorId))) continue;
    const unidade = String(v.unidadeId);
    if (unidadesDaPrincipal.has(unidade)) vinculosApagar.push(v.id);
    else { vinculosMover.push(v.id); unidadesDaPrincipal.add(unidade); }
  }

  // Validações: o que muda em cada uma.
  const mudancasValidacoes = [];
  const mesesResumo = new Set();
  for (const v of validacoes) {
    const mudar = {};
    if (idsOutras.has(String(v.professorId || ''))) mudar.professorId = idPrincipal;
    if (idsOutras.has(String(v.professorOriginalId || ''))) mudar.professorOriginalId = idPrincipal;
    if (Object.keys(mudar).length === 0) continue;
    mudancasValidacoes.push({ id: v.id, mudar });
    if (mudar.professorId && v.isAulao === true) mesesResumo.add(mesDe(v.data));
  }

  // Login ligado à ficha: prefere o crachá ativo do Google; senão o que a principal já tinha.
  const logins = [principal.uidLogin, ...outras.map(o => o.uidLogin)].filter(Boolean).map(String);
  const loginGoogle = logins.find(uid => crachaDoLogin[uid]?.loginGoogle === true);
  const uidLogin = loginGoogle || principal.uidLogin || logins.find(uid => crachaDoLogin[uid]) || '';

  // Dados que faltam na principal são completados pelas outras.
  const completar = {};
  for (const campo of ['email', 'telefone', 'pais']) {
    if (!principal[campo]) {
      const achado = outras.find(o => o[campo])?.[campo];
      if (achado) completar[campo] = achado;
    }
  }
  if (principal.status !== 'ativo' && outras.some(o => o.status === 'ativo')) completar.status = 'ativo';
  if (uidLogin && uidLogin !== String(principal.uidLogin || '')) completar.uidLogin = uidLogin;

  // Documento (CPF/DNI/SSN): cada ficha tem no máximo um. Dois documentos diferentes = duas pessoas: não junta.
  const comDocumento = [idPrincipal, ...idsOutras].filter(id => documentos[id]);
  const conflitoDocumento = comDocumento.length > 1;
  const idDoDono = comDocumento[0];
  const documento = !conflitoDocumento && idDoDono && idDoDono !== idPrincipal
    ? { deId: idDoDono, tipo: documentos[idDoDono].tipo, numero: documentos[idDoDono].numero }
    : null;
  if (documento) completar.documentoOk = true;

  return {
    conflitoDocumento,
    documento,
    idPrincipal,
    idsApagar: [...idsOutras],
    aulas: aulas.filter(a => idsOutras.has(String(a.professorId))).map(a => a.id),
    vinculosMover,
    vinculosApagar,
    validacoes: mudancasValidacoes,
    crachas: crachas.filter(c => idsOutras.has(String(c.professorId))).map(c => c.id),
    mesesResumo: [...mesesResumo].filter(Boolean).sort(),
    completar,
  };
}

// Total de gravações do plano (para mostrar antes de gravar).
export const gravacoesDoPlano = (plano) =>
  plano.aulas.length + plano.vinculosMover.length + plano.vinculosApagar.length + plano.validacoes.length
  + plano.crachas.length + plano.mesesResumo.length + plano.idsApagar.length + 1 + (plano.documento ? 3 : 0);

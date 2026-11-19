// A unidade "de contato" do professor logado (para onde vão certificados e pedidos de atualização).
// Crachá com unidade: a dele. Crachá antigo sem unidade: as unidades dos vínculos da ficha dele (sem leitura extra,
// vem do catálogo); cada uma com o vinculoId que o banco usa para conferir (ver regras certUnidadeOk).
export function opcoesDeUnidadeDoProfessor({ userData, uid, catalogs }) {
  if (userData?.unidadeId) return [{ unidadeId: String(userData.unidadeId), vinculoId: "", nome: nomeDe(catalogs, userData.unidadeId) }];
  const profId = userData?.professorId || (catalogs?.professores || []).find((p) => p.uidLogin === uid)?.id;
  if (!profId) return [];
  const vistos = new Map();
  (catalogs?.vinculos || []).forEach((v) => {
    if (String(v.professorId) === String(profId) && v.unidadeId && !vistos.has(String(v.unidadeId))) {
      vistos.set(String(v.unidadeId), { unidadeId: String(v.unidadeId), vinculoId: v.id, nome: nomeDe(catalogs, v.unidadeId) });
    }
  });
  return [...vistos.values()];
}

const nomeDe = (catalogs, id) => (catalogs?.unidades || []).find((u) => String(u.id) === String(id))?.nome || String(id);

/** Fichas do cadastro de professores ligadas a este login (por uidLogin ou pelo professorId do crachá). */
export function fichasDoLogin(catalogs, uid, userData) {
  return (catalogs?.professores || []).filter((p) => (p.uidLogin && p.uidLogin === uid) || (userData?.professorId && String(p.id) === String(userData.professorId)));
}

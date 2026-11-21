// Em quais unidades a pessoa é líder e em qual vaga (1 = 1º líder, 2 = 2º líder). Serve para copiar nome e telefone novos
// para a(s) unidade(s) dela (liderNome/liderTelefone ou lider2Nome/lider2Telefone). Não-líder: lista vazia.
import { ehLider, unidadesDoLider } from "../permissions";

export function vagasDeLiderDaPessoa(unidades = [], cracha, uid) {
  if (!ehLider(cracha?.role) || !uid) return [];
  const minhas = new Set(unidadesDoLider(cracha));
  return unidades
    .filter((u) => minhas.has(String(u.id)) && (u.liderUid === uid || u.lider2Uid === uid))
    .map((u) => ({ id: u.id, vaga: u.liderUid === uid ? 1 : 2 }));
}

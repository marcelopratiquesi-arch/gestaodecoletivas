// Janela "Editar" da aba Líderes (admin e mentor): corrige TUDO do cadastro de um líder de uma vez, em todos os lugares onde ele aparece:
//  - crachá usuarios/{uid}: nome, telefone, país, e as marcas "documentoOk" / "nascimentoOk" (o aviso de cadastro incompleto lê elas);
//  - unidade(s) do líder: liderNome/liderTelefone (ou lider2...), que alimentam a aba Líderes e a Central;
//  - documento (CPF/DNI/SSN): gaveta privada + reserva (documentoService), nunca no crachá aberto;
//  - data de nascimento: gaveta privada nascimentos/{uid};
//  - reserva de telefone (contatoService). O e-mail de LOGIN nunca muda por aqui.
// O que NÃO vai para a auditoria: o número do documento e a data de nascimento (só "foi atualizado").
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { documentoNoLote, gravarComAviso } from "./documentoService";
import { mensagemSeContatoEmUso, sincronizarEAvisar } from "./contatoService";
import { idDocumentoUnico } from "../utils/documento";

/**
 * @param {object} p
 *  uid, unidades: [{ id, vaga: 1|2 }] (onde copiar nome e telefone),
 *  antes / depois: { nome, telefone, pais, documento: {tipo,numero}|null, nascimento: "AAAA-MM-DD"|"" },
 *  email: e-mail de login (só para a reserva do telefone),
 *  extras: outros campos do crachá a gravar junto (ex.: { status, atualizadoEm } na aba Mentores)
 * @returns {Promise<{ ok: true, mudou: string[] } | { ok: false, mensagem: string }>}
 */
export async function salvarCadastroDoLider({ uid, unidades = [], antes, depois, email = "", extras = {} }, t) {
  const dono = { uid };
  // Telefone novo que já é de outra pessoa não é salvo.
  const bloqueio = await mensagemSeContatoEmUso({
    dono, antes: { telefone: antes.telefone, pais: antes.pais }, depois: { telefone: depois.telefone, pais: depois.pais },
  }, t);
  if (bloqueio) return { ok: false, mensagem: bloqueio };

  const mudou = [];
  // 1) Documento primeiro: se já é de outra pessoa o banco recusa (ERRO_DOCUMENTO_EM_USO) e nada mais é salvo.
  const docMudou = depois.documento && (!antes.documento || antes.documento.tipo !== depois.documento.tipo || antes.documento.numero !== depois.documento.numero);
  if (docMudou) {
    const lote = writeBatch(db);
    documentoNoLote(lote, { uid, tipo: depois.documento.tipo, numero: depois.documento.numero, anterior: antes.documento, marcarCracha: true });
    await gravarComAviso(lote);
    mudou.push("Documento atualizado");
  }

  // 2) Crachá + unidades + nascimento, tudo junto ou nada.
  const lote = writeBatch(db);
  const nascimentoMudou = !!depois.nascimento && depois.nascimento !== antes.nascimento;
  lote.update(doc(db, "usuarios", uid), {
    nome: depois.nome, telefone: depois.telefone, pais: depois.pais,
    ...(depois.nascimento ? { nascimentoOk: true } : {}),
    ...extras, // ex.: status e data da edição (aba Mentores)
  });
  unidades.forEach(({ id, vaga }) => {
    const p = vaga === 2 ? "lider2" : "lider";
    lote.update(doc(db, "unidades", String(id)), { [`${p}Nome`]: depois.nome, [`${p}Telefone`]: depois.telefone });
  });
  if (nascimentoMudou) lote.set(doc(db, "nascimentos", uid), { nascimento: depois.nascimento, atualizadoEm: serverTimestamp() });
  await lote.commit();

  // 3) Reserva do telefone (se já é de outra pessoa, só avisa).
  await sincronizarEAvisar({
    dono, antes: { email, telefone: antes.telefone, pais: antes.pais }, depois: { email, telefone: depois.telefone, pais: depois.pais },
  }, t);

  if (antes.nome !== depois.nome) mudou.push(`Nome: ${antes.nome || "-"} ➔ ${depois.nome}`);
  if (antes.telefone !== depois.telefone || antes.pais !== depois.pais) mudou.push(`Telefone: ${antes.telefone || "-"} ➔ ${depois.telefone} (${depois.pais})`);
  if (nascimentoMudou) mudou.push("Data de nascimento atualizada");
  return { ok: true, mudou };
}

/**
 * Apaga o documento da pessoa de verdade: gaveta privada + reserva do número + a marca "documentoOk" do crachá.
 * A pessoa fica travada no próximo acesso até informar de novo (a tela de documento não deixa adiar).
 */
export async function apagarDocumentoDoLider({ uid, documento }) {
  const lote = writeBatch(db);
  lote.delete(doc(db, "documentos_privados", uid));
  lote.delete(doc(db, "documentos_unicos", idDocumentoUnico(documento.tipo, documento.numero)));
  lote.update(doc(db, "usuarios", uid), { documentoOk: false });
  await lote.commit();
}


// "Meu cadastro" (todos os papéis: admin, mentor, líder e professor): os dados pessoais salvam NA HORA (sem aprovação), em todos os lugares onde aparecem:
//  - crachá usuarios/{uid}: nome, telefone, país e e-mail de CONTATO (o e-mail de login nunca muda por aqui);
//  - líder: o nome e o telefone também vão para a(s) unidade(s) dele (liderNome/liderTelefone ou lider2...), que alimentam a aba Líderes e a Central;
//  - ficha da grade professores/{id} (a ligada ao login, se houver; vale para professor e para líder que também dá aula): nome, telefone, país e e-mail, que alimentam a Central e as abas;
//  - documento (CPF/DNI/SSN): gaveta privada do crachá + reserva (documentoService), nunca no crachá aberto;
//  - data de nascimento: gaveta privada nascimentos/{uid} (só a pessoa, o admin, o mentor e o líder da unidade leem);
//  - reserva de e-mail/telefone (contatoService) e uma linha na auditoria (sem documento nem nascimento).
// O contrato (CLT/SAVER) NÃO passa por aqui: continua pedindo aprovação (atualizacaoProfessorService).
import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { documentoNoLote, gravarComAviso, lerDocumento } from "./documentoService";
import { mensagemSeContatoEmUso, sincronizarEAvisar } from "./contatoService";

/** Data de nascimento guardada ("AAAA-MM-DD") ou "". Sem permissão ou sem registro = "". */
export async function lerNascimento(uid) {
  try {
    const snap = await getDoc(doc(db, "nascimentos", uid));
    return snap.exists() ? String(snap.data().nascimento || "") : "";
  } catch (e) {
    if (e?.code === "permission-denied") return "";
    throw e;
  }
}

/** Quem já tinha a data guardada antes da marca existir: coloca a marca no crachá (o banco confere que a data existe). */
export async function marcarNascimentoOk(uid, fichaId = "") {
  const lote = writeBatch(db);
  lote.update(doc(db, "usuarios", uid), { nascimentoOk: true });
  // A lista de Professores só lê fichas: a marca também vai para a ficha ligada ao login (se houver).
  if (fichaId) lote.update(doc(db, "professores", String(fichaId)), { nascimentoOk: true });
  await lote.commit();
}

/** "Lembrar depois" do aviso de cadastro incompleto: grava no crachá a contagem do adiamento (ver utils/cadastroCompleto). */
export const adiarAvisoDoCadastro = (uid, campos) => updateDoc(doc(db, "usuarios", uid), campos);

/** Documento guardado do próprio professor ({ tipo, numero }) ou null. */
export const lerMeuDocumento = (uid) => lerDocumento(uid);

/** Data válida entre 1920 e hoje. Vazio é aceito (a data é opcional). */
export function nascimentoValido(valor) {
  if (!valor) return true;
  if (!/^(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(valor)) return false;
  const d = new Date(`${valor}T12:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor && valor >= "1920-01-01" && d <= new Date();
}

/** Roda um passo do salvamento; se falhar, marca no erro QUAL passo foi (a tela mostra, para achar a causa de verdade). */
async function naEtapa(etapa, fn) {
  try { return await fn(); } catch (e) { if (e && typeof e === "object" && !e.etapa) e.etapa = etapa; throw e; }
}

/**
 * Salva tudo de uma vez só.
 * @param {object} p
 *  uid, fichaId ("" se não há ficha ligada),
 *  unidadesDoLider: [{ id, vaga: 1|2 }] unidades em que a pessoa é líder (para copiar nome e telefone; [] se não é líder),
 *  antes: { nome, telefone, pais, emailContato, emailLogin, documento: {tipo,numero}|null, nascimento },
 *  depois: { nome, telefone, pais, emailContato, documento: {tipo,numero}|null, nascimento },
 *  precisaMarcarDocumento: true quando o crachá ainda não tem documentoOk.
 * @returns {Promise<{ ok: true } | { ok: false, erro: "contato" , mensagem: string }>}
 */
export async function salvarMeuCadastro({ uid, fichaId, unidadesDoLider = [], antes, depois, precisaMarcarDocumento = false, nomeParaAuditoria }, t) {
  const emailAntes = antes.emailContato || antes.emailLogin || "";
  const emailDepois = depois.emailContato || "";
  const dono = { uid, professorId: fichaId || undefined };

  // Parte B: e-mail/telefone novo que já é de outra pessoa não é salvo.
  const bloqueio = await naEtapa("contato", () => mensagemSeContatoEmUso({
    dono,
    antes: { email: emailAntes, telefone: antes.telefone, pais: antes.pais },
    depois: { email: emailDepois, telefone: depois.telefone, pais: depois.pais },
  }, t));
  if (bloqueio) return { ok: false, erro: "contato", mensagem: bloqueio };

  // 1) Documento primeiro: se já é de OUTRA pessoa o banco recusa e nada mais é salvo.
  const docMudou = depois.documento && (!antes.documento || antes.documento.tipo !== depois.documento.tipo || antes.documento.numero !== depois.documento.numero);
  if (docMudou) {
    const lote = writeBatch(db);
    documentoNoLote(lote, { uid, tipo: depois.documento.tipo, numero: depois.documento.numero, anterior: antes.documento, marcarCracha: precisaMarcarDocumento });
    await naEtapa("documento", () => gravarComAviso(lote, { uid, ...depois.documento }));
  }

  // 2) O ESSENCIAL (crachá + nascimento), junto ou nada: é o que destrava a pessoa.
  const lote = writeBatch(db);
  // "nascimentoOk": marca no crachá de que a data já está guardada (o aviso de cadastro incompleto lê isso sem ler a gaveta).
  lote.update(doc(db, "usuarios", uid), { nome: depois.nome, telefone: depois.telefone, pais: depois.pais, emailContato: emailDepois, ...(depois.nascimento ? { nascimentoOk: true } : {}) });
  if (depois.nascimento && depois.nascimento !== antes.nascimento) lote.set(doc(db, "nascimentos", uid), { nascimento: depois.nascimento, atualizadoEm: serverTimestamp() });
  await naEtapa("cadastro", () => lote.commit());
  if (!depois.nascimento && antes.nascimento) await naEtapa("nascimento", () => deleteDoc(doc(db, "nascimentos", uid)));

  // 3) CÓPIAS (ficha da grade e nome/telefone do líder na unidade): se uma falhar, não trava a pessoa; fica no console.
  const copiasFalharam = [];
  const copiar = async (onde, fn) => { try { await fn(); } catch (e) { console.error(`Meu cadastro: cópia em ${onde} não gravada`, e?.code, e); copiasFalharam.push(onde); } };
  if (fichaId) await copiar(`ficha ${fichaId}`, () => updateDoc(doc(db, "professores", String(fichaId)), { nome: depois.nome, telefone: depois.telefone, pais: depois.pais, email: emailDepois, updatedAt: serverTimestamp(), ...(depois.nascimento ? { nascimentoOk: true } : {}) }));
  for (const { id, vaga } of unidadesDoLider) {
    const p = vaga === 2 ? "lider2" : "lider";
    await copiar(`unidade ${id}`, () => updateDoc(doc(db, "unidades", String(id)), { [`${p}Nome`]: depois.nome, [`${p}Telefone`]: depois.telefone }));
  }

  // 4) Reserva de e-mail/telefone (se já é de outra pessoa, só avisa) e auditoria (sem dado sensível). Nunca trava.
  await copiar("reserva de contato", () => sincronizarEAvisar({
    dono,
    antes: { email: emailAntes, telefone: antes.telefone, pais: antes.pais },
    depois: { email: emailDepois, telefone: depois.telefone, pais: depois.pais },
  }, t));
  try {
    const mudou = [];
    if (antes.nome !== depois.nome) mudou.push(`Nome: ${antes.nome || "-"} ➔ ${depois.nome}`);
    if (antes.telefone !== depois.telefone || antes.pais !== depois.pais) mudou.push(`Telefone: ${antes.telefone || "-"} ➔ ${depois.telefone} (${depois.pais})`);
    if (emailAntes !== emailDepois) mudou.push(`E-mail de contato: ${emailAntes || "-"} ➔ ${emailDepois || "-"}`);
    if (docMudou) mudou.push("Documento atualizado");
    if (depois.nascimento !== antes.nascimento) mudou.push("Data de nascimento atualizada");
    if (mudou.length) {
      await addDoc(collection(db, "auditoria_configuracoes"), {
        tipoAcao: "ALTERADA", modulo: "CONFIGURACOES", descricao: "A própria pessoa atualizou o cadastro (Meu cadastro).",
        diffExtras: mudou.join(" | "), unidadeNome: "-", usuarioAcaoNome: nomeParaAuditoria || depois.nome, usuarioAcaoId: uid, dataAcao: serverTimestamp(),
      });
    }
  } catch (e) { console.error("Falha ao gravar auditoria", e); }
  return { ok: true, copiasFalharam };
}

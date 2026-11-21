import { escoposMentor, ehDoMeuEscopo } from "../../../permissions.js";
// Aba "Líderes" no COMPUTADOR (>= 1024 px): a tabela de antes da Opção B, trazida de volta em 2026-11-19 a pedido do
// usuário, com o cabeçalho de 3 botões e a barra de pedidos que recolhe. O celular usa o LideresTab (Opção B).
// Aba "Líderes": quem responde por cada unidade. A unidade é só um cadastro (nome, endereço...);
// quem entra no sistema é o LÍDER, com login pessoal. Cada unidade tem até 2 líderes, e uma pessoa pode ser
// líder de várias unidades (ver saidaDoLider.js).
// O líder ganha acesso de dois jeitos:
//   1) entra com o Google, pede acesso e é aprovado aqui (bloco "Pedidos de acesso", no topo);
//   2) o admin/mentor cadastra na mão (nome, e-mail, telefone e senha inicial);
//   3) entra com o login antigo da unidade e é obrigado a atualizar o cadastro e conectar o Google
//      (pages/AtualizarCadastro): assume como líder na hora e fica "a conferir" até o admin/mentor confirmar.
// Admin vê todas as unidades; mentor só as dele (as regras do banco também garantem isso).
import { useCallback, useMemo, useRef, useState } from "react";
import { doc, writeBatch, serverTimestamp, addDoc, collection, deleteField, updateDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { initializeApp, getApp, deleteApp } from "firebase/app";
import { useTranslation } from "react-i18next";
import {
  IdCard, UserCheck, UserPlus, UserX, Loader2, Building2, Edit2, Check, KeyRound, AlertTriangle, BadgeCheck, UserCog, User, Repeat, Plus, ChevronDown, Users,
} from "lucide-react";
import { db } from "../../../services/firebase";
import { useAuth } from "../../../contexts/AuthContext";
import { useCatalogs } from "../../../contexts/CatalogContext";
import { PendenciasTab } from "../Pendencias/PendenciasTab";
import { usePedidosPendentes } from "../Pendencias/usePedidosPendentes";
import LinkUnidade from "../../../centrais/LinkUnidade";
import LinkCentral from "../../../centrais/LinkCentral";
import { tirarLiderDaUnidade, camposAoLiberarVaga, textoDaSaida, dadosDaVaga } from "./saidaDoLider";
import { TornarLiderModal } from "./TornarLiderModal";
import { TemporariosLista } from "./TemporariosLista";
import { FiltroPadrao } from "../ui/FiltroPadrao";
import { CabecalhoDoModal } from "../ui/CabecalhoDoModal";
import { BotaoDeLinha } from "../ui/BotaoDeLinha";
import { CaixaDeNumeros } from "../ui/CabecalhoDaAba";
import { useFiltroCascata } from "../ui/useFiltroCascata";
import { CelulaContato } from "../ui/CelulaContato";
import { CelulaAcesso } from "../ui/CelulaAcesso";
import { ColunaOrdenavel, CLASSE_TITULO } from "../ui/ColunaOrdenavel";
import { MenuDeAcoes } from "../ui/MenuDeAcoes";
import { Selo } from "../ui/Selo";
import SeloCadastroIncompleto from "../ui/SeloCadastroIncompleto";
import { faltaDoCracha } from "../../../utils/cadastroCompleto";
import { useOrdenacao } from "../ui/useOrdenacao";
import { useUltimosAcessos } from "../ui/useUltimosAcessos";
import { paraData } from "../../../utils/ultimoAcesso";
import SeloRepetido from "../ui/SeloRepetido";
import { useSelosRepetidos } from "../ui/useSelosRepetidos";
import { BotaoDocumento, DocumentoModal, BuscaDocumento, AvisoDocumento } from "../Documento/DocumentoModal";
import i18n from "../../../i18n";
import CampoDocumento from "../../../components/acesso/CampoDocumento";
import { documentoNoLote, gravarComAviso, ERRO_DOCUMENTO_EM_USO, excluirPedidoELiberar, liberarReserva } from "../../../services/documentoService";
import { documentoValido, tipoDocumentoPadrao } from "../../../utils/documento";
import { mensagemSeContatoEmUso, sincronizarEAvisar } from "../../../services/contatoService";
import { normalizarPais } from "../../../utils/feriados";

const SENHA_MINIMA = 6;
// Botões do cabeçalho (ATENÇÃO: classes por extenso, o Tailwind só enxerga texto inteiro).
const BTN = "inline-flex items-center justify-center gap-2 h-[42px] px-4 rounded-[10px] border border-slate-300 bg-white text-[13px] font-bold text-slate-800 hover:bg-slate-50 whitespace-nowrap dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100";
const BTN_PRI = "inline-flex items-center justify-center gap-2 h-[42px] px-4 rounded-[10px] border border-red-600 bg-red-600 text-[13px] font-extrabold text-white hover:bg-red-700 whitespace-nowrap";
// País da unidade em sigla (cadastros antigos guardam o nome por extenso; sem país = Brasil).
const NOME_PAIS = { Brasil: "BR", Argentina: "AR", "Estados Unidos": "US" };
const siglaPais = (u) => NOME_PAIS[u.pais] || u.pais || "BR";
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// Como o líder entra no sistema (só para mostrar na tela).
function tipoDeAcesso(u) {
  if (u.liderUid) return u.liderTipo === "senha" ? "senha" : "google";
  if (u.uidLogin && !u.loginAntigoDesligado) return "antigo";
  return null;
}
// De quem é o "último acesso" que a linha mostra/ordena: o 1º líder ou, sem líder, o login antigo da unidade.
const uidDoAcesso = (u) => u.liderUid || (tipoDeAcesso(u) === "antigo" ? u.uidLogin : null);

export function LideresTabela() {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { catalogs, loadingCatalogs } = useCatalogs();
  const { total: totalPendencias, pedidos: pedidosPendentes, extras: pedidosOutraUnidade } = usePedidosPendentes();
  // Barra "Pedidos de acesso": começa sempre recolhida.
  const [pedidosAbertos, setPedidosAbertos] = useState(false);

  const role = String(userData?.role || "").trim().toLowerCase();
  const userId = userData?.id || userData?.uid;
  const escopos = useMemo(() => escoposMentor(userData), [userData]); // mentores cujas unidades eu enxergo (o meu + o da cobertura)
  const meuNome = userData?.nome || userData?.email || "Admin";
  const podeAcessar = role === "admin" || role === "mentor";

  const [situacao, setSituacao] = useState("todas"); // todas | com | sem | conferir
  const [mostrarBuscaDoc, setMostrarBuscaDoc] = useState(false);
  const pedidosRef = useRef(null);
  const [processando, setProcessando] = useState(null);

  // Modal de cadastro manual / edição de contato
  const [modal, setModal] = useState(null); // { modo: 'novo' | 'editar', unidade }
  const [form, setForm] = useState({ unidadeId: "", nome: "", email: "", telefone: "", senha: "", tipoDoc: tipoDocumentoPadrao(i18n.language), documento: "" });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const mentores = useMemo(() => catalogs?.mentores || [], [catalogs?.mentores]);
  const professores = useMemo(() => catalogs?.professores || [], [catalogs?.professores]);
  const [tornarLider, setTornarLider] = useState(null); // { vaga: 1 | 2, unidade }
  const [donoDoc, setDonoDoc] = useState(null); // quem está com o CPF digitado no cadastro (vindo do aviso)
  const [docAlvo, setDocAlvo] = useState(null); // { id, nome, email }: documento (CPF/DNI/SSN) em edição

  const minhasUnidades = useMemo(() => {
    const todas = catalogs?.unidades || [];
    return role === "admin" ? todas : todas.filter((u) => ehDoMeuEscopo(userData, u.mentorId));
  }, [catalogs?.unidades, role, userData]);

  // Selo "possível repetido" (mesmo telefone de outra pessoa): compara os líderes das unidades que a tela já tem.
  const registrosRepetidos = useMemo(() => {
    const vistos = new Map();
    for (const u of minhasUnidades) {
      const pais = u.pais || "BR";
      if (u.liderUid && !vistos.has(u.liderUid)) vistos.set(u.liderUid, { origem: "cracha", id: u.liderUid, nome: u.liderNome, email: u.liderEmail, telefone: u.liderTelefone, pais });
      if (u.lider2Uid && !vistos.has(u.lider2Uid)) vistos.set(u.lider2Uid, { origem: "cracha", id: u.lider2Uid, nome: u.lider2Nome, email: u.lider2Email, telefone: u.lider2Telefone, pais });
    }
    return [...vistos.values()];
  }, [minhasUnidades]);
  const selosRepetidos = useSelosRepetidos(registrosRepetidos);

  // Filtro padrão (busca + país → estado → mentor), no navegador sobre as unidades já carregadas.
  // A situação (com/sem líder/a conferir) continua sendo o seletor próprio desta aba.
  const nomeMentor = useCallback((id) => mentores.find((m) => m.id === id)?.nome, [mentores]);
  // Coluna "Acesso": último acesso do 1º e do 2º líder (ou do login antigo da unidade, enquanto existir).
  // Cada crachá é lido uma vez por sessão (ver useUltimosAcessos); o mesmo crachá diz se o cadastro está incompleto.
  const uidsDeAcesso = useMemo(() => minhasUnidades.flatMap((u) => [
    u.liderUid, u.lider2Uid, tipoDeAcesso(u) === "antigo" ? u.uidLogin : null,
  ]), [minhasUnidades]);
  const { acessoDe, cadastroDe, carregando: carregandoAcessos } = useUltimosAcessos(uidsDeAcesso);
  const faltaDoLider = useCallback((uid) => faltaDoCracha(cadastroDe(uid)), [cadastroDe]);
  const unidadeIncompleta = useCallback((u) => (!!u.liderUid && faltaDoLider(u.liderUid).length > 0) || (!!u.lider2Uid && faltaDoLider(u.lider2Uid).length > 0), [faltaDoLider]);
  const soDaSituacao = useCallback((u) => situacao === "todas"
    || (situacao === "com" && u.liderUid)
    || (situacao === "sem" && !u.liderUid)
    || (situacao === "conferir" && u.liderUid && u.liderAConferir === true)
    || (situacao === "incompleto" && unidadeIncompleta(u)), [situacao, unidadeIncompleta]);
  const filtro = useFiltroCascata(minhasUnidades, {
    getPais: siglaPais,
    getEstados: (u) => [u.estado],
    getMentorIds: (u) => [u.mentorId],
    textoBusca: (u) => [u.nome, u.estado, u.liderNome, u.liderEmail, u.liderTelefone, u.lider2Nome, u.lider2Email, u.lider2Telefone],
    nomeMentor,
    extra: soDaSituacao,
  });

  // Todas as colunas ordenam (A→Z / Z→A). Sem clique: líder "a conferir" primeiro, depois a unidade de A a Z.
  const colunas = useMemo(() => ({
    unidade: (u) => u.nome,
    lider: (u) => u.liderNome || u.liderEmail || "",
    acesso: (u) => paraData(acessoDe(uidDoAcesso(u)))?.getTime() || 0, // nunca entrou = 0 → primeiro no A→Z
    mentor: (u) => nomeMentor(u.mentorId) || "",
  }), [acessoDe, nomeMentor]);
  const padrao = useCallback((a, b) => Number(b.liderAConferir === true) - Number(a.liderAConferir === true)
    || String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"), []);
  const ordenacao = useOrdenacao(filtro.resultado, colunas, { padrao });
  const lista = ordenacao.ordenada;


  const kpis = useMemo(() => {
    const comLider = minhasUnidades.filter((u) => u.liderUid).length;
    const aConferir = minhasUnidades.filter((u) => u.liderUid && u.liderAConferir === true).length;
    const incompletos = minhasUnidades.filter(unidadeIncompleta).length;
    return { total: minhasUnidades.length, comLider, semLider: minhasUnidades.length - comLider, aConferir, incompletos };
  }, [minhasUnidades, unidadeIncompleta]);

  const registrarAuditoria = async (tipoAcao, descricao, unidadeNome, detalhes) => {
    try {
      await addDoc(collection(db, "auditoria_configuracoes"), {
        tipoAcao, descricao, diffExtras: detalhes, modulo: "CONFIGURACOES",
        unidadeNome: unidadeNome || "-", usuarioAcaoNome: meuNome, usuarioAcaoId: userId, dataAcao: serverTimestamp(),
      });
    } catch (e) { console.error("Falha ao gravar auditoria", e); }
  };

  // Tira o líder atual da unidade dentro de um batch já aberto (ver saidaDoLider.js):
  // admin/mentor só sai da unidade; líder que também é professor volta a ser professor; os demais perdem o acesso.
  function tirarLiderAtual(batch, unidade, motivo, vaga = 1) {
    return tirarLiderDaUnidade(batch, {
      liderUid: vaga === 2 ? unidade.lider2Uid : unidade.liderUid, unidadeId: unidade.id, professores, motivo, quemId: userId, quemNome: meuNome,
    });
  }

  // Veio da busca por CPF: abre o cadastro com o documento (e o que o pedido já tinha) preenchido; a unidade se escolhe ali.
  function cadastrarPeloDocumento({ tipo, numero, nome, email, telefone }) {
    setErro(""); setDonoDoc(null);
    setForm({ unidadeId: "", nome, email, telefone, senha: "", tipoDoc: tipo, documento: numero });
    setModal({ modo: "novo", unidade: null, vaga: 1 });
  }

  function abrirNovo(unidade, vaga = 1) {
    setErro(""); setDonoDoc(null);
    setForm({ unidadeId: unidade?.id || "", nome: "", email: "", telefone: "", senha: "", tipoDoc: tipoDocumentoPadrao(i18n.language), documento: "" });
    setModal({ modo: "novo", unidade: unidade || null, vaga });
  }

  function abrirEditar(unidade) {
    setErro("");
    setForm({ unidadeId: unidade.id, nome: unidade.liderNome || "", email: unidade.liderEmail || "", telefone: unidade.liderTelefone || "", senha: "" });
    setModal({ modo: "editar", unidade });
  }

  async function salvar(e) {
    e.preventDefault();
    setErro("");
    const nome = form.nome.trim();
    const email = form.email.trim().toLowerCase();
    const telefone = form.telefone.trim();
    const unidade = minhasUnidades.find((u) => u.id === form.unidadeId);

    if (!unidade) return setErro(t("leadersTab.errors.unit"));
    if (nome.length < 3) return setErro(t("leadersTab.errors.name"));
    if (telefone.length < 6) return setErro(t("leadersTab.errors.phone"));

    if (modal.modo === "editar") {
      setSalvando(true);
      try {
        // Parte B: telefone novo que já é de outra pessoa não é salvo.
        const bloqueio = await mensagemSeContatoEmUso({
          dono: { uid: unidade.liderUid },
          antes: { telefone: unidade.liderTelefone, pais: normalizarPais(unidade.pais) },
          depois: { telefone, pais: normalizarPais(unidade.pais) },
        }, t);
        if (bloqueio) { setErro(bloqueio); return; }
        const batch = writeBatch(db);
        batch.update(doc(db, "usuarios", unidade.liderUid), { nome, telefone });
        batch.update(doc(db, "unidades", unidade.id), { liderNome: nome, liderTelefone: telefone });
        await batch.commit();
        // Reserva do telefone (F3 parte A): depois de salvo; se já é de outra pessoa, só avisa.
        const pais = normalizarPais(unidade.pais);
        await sincronizarEAvisar({
          dono: { uid: unidade.liderUid },
          antes: { telefone: unidade.liderTelefone, pais },
          depois: { email: unidade.liderEmail, telefone, pais },
        }, t);
        await registrarAuditoria("ALTERADA", "Contato do líder atualizado.", unidade.nome,
          `${unidade.liderNome || "-"} ➔ ${nome} | ${unidade.liderTelefone || "-"} ➔ ${telefone}`);
        setModal(null);
      } catch (err) {
        console.error(err);
        setErro(t("leadersTab.errors.save") + " " + (err.message || ""));
      } finally { setSalvando(false); }
      return;
    }

    if (!emailValido(email)) return setErro(t("leadersTab.errors.email"));
    if (!documentoValido(form.tipoDoc, form.documento)) return setErro(t("document.errors.invalid"));
    if (form.senha.length < SENHA_MINIMA) return setErro(t("leadersTab.errors.password", { min: SENHA_MINIMA }));

    const vaga = modal.vaga === 2 ? 2 : 1;
    const uidDaVaga = vaga === 2 ? unidade.lider2Uid : unidade.liderUid;
    const temOutroLider = !!uidDaVaga;
    if (temOutroLider && !window.confirm(t("leadersTab.replaceConfirm", { unit: unidade.nome, current: (vaga === 2 ? unidade.lider2Nome || unidade.lider2Email : unidade.liderNome || unidade.liderEmail), name: nome }))) return;

    setSalvando(true);
    let appSecundario = null;
    try {
      // CPF preso num pedido antigo ou sem cadastro (sem crachá): libera antes de gravar o novo líder.
      if (donoDoc && !donoDoc.cracha) {
        if (donoDoc.pedido) await excluirPedidoELiberar(donoDoc.uid, { tipo: donoDoc.tipo, numero: donoDoc.numero });
        else await liberarReserva(donoDoc.tipo, donoDoc.numero);
        setDonoDoc(null);
      }
    } catch (errLiberar) {
      console.error(errLiberar);
      setSalvando(false);
      return setErro(t("document.search.deleteError"));
    }
    // Parte B: e-mail/telefone que já é de outra pessoa não vira cadastro novo.
    const bloqueio = await mensagemSeContatoEmUso({ depois: { email, telefone, pais: normalizarPais(unidade.pais) } }, t);
    if (bloqueio) { setSalvando(false); return setErro(bloqueio); }
    try {
      // Cria a conta de login num "app secundário", para o admin/mentor não ser deslogado.
      appSecundario = initializeApp(getApp().options, `CadastroLider_${Date.now()}`);
      const authSecundario = getAuth(appSecundario);
      const cred = await createUserWithEmailAndPassword(authSecundario, email, form.senha);
      const novoUid = cred.user.uid;

      const batch = writeBatch(db);
      if (temOutroLider) await tirarLiderAtual(batch, unidade, t("leadersTab.replacedReason", { name: nome }), vaga);
      batch.set(doc(db, "usuarios", novoUid), {
        nome, email, telefone, role: "lider", unidadeId: unidade.id, unidadeIds: [unidade.id], status: "ativo",
        criadoPor: userId, criadoEm: serverTimestamp(),
      });
      batch.update(doc(db, "unidades", unidade.id), vaga === 2
        ? dadosDaVaga(2, { uid: novoUid, nome, email, telefone, tipo: "senha" })
        : {
          liderUid: novoUid, liderNome: nome, liderEmail: email, liderTelefone: telefone,
          liderTipo: "senha", liderDesde: serverTimestamp(), liderAConferir: deleteField(),
        });
      // O CPF/documento vai para a gaveta privada (nunca para auditoria nem lista). Só o admin pode marcar o crachá.
      documentoNoLote(batch, { uid: novoUid, tipo: form.tipoDoc, numero: form.documento, marcarCracha: role === "admin" });
      try {
        await gravarComAviso(batch);
      } catch (errBatch) {
        // Não deixa conta de login "órfã" (senão o e-mail ficaria preso numa nova tentativa).
        await cred.user.delete().catch(() => {});
        throw errBatch;
      }
      await signOut(authSecundario);
      await sincronizarEAvisar({ dono: { uid: novoUid }, depois: { email, telefone, pais: normalizarPais(unidade.pais) } }, t);

      await registrarAuditoria("NOVA", "Líder cadastrado manualmente (e-mail e senha).", unidade.nome,
        `${nome} (${email})${temOutroLider ? ` substituiu ${unidade.liderNome || unidade.liderEmail}` : ""}`);
      setModal(null);
      alert(t("leadersTab.createdManual", { name: nome, email }));
    } catch (err) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") setErro(t("leadersTab.errors.emailInUse"));
      else if (err.code === "auth/invalid-email") setErro(t("leadersTab.errors.email"));
      else if (err.message === ERRO_DOCUMENTO_EM_USO) setErro(t("document.errors.inUse"));
      else if (err.code === "auth/weak-password") setErro(t("leadersTab.errors.password", { min: SENHA_MINIMA }));
      else setErro(t("leadersTab.errors.save") + " " + (err.message || ""));
    } finally {
      if (appSecundario) await deleteApp(appSecundario).catch(() => {});
      setSalvando(false);
    }
  }

  // Tira o 1º (vaga 1) ou o 2º líder (vaga 2). Se sair o 1º e houver 2º, o 2º passa a ser o 1º.
  async function remover(unidade, vaga = 1) {
    const nome = vaga === 2 ? (unidade.lider2Nome || unidade.lider2Email) : (unidade.liderNome || unidade.liderEmail);
    const email = vaga === 2 ? unidade.lider2Email : unidade.liderEmail;
    if (!window.confirm(t("leadersTab.removeConfirm", { name: nome, unit: unidade.nome }))) return;
    setProcessando(unidade.id);
    try {
      const batch = writeBatch(db);
      const saida = await tirarLiderAtual(batch, unidade, t("leadersTab.removedReason"), vaga);
      batch.update(doc(db, "unidades", unidade.id), camposAoLiberarVaga(unidade, vaga));
      await batch.commit();
      await registrarAuditoria("EXCLUIDA",
        `${vaga === 2 ? "2º líder" : "Líder"} removido da unidade (${textoDaSaida(saida) || "saiu"}).`, unidade.nome,
        `${nome || "-"} (${email || "-"})${vaga === 1 && unidade.lider2Uid ? ` | ${unidade.lider2Nome || unidade.lider2Email} passou a ser o 1º líder` : ""}`);
    } catch (err) {
      console.error(err);
      alert(t("leadersTab.errors.remove") + " " + (err.message || ""));
    } finally { setProcessando(null); }
  }

  // Líder que assumiu sozinho (trocou o login antigo da unidade pelo Google): admin/mentor confirma que é a pessoa certa.
  async function confirmar(unidade) {
    if (!window.confirm(t("leadersTab.confirmQuestion", { name: unidade.liderNome || unidade.liderEmail, unit: unidade.nome }))) return;
    setProcessando(unidade.id);
    try {
      await updateDoc(doc(db, "unidades", unidade.id), { liderAConferir: deleteField(), liderConferidoPor: userId, liderConferidoEm: serverTimestamp() });
      await registrarAuditoria("ALTERADA", "Líder conferido e confirmado.", unidade.nome, `${unidade.liderNome || "-"} (${unidade.liderEmail || "-"})`);
    } catch (err) {
      console.error(err);
      alert(t("leadersTab.errors.confirm") + " " + (err.message || ""));
    } finally { setProcessando(null); }
  }

  // Nomes de quem pediu acesso (até 4 e "e mais N").
  const nomesPedidos = [...new Set([...(pedidosPendentes || []), ...(pedidosOutraUnidade || [])].map((p) => p.nome || p.email).filter(Boolean))];
  const textoDosPedidos = (() => {
    if (!nomesPedidos.length) return t("leadersTab.desk.requestsGeneric");
    const mostrados = nomesPedidos.slice(0, 4);
    const mais = nomesPedidos.length - mostrados.length;
    const lista = mais > 0 ? `${mostrados.join(", ")} ${t("leadersTab.desk.andMore", { count: mais })}`
      : mostrados.length > 1 ? `${mostrados.slice(0, -1).join(", ")} ${t("leadersTab.desk.and")} ${mostrados.at(-1)}` : mostrados[0];
    return t("leadersTab.desk.requestsWho", { count: nomesPedidos.length, names: lista });
  })();
  const abrirPedidos = () => { setPedidosAbertos(true); pedidosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  if (!podeAcessar) return null;

  return (
    <div className="p-6 space-y-8">
      {/* CABEÇALHO: título + os 3 botões (buscar pelo documento, escolher, cadastrar) e os números */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-end gap-4 flex-wrap">
          <div className="flex gap-3.5 items-center min-w-0">
            <span aria-hidden="true" className="w-[52px] h-[52px] rounded-[14px] bg-slate-900 text-white inline-flex items-center justify-center shrink-0 dark:bg-white dark:text-slate-900"><Users className="w-[26px] h-[26px]" /></span>
            <div className="min-w-0">
              <h2 className="m-0 text-[28px] font-black leading-tight text-slate-900 dark:text-white">{t("leadersTab.title")}</h2>
              <p className="mt-1 mb-0 text-[13px] text-slate-600 dark:text-slate-400">{t("leadersTab.desk.subtitle")}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => setMostrarBuscaDoc((v) => !v)} aria-expanded={mostrarBuscaDoc}
              className={`${BTN} ${mostrarBuscaDoc ? "!border-red-600 !text-red-700" : ""}`}><IdCard className="w-4 h-4" /> {t("leadersTab.desk.searchByDoc")}</button>
            <button type="button" onClick={() => setTornarLider({ vaga: 1, unidade: null })} className={BTN}><UserCheck className="w-4 h-4" /> {t("leadersTab.promote.button")}</button>
            <button type="button" onClick={() => abrirNovo(null)} className={BTN_PRI}><Plus className="w-4 h-4" /> {t("leadersTab.new")}</button>
          </div>
        </div>
        <CaixaDeNumeros abaId="lideres" itens={[
          { id: "total", rotulo: t("leadersTab.filter.all"), valor: kpis.total, onClick: () => setSituacao("todas"), ativo: situacao === "todas" },
          { id: "com", rotulo: t("leadersTab.filter.with"), valor: kpis.comLider, cor: "text-emerald-600", onClick: () => setSituacao("com"), ativo: situacao === "com" },
          { id: "sem", rotulo: t("leadersTab.filter.without"), valor: kpis.semLider, cor: "text-red-500", onClick: () => setSituacao("sem"), ativo: situacao === "sem" },
          { id: "conferir", rotulo: t("leadersTab.filter.toCheck"), valor: kpis.aConferir, cor: "text-amber-600", onClick: () => setSituacao("conferir"), ativo: situacao === "conferir" },
          { id: "incompleto", rotulo: t("profileUpdate.incomplete.filter"), valor: kpis.incompletos, cor: "text-amber-600", onClick: () => setSituacao("incompleto"), ativo: situacao === "incompleto" },
        ]} />
        {mostrarBuscaDoc && (
          <BuscaDocumento aoCadastrar={cadastrarPeloDocumento} aoEscolherPessoa={() => setTornarLider({ vaga: 1, unidade: null })} aoIrParaPedido={abrirPedidos} />
        )}
      </div>

      {/* PEDIDOS DE ACESSO (login pelo Google): barra fina que recolhe; começa fechada e some sem pedidos */}
      {totalPendencias > 0 && (
        <section ref={pedidosRef} aria-label={t("leadersTab.requests.title")} className="scroll-mt-24 rounded-xl border border-slate-200 border-l-4 border-l-red-600 bg-white overflow-hidden dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center gap-3.5 px-4 py-3 flex-wrap">
            <UserPlus className="w-5 h-5 text-red-600 shrink-0" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-black text-slate-900 dark:text-white">{t("leadersTab.requests.title")}</span>
              <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-black">{totalPendencias}</span>
            </div>
            <span className="flex-1 min-w-[240px] text-[13px] text-slate-600 dark:text-slate-400">{textoDosPedidos}</span>
            <button type="button" onClick={() => setPedidosAbertos((v) => !v)} aria-expanded={pedidosAbertos} className={`${BTN} !h-[38px]`}>
              {pedidosAbertos ? t("leadersTab.desk.hideRequests") : t("leadersTab.desk.showRequests")}
              <ChevronDown className={`w-4 h-4 transition-transform ${pedidosAbertos ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
          </div>
          {pedidosAbertos && <div className="border-t border-slate-100 dark:border-slate-800"><PendenciasTab /></div>}
        </section>
      )}

      {kpis.aConferir > 0 && (
        <p className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {t("leadersTab.checkBanner", { count: kpis.aConferir })}
        </p>
      )}

      {/* LÍDERES TEMPORÁRIOS (convite pelo e-mail do Google, com prazo) */}
      <TemporariosLista role={role} escopos={escopos} unidades={catalogs?.unidades || []}
        quem={{ id: userId, nome: meuNome, email: userData?.email }} registrarAuditoria={registrarAuditoria} />

      {/* LISTA DE UNIDADES E SEUS LÍDERES */}
      <div className="space-y-4">
        <FiltroPadrao abaId="lideres" filtro={filtro}
          mostrar={["pais", "estado", ...(role === "admin" ? ["mentor"] : [])]}
          placeholder={t("leadersTab.search")} ativoExtra={situacao !== "todas"} aoLimpar={() => setSituacao("todas")}>
          {/* Situação: um seletor só, com a contagem de cada grupo */}
          <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 w-fit max-w-full">
            {[
              { id: "todas", rotulo: t("leadersTab.filter.all"), n: kpis.total },
              { id: "com", rotulo: t("leadersTab.filter.with"), n: kpis.comLider },
              { id: "sem", rotulo: t("leadersTab.filter.without"), n: kpis.semLider },
              { id: "conferir", rotulo: t("leadersTab.filter.toCheck"), n: kpis.aConferir },
              { id: "incompleto", rotulo: t("profileUpdate.incomplete.filter"), n: kpis.incompletos },
            ].map((f) => (
              <button key={f.id} type="button" onClick={() => setSituacao(f.id)} aria-pressed={situacao === f.id}
                className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-2 transition-colors ${situacao === f.id
                  ? "bg-white dark:bg-slate-700 text-red-600 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}>
                {f.rotulo}
                <span className={`min-w-[1.5rem] px-1.5 py-0.5 rounded-md text-[10px] text-center ${situacao === f.id
                  ? "bg-red-600 text-white"
                  : (f.id === "conferir" || f.id === "incompleto") && f.n > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300"}`}>{f.n}</span>
              </button>
            ))}
          </div>
        </FiltroPadrao>

        {loadingCatalogs ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-red-500" /></div>
        ) : lista.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-bold text-sm">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" /> {t("leadersTab.empty")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <ColunaOrdenavel campo="unidade" rotulo={t("leadersTab.col.unit")} ordenacao={ordenacao} cor="red" className="w-[18%]" />
                  <ColunaOrdenavel campo="lider" rotulo={t("leadersTab.col.leader")} ordenacao={ordenacao} cor="red" />
                  <ColunaOrdenavel campo="acesso" rotulo={t("tabela.access.column")} ordenacao={ordenacao} cor="red" className="w-40" />
                  {role === "admin" && <ColunaOrdenavel campo="mentor" rotulo={t("leadersTab.col.mentor")} ordenacao={ordenacao} cor="red" className="w-36" />}
                  <th className={`${CLASSE_TITULO} text-right w-44`}>{t("leadersTab.col.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {lista.map((u) => {
                  const como = tipoDeAcesso(u);
                  const ocupado = processando === u.id;
                  const pais = siglaPais(u);
                  const nomeDoMentor = nomeMentor(u.mentorId);
                  return (
                    <tr key={u.id} className="align-top hover:bg-slate-50/70 dark:hover:bg-slate-700/20 transition-colors">
                      {/* UNIDADE */}
                      <td className="px-4 py-4">
                        <LinkUnidade unidade={u} className="font-black text-slate-800 dark:text-slate-100 uppercase text-xs leading-snug">{u.nome}</LinkUnidade>
                        <p className="text-[11px] text-slate-400 font-bold mt-0.5">{u.estado || "-"}{u.status && u.status !== "ativa" ? ` · ${u.status}` : ""}</p>
                      </td>

                      {/* LÍDER(ES): nome + etiquetas, e o contato padrão embaixo */}
                      <td className="px-4 py-4">
                        {u.liderUid ? (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <LinkCentral tipo="lider" alvo={u} className="font-black text-slate-800 dark:text-slate-100 uppercase">{u.liderNome || "-"}</LinkCentral>
                                <SeloRepetido selo={selosRepetidos.get(`cracha:${u.liderUid}`)} detalheDe={(o) => o.email || ""} />
                                {u.liderAConferir === true && <Selo tipo="aviso" icone={AlertTriangle}>{t("leadersTab.toCheck")}</Selo>}
                                <SeloCadastroIncompleto falta={faltaDoLider(u.liderUid)} />
                              </div>
                              <CelulaContato email={u.liderEmail} telefone={u.liderTelefone} pais={pais} />
                            </div>
                            {u.lider2Uid && (
                              <div className="pt-3 border-t border-dashed border-slate-200 dark:border-slate-700 space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <LinkCentral tipo="lider2" alvo={u} className="font-black text-slate-800 dark:text-slate-100 uppercase">{u.lider2Nome || "-"}</LinkCentral>
                                  <SeloRepetido selo={selosRepetidos.get(`cracha:${u.lider2Uid}`)} detalheDe={(o) => o.email || ""} />
                                  <Selo tipo="tema" abaId="lideres">{t("leadersTab.second.badge")}</Selo>
                                  <SeloCadastroIncompleto falta={faltaDoLider(u.lider2Uid)} />
                                </div>
                                <CelulaContato email={u.lider2Email} telefone={u.lider2Telefone} pais={pais} />
                              </div>
                            )}
                          </div>
                        ) : (
                          <Selo tipo="aviso" icone={AlertTriangle}>{t("leadersTab.noLeader")}</Selo>
                        )}
                      </td>

                      {/* ACESSO: último acesso de cada líder (ou do login antigo) + por onde entra */}
                      <td className="px-4 py-4">
                        {u.liderUid ? (
                          <div className="space-y-3">
                            <CelulaAcesso quando={acessoDe(u.liderUid)} como={como} carregando={carregandoAcessos} />
                            {u.lider2Uid && (
                              <div className="pt-3 border-t border-dashed border-slate-200 dark:border-slate-700">
                                <CelulaAcesso rotulo={t("leadersTab.second.badge")} quando={acessoDe(u.lider2Uid)}
                                  como={u.lider2Tipo === "senha" ? "senha" : "google"} carregando={carregandoAcessos} />
                              </div>
                            )}
                          </div>
                        ) : como === "antigo" ? (
                          <CelulaAcesso quando={acessoDe(u.uidLogin)} como="antigo" carregando={carregandoAcessos} />
                        ) : <span className="text-xs text-slate-300">—</span>}
                      </td>

                      {/* MENTOR (só o admin vê) */}
                      {role === "admin" && (
                        <td className="px-4 py-4">
                          {nomeDoMentor ? (
                            <span title={nomeDoMentor} className="inline-flex items-center gap-1.5 max-w-full px-2 py-1 rounded-md border text-xs font-bold bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700">
                              <User className="w-3.5 h-3.5 shrink-0 text-red-500" /> <span className="truncate">{nomeDoMentor.split(" ")[0]}</span>
                            </span>
                          ) : <span className="text-xs text-slate-300">—</span>}
                        </td>
                      )}

                      {/* AÇÕES: as do dia a dia à vista; o resto no menu ⋯ (remover sempre por último, em vermelho) */}
                      <td className="px-4 py-4">
                        <div className="flex justify-end items-center gap-1.5">
                          {u.liderUid ? (
                            <>
                              {u.liderAConferir === true && (
                                <BotaoDeLinha abaId="lideres" tipo="ativar" icone={BadgeCheck} onClick={() => confirmar(u)} disabled={ocupado} title={t("leadersTab.confirm")} />
                              )}
                              <BotaoDeLinha abaId="lideres" discreto icone={Edit2} onClick={() => abrirEditar(u)} disabled={ocupado} title={t("leadersTab.edit")} />
                              <BotaoDeLinha abaId="lideres" discreto icone={IdCard} onClick={() => setDocAlvo({ id: u.liderUid, nome: u.liderNome, email: u.liderEmail })} disabled={ocupado} title={t("document.modal.edit")} />
                              {ocupado ? (
                                <span className="p-2"><Loader2 className="w-4 h-4 animate-spin text-red-500" /></span>
                              ) : (
                                <MenuDeAcoes itens={[
                                  { id: "confirmar", rotulo: t("leadersTab.menu.confirmShort"), icone: BadgeCheck, onClick: () => confirmar(u), oculto: u.liderAConferir !== true },
                                  { id: "segundo", rotulo: t("leadersTab.menu.addSecond"), icone: UserPlus, onClick: () => setTornarLider({ vaga: 2, unidade: u }), oculto: !!u.lider2Uid },
                                  { id: "trocar", rotulo: t("leadersTab.replace"), icone: Repeat, onClick: () => abrirNovo(u) },
                                  { id: "doc2", rotulo: t("leadersTab.menu.docSecond"), icone: IdCard, onClick: () => setDocAlvo({ id: u.lider2Uid, nome: u.lider2Nome, email: u.lider2Email }), oculto: !u.lider2Uid },
                                  { id: "tirar2", rotulo: t("leadersTab.second.remove"), icone: UserX, tipo: "perigo", onClick: () => remover(u, 2), oculto: !u.lider2Uid },
                                  { id: "tirar", rotulo: t("leadersTab.remove"), icone: UserX, tipo: "perigo", onClick: () => remover(u) },
                                ]} />
                              )}
                            </>
                          ) : (
                            <>
                              <BotaoDeLinha abaId="lideres" discreto icone={UserCog} onClick={() => setTornarLider({ vaga: 1, unidade: u })} title={t("leadersTab.menu.pick")} />
                              <BotaoDeLinha abaId="lideres" discreto icone={UserPlus} onClick={() => abrirNovo(u)} title={t("leadersTab.menu.register")} />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-slate-400 font-bold">{t("leadersTab.howTo")}</p>
      </div>

      {docAlvo && <DocumentoModal alvo={docAlvo} abaId="lideres" onClose={() => setDocAlvo(null)} />}

      {/* MODAL: ESCOLHER LÍDER JÁ CADASTRADO (1º ou 2º líder) */}
      {tornarLider && (
        <TornarLiderModal
          unidades={minhasUnidades} todasUnidades={catalogs?.unidades || []} professores={professores} mentores={mentores}
          vaga={tornarLider.vaga} unidadeInicial={tornarLider.unidade}
          onCadastrar={(u, v) => { setTornarLider(null); abrirNovo(u, v); }}
          quemId={userId} quemNome={meuNome} registrarAuditoria={registrarAuditoria}
          onClose={() => setTornarLider(null)}
        />
      )}

      {/* MODAL: CADASTRAR / EDITAR LÍDER */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !salvando && setModal(null)}>
          <form onSubmit={salvar} onClick={(e) => e.stopPropagation()} className={`w-full ${modal.modo === "novo" ? "max-w-4xl" : "max-w-lg"} max-h-[92vh] flex flex-col overflow-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-2xl`}>
            <CabecalhoDoModal abaId="lideres" icone={modal.modo === "editar" ? Edit2 : UserPlus}
              titulo={modal.modo === "editar" ? t("leadersTab.modal.editTitle") : t("leadersTab.modal.newTitle")}
              onFechar={() => setModal(null)} desabilitado={salvando} />
            <div className="p-5 sm:p-7 space-y-5 overflow-y-auto">

            <div className={modal.modo === "novo" ? "grid md:grid-cols-2 gap-6" : "space-y-4"}>
            <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-600">{t("leadersTab.modal.sectionPerson")}</p>
            <label className="block space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("leadersTab.modal.unit")}</span>
              <select value={form.unidadeId} onChange={(e) => setForm({ ...form, unidadeId: e.target.value })} disabled={!!modal.unidade || salvando}
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none disabled:opacity-70">
                <option value="">{t("leadersTab.modal.chooseUnit")}</option>
                {minhasUnidades.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}{u.liderUid ? ` — ${t("leadersTab.modal.hasLeader", { name: u.liderNome || u.liderEmail })}` : ""}</option>
                ))}
              </select>
            </label>

            {(() => {
              const alvo = minhasUnidades.find((u) => u.id === form.unidadeId);
              return modal.modo === "novo" && (modal.vaga === 2 ? alvo?.lider2Uid : alvo?.liderUid) ? (
                <p className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl">{t("leadersTab.modal.replaceWarning", { name: modal.vaga === 2 ? (alvo.lider2Nome || alvo.lider2Email) : (alvo.liderNome || alvo.liderEmail) })}</p>
              ) : null;
            })()}

            <label className="block space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("leadersTab.modal.name")}</span>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} disabled={salvando} maxLength={80}
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-red-500" />
            </label>

            <label className="block space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("leadersTab.modal.email")}</span>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={salvando || modal.modo === "editar"}
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-70" />
              {modal.modo === "editar" && <span className="text-[11px] text-slate-400">{t("leadersTab.modal.emailLocked")}</span>}
            </label>

            <label className="block space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("leadersTab.modal.phone")}</span>
              <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} disabled={salvando} maxLength={30} placeholder="+55 31 99999-9999"
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-red-500" />
            </label>
            </div>

            {modal.modo === "novo" && (
            <div className="space-y-4 md:border-l md:border-slate-200 md:dark:border-slate-700 md:pl-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-600">{t("leadersTab.modal.sectionAccess")}</p>
            {modal.modo === "novo" && (
              <CampoDocumento claro id="novo-lider-documento" tipo={form.tipoDoc} onTipo={(v) => setForm((f) => ({ ...f, tipoDoc: v }))}
                valor={form.documento} onValor={(v) => setForm((f) => ({ ...f, documento: v }))} desabilitado={salvando} />
            )}
            {modal.modo === "novo" && (
              <AvisoDocumento tipo={form.tipoDoc} numero={form.documento} aoMudarDono={setDonoDoc}
                aoEscolherPessoa={() => { const { unidade, vaga } = modal; setModal(null); setTornarLider({ vaga: vaga === 2 ? 2 : 1, unidade }); }} />
            )}

            {modal.modo === "novo" && (
              <label className="block space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1"><KeyRound className="w-3 h-3" /> {t("leadersTab.modal.password")}</span>
                <input type="text" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} disabled={salvando} autoComplete="new-password"
                  className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-red-500" />
                <span className="text-[11px] text-slate-400">{t("leadersTab.modal.passwordHint", { min: SENHA_MINIMA })}</span>
              </label>
            )}
            </div>
            )}
            </div>

            {erro && <p className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{erro}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} disabled={salvando} className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200">{t("leadersTab.modal.cancel")}</button>
              <button type="submit" disabled={salvando} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-red-500 hover:bg-red-600 text-white flex items-center gap-1.5 disabled:opacity-50">
                {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {t("leadersTab.modal.save")}
              </button>
            </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

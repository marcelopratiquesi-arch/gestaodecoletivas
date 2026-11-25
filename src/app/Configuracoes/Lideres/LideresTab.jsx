import { escoposMentor, ehDoMeuEscopo } from "../../../permissions.js";
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
  UserPlus, Loader2, Edit2, Check, KeyRound, ScanSearch, Inbox, ChevronDown,
} from "lucide-react";
import { db } from "../../../services/firebase";
import { useAuth } from "../../../contexts/AuthContext";
import { useCatalogs } from "../../../contexts/CatalogContext";
import { PendenciasTab } from "../Pendencias/PendenciasTab";
import { usePedidosPendentes } from "../Pendencias/usePedidosPendentes";
import { tirarLiderDaUnidade, camposAoLiberarVaga, textoDaSaida, dadosDaVaga } from "./saidaDoLider";
import { TornarLiderModal } from "./TornarLiderModal";
import { ConviteModal, PrazoModal } from "./TemporariosSecao";
import { useLideresTemporarios } from "./useLideresTemporarios";
import { ListaLideres } from "./ListaLideres";
import { FichaDaUnidade } from "./FichaDaUnidade";
import { LideresTabela } from "./LideresTabela";
import { useTelaGrande } from "../ui/useTelaGrande";
import { useOrdenacao } from "../ui/useOrdenacao";
import { CabecalhoDoModal } from "../ui/CabecalhoDoModal";
import { useFiltroCascata } from "../ui/useFiltroCascata";
import { useUltimosAcessos } from "../ui/useUltimosAcessos";
import { paraData } from "../../../utils/ultimoAcesso";
import SeloRepetido from "../ui/SeloRepetido";
import { faltaDoCracha } from "../../../utils/cadastroCompleto";
import { useSelosRepetidos } from "../ui/useSelosRepetidos";
import { BuscaDocumento, AvisoDocumento } from "../Documento/DocumentoModal";
import { EditarLiderPopup } from "./EditarLiderPopup";
import i18n from "../../../i18n";
import CampoDocumento from "../../../components/acesso/CampoDocumento";
import { documentoNoLote, gravarComAviso, ERRO_DOCUMENTO_EM_USO, excluirPedidoELiberar, liberarReserva } from "../../../services/documentoService";
import { documentoValido, tipoDocumentoPadrao } from "../../../utils/documento";
import { mensagemSeContatoEmUso, sincronizarEAvisar } from "../../../services/contatoService";
import { normalizarPais } from "../../../utils/feriados";

const SENHA_MINIMA = 6;
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

// Botões arredondados da lista (Opção B): Todas · Com líder · Sem líder · A conferir · Temporários.
const DA_SITUACAO = {
  todas: () => true,
  com: (l) => !!l.u.liderUid,
  sem: (l) => !l.u.liderUid,
  conferir: (l) => l.u.liderAConferir === true && !!l.u.liderUid,
  temporarios: (l) => l.temTemporario,
  incompleto: (l) => l.incompleto,
};

// Computador (>= 1024 px): a tabela de antes (LideresTabela). Celular: a Opção B, aqui embaixo.
export function LideresTab() {
  const computador = useTelaGrande();
  return computador ? <LideresTabela /> : <LideresCelular />;
}

function LideresCelular() {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { catalogs, loadingCatalogs } = useCatalogs();
  const { total: totalPendencias, pedidos: pedidosPendentes } = usePedidosPendentes();

  const role = String(userData?.role || "").trim().toLowerCase();
  const userId = userData?.id || userData?.uid;
  const escopos = useMemo(() => escoposMentor(userData), [userData]); // mentores cujas unidades eu enxergo (o meu + o da cobertura)
  const meuNome = userData?.nome || userData?.email || "Admin";
  const podeAcessar = role === "admin" || role === "mentor";

  const [situacao, setSituacao] = useState("todas"); // todas | com | sem | conferir | temporarios
  const [selecionadaId, setSelecionadaId] = useState(null); // unidade com a ficha aberta
  const [mostrarBuscaDoc, setMostrarBuscaDoc] = useState(false);
  const pedidosRef = useRef(null);
  // Bloco "Pedidos de acesso": começa sempre recolhido.
  const [pedidosAbertos, setPedidosAbertos] = useState(false);
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
  const [editando, setEditando] = useState(null); // { unidade, vaga, foco }: janela Editar (nome, país, documento, nascimento, WhatsApp)

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

  // Busca + estado + mentor, no navegador sobre as unidades já carregadas (sem leitura nova).
  const nomeMentor = useCallback((id) => mentores.find((m) => m.id === id)?.nome, [mentores]);
  const filtro = useFiltroCascata(minhasUnidades, {
    getPais: siglaPais,
    getEstados: (u) => [u.estado],
    getMentorIds: (u) => [u.mentorId],
    textoBusca: (u) => [u.nome, u.estado, u.liderNome, u.liderEmail, u.liderTelefone, u.lider2Nome, u.lider2Email, u.lider2Telefone],
    nomeMentor,
  });
  // Último acesso do 1º e do 2º líder (ou do login antigo da unidade). Cada crachá é lido uma vez por sessão.
  const uidsDeAcesso = useMemo(() => minhasUnidades.flatMap((u) => [
    u.liderUid, u.lider2Uid, tipoDeAcesso(u) === "antigo" ? u.uidLogin : null,
  ]), [minhasUnidades]);
  const { acessoDe, cadastroDe, carregando: carregandoAcessos } = useUltimosAcessos(uidsDeAcesso);

  // Pedidos de acesso pelo Google por unidade (para "Escolher líder": quem já pediu aquela unidade).
  const pedidosPorUnidade = useMemo(() => {
    const mapa = new Map();
    (pedidosPendentes || []).filter((p) => (p.papel || "lider") === "lider").forEach((p) => {
      const ids = Array.isArray(p.unidadeIds) && p.unidadeIds.length ? p.unidadeIds : p.unidadeId ? [p.unidadeId] : [];
      ids.map(String).forEach((id) => mapa.set(id, (mapa.get(id) || 0) + 1));
    });
    return mapa;
  }, [pedidosPendentes]);
  const registrarAuditoria = async (tipoAcao, descricao, unidadeNome, detalhes) => {
    try {
      await addDoc(collection(db, "auditoria_configuracoes"), {
        tipoAcao, descricao, diffExtras: detalhes, modulo: "CONFIGURACOES",
        unidadeNome: unidadeNome || "-", usuarioAcaoNome: meuNome, usuarioAcaoId: userId, dataAcao: serverTimestamp(),
      });
    } catch (e) { console.error("Falha ao gravar auditoria", e); }
  };

  // Líderes temporários (ativos e convites), por unidade. As ações e a auditoria são as de antes.
  const todasUnidades = useMemo(() => catalogs?.unidades || [], [catalogs?.unidades]);
  const temp = useLideresTemporarios({ role, escopos, unidades: todasUnidades, registrarAuditoria });

  // Lista (Opção B): cada unidade com o último acesso do líder (ou do login antigo) e se tem temporário.
  const linhasTodas = useMemo(() => filtro.resultado.map((u) => {
    const doTemp = temp.porUnidade.get(String(u.id));
    const loginAntigo = tipoDeAcesso(u) === "antigo";
    return {
      u, loginAntigo,
      ultimo: acessoDe(u.liderUid || (loginAntigo ? u.uidLogin : null)),
      temTemporario: !!(doTemp && (doTemp.temporarios.length || doTemp.convites.length)),
      incompleto: (!!u.liderUid && faltaDoCracha(cadastroDe(u.liderUid)).length > 0) || (!!u.lider2Uid && faltaDoCracha(cadastroDe(u.lider2Uid)).length > 0),
    };
  }), [filtro.resultado, acessoDe, cadastroDe, temp.porUnidade]);

  // Botões arredondados: Todas · Com líder · Sem líder · A conferir · Temporários (cada um com a contagem).
  const chips = ["todas", "com", "sem", "conferir", "temporarios", "incompleto"].map((id) => ({
    id, rotulo: id === "incompleto" ? t("profileUpdate.incomplete.filter") : t(`leadersTab.listB.chip.${id}`), n: linhasTodas.filter(DA_SITUACAO[id]).length,
  }));
  const linhasDaSituacao = useMemo(() => linhasTodas.filter(DA_SITUACAO[situacao] || DA_SITUACAO.todas), [linhasTodas, situacao]);

  // Todas as colunas ordenam (A→Z / Z→A). Abre pela unidade, de A a Z; "a conferir" não muda a ordem.
  const colunas = useMemo(() => ({
    unidade: (l) => l.u.nome,
    lider: (l) => l.u.liderNome || l.u.liderEmail || "",
    acesso: (l) => paraData(l.ultimo)?.getTime() || 0, // nunca entrou = 0 → primeiro (quem está há mais tempo sem entrar)
    mentor: (l) => nomeMentor(l.u.mentorId) || "",
  }), [nomeMentor]);
  const ordenacao = useOrdenacao(linhasDaSituacao, colunas, { inicial: { campo: "unidade", direcao: "asc" } });
  const linhas = ordenacao.ordenada;
  const selecionada = linhasTodas.find((l) => l.u.id === selecionadaId) || null;

  // "Escolher líder": se alguém já pediu esta unidade pelo Google, leva aos pedidos; senão abre a escolha.
  function escolherLider(u) {
    if ((pedidosPorUnidade.get(String(u.id)) || 0) > 0 && pedidosRef.current) {
      setPedidosAbertos(true);
      pedidosRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      setSelecionadaId(null);
      return;
    }
    setTornarLider({ vaga: 1, unidade: u });
  }

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

  function abrirEditar(unidade, vaga = 1, foco = []) {
    setErro("");
    setEditando({ unidade, vaga, foco });
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

  if (!podeAcessar) return null;

  return (
    <div className="p-3 sm:p-6 space-y-4">
      {/* PEDIDOS DE ACESSO (login pelo Google): barra com o número e botão de recolher/abrir (começa recolhida) */}
      {totalPendencias > 0 && (
        <div ref={pedidosRef} className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
          <button type="button" onClick={() => setPedidosAbertos(!pedidosAbertos)} aria-expanded={pedidosAbertos}
            className="w-full min-h-[52px] px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60">
            <Inbox className="w-5 h-5 text-red-600 shrink-0" aria-hidden="true" />
            <span className="flex-1 min-w-0 text-[15px] font-black text-slate-900 dark:text-white">{t("leadersTab.requests.title")}</span>
            <span className="min-w-[1.75rem] h-7 px-2 rounded-full bg-red-600 text-white text-xs font-black inline-flex items-center justify-center">{totalPendencias}</span>
            <span className="text-xs font-extrabold text-red-700 dark:text-red-400 whitespace-nowrap">{pedidosAbertos ? t("leadersTab.requests.hide") : t("leadersTab.requests.show")}</span>
            <ChevronDown className={`w-5 h-5 text-slate-500 shrink-0 transition-transform ${pedidosAbertos ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {pedidosAbertos && <div className="border-t border-slate-100 dark:border-slate-800"><PendenciasTab /></div>}
        </div>
      )}
      {temp.erro && <p className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 p-3 rounded-xl">{temp.erro}</p>}

      <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
        <div className="flex-1 min-w-0">
          <ListaLideres linhas={linhas} total={linhasTodas.length} chips={chips} situacao={situacao} setSituacao={setSituacao}
            filtro={filtro} mostrarMentor={role === "admin"} ordenacao={ordenacao} nomeMentor={nomeMentor}
            carregando={loadingCatalogs} carregandoAcessos={carregandoAcessos} onCadastrar={() => abrirNovo(null)}
            selecionadaId={selecionadaId} onSelecionar={(u) => setSelecionadaId(u.id)}
            acaoExtra={podeAcessar && (
              <button type="button" onClick={() => setMostrarBuscaDoc((v) => !v)} aria-expanded={mostrarBuscaDoc}
                className={`h-10 px-3 rounded-xl border text-xs font-extrabold uppercase inline-flex items-center gap-2 ${mostrarBuscaDoc
                  ? "border-red-600 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                  : "border-slate-200 bg-white text-slate-600 hover:border-red-400 hover:text-red-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"}`}>
                <ScanSearch className="w-4 h-4" /> {t("document.search.title")}
              </button>
            )}
            abaixoDosFiltros={mostrarBuscaDoc && (
              <BuscaDocumento aoCadastrar={cadastrarPeloDocumento}
                aoEscolherPessoa={() => setTornarLider({ vaga: 1, unidade: null })}
                aoIrParaPedido={() => { setPedidosAbertos(true); pedidosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
            )} />
        </div>

        {/* FICHA DA UNIDADE: painel à direita (computador) / tela cheia (celular) */}
        <div className="lg:w-[440px] xl:w-[480px] lg:shrink-0">
          {selecionada ? (
            <FichaDaUnidade key={selecionada.u.id} u={selecionada.u} pais={siglaPais(selecionada.u)}
              nomeMentor={role === "admin" ? nomeMentor(selecionada.u.mentorId) : ""} ocupado={processando === selecionada.u.id}
              acessoDe={acessoDe} carregandoAcessos={carregandoAcessos}
              temps={temp.porUnidade.get(String(selecionada.u.id))} tempOcupado={temp.ocupado}
              onFechar={() => setSelecionadaId(null)}
              seloPrincipal={<SeloRepetido selo={selosRepetidos.get(`cracha:${selecionada.u.liderUid}`)} detalheDe={(o) => o.email || ""} />}
              seloSegundo={<SeloRepetido selo={selosRepetidos.get(`cracha:${selecionada.u.lider2Uid}`)} detalheDe={(o) => o.email || ""} />}
              acoes={{
                escolher: () => escolherLider(selecionada.u),
                cadastrar: () => abrirNovo(selecionada.u),
                confirmar: () => confirmar(selecionada.u),
                prorrogar: (c) => temp.abrirPrazo(c),
                efetivar: (c) => temp.efetivarAgora(c),
                encerrar: (c) => temp.encerrarAgora(c),
                cancelarConvite: (c) => temp.cancelar(c),
                definirTemporario: () => temp.abrirConvite(selecionada.u),
                adicionarSegundo: () => setTornarLider({ vaga: 2, unidade: selecionada.u }),
                editarSegundo: () => abrirEditar(selecionada.u, 2),
                tirarSegundo: () => remover(selecionada.u, 2),
                editar: () => abrirEditar(selecionada.u),
                trocar: () => abrirNovo(selecionada.u),
                remover: () => remover(selecionada.u),
              }} />
          ) : (
            <div className="hidden lg:flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border border-dashed border-slate-300 bg-white text-center text-sm font-semibold text-slate-500 dark:bg-slate-900 dark:border-slate-700 lg:sticky lg:top-4">
              {t("leadersTab.listB.pickUnit")}
            </div>
          )}
        </div>
      </div>

      {editando && (
        <EditarLiderPopup key={`${editando.unidade.id}-${editando.vaga}`} unidade={editando.unidade} vaga={editando.vaga} foco={editando.foco}
          quem={{ id: userId, nome: meuNome }} onFechar={() => setEditando(null)} />
      )}
      {temp.convidando && (
        <ConviteModal role={role} escopos={escopos} unidades={todasUnidades} unidadeInicial={temp.convidando.unidade}
          quem={{ id: userId, nome: meuNome, email: userData?.email }} onFechar={temp.fecharConvite} onCriado={temp.aoConvidar} />
      )}
      {temp.prorrogando && <PrazoModal cracha={temp.prorrogando} onFechar={temp.fecharPrazo} onSalvar={temp.salvarPrazo} />}

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
            <CabecalhoDoModal abaId="lideres" icone={UserPlus}
              titulo={t("leadersTab.modal.newTitle")}
              onFechar={() => setModal(null)} desabilitado={salvando} />
            <div className="p-5 sm:p-7 space-y-5 overflow-y-auto">

            <div className={modal.modo === "novo" ? "grid md:grid-cols-2 gap-6" : "space-y-4"}>
            <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{t("leadersTab.modal.sectionPerson")}</p>
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
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{t("leadersTab.modal.sectionAccess")}</p>
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

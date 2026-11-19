import { escopoMentor } from "../../../permissions.js";
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
  IdCard, UserCheck, UserPlus, UserX, Search, Loader2, Building2, Mail, Phone, Edit2, X, Check, KeyRound, AlertTriangle, BadgeCheck, UserCog, ScanSearch,
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
import { FiltroPadrao } from "../ui/FiltroPadrao";
import { CabecalhoDoModal } from "../ui/CabecalhoDoModal";
import { BotaoDeLinha } from "../ui/BotaoDeLinha";
import { CabecalhoDaAba, CaixaDeNumeros, BotaoPrincipal, BotaoSecundario } from "../ui/CabecalhoDaAba";
import { AcoesDoContato } from "../ui/AcoesDoContato";
import { useFiltroCascata } from "../ui/useFiltroCascata";
import SeloRepetido from "../ui/SeloRepetido";
import { useSelosRepetidos } from "../ui/useSelosRepetidos";
import { BotaoDocumento, DocumentoModal, BuscaDocumento, AvisoDocumento } from "../Documento/DocumentoModal";
import i18n from "../../../i18n";
import CampoDocumento from "../../../components/acesso/CampoDocumento";
import { documentoNoLote, gravarComAviso, ERRO_DOCUMENTO_EM_USO, excluirPedidoELiberar, liberarReserva } from "../../../services/documentoService";
import { documentoValido, tipoDocumentoPadrao } from "../../../utils/documento";
import { sincronizarEAvisar } from "../../../services/contatoService";
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

export function LideresTab() {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { catalogs, loadingCatalogs } = useCatalogs();
  const { total: totalPendencias } = usePedidosPendentes();

  const role = String(userData?.role || "").trim().toLowerCase();
  const userId = userData?.id || userData?.uid;
  const escopoId = escopoMentor(userData); // id que vale como "mentor das unidades" (2º mentor usa o do 1º)
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
    return role === "admin" ? todas : todas.filter((u) => u.mentorId === escopoId);
  }, [catalogs?.unidades, role, escopoId]);

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
  const soDaSituacao = useCallback((u) => situacao === "todas"
    || (situacao === "com" && u.liderUid)
    || (situacao === "sem" && !u.liderUid)
    || (situacao === "conferir" && u.liderUid && u.liderAConferir === true), [situacao]);
  const filtro = useFiltroCascata(minhasUnidades, {
    getPais: siglaPais,
    getEstados: (u) => [u.estado],
    getMentorIds: (u) => [u.mentorId],
    textoBusca: (u) => [u.nome, u.estado, u.liderNome, u.liderEmail, u.liderTelefone, u.lider2Nome, u.lider2Email, u.lider2Telefone],
    nomeMentor,
    extra: soDaSituacao,
  });
  // Líder novo "a conferir" aparece primeiro.
  const lista = useMemo(
    () => [...filtro.resultado].sort((a, b) => Number(b.liderAConferir === true) - Number(a.liderAConferir === true)),
    [filtro.resultado]);


  const kpis = useMemo(() => {
    const comLider = minhasUnidades.filter((u) => u.liderUid).length;
    const aConferir = minhasUnidades.filter((u) => u.liderUid && u.liderAConferir === true).length;
    return { total: minhasUnidades.length, comLider, semLider: minhasUnidades.length - comLider, aConferir };
  }, [minhasUnidades]);

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

  const rotuloAcesso = {
    google: { texto: t("leadersTab.access.google"), cor: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800" },
    senha: { texto: t("leadersTab.access.password"), cor: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800" },
    antigo: { texto: t("leadersTab.access.legacy"), cor: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800" },
  };

  return (
    <div className="p-6 space-y-8">
      {/* CABEÇALHO */}
      <CabecalhoDaAba abaId="lideres" icone={UserCheck} titulo={t("leadersTab.title")} subtitulo={t("leadersTab.subtitle")}
        numeros={<CaixaDeNumeros abaId="lideres" itens={[
          { id: "total", rotulo: t("leadersTab.filter.all"), valor: kpis.total, onClick: () => setSituacao("todas"), ativo: situacao === "todas" },
          { id: "com", rotulo: t("leadersTab.filter.with"), valor: kpis.comLider, cor: "text-green-600", onClick: () => setSituacao("com"), ativo: situacao === "com" },
          { id: "sem", rotulo: t("leadersTab.filter.without"), valor: kpis.semLider, cor: "text-red-500", onClick: () => setSituacao("sem"), ativo: situacao === "sem" },
          { id: "conferir", rotulo: t("leadersTab.filter.toCheck"), valor: kpis.aConferir, cor: "text-amber-600", onClick: () => setSituacao("conferir"), ativo: situacao === "conferir" },
        ]} />}>
        <BotaoSecundario icone={UserCog} onClick={() => setTornarLider({ vaga: 1, unidade: null })}>{t("leadersTab.promote.button")}</BotaoSecundario>
        <BotaoPrincipal abaId="lideres" icone={UserPlus} onClick={() => abrirNovo(null)}>{t("leadersTab.new")}</BotaoPrincipal>
      </CabecalhoDaAba>

      {/* PEDIDOS DE ACESSO (login pelo Google) */}
      {totalPendencias > 0 && (
        <div ref={pedidosRef} className="scroll-mt-4 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-900/10 -mx-2">
          <PendenciasTab />
        </div>
      )}

      {kpis.aConferir > 0 && (
        <p className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {t("leadersTab.checkBanner", { count: kpis.aConferir })}
        </p>
      )}

      {/* LISTA DE UNIDADES E SEUS LÍDERES */}
      <div className="space-y-4">
        <FiltroPadrao abaId="lideres" filtro={filtro}
          mostrar={["pais", "estado", ...(role === "admin" ? ["mentor"] : [])]}
          placeholder={t("leadersTab.search")} ativoExtra={situacao !== "todas"} aoLimpar={() => setSituacao("todas")}
          acoes={<>
              {podeAcessar && (
                <button type="button" onClick={() => setMostrarBuscaDoc((v) => !v)} aria-expanded={mostrarBuscaDoc}
                  className={`px-4 py-3 rounded-xl border text-xs font-black uppercase flex items-center justify-center gap-2 transition-colors ${mostrarBuscaDoc
                    ? "border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300"
                    : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-teal-500 hover:text-teal-600"}`}>
                  <ScanSearch className="w-4 h-4" /> {t("document.search.title")}
                </button>
              )}
          </>}>
          {mostrarBuscaDoc && (
            <BuscaDocumento aoCadastrar={cadastrarPeloDocumento}
              aoEscolherPessoa={() => setTornarLider({ vaga: 1, unidade: null })}
              aoIrParaPedido={() => pedidosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />
          )}

          {/* Situação: um seletor só, com a contagem de cada grupo */}
          <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 w-fit max-w-full">
            {[
              { id: "todas", rotulo: t("leadersTab.filter.all"), n: kpis.total },
              { id: "com", rotulo: t("leadersTab.filter.with"), n: kpis.comLider },
              { id: "sem", rotulo: t("leadersTab.filter.without"), n: kpis.semLider },
              { id: "conferir", rotulo: t("leadersTab.filter.toCheck"), n: kpis.aConferir },
            ].map((f) => (
              <button key={f.id} type="button" onClick={() => setSituacao(f.id)} aria-pressed={situacao === f.id}
                className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-2 transition-colors ${situacao === f.id
                  ? "bg-white dark:bg-slate-700 text-teal-600 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}>
                {f.rotulo}
                <span className={`min-w-[1.5rem] px-1.5 py-0.5 rounded-md text-[10px] text-center ${situacao === f.id
                  ? "bg-teal-600 text-white"
                  : f.id === "conferir" && f.n > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300"}`}>{f.n}</span>
              </button>
            ))}
          </div>
        </FiltroPadrao>

        {loadingCatalogs ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-teal-500" /></div>
        ) : lista.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-bold text-sm">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" /> {t("leadersTab.empty")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="p-4">{t("leadersTab.col.unit")}</th>
                  <th className="p-4">{t("leadersTab.col.leader")}</th>
                  <th className="p-4">{t("leadersTab.col.access")}</th>
                  {role === "admin" && <th className="p-4">{t("leadersTab.col.mentor")}</th>}
                  <th className="p-4 text-right">{t("leadersTab.col.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {lista.map((u) => {
                  const acesso = tipoDeAcesso(u);
                  const ocupado = processando === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20">
                      <td className="p-4">
                        <LinkUnidade unidade={u} className="font-black text-slate-800 dark:text-slate-200 uppercase text-xs">{u.nome}</LinkUnidade>
                        <p className="text-[11px] text-slate-400 font-bold">{u.estado || "-"}{u.status && u.status !== "ativa" ? ` · ${u.status}` : ""}</p>
                      </td>
                      <td className="p-4">
                        {u.liderUid ? (
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                              <LinkCentral tipo="lider" alvo={u}>{u.liderNome || "-"}</LinkCentral>
                              <SeloRepetido selo={selosRepetidos.get(`cracha:${u.liderUid}`)} detalheDe={(o) => o.email || ""} />
                              {u.liderAConferir === true && (
                                <span className="px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700">{t("leadersTab.toCheck")}</span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" /> {u.liderEmail || "-"}</p>
                            {u.liderTelefone && <p className="text-[11px] text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {u.liderTelefone} <AcoesDoContato telefone={u.liderTelefone} pais={u.pais} /></p>}
                            {u.lider2Uid && (
                              <div className="mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 space-y-0.5">
                                <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                                  <LinkCentral tipo="lider2" alvo={u}>{u.lider2Nome || "-"}</LinkCentral>
                                  <SeloRepetido selo={selosRepetidos.get(`cracha:${u.lider2Uid}`)} detalheDe={(o) => o.email || ""} />
                                  <span className="px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800">{t("leadersTab.second.badge")}</span>
                                  <button onClick={() => setDocAlvo({ id: u.lider2Uid, nome: u.lider2Nome, email: u.lider2Email })} title={t("document.modal.edit")}
                                    className="p-1 rounded-md text-slate-400 hover:bg-blue-50 hover:text-blue-600"><IdCard className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => remover(u, 2)} disabled={ocupado} title={t("leadersTab.second.remove")}
                                    className="p-1 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"><UserX className="w-3.5 h-3.5" /></button>
                                </p>
                                <p className="text-[11px] text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" /> {u.lider2Email || "-"}</p>
                                {u.lider2Telefone && <p className="text-[11px] text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {u.lider2Telefone} <AcoesDoContato telefone={u.lider2Telefone} pais={u.pais} /></p>}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {t("leadersTab.noLeader")}</span>
                        )}
                      </td>
                      <td className="p-4">
                        {acesso ? (
                          <span className={`inline-block px-2 py-1 rounded-md border text-[10px] font-black uppercase ${rotuloAcesso[acesso].cor}`}>{rotuloAcesso[acesso].texto}</span>
                        ) : <span className="text-xs text-slate-400">-</span>}
                      </td>
                      {role === "admin" && (
                        <td className="p-4 text-xs font-bold text-slate-500">{mentores.find((m) => m.id === u.mentorId)?.nome?.split(" ")[0] || "-"}</td>
                      )}
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          {u.liderUid ? (
                            <>
                              {u.liderAConferir === true && (
                                <button onClick={() => confirmar(u)} disabled={ocupado} title={t("leadersTab.confirm")}
                                  className="px-3 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-[10px] font-black uppercase flex items-center gap-1.5 disabled:opacity-50">
                                  <BadgeCheck className="w-3.5 h-3.5" /> {t("leadersTab.confirm")}
                                </button>
                              )}
                              {!u.lider2Uid && (
                                <button onClick={() => setTornarLider({ vaga: 2, unidade: u })} disabled={ocupado} title={t("leadersTab.second.addHint")}
                                  className="px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 hover:bg-violet-100 text-[10px] font-black uppercase flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap">
                                  <UserPlus className="w-3.5 h-3.5" /> {t("leadersTab.second.add")}
                                </button>
                              )}
                              <BotaoDocumento onClick={() => setDocAlvo({ id: u.liderUid, nome: u.liderNome, email: u.liderEmail })} disabled={ocupado} />
                              <BotaoDeLinha abaId="lideres" icone={Edit2} onClick={() => abrirEditar(u)} disabled={ocupado} title={t("leadersTab.edit")} />
                              <BotaoDeLinha abaId="lideres" icone={UserPlus} onClick={() => abrirNovo(u)} disabled={ocupado} title={t("leadersTab.replace")} />
                              <BotaoDeLinha abaId="lideres" tipo="perigo" icone={ocupado ? Loader2 : UserX} girar={ocupado} onClick={() => remover(u)} disabled={ocupado} title={t("leadersTab.remove")} />
                            </>
                          ) : (
                            <>
                              <button onClick={() => setTornarLider({ vaga: 1, unidade: u })} title={t("leadersTab.promote.title")}
                                className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 text-[10px] font-black uppercase flex items-center gap-1.5 whitespace-nowrap">
                                <UserCog className="w-3.5 h-3.5" /> {t("leadersTab.promote.pick")}
                              </button>
                              <button onClick={() => abrirNovo(u)} className="px-3 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-[10px] font-black uppercase flex items-center gap-1.5">
                                <UserPlus className="w-3.5 h-3.5" /> {t("leadersTab.register")}
                              </button>
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
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500" />
            </label>

            <label className="block space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("leadersTab.modal.email")}</span>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={salvando || modal.modo === "editar"}
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-70" />
              {modal.modo === "editar" && <span className="text-[11px] text-slate-400">{t("leadersTab.modal.emailLocked")}</span>}
            </label>

            <label className="block space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("leadersTab.modal.phone")}</span>
              <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} disabled={salvando} maxLength={30} placeholder="+55 31 99999-9999"
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500" />
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
                  className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500" />
                <span className="text-[11px] text-slate-400">{t("leadersTab.modal.passwordHint", { min: SENHA_MINIMA })}</span>
              </label>
            )}
            </div>
            )}
            </div>

            {erro && <p className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{erro}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} disabled={salvando} className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200">{t("leadersTab.modal.cancel")}</button>
              <button type="submit" disabled={salvando} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-teal-500 hover:bg-teal-600 text-white flex items-center gap-1.5 disabled:opacity-50">
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

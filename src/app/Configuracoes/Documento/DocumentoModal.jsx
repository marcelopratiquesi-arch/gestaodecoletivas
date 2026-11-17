// Documento de identificação (CPF/DNI/SSN) de um líder ou mentor, visto e corrigido por quem tem direito:
//  - admin: de todo mundo;  - mentor: dos líderes das unidades dele;  - cada pessoa: o próprio (tela obrigatória).
// O banco é quem decide (firestore.rules: usuarios/{uid}/privado/documento). A auditoria registra QUE o documento
// foi informado ou corrigido, nunca o número. Também tem a busca por documento (só admin).
import { useEffect, useState } from "react";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { Loader2, X, Search, IdCard, Trash2, UserCheck, UserPlus, Inbox } from "lucide-react";
import i18n from "../../../i18n";
import { db } from "../../../services/firebase";
import { useAuth } from "../../../contexts/AuthContext";
import { registrarAuditoriaAcesso } from "../../../services/auditoriaAcessos";
import {
  documentoNoLote, gravarComAviso, lerDocumento, ERRO_DOCUMENTO_EM_USO, acharDonoDoDocumento, excluirPedidoELiberar, liberarReserva,
} from "../../../services/documentoService";
import CampoDocumento from "../../../components/acesso/CampoDocumento";
import {
  documentoValido, formatarDocumento, limparDocumento, tipoDocumentoPadrao, TIPOS_DOCUMENTO,
} from "../../../utils/documento";

/** Botão pequeno que abre o modal (use dentro das linhas das tabelas). */
export function BotaoDocumento({ onClick, disabled }) {
  const { t } = useTranslation();
  return (
    <button onClick={onClick} disabled={disabled} title={t("document.modal.edit")}
      className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50">
      <IdCard className="w-4 h-4" />
    </button>
  );
}

/** @param {{alvo:{id:string,nome?:string,email?:string,papel?:string}, onClose:()=>void}} props */
export function DocumentoModal({ alvo, onClose }) {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const souAdmin = ["admin", "administrador", "master"].includes(String(userData?.role || "").trim().toLowerCase());

  const [carregando, setCarregando] = useState(true);
  const [anterior, setAnterior] = useState(null);
  const [tipo, setTipo] = useState(() => tipoDocumentoPadrao(i18n.language));
  const [numero, setNumero] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    let vivo = true;
    lerDocumento(alvo.id)
      .then((d) => {
        if (!vivo) return;
        setAnterior(d);
        if (d) { setTipo(d.tipo); setNumero(formatarDocumento(d.tipo, d.numero)); }
      })
      .catch((e) => console.error(e))
      .finally(() => vivo && setCarregando(false));
    return () => { vivo = false; };
  }, [alvo.id]);

  async function salvar(e) {
    e.preventDefault();
    setErro(""); setOk("");
    if (!documentoValido(tipo, numero)) return setErro(t("document.errors.invalid"));
    setSalvando(true);
    try {
      const batch = writeBatch(db);
      // O admin também marca o crachá; o mentor não pode (a própria pessoa marca quando entrar, sem digitar nada).
      documentoNoLote(batch, { uid: alvo.id, tipo, numero, anterior, marcarCracha: souAdmin });
      await gravarComAviso(batch);
      await registrarAuditoriaAcesso({
        tipoAcao: anterior ? "ALTERADA" : "NOVA",
        descricao: t(anterior ? "document.modal.auditChange" : "document.modal.auditNew"),
        quem: userData,
        alvo: { id: alvo.id, nome: alvo.nome, email: alvo.email },
        detalhes: t("document.modal.auditType", { type: t(`document.short.${tipo}`) }),
      });
      setAnterior({ tipo, numero: limparDocumento(numero) });
      setOk(t("document.modal.saved"));
    } catch (err) {
      console.error(err);
      setErro(err?.message === ERRO_DOCUMENTO_EM_USO ? t("document.errors.inUse") : t("document.errors.save"));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={salvar} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-black text-slate-800 dark:text-white">{t("document.modal.title", { name: alvo.nome || alvo.email || "-" })}</h3>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        {carregando ? (
          <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
        ) : (
          <>
            {!anterior && <p className="text-xs font-bold text-amber-600">{t("document.modal.none")}</p>}
            <CampoDocumento claro id="modal-documento" tipo={tipo} onTipo={setTipo} valor={numero} onValor={setNumero} desabilitado={salvando} />
            {erro && <p className="text-xs font-bold text-red-600">{erro}</p>}
            {ok && <p className="text-xs font-bold text-emerald-600">{ok}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200">{t("document.modal.cancel")}</button>
              <button type="submit" disabled={salvando} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 disabled:opacity-50">
                {salvando && <Loader2 className="w-4 h-4 animate-spin" />} {t("document.modal.save")}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

// Lê um documento do banco sem quebrar a busca: sem permissão ou inexistente = null.
async function lerOpcional(ref) {
  try {
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    if (e?.code === "permission-denied") return null;
    throw e;
  }
}

/** Quem está com o documento: { uid, tipo, numero, cracha, pedido } ou null (livre, ou fora das suas unidades). */
async function procurarDono(tipo, numero) {
  const dono = await acharDonoDoDocumento(tipo, numero);
  if (!dono) return null;
  const [cracha, pedido] = await Promise.all([
    lerOpcional(doc(db, "usuarios", dono.uid)),
    lerOpcional(doc(db, "solicitacoes_acesso", dono.uid)),
  ]);
  return { uid: dono.uid, tipo, numero: limparDocumento(numero), cracha, pedido };
}

/**
 * Cartão de quem está com o documento, com as saídas:
 *  - quem já tem crachá: corrigir o documento (e, se vier `aoEscolherPessoa`, usar essa pessoa como líder);
 *  - pedido de acesso ou documento "preso": excluir e liberar, para a pessoa cadastrar de novo na hora.
 */
function CartaoDoDocumento({ r, aoLiberar, aoEscolherPessoa, aoCadastrar, aoIrParaPedido }) {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const souAdmin = ["admin", "administrador", "master"].includes(String(userData?.role || "").trim().toLowerCase());
  const [docAlvo, setDocAlvo] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState("");

  const nome = r.cracha?.nome || r.pedido?.nome || r.pedido?.email || t("document.search.unknownName");
  const email = r.pedido?.email || r.cracha?.email;
  const papel = r.cracha ? String(r.cracha.role || "").trim().toLowerCase() : "";
  const situacao = r.cracha
    ? t(`document.search.role.${papel}`, { defaultValue: papel || "-" })
    : r.pedido ? t(`document.search.request.${r.pedido.status}`, { defaultValue: r.pedido.status || "-" }) : t("document.search.orphan");

  async function liberar() {
    if (!window.confirm(t(r.pedido ? "document.search.confirmDelete" : "document.search.confirmFree", { name: nome }))) return;
    setExcluindo(true); setErro("");
    try {
      if (r.pedido) await excluirPedidoELiberar(r.uid, { tipo: r.tipo, numero: r.numero });
      else await liberarReserva(r.tipo, r.numero);
      await registrarAuditoriaAcesso({
        tipoAcao: "EXCLUÍDA",
        descricao: t(r.pedido ? "document.search.auditDelete" : "document.search.auditFree"),
        quem: userData,
        alvo: { id: r.uid, nome, email },
        detalhes: t("document.modal.auditType", { type: t(`document.short.${r.tipo}`) }),
      });
      aoLiberar();
    } catch (err) {
      console.error(err);
      setErro(t("document.search.deleteError"));
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3 space-y-2">
      <div>
        <p className="text-sm font-black text-slate-800 dark:text-slate-100">{nome}</p>
        {email && <p className="text-xs text-slate-500">{email}</p>}
        <p className="text-[11px] font-black uppercase text-blue-600 mt-1">{situacao}</p>
        {!r.cracha && r.pedido?.unidadeNomes?.length > 0 && <p className="text-[11px] text-slate-400 font-bold">{r.pedido.unidadeNomes.join(", ")}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {!r.cracha && aoCadastrar && (
          <button type="button" onClick={() => aoCadastrar({ tipo: r.tipo, numero: r.numero, nome: r.pedido?.nome || "", email: r.pedido?.email || "", telefone: r.pedido?.telefone || "" })}
            className="px-3 py-2 rounded-lg text-[11px] font-black uppercase bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /> {t("document.search.registerLeader")}
          </button>
        )}
        {!r.cracha && r.pedido?.status === "pendente" && aoIrParaPedido && (
          <button type="button" onClick={aoIrParaPedido}
            className="px-3 py-2 rounded-lg text-[11px] font-black uppercase bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5">
            <Inbox className="w-3.5 h-3.5" /> {t("document.search.goToRequest")}
          </button>
        )}
        {r.cracha && aoEscolherPessoa && (
          <button type="button" onClick={aoEscolherPessoa}
            className="px-3 py-2 rounded-lg text-[11px] font-black uppercase bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5" /> {t("document.search.useAsLeader")}
          </button>
        )}
        {r.cracha && (
          <button type="button" onClick={() => setDocAlvo({ id: r.uid, nome, email })}
            className="px-3 py-2 rounded-lg text-[11px] font-black uppercase bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5">
            <IdCard className="w-3.5 h-3.5" /> {t("document.search.fix")}
          </button>
        )}
        {!r.cracha && (r.pedido || souAdmin) && (
          <button type="button" onClick={liberar} disabled={excluindo}
            className="px-3 py-2 rounded-lg text-[11px] font-black uppercase bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 disabled:opacity-50">
            {excluindo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            {t(r.pedido ? "document.search.deleteRequest" : "document.search.freeDoc")}
          </button>
        )}
      </div>
      {erro && <p className="text-xs font-bold text-red-600">{erro}</p>}
      {r.cracha && <p className="text-[11px] text-slate-500">{t("document.search.hasBadgeHint")}</p>}
      {!r.cracha && r.pedido && <p className="text-[11px] text-slate-500">{t("document.search.deleteHint")}</p>}
      {!r.cracha && !r.pedido && !souAdmin && <p className="text-[11px] text-slate-500">{t("document.search.orphanMentorHint")}</p>}
      {docAlvo && <DocumentoModal alvo={docAlvo} onClose={() => setDocAlvo(null)} />}
    </div>
  );
}

/**
 * Busca de cadastro pelo documento (admin e mentor). Mostra quem está com o CPF e deixa resolver na hora.
 * O mentor só enxerga quem é das unidades dele (o banco garante).
 */
export function BuscaDocumento({ aoCadastrar, aoEscolherPessoa, aoIrParaPedido }) {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const souAdmin = ["admin", "administrador", "master"].includes(String(userData?.role || "").trim().toLowerCase());
  const [tipo, setTipo] = useState(() => tipoDocumentoPadrao(i18n.language));
  const [numero, setNumero] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState(null); // "nao" | "liberado" | { uid, tipo, numero, cracha, pedido }
  const [erro, setErro] = useState("");

  async function buscar(e) {
    e.preventDefault();
    setErro(""); setResultado(null);
    if (!TIPOS_DOCUMENTO.includes(tipo) || !documentoValido(tipo, numero)) return setErro(t("document.errors.invalid"));
    setBuscando(true);
    try {
      setResultado((await procurarDono(tipo, numero)) || "nao");
    } catch (err) {
      console.error(err);
      setErro(t("document.errors.save"));
    } finally {
      setBuscando(false);
    }
  }

  return (
    <form onSubmit={buscar} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
      <p className="text-xs font-black uppercase text-slate-500">{t("document.search.title")}</p>
      <CampoDocumento claro id="busca-documento" tipo={tipo} onTipo={setTipo} valor={numero} onValor={setNumero} desabilitado={buscando} />
      <button type="submit" disabled={buscando} className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 disabled:opacity-50">
        {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} {t("document.search.button")}
      </button>
      {erro && <p className="text-xs font-bold text-red-600">{erro}</p>}
      {resultado === "nao" && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-500">{souAdmin ? t("document.search.notFound") : t("document.search.notFoundMentor")}</p>
          {aoCadastrar && (
            <button type="button" onClick={() => aoCadastrar({ tipo, numero: limparDocumento(numero), nome: "", email: "", telefone: "" })}
              className="px-3 py-2 rounded-lg text-[11px] font-black uppercase bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" /> {t("document.search.registerLeader")}
            </button>
          )}
        </div>
      )}
      {resultado === "liberado" && (
        <div className="space-y-2">
          <p className="text-sm font-black text-emerald-600">{t("document.search.freed")}</p>
          {aoCadastrar && (
            <button type="button" onClick={() => aoCadastrar({ tipo, numero: limparDocumento(numero), nome: "", email: "", telefone: "" })}
              className="px-3 py-2 rounded-lg text-[11px] font-black uppercase bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" /> {t("document.search.registerLeader")}
            </button>
          )}
        </div>
      )}
      {resultado && typeof resultado === "object" && <CartaoDoDocumento r={resultado} aoLiberar={() => setResultado("liberado")} aoEscolherPessoa={aoEscolherPessoa} aoCadastrar={aoCadastrar} aoIrParaPedido={aoIrParaPedido} />}
    </form>
  );
}

/**
 * Aviso dentro do cadastro de líder: assim que o documento fica válido, confere se ele já está com alguém.
 * Se estiver, mostra quem é e as saídas (usar a pessoa, corrigir, ou excluir e liberar). Se estiver livre, avisa.
 */
export function AvisoDocumento({ tipo, numero, aoEscolherPessoa, aoMudarDono }) {
  const { t } = useTranslation();
  const [estado, setEstado] = useState(null); // null | "livre" | "liberado" | "erro" | { ...dono }
  const valido = TIPOS_DOCUMENTO.includes(tipo) && documentoValido(tipo, numero);
  const chave = valido ? `${tipo}_${limparDocumento(numero)}` : "";

  useEffect(() => {
    setEstado(null);
    aoMudarDono?.(null);
    if (!chave) return undefined;
    let vivo = true;
    procurarDono(tipo, numero)
      .then((dono) => { if (!vivo) return; setEstado(dono || "livre"); aoMudarDono?.(dono); })
      .catch((e) => { console.error(e); if (vivo) setEstado("erro"); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  if (!estado) return null;
  if (estado === "livre") return <p className="text-xs font-bold text-emerald-600">{t("document.search.free")}</p>;
  if (estado === "liberado") return <p className="text-xs font-bold text-emerald-600">{t("document.search.freed")}</p>;
  if (estado === "erro") return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-amber-600">{t("document.search.alreadyUsed")}</p>
      <CartaoDoDocumento r={estado} aoLiberar={() => { setEstado("liberado"); aoMudarDono?.(null); }} aoEscolherPessoa={aoEscolherPessoa} />
    </div>
  );
}

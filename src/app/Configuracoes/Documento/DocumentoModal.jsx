// Documento de identificação (CPF/DNI/SSN) de um líder ou mentor, visto e corrigido por quem tem direito:
//  - admin: de todo mundo;  - mentor: dos líderes das unidades dele;  - cada pessoa: o próprio (tela obrigatória).
// O banco é quem decide (firestore.rules: usuarios/{uid}/privado/documento). A auditoria registra QUE o documento
// foi informado ou corrigido, nunca o número. Também tem a busca por documento (só admin).
import { useEffect, useState } from "react";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { Loader2, X, Search, IdCard } from "lucide-react";
import i18n from "../../../i18n";
import { db } from "../../../services/firebase";
import { useAuth } from "../../../contexts/AuthContext";
import { registrarAuditoriaAcesso } from "../../../services/auditoriaAcessos";
import { documentoNoLote, gravarComAviso, lerDocumento, ERRO_DOCUMENTO_EM_USO } from "../../../services/documentoService";
import CampoDocumento from "../../../components/acesso/CampoDocumento";
import {
  documentoValido, formatarDocumento, idDocumentoUnico, limparDocumento, tipoDocumentoPadrao, TIPOS_DOCUMENTO,
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

/** Busca de cadastro pelo documento (só admin: a coleção de reservas só ele lê). */
export function BuscaDocumento() {
  const { t } = useTranslation();
  const [tipo, setTipo] = useState(() => tipoDocumentoPadrao(i18n.language));
  const [numero, setNumero] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState(null); // { nome } | "nao"
  const [erro, setErro] = useState("");

  async function buscar(e) {
    e.preventDefault();
    setErro(""); setResultado(null);
    if (!TIPOS_DOCUMENTO.includes(tipo) || !documentoValido(tipo, numero)) return setErro(t("document.errors.invalid"));
    setBuscando(true);
    try {
      const reserva = await getDoc(doc(db, "documentos_unicos", idDocumentoUnico(tipo, numero)));
      if (!reserva.exists()) return setResultado("nao");
      const pessoa = await getDoc(doc(db, "usuarios", reserva.data().uid));
      setResultado({ nome: pessoa.exists() ? pessoa.data().nome || pessoa.data().email : t("document.search.unknownName") });
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
      {resultado === "nao" && <p className="text-xs font-bold text-slate-500">{t("document.search.notFound")}</p>}
      {resultado && resultado !== "nao" && <p className="text-sm font-black text-emerald-600">{t("document.search.found", { name: resultado.nome })}</p>}
    </form>
  );
}

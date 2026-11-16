// Tela OBRIGATÓRIA do documento de identificação (CPF no Brasil, DNI na Argentina, SSN nos EUA).
// Aparece para líder, mentor e admin que já têm acesso mas ainda não informaram o documento (ver PrivateRoute).
// Antes de mostrar o formulário, o sistema procura o documento em três lugares, nesta ordem, e só copia:
//   1) a gaveta privada do próprio crachá (ex.: o admin ou o mentor já informou) → só marca "documentoOk";
//   2) o pedido de acesso aprovado (primeiro acesso) → copia para a gaveta do crachá;
//   3) o convite do mentor cadastrado pelo admin → copia para a gaveta do crachá.
// Só se não achar nada, pede para a pessoa digitar. O número nunca vai para o crachá aberto.
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { Loader2, LogOut, AlertTriangle, ShieldCheck } from "lucide-react";
import i18n from "../i18n";
import { db } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import { FundoAcesso, Marca, BotaoVermelho, BotaoLink } from "../components/acesso/AcessoUI";
import CampoDocumento from "../components/acesso/CampoDocumento";
import { documentoValido, tipoDocumentoPadrao, TIPOS_DOCUMENTO } from "../utils/documento";
import { documentoNoLote, gravarComAviso, lerDocumento, lerDocumentoDoPedido, ERRO_DOCUMENTO_EM_USO } from "../services/documentoService";

const Carregando = ({ texto }) => (
  <FundoAcesso>
    <Marca compacta />
    <div className="flex flex-col items-center gap-3 py-10">
      <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      {texto && <p className="text-sm text-zinc-400">{texto}</p>}
    </div>
  </FundoAcesso>
);

// Documento do convite de mentor (convites_acesso/{e-mail}.documento), se o admin informou.
async function lerDocumentoDoConvite(email) {
  if (!email) return null;
  try {
    const snap = await getDoc(doc(db, "convites_acesso", email.toLowerCase()));
    const d = snap.exists() ? snap.data().documento : null;
    return d && TIPOS_DOCUMENTO.includes(d.tipo) && documentoValido(d.tipo, d.numero) ? { tipo: d.tipo, numero: String(d.numero) } : null;
  } catch {
    return null;
  }
}

export default function InformarDocumento() {
  const { t } = useTranslation();
  const { user, userData, loading, logout, recarregarCracha, precisaDocumento } = useAuth();
  const uid = user?.uid;

  const [procurando, setProcurando] = useState(true);
  const [tipo, setTipo] = useState(() => tipoDocumentoPadrao(i18n.language));
  const [numero, setNumero] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Procura um documento já informado (gaveta, pedido ou convite) e, achando, só copia e segue.
  useEffect(() => {
    if (!uid || !precisaDocumento) return;
    let vivo = true;
    (async () => {
      try {
        const naGaveta = await lerDocumento(uid);
        if (naGaveta) {
          const batch = writeBatch(db);
          batch.update(doc(db, "usuarios", uid), { documentoOk: true });
          await gravarComAviso(batch);
          if (vivo) await recarregarCracha();
          return;
        }
        const origem = (await lerDocumentoDoPedido(uid)) || (await lerDocumentoDoConvite(userData?.email || user?.email));
        if (origem && documentoValido(origem.tipo, origem.numero)) {
          const batch = writeBatch(db);
          documentoNoLote(batch, { uid, tipo: origem.tipo, numero: origem.numero, marcarCracha: true });
          await gravarComAviso(batch);
          if (vivo) await recarregarCracha();
          return;
        }
      } catch (e) {
        console.error(e);
        if (vivo && e?.message === ERRO_DOCUMENTO_EM_USO) setErro(t("document.errors.inUse"));
      }
      if (vivo) setProcurando(false);
    })();
    return () => { vivo = false; };
  }, [uid, precisaDocumento]); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvar(e) {
    e.preventDefault();
    setErro("");
    if (!documentoValido(tipo, numero)) return setErro(t("document.errors.invalid"));
    setSalvando(true);
    try {
      const batch = writeBatch(db);
      documentoNoLote(batch, { uid, tipo, numero, marcarCracha: true });
      await gravarComAviso(batch);
      await recarregarCracha();
    } catch (err) {
      console.error(err);
      setErro(err?.message === ERRO_DOCUMENTO_EM_USO ? t("document.errors.inUse") : t("document.errors.save"));
      setSalvando(false);
    }
  }

  if (loading) return <Carregando />;
  if (!user || !userData) return <Navigate to="/login" replace />;
  if (!precisaDocumento) return <Navigate to="/app" replace />;
  if (procurando && !erro) return <Carregando texto={t("document.gate.checking")} />;

  return (
    <FundoAcesso>
      <Marca compacta />
      <div className="text-center space-y-1.5 mb-5">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-600/10 flex items-center justify-center mb-3">
          <ShieldCheck className="w-7 h-7 text-red-500" />
        </div>
        <h2 className="text-xl font-black text-white">{t("document.gate.title")}</h2>
        <p className="text-sm text-zinc-400">{t("document.gate.desc")}</p>
      </div>
      <form onSubmit={salvar} className="space-y-4">
        <CampoDocumento tipo={tipo} onTipo={setTipo} valor={numero} onValor={setNumero} desabilitado={salvando} />
        <p className="text-[11px] text-zinc-500 ml-1">{t("document.hint")}</p>
        {erro && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {erro}
          </div>
        )}
        <BotaoVermelho type="submit" disabled={salvando}>
          {salvando ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t("document.gate.save")}
        </BotaoVermelho>
      </form>
      <div className="mt-3">
        <BotaoLink onClick={logout} disabled={salvando}><LogOut className="w-4 h-4" /> {t("document.gate.logout", { email: user.email })}</BotaoLink>
      </div>
    </FundoAcesso>
  );
}

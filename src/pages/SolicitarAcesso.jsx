// Tela de quem entrou pelo Google e ainda não tem acesso aprovado.
// 1ª vez: preenche nome, WhatsApp e a unidade em que é líder → vira um pedido em solicitacoes_acesso/{uid}.
// Depois: fica "aguardando aprovação" (não vê nada do sistema) até um mentor/admin aprovar na aba Pendências.
// A lista de unidades vem da vitrine pública (só nomes), porque sem aprovação a pessoa não lê os cadastros.
// Mentor cadastrado pelo admin com este e-mail do Google (convites_acesso/{e-mail}): em vez do pedido,
// aparece "Entrar como mentor" — o cadastro feito pelo admin já é a aprovação (regra mentorAceitaConvite).
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { Loader2, Clock, LogOut, Building2, Phone, User, Send, AlertTriangle, Search, Pencil, ShieldCheck } from "lucide-react";
import { db } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import { VITRINE_CAMINHO } from "../services/vitrinePublica";
import { registrarAuditoriaAcesso } from "../services/auditoriaAcessos";

const Tela = ({ children }) => (
  <div className="min-h-screen flex items-center justify-center bg-black p-4 font-sans">
    <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl p-6 md:p-10 text-zinc-200">
      <h1 className="text-3xl font-black text-white italic tracking-tighter text-center mb-8">
        PRATIQUE <span className="text-red-600">COLETIVAS</span>
      </h1>
      {children}
    </div>
  </div>
);

export default function SolicitarAcesso() {
  const { t } = useTranslation();
  const { user, userData, loading, logout, recarregarCracha } = useAuth();

  const [pedido, setPedido] = useState(undefined); // undefined = carregando; null = ainda não pediu
  const [convite, setConvite] = useState(undefined); // convite de mentor pendente para este e-mail (null = não tem)
  const [aceitando, setAceitando] = useState(false);
  const [unidades, setUnidades] = useState(null);
  const [editando, setEditando] = useState(false);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [buscaUnidade, setBuscaUnidade] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const uid = user?.uid;

  // Acompanha o próprio pedido ao vivo: quando for aprovado, entra sozinho no sistema.
  useEffect(() => {
    if (!uid || userData) return;
    return onSnapshot(
      doc(db, "solicitacoes_acesso", uid),
      (snap) => setPedido(snap.exists() ? snap.data() : null),
      (e) => { console.error(e); setPedido(null); }
    );
  }, [uid, userData]);

  // Convite de mentor feito pelo admin para este e-mail do Google (1 leitura).
  const emailGoogle = String(user?.email || "").toLowerCase();
  useEffect(() => {
    if (!uid || userData) return;
    if (!emailGoogle) { setConvite(null); return; }
    getDoc(doc(db, "convites_acesso", emailGoogle))
      .then((snap) => {
        const c = snap.exists() ? snap.data() : null;
        setConvite(c?.status === "pendente" && c?.papel === "mentor" ? c : null);
      })
      .catch(() => setConvite(null));
  }, [uid, userData, emailGoogle]);

  async function aceitarConvite() {
    setErro("");
    setAceitando(true);
    try {
      // Cópia exata dos dados do convite (o banco confere campo a campo).
      const batch = writeBatch(db);
      batch.set(doc(db, "usuarios", uid), {
        nome: convite.nome, email: emailGoogle, telefone: convite.telefone, pais: convite.pais || "",
        role: "mentor", status: "ativo", loginGoogle: true,
        criadoPor: convite.criadoPor, criadoEm: serverTimestamp(),
      });
      batch.update(doc(db, "convites_acesso", emailGoogle), { status: "usado", usadoPor: uid, usadoEm: serverTimestamp() });
      await batch.commit();
      await registrarAuditoriaAcesso({
        tipoAcao: "NOVA",
        descricao: `Mentor(a) ${convite.nome}: 1º acesso pelo Google (cadastrado pelo admin).`,
        quem: { id: uid, nome: convite.nome, email: emailGoogle },
        alvo: { id: uid, nome: convite.nome, email: emailGoogle, emailGoogle },
        papelNovo: "mentor",
        detalhes: `Aprovado por: ${convite.criadoPorNome || "-"} (uid ${convite.criadoPor})`,
        unidadeNome: "Gestão/Diretoria",
      });
      await recarregarCracha();
    } catch (err) {
      console.error(err);
      setErro(t("accessRequest.invite.error"));
      setAceitando(false);
    }
  }

  useEffect(() => {
    if (pedido?.status === "aprovado") recarregarCracha();
  }, [pedido?.status, recarregarCracha]);

  // Unidades para escolher (1 leitura: a vitrine pública).
  const precisaFormulario = pedido === null || pedido?.status === "recusado" || editando;
  useEffect(() => {
    if (!precisaFormulario || unidades) return;
    getDoc(doc(db, ...VITRINE_CAMINHO))
      .then((snap) => {
        const mapa = snap.exists() ? snap.data().unidades || {} : {};
        const lista = Object.entries(mapa)
          .map(([id, u]) => ({ id, nome: u?.nome || "", estado: u?.estado || "" }))
          .filter((u) => u.nome)
          .sort((a, b) => a.nome.localeCompare(b.nome));
        setUnidades(lista);
      })
      .catch((e) => { console.error(e); setUnidades([]); });
  }, [precisaFormulario, unidades]);

  // Preenche o formulário com o pedido anterior (ou com o nome da conta Google).
  useEffect(() => {
    if (!precisaFormulario) return;
    setNome((n) => n || pedido?.nome || user?.displayName || "");
    setTelefone((v) => v || pedido?.telefone || "");
    setUnidadeId((v) => v || pedido?.unidadeId || "");
  }, [precisaFormulario, pedido, user]);

  const unidadesFiltradas = useMemo(() => {
    const termo = buscaUnidade.trim().toLowerCase();
    if (!unidades) return [];
    if (!termo) return unidades;
    return unidades.filter((u) => `${u.nome} ${u.estado}`.toLowerCase().includes(termo) || u.id === unidadeId);
  }, [unidades, buscaUnidade, unidadeId]);

  async function enviar(e) {
    e.preventDefault();
    setErro("");
    if (nome.trim().length < 3) return setErro(t("accessRequest.errors.name"));
    if (telefone.replace(/\D/g, "").length < 8) return setErro(t("accessRequest.errors.phone"));
    if (!unidadeId) return setErro(t("accessRequest.errors.unit"));

    setEnviando(true);
    try {
      await setDoc(doc(db, "solicitacoes_acesso", uid), {
        nome: nome.trim(),
        telefone: telefone.trim(),
        unidadeId,
        unidadeNome: unidades?.find((u) => u.id === unidadeId)?.nome || "",
        email: user.email,
        status: "pendente",
        criadoEm: serverTimestamp(),
      });
      setEditando(false);
    } catch (err) {
      console.error(err);
      setErro(t("accessRequest.errors.send"));
    } finally {
      setEnviando(false);
    }
  }

  if (loading) return <Tela><div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-red-600" /></div></Tela>;
  if (!user) return <Navigate to="/login" replace />;
  if (userData) return <Navigate to="/app" replace />;
  if (pedido === undefined || convite === undefined) return <Tela><div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-red-600" /></div></Tela>;

  const rodape = (
    <button type="button" onClick={logout} className="mt-6 w-full flex items-center justify-center gap-2 text-xs font-bold text-zinc-500 hover:text-white uppercase tracking-widest">
      <LogOut className="w-4 h-4" /> {t("accessRequest.logout", { email: user.email })}
    </button>
  );

  // ===== MENTOR CADASTRADO PELO ADMIN =====
  if (convite) {
    return (
      <Tela>
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-blue-500" />
          </div>
          <h2 className="text-xl font-black text-white">{t("accessRequest.invite.title", { name: convite.nome })}</h2>
          <p className="text-sm text-zinc-400">{t("accessRequest.invite.desc")}</p>
          <div className="text-left bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm space-y-1">
            <p><span className="text-zinc-500">{t("accessRequest.fields.name")}:</span> <b>{convite.nome}</b></p>
            <p><span className="text-zinc-500">{t("accessRequest.fields.phone")}:</span> <b>{convite.telefone}</b></p>
            <p><span className="text-zinc-500">{t("accessRequest.fields.role")}:</span> <b>{t("accessRequest.invite.role")}</b></p>
          </div>
          {erro && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs font-medium flex items-center gap-2 text-left">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {erro}
            </div>
          )}
          <button type="button" onClick={aceitarConvite} disabled={aceitando} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-sm py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
            {aceitando ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} {t("accessRequest.invite.enter")}
          </button>
        </div>
        {rodape}
      </Tela>
    );
  }

  // ===== AGUARDANDO APROVAÇÃO =====
  if (!precisaFormulario) {
    return (
      <Tela>
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-black text-white">{t("accessRequest.waiting.title")}</h2>
          <p className="text-sm text-zinc-400">{t("accessRequest.waiting.desc")}</p>
          <div className="text-left bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm space-y-1">
            <p><span className="text-zinc-500">{t("accessRequest.fields.name")}:</span> <b>{pedido.nome}</b></p>
            <p><span className="text-zinc-500">{t("accessRequest.fields.phone")}:</span> <b>{pedido.telefone}</b></p>
            <p><span className="text-zinc-500">{t("accessRequest.fields.unit")}:</span> <b>{pedido.unidadeNome}</b></p>
            <p><span className="text-zinc-500">{t("accessRequest.fields.role")}:</span> <b>{t("accessRequest.leader")}</b></p>
          </div>
          <button type="button" onClick={() => setEditando(true)} className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white uppercase tracking-widest">
            <Pencil className="w-4 h-4" /> {t("accessRequest.waiting.edit")}
          </button>
        </div>
        {rodape}
      </Tela>
    );
  }

  // ===== FORMULÁRIO (1º pedido, pedido recusado ou editando) =====
  const campo = "w-full bg-zinc-900/50 border border-zinc-700 text-white font-bold pl-11 pr-4 py-3 rounded-xl focus:border-red-600 outline-none placeholder:text-zinc-600 placeholder:font-normal";
  return (
    <Tela>
      <h2 className="text-xl font-black text-white text-center">{t("accessRequest.form.title")}</h2>
      <p className="text-sm text-zinc-400 text-center mt-2 mb-6">{t("accessRequest.form.desc")}</p>

      {pedido?.status === "recusado" && !editando && (
        <div className="mb-5 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <b>{t("accessRequest.refused.title")}</b>
            {pedido.motivo && <p className="mt-1">{t("accessRequest.refused.reason", { reason: pedido.motivo })}</p>}
            <p className="mt-1 text-red-300/80">{t("accessRequest.refused.retry")}</p>
          </div>
        </div>
      )}

      <form onSubmit={enviar} className="space-y-4">
        <div>
          <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">{t("accessRequest.fields.name")}</label>
          <div className="relative">
            <User className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
            <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} className={campo} placeholder={t("accessRequest.fields.namePlaceholder")} />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">{t("accessRequest.fields.phone")}</label>
          <div className="relative">
            <Phone className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={30} inputMode="tel" className={campo} placeholder={t("accessRequest.fields.phonePlaceholder")} />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">{t("accessRequest.fields.unitLeader")}</label>
          {unidades === null ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-3"><Loader2 className="w-4 h-4 animate-spin" /> {t("accessRequest.loadingUnits")}</div>
          ) : unidades.length === 0 ? (
            <p className="text-sm text-amber-400 py-2">{t("accessRequest.noUnits")}</p>
          ) : (
            <>
              <div className="relative mb-2">
                <Search className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
                <input value={buscaUnidade} onChange={(e) => setBuscaUnidade(e.target.value)} className={campo} placeholder={t("accessRequest.fields.unitSearch")} />
              </div>
              <div className="relative">
                <Building2 className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500 pointer-events-none" />
                <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)} className={`${campo} appearance-none`}>
                  <option value="">{t("accessRequest.fields.unitSelect")}</option>
                  {unidadesFiltradas.map((u) => (
                    <option key={u.id} value={u.id}>{u.nome}{u.estado ? ` — ${u.estado}` : ""}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        {erro && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {erro}
          </div>
        )}

        <button type="submit" disabled={enviando || !unidades?.length} className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase text-sm py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
          {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />} {t("accessRequest.form.send")}
        </button>
        {editando && (
          <button type="button" onClick={() => setEditando(false)} className="w-full text-xs font-bold text-zinc-500 hover:text-white uppercase tracking-widest">
            {t("accessRequest.form.cancelEdit")}
          </button>
        )}
      </form>
      {rodape}
    </Tela>
  );
}

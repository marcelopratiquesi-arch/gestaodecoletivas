// Tela OBRIGATÓRIA de quem ainda entra com o login antigo (e-mail e senha): líder, login de unidade e mentor.
// A pessoa confirma nome e WhatsApp e conecta a conta Google dela. A partir daí:
//   - só entra pelo Google (a senha antiga é removida da conta, então o login antigo deixa de existir);
//   - o login de UNIDADE vira o login pessoal do LÍDER daquela unidade (mesma conta, papel "lider"),
//     e a unidade fica marcada "a conferir" para o mentor/admin confirmar quem assumiu.
// Enquanto não concluir, a pessoa não vê nenhuma tela do sistema (ver PrivateRoute).
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { GoogleAuthProvider, linkWithPopup, unlink } from "firebase/auth";
import { addDoc, collection, doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { Loader2, LogOut, Building2, Phone, User, AlertTriangle, ShieldCheck } from "lucide-react";
import { auth, db } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import { ehLider } from "../permissions";

const temGoogle = (u) => (u?.providerData || []).some((p) => p.providerId === "google.com");
const emailDoGoogle = (u) => (u?.providerData || []).find((p) => p.providerId === "google.com")?.email || "";

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

const Carregando = () => (
  <Tela><div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-red-600" /></div></Tela>
);

export default function AtualizarCadastro() {
  const { t } = useTranslation();
  const { user, userData, loading, logout, recarregarCracha, precisaAtualizarCadastro } = useAuth();

  const role = String(userData?.role || "").trim().toLowerCase();
  const souLider = ehLider(role);
  const eraLoginDeUnidade = role === "unidade"; // o "nome" desse crachá é o nome da unidade, não o da pessoa
  const uid = user?.uid;
  const unidadeId = souLider ? userData?.unidadeId : null;

  const [unidade, setUnidade] = useState(undefined); // undefined = carregando; null = não encontrada
  // Esta pessoa é o 2º líder da unidade (a unidade pode ter 2 líderes; ver aba Líderes).
  const souSegundoLider = souLider && !!uid && unidade?.lider2Uid === uid;
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Líder: confere a unidade (1 leitura) para mostrar o nome e saber se ela já tem outro líder.
  useEffect(() => {
    if (!uid || !precisaAtualizarCadastro || !souLider) return;
    if (!unidadeId) { setUnidade(null); return; }
    let vivo = true;
    getDoc(doc(db, "unidades", String(unidadeId)))
      .then((snap) => { if (vivo) setUnidade(snap.exists() ? { id: snap.id, ...snap.data() } : null); })
      .catch((e) => { console.error(e); if (vivo) setUnidade(null); });
    return () => { vivo = false; };
  }, [uid, precisaAtualizarCadastro, souLider, unidadeId]);

  // Mentor e líder já cadastrado com nome próprio: o formulário já vem preenchido.
  useEffect(() => {
    if (!userData || eraLoginDeUnidade) return;
    setNome((v) => v || userData.nome || "");
    setTelefone((v) => v || userData.telefone || "");
  }, [userData, eraLoginDeUnidade]);

  async function concluir(e) {
    e.preventDefault();
    setErro("");
    const nomeLimpo = nome.trim();
    const telefoneLimpo = telefone.trim();
    if (nomeLimpo.length < 3) return setErro(t("updateProfile.errors.name"));
    if (telefoneLimpo.replace(/\D/g, "").length < 8) return setErro(t("updateProfile.errors.phone"));

    setSalvando(true);
    try {
      // 1) Conecta o Google à MESMA conta (se já conectou numa tentativa anterior, pula).
      let conta = auth.currentUser;
      if (!temGoogle(conta)) {
        const provedor = new GoogleAuthProvider();
        provedor.setCustomParameters({ prompt: "select_account" });
        conta = (await linkWithPopup(conta, provedor)).user;
      }
      await conta.getIdToken(true); // o banco só aceita a atualização com o Google já conectado
      const email = emailDoGoogle(conta) || conta.email || "";
      const emailAntigo = userData.email || userData.emailAuth || "";

      // 2) Atualiza o crachá e, se for líder, o cadastro da unidade (tudo junto ou nada).
      const assumindoAgora = souLider && !souSegundoLider && unidade?.liderUid !== uid;
      const batch = writeBatch(db);
      batch.update(doc(db, "usuarios", uid), {
        nome: nomeLimpo, telefone: telefoneLimpo, email, loginGoogle: true, cadastroAtualizadoEm: serverTimestamp(),
        ...(eraLoginDeUnidade ? { role: "lider" } : {}),
        ...(emailAntigo && emailAntigo !== email ? { emailAntigo } : {}),
      });
      if (souSegundoLider) {
        // 2º líder da unidade: só atualiza o contato dele (o 1º líder continua o mesmo).
        batch.update(doc(db, "unidades", unidade.id), {
          lider2Nome: nomeLimpo, lider2Email: email, lider2Telefone: telefoneLimpo, lider2Tipo: "google",
        });
      } else if (souLider) {
        batch.update(doc(db, "unidades", unidade.id), {
          liderUid: uid, liderNome: nomeLimpo, liderEmail: email, liderTelefone: telefoneLimpo, liderTipo: "google",
          ...(assumindoAgora ? { liderDesde: serverTimestamp(), liderAConferir: true } : {}),
          // O login antigo da unidade É esta conta: ele deixa de existir (agora é o login pessoal do líder).
          ...(unidade.uidLogin === uid ? { loginAntigoDesligado: true, loginAntigoDesligadoEm: serverTimestamp() } : {}),
        });
      }
      await batch.commit();

      try {
        await addDoc(collection(db, "auditoria_configuracoes"), {
          tipoAcao: "ALTERADA", modulo: "CONFIGURACOES",
          descricao: souLider
            ? "Login antigo trocado pelo login pessoal do líder (Google)."
            : "Mentor atualizou o cadastro e passou a entrar pelo Google.",
          diffExtras: `${emailAntigo || "-"} ➔ ${nomeLimpo} (${email}) | ${telefoneLimpo}`,
          unidadeNome: unidade?.nome || "-", usuarioAcaoNome: nomeLimpo, usuarioAcaoId: uid, dataAcao: serverTimestamp(),
        });
      } catch (logErro) { console.error("Falha ao gravar auditoria", logErro); }

      // 3) Remove a senha antiga da conta: o login antigo para de funcionar.
      //    (Se falhar aqui, o sistema tenta de novo sozinho no próximo acesso.)
      try { await unlink(conta, "password"); } catch (e2) { console.error("Não foi possível remover a senha antiga:", e2); }

      await recarregarCracha(); // crachá atualizado: esta tela sai sozinha e abre o sistema
    } catch (err) {
      console.error(err);
      const code = err?.code || "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") { /* desistiu: fica na tela */ }
      else if (code === "auth/popup-blocked") setErro(t("updateProfile.errors.popupBlocked"));
      else if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") setErro(t("updateProfile.errors.googleInUse"));
      else if (code === "auth/operation-not-allowed" || code === "auth/unauthorized-domain") setErro(t("updateProfile.errors.notEnabled"));
      else setErro(t("updateProfile.errors.save"));
    } finally {
      setSalvando(false);
    }
  }

  if (loading) return <Carregando />;
  if (!user || !userData) return <Navigate to="/login" replace />;
  if (!precisaAtualizarCadastro) return <Navigate to="/app" replace />;
  if (souLider && unidade === undefined) return <Carregando />;

  const rodape = (
    <button type="button" onClick={logout} disabled={salvando} className="mt-6 w-full flex items-center justify-center gap-2 text-xs font-bold text-zinc-500 hover:text-white uppercase tracking-widest">
      <LogOut className="w-4 h-4" /> {t("updateProfile.logout", { email: user.email })}
    </button>
  );

  // Líder sem unidade válida, ou unidade que já tem OUTRO líder: este login não segue adiante.
  const outroLider = souLider && unidade && unidade.liderUid && unidade.liderUid !== uid && !souSegundoLider;
  if (souLider && (unidade === null || outroLider)) {
    return (
      <Tela>
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-black text-white">
            {outroLider ? t("updateProfile.blocked.hasLeaderTitle") : t("updateProfile.blocked.noUnitTitle")}
          </h2>
          <p className="text-sm text-zinc-400">
            {outroLider
              ? t("updateProfile.blocked.hasLeaderDesc", { unit: unidade.nome, name: unidade.liderNome || unidade.liderEmail || "-" })
              : t("updateProfile.blocked.noUnitDesc")}
          </p>
        </div>
        {rodape}
      </Tela>
    );
  }

  const campo = "w-full bg-zinc-900/50 border border-zinc-700 text-white font-bold pl-11 pr-4 py-3 rounded-xl focus:border-red-600 outline-none placeholder:text-zinc-600 placeholder:font-normal";
  return (
    <Tela>
      <h2 className="text-xl font-black text-white text-center">
        {souLider ? t("updateProfile.leader.title") : t("updateProfile.mentor.title")}
      </h2>
      <p className="text-sm text-zinc-400 text-center mt-2 mb-6">
        {souLider ? t("updateProfile.leader.desc") : t("updateProfile.mentor.desc")}
      </p>

      {souLider && (
        <div className="mb-5 p-4 rounded-2xl border border-zinc-800 bg-zinc-900 text-sm flex items-center gap-3">
          <Building2 className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase">{t("updateProfile.fields.unitLeader")}</p>
            <p className="font-black text-white uppercase">{unidade.nome}</p>
          </div>
        </div>
      )}

      <form onSubmit={concluir} className="space-y-4">
        <div>
          <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">{t("updateProfile.fields.name")}</label>
          <div className="relative">
            <User className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
            <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} disabled={salvando} className={campo} placeholder={t("updateProfile.fields.namePlaceholder")} />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">{t("updateProfile.fields.phone")}</label>
          <div className="relative">
            <Phone className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={30} inputMode="tel" disabled={salvando} className={campo} placeholder={t("updateProfile.fields.phonePlaceholder")} />
          </div>
        </div>

        <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 text-xs text-zinc-400 flex gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <span>{t("updateProfile.googleHint")}</span>
        </div>

        {erro && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {erro}
          </div>
        )}

        <button type="submit" disabled={salvando} className="w-full bg-white hover:bg-zinc-100 text-zinc-800 font-black text-sm py-4 rounded-xl flex items-center justify-center gap-3 disabled:opacity-60">
          {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"/>
            </svg>
          )}
          {t("updateProfile.submit")}
        </button>
      </form>
      {rodape}
    </Tela>
  );
}

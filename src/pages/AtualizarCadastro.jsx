// Tela OBRIGATÓRIA de quem ainda entra com o login antigo (e-mail e senha): líder, login de unidade e mentor.
// Passos: Aviso → Função (a pessoa confirma quem ela é) → Seus dados → Conta Google → Pronto.
// Ao concluir:
//   - só entra pelo Google (a senha antiga é removida da conta, então o login antigo deixa de existir);
//   - o login de UNIDADE vira o login pessoal do LÍDER daquela unidade (mesma conta, papel "lider"),
//     e a unidade fica marcada "a conferir" para o mentor/admin confirmar quem assumiu.
// Quem responde "não sou mais da unidade" / "não sou mais mentor" confirma a saída: o acesso é desligado NA HORA
// (ver Configuracoes/Lideres/saidaDaFuncao.js), a unidade fica sem líder e o mentor (ou o admin) é avisado em
// Pendências, onde pode desfazer. Líder que também é professor pode sair só da liderança e continuar professor.
// Líder que também comanda OUTRAS unidades escolhe no filtro do passo "Seus dados": cada uma vira um pedido
// (pedidos_unidade) que o mentor daquela unidade aprova em Pendências (ver Lideres/pedidoOutraUnidade.js).
// "Agora só dou aulas" ainda não tem acesso pessoal (vem numa etapa futura): a tela orienta a falar com o mentor.
// Enquanto não concluir, a pessoa não vê nenhuma tela do sistema (ver PrivateRoute).
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { GoogleAuthProvider, linkWithPopup, unlink } from "firebase/auth";
import { addDoc, collection, doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { Loader2, LogOut, Phone, User, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { auth, db } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useCatalogs } from "../contexts/CatalogContext";
import { ehLider, unidadesDoLider } from "../permissions";
import { professorLigadoAoLogin, sairDaFuncao } from "../app/Configuracoes/Lideres/saidaDaFuncao";
import { pedirOutrasUnidades, MAX_UNIDADES_EXTRAS } from "../app/Configuracoes/Lideres/pedidoOutraUnidade";
import {
  FundoAcesso, Marca, Passos, CartaoEscolha, FuncaoEscolhida, SeletorUnidades, CaixaAjuda, BotaoVermelho, BotaoLink, IconeGoogle, classeRotulo,
} from "../components/acesso/AcessoUI";
import { useUnidadesPublicas } from "../components/acesso/acessoDados";

const temGoogle = (u) => (u?.providerData || []).some((p) => p.providerId === "google.com");
const emailDoGoogle = (u) => (u?.providerData || []).find((p) => p.providerId === "google.com")?.email || "";

const Carregando = () => (
  <FundoAcesso><Marca compacta /><div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-red-600" /></div></FundoAcesso>
);

export default function AtualizarCadastro() {
  const { t } = useTranslation();
  const { user, userData, loading, logout, recarregarCracha, precisaAtualizarCadastro } = useAuth();
  const { catalogs } = useCatalogs();

  const role = String(userData?.role || "").trim().toLowerCase();
  const souLider = ehLider(role);
  const eraLoginDeUnidade = role === "unidade"; // o "nome" desse crachá é o nome da unidade, não o da pessoa
  const perfil = eraLoginDeUnidade ? "unit" : souLider ? "leader" : "mentor";
  const uid = user?.uid;
  const unidadeId = souLider ? userData?.unidadeId : null;

  const [unidade, setUnidade] = useState(undefined); // undefined = carregando; null = não encontrada
  // Esta pessoa é o 2º líder da unidade (a unidade pode ter 2 líderes; ver aba Líderes).
  const souSegundoLider = souLider && !!uid && unidade?.lider2Uid === uid;
  const [passo, setPasso] = useState("aviso"); // aviso | funcao | dados | google | pronto
  const [resposta, setResposta] = useState(""); // "segue" = continua na função; "professor" | "saiu" = não segue
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [emailFinal, setEmailFinal] = useState("");
  const [saidaTipo, setSaidaTipo] = useState(""); // líder que também é professor: "professor" | "tudo"
  const [saiu, setSaiu] = useState(""); // depois de confirmar a saída: "bloqueado" | "professor" | "mentor"

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

  // Líder que também comanda OUTRAS unidades: escolhe no filtro; cada uma vira um pedido para o mentor dela (Pendências).
  const [extrasIds, setExtrasIds] = useState([]);
  const unidadesPublicas = useUnidadesPublicas(precisaAtualizarCadastro && souLider && passo === "dados");
  const jaLidera = souLider ? unidadesDoLider(userData) : [];
  const unidadesParaPedir = unidadesPublicas ? unidadesPublicas.filter((u) => !jaLidera.includes(u.id)) : null;

  // Mentor e líder já cadastrado com nome próprio: o formulário já vem preenchido.
  useEffect(() => {
    if (!userData) return;
    if (!eraLoginDeUnidade) setNome((v) => v || userData.nome || "");
    setTelefone((v) => v || userData.telefone || "");
  }, [userData, eraLoginDeUnidade]);

  // Líder que também é professor (cadastro de professor ligado a este login): pode continuar como professor.
  const professorId = souLider && !eraLoginDeUnidade ? professorLigadoAoLogin(uid, catalogs?.professores || []) : null;

  async function confirmarSaida() {
    setErro("");
    if (professorId && !saidaTipo) return setErro(t("updateProfile.exit.professorQ"));
    setSalvando(true);
    try {
      const resultado = await sairDaFuncao({
        uid, cracha: userData, email: userData.email || userData.emailAuth || user.email || "",
        unidades: catalogs?.unidades || [], professores: catalogs?.professores || [],
        continuaProfessor: !!professorId && saidaTipo === "professor",
      });
      setSaiu(resultado);
    } catch (e) {
      console.error(e);
      setErro(t("updateProfile.exit.error"));
    } finally {
      setSalvando(false);
    }
  }

  async function concluir() {
    setErro("");
    const nomeLimpo = nome.trim();
    const telefoneLimpo = telefone.trim();
    if (nomeLimpo.length < 3) { setPasso("dados"); return setErro(t("updateProfile.errors.name")); }
    if (telefoneLimpo.replace(/\D/g, "").length < 8) { setPasso("dados"); return setErro(t("updateProfile.errors.phone")); }

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
      // Pedidos de outras unidades (só quem é líder): o mentor de cada uma aprova em Pendências.
      if (souLider && extrasIds.length) {
        const nomes = Object.fromEntries((unidadesPublicas || []).map((u) => [u.id, u.nome]));
        pedirOutrasUnidades(batch, {
          uid, nome: nomeLimpo, email, telefone: telefoneLimpo, unidadeIds: extrasIds, nomes,
          atuais: unidadesDoLider(userData).map((id) => (catalogs?.unidades || []).find((u) => u.id === id)?.nome || (id === unidade?.id ? unidade.nome : id)),
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

      // 4) Mostra "Pronto"; o botão "Entrar no sistema" recarrega o crachá e abre o sistema.
      setEmailFinal(email);
      setPasso("pronto");
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

  const loginAntigo = userData.email || userData.emailAuth || user.email || "";
  const nomesUnidades = souLider
    ? unidadesDoLider(userData).map((id) => (catalogs?.unidades || []).find((u) => u.id === id)?.nome || (id === unidade?.id ? unidade.nome : id))
    : [];
  const mentorDaUnidade = unidade?.mentorId ? (catalogs?.mentores || []).find((m) => m.id === unidade.mentorId)?.nome : "";
  const ajuda = <CaixaAjuda mentores={perfil === "mentor" ? [] : [mentorDaUnidade]} />;
  const etapas = [t("updateProfile.steps.role"), t("updateProfile.steps.data"), t("updateProfile.steps.google"), t("updateProfile.steps.done")];
  const sair = (
    <BotaoLink onClick={logout} disabled={salvando}><LogOut className="w-4 h-4" /> {t("updateProfile.logout", { email: user.email })}</BotaoLink>
  );
  const textoFuncao = perfil === "mentor"
    ? t("access.roles.mentor.name")
    : `${t("access.roles.lider.name")} · ${unidade?.nome || ""}`;
  const erroBox = erro && (
    <div className="p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs font-medium flex items-center gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0" /> {erro}
    </div>
  );

  // Saída registrada: o acesso já foi desligado. O botão recarrega o crachá (quem ficou sem acesso é desconectado).
  if (saiu) {
    return (
      <FundoAcesso>
        <Marca compacta />
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-black text-white">{t("updateProfile.exit.doneTitle")}</h2>
          <p className="text-sm text-zinc-400">{t(saiu === "professor" ? "updateProfile.exit.doneProfessor" : "updateProfile.exit.doneBlocked")}</p>
          <BotaoVermelho type="button" onClick={() => recarregarCracha()}>{t("updateProfile.exit.doneButton")}</BotaoVermelho>
        </div>
      </FundoAcesso>
    );
  }

  // Líder sem unidade válida, ou unidade que já tem OUTRO líder: este login não segue adiante.
  const outroLider = souLider && unidade && unidade.liderUid && unidade.liderUid !== uid && !souSegundoLider;
  if (souLider && (unidade === null || outroLider)) {
    return (
      <FundoAcesso>
        <Marca compacta />
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
          {sair}
        </div>
        {ajuda}
      </FundoAcesso>
    );
  }

  // ===== 1. AVISO =====
  if (passo === "aviso") {
    return (
      <FundoAcesso>
        <Marca compacta />
        <Passos etapas={etapas} atual={0} />
        <h2 className="text-xl font-black text-white text-center text-balance">{t("updateProfile.notice.title")}</h2>
        <p className="text-sm text-zinc-400 text-center mt-1.5 mb-5">{t("updateProfile.notice.desc")}</p>
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs mb-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{t("updateProfile.notice.oldLogin")}</span>
          <b className="text-white break-all">{loginAntigo}</b>
          {unidade?.nome && <span className="text-zinc-400">{unidade.nome}</span>}
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs text-zinc-400 leading-relaxed mb-5">
          <b className="text-white">{t("updateProfile.notice.changesTitle")}</b>
          <ul className="list-disc pl-4 mt-1.5 space-y-0.5">
            <li>{t("updateProfile.notice.change1")}</li>
            <li>{t("updateProfile.notice.change2")}</li>
            <li>{t("updateProfile.notice.change3")}</li>
          </ul>
        </div>
        <div className="space-y-2">
          <BotaoVermelho type="button" onClick={() => setPasso("funcao")}>{t("updateProfile.notice.start")}</BotaoVermelho>
          {sair}
        </div>
        {ajuda}
      </FundoAcesso>
    );
  }

  // ===== 2. CONFIRMAR A FUNÇÃO =====
  if (passo === "funcao") {
    const opcoes = perfil === "mentor" ? ["segue", "saiu"] : ["segue", "professor", "saiu"];
    const saindo = resposta === "saiu";
    const naoSegue = resposta && resposta !== "segue" && !saindo; // "professor": só orienta, não muda a conta
    return (
      <FundoAcesso>
        <Marca compacta />
        <Passos etapas={etapas} atual={0} />
        <h2 className="text-xl font-black text-white text-center text-balance">
          {t(`updateProfile.role.${perfil}.question`, { unit: unidade?.nome || "" })}
        </h2>
        <p className="text-sm text-zinc-400 text-center mt-1.5 mb-5">{t("updateProfile.role.desc")}</p>
        <div className="space-y-2.5">
          {opcoes.map((op) => (
            <CartaoEscolha
              key={op} ativo={resposta === op} onClick={() => setResposta(op)}
              titulo={t(`updateProfile.role.${perfil}.${op}`)} descricao={t(`updateProfile.role.${perfil}.${op}Desc`)}
            />
          ))}
        </div>
        {saindo && (
          <div className="mt-4 space-y-3">
            <div className="flex gap-2 text-xs leading-relaxed text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <span>
                {t(perfil === "mentor" ? "updateProfile.exit.mentorWarn" : "updateProfile.exit.leaderWarn")}
                {perfil !== "mentor" && nomesUnidades.length > 1 && <> {t("updateProfile.exit.manyUnits", { units: nomesUnidades.join(", ") })}</>}
              </span>
            </div>
            {professorId && (
              <div className="space-y-2">
                <p className="text-sm font-bold text-white">{t("updateProfile.exit.professorQ")}</p>
                <CartaoEscolha ativo={saidaTipo === "professor"} onClick={() => setSaidaTipo("professor")}
                  titulo={t("updateProfile.exit.keepProfessor")} descricao={t("updateProfile.exit.keepProfessorDesc")} />
                <CartaoEscolha ativo={saidaTipo === "tudo"} onClick={() => setSaidaTipo("tudo")}
                  titulo={t("updateProfile.exit.leaveAll")} descricao={t("updateProfile.exit.leaveAllDesc")} />
              </div>
            )}
            {erroBox}
            <BotaoVermelho type="button" disabled={salvando || (!!professorId && !saidaTipo)} onClick={confirmarSaida}>
              {salvando ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t("updateProfile.exit.confirm")}
            </BotaoVermelho>
          </div>
        )}
        {naoSegue && (
          <div className="mt-4 flex gap-2 text-xs leading-relaxed text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <span>{t(`updateProfile.role.stop.${resposta}${perfil === "mentor" ? "Mentor" : ""}`)}</span>
          </div>
        )}
        <div className="mt-5 space-y-2">
          {!naoSegue && !saindo && (
            <BotaoVermelho type="button" disabled={!resposta} onClick={() => setPasso("dados")}>{t("access.continue")}</BotaoVermelho>
          )}
          {naoSegue ? sair : saindo ? <BotaoLink onClick={() => { setResposta(""); setErro(""); }} disabled={salvando}>{t("access.back")}</BotaoLink> : <BotaoLink onClick={() => setPasso("aviso")}>{t("access.back")}</BotaoLink>}
        </div>
        {ajuda}
      </FundoAcesso>
    );
  }

  // ===== 3. SEUS DADOS =====
  const campo = "w-full bg-zinc-900/50 border border-zinc-700 text-white font-bold pl-11 pr-4 py-3 rounded-xl focus:border-red-600 outline-none placeholder:text-zinc-600 placeholder:font-normal";
  if (passo === "dados") {
    return (
      <FundoAcesso>
        <Marca compacta />
        <Passos etapas={etapas} atual={1} />
        <h2 className="text-xl font-black text-white text-center">{t("updateProfile.data.title")}</h2>
        <p className="text-sm text-zinc-400 text-center mt-1.5 mb-5">{t("updateProfile.data.desc")}</p>
        <FuncaoEscolhida texto={textoFuncao} onTrocar={() => setPasso("funcao")} />
        <form onSubmit={(e) => {
          e.preventDefault();
          setErro("");
          if (nome.trim().length < 3) return setErro(t("updateProfile.errors.name"));
          if (telefone.replace(/\D/g, "").length < 8) return setErro(t("updateProfile.errors.phone"));
          setPasso("google");
        }} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="atu-nome" className={classeRotulo}>{t("updateProfile.fields.name")}</label>
            <div className="relative">
              <User className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
              <input id="atu-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} className={campo} placeholder={t("updateProfile.fields.namePlaceholder")} />
            </div>
            {eraLoginDeUnidade && <p className="text-[11px] text-zinc-500 ml-1">{t("updateProfile.data.unitNameHint")}</p>}
          </div>
          <div className="space-y-1">
            <label htmlFor="atu-telefone" className={classeRotulo}>{t("updateProfile.fields.phone")}</label>
            <div className="relative">
              <Phone className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
              <input id="atu-telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={30} inputMode="tel" className={campo} placeholder={t("updateProfile.fields.phonePlaceholder")} />
            </div>
          </div>
          {souLider && (
            <div className="space-y-1.5">
              <span className={classeRotulo}>{t("updateProfile.fields.unitsLeader")}</span>
              <div className="flex flex-wrap gap-1.5">
                {nomesUnidades.map((n) => (
                  <span key={n} className="inline-flex rounded-full border border-red-600 bg-red-600/10 text-red-100 text-xs font-bold px-2.5 py-1">{n}</span>
                ))}
              </div>
            </div>
          )}
          {souLider && (
            <div className="space-y-1">
              <SeletorUnidades
                unidades={unidadesParaPedir} selecionadas={extrasIds} onChange={setExtrasIds} max={MAX_UNIDADES_EXTRAS}
                rotulo={t("updateProfile.data.moreUnitsLabel")}
              />
              <p className="text-[11px] text-zinc-500 ml-1">{t("updateProfile.data.moreUnitsHint")}</p>
            </div>
          )}
          {erroBox}
          <BotaoVermelho type="submit">{t("access.continue")}</BotaoVermelho>
          <BotaoLink onClick={() => setPasso("funcao")}>{t("access.back")}</BotaoLink>
        </form>
        {ajuda}
      </FundoAcesso>
    );
  }

  // ===== 4. CONTA GOOGLE =====
  if (passo === "google") {
    return (
      <FundoAcesso>
        <Marca compacta />
        <Passos etapas={etapas} atual={2} />
        <h2 className="text-xl font-black text-white text-center">{t("updateProfile.google.title")}</h2>
        <p className="text-sm text-zinc-400 text-center mt-1.5 mb-5">{t("updateProfile.google.desc")}</p>
        <FuncaoEscolhida texto={textoFuncao} onTrocar={salvando ? undefined : () => setPasso("funcao")} />
        <div className="text-xs leading-relaxed text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5 mb-3 break-words">
          {t("updateProfile.google.warning", { login: loginAntigo })}
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs text-zinc-400 leading-relaxed mb-5">
          {t("updateProfile.google.hint")}
        </div>
        {erroBox}
        <div className="space-y-2">
          <button type="button" onClick={concluir} disabled={salvando} className="w-full bg-white hover:bg-zinc-100 text-zinc-800 font-black text-sm py-4 rounded-xl flex items-center justify-center gap-3 disabled:opacity-60">
            {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : <IconeGoogle />}
            {t("updateProfile.submit")}
          </button>
          <BotaoLink onClick={() => setPasso("dados")} disabled={salvando}>{t("access.back")}</BotaoLink>
        </div>
        {ajuda}
      </FundoAcesso>
    );
  }

  // ===== 5. PRONTO =====
  return (
    <FundoAcesso>
      <Marca compacta />
      <Passos etapas={etapas} atual={3} />
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-xl font-black text-white">{t("updateProfile.done.title")}</h2>
        <p className="text-sm text-zinc-400">{t("updateProfile.done.desc")}</p>
        <div className="text-left bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm space-y-1">
          <p><span className="text-zinc-500">{t("updateProfile.fields.name")}:</span> <b>{nome.trim()}</b></p>
          <p><span className="text-zinc-500">{t("updateProfile.fields.phone")}:</span> <b>{telefone.trim()}</b></p>
          <p><span className="text-zinc-500">{t("access.role")}:</span> <b>{textoFuncao}</b></p>
          <p className="break-all"><span className="text-zinc-500">{t("updateProfile.done.login")}:</span> <b>{emailFinal}</b></p>
        </div>
        {extrasIds.length > 0 && (
          <div className="text-left text-xs text-zinc-300 bg-blue-500/10 border border-blue-500/30 rounded-xl px-3 py-2.5">
            {t("updateProfile.done.extraRequested")}
          </div>
        )}
        {eraLoginDeUnidade && (
          <div className="text-left text-xs text-zinc-300 bg-blue-500/10 border border-blue-500/30 rounded-xl px-3 py-2.5">
            {t("updateProfile.done.mentorChecks", { unit: unidade?.nome || "" })}
          </div>
        )}
        <BotaoVermelho type="button" onClick={() => recarregarCracha()}>{t("updateProfile.done.enter")}</BotaoVermelho>
      </div>
    </FundoAcesso>
  );
}

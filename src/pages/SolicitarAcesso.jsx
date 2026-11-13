// Tela de quem entrou pelo Google e ainda não tem acesso aprovado (primeiro acesso).
// Passos: Função (líder ou mentor) → [Google, já feito] → Seus dados → Aprovação.
// - Líder: escolhe até 5 unidades no filtro e diz se também dá aulas. Aprova: mentor da unidade ou admin.
// - Mentor: escolhe as unidades que acompanha. Aprova: só o admin.
// O pedido fica em solicitacoes_acesso/{uid}; aprovado, a tela abre o sistema sozinha.
// A lista de unidades vem da vitrine pública (só nome, cidade, estado e nome do mentor).
// Mentor cadastrado pelo admin com este e-mail do Google (convites_acesso/{e-mail}): em vez do pedido,
// aparece "Entrar como mentor" — o cadastro feito pelo admin já é a aprovação (regra mentorAceitaConvite).
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { doc, getDoc, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { Loader2, Clock, LogOut, Phone, User, Send, AlertTriangle, Pencil, ShieldCheck } from "lucide-react";
import { db } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import { registrarAuditoriaAcesso } from "../services/auditoriaAcessos";
import {
  FundoAcesso, Marca, Passos, CartaoEscolha, FuncaoEscolhida, SeletorUnidades, CaixaAjuda, BotaoVermelho, BotaoLink,
  classeRotulo, MAX_UNIDADES_PEDIDO,
} from "../components/acesso/AcessoUI";
import CampoDocumento from "../components/acesso/CampoDocumento";
import { documentoValido, formatarDocumento, tipoDocumentoPadrao } from "../utils/documento";
import { documentoNoLote, gravarComAviso, lerDocumentoDoPedido, ERRO_DOCUMENTO_EM_USO } from "../services/documentoService";
import { ICONE_FUNCAO, useUnidadesPublicas, lerPapelPedido, guardarPapelPedido, FUNCOES_PEDIDO } from "../components/acesso/acessoDados";

const Carregando = () => (
  <FundoAcesso><Marca compacta /><div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-red-600" /></div></FundoAcesso>
);

// Unidades do pedido (pedido antigo só tem unidadeId).
const idsDoPedido = (p) => (Array.isArray(p?.unidadeIds) && p.unidadeIds.length ? p.unidadeIds : p?.unidadeId ? [p.unidadeId] : []);

export default function SolicitarAcesso() {
  const { t } = useTranslation();
  const { user, userData, loading, logout, recarregarCracha } = useAuth();

  const [pedido, setPedido] = useState(undefined); // undefined = carregando; null = ainda não pediu
  const [convite, setConvite] = useState(undefined); // convite de mentor pendente para este e-mail (null = não tem)
  const [aceitando, setAceitando] = useState(false);
  const [editando, setEditando] = useState(false);

  const [papel, setPapel] = useState(""); // "lider" | "mentor"; vazio = ainda não escolheu
  const [escolhendoPapel, setEscolhendoPapel] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [unidadeIds, setUnidadeIds] = useState([]);
  const [tambemProfessor, setTambemProfessor] = useState(false);
  const [docTipo, setDocTipo] = useState(() => tipoDocumentoPadrao(i18n.language));
  const [docNumero, setDocNumero] = useState("");
  const [docAnterior, setDocAnterior] = useState(null); // documento do pedido anterior (se refizer o pedido)
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

  const precisaFormulario = pedido === null || pedido?.status === "recusado" || editando;
  const unidades = useUnidadesPublicas(precisaFormulario || !!pedido);
  const porId = useMemo(() => new Map((unidades || []).map((u) => [u.id, u])), [unidades]);

  // Pedido anterior (recusado ou em edição): traz o documento que já tinha informado.
  useEffect(() => {
    if (!precisaFormulario || !uid || !pedido) return;
    lerDocumentoDoPedido(uid).then((d) => {
      if (!d) return;
      setDocAnterior(d);
      setDocTipo((v) => d.tipo || v);
      setDocNumero((v) => v || formatarDocumento(d.tipo, d.numero));
    }).catch((e) => console.error(e));
  }, [precisaFormulario, uid, pedido]);

  // Preenche o formulário com o pedido anterior (ou com o nome da conta Google e a função escolhida no login).
  useEffect(() => {
    if (!precisaFormulario) return;
    setNome((n) => n || pedido?.nome || user?.displayName || "");
    setTelefone((v) => v || pedido?.telefone || "");
    setUnidadeIds((v) => (v.length ? v : idsDoPedido(pedido)));
    setTambemProfessor((v) => v || !!pedido?.tambemProfessor);
    setPapel((v) => v || (FUNCOES_PEDIDO.includes(pedido?.papel) ? pedido.papel : pedido ? "lider" : lerPapelPedido()));
  }, [precisaFormulario, pedido, user]);

  async function enviar(e) {
    e.preventDefault();
    setErro("");
    if (nome.trim().length < 3) return setErro(t("accessRequest.errors.name"));
    if (telefone.replace(/\D/g, "").length < 8) return setErro(t("accessRequest.errors.phone"));
    if (!unidadeIds.length) return setErro(t("accessRequest.errors.unit"));
    if (!documentoValido(docTipo, docNumero)) return setErro(t("document.errors.invalid"));

    setEnviando(true);
    try {
      const ids = unidadeIds.slice(0, MAX_UNIDADES_PEDIDO);
      const batch = writeBatch(db);
      batch.set(doc(db, "solicitacoes_acesso", uid), {
        nome: nome.trim(),
        telefone: telefone.trim(),
        papel,
        unidadeId: ids[0],
        unidadeIds: ids,
        unidadeNome: porId.get(ids[0])?.nome || "",
        unidadeNomes: ids.map((id) => porId.get(id)?.nome || ""),
        tambemProfessor: papel === "lider" && tambemProfessor,
        email: user.email,
        status: "pendente",
        documentoOk: true, // o número fica na gaveta privada do pedido, nunca aqui
        criadoEm: serverTimestamp(),
      });
      documentoNoLote(batch, { uid, tipo: docTipo, numero: docNumero, anterior: docAnterior, noPedido: true });
      await gravarComAviso(batch);
      guardarPapelPedido(papel);
      setEditando(false);
    } catch (err) {
      console.error(err);
      setErro(err?.message === ERRO_DOCUMENTO_EM_USO ? t("document.errors.inUse") : t("accessRequest.errors.send"));
    } finally {
      setEnviando(false);
    }
  }

  if (loading) return <Carregando />;
  if (!user) return <Navigate to="/login" replace />;
  if (userData) return <Navigate to="/app" replace />;
  if (pedido === undefined || convite === undefined) return <Carregando />;

  const etapas = [t("access.steps.role"), t("access.steps.google"), t("access.steps.data"), t("access.steps.approval")];
  const sair = (
    <BotaoLink onClick={logout}><LogOut className="w-4 h-4" /> {t("accessRequest.logout", { email: user.email })}</BotaoLink>
  );

  // ===== MENTOR CADASTRADO PELO ADMIN =====
  if (convite) {
    return (
      <FundoAcesso>
        <Marca compacta />
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
          {sair}
        </div>
        <CaixaAjuda />
      </FundoAcesso>
    );
  }

  // ===== AGUARDANDO APROVAÇÃO =====
  if (!precisaFormulario) {
    const papelPedido = FUNCOES_PEDIDO.includes(pedido.papel) ? pedido.papel : "lider";
    const ids = idsDoPedido(pedido);
    const nomes = ids.map((id, i) => porId.get(id)?.nome || pedido.unidadeNomes?.[i] || (i === 0 ? pedido.unidadeNome : "") || id);
    return (
      <FundoAcesso>
        <Marca compacta />
        <Passos etapas={etapas} atual={3} />
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-black text-white">{t("accessRequest.waiting.title")}</h2>
          <p className="text-sm text-zinc-400">{t("accessRequest.waiting.desc")}</p>
          <div className="text-left bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm space-y-1">
            <p><span className="text-zinc-500">{t("accessRequest.fields.name")}:</span> <b>{pedido.nome}</b></p>
            <p><span className="text-zinc-500">{t("accessRequest.fields.phone")}:</span> <b>{pedido.telefone}</b></p>
            <p>
              <span className="text-zinc-500">{t("accessRequest.fields.role")}:</span>{" "}
              <b>{t(`access.roles.${papelPedido}.name`)}{papelPedido === "lider" && pedido.tambemProfessor ? ` ${t("accessRequest.andTeacher")}` : ""}</b>
            </p>
            <p><span className="text-zinc-500">{t("accessRequest.fields.units")}:</span> <b>{nomes.join(", ")}</b></p>
          </div>
          <div className="text-left text-xs text-zinc-300 bg-blue-500/10 border border-blue-500/30 rounded-xl px-3 py-2.5">
            {t(`accessRequest.approver.${papelPedido}`)}
          </div>
          <BotaoLink onClick={() => setEditando(true)}><Pencil className="w-4 h-4" /> {t("accessRequest.waiting.edit")}</BotaoLink>
          {sair}
        </div>
        <CaixaAjuda mentores={papelPedido === "lider" ? ids.map((id) => porId.get(id)?.mentorNome) : []} />
      </FundoAcesso>
    );
  }

  // ===== ESCOLHER A FUNÇÃO (entrou direto pelo Google, sem passar pelo "Primeiro acesso") =====
  if (!papel || escolhendoPapel) {
    return (
      <FundoAcesso>
        <Marca compacta />
        <Passos etapas={etapas} atual={0} />
        <h2 className="text-xl font-black text-white text-center">{t("access.roles.title")}</h2>
        <p className="text-sm text-zinc-400 text-center mt-1.5 mb-5">{t("access.roles.desc")}</p>
        <div className="space-y-2.5">
          {FUNCOES_PEDIDO.map((p) => (
            <CartaoEscolha
              key={p} ativo={papel === p} icone={ICONE_FUNCAO[p]}
              onClick={() => { setPapel(p); guardarPapelPedido(p); setEscolhendoPapel(false); }}
              titulo={t(`access.roles.${p}.name`)} descricao={t(`access.roles.${p}.desc`)}
            />
          ))}
          <CartaoEscolha
            desabilitado icone={ICONE_FUNCAO.professor} selo={t("access.roles.soon")}
            titulo={t("access.roles.professor.name")} descricao={t("access.roles.professor.soonDesc")}
          />
        </div>
        <div className="mt-5">{sair}</div>
        <CaixaAjuda />
      </FundoAcesso>
    );
  }

  // ===== SEUS DADOS (1º pedido, pedido recusado ou editando) =====
  const campo = "w-full bg-zinc-900/50 border border-zinc-700 text-white font-bold pl-11 pr-4 py-3 rounded-xl focus:border-red-600 outline-none placeholder:text-zinc-600 placeholder:font-normal";
  return (
    <FundoAcesso>
      <Marca compacta />
      <Passos etapas={etapas} atual={2} />
      <h2 className="text-xl font-black text-white text-center">{t("accessRequest.form.title")}</h2>
      <p className="text-sm text-zinc-400 text-center mt-1.5 mb-5">{t("accessRequest.form.desc")}</p>

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

      <FuncaoEscolhida texto={t(`access.roles.${papel}.name`)} onTrocar={enviando ? undefined : () => setEscolhendoPapel(true)} />
      <p className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2.5 mb-4 break-all">
        ✓ {t("accessRequest.connectedAs", { email: user.email })}
      </p>

      <form onSubmit={enviar} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="pedido-nome" className={classeRotulo}>{t("accessRequest.fields.name")}</label>
          <div className="relative">
            <User className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
            <input id="pedido-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} className={campo} placeholder={t("accessRequest.fields.namePlaceholder")} />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="pedido-telefone" className={classeRotulo}>{t("accessRequest.fields.phone")}</label>
          <div className="relative">
            <Phone className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
            <input id="pedido-telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={30} inputMode="tel" className={campo} placeholder={t("accessRequest.fields.phonePlaceholder")} />
          </div>
        </div>

        <SeletorUnidades
          unidades={unidades} selecionadas={unidadeIds} onChange={setUnidadeIds} desabilitado={enviando}
          rotulo={t(papel === "mentor" ? "accessRequest.fields.unitsMentor" : "accessRequest.fields.unitsLeader")}
        />
        <p className="text-[11px] text-zinc-500 -mt-2 ml-1">
          {t(papel === "mentor" ? "accessRequest.hints.mentorUnits" : "accessRequest.hints.leaderUnits", { max: MAX_UNIDADES_PEDIDO })}
        </p>

        <div className="space-y-1">
          <CampoDocumento id="pedido-documento" tipo={docTipo} onTipo={setDocTipo} valor={docNumero} onValor={setDocNumero} desabilitado={enviando} />
          <p className="text-[11px] text-zinc-500 ml-1">{t("document.hint")}</p>
        </div>

        {papel === "lider" && (
          <div className="space-y-1.5">
            <span className={classeRotulo}>{t("accessRequest.fields.alsoTeacher")}</span>
            <div className="grid grid-cols-2 gap-1.5">
              {[[true, t("accessRequest.alsoTeacherYes")], [false, t("accessRequest.alsoTeacherNo")]].map(([v, rot]) => (
                <button
                  key={String(v)} type="button" aria-pressed={tambemProfessor === v} onClick={() => setTambemProfessor(v)}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-black ${tambemProfessor === v ? "border-red-600 bg-red-600/10 text-white" : "border-zinc-700 bg-zinc-900 text-zinc-400"}`}
                >
                  {rot}
                </button>
              ))}
            </div>
          </div>
        )}

        {erro && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {erro}
          </div>
        )}

        <BotaoVermelho type="submit" disabled={enviando || !unidades?.length}>
          {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />} {t("accessRequest.form.send")}
        </BotaoVermelho>
        {editando && <BotaoLink onClick={() => setEditando(false)}>{t("accessRequest.form.cancelEdit")}</BotaoLink>}
      </form>
      <div className="mt-3">{sair}</div>
      <CaixaAjuda mentores={unidadeIds.map((id) => porId.get(id)?.mentorNome)} />
    </FundoAcesso>
  );
}

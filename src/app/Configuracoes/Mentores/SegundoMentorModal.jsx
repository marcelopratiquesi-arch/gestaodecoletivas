// "2º mentor" de um mentor: escolher alguém que já tem acesso (líder, professor...) ou convidar um e-mail novo do Google.
// O 2º mentor enxerga e faz o mesmo que o 1º nas unidades dele. Só o admin chega aqui (aba Mentores).
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Search, UserPlus, Users, AlertTriangle, X } from "lucide-react";
import { db } from "../../../services/firebase";
import { acharDonoDoDocumento } from "../../../services/documentoService";
import { documentoValido, TIPOS_DOCUMENTO } from "../../../utils/documento";
import { entrarComoSegundo, convidarSegundo } from "./acoesSegundoMentor";
import { motivoQueBloqueia } from "./segundoMentor";
import { SeletorDePrazo } from "../Lideres/TemporariosSecao";
import { diaDoFim, fimPorDias } from "../../../utils/temporario";

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// temporario = true: cobertura por prazo (mentor temporário); vários por mentor, só o admin.
export function SegundoMentorModal({ principal, professores = [], unidades = [], quem, registrarAuditoria, onClose, temporario = false }) {
  const { t, i18n } = useTranslation();
  const [fim, setFim] = useState(() => (temporario ? fimPorDias(30) : null));
  const [modo, setModo] = useState("existente"); // existente | novo
  const [busca, setBusca] = useState("");
  const [pessoa, setPessoa] = useState(null);
  const [cracha, setCracha] = useState(null);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [donoDoc, setDonoDoc] = useState(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");

  const nomeUnidade = (id) => unidades.find((u) => String(u.id) === String(id))?.nome || id;

  // Quem já entra no sistema: professores com login e líderes das unidades (já carregados, sem leitura extra).
  const candidatos = useMemo(() => {
    const porUid = new Map();
    const juntar = (uid, dados, etiqueta) => {
      if (!uid) return;
      const a = porUid.get(uid) || { uid, nome: "", email: "", telefone: "", etiquetas: [] };
      porUid.set(uid, {
        ...a, nome: a.nome || dados.nome || "", email: a.email || dados.email || "", telefone: a.telefone || dados.telefone || "",
        etiquetas: a.etiquetas.includes(etiqueta) ? a.etiquetas : [...a.etiquetas, etiqueta],
      });
    };
    professores.filter((p) => p.uidLogin).forEach((p) => juntar(String(p.uidLogin), { nome: p.nome, email: p.email, telefone: p.telefone || p.whatsapp }, "professor"));
    unidades.forEach((u) => {
      if (u.liderUid) juntar(String(u.liderUid), { nome: u.liderNome, email: u.liderEmail, telefone: u.liderTelefone }, "lider");
      if (u.lider2Uid) juntar(String(u.lider2Uid), { nome: u.lider2Nome, email: u.lider2Email, telefone: u.lider2Telefone }, "lider");
    });
    return [...porUid.values()].filter((c) => c.uid !== principal.id).sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  }, [professores, unidades, principal.id]);

  // Digitou um CPF/DNI/SSN válido? Acha o dono do documento.
  useEffect(() => {
    const texto = busca.trim();
    const tipos = /^[\d.\-\s]+$/.test(texto) ? TIPOS_DOCUMENTO.filter((tp) => documentoValido(tp, texto)) : [];
    if (tipos.length === 0) { setDonoDoc(null); return undefined; }
    let vivo = true;
    setDonoDoc("buscando");
    (async () => {
      try {
        for (const tp of tipos) {
          const dono = await acharDonoDoDocumento(tp, texto);
          if (dono) { if (vivo) setDonoDoc({ uid: dono.uid }); return; }
        }
        if (vivo) setDonoDoc({ uid: null });
      } catch (e) { console.error(e); if (vivo) setDonoDoc(null); }
    })();
    return () => { vivo = false; };
  }, [busca]);

  const lista = useMemo(() => {
    if (donoDoc?.uid) return candidatos.filter((c) => c.uid === donoDoc.uid);
    const termo = busca.trim().toLowerCase();
    return candidatos.filter((c) => !termo || [c.nome, c.email].some((v) => String(v || "").toLowerCase().includes(termo))).slice(0, 60);
  }, [candidatos, busca, donoDoc]);

  async function escolher(c) {
    setErro(""); setPessoa(c); setCracha(null); setLendo(true);
    try {
      const snap = await getDoc(doc(db, "usuarios", c.uid));
      setCracha(snap.exists() ? { id: snap.id, ...snap.data() } : { inexistente: true });
    } catch (e) { console.error(e); setErro(t("mentorsTab.second.errors.read")); } finally { setLendo(false); }
  }

  const bloqueio = cracha ? motivoQueBloqueia(cracha.inexistente ? null : cracha) : null;
  const papelAtual = cracha && !cracha.inexistente ? String(cracha.role || "").toLowerCase() : "";

  async function confirmarExistente() {
    if (!pessoa || !cracha || bloqueio) return;
    const nomePessoa = cracha.nome || pessoa.nome;
    if (temporario && (!fim || fim.getTime() <= Date.now())) return setErro(t("tempLeader.errors.past"));
    const aviso = temporario
      ? t("tempLeader.mentor.confirm", { name: nomePessoa, mentor: principal.nome, date: diaDoFim(fim, i18n.language) })
      : t("mentorsTab.second.confirm", { name: nomePessoa, mentor: principal.nome });
    if (!window.confirm(aviso)) return;
    setSalvando(true); setErro("");
    try {
      await entrarComoSegundo({ cracha, uid: pessoa.uid, principalId: principal.id, fim: temporario ? fim : null });
      await registrarAuditoria("NOVA", temporario
        ? `Virou mentor temporário de ${principal.nome} até ${diaDoFim(fim, i18n.language)} (era ${papelAtual || "-"}).`
        : `Virou 2º mentor de ${principal.nome} (era ${papelAtual || "-"}).`, { id: pessoa.uid, nome: nomePessoa, email: cracha.email }, `Mentor principal: ${principal.nome}`);
      alert(t("mentorsTab.second.done", { name: nomePessoa }));
      onClose();
    } catch (e) { console.error(e); setErro(t("mentorsTab.second.errors.save") + " " + (e.message || "")); } finally { setSalvando(false); }
  }

  async function confirmarNovo() {
    setErro("");
    if (nome.trim().length < 3) return setErro(t("mentorsTab.messages.nameRequired"));
    if (!EMAIL_VALIDO.test(email.trim())) return setErro(t("mentorsTab.messages.invalidEmail"));
    if (telefone.trim().length < 6) return setErro(t("mentorsTab.extra.whatsappRequired"));
    if (temporario && (!fim || fim.getTime() <= Date.now())) return setErro(t("tempLeader.errors.past"));
    setSalvando(true);
    try {
      const emailGoogle = await convidarSegundo({ email, nome, telefone, pais: principal.pais || "BR", principalId: principal.id, quem, fim: temporario ? fim : null });
      await registrarAuditoria("NOVA", `${temporario ? `Mentor temporário (até ${diaDoFim(fim, i18n.language)})` : "2º mentor"} de ${principal.nome} cadastrado pelo e-mail do Google (aguardando o 1º acesso).`, { id: null, nome: nome.trim(), email: emailGoogle, emailGoogle }, `Mentor principal: ${principal.nome}`);
      alert(t("mentorsTab.second.invited", { name: nome.trim() }));
      onClose();
    } catch (e) { console.error(e); setErro(t("mentorsTab.second.errors.save") + " " + (e.message || "")); } finally { setSalvando(false); }
  }

  const unidadesDaPessoa = cracha && !cracha.inexistente ? [...new Set([cracha.unidadeId, ...(cracha.unidadeIds || [])].filter(Boolean).map(String))] : [];
  const fora = unidadesDaPessoa.filter((id) => unidades.find((u) => String(u.id) === id)?.mentorId !== principal.id);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 normal-case" onClick={() => !salvando && onClose()}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2"><Users className="w-5 h-5 text-blue-600" /> {temporario ? t("tempLeader.mentor.title") : t("mentorsTab.second.title")}</h3>
            <p className="text-xs text-slate-500 mt-1">{temporario ? t("tempLeader.mentor.help", { mentor: principal.nome }) : t("mentorsTab.second.help", { mentor: principal.nome })}</p>
          </div>
          <button type="button" onClick={onClose} disabled={salvando} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="flex gap-2">
            {[["existente", t("mentorsTab.second.modeExisting")], ["novo", t("mentorsTab.second.modeNew")]].map(([id, rotulo]) => (
              <button key={id} type="button" onClick={() => { setModo(id); setErro(""); }} aria-pressed={modo === id}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-black uppercase transition-colors ${modo === id ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}>{rotulo}</button>
            ))}
          </div>

          {modo === "existente" ? (
            <>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} disabled={salvando} placeholder={t("mentorsTab.second.search")}
                  className="w-full pl-9 pr-3 py-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/50">
                {lista.length === 0 ? (
                  <p className="p-3 text-xs text-slate-400 font-bold">{donoDoc === "buscando" ? t("mentorsTab.second.docSearching") : donoDoc ? t("mentorsTab.second.docNone") : t("mentorsTab.second.noPeople")}</p>
                ) : lista.map((c) => (
                  <button type="button" key={c.uid} onClick={() => escolher(c)} disabled={salvando}
                    className={`w-full text-left p-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/30 ${pessoa?.uid === c.uid ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}>
                    <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                      {c.nome || "-"}
                      {c.etiquetas.map((e) => <span key={e} className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">{t(`mentorsTab.second.tag.${e}`)}</span>)}
                    </span>
                    <span className="block text-[11px] text-slate-500">{c.email || "-"}</span>
                  </button>
                ))}
              </div>
              {lendo && <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("mentorsTab.second.reading")}</p>}
              {pessoa && cracha && !lendo && (
                <div className={`text-xs font-bold p-3 rounded-xl space-y-1 ${bloqueio ? "text-red-600 bg-red-50 dark:bg-red-900/20" : "text-slate-600 bg-slate-50 dark:bg-slate-900/40 dark:text-slate-300"}`}>
                  <p className="flex items-start gap-2">{bloqueio && <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                    {bloqueio ? t(`mentorsTab.second.errors.${bloqueio}`) : t("mentorsTab.second.now", { role: t(`mentorsTab.second.tag.${papelAtual === "unidade" ? "lider" : papelAtual}`, papelAtual) })}</p>
                  {!bloqueio && unidadesDaPessoa.length > 0 && <p className="font-medium">{t("mentorsTab.second.keepsLeader", { units: unidadesDaPessoa.map(nomeUnidade).join(", ") })}</p>}
                  {!bloqueio && fora.length > 0 && <p className="text-amber-700 dark:text-amber-400 flex items-start gap-2"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {t("mentorsTab.second.outsideWarning", { units: fora.map(nomeUnidade).join(", ") })}</p>}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              {[[t("mentorsTab.modal.name"), nome, setNome, "text"], [t("mentorsTab.second.googleEmail"), email, setEmail, "email"], [t("mentorsTab.modal.phone"), telefone, setTelefone, "text"]].map(([rotulo, valor, set, tipo]) => (
                <label key={rotulo} className="block space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{rotulo}</span>
                  <input type={tipo} value={valor} onChange={(e) => set(e.target.value)} disabled={salvando}
                    className="w-full px-3 py-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
              ))}
              <p className="text-[11px] text-slate-500">{t("mentorsTab.second.inviteHelp")}</p>
            </div>
          )}

          {temporario && (
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("tempLeader.sectionDeadline")}</span>
              <SeletorDePrazo fim={fim} onFim={setFim} desabilitado={salvando} />
            </div>
          )}

          {erro && <p className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{erro}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={salvando} className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200">{t("mentorsTab.modal.cancel")}</button>
            <button type="button" onClick={modo === "existente" ? confirmarExistente : confirmarNovo}
              disabled={salvando || (modo === "existente" && (lendo || !pessoa || !cracha || !!bloqueio))}
              className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 disabled:opacity-50">
              {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : modo === "existente" ? <Check className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
              {modo === "existente" ? t("mentorsTab.second.save") : t("mentorsTab.second.invite")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

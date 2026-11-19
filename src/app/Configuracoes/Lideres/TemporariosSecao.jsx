// Seção "Líderes temporários" da aba Líderes: quem foi convidado, quem está ativo e quando acaba.
// Cada linha tem: prazo e aviso (7/3/1 dia), contato (copiar + WhatsApp), unidades, e as ações
// prorrogar, encerrar e efetivar. O botão "Convidar" abre o modal de convite (e-mail do Google, unidades, prazo).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Clock, Loader2, Mail, Plus, Timer, UserCheck, UserX, X } from "lucide-react";
import LinkUnidade from "../../../centrais/LinkUnidade";
import { AcoesDoContato } from "../ui/AcoesDoContato";
import { CabecalhoDoModal } from "../ui/CabecalhoDoModal";
import { BotaoSecundario } from "../ui/CabecalhoDaAba";
import {
  MAX_UNIDADES_TEMPORARIO, cancelarConvite, convidarTemporario, efetivar, encerrar,
  lerConvitesPendentes, lerTemporarios, prorrogar, unidadesQueEuPosso, validarConvite,
} from "./liderTemporario";
import { ATALHOS_DIAS, DIAS_LIMITE_TECNICO, diaDoFim, diasRestantes, fimDoDia, fimDoTemporario, fimPorDias, hojeBrasilia, nivelDoAviso, somarDias } from "../../../utils/temporario";

const COR_NIVEL = {
  vencido: "bg-red-50 text-red-700 border-red-300 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
  urgente: "bg-red-50 text-red-700 border-red-300 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
  alto: "bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800",
  atencao: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800",
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800",
};

// Selo "faltam X dias" / "vence hoje" / "vencido".
export function SeloDoPrazo({ fim, className = "" }) {
  const { t } = useTranslation();
  const dias = diasRestantes(fim);
  if (dias === null) return null;
  const nivel = nivelDoAviso(dias) || "ok";
  const texto = dias < 0 ? t("tempLeader.status.expired") : dias === 0 ? t("tempLeader.status.today") : t("tempLeader.status.days", { count: dias });
  return <span className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-black uppercase ${COR_NIVEL[nivel]} ${className}`}>{texto}</span>;
}

export function TemporariosSecao({ role, escopos, unidades, quem, pedirAtualizar, registrarAuditoria }) {
  const { t, i18n } = useTranslation();
  const [temporarios, setTemporarios] = useState([]);
  const [convites, setConvites] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(null);
  const [convidando, setConvidando] = useState(false);
  const [prorrogando, setProrrogando] = useState(null); // crachá em prorrogação

  const idioma = i18n.language;
  const nomeUnidade = useMemo(() => new Map(unidades.map((u) => [String(u.id), u])), [unidades]);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try {
      const [tem, con] = await Promise.all([lerTemporarios({ role, escopos, unidades }), lerConvitesPendentes({ role, escopos })]);
      setTemporarios(tem.sort((a, b) => (fimDoTemporario(a)?.getTime() || 0) - (fimDoTemporario(b)?.getTime() || 0)));
      setConvites(con);
    } catch (e) {
      console.error(e);
      setErro(t("tempLeader.errors.load"));
    } finally { setCarregando(false); }
  }, [role, escopos, unidades, t]);

  useEffect(() => { carregar(); }, [carregar]);

  async function agir(id, fn, auditoria) {
    setOcupado(id);
    try {
      await fn();
      if (auditoria) await registrarAuditoria?.("ALTERADA", auditoria.descricao, auditoria.unidade, auditoria.detalhes);
      await carregar();
      pedirAtualizar?.();
    } catch (e) {
      console.error(e);
      alert(t("tempLeader.errors.action") + " " + (e.message || ""));
    } finally { setOcupado(null); }
  }

  const nomesDasUnidades = (r) => (r.unidadeIds?.length ? r.unidadeIds : [r.unidadeId]).map((id) => nomeUnidade.get(String(id))).filter(Boolean);
  const unidadesDe = (r) => nomesDasUnidades(r).map((u, i) => (<span key={u.id}>{i > 0 ? ", " : ""}<LinkUnidade unidade={u} className="font-bold text-slate-700 dark:text-slate-200">{u.nome}</LinkUnidade></span>));

  const vencendo = temporarios.filter((c) => { const n = nivelDoAviso(diasRestantes(c.temporarioAte)); return n && n !== "vencido"; }).length;
  const total = temporarios.length + convites.length;

  async function encerrarAgora(c) {
    if (!window.confirm(t("tempLeader.confirmEnd", { name: c.nome }))) return;
    await agir(c.id, () => encerrar(c.id), { descricao: "Líder temporário encerrado.", unidade: nomesDasUnidades(c)[0]?.nome, detalhes: `${c.nome} (${c.email})` });
  }
  async function efetivarAgora(c) {
    if (!window.confirm(t("tempLeader.confirmMakePermanent", { name: c.nome }))) return;
    setOcupado(c.id);
    try {
      const r = await efetivar({ cracha: c, unidades });
      if (!r.ok) { alert(t("tempLeader.errors.noSlot", { unit: r.unidade })); return; }
      await registrarAuditoria?.("ALTERADA", "Líder temporário efetivado como líder.", nomesDasUnidades(c)[0]?.nome, `${c.nome} (${c.email})`);
      await carregar();
      pedirAtualizar?.();
    } catch (e) {
      console.error(e);
      alert(t("tempLeader.errors.action") + " " + (e.message || ""));
    } finally { setOcupado(null); }
  }
  async function cancelar(c) {
    if (!window.confirm(t("tempLeader.confirmCancel", { email: c.email }))) return;
    await agir(c.id, () => cancelarConvite(c.id));
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Timer className="w-4 h-4 text-teal-600" /> {t("tempLeader.title")}
            <span className="min-w-[1.5rem] px-1.5 py-0.5 rounded-md text-[10px] text-center bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200">{total}</span>
            {vencendo > 0 && <span className="px-2 py-0.5 rounded-md border text-[10px] font-black uppercase bg-amber-50 text-amber-700 border-amber-300">{t("tempLeader.expiringSoon", { count: vencendo })}</span>}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl">{t("tempLeader.subtitle")}</p>
        </div>
        <BotaoSecundario icone={Plus} onClick={() => setConvidando(true)}>{t("tempLeader.invite")}</BotaoSecundario>
      </div>

      {erro && <p className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{erro}</p>}

      {carregando ? (
        <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-teal-500" /></div>
      ) : total === 0 ? (
        <p className="text-xs font-bold text-slate-400 py-3">{t("tempLeader.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {temporarios.map((c) => {
                const fim = fimDoTemporario(c);
                const dias = diasRestantes(fim);
                const vencido = dias !== null && dias < 0;
                return (
                  <tr key={c.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/20 ${vencido ? "opacity-70" : ""}`}>
                    <td className="p-4">
                      <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                        {c.nome || "-"} <SeloDoPrazo fim={fim} />
                      </p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email || "-"} <AcoesDoContato valor={c.email} /></p>
                      {c.telefone && <p className="text-[11px] text-slate-500 flex items-center gap-1">{c.telefone} <AcoesDoContato telefone={c.telefone} pais={c.pais} /></p>}
                    </td>
                    <td className="p-4 text-xs text-slate-500">
                      <p>{unidadesDe(c)}</p>
                      <p className="mt-1 flex items-center gap-1 font-bold"><Clock className="w-3 h-3" /> {t("tempLeader.until", { date: diaDoFim(fim, idioma) })}</p>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <button type="button" onClick={() => setProrrogando(c)} disabled={ocupado === c.id}
                          className="px-3 py-2 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 hover:bg-teal-100 text-[10px] font-black uppercase flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap">
                          <Timer className="w-3.5 h-3.5" /> {vencido ? t("tempLeader.reactivate") : t("tempLeader.extend")}
                        </button>
                        <button type="button" onClick={() => efetivarAgora(c)} disabled={ocupado === c.id}
                          className="px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-[10px] font-black uppercase flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap">
                          <UserCheck className="w-3.5 h-3.5" /> {t("tempLeader.makePermanent")}
                        </button>
                        {!vencido && (
                          <button type="button" onClick={() => encerrarAgora(c)} disabled={ocupado === c.id} title={t("tempLeader.endNow")}
                            className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 text-[10px] font-black uppercase flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap">
                            {ocupado === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />} {t("tempLeader.endNow")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {convites.map((c) => (
                <tr key={c.id} className="bg-slate-50/60 dark:bg-slate-900/20">
                  <td className="p-4">
                    <p className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 flex-wrap">
                      {c.nome} <span className="px-2 py-0.5 rounded-md border text-[10px] font-black uppercase bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">{t("tempLeader.status.waiting")}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email} <AcoesDoContato valor={c.email} /></p>
                    {c.telefone && <p className="text-[11px] text-slate-500 flex items-center gap-1">{c.telefone} <AcoesDoContato telefone={c.telefone} pais={c.pais} /></p>}
                  </td>
                  <td className="p-4 text-xs text-slate-500">
                    <p>{unidadesDe(c)}</p>
                    <p className="mt-1 flex items-center gap-1 font-bold"><Clock className="w-3 h-3" /> {t("tempLeader.inviteUntil", { date: diaDoFim(c.temporarioAte, idioma) })}</p>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end">
                      <button type="button" onClick={() => cancelar(c)} disabled={ocupado === c.id}
                        className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 text-[10px] font-black uppercase flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap">
                        <X className="w-3.5 h-3.5" /> {t("tempLeader.cancelInvite")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {convidando && (
        <ConviteModal role={role} escopos={escopos} unidades={unidades} quem={quem}
          onFechar={() => setConvidando(false)}
          onCriado={async (dados) => {
            setConvidando(false);
            await registrarAuditoria?.("NOVA", "Líder temporário convidado.", dados.unidades[0]?.nome, `${dados.nome} (${dados.email}) até ${diaDoFim(dados.fim, idioma)}`);
            await carregar(); pedirAtualizar?.();
          }} />
      )}
      {prorrogando && (
        <PrazoModal cracha={prorrogando} onFechar={() => setProrrogando(null)}
          onSalvar={async (fim) => {
            const c = prorrogando; setProrrogando(null);
            await agir(c.id, () => prorrogar(c.id, fim), { descricao: "Líder temporário prorrogado.", unidade: nomesDasUnidades(c)[0]?.nome, detalhes: `${c.nome} (${c.email}) até ${diaDoFim(fim, idioma)}` });
          }} />
      )}
    </section>
  );
}

// ---------- Escolha do prazo: atalhos em dias (hoje é o dia 1) ou uma data ----------
const ROTULO_PRESET = { 90: "m3", 180: "m6", 365: "y1" };
export function SeletorDePrazo({ fim, onFim, desabilitado, atalhos = ATALHOS_DIAS }) {
  const { t } = useTranslation();
  const hoje = hojeBrasilia();
  const ultimoPermitido = somarDias(hoje, DIAS_LIMITE_TECNICO);
  const dataAtual = fim ? hojeBrasilia(fim.getTime()) : "";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {atalhos.map((d) => {
          const alvo = fimPorDias(d);
          const ativo = fim && alvo.getTime() === fim.getTime();
          return (
            <button key={d} type="button" disabled={desabilitado} onClick={() => onFim(alvo)}
              className={`px-3 py-2 rounded-lg text-xs font-black uppercase border transition-colors ${ativo ? "bg-teal-600 text-white border-teal-600" : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-teal-500"}`}>
              {ROTULO_PRESET[d] && atalhos !== ATALHOS_DIAS ? t(`tempLeader.preset.${ROTULO_PRESET[d]}`) : t("tempLeader.days", { count: d })}
            </button>
          );
        })}
      </div>
      <input type="date" value={dataAtual} min={hoje} max={ultimoPermitido} disabled={desabilitado}
        onChange={(e) => onFim(e.target.value ? fimDoDia(e.target.value) : null)}
        className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500" />
      <p className="text-[11px] text-slate-400">{t("tempLeader.deadlineHint")}</p>
    </div>
  );
}

export function PrazoModal({ cracha, onFechar, onSalvar, abaId = "lideres", atalhos = ATALHOS_DIAS }) {
  const { t } = useTranslation();
  const [fim, setFim] = useState(fimPorDias(atalhos === ATALHOS_DIAS ? 30 : 60));
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <CabecalhoDoModal abaId={abaId} icone={Timer} titulo={t("tempLeader.extendTitle", { name: cracha.nome })} onFechar={onFechar} />
        <div className="p-5 space-y-4">
          <SeletorDePrazo fim={fim} onFim={setFim} atalhos={atalhos} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onFechar} className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200">{t("tempLeader.cancel")}</button>
            <button type="button" disabled={!fim} onClick={() => { if (fim.getTime() > Date.now()) onSalvar(fim); }}
              className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-teal-500 hover:bg-teal-600 text-white flex items-center gap-1.5 disabled:opacity-50">
              <Check className="w-3.5 h-3.5" /> {t("tempLeader.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Convite ----------
const NOME_PAIS = { Brasil: "BR", Argentina: "AR", "Estados Unidos": "US" };
const paisDa = (u) => NOME_PAIS[u?.pais] || u?.pais || "BR";

function ConviteModal({ role, escopos, unidades, quem, onFechar, onCriado }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ email: "", nome: "", telefone: "" });
  const [escolhidas, setEscolhidas] = useState([]);
  const [busca, setBusca] = useState("");
  const [fim, setFim] = useState(fimPorDias(30));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const minhas = useMemo(() => unidadesQueEuPosso({ role, escopos, unidades }), [role, escopos, unidades]);
  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return minhas.filter((u) => !q || `${u.nome} ${u.estado || ""}`.toLowerCase().includes(q)).slice(0, 60);
  }, [minhas, busca]);

  const alternar = (id) => setEscolhidas((v) => (v.includes(id) ? v.filter((x) => x !== id) : v.length >= MAX_UNIDADES_TEMPORARIO ? v : [...v, id]));

  async function enviar(e) {
    e.preventDefault(); setErro("");
    const falha = validarConvite({ ...form, unidadeIds: escolhidas, fim });
    if (falha) return setErro(t(`tempLeader.errors.${falha}`, { max: MAX_UNIDADES_TEMPORARIO }));
    const dasUnidades = escolhidas.map((id) => unidades.find((u) => u.id === id)).filter(Boolean);
    setSalvando(true);
    try {
      // O mentor "dono" do convite: o mentor da 1ª unidade (o banco confere que é um mentor que o convidante enxerga).
      const mentorId = dasUnidades[0]?.mentorId || "";
      const email = await convidarTemporario({ ...form, pais: paisDa(dasUnidades[0]), unidadeIds: escolhidas, fim, mentorId, quem });
      await onCriado({ ...form, email, fim, unidades: dasUnidades });
    } catch (err) {
      console.error(err);
      setErro(t("tempLeader.errors.save") + " " + (err.message || ""));
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !salvando && onFechar()}>
      <form onSubmit={enviar} onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-2xl">
        <CabecalhoDoModal abaId="lideres" icone={Timer} titulo={t("tempLeader.modalTitle")} subtitulo={t("tempLeader.modalSubtitle")} onFechar={onFechar} desabilitado={salvando} />
        <div className="p-5 sm:p-6 overflow-y-auto grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{t("tempLeader.sectionPerson")}</p>
            {[["email", "email", "email"], ["nome", "name", "text"], ["telefone", "phone", "text"]].map(([campo, rotulo, tipo]) => (
              <label key={campo} className="block space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t(`tempLeader.field.${rotulo}`)}</span>
                <input type={tipo} value={form[campo]} disabled={salvando} maxLength={campo === "nome" ? 80 : 60}
                  onChange={(e) => setForm({ ...form, [campo]: e.target.value })}
                  className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500" />
              </label>
            ))}
            <p className="text-[11px] text-slate-400">{t("tempLeader.emailHint")}</p>
          </div>
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{t("tempLeader.sectionUnits", { count: escolhidas.length, max: MAX_UNIDADES_TEMPORARIO })}</p>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t("tempLeader.searchUnit")} disabled={salvando}
              className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500" />
            <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/50">
              {visiveis.length === 0 && <p className="p-3 text-xs text-slate-400 font-bold">{t("tempLeader.noUnits")}</p>}
              {visiveis.map((u) => {
                const marcada = escolhidas.includes(u.id);
                return (
                  <label key={u.id} className={`flex items-center gap-2 px-3 py-2 text-xs font-bold cursor-pointer ${marcada ? "bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300" : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/30"}`}>
                    <input type="checkbox" checked={marcada} disabled={salvando || (!marcada && escolhidas.length >= MAX_UNIDADES_TEMPORARIO)} onChange={() => alternar(u.id)} />
                    <span className="truncate">{u.nome}</span><span className="ml-auto text-[10px] text-slate-400">{u.estado || ""}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{t("tempLeader.sectionDeadline")}</p>
            <SeletorDePrazo fim={fim} onFim={setFim} desabilitado={salvando} />
          </div>
        </div>
        {erro && <p className="mx-5 mb-3 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{erro}</p>}
        <div className="flex justify-end gap-2 p-4 border-t border-slate-100 dark:border-slate-700">
          <button type="button" onClick={onFechar} disabled={salvando} className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200">{t("tempLeader.cancel")}</button>
          <button type="submit" disabled={salvando} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-teal-500 hover:bg-teal-600 text-white flex items-center gap-1.5 disabled:opacity-50">
            {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {t("tempLeader.send")}
          </button>
        </div>
      </form>
    </div>
  );
}


// Seção "Líderes temporários" da aba Líderes no COMPUTADOR (a mesma de antes da Opção B, trazida de volta em 2026-11-19).
// Cada linha tem: prazo e aviso (7/3/1 dia), contato (copiar + WhatsApp), unidades, e as ações
// prorrogar, encerrar e efetivar. O botão "Convidar" abre o modal de convite (e-mail do Google, unidades, prazo).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Loader2, Mail, Plus, Timer, UserCheck, UserX, X } from "lucide-react";
import LinkUnidade from "../../../centrais/LinkUnidade";
import { AcoesDoContato } from "../ui/AcoesDoContato";
import { BotaoSecundario } from "../ui/CabecalhoDaAba";
import { cancelarConvite, efetivar, encerrar, lerConvitesPendentes, lerTemporarios, prorrogar } from "./liderTemporario";
import { diaDoFim, diasRestantes, fimDoTemporario, nivelDoAviso } from "../../../utils/temporario";
import { ConviteModal, PrazoModal, SeloDoPrazo } from "./TemporariosSecao";

export function TemporariosLista({ role, escopos, unidades, quem, pedirAtualizar, registrarAuditoria }) {
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
            <Timer className="w-4 h-4 text-red-600" /> {t("tempLeader.title")}
            <span className="min-w-[1.5rem] px-1.5 py-0.5 rounded-md text-[10px] text-center bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200">{total}</span>
            {vencendo > 0 && <span className="px-2 py-0.5 rounded-md border text-[10px] font-black uppercase bg-amber-50 text-amber-700 border-amber-300">{t("tempLeader.expiringSoon", { count: vencendo })}</span>}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl">{t("tempLeader.subtitle")}</p>
        </div>
        <BotaoSecundario icone={Plus} onClick={() => setConvidando(true)}>{t("tempLeader.invite")}</BotaoSecundario>
      </div>

      {erro && <p className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{erro}</p>}

      {carregando ? (
        <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-red-500" /></div>
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
                          className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 text-[10px] font-black uppercase flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap">
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

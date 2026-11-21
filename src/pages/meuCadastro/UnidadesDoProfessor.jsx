// "Minhas unidades" do PROFESSOR no Meu cadastro: lista das unidades em que ele dá aula e pedido de UNIDADE NOVA.
// O pedido vai para o líder da unidade pedida, o mentor dela ou o admin; aprovado, vira vínculo na grade.
// (O contrato CLT/SAVER é outro pedido, logo abaixo, e continua do mesmo jeito.)
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Loader2, XCircle } from "lucide-react";
import { desistirDoPedidoDeUnidade, listarMeusPedidosDeUnidade, MAX_PEDIDOS_UNIDADE_PROFESSOR, pedirUnidadeNova } from "../../services/pedidoUnidadeProfessorService";
import { CAMPO, CARTAO, ROTULO, SECAO } from "./estilos";

export default function UnidadesDoProfessor({ uid, nome, ficha, unidades, idsMinhas }) {
  const { t } = useTranslation();
  const [pedidos, setPedidos] = useState(undefined);
  const [escolhida, setEscolhida] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try { setPedidos(await listarMeusPedidosDeUnidade(uid)); }
    catch (e) { console.error(e); setPedidos([]); setErro(t("profileUpdate.units.errors.load")); }
  }, [uid, t]);
  useEffect(() => { carregar(); }, [carregar]);

  const minhas = useMemo(() => unidades.filter((u) => idsMinhas.includes(String(u.id))), [unidades, idsMinhas]);
  const pendentes = (pedidos || []).filter((p) => p.status === "pendente");
  const idsPedidos = new Set(pendentes.map((p) => String(p.unidadeId)));
  const opcoes = unidades
    .filter((u) => !idsMinhas.includes(String(u.id)) && !idsPedidos.has(String(u.id)))
    .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));

  async function pedir(e) {
    e.preventDefault();
    setErro("");
    const unidade = unidades.find((u) => String(u.id) === String(escolhida));
    if (!unidade) return setErro(t("profileUpdate.units.errors.choose"));
    if (!ficha) return setErro(t("profileUpdate.units.errors.noFicha"));
    if (pendentes.length >= MAX_PEDIDOS_UNIDADE_PROFESSOR) return setErro(t("profileUpdate.units.errors.max", { max: MAX_PEDIDOS_UNIDADE_PROFESSOR }));
    setEnviando(true);
    try {
      await pedirUnidadeNova({ uid, nome, professorId: ficha.id, unidade });
      setEscolhida("");
      await carregar();
    } catch (err) { console.error(err); setErro(t("profileUpdate.units.errors.send")); } finally { setEnviando(false); }
  }

  async function desistir(p) {
    setEnviando(true);
    try { await desistirDoPedidoDeUnidade(uid, p.unidadeId); await carregar(); } catch (err) { console.error(err); setErro(t("profileUpdate.units.errors.send")); } finally { setEnviando(false); }
  }

  return (
    <section className="space-y-3">
      <h2 className={SECAO}>{t("profileUpdate.units.title")}</h2>
      <div className={CARTAO}>
        {minhas.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 normal-case">{t("profileUpdate.units.none")}</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {minhas.map((u) => <li key={u.id} className="py-2 font-black text-sm text-slate-800 dark:text-white">{u.nome}</li>)}
          </ul>
        )}
      </div>

      <form onSubmit={pedir} className={CARTAO}>
        <h3 className="font-black text-slate-800 dark:text-white uppercase">{t("profileUpdate.units.teacherRequestTitle")}</h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 normal-case">{t("profileUpdate.units.teacherRequestHint")}</p>
        {pedidos === undefined ? (
          <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-red-500" /></div>
        ) : (
          <>
            {pedidos.length > 0 && (
              <ul className="space-y-2">
                {pedidos.map((p) => (
                  <li key={p.id} className={`text-sm font-bold flex flex-wrap items-center gap-2 ${p.status === "recusado" ? "text-red-600" : "text-amber-700 dark:text-amber-300"}`}>
                    {p.status === "recusado" ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />} {p.unidadeNome || p.unidadeId} · {t(`profileUpdate.units.status.${p.status}`)}
                    {p.status === "recusado" && p.motivo && <span className="normal-case font-medium">({p.motivo})</span>}
                    <button type="button" onClick={() => desistir(p)} disabled={enviando} className="text-xs font-black uppercase underline">{p.status === "pendente" ? t("profileUpdate.units.cancel") : t("profileUpdate.units.dismiss")}</button>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <label htmlFor="mc-prof-unidade" className={ROTULO}>{t("profileUpdate.units.choose")}</label>
              <select id="mc-prof-unidade" value={escolhida} onChange={(e) => setEscolhida(e.target.value)} disabled={enviando} className={CAMPO}>
                <option value="">{t("profileUpdate.units.choosePlaceholder")}</option>
                {opcoes.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            {erro && <p role="alert" className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3 normal-case">{erro}</p>}
            <div className="flex justify-end">
              <button type="submit" disabled={enviando || !escolhida} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 disabled:opacity-50">
                {enviando && <Loader2 className="w-4 h-4 animate-spin" />} {t("profileUpdate.units.request")}
              </button>
            </div>
          </>
        )}
      </form>
    </section>
  );
}

// "Minhas unidades" no Meu cadastro.
//  - Mentor e líder: lista (só para ver) das unidades que a pessoa tem.
//  - Líder: pode PEDIR outra unidade. O pedido vai para Pendências; o mentor da unidade (ou o admin) aprova ou recusa.
//    Pedir não garante nada. Usa a mesma coleção do pedido feito na atualização de cadastro (pedidos_unidade).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { collection, deleteDoc, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { db } from "../../services/firebase";
import { ehLider } from "../../permissions";
import { unidadesVisiveis } from "../../centrais/acessos";
import { idDoPedidoUnidade, MAX_UNIDADES_EXTRAS, pedirOutrasUnidades } from "../../app/Configuracoes/Lideres/pedidoOutraUnidade";
import { CAMPO, CARTAO, ROTULO, SECAO } from "./estilos";

const faixaPedido = {
  pendente: { cor: "text-amber-700 dark:text-amber-300", Icone: Clock },
  recusado: { cor: "text-red-600", Icone: XCircle },
  aprovado: { cor: "text-emerald-700 dark:text-emerald-300", Icone: CheckCircle2 },
};

export default function MinhasUnidades({ cracha, uid, emailLogin, unidades }) {
  const { t } = useTranslation();
  const souLider = ehLider(cracha?.role);
  const minhas = useMemo(() => unidadesVisiveis(cracha, unidades), [cracha, unidades]);
  const idsMinhas = useMemo(() => new Set(minhas.map((u) => String(u.id))), [minhas]);
  const [pedidos, setPedidos] = useState(souLider ? undefined : []);
  const [escolhida, setEscolhida] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!souLider || !uid) return;
    try {
      const snap = await getDocs(query(collection(db, "pedidos_unidade"), where("uid", "==", uid)));
      setPedidos(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.status !== "aprovado"));
    } catch (e) { console.error(e); setPedidos([]); setErro(t("profileUpdate.units.errors.load")); }
  }, [souLider, uid, t]);
  useEffect(() => { carregar(); }, [carregar]);

  const papelNaUnidade = (u) => (u.liderUid === uid ? t("profileUpdate.units.leader1") : u.lider2Uid === uid ? t("profileUpdate.units.leader2") : "");
  const pendentes = (pedidos || []).filter((p) => p.status === "pendente");
  const idsPedidos = new Set(pendentes.map((p) => String(p.unidadeId)));
  const opcoes = unidades
    .filter((u) => !idsMinhas.has(String(u.id)) && !idsPedidos.has(String(u.id)))
    .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));

  async function pedir(e) {
    e.preventDefault();
    setErro("");
    const unidade = unidades.find((u) => String(u.id) === String(escolhida));
    if (!unidade) return setErro(t("profileUpdate.units.errors.choose"));
    if (pendentes.length >= MAX_UNIDADES_EXTRAS) return setErro(t("profileUpdate.units.errors.max", { max: MAX_UNIDADES_EXTRAS }));
    if (String(cracha?.telefone || "").length < 6 || String(cracha?.nome || "").length < 3) return setErro(t("profileUpdate.units.errors.profile"));
    setEnviando(true);
    try {
      const batch = writeBatch(db);
      pedirOutrasUnidades(batch, {
        uid, nome: cracha.nome, email: cracha.email || emailLogin || "", telefone: cracha.telefone,
        unidadeIds: [unidade.id], nomes: { [unidade.id]: unidade.nome }, atuais: minhas.map((u) => u.nome),
      });
      await batch.commit();
      setEscolhida("");
      await carregar();
    } catch (err) { console.error(err); setErro(t("profileUpdate.units.errors.send")); } finally { setEnviando(false); }
  }

  async function desistir(p) {
    setEnviando(true);
    try { await deleteDoc(doc(db, "pedidos_unidade", idDoPedidoUnidade(uid, p.unidadeId))); await carregar(); } catch (err) { console.error(err); setErro(t("profileUpdate.units.errors.send")); } finally { setEnviando(false); }
  }

  return (
    <section className="space-y-3">
      <h2 className={SECAO}>{t("profileUpdate.units.title")}</h2>
      <div className={CARTAO}>
        {minhas.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 normal-case">{t("profileUpdate.units.none")}</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {minhas.map((u) => (
              <li key={u.id} className="py-2 flex items-center justify-between gap-3">
                <span className="font-black text-sm text-slate-800 dark:text-white">{u.nome}</span>
                {papelNaUnidade(u) && <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{papelNaUnidade(u)}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {souLider && (
        <form onSubmit={pedir} className={CARTAO}>
          <h3 className="font-black text-slate-800 dark:text-white uppercase">{t("profileUpdate.units.requestTitle")}</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 normal-case">{t("profileUpdate.units.requestHint")}</p>
          {pedidos === undefined ? (
            <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-red-500" /></div>
          ) : (
            <>
              {pedidos.length > 0 && (
                <ul className="space-y-2">
                  {pedidos.map((p) => {
                    const f = faixaPedido[p.status] || faixaPedido.pendente;
                    return (
                      <li key={p.id} className={`text-sm font-bold flex flex-wrap items-center gap-2 ${f.cor}`}>
                        <f.Icone className="w-4 h-4" /> {p.unidadeNome || p.unidadeId} · {t(`profileUpdate.units.status.${p.status}`)}
                        {p.status === "recusado" && p.motivo && <span className="normal-case font-medium">({p.motivo})</span>}
                        <button type="button" onClick={() => desistir(p)} disabled={enviando} className="text-xs font-black uppercase underline">{p.status === "pendente" ? t("profileUpdate.units.cancel") : t("profileUpdate.units.dismiss")}</button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div>
                <label htmlFor="mc-outra-unidade" className={ROTULO}>{t("profileUpdate.units.choose")}</label>
                <select id="mc-outra-unidade" value={escolhida} onChange={(e) => setEscolhida(e.target.value)} disabled={enviando} className={CAMPO}>
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
      )}
    </section>
  );
}

// Pedidos de atualização de contrato (CLT ou Saver) feitos pelos professores, no topo da aba Professores.
// Quem confere: o líder da unidade, o mentor dela ou o admin. Aprovado = entra na ficha (vale para o valor da aula).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, X, Loader2, Building2, User, UserCog, Info } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useCatalogs } from "../../../contexts/CatalogContext";
import { unidadesDoLider } from "../../../permissions";
import { aprovarAtualizacao, listarAtualizacoesPendentes, recusarAtualizacao } from "../../../services/atualizacaoProfessorService";
import { resumoContrato } from "../../../utils/contrato";
import { fichasDoLogin } from "../../../utils/unidadeDoProfessor";

export default function AtualizacoesAConferir() {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { catalogs } = useCatalogs();
  const role = String(userData?.role || "").trim().toLowerCase();
  const userId = userData?.id || userData?.uid;
  const meuNome = userData?.nome || userData?.email || "-";
  const admin = role === "admin";

  const unidadeIds = useMemo(() => {
    if (admin) return [];
    if (role === "mentor") return (catalogs?.unidades || []).filter((u) => u.mentorId === userId).map((u) => String(u.id));
    return unidadesDoLider(userData);
  }, [admin, role, catalogs?.unidades, userId, userData]);
  const chave = unidadeIds.join(",");
  const podeVer = admin || (["mentor", "lider", "unidade"].includes(role) && unidadeIds.length > 0);

  const [lista, setLista] = useState([]);
  const [processando, setProcessando] = useState(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!podeVer) return;
    try { setLista(await listarAtualizacoesPendentes({ admin, unidadeIds })); }
    catch (e) { console.error("Erro ao ler atualizações de contrato", e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podeVer, admin, chave]);
  useEffect(() => { carregar(); }, [carregar]);

  const nomeDaUnidade = (id) => (catalogs?.unidades || []).find((u) => String(u.id) === String(id))?.nome || id;
  const quem = { id: userId, nome: meuNome, cracha: userData };

  async function decidir(pedido, recusar) {
    setErro("");
    let motivo = "";
    if (recusar) {
      motivo = window.prompt(t("profileUpdate.review.refusePrompt", { name: pedido.nome }), "");
      if (motivo === null) return;
    } else if (!window.confirm(t("profileUpdate.review.approveConfirm", { name: pedido.nome, value: resumoContrato(pedido, nomeDaUnidade) }))) return;
    setProcessando(pedido.id);
    try {
      if (recusar) await recusarAtualizacao({ pedido, motivo, quem });
      else await aprovarAtualizacao({ pedido, fichas: fichasDoLogin(catalogs, pedido.uid, null), quem, nomeDaUnidade });
      await carregar();
    } catch (e) {
      console.error(e);
      setErro(t(e?.message === "SEM_FICHA" ? "profileUpdate.review.noFicha" : "profileUpdate.review.error"));
    } finally { setProcessando(null); }
  }

  if (!lista.length) return null;

  return (
    <div className="mb-6 space-y-3 normal-case">
      <div>
        <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 uppercase">
          <UserCog className="w-5 h-5 text-red-500" /> {t("profileUpdate.review.title")}
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white">{lista.length}</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {t("profileUpdate.review.subtitle")}</p>
      </div>
      {erro && <p className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3">{erro}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {lista.map((p) => {
          const ficha = fichasDoLogin(catalogs, p.uid, null)[0];
          return (
            <div key={p.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-3">
              <div>
                <p className="font-black text-slate-800 dark:text-white flex items-center gap-2"><User className="w-4 h-4 text-slate-400" /> {p.nome}</p>
                <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5"><Building2 className="w-3.5 h-3.5" /> {nomeDaUnidade(p.unidadeId)}</p>
              </div>
              <div className="text-xs space-y-1">
                <p><span className="text-slate-500">{t("profileUpdate.review.before")}:</span> <b>{resumoContrato(ficha || {}, nomeDaUnidade)}</b></p>
                <p><span className="text-slate-500">{t("profileUpdate.review.after")}:</span> <b className="text-red-600">{resumoContrato(p, nomeDaUnidade)}</b></p>
                {!ficha && <p className="text-amber-600 font-bold">{t("profileUpdate.review.noFicha")}</p>}
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" disabled={processando === p.id} onClick={() => decidir(p, true)} className="px-3 py-2 rounded-lg text-xs font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 flex items-center gap-1 disabled:opacity-50"><X className="w-3.5 h-3.5" /> {t("profileUpdate.review.refuse")}</button>
                <button type="button" disabled={processando === p.id || !ficha} onClick={() => decidir(p, false)} className="px-3 py-2 rounded-lg text-xs font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 disabled:opacity-50">
                  {processando === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {t("profileUpdate.review.approve")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

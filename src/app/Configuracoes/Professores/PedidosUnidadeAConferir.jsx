// Pedidos de UNIDADE NOVA feitos pelos professores (Meu cadastro), no topo da aba Professores.
// Quem confere: o líder da unidade pedida, o mentor dela ou o admin. Aprovado = vira vínculo na grade do professor.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, X, Loader2, Building2, User, Info } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useCatalogs } from "../../../contexts/CatalogContext";
import { unidadesDoLider, ehDoMeuEscopo } from "../../../permissions";
import { aprovarPedidoDeUnidade, listarPedidosDeUnidadePendentes, recusarPedidoDeUnidade } from "../../../services/pedidoUnidadeProfessorService";

export default function PedidosUnidadeAConferir() {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { catalogs } = useCatalogs();
  const role = String(userData?.role || "").trim().toLowerCase();
  const userId = userData?.id || userData?.uid;
  const meuNome = userData?.nome || userData?.email || "-";
  const admin = role === "admin";

  const unidadeIds = useMemo(() => {
    if (admin) return [];
    if (role === "mentor") return (catalogs?.unidades || []).filter((u) => ehDoMeuEscopo(userData, u.mentorId)).map((u) => String(u.id));
    return unidadesDoLider(userData);
  }, [admin, role, catalogs?.unidades, userData]);
  const chave = unidadeIds.join(",");
  const podeVer = admin || (["mentor", "lider", "unidade"].includes(role) && unidadeIds.length > 0);

  const [lista, setLista] = useState([]);
  const [processando, setProcessando] = useState(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!podeVer) return;
    try { setLista(await listarPedidosDeUnidadePendentes({ admin, unidadeIds })); }
    catch (e) { console.error("Erro ao ler pedidos de unidade do professor", e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podeVer, admin, chave]);
  useEffect(() => { carregar(); }, [carregar]);

  const quem = { id: userId, nome: meuNome, cracha: userData };
  const jaVinculado = (p) => (catalogs?.vinculos || []).some((v) => String(v.professorId) === String(p.professorId) && String(v.unidadeId) === String(p.unidadeId));

  async function decidir(pedido, recusar) {
    setErro("");
    let motivo = "";
    if (recusar) {
      motivo = window.prompt(t("profileUpdate.unitReview.refusePrompt", { name: pedido.nome }), "");
      if (motivo === null) return;
    } else if (!window.confirm(t("profileUpdate.unitReview.approveConfirm", { name: pedido.nome, unit: pedido.unidadeNome || pedido.unidadeId }))) return;
    setProcessando(pedido.id);
    try {
      if (recusar) await recusarPedidoDeUnidade({ pedido, motivo, quem });
      else await aprovarPedidoDeUnidade({ pedido, jaVinculado: jaVinculado(pedido), quem });
      await carregar();
    } catch (e) {
      console.error(e);
      setErro(t("profileUpdate.review.error"));
    } finally { setProcessando(null); }
  }

  if (!lista.length) return null;

  return (
    <div className="mb-6 space-y-3 normal-case">
      <div>
        <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 uppercase">
          <Building2 className="w-5 h-5 text-red-500" /> {t("profileUpdate.unitReview.title")}
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white">{lista.length}</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {t("profileUpdate.unitReview.subtitle")}</p>
      </div>
      {erro && <p className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3">{erro}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {lista.map((p) => (
          <div key={p.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-3">
            <div>
              <p className="font-black text-slate-800 dark:text-white flex items-center gap-2"><User className="w-4 h-4 text-slate-400" /> {p.nome}</p>
              <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5"><Building2 className="w-3.5 h-3.5" /> <b className="text-red-600">{p.unidadeNome || p.unidadeId}</b></p>
              {jaVinculado(p) && <p className="text-xs text-amber-600 font-bold mt-1">{t("profileUpdate.unitReview.already")}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" disabled={processando === p.id} onClick={() => decidir(p, true)} className="px-3 py-2 rounded-lg text-xs font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 flex items-center gap-1 disabled:opacity-50"><X className="w-3.5 h-3.5" /> {t("profileUpdate.review.refuse")}</button>
              <button type="button" disabled={processando === p.id} onClick={() => decidir(p, false)} className="px-3 py-2 rounded-lg text-xs font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 disabled:opacity-50">
                {processando === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {t("profileUpdate.review.approve")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

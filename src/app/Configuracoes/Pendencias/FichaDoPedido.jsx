// No cartão do pedido de professor: "Esta pessoa já tem ficha na grade?" Mostra as fichas parecidas (documento,
// e-mail, telefone, nome) e deixa quem aprova escolher a que será ligada ao novo login, ou nenhuma.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Link2, TriangleAlert } from "lucide-react";
import { acharFichasDoPedido } from "../../../services/aprovarProfessorService";
import { escolhaInicial } from "../../../utils/repetidos";

// onMudar({ carregando, erro, candidatas, documento, fichaId })
export default function FichaDoPedido({ pedido, fichas, pais, podeVerDocumento, ocupado, onMudar }) {
  const { t } = useTranslation();
  const [estado, setEstado] = useState({ carregando: true, erro: false, candidatas: [], documento: null });
  const [fichaId, setFichaId] = useState("");

  useEffect(() => {
    let vivo = true;
    onMudar({ carregando: true, erro: false, candidatas: [], documento: null, fichaId: "" });
    acharFichasDoPedido({ pedido, fichas, pais, podeVerDocumento })
      .then((r) => {
        if (!vivo) return;
        const inicial = escolhaInicial(r.candidatas);
        setEstado({ carregando: false, erro: false, ...r });
        setFichaId(inicial);
        onMudar({ carregando: false, erro: false, ...r, fichaId: inicial });
      })
      .catch((e) => {
        console.error("Procurar ficha do pedido:", e);
        if (!vivo) return;
        setEstado({ carregando: false, erro: true, candidatas: [], documento: null });
        onMudar({ carregando: false, erro: true, candidatas: [], documento: null, fichaId: "" });
      });
    return () => { vivo = false; };
    // Procura uma vez por pedido (a lista de fichas do catálogo muda ao vivo e não deve refazer as leituras).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido.id]);

  const escolher = (id) => { setFichaId(id); onMudar({ ...estado, fichaId: id }); };

  if (estado.carregando) {
    return <p className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("pendingTab.teacher.link.searching")}</p>;
  }
  if (estado.erro) {
    return <p className="text-xs text-amber-600 font-bold flex items-center gap-1.5"><TriangleAlert className="w-3.5 h-3.5" /> {t("pendingTab.teacher.link.error")}</p>;
  }
  if (estado.candidatas.length === 0) {
    return <p className="text-xs text-slate-500 flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> {t("pendingTab.teacher.link.none")}</p>;
  }
  return (
    <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-900/10 space-y-2">
      <p className="text-xs font-black text-red-800 dark:text-red-300 flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> {t("pendingTab.teacher.link.title")}</p>
      <div className="space-y-1">
        {estado.candidatas.map(({ ficha, campos, bloqueada }) => (
          <label key={ficha.id} className={`flex gap-2 items-start text-xs ${bloqueada ? "opacity-60" : "cursor-pointer"}`}>
            <input type="radio" className="mt-0.5" name={`ficha_${pedido.id}`} disabled={ocupado || !!bloqueada}
              checked={fichaId === String(ficha.id)} onChange={() => escolher(String(ficha.id))} />
            <span className="min-w-0">
              <span className="font-bold text-slate-800 dark:text-slate-100">{ficha.nome || "—"}</span>
              <span className="text-slate-500"> · {[ficha.email, ficha.telefone].filter(Boolean).join(" · ") || "—"}</span>
              <span className="block text-[10px] text-red-700 dark:text-red-400 font-bold">
                {t("pendingTab.teacher.link.matches")}: {campos.map((c) => t(`pendingTab.teacher.link.field.${c}`)).join(", ")}
              </span>
              {bloqueada && <span className="block text-[10px] text-red-600 font-bold">{t(`pendingTab.teacher.link.blocked.${bloqueada}`)}</span>}
            </span>
          </label>
        ))}
        <label className="flex gap-2 items-start text-xs cursor-pointer">
          <input type="radio" className="mt-0.5" name={`ficha_${pedido.id}`} disabled={ocupado} checked={fichaId === ""} onChange={() => escolher("")} />
          <span className="font-bold text-slate-700 dark:text-slate-200">{t("pendingTab.teacher.link.noneOfThem")}</span>
        </label>
      </div>
    </div>
  );
}

// Certificados de workshop dos professores aguardando conferência, no topo da aba Professores.
// Quem confere: o líder da unidade, o mentor dela ou o admin (ver regras de certificados_professor).
// Lista pequena: lê uma vez ao abrir a aba e depois de cada decisão (a foto vem junto no documento).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Award, Check, X, Loader2, Building2, User, Info } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useCatalogs } from "../../../contexts/CatalogContext";
import { unidadesDoLider } from "../../../permissions";
import { listarPendentes, recusarCertificado, verificarCertificado } from "../../../services/certificadoService";

export default function CertificadosAVerificar() {
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

  const [lista, setLista] = useState([]);
  const [processando, setProcessando] = useState(null);
  const [ampliada, setAmpliada] = useState("");
  const podeVer = admin || (["mentor", "lider", "unidade"].includes(role) && unidadeIds.length > 0);

  const carregar = useCallback(async () => {
    if (!podeVer) return;
    try { setLista(await listarPendentes({ admin, unidadeIds })); }
    catch (e) { console.error("Erro ao ler certificados", e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podeVer, admin, chave]);
  useEffect(() => { carregar(); }, [carregar]);

  const quem = { id: userId, nome: meuNome, cracha: userData };
  const nomeUnidade = (id) => (catalogs?.unidades || []).find((u) => String(u.id) === String(id))?.nome || id;

  async function decidir(c, recusar) {
    let motivo = "";
    if (recusar) {
      motivo = window.prompt(t("certificates.review.refusePrompt", { name: c.nome, workshop: c.workshop }), "");
      if (motivo === null) return;
    } else if (!window.confirm(t("certificates.review.verifyConfirm", { name: c.nome, workshop: c.workshop }))) return;
    setProcessando(c.id);
    try {
      if (recusar) await recusarCertificado(c, motivo, quem); else await verificarCertificado(c, quem);
      await carregar();
    } catch (e) {
      console.error(e);
      alert(t("certificates.review.error"));
    } finally { setProcessando(null); }
  }

  if (!lista.length) return null;

  return (
    <div className="mb-6 space-y-3">
      <div>
        <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
          <Award className="w-5 h-5 text-red-500" /> {t("certificates.review.title")}
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white">{lista.length}</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {t("certificates.review.subtitle")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {lista.map((c) => {
          const ocupado = processando === c.id;
          return (
            <div key={c.id} className="p-5 rounded-2xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-800 shadow-sm space-y-3">
              <div className="flex gap-4">
                <button type="button" onClick={() => setAmpliada(c.foto)} className="shrink-0" title={t("certificates.review.enlarge")}>
                  <img src={c.foto} alt="" className="w-24 h-24 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                </button>
                <div className="min-w-0 space-y-1">
                  <p className="font-black text-slate-800 dark:text-white flex items-center gap-2"><User className="w-4 h-4 text-blue-500 shrink-0" /> {c.nome}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-2"><Building2 className="w-3 h-3 shrink-0" /> {nomeUnidade(c.unidadeId)}</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 break-words">{c.workshop}</p>
                  <p className="text-xs text-slate-500">{t("certificates.review.doneOn", { date: c.dataFeito?.split("-").reverse().join("/") })}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => decidir(c, true)} disabled={ocupado} className="px-4 py-2 rounded-lg text-xs font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-200 flex items-center gap-1.5 disabled:opacity-50">
                  <X className="w-3.5 h-3.5" /> {t("certificates.review.refuse")}
                </button>
                <button onClick={() => decidir(c, false)} disabled={ocupado} className="px-4 py-2 rounded-lg text-xs font-black uppercase bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1.5 disabled:opacity-50">
                  {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {t("certificates.review.verify")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {ampliada && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setAmpliada("")}>
          <img src={ampliada} alt="" className="max-h-full max-w-full rounded-xl" />
        </div>
      )}
    </div>
  );
}

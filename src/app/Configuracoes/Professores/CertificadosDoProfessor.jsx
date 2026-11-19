// Workshops de UM professor, na aba Professores. Valem para TODAS as unidades dele: ficam no próprio cadastro
// do professor (professores/{id}.workshops), sem foto e sem leituras extras (o cadastro já chega ao vivo).
// Quem adiciona: líder, mentor ou admin. Funciona também para professor sem login pessoal.
// (O certificado com foto que o professor envia pelo login dele é conferido na seção "Certificados de workshop
// para conferir" desta mesma aba e, ao ser verificado, entra nesta lista.)
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Award, Loader2, Trash2, X } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useCatalogs } from "../../../contexts/CatalogContext";
import { adicionarWorkshopAoProfessor, removerWorkshopDoProfessor } from "../../../services/certificadoService";
import { registrarAuditoriaAcesso } from "../../../services/auditoriaAcessos";
import { dataDoWorkshopValida } from "../../../utils/imagem";

const campo = "w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-red-500";
const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** @param {{professor: object, onClose: () => void}} props */
export default function CertificadosDoProfessor({ professor, onClose }) {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { catalogs } = useCatalogs();
  const quem = userData?.nome || userData?.email || "-";
  // Sempre a versão mais nova do cadastro (o catálogo é ao vivo).
  const atual = (catalogs?.professores || []).find((p) => String(p.id) === String(professor.id)) || professor;
  const lista = [...(atual.workshops || [])].sort((a, b) => String(b.data).localeCompare(String(a.data)));

  const [nome, setNome] = useState("");
  const [data, setData] = useState("");
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");

  async function adicionar(e) {
    e.preventDefault();
    setErro("");
    if (nome.trim().length < 3) return setErro(t("certificates.errors.name"));
    if (!dataDoWorkshopValida(data)) return setErro(t("certificates.errors.date"));
    setProcessando(true);
    try {
      await adicionarWorkshopAoProfessor({ professorId: professor.id, nome, data, por: quem });
      try {
        await registrarAuditoriaAcesso({
          tipoAcao: "NOVA", descricao: "Workshop adicionado ao professor.", unidadeNome: "-", quem: userData,
          detalhes: `Workshop: ${nome.trim()} (${data})`, alvo: { id: professor.id, nome: professor.nome },
        });
      } catch (err) { console.error("Falha ao gravar auditoria", err); }
      setNome(""); setData("");
    } catch (err) {
      console.error(err);
      setErro(t("certificates.errors.save"));
    } finally { setProcessando(false); }
  }

  async function apagar(w) {
    if (!window.confirm(t("certificates.deleteConfirm", { name: w.nome }))) return;
    setProcessando(true);
    try { await removerWorkshopDoProfessor({ professorId: professor.id, atuais: atual.workshops, id: w.id }); }
    catch (err) { console.error(err); setErro(t("certificates.errors.delete")); }
    finally { setProcessando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2"><Award className="w-5 h-5 text-red-500 shrink-0" /> {t("certificates.manager.title", { name: professor.nome })}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t("certificates.manager.subtitle")}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={adicionar} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
          <h4 className="font-black text-sm text-slate-800 dark:text-white">{t("certificates.manager.add")}</h4>
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} className={campo} placeholder={t("certificates.fields.workshopPlaceholder")} aria-label={t("certificates.fields.workshop")} />
          <div className="space-y-1">
            <label htmlFor="ws-data" className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t("certificates.manager.dateLabel")}</label>
            <input id="ws-data" type="date" value={data} max={hojeISO()} min="2000-01-01" onChange={(e) => setData(e.target.value)} className={campo} />
          </div>
          {erro && <p className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3">{erro}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={processando} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 disabled:opacity-50">
              {processando && <Loader2 className="w-4 h-4 animate-spin" />} {t("certificates.manager.addButton")}
            </button>
          </div>
        </form>

        <div className="space-y-2">
          {lista.length === 0 ? (
            <p className="text-sm text-slate-400 font-bold">{t("certificates.manager.empty")}</p>
          ) : lista.map((w) => (
            <div key={w.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-black text-sm text-slate-800 dark:text-white break-words">{w.nome}</p>
                <p className="text-xs text-slate-500">{w.data?.split("-").reverse().join("/")} · {t("certificates.manager.by", { name: w.por })}</p>
              </div>
              <button type="button" disabled={processando} onClick={() => apagar(w)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30" title={t("certificates.delete")}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

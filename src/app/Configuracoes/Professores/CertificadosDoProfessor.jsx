// Workshops (certificados) de UM professor do cadastro, na aba Professores: lista com todos os status
// e formulário para o gestor (líder da unidade, mentor dela ou admin) adicionar um certificado.
// O que o gestor adiciona já entra como verificado. Funciona também para professor sem login pessoal.
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Award, Camera, CheckCircle2, Clock, Loader2, Trash2, X, XCircle } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import {
  adicionarCertificadoDoProfessor, apagarCertificado, listarDoProfessor, recusarCertificado, verificarCertificado,
} from "../../../services/certificadoService";
import { comprimirImagem, dataDoWorkshopValida } from "../../../utils/imagem";

const ESTILO = {
  pendente: { cor: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", Icone: Clock },
  verificado: { cor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", Icone: CheckCircle2 },
  recusado: { cor: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300", Icone: XCircle },
};
const campo = "w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-red-500";
const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** @param {{professor: object, unidades: {id:string,nome:string}[], onClose: () => void}} props
 *  `unidades` = unidades do professor que esta pessoa pode mexer (vazio só para o admin). */
export default function CertificadosDoProfessor({ professor, unidades, onClose }) {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const role = String(userData?.role || "").trim().toLowerCase();
  const admin = role === "admin";
  const userId = userData?.id || userData?.uid;
  const quem = { id: userId, nome: userData?.nome || userData?.email || "-", cracha: userData };
  const arquivoRef = useRef(null);
  const unidadeIds = unidades.map((u) => String(u.id));
  const podeAdicionar = admin || unidades.length > 0;

  const [lista, setLista] = useState(null);
  const [unidadeId, setUnidadeId] = useState(unidades[0]?.id ? String(unidades[0].id) : "");
  const [workshop, setWorkshop] = useState("");
  const [dataFeito, setDataFeito] = useState("");
  const [foto, setFoto] = useState("");
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");
  const [ampliada, setAmpliada] = useState("");

  const carregar = useCallback(async () => {
    if (!admin && unidadeIds.length === 0) { setLista([]); return; }
    try { setLista(await listarDoProfessor({ professorId: String(professor.id), uidLogin: professor.uidLogin, admin, unidadeIds })); }
    catch (e) { console.error(e); setLista([]); setErro(t("certificates.errors.load")); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professor.id, professor.uidLogin, admin, unidadeIds.join(",")]);
  useEffect(() => { carregar(); }, [carregar]);

  async function escolherFoto(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setErro(""); setProcessando(true);
    try { setFoto(await comprimirImagem(arquivo)); }
    catch (err) {
      console.error(err);
      setErro(t(err?.message === "NAO_E_IMAGEM" ? "certificates.errors.notImage" : "certificates.errors.photo"));
    } finally { setProcessando(false); }
  }

  async function adicionar(e) {
    e.preventDefault();
    setErro("");
    if (workshop.trim().length < 3) return setErro(t("certificates.errors.name"));
    if (!dataDoWorkshopValida(dataFeito)) return setErro(t("certificates.errors.date"));
    if (!foto) return setErro(t("certificates.errors.noPhoto"));
    setProcessando(true);
    try {
      await adicionarCertificadoDoProfessor({ professor, unidadeId, workshop, dataFeito, foto, quem });
      setWorkshop(""); setDataFeito(""); setFoto("");
      await carregar();
    } catch (err) {
      console.error(err);
      setErro(t("certificates.errors.save"));
    } finally { setProcessando(false); }
  }

  async function decidir(c, recusar) {
    let motivo = "";
    if (recusar) {
      motivo = window.prompt(t("certificates.review.refusePrompt", { name: c.nome, workshop: c.workshop }), "");
      if (motivo === null) return;
    }
    setProcessando(true);
    try {
      if (recusar) await recusarCertificado(c, motivo, quem); else await verificarCertificado(c, quem);
      await carregar();
    } catch (err) { console.error(err); setErro(t("certificates.review.error")); }
    finally { setProcessando(false); }
  }

  async function apagar(c) {
    if (!window.confirm(t("certificates.deleteConfirm", { name: c.workshop }))) return;
    try { await apagarCertificado(c.id); await carregar(); } catch (err) { console.error(err); setErro(t("certificates.errors.delete")); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2"><Award className="w-5 h-5 text-red-500 shrink-0" /> {t("certificates.manager.title", { name: professor.nome })}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t("certificates.manager.subtitle")}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        {podeAdicionar && (
          <form onSubmit={adicionar} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <h4 className="font-black text-sm text-slate-800 dark:text-white">{t("certificates.manager.add")}</h4>
            <input value={workshop} onChange={(e) => setWorkshop(e.target.value)} maxLength={120} className={campo} placeholder={t("certificates.fields.workshopPlaceholder")} aria-label={t("certificates.fields.workshop")} />
            <input type="date" value={dataFeito} max={hojeISO()} min="2000-01-01" onChange={(e) => setDataFeito(e.target.value)} className={campo} aria-label={t("certificates.fields.date")} />
            {unidades.length > 1 && (
              <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)} className={campo} aria-label={t("certificates.manager.unit")}>
                {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            )}
            <input ref={arquivoRef} type="file" accept="image/*" onChange={escolherFoto} className="hidden" />
            {foto && <img src={foto} alt="" className="max-h-48 rounded-xl border border-slate-200 dark:border-slate-700" />}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <button type="button" disabled={processando} onClick={() => arquivoRef.current?.click()} className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 flex items-center gap-2 disabled:opacity-50">
                <Camera className="w-4 h-4" /> {foto ? t("certificates.changePhoto") : t("certificates.choosePhoto")}
              </button>
              <button type="submit" disabled={processando} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 disabled:opacity-50">
                {processando && <Loader2 className="w-4 h-4 animate-spin" />} {t("certificates.manager.addButton")}
              </button>
            </div>
            {erro && <p className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3">{erro}</p>}
          </form>
        )}

        <div className="space-y-3">
          {lista === null ? (
            <div className="py-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-red-500" /></div>
          ) : lista.length === 0 ? (
            <p className="text-sm text-slate-400 font-bold">{t("certificates.manager.empty")}</p>
          ) : lista.map((c) => {
            const { cor, Icone } = ESTILO[c.status] || ESTILO.pendente;
            const doGestor = !!c.professorId;
            return (
              <div key={c.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex gap-3">
                <button type="button" onClick={() => setAmpliada(c.foto)} className="shrink-0"><img src={c.foto} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700" /></button>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-black text-sm text-slate-800 dark:text-white break-words">{c.workshop}</p>
                  <p className="text-xs text-slate-500">{c.dataFeito?.split("-").reverse().join("/")} · {t(doGestor ? "certificates.manager.byManager" : "certificates.manager.byTeacher")}</p>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${cor}`}><Icone className="w-3 h-3" /> {t(`certificates.status.${c.status}`)}</span>
                  {c.status === "recusado" && c.motivo && <p className="text-xs text-red-600 dark:text-red-400 font-bold">{t("certificates.reason", { reason: c.motivo })}</p>}
                  <div className="flex gap-3 pt-1">
                    {c.status === "pendente" && (
                      <>
                        <button type="button" disabled={processando} onClick={() => decidir(c, false)} className="text-xs font-black uppercase text-emerald-600 hover:underline">{t("certificates.review.verify")}</button>
                        <button type="button" disabled={processando} onClick={() => decidir(c, true)} className="text-xs font-black uppercase text-red-600 hover:underline">{t("certificates.review.refuse")}</button>
                      </>
                    )}
                    {doGestor && <button type="button" onClick={() => apagar(c)} className="text-xs font-black uppercase text-slate-400 hover:text-red-600 flex items-center gap-1"><Trash2 className="w-3 h-3" /> {t("certificates.delete")}</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {ampliada && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); setAmpliada(""); }}>
          <img src={ampliada} alt="" className="max-h-full max-w-full rounded-xl" />
        </div>
      )}
    </div>
  );
}

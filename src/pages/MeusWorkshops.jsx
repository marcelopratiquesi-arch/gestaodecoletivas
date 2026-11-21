// "Meus workshops": o professor informa o workshop que fez, a data e a foto do certificado.
// A foto é reduzida no aparelho e guardada no próprio documento (ver utils/imagem.js). O líder da unidade,
// o mentor dela ou o admin verifica (aba Professores). Recusado: o professor corrige e reenvia.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Award, Camera, CheckCircle2, Clock, Loader2, Trash2, XCircle, AlertTriangle, GraduationCap } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useCatalogs } from "../contexts/CatalogContext";
import { apagarCertificado, enviarCertificado, listarMeusCertificados, listarWorkshopsEscolhiveis } from "../services/certificadoService";
import { comprimirImagem } from "../utils/imagem";
import { fichasDoLogin, opcoesDeUnidadeDoProfessor } from "../utils/unidadeDoProfessor";

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

// Dia / mês / ano para o "calendarinho" de cada workshop.
function partesDaData(data, idioma) {
  const d = new Date(`${data}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return { dia: String(d.getDate()).padStart(2, "0"), mes: d.toLocaleDateString(idioma, { month: "short" }).replace(".", ""), ano: String(d.getFullYear()) };
}

export default function MeusWorkshops() {
  const { t, i18n } = useTranslation();
  const { user, userData } = useAuth();
  const { catalogs } = useCatalogs();
  // Admin em "Ver como professor": envia no lugar do professor; o certificado fica na conta (login) dele.
  const vendoComo = userData?.visaoAdmin?.tipo === "professor";
  const fichaVista = vendoComo ? (catalogs?.professores || []).find((p) => String(p.id) === String(userData?.professorId)) : null;
  const uid = vendoComo ? (fichaVista?.uidLogin || "") : user?.uid;
  const nomeDono = String((vendoComo ? fichaVista?.nome : userData?.nome) || user?.email || "-").slice(0, 80);
  const arquivoRef = useRef(null);

  // Unidade que confere: escolhida sozinha (a do crachá; crachá antigo sem unidade = 1ª unidade dos vínculos).
  // O professor não escolhe: o admin vê todos e o líder/mentor dessa unidade também (sem leitura extra).
  const opcoesUnidade = useMemo(() => opcoesDeUnidadeDoProfessor({ userData, uid, catalogs }), [userData, uid, catalogs]);
  const destino = opcoesUnidade[0] || null;

  const [lista, setLista] = useState(null);
  const [workshopId, setWorkshopId] = useState("");
  const [cadastrados, setCadastrados] = useState(null); // workshops do cadastro, lidos uma vez
  const [substitui, setSubstitui] = useState(null); // certificado antigo (texto livre) que será trocado
  const [foto, setFoto] = useState("");
  const [reenviando, setReenviando] = useState(null); // id do recusado que está sendo corrigido
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");
  const [ampliada, setAmpliada] = useState("");

  const carregar = useCallback(async () => {
    if (!uid) return;
    try { setLista(await listarMeusCertificados(uid)); }
    catch (e) { console.error(e); setLista([]); setErro(t("certificates.errors.load")); }
  }, [uid, t]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    listarWorkshopsEscolhiveis(hojeISO()).then(setCadastrados).catch((e) => { console.error(e); setCadastrados([]); setErro(t("certificates.errors.loadList")); });
  }, [t]);

  // Workshops que JÁ CONSTAM no cadastro dele (ficha da grade: os que a equipe lançou, os da lista importada e os de certificado verificado).
  // Vem do catálogo: zero leituras. Junta as fichas do mesmo login sem repetir, do mais novo para o mais antigo.
  const feitos = useMemo(() => {
    const fichas = vendoComo ? (fichaVista ? [fichaVista] : []) : fichasDoLogin(catalogs, uid, userData);
    const unicos = new Map();
    fichas.forEach((f) => (f.workshops || []).forEach((w) => {
      const chave = w.workshopId ? `wk_${w.workshopId}` : (w.id || `${w.nome}|${w.data}`);
      if (!unicos.has(chave)) unicos.set(chave, w);
    }));
    return [...unicos.values()].sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")));
  }, [catalogs, uid, userData, vendoComo, fichaVista]);

  // Já constam: no perfil (catálogo, sem leitura) ou em certificado enviado e não recusado.
  const jaConsta = useMemo(() => {
    const ids = new Set();
    (catalogs?.professores || []).filter((p) => (p.uidLogin && p.uidLogin === uid) || (userData?.professorId && String(p.id) === String(userData.professorId)))
      .forEach((p) => (p.workshops || []).forEach((w) => w.workshopId && ids.add(String(w.workshopId))));
    (lista || []).filter((c) => c.workshopId && c.status !== "recusado").forEach((c) => ids.add(String(c.workshopId)));
    return ids;
  }, [catalogs, uid, userData, lista]);
  const escolhido = (cadastrados || []).find((w) => w.id === workshopId);

  async function escolherFoto(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setErro(""); setProcessando(true);
    try { setFoto(await comprimirImagem(arquivo)); }
    catch (err) {
      console.error(err);
      setErro(t(err?.message === "NAO_E_IMAGEM" ? "certificates.errors.notImage" : err?.message === "PDF_INVALIDO" ? "certificates.errors.pdf" : "certificates.errors.photo"));
    } finally { setProcessando(false); }
  }

  function limpar() { setWorkshopId(""); setFoto(""); setReenviando(null); setSubstitui(null); }

  async function enviar(e) {
    e.preventDefault();
    setErro("");
    if (!escolhido) return setErro(t("certificates.errors.choose"));
    if (!foto) return setErro(t("certificates.errors.noPhoto"));
    if (!destino) return setErro(t("certificates.errors.chooseUnit"));
    setProcessando(true);
    try {
      await enviarCertificado({ uid, unidadeId: destino.unidadeId, vinculoId: destino.vinculoId, nome: nomeDono, workshopId: escolhido.id, modalidade: escolhido.modalidade, workshop: escolhido.nome, dataFeito: escolhido.data, foto });
      if (substitui) { try { await apagarCertificado(substitui); } catch (e) { console.error(e); } }
      limpar();
      await carregar();
    } catch (err) {
      console.error(err);
      setErro(t("certificates.errors.save"));
    } finally { setProcessando(false); }
  }

  function corrigir(c) {
    // Certificado antigo (texto livre) não tem workshop do cadastro: a pessoa escolhe na lista e o antigo é trocado.
    setReenviando(c.id); setWorkshopId(c.workshopId || ""); setSubstitui(c.workshopId ? null : c.id); setFoto(c.foto); setErro("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function apagar(c) {
    if (!window.confirm(t("certificates.deleteConfirm", { name: c.workshop }))) return;
    try { await apagarCertificado(c.id); await carregar(); } catch (err) { console.error(err); setErro(t("certificates.errors.delete")); }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
          <span className="p-2 bg-red-600 text-white rounded-lg"><Award className="w-6 h-6" /></span>
          {t("certificates.title")}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{t("certificates.subtitle")}</p>
      </div>

      {/* ===== WORKSHOPS QUE JÁ CONSTAM NO CADASTRO ===== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2"><GraduationCap className="w-5 h-5 text-red-600" /> {t("certificates.done.title")}</h2>
          {feitos.length > 0 && <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t("certificates.done.count", { count: feitos.length })}</span>}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t("certificates.done.hint")}</p>
        {feitos.length === 0 ? (
          <p className="text-sm text-slate-400 font-bold py-3">{t("certificates.done.empty")}</p>
        ) : (
          <div className="space-y-2.5">
            {feitos.map((w, i) => {
              const parte = partesDaData(w.data, i18n.language);
              const ano = String(w.data || "").slice(0, 4);
              const novoAno = i === 0 || ano !== String(feitos[i - 1].data || "").slice(0, 4);
              const registrado = w.em ? new Date(w.em) : null;
              return (
                <div key={w.id || `${w.nome}-${i}`}>
                  {novoAno && ano && <h3 className="pt-1 pb-1.5 text-[11px] font-black text-slate-400 uppercase tracking-widest">{ano}</h3>}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3.5 flex items-center gap-4">
                    <div className="w-12 shrink-0 text-center leading-none">
                      {parte ? (
                        <>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{parte.mes}</p>
                          <p className="text-2xl font-black text-slate-700 dark:text-slate-200 my-0.5 tabular-nums">{parte.dia}</p>
                          <p className="text-[10px] font-semibold text-slate-400">{parte.ano}</p>
                        </>
                      ) : <p className="text-[10px] font-bold text-slate-400">-</p>}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="font-bold text-slate-800 dark:text-white break-words leading-snug">{w.nome}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        {w.modalidade && <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 font-bold">{w.modalidade}</span>}
                        {registrado && !Number.isNaN(registrado.getTime()) && <span>{t("certificates.done.registered", { date: registrado.toLocaleDateString(i18n.language) })}</span>}
                      </div>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><CheckCircle2 className="w-3 h-3" /> {t("certificates.done.ok")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {vendoComo && !uid ? (
        <div className="flex gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 shrink-0" /> {t("certificates.viewAsNoLogin")}
        </div>
      ) : opcoesUnidade.length === 0 ? (
        <div className="flex gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 shrink-0" /> {t("certificates.noUnit")}
        </div>
      ) : (
        <form onSubmit={enviar} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm space-y-4">
          <h2 className="font-black text-slate-800 dark:text-white">{reenviando ? t("certificates.fix") : t("certificates.add")}</h2>
          <div className="space-y-1">
            <label htmlFor="cert-workshop" className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t("certificates.fields.workshop")}</label>
            <select id="cert-workshop" value={workshopId} onChange={(e) => setWorkshopId(e.target.value)} disabled={cadastrados === null} className={campo}>
              <option value="">{cadastrados === null ? t("certificates.loadingList") : t("certificates.fields.workshopPlaceholder")}</option>
              {(cadastrados || []).map((w) => (
                <option key={w.id} value={w.id} disabled={jaConsta.has(w.id) && w.id !== workshopId}>
                  {w.nome} — {w.data.split("-").reverse().join("/")}{jaConsta.has(w.id) && w.id !== workshopId ? ` (${t("certificates.alreadyListed")})` : ""}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400">{t("certificates.fields.workshopHint")}</p>
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t("certificates.fields.photo")}</span>
            <input ref={arquivoRef} type="file" accept="image/*,application/pdf,.pdf" onChange={escolherFoto} className="hidden" />
            {foto && <img src={foto} alt={t("certificates.fields.photo")} className="max-h-64 rounded-xl border border-slate-200 dark:border-slate-700" />}
            <button type="button" disabled={processando} onClick={() => arquivoRef.current?.click()}
              className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 flex items-center gap-2 disabled:opacity-50">
              <Camera className="w-4 h-4" /> {foto ? t("certificates.changePhoto") : t("certificates.choosePhoto")}
            </button>
            <p className="text-[11px] text-slate-400">{t("certificates.photoHint")}</p>
          </div>
          {erro && <p className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3">{erro}</p>}
          <div className="flex justify-end gap-2">
            {reenviando && <button type="button" onClick={limpar} disabled={processando} className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200">{t("certificates.cancel")}</button>}
            <button type="submit" disabled={processando} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 disabled:opacity-50">
              {processando && <Loader2 className="w-4 h-4 animate-spin" />} {t("certificates.send")}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-black text-slate-800 dark:text-white">{t("certificates.sent")}</h2>
        {lista === null ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-red-500" /></div>
        ) : lista.length === 0 ? (
          <p className="text-sm text-slate-400 font-bold py-4">{t("certificates.empty")}</p>
        ) : lista.map((c) => {
          const { cor, Icone } = ESTILO[c.status] || ESTILO.pendente;
          return (
            <div key={c.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex gap-4">
              <button type="button" onClick={() => setAmpliada(c.foto)} className="shrink-0">
                <img src={c.foto} alt="" className="w-20 h-20 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
              </button>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-black text-slate-800 dark:text-white break-words">{c.workshop}</p>
                <p className="text-xs text-slate-500">{c.dataFeito?.split("-").reverse().join("/")}</p>
                <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${cor}`}>
                  <Icone className="w-3 h-3" /> {t(`certificates.status.${c.status}`)}
                </span>
                {c.status === "recusado" && c.motivo && <p className="text-xs text-red-600 dark:text-red-400 font-bold">{t("certificates.reason", { reason: c.motivo })}</p>}
                <div className="flex gap-2 pt-1">
                  {c.status === "recusado" && <button type="button" onClick={() => corrigir(c)} className="text-xs font-black uppercase text-red-600 hover:underline">{t("certificates.resend")}</button>}
                  {c.status !== "verificado" && <button type="button" onClick={() => apagar(c)} className="text-xs font-black uppercase text-slate-400 hover:text-red-600 flex items-center gap-1"><Trash2 className="w-3 h-3" /> {t("certificates.delete")}</button>}
                </div>
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

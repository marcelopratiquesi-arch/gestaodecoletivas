// Aba "Valores" do Relatório: cada aula realizada com o valor PAGO contra o valor SUGERIDO pela tabela de preços,
// para ver quem está pagando certo e quem está pagando errado. Só mostra: não muda nenhum valor e não recalcula o passado.
// Usa só dados que o Relatório já carregou, mais UMA leitura da tabela de preços ao abrir a aba.
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, TrendingDown, TrendingUp, HelpCircle } from "lucide-react";
import { lerTabelaPrecos } from "../../services/tabelaPrecosService";
import { auditarValores } from "../../utils/auditoriaValores";
import { valorDaValidacao } from "../../utils/valores";

const reais = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso) => String(iso || "").split("-").reverse().join("/");

const COR = {
  certo: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  maior: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  menor: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  "sem-sugestao": "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300",
};

/** @param {{ linhas: object[], mapas: object, validacoes: object[], periodo: {start:string,end:string}, hojeISO: string }} props */
export default function AbaValores({ linhas, mapas, validacoes, periodo, hojeISO }) {
  const { t } = useTranslation();
  const [tabela, setTabela] = useState(null); // null = lendo; false = falhou
  const [filtro, setFiltro] = useState("erradas"); // erradas | todas | certas | semSugestao
  const [professorAberto, setProfessorAberto] = useState("");
  const [visiveis, setVisiveis] = useState(50);

  useEffect(() => {
    let ativo = true;
    lerTabelaPrecos().then((r) => { if (ativo) setTabela(r.tabela); }).catch((e) => { console.error(e); if (ativo) setTabela(false); });
    return () => { ativo = false; };
  }, []);

  const auditoria = useMemo(() => {
    if (!tabela) return null;
    return auditarValores({
      linhas, tabela, professorPorId: mapas.professores, modalidadePorId: mapas.modalidades, unidadePorId: mapas.unidades,
      aulaPorId: mapas.aulas, validacoesDoPeriodo: validacoes, periodo, hojeISO, valorPago: valorDaValidacao,
    });
  }, [tabela, linhas, mapas, validacoes, periodo, hojeISO]);

  if (tabela === null) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>;
  if (tabela === false) return <p className="p-6 text-sm font-bold text-red-600">{t("reports.values.loadError")}</p>;

  const { itens, porProfessor, resumo } = auditoria;
  const filtrados = itens
    .filter((i) => (professorAberto ? i.professorId === professorAberto : true))
    .filter((i) => (filtro === "todas" ? true : filtro === "erradas" ? (i.situacao === "maior" || i.situacao === "menor")
      : filtro === "certas" ? i.situacao === "certo" : i.situacao === "sem-sugestao"))
    .sort((a, b) => b.data.localeCompare(a.data) || a.professorNome.localeCompare(b.professorNome));
  const erradas = resumo.maiores + resumo.menores;
  const comSugestao = resumo.aulas - resumo.semSugestao;

  const cartao = (rotulo, valor, Icone, cor, onClick, ativo) => (
    <button type="button" onClick={onClick} className={`text-left p-4 rounded-xl border bg-white dark:bg-slate-800 transition-colors ${ativo ? "border-slate-500" : "border-slate-200 dark:border-slate-700 hover:border-slate-300"}`}>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Icone className={`w-3.5 h-3.5 ${cor}`} /> {rotulo}</p>
      <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">{valor}</p>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-xs text-amber-800 dark:text-amber-300 flex gap-2">
        <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{t("reports.values.note")}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cartao(t("reports.values.cards.right"), `${resumo.certas}${comSugestao ? ` (${Math.round((resumo.certas / comSugestao) * 100)}%)` : ""}`, CheckCircle2, "text-emerald-600", () => { setFiltro("certas"); setProfessorAberto(""); }, filtro === "certas")}
        {cartao(t("reports.values.cards.over"), resumo.maiores, TrendingUp, "text-red-600", () => { setFiltro("erradas"); setProfessorAberto(""); }, filtro === "erradas")}
        {cartao(t("reports.values.cards.under"), resumo.menores, TrendingDown, "text-amber-600", () => { setFiltro("erradas"); setProfessorAberto(""); }, false)}
        {cartao(t("reports.values.cards.noSuggestion"), resumo.semSugestao, AlertTriangle, "text-slate-500", () => { setFiltro("semSugestao"); setProfessorAberto(""); }, filtro === "semSugestao")}
        {cartao(t("reports.values.cards.balance"), reais(resumo.diferenca), TrendingUp, resumo.diferenca > 0 ? "text-red-600" : "text-slate-500", () => { setFiltro("todas"); setProfessorAberto(""); }, filtro === "todas")}
      </div>

      {/* Panorama por professor */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">{t("reports.values.byTeacher")}</h3>
          {professorAberto && <button type="button" onClick={() => setProfessorAberto("")} className="text-[11px] font-black uppercase text-slate-600">{t("reports.values.allTeachers")}</button>}
        </div>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs min-w-[720px]">
            <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0">
              <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                <th className="p-3">{t("reports.values.cols.teacher")}</th><th className="p-3 text-center">{t("reports.values.cols.classes")}</th>
                <th className="p-3 text-center">{t("reports.values.cards.right")}</th><th className="p-3 text-center">{t("reports.values.cards.over")}</th>
                <th className="p-3 text-center">{t("reports.values.cards.under")}</th><th className="p-3 text-right">{t("reports.values.cols.paid")}</th>
                <th className="p-3 text-right">{t("reports.values.cols.suggested")}</th><th className="p-3 text-right">{t("reports.values.cols.difference")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {porProfessor.length === 0 && <tr><td colSpan="8" className="p-6 text-center text-slate-400 font-bold uppercase">{t("reports.values.empty")}</td></tr>}
              {porProfessor.map((p) => (
                <tr key={p.professorId} onClick={() => { setProfessorAberto(p.professorId === professorAberto ? "" : p.professorId); setFiltro("todas"); setVisiveis(50); }}
                  className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 ${p.professorId === professorAberto ? "bg-slate-50 dark:bg-slate-900/20" : ""}`}>
                  <td className="p-3 font-black text-slate-800 dark:text-white">{p.professorNome}</td>
                  <td className="p-3 text-center font-bold">{p.aulas}</td>
                  <td className="p-3 text-center font-bold text-emerald-600">{p.certas}</td>
                  <td className="p-3 text-center font-bold text-red-600">{p.maiores}</td>
                  <td className="p-3 text-center font-bold text-amber-600">{p.menores}</td>
                  <td className="p-3 text-right font-bold">{reais(p.pago)}</td>
                  <td className="p-3 text-right font-bold">{reais(p.sugerido)}</td>
                  <td className={`p-3 text-right font-black ${p.diferenca > 0 ? "text-red-600" : p.diferenca < 0 ? "text-amber-600" : "text-slate-400"}`}>{reais(p.diferenca)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Aula por aula */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mr-auto">{t("reports.values.byClass")} ({filtrados.length}{erradas && filtro === "erradas" ? "" : ""})</h3>
          {["erradas", "todas", "certas", "semSugestao"].map((k) => (
            <button key={k} type="button" onClick={() => { setFiltro(k); setVisiveis(50); }} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ${filtro === k ? "bg-red-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>{t(`reports.values.filters.${k}`)}</button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                <th className="p-3">{t("reports.values.cols.date")}</th><th className="p-3">{t("reports.values.cols.teacher")}</th><th className="p-3">{t("reports.values.cols.unit")}</th>
                <th className="p-3">{t("reports.values.cols.modality")}</th><th className="p-3 text-center">{t("reports.values.cols.students")}</th>
                <th className="p-3 text-right">{t("reports.values.cols.paid")}</th><th className="p-3 text-right">{t("reports.values.cols.suggested")}</th><th className="p-3">{t("reports.values.cols.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filtrados.length === 0 && <tr><td colSpan="8" className="p-8 text-center text-slate-400 font-bold uppercase">{t("reports.values.empty")}</td></tr>}
              {filtrados.slice(0, visiveis).map((i) => (
                <tr key={i.chave}>
                  <td className="p-3 whitespace-nowrap">{dataBR(i.data)} <span className="text-slate-400">{i.hora}</span></td>
                  <td className="p-3 font-black text-slate-800 dark:text-white">{i.professorNome}{i.substituto && <span className="ml-1 text-[9px] text-slate-400 font-bold">({t("reports.values.substitute")})</span>}</td>
                  <td className="p-3">{i.unidadeNome}</td>
                  <td className="p-3">{i.modalidadeNome}</td>
                  <td className="p-3 text-center">{i.alunos}</td>
                  <td className="p-3 text-right font-bold">{reais(i.pago)}</td>
                  <td className="p-3 text-right font-bold">{i.sugerido === null ? "—" : reais(i.sugerido)}</td>
                  <td className="p-3">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${COR[i.situacao]}`}>{t(`reports.values.status.${i.situacao}`)}</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5 normal-case">
                      {i.situacao === "sem-sugestao" ? t(`reports.values.why.${i.motivo}`) : [t(`priceTable.levels.${i.nivel}`), i.seguida && t("priceTable.suggest.followingTag"), i.saver && t("priceTable.suggest.saverTag"),
                        i.pretaPendente && i.extraPreta > 0 && t("reports.values.pretaExtra", { extra: reais(i.extraPreta) })].filter(Boolean).join(" · ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visiveis < filtrados.length && (
          <div className="p-3 flex justify-center">
            <button type="button" onClick={() => setVisiveis((v) => v + 50)} className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2"><ChevronDown className="w-4 h-4" /> {t("reports.values.more")}</button>
          </div>
        )}
      </div>
    </div>
  );
}

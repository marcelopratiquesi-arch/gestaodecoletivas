// Peças do líder temporário: selo do prazo, escolha do prazo e janela de convite (a ficha da unidade, na aba Líderes, mostra o temporário).
// Os dados e as ações ficam em useLideresTemporarios.js.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Timer } from "lucide-react";
import { CabecalhoDoModal } from "../ui/CabecalhoDoModal";
import {
  MAX_UNIDADES_TEMPORARIO, convidarTemporario, unidadesQueEuPosso, validarConvite,
} from "./liderTemporario";
import { ATALHOS_DIAS, DIAS_LIMITE_TECNICO, diasRestantes, fimDoDia, fimPorDias, hojeBrasilia, nivelDoAviso, somarDias } from "../../../utils/temporario";

const COR_NIVEL = {
  vencido: "bg-red-50 text-red-700 border-red-300 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
  urgente: "bg-red-50 text-red-700 border-red-300 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
  alto: "bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800",
  atencao: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800",
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800",
};

// Selo "faltam X dias" / "vence hoje" / "vencido".
export function SeloDoPrazo({ fim, className = "" }) {
  const { t } = useTranslation();
  const dias = diasRestantes(fim);
  if (dias === null) return null;
  const nivel = nivelDoAviso(dias) || "ok";
  const texto = dias < 0 ? t("tempLeader.status.expired") : dias === 0 ? t("tempLeader.status.today") : t("tempLeader.status.days", { count: dias });
  return <span className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-black uppercase ${COR_NIVEL[nivel]} ${className}`}>{texto}</span>;
}

// ---------- Escolha do prazo: atalhos em dias (hoje é o dia 1) ou uma data ----------
const ROTULO_PRESET = { 90: "m3", 180: "m6", 365: "y1" };
// `vermelho`: cores do sistema (aba Líderes). Sem ele, fica como sempre foi (Mentores usa assim).
export function SeletorDePrazo({ fim, onFim, desabilitado, atalhos = ATALHOS_DIAS, vermelho = false }) {
  const { t } = useTranslation();
  const hoje = hojeBrasilia();
  const ultimoPermitido = somarDias(hoje, DIAS_LIMITE_TECNICO);
  const dataAtual = fim ? hojeBrasilia(fim.getTime()) : "";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {atalhos.map((d) => {
          const alvo = fimPorDias(d);
          const ativo = fim && alvo.getTime() === fim.getTime();
          return (
            <button key={d} type="button" disabled={desabilitado} onClick={() => onFim(alvo)}
              className={`px-3 py-2 rounded-lg text-xs font-black uppercase border transition-colors ${ativo ? (vermelho ? "bg-red-600 text-white border-red-600" : "bg-teal-600 text-white border-teal-600") : `border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 ${vermelho ? "hover:border-red-500" : "hover:border-teal-500"}`}`}>
              {ROTULO_PRESET[d] && atalhos !== ATALHOS_DIAS ? t(`tempLeader.preset.${ROTULO_PRESET[d]}`) : t("tempLeader.days", { count: d })}
            </button>
          );
        })}
      </div>
      <input type="date" value={dataAtual} min={hoje} max={ultimoPermitido} disabled={desabilitado}
        onChange={(e) => onFim(e.target.value ? fimDoDia(e.target.value) : null)}
        className={`w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 ${vermelho ? "focus:ring-red-500" : "focus:ring-teal-500"}`} />
      <p className="text-[11px] text-slate-400">{t("tempLeader.deadlineHint")}</p>
    </div>
  );
}

export function PrazoModal({ cracha, onFechar, onSalvar, abaId = "lideres", atalhos = ATALHOS_DIAS }) {
  const { t } = useTranslation();
  const [fim, setFim] = useState(fimPorDias(atalhos === ATALHOS_DIAS ? 30 : 60));
  const vermelho = abaId === "lideres"; // aba Líderes usa as cores do sistema; Mentores continua como estava
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <CabecalhoDoModal abaId={abaId} icone={Timer} titulo={t("tempLeader.extendTitle", { name: cracha.nome })} onFechar={onFechar} />
        <div className="p-5 space-y-4">
          <SeletorDePrazo fim={fim} onFim={setFim} atalhos={atalhos} vermelho={vermelho} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onFechar} className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200">{t("tempLeader.cancel")}</button>
            <button type="button" disabled={!fim} onClick={() => { if (fim.getTime() > Date.now()) onSalvar(fim); }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase text-white flex items-center gap-1.5 disabled:opacity-50 ${vermelho ? "bg-red-600 hover:bg-red-700" : "bg-teal-500 hover:bg-teal-600"}`}>
              <Check className="w-3.5 h-3.5" /> {t("tempLeader.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Convite ----------
const NOME_PAIS = { Brasil: "BR", Argentina: "AR", "Estados Unidos": "US" };
const paisDa = (u) => NOME_PAIS[u?.pais] || u?.pais || "BR";

export function ConviteModal({ role, escopos, unidades, quem, unidadeInicial, onFechar, onCriado }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ email: "", nome: "", telefone: "" });
  const [escolhidas, setEscolhidas] = useState(unidadeInicial ? [unidadeInicial.id] : []); // aberto pela linha da unidade = já vem marcada
  const [busca, setBusca] = useState("");
  const [fim, setFim] = useState(fimPorDias(30));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const minhas = useMemo(() => unidadesQueEuPosso({ role, escopos, unidades }), [role, escopos, unidades]);
  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return minhas.filter((u) => !q || `${u.nome} ${u.estado || ""}`.toLowerCase().includes(q)).slice(0, 60);
  }, [minhas, busca]);

  const alternar = (id) => setEscolhidas((v) => (v.includes(id) ? v.filter((x) => x !== id) : v.length >= MAX_UNIDADES_TEMPORARIO ? v : [...v, id]));

  async function enviar(e) {
    e.preventDefault(); setErro("");
    const falha = validarConvite({ ...form, unidadeIds: escolhidas, fim });
    if (falha) return setErro(t(`tempLeader.errors.${falha}`, { max: MAX_UNIDADES_TEMPORARIO }));
    const dasUnidades = escolhidas.map((id) => unidades.find((u) => u.id === id)).filter(Boolean);
    setSalvando(true);
    try {
      // O mentor "dono" do convite: o mentor da 1ª unidade (o banco confere que é um mentor que o convidante enxerga).
      const mentorId = dasUnidades[0]?.mentorId || "";
      const email = await convidarTemporario({ ...form, pais: paisDa(dasUnidades[0]), unidadeIds: escolhidas, fim, mentorId, quem });
      await onCriado({ ...form, email, fim, unidades: dasUnidades });
    } catch (err) {
      console.error(err);
      setErro(t("tempLeader.errors.save") + " " + (err.message || ""));
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !salvando && onFechar()}>
      <form onSubmit={enviar} onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-2xl">
        <CabecalhoDoModal abaId="lideres" icone={Timer} titulo={t("tempLeader.modalTitle")} subtitulo={t("tempLeader.modalSubtitle")} onFechar={onFechar} desabilitado={salvando} />
        <div className="p-5 sm:p-6 overflow-y-auto grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-600">{t("tempLeader.sectionPerson")}</p>
            {[["email", "email", "email"], ["nome", "name", "text"], ["telefone", "phone", "text"]].map(([campo, rotulo, tipo]) => (
              <label key={campo} className="block space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t(`tempLeader.field.${rotulo}`)}</span>
                <input type={tipo} value={form[campo]} disabled={salvando} maxLength={campo === "nome" ? 80 : 60}
                  onChange={(e) => setForm({ ...form, [campo]: e.target.value })}
                  className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-red-500" />
              </label>
            ))}
            <p className="text-[11px] text-slate-400">{t("tempLeader.emailHint")}</p>
          </div>
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-600">{t("tempLeader.sectionUnits", { count: escolhidas.length, max: MAX_UNIDADES_TEMPORARIO })}</p>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t("tempLeader.searchUnit")} disabled={salvando}
              className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-red-500" />
            <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/50">
              {visiveis.length === 0 && <p className="p-3 text-xs text-slate-400 font-bold">{t("tempLeader.noUnits")}</p>}
              {visiveis.map((u) => {
                const marcada = escolhidas.includes(u.id);
                return (
                  <label key={u.id} className={`flex items-center gap-2 px-3 py-2 text-xs font-bold cursor-pointer ${marcada ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300" : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/30"}`}>
                    <input type="checkbox" checked={marcada} disabled={salvando || (!marcada && escolhidas.length >= MAX_UNIDADES_TEMPORARIO)} onChange={() => alternar(u.id)} />
                    <span className="truncate">{u.nome}</span><span className="ml-auto text-[10px] text-slate-400">{u.estado || ""}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-red-600">{t("tempLeader.sectionDeadline")}</p>
            <SeletorDePrazo fim={fim} onFim={setFim} desabilitado={salvando} vermelho />
          </div>
        </div>
        {erro && <p className="mx-5 mb-3 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{erro}</p>}
        <div className="flex justify-end gap-2 p-4 border-t border-slate-100 dark:border-slate-700">
          <button type="button" onClick={onFechar} disabled={salvando} className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200">{t("tempLeader.cancel")}</button>
          <button type="submit" disabled={salvando} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 disabled:opacity-50">
            {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {t("tempLeader.send")}
          </button>
        </div>
      </form>
    </div>
  );
}


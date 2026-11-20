import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, ChevronDown, X, Search, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { useCatalogs } from "../../contexts/CatalogContext";

// "Ver como": só o administrador de verdade enxerga este bloco (fica acima do seletor de idioma).
// Ele muda só a APARÊNCIA do sistema (menu, telas, filtros) para a de um mentor, líder/unidade ou professor.
// As permissões continuam sendo as do admin, porque o banco enxerga o login real.
const TIPOS = ["admin", "mentor", "lider", "professor"];

const porNome = (a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { sensitivity: "base" });

const classeSelect =
  "w-full appearance-none rounded-lg border bg-white py-2 pl-3 pr-8 text-xs font-bold text-slate-700 outline-none transition-colors focus:border-red-400 dark:bg-slate-800 dark:text-slate-200";

// Últimas pessoas escolhidas, por tipo (só neste navegador; se o storage falhar, a lista simplesmente não existe).
const CHAVE_RECENTES = "pratique_visao_recentes";
const lerRecentes = () => {
  try { return JSON.parse(localStorage.getItem(CHAVE_RECENTES) || "{}") || {}; } catch { return {}; }
};
const guardarRecente = (tipo, valor) => {
  try {
    const todos = lerRecentes();
    todos[tipo] = [valor, ...(todos[tipo] || []).filter((v) => v !== valor)].slice(0, 4);
    localStorage.setItem(CHAVE_RECENTES, JSON.stringify(todos));
  } catch { /* sem guardar, só não lembra */ }
};

const semAcento = (txt) => String(txt || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Lista com busca por nome (digita e filtra) e, com a busca vazia, as últimas escolhas no topo.
function CaixaBusca({ opcoes, recentes, valor, onEscolher, rotulo, t }) {
  const [aberta, setAberta] = useState(false);
  const [busca, setBusca] = useState("");
  const campo = useRef(null);

  const atual = opcoes.find((o) => o.valor === valor);
  const termo = semAcento(busca.trim());
  const filtradas = termo ? opcoes.filter((o) => semAcento(o.nome).includes(termo)) : opcoes;
  const recentesVisiveis = termo ? [] : recentes.map((v) => opcoes.find((o) => o.valor === v)).filter(Boolean);

  const fechar = () => { setAberta(false); setBusca(""); };
  const escolher = (o) => { fechar(); onEscolher(o.valor); };

  const Item = ({ o }) => (
    <button
      type="button"
      onClick={() => escolher(o)}
      className={`block w-full truncate px-3 py-2 text-left text-xs transition-colors ${o.valor === valor ? "bg-red-50 font-bold text-red-600 dark:bg-red-900/20 dark:text-red-400" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"}`}
    >
      {o.nome}
    </button>
  );

  return (
    <div className="block">
      <span className="mb-1 block px-1 text-[9px] font-black uppercase tracking-widest text-slate-400">{rotulo}</span>
      <div className="relative">
        <div className={`flex items-center gap-2 rounded-lg border bg-white px-3 py-2 dark:bg-slate-800 ${atual ? "border-amber-300 dark:border-amber-700" : "border-slate-200 dark:border-slate-700"} ${aberta ? "border-red-400" : ""}`}>
          <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <input
            ref={campo}
            value={aberta ? busca : (atual?.nome || "")}
            placeholder={t("sidebar.viewAs.search")}
            onFocus={() => setAberta(true)}
            onChange={(e) => { setBusca(e.target.value); setAberta(true); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") { fechar(); campo.current?.blur(); }
              if (e.key === "Enter" && filtradas[0]) { e.preventDefault(); escolher(filtradas[0]); campo.current?.blur(); }
            }}
            className="min-w-0 flex-1 bg-transparent text-xs font-bold text-slate-700 outline-none placeholder:font-medium placeholder:text-slate-400 dark:text-slate-200"
          />
        </div>
        {aberta && (
          <>
            <div className="fixed inset-0 z-40" onClick={fechar} />
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
              {recentesVisiveis.length > 0 && (
                <div className="border-b border-slate-100 dark:border-slate-700">
                  <p className="flex items-center gap-1 px-3 pt-2 text-[9px] font-black uppercase tracking-widest text-slate-400"><Clock className="h-3 w-3" /> {t("sidebar.viewAs.recent")}</p>
                  {recentesVisiveis.map((o) => <Item key={`r-${o.valor}`} o={o} />)}
                </div>
              )}
              {filtradas.length === 0
                ? <p className="px-3 py-3 text-center text-xs font-bold text-slate-400">{t("sidebar.viewAs.noResults")}</p>
                : filtradas.map((o) => <Item key={o.valor} o={o} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function SeletorVisaoAdmin({ collapsed }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { ehAdminReal, visaoAdmin, definirVisaoAdmin } = useAuth();
  const { catalogs } = useCatalogs();
  const [aberto, setAberto] = useState(false);
  // Tipo escolhido ainda sem pessoa: só vira visão quando a pessoa/unidade for escolhida.
  const [tipoEscolhido, setTipoEscolhido] = useState(null);

  const tipoAtual = tipoEscolhido || visaoAdmin?.tipo || "admin";
  const valorAtual = visaoAdmin?.tipo === tipoAtual
    ? String(visaoAdmin.id || visaoAdmin.unidadeId || visaoAdmin.professorId || "")
    : "";

  const opcoes = useMemo(() => {
    if (tipoAtual === "mentor") {
      return (catalogs.mentores || []).filter((m) => m.status !== "inativo").sort(porNome)
        .map((m) => ({ valor: String(m.id), nome: m.nome || m.email || m.id, dados: { id: m.id, mentorPrincipalId: m.mentorPrincipalId || null } }));
    }
    if (tipoAtual === "lider") {
      return [...(catalogs.unidades || [])].sort(porNome)
        .map((u) => ({ valor: String(u.id), nome: u.nome || u.id, dados: { unidadeId: u.id } }));
    }
    if (tipoAtual === "professor") {
      return [...(catalogs.professores || [])].sort(porNome)
        .map((p) => ({ valor: String(p.id), nome: p.nome || p.id, dados: { professorId: p.id } }));
    }
    return [];
  }, [tipoAtual, catalogs.mentores, catalogs.unidades, catalogs.professores]);

  if (!ehAdminReal) return null;

  const rotuloTipo = (tipo) => t(`sidebar.viewAs.types.${tipo}`);
  const ativo = !!visaoAdmin?.tipo;

  const trocarTipo = (tipo) => {
    if (tipo === "admin") {
      setTipoEscolhido(null);
      if (visaoAdmin) { definirVisaoAdmin(null); navigate("/app"); }
      return;
    }
    setTipoEscolhido(tipo);
  };

  const escolherPessoa = (valor) => {
    const op = opcoes.find((o) => o.valor === valor);
    if (!op) return;
    guardarRecente(tipoAtual, op.valor);
    definirVisaoAdmin({ tipo: tipoAtual, nome: op.nome, ...op.dados });
    setTipoEscolhido(null);
    navigate(tipoAtual === "professor" ? "/app/validacao-diaria" : "/app");
  };

  const voltarAdmin = () => {
    setTipoEscolhido(null);
    definirVisaoAdmin(null);
    navigate("/app");
  };

  const painel = (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-1 block px-1 text-[9px] font-black uppercase tracking-widest text-slate-400">{t("sidebar.viewAs.navigation")}</span>
        <div className="relative">
          <select
            value={tipoAtual}
            onChange={(e) => trocarTipo(e.target.value)}
            className={`${classeSelect} ${ativo ? "border-amber-300 dark:border-amber-700" : "border-slate-200 dark:border-slate-700"}`}
          >
            {TIPOS.map((tipo) => <option key={tipo} value={tipo}>{rotuloTipo(tipo)}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>
      </label>

      {tipoAtual !== "admin" && (
        <CaixaBusca
          key={tipoAtual}
          opcoes={opcoes}
          recentes={lerRecentes()[tipoAtual] || []}
          valor={valorAtual}
          onEscolher={escolherPessoa}
          rotulo={t(`sidebar.viewAs.pick.${tipoAtual}`)}
          t={t}
        />
      )}

      {ativo && (
        <button
          type="button"
          onClick={voltarAdmin}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 py-1.5 text-[10px] font-black uppercase tracking-wider text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300"
        >
          <X className="h-3 w-3" /> {t("sidebar.viewAs.backToAdmin")}
        </button>
      )}
    </div>
  );

  const resumo = ativo ? `${rotuloTipo(visaoAdmin.tipo)}: ${visaoAdmin.nome}` : t("sidebar.viewAs.title");

  // Menu recolhido: só o ícone, com o painel abrindo ao lado (como o menu de idioma).
  if (collapsed) {
    return (
      <div className="relative mx-1 mb-3">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setAberto((v) => !v); }}
          title={resumo}
          className={`flex w-full items-center justify-center rounded-xl border p-3 shadow-sm transition-all ${ativo ? "border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700/50"}`}
        >
          <Eye className="h-5 w-5" />
        </button>
        {aberto && (
          <>
            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setAberto(false); }} />
            <div onClick={(e) => e.stopPropagation()} className="absolute left-full top-0 z-50 ml-4 w-60 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-800">
              {painel}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`mx-1 mb-3 rounded-xl border p-3 shadow-sm ${ativo ? "border-amber-300 bg-amber-50/60 dark:border-amber-700/50 dark:bg-amber-900/10" : "border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-800/40"}`}
    >
      <p className={`mb-2 flex items-center gap-1.5 px-1 text-[10px] font-black uppercase tracking-widest ${ativo ? "text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"}`}>
        <Eye className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate" title={resumo}>{resumo}</span>
      </p>
      {painel}
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useCatalogs } from "../contexts/CatalogContext";
import { db } from "../services/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import {
  BarChart2, Calendar, CheckCircle2, ShieldCheck,
  ArrowRight, Loader2, Building2, Check, AlertTriangle, RefreshCw, WifiOff,
  Users, Dumbbell, Headphones, CalendarDays, Link as LinkIcon
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next"; // 🟢 MOTOR ACIONADO
import { getDiaSemana, formatCurrency, formatDate, formatTime, formatWeekday, getCurrencyCode } from "../utils/formatters";
import { deduplicarValidacoes } from "../utils/validacoes";
import { valorDaValidacao } from "../utils/valores";
import { ehLider } from "../permissions";
import { feriadoNoDia } from "../utils/feriados";
import { aulaNaGradeDoDia, situacaoDaAula, SITUACAO, dataLocalStr, somarDias, datasEntre } from "../utils/agendaAulas";
import { lerCacheInicio, gravarCacheInicio, invalidarCacheInicio } from "../services/cacheInicio";

// Pendências: olha hoje e os 6 dias anteriores (uma aula esquecida ontem não pode virar "Tudo validado").
const DIAS_JANELA = 7;
// O Firestore aceita no máximo 30 valores num filtro "in".
const LIMITE_IN = 30;
// A grade só guarda a hora de início; a aula conta como "acontecendo agora" até 40 min depois
// (mesma duração padrão do Radar de Ociosidade).
const DURACAO_AULA_MIN = 40;
// Quantas aulas o card do Cronograma lista e quantas unidades o Monitoramento destaca.
const AULAS_NO_CRONOGRAMA = 3;
const UNIDADES_NO_MONITORAMENTO = 3;

const doisDigitos = (n) => String(n).padStart(2, '0');
const emMinutos = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const primeiroNome = (nome) => String(nome || '').split(' ')[0];

// --- RELÓGIO COM SEGUNDOS (TRILÍNGUE) ---
const CorporateClock = () => {
    const { i18n } = useTranslation(); // 🟢 Conectado ao idioma atual
    const [date, setDate] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setDate(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const lang = i18n.language || 'pt-BR';

    return (
        <div className="flex flex-col items-end border-l-4 border-red-600 pl-4">
            <div className="flex items-baseline gap-1 text-slate-900 dark:text-white leading-none">
                <span className="text-4xl font-black tracking-tighter">
                    {date.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-xl font-bold opacity-50 w-[24px] text-left">
                    {date.getSeconds().toString().padStart(2, '0')}
                </span>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mt-1">
                {date.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
        </div>
    );
};

// --- AVATAR PROFESSOR ---
const ProfessorAvatar = ({ name }) => {
    const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : "PF";
    return (
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-black text-slate-600 dark:text-slate-300 border border-white dark:border-slate-600 shadow-sm" title={name}>
            {initials}
        </div>
    );
};

// --- CARD DASHBOARD ---
const DashboardCard = ({ title, subtitle, icon: Icon, theme, onClick, footerText, children, activeEffect, className }) => {
    const themes = {
        blue: { iconBox: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400", hover: "hover:border-blue-400 group-hover:text-blue-700", accent: "text-blue-600" },
        purple: { iconBox: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400", hover: "hover:border-purple-400 group-hover:text-purple-700", accent: "text-purple-600" },
        green: { iconBox: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400", hover: "hover:border-emerald-400 group-hover:text-emerald-700", accent: "text-emerald-600" },
        red: { iconBox: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400", hover: "hover:border-red-400 group-hover:text-red-700", accent: "text-red-600" },
        orange: { iconBox: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400", hover: "hover:border-orange-400 group-hover:text-orange-700", accent: "text-orange-600" },
        pink: { iconBox: "bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400", hover: "hover:border-pink-400 group-hover:text-pink-700", accent: "text-pink-600" },
        cyan: { iconBox: "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400", hover: "hover:border-cyan-400 group-hover:text-cyan-700", accent: "text-cyan-600" },
        slate: { iconBox: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400", hover: "hover:border-slate-400 group-hover:text-slate-700", accent: "text-slate-500" }
    };

    const style = themes[theme] || themes.slate;

    return (
        <div
            onClick={onClick}
            className={`
                group bg-white dark:bg-slate-800 p-6 rounded-[24px]
                border-2 border-slate-100 dark:border-slate-700
                shadow-sm hover:shadow-xl hover:-translate-y-1
                transition-all duration-300 cursor-pointer
                flex flex-col justify-between relative overflow-hidden
                min-h-[260px] ${className || ''}
                ${style.hover}
            `}
        >
            <div className={`absolute -right-6 -top-6 opacity-[0.04] transform group-hover:scale-110 transition-transform duration-500`}>
                <Icon className="w-40 h-40 text-current" />
            </div>

            <div className="relative z-10 flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white leading-tight uppercase tracking-wide">
                        {title}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium mt-1 uppercase">
                        {subtitle}
                    </p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${style.iconBox} ${activeEffect ? 'animate-pulse ring-2 ring-offset-2 ring-green-400' : ''}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>

            <div className="relative z-10 flex-1 flex flex-col justify-center py-2">
                {children}
            </div>

            <div className="relative z-10 pt-3 border-t border-slate-50 dark:border-slate-700/50 flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${style.accent} group-hover:underline whitespace-nowrap`}>
                    {footerText} <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                </span>
            </div>
        </div>
    );
};

// Caixinha de erro: melhor dizer "não carregou" do que mostrar um número falso (ex.: "Tudo validado!").
const ErroCarregamento = ({ texto }) => (
    <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p className="text-xs font-bold leading-snug">{texto}</p>
    </div>
);

// --- ATALHO (faixa de atalhos rápidos abaixo dos cards) ---
const Atalho = ({ icon: Icon, label, onClick, cor }) => (
    <button
        type="button"
        onClick={onClick}
        className="group flex items-center gap-3 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-500 transition-all text-left"
    >
        <span className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${cor}`}>
            <Icon className="w-4 h-4" />
        </span>
        <span className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200 truncate">{label}</span>
        <ArrowRight className="w-3 h-3 ml-auto shrink-0 text-slate-300 transition-transform group-hover:translate-x-1" />
    </button>
);

export default function Home() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation(); // 🟢 MOTOR ACIONADO NA HOME

  const { catalogs, loadingCatalogs } = useCatalogs();

  // Hora usada nas contas: anda a cada minuto, então a aula que começa passa para "a validar" sem recarregar a página.
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  const hoje = dataLocalStr(agora);
  const ontem = somarDias(hoje, -1);
  const agoraHHMM = `${doisDigitos(agora.getHours())}:${doisDigitos(agora.getMinutes())}`; // comparado com aula.hora ("HH:MM")

  // Conexão de verdade (o selo "Sistema Online" antes ficava verde mesmo sem internet).
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const ficouOnline = () => setOnline(true);
    const ficouOffline = () => setOnline(false);
    window.addEventListener('online', ficouOnline);
    window.addEventListener('offline', ficouOffline);
    return () => {
      window.removeEventListener('online', ficouOnline);
      window.removeEventListener('offline', ficouOffline);
    };
  }, []);

  const greeting = useMemo(() => {
    const hour = agora.getHours();
    if (hour >= 5 && hour < 12) return t('home.greeting.morning');
    if (hour >= 12 && hour < 18) return t('home.greeting.afternoon');
    return t('home.greeting.night');
  }, [agora, t]);

  const roleOriginal = String(userData?.role || "").trim().toLowerCase();
  // "administrador" e "master" são administradores (mesma regra do firestore.rules).
  const role = ['admin', 'administrador', 'master'].includes(roleOriginal) ? 'admin' : roleOriginal;
  const isGestor = role === 'admin' || role === 'mentor';
  const userId = userData?.id || userData?.uid;
  const minhaUnidadeId = userData?.unidadeId;

  const permissions = useMemo(() => ({
      relatorio: ['admin', 'mentor', 'lider', 'unidade', 'professor'].includes(role),
      cronograma: true,
      validacaoDiaria: true,
      validacaoColetiva: ['admin', 'mentor'].includes(role),
      pratiquePlay: ['admin', 'mentor', 'lider', 'unidade', 'professor'].includes(role),
      linkAluno: ['admin', 'mentor', 'lider', 'unidade', 'professor'].includes(role),
      // Abas das Configurações (mesmos perfis de src/app/Configuracoes/index.jsx)
      cfgUnidades: ['admin', 'mentor'].includes(role),
      cfgProfessores: ['admin', 'mentor', 'lider', 'unidade'].includes(role),
      cfgModalidades: ['admin', 'mentor'].includes(role),
      cfgFeriados: ['admin', 'mentor'].includes(role),
  }), [role]);

  // 1. O QUE ESTA PESSOA ENXERGA (vem do catálogo já carregado, sem ler nada do banco).
  //    Aula de unidade que não existe mais no cadastro não entra (igual à Validação Diária).
  const escopo = useMemo(() => {
    const todas = catalogs.unidades || [];
    let unidades = [];
    if (role === 'admin' || role === 'professor') unidades = todas; // professor: recorta pelas aulas dele, logo abaixo
    else if (role === 'mentor') unidades = todas.filter(u => u.mentorId === userId);
    else if (ehLider(role)) unidades = todas.filter(u => String(u.id) === String(minhaUnidadeId));

    const unidadesPorId = new Map(unidades.map(u => [String(u.id), u]));
    const meuProf = role === 'professor'
      ? (catalogs.professores || []).find(p => p.uidLogin === userId || p.uid === userId)
      : null;
    const meuProfId = meuProf?.id || null;

    const aulas = (catalogs.aulas || []).filter(a =>
      unidadesPorId.has(String(a.unidadeId)) &&
      (role !== 'professor' || (meuProfId && String(a.professorId) === String(meuProfId)))
    );

    return { unidades, unidadesPorId, aulas, meuProfId };
  }, [catalogs.unidades, catalogs.professores, catalogs.aulas, role, userId, minhaUnidadeId]);

  // 2. DIA DE REFERÊNCIA ("ontem"): o último dia antes de hoje que teve aula de verdade.
  //    Na segunda-feira, se domingo não teve aula, é o sábado; feriado é pulado. O card mostra qual dia é.
  const diaReferencia = useMemo(() => {
    const feriados = catalogs.feriados || [];
    for (let i = 1; i < DIAS_JANELA; i++) {
      const d = somarDias(hoje, -i);
      const diaSemana = getDiaSemana(d);
      const teveAula = escopo.aulas.some(a =>
        aulaNaGradeDoDia(a, d, diaSemana) && !feriadoNoDia(d, escopo.unidadesPorId.get(String(a.unidadeId)), feriados)
      );
      if (teveAula) return d;
    }
    return null;
  }, [escopo, hoje, catalogs.feriados]);

  // Período buscado no banco. Unidade, mentor e professor: 7 dias, só das aulas deles (poucas leituras).
  // Administrador: a rede inteira (mais de 180 unidades); 7 dias estourariam a cota gratuita, então busca
  // só do dia de referência até hoje.
  const inicioJanela = role === 'admin'
    ? (diaReferencia || ontem)
    : somarDias(hoje, -(DIAS_JANELA - 1));

  const idsUnidadesMentor = role === 'mentor' ? escopo.unidades.map(u => u.id) : [];
  const chaveBusca = [
    userId, role, inicioJanela, hoje,
    ehLider(role) ? minhaUnidadeId : '',
    role === 'professor' ? escopo.meuProfId : '',
    idsUnidadesMentor.join(','),
  ].join('|');

  // 3. VALIDAÇÕES DO PERÍODO (com memória curta: src/services/cacheInicio.js)
  const [validacoes, setValidacoes] = useState(null); // null = carregando
  const [erroCarga, setErroCarga] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [recarga, setRecarga] = useState(0); // botão "Atualizar"

  useEffect(() => {
    if (loadingCatalogs || !userData) return;

    const emMemoria = lerCacheInicio(chaveBusca);
    if (emMemoria) {
      setValidacoes(emMemoria.validacoes);
      setAtualizadoEm(new Date(emMemoria.timestamp));
      setErroCarga(false);
      return;
    }

    let cancelado = false;
    setValidacoes(null);
    setErroCarga(false);

    async function buscar() {
      const ref = collection(db, "validacoes");
      const periodo = [where("data", ">=", inicioJanela), where("data", "<=", hoje)];

      let consultas = [];
      if (escopo.aulas.length === 0) {
        consultas = []; // sem aulas visíveis não há o que contar: não gasta leitura
      } else if (ehLider(role)) {
        consultas = [query(ref, where("unidadeId", "==", minhaUnidadeId), ...periodo)];
      } else if (role === 'professor') {
        consultas = [
          query(ref, where("professorId", "==", escopo.meuProfId), ...periodo),
          // Aula dele dada por substituto (a validação vai com o professorId do substituto). São poucas:
          // busca sem período, para não precisar de índice novo, e o período é filtrado logo abaixo.
          query(ref, where("professorOriginalId", "==", escopo.meuProfId)),
        ];
      } else if (role === 'mentor') {
        for (let i = 0; i < idsUnidadesMentor.length; i += LIMITE_IN) {
          consultas.push(query(ref, where("unidadeId", "in", idsUnidadesMentor.slice(i, i + LIMITE_IN)), ...periodo));
        }
      } else if (role === 'admin') {
        consultas = [query(ref, ...periodo)];
      }

      const snaps = await Promise.all(consultas.map(q => getDocs(q)));
      const porId = new Map();
      snaps.forEach(s => s.docs.forEach(d => porId.set(d.id, { id: d.id, ...d.data() })));
      const lista = deduplicarValidacoes([...porId.values()].filter(v => v.data >= inicioJanela && v.data <= hoje));
      if (cancelado) return;
      gravarCacheInicio(chaveBusca, lista);
      setValidacoes(lista);
      setAtualizadoEm(new Date());
    }

    buscar().catch(error => {
      console.error("Erro dashboard:", error);
      if (cancelado) return;
      setErroCarga(true);
      setValidacoes([]);
    });

    return () => { cancelado = true; };
    // Tudo o que a busca usa (usuário, papel, período, unidades) está dentro de chaveBusca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveBusca, loadingCatalogs, recarga]);

  const carregando = loadingCatalogs || validacoes === null;

  const atualizarAgora = () => {
    invalidarCacheInicio();
    setRecarga(n => n + 1);
  };

  const validacaoPorAulaEDia = useMemo(() => {
    const mapa = new Map();
    (validacoes || []).forEach(v => { if (v.aulaId && v.data) mapa.set(`${v.aulaId}_${v.data}`, v); });
    return mapa;
  }, [validacoes]);

  // 4. NÚMEROS DOS CARDS — mesma regra da Validação Diária (src/utils/agendaAulas.js)
  const resumo = useMemo(() => {
    const feriados = catalogs.feriados || [];
    // [{ aula, situacao }] de todas as aulas da grade no dia d
    const situacoesDoDia = (d) => {
      const diaSemana = getDiaSemana(d);
      return escopo.aulas
        .filter(aula => aulaNaGradeDoDia(aula, d, diaSemana))
        .map(aula => ({
          aula,
          situacao: situacaoDaAula({
            aula, unidade: escopo.unidadesPorId.get(String(aula.unidadeId)), dataStr: d,
            validacao: validacaoPorAulaEDia.get(`${aula.id}_${d}`), feriados, hoje, agoraHHMM,
          }),
        }));
    };

    // Validação Diária: aulas que já começaram e ninguém validou (no período) + as que ainda vão acontecer hoje.
    let aValidar = 0, maisTardeHoje = 0, aulasNoPeriodo = 0, maisAntiga = null;
    const unidadesComPendencia = new Set();
    datasEntre(inicioJanela, hoje).forEach(d => {
      situacoesDoDia(d).forEach(({ aula, situacao }) => {
        if (situacao === SITUACAO.FERIADO) return;
        aulasNoPeriodo++;
        if (situacao === SITUACAO.A_VALIDAR) {
          aValidar++;
          unidadesComPendencia.add(String(aula.unidadeId));
          if (!maisAntiga || d < maisAntiga) maisAntiga = d;
        }
        if (situacao === SITUACAO.MAIS_TARDE) maisTardeHoje++;
      });
    });

    // Monitoramento: no dia de referência, quantas aulas esperadas foram validadas (feriado não conta),
    // e quais unidades mais deixaram aulas sem validar nesse dia.
    let esperadas = 0, validadas = 0;
    const pendentesPorUnidade = new Map();
    if (diaReferencia) {
      situacoesDoDia(diaReferencia).forEach(({ aula, situacao }) => {
        if (situacao === SITUACAO.FERIADO) return;
        esperadas++;
        if (situacao === SITUACAO.RESOLVIDA) validadas++;
        else {
          const id = String(aula.unidadeId);
          pendentesPorUnidade.set(id, (pendentesPorUnidade.get(id) || 0) + 1);
        }
      });
    }
    const percentual = esperadas > 0 ? Math.round((validadas / esperadas) * 100) : null;
    const maisAtrasadas = [...pendentesPorUnidade.entries()]
      .map(([id, pendentes]) => ({ id, nome: escopo.unidadesPorId.get(id)?.nome || id, pendentes }))
      .sort((a, b) => b.pendentes - a.pendentes || String(a.nome).localeCompare(String(b.nome)))
      .slice(0, UNIDADES_NO_MONITORAMENTO);

    // Receita do dia de referência, SEPARADA POR MOEDA (real e peso nunca se somam). Inclui aulões.
    const aulasPorId = new Map((catalogs.aulasTodas || catalogs.aulas || []).map(a => [String(a.id), a]));
    const porMoeda = {};
    if (diaReferencia) {
      (validacoes || []).forEach(v => {
        if (v.data !== diaReferencia || v.status !== 'realizada') return;
        const aula = v.aulaId ? aulasPorId.get(String(v.aulaId)) : null;
        const unidade = escopo.unidadesPorId.get(String(v.unidadeId ?? aula?.unidadeId));
        if (!unidade) return;
        const moeda = getCurrencyCode(unidade.pais);
        if (!porMoeda[moeda]) porMoeda[moeda] = { valor: 0, pais: unidade.pais };
        porMoeda[moeda].valor += valorDaValidacao(v, aula);
      });
    }
    const receitas = Object.values(porMoeda).sort((a, b) => b.valor - a.valor);

    return {
      aValidar, maisTardeHoje, aulasNoPeriodo, maisAntiga, unidadesComPendencia: [...unidadesComPendencia],
      esperadas, validadas, percentual, maisAtrasadas, receitas,
    };
  }, [escopo, validacaoPorAulaEDia, validacoes, catalogs.feriados, catalogs.aulasTodas, catalogs.aulas, inicioJanela, hoje, agoraHHMM, diaReferencia]);

  // Professor: previsão do mês (estimativa: valor × dias na semana × 4).
  const previsaoMensalProfessor = useMemo(() => (
    escopo.aulas.reduce((total, aula) => total + (parseFloat(aula.valor) || 0) * (aula.dias?.length || 0) * 4, 0)
  ), [escopo]);

  // 5. AGENDA DE HOJE: a aula que está acontecendo agora (até 40 min depois do início) e as próximas.
  //    Sem feriado e sem cancelamento.
  const agendaHoje = useMemo(() => {
    const diaSemana = getDiaSemana(hoje);
    const feriados = catalogs.feriados || [];
    const agoraMin = emMinutos(agoraHHMM);

    const lista = escopo.aulas
      .filter(aula =>
        aulaNaGradeDoDia(aula, hoje, diaSemana) &&
        emMinutos(aula.hora) + DURACAO_AULA_MIN > agoraMin &&
        !feriadoNoDia(hoje, escopo.unidadesPorId.get(String(aula.unidadeId)), feriados) &&
        validacaoPorAulaEDia.get(`${aula.id}_${hoje}`)?.status !== 'cancelada'
      )
      .sort((a, b) => String(a.hora).localeCompare(String(b.hora)));

    const decorar = (aula) => {
      const modalidade = (catalogs.modalidades || []).find(m => String(m.id) === String(aula.modalidadeId));
      const professor = (catalogs.professores || []).find(p => String(p.id) === String(aula.professorId));
      return {
        ...aula,
        agora: emMinutos(aula.hora) <= agoraMin,
        modalidadeNome: modalidade?.nome || t('home.cards.schedule.defaultModality', "Coletiva"),
        modalidadeCor: modalidade?.cor || "#94a3b8",
        professorNome: professor?.nome || t('home.cards.schedule.defaultTeacher', "Instrutor"),
        unidadeNome: escopo.unidadesPorId.get(String(aula.unidadeId))?.nome || t('home.cards.schedule.unit', "Unidade"),
      };
    };

    return {
      aulas: lista.slice(0, AULAS_NO_CRONOGRAMA).map(decorar),
      restantes: Math.max(0, lista.length - AULAS_NO_CRONOGRAMA),
    };
  }, [escopo, hoje, agoraHHMM, catalogs.feriados, catalogs.modalidades, catalogs.professores, validacaoPorAulaEDia, t]);

  if (!userData) return null;

  // Abre a Validação Diária já no período, nas unidades e no filtro "Pendentes".
  const abrirPendencias = ({ inicio, fim, unidadeIds }) =>
    navigate('/app/validacao-diaria', { state: { pendencias: { inicio, fim, unidadeIds } } });

  const abrirConfiguracoes = (aba) => navigate('/app/configuracoes', { state: { aba } });

  // "ontem", ou o nome do dia quando o dia de referência não é ontem ("Sábado 08/11").
  const nomeDoDia = (d) => d === ontem ? t('home.days.yesterday') : `${formatWeekday(getDiaSemana(d))} ${formatDate(d, 'dayMonth')}`;
  const referenciaEhOntem = !diaReferencia || diaReferencia === ontem;

  const rotuloReceita = role === 'professor'
    ? t('home.cards.reports.monthlyForecast')
    : (referenciaEhOntem ? t('home.cards.reports.revenueYesterday') : t('home.cards.reports.revenueOf', { dia: nomeDoDia(diaReferencia) }));

  const paisDaMinhaUnidade = catalogs.unidades?.find(u => String(u.id) === String(minhaUnidadeId))?.pais;
  const receitasExibidas = role === 'professor'
    ? [{ valor: previsaoMensalProfessor, pais: paisDaMinhaUnidade }]
    : (resumo.receitas.length > 0 ? resumo.receitas : [{ valor: 0, pais: paisDaMinhaUnidade || escopo.unidades[0]?.pais }]);

  const periodoValidacao = role === 'admin'
    ? t('home.cards.validation.periodSince', { dia: nomeDoDia(inicioJanela) })
    : t('home.cards.validation.periodLast7');

  const getColetivaStatus = (pct) => {
      if (pct === null) return { color: "text-slate-400", theme: "slate", label: "—", bar: "bg-slate-300" };
      if (pct === 100) return { color: "text-emerald-500", theme: "green", label: t('home.cards.monitoring.status.excellent'), bar: "bg-emerald-500" };
      if (pct >= 80) return { color: "text-blue-500", theme: "blue", label: t('home.cards.monitoring.status.inProgress'), bar: "bg-blue-500" };
      if (pct >= 50) return { color: "text-amber-500", theme: "orange", label: t('home.cards.monitoring.status.inProgress'), bar: "bg-amber-500" };
      return { color: "text-red-500", theme: "red", label: t('home.cards.monitoring.status.attention'), bar: "bg-red-500" };
  };
  const coletivaStatus = getColetivaStatus(resumo.percentual);

  const temPendencia = !erroCarga && resumo.aValidar > 0;
  const temaValidacao = erroCarga ? "orange" : (temPendencia ? "red" : (resumo.aulasNoPeriodo > 0 ? "green" : "slate"));

  // 🟢 Role adaptada ao idioma
  const userContextLabel = role === 'admin' ? t('home.roles.admin') : (ehLider(role) ? userData.unidadeNome : (role === 'professor' ? t('home.roles.professor') : t('home.roles.mentor')));

  // ===================== CARDS =====================
  const cardRelatorio = permissions.relatorio && (
      <DashboardCard
          key="relatorio"
          title={t('home.cards.reports.title')}
          subtitle={rotuloReceita}
          icon={BarChart2}
          theme="blue"
          footerText={t('home.cards.reports.footer')}
          onClick={() => navigate('/app/relatorio-gerencial')}
      >
          <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/50 mt-2">
              <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">{rotuloReceita}</p>
              {(role === 'professor' ? loadingCatalogs : carregando) ? <Loader2 className="w-6 h-6 animate-spin text-blue-500"/> : (
                  erroCarga && role !== 'professor' ? <ErroCarregamento texto={t('home.loadError')} /> : (
                      <>
                          {/* Uma linha por moeda: cada valor no símbolo do país da unidade (R$, AR$...). */}
                          <h4 className="text-3xl font-black text-blue-700 dark:text-blue-300 tracking-tight">
                              {formatCurrency(receitasExibidas[0].valor, receitasExibidas[0].pais, { maximumFractionDigits: 0 })}
                          </h4>
                          {receitasExibidas.slice(1).map(r => (
                              <p key={getCurrencyCode(r.pais)} className="text-sm font-black text-blue-600/80 dark:text-blue-300/80 tracking-tight">
                                  + {formatCurrency(r.valor, r.pais, { maximumFractionDigits: 0 })}
                              </p>
                          ))}
                      </>
                  )
              )}
          </div>
      </DashboardCard>
  );

  const [aulaEmDestaque, ...aulasDepois] = agendaHoje.aulas;
  // Na linha de baixo: gestor quer saber ONDE (unidade); unidade quer saber QUEM (professor).
  const detalheDaAula = (aula) => (ehLider(role) ? primeiroNome(aula.professorNome) : aula.unidadeNome);

  const cardCronograma = permissions.cronograma && (
      <DashboardCard
          key="cronograma"
          title={t('home.cards.schedule.title')}
          subtitle={t('home.cards.schedule.subtitle')}
          icon={Calendar}
          theme="purple"
          footerText={t('home.cards.schedule.footer')}
          onClick={() => navigate('/app/cronograma')}
          activeEffect={!!aulaEmDestaque}
      >
          <div className="flex flex-col justify-center h-full">
              {loadingCatalogs ? <Loader2 className="w-6 h-6 animate-spin text-purple-500 mx-auto"/> : (
                  aulaEmDestaque ? (
                      <>
                          <div className="flex justify-between items-start">
                              <div>
                                  <p className={`text-[9px] font-bold uppercase mb-0.5 flex items-center gap-1 ${aulaEmDestaque.agora ? 'text-red-600' : 'text-green-600'}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${aulaEmDestaque.agora ? 'bg-red-500' : 'bg-green-500'}`}></span>
                                      {aulaEmDestaque.agora ? t('home.cards.schedule.now') : t('home.cards.schedule.next')}
                                  </p>
                                  <h4 className="text-4xl font-black text-slate-800 dark:text-white leading-none">
                                      {aulaEmDestaque.hora}
                                  </h4>
                              </div>
                              <div className="text-right">
                                  <span className="text-[10px] font-black uppercase text-white px-2 py-0.5 rounded shadow-sm" style={{ backgroundColor: aulaEmDestaque.modalidadeCor }}>
                                      {aulaEmDestaque.modalidadeNome}
                                  </span>
                              </div>
                          </div>
                          <div className="mt-3 border-t border-slate-50 pt-2 flex justify-between items-center">
                              <div className="flex-1 min-w-0 pr-2">
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">{t('home.cards.schedule.unit')}</p>
                                  <p className="text-xs font-bold text-slate-700 truncate">{aulaEmDestaque.unidadeNome}</p>
                              </div>
                              <div className="flex items-center gap-2 text-right">
                                  <div>
                                      <p className="text-[10px] text-slate-400 font-bold uppercase">{t('home.cards.schedule.teacher')}</p>
                                      <p className="text-xs font-bold text-slate-700">{primeiroNome(aulaEmDestaque.professorNome)}</p>
                                  </div>
                                  <ProfessorAvatar name={aulaEmDestaque.professorNome} />
                              </div>
                          </div>
                          {aulasDepois.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-slate-50 space-y-1">
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">{t('home.cards.schedule.after')}</p>
                                  {aulasDepois.map(aula => (
                                      <div key={aula.id} className="flex items-center gap-2 text-xs">
                                          <span className="font-black text-slate-700 w-10 shrink-0">{aula.hora}</span>
                                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: aula.modalidadeCor }}></span>
                                          <span className="font-bold text-slate-600 uppercase truncate">{aula.modalidadeNome}</span>
                                          <span className="text-slate-400 truncate ml-auto">{detalheDaAula(aula)}</span>
                                      </div>
                                  ))}
                                  {agendaHoje.restantes > 0 && (
                                      <p className="text-[10px] text-slate-400 font-bold text-right">{t('home.cards.schedule.moreToday', { count: agendaHoje.restantes })}</p>
                                  )}
                              </div>
                          )}
                      </>
                  ) : (
                      <div className="text-center opacity-60">
                          <CheckCircle2 className="w-8 h-8 mx-auto mb-1 text-slate-300"/>
                          <p className="text-xs font-bold text-slate-500 uppercase">{t('home.cards.schedule.noMoreClasses')}</p>
                      </div>
                  )
              )}
          </div>
      </DashboardCard>
  );

  const cardValidacao = permissions.validacaoDiaria && (
      <DashboardCard
          key="validacao"
          title={t('home.cards.validation.title')}
          subtitle={t('home.cards.validation.subtitle')}
          icon={CheckCircle2}
          theme={temaValidacao}
          footerText={temPendencia ? t('home.cards.validation.resolveNow') : t('home.cards.validation.history')}
          onClick={() => (temPendencia
              ? abrirPendencias({ inicio: resumo.maisAntiga, fim: hoje, unidadeIds: resumo.unidadesComPendencia })
              : navigate('/app/validacao-diaria'))}
      >
          <div className="flex flex-col justify-center h-full">
              {carregando ? <Loader2 className="w-6 h-6 animate-spin"/> : erroCarga ? <ErroCarregamento texto={t('home.loadError')} /> : (
                  <>
                      {temPendencia ? (
                          <div className="flex items-center gap-3">
                              <span className="text-6xl font-black text-red-600 tracking-tighter">{resumo.aValidar}</span>
                              <div className="flex flex-col border-l-2 border-red-200 pl-3">
                                  <span className="text-xs font-bold text-red-500 uppercase">{t('home.cards.validation.classes')}</span>
                                  <span className="text-xs font-bold text-red-400 uppercase">{t('home.cards.validation.toValidate')}</span>
                                  {resumo.maisAntiga && resumo.maisAntiga < hoje && (
                                      <span className="text-[10px] font-bold text-red-400 mt-1">
                                          {t('home.cards.validation.oldest', { dia: nomeDoDia(resumo.maisAntiga) })}
                                      </span>
                                  )}
                              </div>
                          </div>
                      ) : resumo.aulasNoPeriodo > 0 ? (
                          <div className="flex flex-col items-center w-full bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                              <Check className="w-8 h-8 text-emerald-600 mb-1" />
                              <p className="text-sm font-black text-emerald-600 uppercase">{t('home.cards.validation.allValidated')}</p>
                          </div>
                      ) : (
                          <div className="text-center opacity-60">
                              <CheckCircle2 className="w-8 h-8 mx-auto mb-1 text-slate-300"/>
                              <p className="text-xs font-bold text-slate-500 uppercase">{t('home.cards.validation.noClasses')}</p>
                          </div>
                      )}
                      <div className="mt-2 flex items-center justify-between text-[10px] font-bold uppercase text-slate-400">
                          <span>{periodoValidacao}</span>
                          {resumo.maisTardeHoje > 0 && (
                              <span className="normal-case">{t('home.cards.validation.laterToday', { count: resumo.maisTardeHoje })}</span>
                          )}
                      </div>
                  </>
              )}
          </div>
      </DashboardCard>
  );

  const cardMonitoramento = permissions.validacaoColetiva && (
      <DashboardCard
          key="monitoramento"
          title={t('home.cards.monitoring.title')}
          subtitle={referenciaEhOntem ? t('home.cards.monitoring.subtitle') : t('home.cards.monitoring.subtitleOf', { dia: nomeDoDia(diaReferencia) })}
          icon={ShieldCheck}
          theme={erroCarga ? "orange" : coletivaStatus.theme}
          footerText={t('home.cards.monitoring.footer')}
          onClick={() => navigate('/app/validacao-coletiva')}
      >
          <div className="flex flex-col justify-center h-full">
              {carregando ? <Loader2 className="w-6 h-6 animate-spin"/> : erroCarga ? <ErroCarregamento texto={t('home.loadError')} /> : (
                  resumo.percentual === null ? (
                      // Sem aula esperada no período: não existe "100% EXCELENTE" de um dia sem aula.
                      <div className="text-center opacity-60">
                          <ShieldCheck className="w-8 h-8 mx-auto mb-1 text-slate-300"/>
                          <p className="text-xs font-bold text-slate-500 uppercase">{t('home.cards.monitoring.noClasses')}</p>
                      </div>
                  ) : (
                  <>
                      <div className="flex items-baseline justify-between mb-2">
                          <span className={`text-5xl font-black tracking-tighter ${coletivaStatus.color}`}>
                              {resumo.percentual}%
                          </span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded bg-white border shadow-sm ${coletivaStatus.color.replace('text-', 'border-')}`}>
                              {coletivaStatus.label}
                          </span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                          <div
                              className={`h-full ${coletivaStatus.bar} transition-all duration-1000 ease-out`}
                              style={{ width: `${resumo.percentual}%` }}
                          ></div>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2 text-right font-bold uppercase">
                          {t('home.cards.monitoring.validatedOf', { validated: resumo.validadas, total: resumo.esperadas })}
                      </p>
                      {/* Onde agir: as unidades que mais deixaram aulas sem validar. Clique abre as pendências dela. */}
                      {resumo.maisAtrasadas.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-50 dark:border-slate-700/50 space-y-1">
                              <p className="text-[10px] text-slate-400 font-bold uppercase">{t('home.cards.monitoring.mostLate')}</p>
                              {resumo.maisAtrasadas.map(u => (
                                  <button
                                      key={u.id}
                                      type="button"
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          abrirPendencias({ inicio: diaReferencia, fim: diaReferencia, unidadeIds: [u.id] });
                                      }}
                                      className="w-full flex items-center gap-2 text-xs rounded-lg px-2 py-1 -mx-2 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                                  >
                                      <span className="font-bold text-slate-700 dark:text-slate-200 uppercase truncate">{u.nome}</span>
                                      <span className="ml-auto shrink-0 font-black text-red-500">{t('home.cards.monitoring.pendingShort', { count: u.pendentes })}</span>
                                      <ArrowRight className="w-3 h-3 shrink-0 text-red-400" />
                                  </button>
                              ))}
                          </div>
                      )}
                  </>
                  )
              )}
          </div>
      </DashboardCard>
  );

  // Ordem pelo que cada perfil mais precisa: primeiro o que pede ação (validação), depois o acompanhamento.
  const cards = (isGestor
    ? [cardValidacao, cardMonitoramento, cardRelatorio, cardCronograma]
    : [cardValidacao, cardCronograma, cardRelatorio]
  ).filter(Boolean);
  const colunasDoGrid = cards.length >= 4 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 lg:grid-cols-3";

  // ===================== ATALHOS =====================
  const atalhos = [
    permissions.pratiquePlay && { key: 'play', icon: Headphones, label: t('sidebar.items.pratiquePlay'), cor: "bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400", onClick: () => navigate('/app/pratique-play') },
    permissions.linkAluno && { key: 'link', icon: LinkIcon, label: t('sidebar.items.linkAluno'), cor: "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400", onClick: () => window.open('/horarios', '_blank', 'noopener') },
    permissions.cfgUnidades && { key: 'unidades', icon: Building2, label: t('settingsPage.tabs.unidades'), cor: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400", onClick: () => abrirConfiguracoes('unidades') },
    permissions.cfgProfessores && { key: 'professores', icon: Users, label: t('settingsPage.tabs.professores'), cor: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400", onClick: () => abrirConfiguracoes('professores') },
    permissions.cfgModalidades && { key: 'modalidades', icon: Dumbbell, label: t('settingsPage.tabs.modalidades'), cor: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400", onClick: () => abrirConfiguracoes('modalidades') },
    permissions.cfgFeriados && { key: 'feriados', icon: CalendarDays, label: t('settingsPage.tabs.feriados'), cor: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400", onClick: () => abrirConfiguracoes('feriados') },
  ].filter(Boolean);

  return (
    <div className="p-6 md:p-8 max-w-[1920px] mx-auto animate-fade-in min-h-screen bg-slate-50 dark:bg-[#0b1120]">

      <div className="mb-8 flex flex-col md:flex-row justify-between items-end pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
            <h1 className="text-4xl font-light text-slate-700 dark:text-slate-300 tracking-tight">
                {greeting}, <strong className="font-black text-slate-900 dark:text-white uppercase">{userData.nome}</strong>.
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-red-600"/>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                        {userContextLabel}
                    </span>
                </div>
                {online ? (
                    <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-800">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{t('home.systemOnline')}</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg border border-red-100 dark:border-red-800">
                        <WifiOff className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        <span className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-wider">{t('home.offline')}</span>
                    </div>
                )}
                {/* Quando os números foram buscados + botão para buscar de novo agora. */}
                <button
                    type="button"
                    onClick={atualizarAgora}
                    disabled={carregando}
                    title={t('home.refresh')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:border-slate-300 transition-colors disabled:opacity-60"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                        {atualizadoEm && !carregando ? t('home.updatedAt', { hora: formatTime(atualizadoEm) }) : t('home.refresh')}
                    </span>
                </button>
            </div>
        </div>
        <CorporateClock />
      </div>

      <div className={`grid grid-cols-1 ${colunasDoGrid} gap-6 mb-8`}>
        {cards}
      </div>

      {atalhos.length > 0 && (
        <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">{t('home.shortcuts')}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {atalhos.map(({ key, ...atalho }) => <Atalho key={key} {...atalho} />)}
            </div>
        </div>
      )}
    </div>
  );
}

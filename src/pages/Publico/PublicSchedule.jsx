import React, { useState, useEffect, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../../services/firebase';
import { collection, getDocs, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import {
  Search, Clock, ChevronRight, Loader2,
  Printer, ArrowLeft, Dumbbell, Sun, Moon, ChevronDown, MapPin, Navigation, LocateFixed, Map, List, Check,
  X, Share2, AlertTriangle, CalendarDays, CalendarClock
} from 'lucide-react';
import { useTranslation } from "react-i18next"; // 🟢 MOTOR ACIONADO
import { LANGUAGES, formatWeekday, getDiaSemana } from '../../utils/formatters';

// 🟢 IMPORTS DO MOTOR DE MAPAS (LEAFLET)
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// 🟢 CORREÇÃO DOS ÍCONES DO LEAFLET NO REACT E NOVOS ÍCONES PERSONALIZADOS
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const userIcon = new L.divIcon({
  className: 'custom-user-marker',
  html: `<div style="background-color: #ef4444; width: 36px; height: 36px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; overflow: hidden;">
           <img src="/logos/pratique.png" style="width: 24px; height: auto; filter: brightness(0) invert(1);" />
         </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18]
});

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// --- CONFIGURAÇÃO DAS IMAGENS ---
const LOGOS = {
  'pratique': '/logos/pratique.png'
};

const getTodayStr = () => new Date().toLocaleDateString('en-CA');

// 🟢 SUPER FILTRO CAÇA-FANTASMAS (Lógica de Abate de Aulas Antigas)
const isAulaAtiva = (a) => {
    if (
        a.ativo === false ||
        a.encerrada === true || a.encerrado === true ||
        a.excluida === true || a.excluido === true ||
        a.lixeira === true || a.oculta === true ||
        a.inativa === true || a.inativo === true ||
        a.status === false || a.status === 0
    ) return false;

    if (a.status && typeof a.status === 'string') {
        const s = a.status.toLowerCase();
        if (s.includes('encerra') || s.includes('inativ') || s.includes('exclui') || s.includes('lixeira')) {
            return false;
        }
    }

    const todayStr = getTodayStr();
    let fim = a.dataFim;
    let inicio = a.dataInicio;

    if (fim && typeof fim.toDate === 'function') fim = fim.toDate().toLocaleDateString('en-CA');
    if (inicio && typeof inicio.toDate === 'function') inicio = inicio.toDate().toLocaleDateString('en-CA');

    if (typeof fim === 'string' && fim.includes('/')) {
        const [d, m, y] = fim.split('/');
        if (y && m && d) fim = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (typeof inicio === 'string' && inicio.includes('/')) {
        const [d, m, y] = inicio.split('/');
        if (y && m && d) inicio = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    if (fim && fim < todayStr) return false;
    if (inicio && inicio > todayStr) return false;

    return true;
};

const formatProfessorName = (name, defaultName) => {
  if (!name) return defaultName;
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
};

const removerAcentos = (str) => {
    if (!str) return "";
    return str.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
};

// Cor de texto legível sobre a cor da modalidade (só na tela; na impressão o CSS força branco).
const getContrastColor = (hexColor) => {
  let hex = String(hexColor || '').replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) return '#ffffff';
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return ((r * 299) + (g * 587) + (b * 114)) / 1000 >= 160 ? '#111827' : '#ffffff';
};

// 🟢 MAPAS
// URL oficial e universal do Google Maps: no celular abre o app (Maps/Waze pergunta), no computador abre o site.
// https://developers.google.com/maps/documentation/urls/get-started#search-action
const MAPS_SEARCH_URL = 'https://www.google.com/maps/search/?api=1&query=';

// Aceita "...?q=lat,lng", "...&query=lat,lng", "...@lat,lng,17z" e "...!3dLAT!4dLNG".
const extractCoordsFromUrl = (url) => {
    if (!url) return null;
    const match = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
        || url.match(/(?:[?&](?:q|query|ll)=|@)(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (!match) return null;
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (Number.isNaN(lat) || Number.isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
};

const getMapsLink = (unidade) => {
    if (!unidade) return '#';
    const linkOficial = String(unidade.linkGoogleMaps || unidade.localizacao || '').trim();

    // Link real colado no cadastro (google.com/maps, maps.app.goo.gl, waze...): usa como está, mantém o pin do lugar.
    // Links "googleusercontent.com" não são endereços públicos do Google e davam erro 404.
    if (/^https?:\/\//i.test(linkOficial) && !linkOficial.includes('googleusercontent.com')) return linkOficial;

    const coords = extractCoordsFromUrl(linkOficial);
    if (coords) return `${MAPS_SEARCH_URL}${coords.lat},${coords.lng}`;

    const texto = unidade.enderecoCompleto || `${unidade.nome || ''} ${unidade.cidade || ''} ${unidade.estado || ''}`.trim();
    return `${MAPS_SEARCH_URL}${encodeURIComponent(texto)}`;
};

const extractCoords = (unidade) => extractCoordsFromUrl(unidade.linkGoogleMaps || unidade.localizacao || "");

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

// 🌍 SELETOR DE IDIOMAS (usado na busca e na grade)
const LanguageMenu = ({ isDarkMode, open, setOpen, onChange, currentLang, language, title }) => (
    <div className="relative">
        <button
            onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
            className={`h-11 flex items-center gap-2 px-3 rounded-full border transition-all active:scale-95 ${isDarkMode ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm'}`}
            title={title}
        >
            <img src={currentLang.flag} alt={currentLang.name} className="w-5 h-auto rounded-[2px] shadow-sm" />
            <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
            <div className={`absolute right-0 mt-2 w-48 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border z-[60] ${isDarkMode ? 'bg-[#1c1c1e] border-white/10' : 'bg-white border-gray-200'}`}>
                {LANGUAGES.map(lang => (
                    <button
                        key={lang.code}
                        onClick={(e) => { e.stopPropagation(); onChange(lang.code); }}
                        className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors ${language === lang.code ? (isDarkMode ? 'bg-red-500/15 text-red-400 font-bold' : 'bg-red-50 text-red-600 font-bold') : (isDarkMode ? 'text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50')}`}
                    >
                        <div className="flex items-center gap-3">
                            <img src={lang.flag} alt={lang.name} className="w-5 h-auto rounded-sm shadow-sm" />
                            <span>{lang.name}</span>
                        </div>
                        {language === lang.code && <Check className="w-4 h-4" />}
                    </button>
                ))}
            </div>
        )}
    </div>
);

export default function PublicSchedule() {
  const { t, i18n } = useTranslation(); // 🟢 MOTOR ACIONADO
  const navigate = useNavigate();

  const [unidades, setUnidades] = useState([]);
  const [modalidadesMap, setModalidadesMap] = useState({});
  const [professoresMap, setProfessoresMap] = useState({});

  const [loading, setLoading] = useState(true);
  const [loadingGrade, setLoadingGrade] = useState(false);
  const [gradeUnidade, setGradeUnidade] = useState([]);

  // Tema lembrado no aparelho do aluno
  const [isDarkMode, setIsDarkMode] = useState(() => {
      try { const salvo = localStorage.getItem('tema_horarios'); if (salvo) return salvo === 'dark'; } catch { /* sem storage */ }
      return true;
  });
  useEffect(() => {
      try { localStorage.setItem('tema_horarios', isDarkMode ? 'dark' : 'light'); } catch { /* sem storage */ }
  }, [isDarkMode]);

  const [busca, setBusca] = useState("");
  const [termoDebounce, setTermoDebounce] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  const [userCoords, setUserCoords] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [viewMode, setViewMode] = useState('list');

  const [resultadosUnidade, setResultadosUnidade] = useState([]);
  const [resultadosModalidade, setResultadosModalidade] = useState(null);

  const [printDensity, setPrintDensity] = useState('auto');
  const [showPrintMenu, setShowPrintMenu] = useState(false);

  // 🟢 LINK DIRETO DA UNIDADE: /horarios?unidade=ID
  // A URL é a fonte da verdade: abrir uma unidade grava o ID na URL, voltar remove.
  const [searchParams, setSearchParams] = useSearchParams();
  const unidadeIdUrl = searchParams.get('unidade');
  const unidadeSelecionada = useMemo(
      () => (unidadeIdUrl ? unidades.find(u => u.id === unidadeIdUrl) || null : null),
      [unidadeIdUrl, unidades]
  );
  const abriuPelaLista = useRef(false);
  const [linkInvalido, setLinkInvalido] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);

  const abrirUnidade = (unidade) => {
      abriuPelaLista.current = true;
      setLinkInvalido(false);
      setShowPrintMenu(false);
      setSearchParams({ unidade: unidade.id });
      window.scrollTo({ top: 0 });
  };

  const voltarParaLista = () => {
      setShowPrintMenu(false);
      if (abriuPelaLista.current) {
          // Veio da lista: volta no histórico e preserva busca/filtros como estavam.
          abriuPelaLista.current = false;
          navigate(-1);
      } else {
          // Veio por link direto: não sai do sistema, cai na busca geral e limpa o parâmetro.
          setSearchParams({}, { replace: true });
      }
  };

  // 🟢 ESTADO DO MENU DE IDIOMAS
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const currentLang = LANGUAGES.find(lang => lang.code === (i18n.language || 'pt-BR')) || LANGUAGES[0];

  const changeLanguage = (lng) => {
      i18n.changeLanguage(lng);
      localStorage.setItem("idioma_pratique", lng);
      setIsLangMenuOpen(false);
  };

  useEffect(() => {
    const init = async () => {
        setLoading(true);
        try {
            const [uSnap, mSnap, pSnap] = await Promise.all([
                getDocs(query(collection(db, 'unidades'), orderBy('nome'))),
                getDocs(collection(db, 'modalidades')),
                getDocs(collection(db, 'professores'))
            ]);

            const uList = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const mAbs = {}; mSnap.docs.forEach(d => mAbs[d.id] = d.data());
            const pAbs = {}; pSnap.docs.forEach(d => pAbs[d.id] = d.data().nome);

            setUnidades(uList);
            setModalidadesMap(mAbs);
            setProfessoresMap(pAbs);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    init();
  }, []);

  // Link com ID que não existe: avisa e volta para a busca.
  useEffect(() => {
      if (loading || !unidadeIdUrl) return;
      if (!unidades.some(u => u.id === unidadeIdUrl)) {
          setLinkInvalido(true);
          setSearchParams({}, { replace: true });
      }
  }, [loading, unidadeIdUrl, unidades, setSearchParams]);

  const estadosDisponiveis = useMemo(() => {
      const estados = unidades.map(u => u.estado).filter(Boolean);
      return [...new Set(estados)].sort();
  }, [unidades]);

  useEffect(() => {
      const timer = setTimeout(() => { setTermoDebounce(busca); }, 300);
      return () => clearTimeout(timer);
  }, [busca]);

  const ativarRadarGPS = () => {
      if (!navigator.geolocation) {
          alert(t('publicSchedule.alerts.noGPS', "O seu navegador ou dispositivo não suporta GPS."));
          return;
      }
      setIsLocating(true);
      setUserCoords(null);
      navigator.geolocation.getCurrentPosition((position) => {
          setUserCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
          setBusca(""); setFiltroEstado(""); setTermoDebounce("");
          setViewMode('map');
          setIsLocating(false);
      }, () => {
          alert(t('publicSchedule.alerts.gpsDenied', "Não foi possível aceder ao seu GPS. Verifique as permissões de localização."));
          setIsLocating(false);
      });
  };

  const limparGPS = () => {
      setUserCoords(null);
      setViewMode('list');
  };

  useEffect(() => {
      let unidadesFiltradas = unidades;

      if (userCoords) {
          const unidadesComDistancia = unidades.map(u => {
              const coords = extractCoords(u);
              if (coords) {
                  const dist = calculateDistance(userCoords.lat, userCoords.lng, coords.lat, coords.lng);
                  return { ...u, distance: dist, coords };
              }
              return { ...u, distance: 9999, coords: null };
          });

          const unidadesProximas = unidadesComDistancia
              .filter(u => u.distance <= 15 && u.coords !== null)
              .sort((a, b) => a.distance - b.distance);

          setResultadosUnidade(unidadesProximas);
          setResultadosModalidade(null);
          return;
      }

      if (filtroEstado) unidadesFiltradas = unidades.filter(u => u.estado === filtroEstado);

      if (!termoDebounce.trim()) {
          setResultadosUnidade(filtroEstado ? unidadesFiltradas : []);
          setResultadosModalidade(null);
          return;
      }

      const termoNormalizado = removerAcentos(termoDebounce);
      setResultadosUnidade(unidadesFiltradas.filter(u =>
          removerAcentos(u.nome).includes(termoNormalizado) ||
          removerAcentos(u.cidade).includes(termoNormalizado) ||
          removerAcentos(u.enderecoCompleto).includes(termoNormalizado)
      ));

      const modIds = Object.keys(modalidadesMap).filter(id => removerAcentos(modalidadesMap[id].nome).includes(termoNormalizado));
      if (modIds.length > 0) buscarOndeTemModalidade(modIds, filtroEstado);
      else setResultadosModalidade(null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termoDebounce, unidades, modalidadesMap, filtroEstado, userCoords]);

  const buscarOndeTemModalidade = async (modIds, estadoFilter) => {
      try {
          const q = query(collection(db, 'aulas'), where('modalidadeId', 'in', modIds.slice(0, 10)));
          const snap = await getDocs(q);
          const agrupado = {};

          snap.docs.forEach(doc => {
              const aula = doc.data();
              if (!isAulaAtiva(aula)) return;

              const unit = unidades.find(u => u.id === aula.unidadeId);
              if (unit && (!estadoFilter || unit.estado === estadoFilter)) {
                  if (!agrupado[aula.unidadeId]) agrupado[aula.unidadeId] = { unidade: unit, aulas: [] };
                  agrupado[aula.unidadeId].aulas.push({
                      ...aula,
                      modalidadeNome: modalidadesMap[aula.modalidadeId]?.nome,
                      dias: aula.dias || []
                  });
              }
          });
          setResultadosModalidade(Object.values(agrupado));
      } catch (e) { console.error(e); }
  };

  const unidadeSelecionadaId = unidadeSelecionada?.id;
  useEffect(() => {
      if (!unidadeSelecionadaId) return;
      setLoadingGrade(true);

      const q = query(collection(db, 'aulas'), where('unidadeId', '==', unidadeSelecionadaId));

      const unsubscribe = onSnapshot(q, (snap) => {
          const defaultTeacherName = t('publicSchedule.defaultTeacher', 'Instrutor');
          const data = snap.docs.map(d => {
              const a = d.data();
              if (!isAulaAtiva(a)) return null;

              const mod = modalidadesMap[a.modalidadeId];
              if(!mod) return null;

              return {
                  ...a,
                  modalidadeNome: mod.nome,
                  modalidadeCor: mod.cor || '#333',
                  professorNome: formatProfessorName(professoresMap[a.professorId], defaultTeacherName)
              };
          }).filter(Boolean);

          setGradeUnidade(data);
          setLoadingGrade(false);
      }, (error) => {
          console.error("Erro na grelha tempo real:", error);
          setLoadingGrade(false);
      });

      return () => unsubscribe();
  }, [unidadeSelecionadaId, modalidadesMap, professoresMap, t]);

  const gradeOrganizada = useMemo(() => {
      if (!gradeUnidade.length) return { dias: [], horarios: [] };
      const diasFinais = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
      const temSabado = gradeUnidade.some(aula => aula.dias && aula.dias.includes('Sábado'));
      const temDomingo = gradeUnidade.some(aula => aula.dias && aula.dias.includes('Domingo'));
      if (temSabado) diasFinais.push('Sábado');
      if (temDomingo) diasFinais.push('Domingo');
      const horarios = [...new Set(gradeUnidade.map(a => a.hora))].sort();
      return { dias: diasFinais, horarios };
  }, [gradeUnidade]);

  // Legenda de modalidades (sempre com todas as modalidades da unidade, para poder trocar o filtro)
  const modalidadesDaGrade = useMemo(() => {
      const porModalidade = {};
      gradeUnidade.forEach(a => {
          if (!porModalidade[a.modalidadeId]) porModalidade[a.modalidadeId] = { id: a.modalidadeId, nome: a.modalidadeNome, cor: a.modalidadeCor, qtd: 0 };
          porModalidade[a.modalidadeId].qtd += (a.dias || []).length;
      });
      return Object.values(porModalidade).sort((a, b) => b.qtd - a.qtd);
  }, [gradeUnidade]);

  const diaDeHoje = getDiaSemana(new Date());

  // 🟢 FILTROS DA TELA: "Hoje"/"Semana" e modalidade clicada na legenda.
  // Na impressão a grade volta sempre para a semana completa (o @media print monta as colunas com todos os dias).
  const [visao, setVisao] = useState('semana');
  const [filtroModalidade, setFiltroModalidade] = useState(null);
  const [imprimindo, setImprimindo] = useState(false);

  useEffect(() => { setFiltroModalidade(null); }, [unidadeSelecionadaId]);

  // Cobre o botão Imprimir e também o Ctrl+P do navegador.
  useEffect(() => {
      const antes = () => flushSync(() => setImprimindo(true));
      const depois = () => setImprimindo(false);
      window.addEventListener('beforeprint', antes);
      window.addEventListener('afterprint', depois);
      return () => { window.removeEventListener('beforeprint', antes); window.removeEventListener('afterprint', depois); };
  }, []);

  const filtrosAtivos = !imprimindo;
  const modalidadeFiltrada = filtrosAtivos && filtroModalidade ? modalidadesDaGrade.find(m => m.id === filtroModalidade) : null;

  const aulasExibidas = useMemo(
      () => (modalidadeFiltrada ? gradeUnidade.filter(a => a.modalidadeId === modalidadeFiltrada.id) : gradeUnidade),
      [gradeUnidade, modalidadeFiltrada]
  );

  const diasExibidos = useMemo(() => {
      if (!filtrosAtivos) return gradeOrganizada.dias;
      if (visao === 'hoje') return [diaDeHoje];
      if (modalidadeFiltrada) return gradeOrganizada.dias.filter(d => aulasExibidas.some(a => a.dias?.includes(d)));
      return gradeOrganizada.dias;
  }, [filtrosAtivos, visao, diaDeHoje, modalidadeFiltrada, gradeOrganizada, aulasExibidas]);

  const horariosExibidos = useMemo(() => {
      if (!filtrosAtivos) return gradeOrganizada.horarios;
      return [...new Set(aulasExibidas.filter(a => diasExibidos.some(d => a.dias?.includes(d))).map(a => a.hora))].sort();
  }, [filtrosAtivos, gradeOrganizada, aulasExibidas, diasExibidos]);

  const totalAulasExibidas = visao === 'hoje'
      ? aulasExibidas.filter(a => a.dias?.includes(diaDeHoje)).length
      : aulasExibidas.reduce((soma, a) => soma + (a.dias || []).length, 0);

  const getAulasCell = (dia, hora) => aulasExibidas.filter(a => a.hora === hora && a.dias?.includes(dia));

  const appliedDensity = useMemo(() => {
      if (printDensity !== 'auto') return printDensity;
      const linhas = gradeOrganizada.horarios.length;
      if (linhas > 14) return 'ultra-compact';
      if (linhas > 10) return 'compact';
      return 'comfortable';
  }, [printDensity, gradeOrganizada]);

  const handlePrint = (mode) => {
      setPrintDensity(mode);
      setShowPrintMenu(false);
      setTimeout(() => window.print(), 100);
  };

  const compartilharUnidade = async () => {
      if (!unidadeSelecionada) return;
      const url = `${window.location.origin}/horarios?unidade=${unidadeSelecionada.id}`;
      if (navigator.share) {
          try { await navigator.share({ title: unidadeSelecionada.nome, url }); return; }
          catch (e) { if (e?.name === 'AbortError') return; }
      }
      try {
          await navigator.clipboard.writeText(url);
          setLinkCopiado(true);
          setTimeout(() => setLinkCopiado(false), 2500);
      } catch {
          window.prompt(t('publicSchedule.copyLinkPrompt'), url);
      }
  };

  // --- TEMA ---
  const bgPage = isDarkMode ? "bg-[#0b0b0c] text-white" : "bg-[#f5f5f7] text-[#1d1d1f]";
  const surface = isDarkMode ? "bg-[#161618] border-white/[0.08]" : "bg-white border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)]";
  const mutedText = isDarkMode ? "text-white/50" : "text-black/50";
  const chipIdle = isDarkMode ? 'bg-white/[0.06] border-white/10 text-white/70 hover:bg-white/10 hover:text-white' : 'bg-white border-black/[0.08] text-black/60 hover:bg-black/[0.03] hover:text-black shadow-sm';
  const chipActive = 'bg-[#ed1c24] border-transparent text-white shadow-lg shadow-red-500/25';
  const iconButton = isDarkMode ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm';

  const displayAddressLocal = (unidade) => {
      if (unidade.enderecoCompleto) return unidade.enderecoCompleto;
      return t('publicSchedule.noAddress', "Endereço não informado. Toque para ver no mapa.");
  };

  const localidade = (unidade) => [unidade.cidade, unidade.estado].filter(Boolean).join(' · ');

  const temBuscaAtiva = Boolean(termoDebounce.trim() || filtroEstado || userCoords);

  // Card de unidade: o card inteiro abre a grade; o endereço abre o mapa sem abrir a grade.
  const renderUnitCard = (unidade, children = null) => (
      <div
          key={unidade.id}
          role="button"
          tabIndex={0}
          aria-label={t('publicSchedule.openUnit', { name: unidade.nome })}
          onClick={() => abrirUnidade(unidade)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirUnidade(unidade); } }}
          className={`group relative rounded-3xl border p-4 md:p-5 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.99] outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${surface} ${isDarkMode ? 'hover:bg-[#1c1c1f] hover:border-white/15' : 'hover:shadow-[0_2px_4px_rgba(0,0,0,0.04),0_16px_40px_rgba(0,0,0,0.08)]'}`}
      >
          <div className="flex items-center gap-4">
              <div className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ed1c24] to-[#ff5a5f] text-white flex items-center justify-center shadow-lg shadow-red-500/20">
                  <MapPin className="w-5 h-5"/>
              </div>
              <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                      <h4 className="font-black text-[15px] md:text-base uppercase tracking-tight truncate">{unidade.nome}</h4>
                      {userCoords && unidade.distance < 9999 && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-500">
                              {unidade.distance.toFixed(1)} km
                          </span>
                      )}
                  </div>
                  {localidade(unidade) && <p className={`text-xs font-semibold mt-0.5 ${mutedText}`}>{localidade(unidade)}</p>}
                  <a
                      href={getMapsLink(unidade)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title={t('publicSchedule.openInMaps')}
                      className={`mt-1.5 inline-flex items-start gap-1.5 text-xs font-medium leading-snug max-w-full ${isDarkMode ? 'text-sky-400 hover:text-sky-300' : 'text-sky-600 hover:text-sky-700'}`}
                  >
                      <Navigation className="w-3.5 h-3.5 shrink-0 mt-0.5"/>
                      <span className="hover:underline line-clamp-2">{displayAddressLocal(unidade)}</span>
                  </a>
              </div>
              <div className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 group-hover:translate-x-0.5 ${isDarkMode ? 'bg-white/[0.06] text-white/60 group-hover:bg-[#ed1c24] group-hover:text-white' : 'bg-black/[0.04] text-black/40 group-hover:bg-[#ed1c24] group-hover:text-white'}`}>
                  <ChevronRight className="w-5 h-5"/>
              </div>
          </div>
          {children}
      </div>
  );

  // Link direto ainda carregando: evita piscar a tela de busca antes da grade.
  if (loading && unidadeIdUrl) {
      return (
          <div className={`min-h-screen ${bgPage} flex flex-col items-center justify-center gap-3`}>
              <Loader2 className="w-10 h-10 animate-spin text-[#ed1c24]"/>
              <p className={`text-xs font-bold uppercase tracking-widest ${mutedText}`}>{t('publicSchedule.loadingUnit')}</p>
          </div>
      );
  }

  if (!unidadeSelecionada) {
      return (
        <div className={`min-h-screen ${bgPage} transition-colors duration-500 relative overflow-x-hidden`} onClick={() => { setIsLangMenuOpen(false); }}>

            <div className={`absolute top-0 left-0 w-full h-[28rem] ${isDarkMode ? 'opacity-25' : 'opacity-[0.12]'} pointer-events-none`}>
                <div className="absolute top-[-55%] left-[-15%] w-[60%] h-[100%] rounded-full bg-red-600 blur-[130px]"></div>
                <div className="absolute top-[-55%] right-[-15%] w-[60%] h-[100%] rounded-full bg-sky-500 blur-[130px]"></div>
            </div>

            {/* 🟢 IDIOMA E TEMA (TOPO DIREITO) */}
            <div className="relative z-50 flex justify-end items-center gap-2 px-4 pt-4 md:px-8 md:pt-6">
                <LanguageMenu isDarkMode={isDarkMode} open={isLangMenuOpen} setOpen={setIsLangMenuOpen} onChange={changeLanguage} currentLang={currentLang} language={i18n.language} title={t('sidebar.changeLanguage')} />
                <button onClick={() => setIsDarkMode(!isDarkMode)} title={t('sidebar.changeTheme')} className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all active:scale-95 ${iconButton}`}>
                    {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400"/> : <Moon className="w-5 h-5"/>}
                </button>
            </div>

            <main className="relative z-10 w-full max-w-2xl mx-auto px-4 pb-24">

                {/* 🟢 MARCA */}
                <header className="flex flex-col items-center pt-6 pb-10 md:pt-10 md:pb-14 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <img src={LOGOS['pratique']} alt="Pratique" className={`h-20 md:h-28 object-contain ${isDarkMode ? 'brightness-0 invert' : ''}`} />
                    <h1 className="mt-6 text-5xl md:text-6xl font-black italic tracking-tighter flex justify-center gap-2 leading-none">
                        <span className="text-[#ed1c24]">HAPPY</span>
                        <span className="text-[#00adef]">ZONE</span>
                    </h1>
                    <p className={`mt-3 text-[11px] font-bold uppercase tracking-[0.35em] ${mutedText}`}>{t('publicSchedule.title', 'Quadro de Horários')}</p>
                </header>

                {linkInvalido && (
                    <div className={`mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-semibold animate-in fade-in ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5"/>
                        <p className="flex-1">{t('publicSchedule.unitNotFound')}</p>
                        <button onClick={() => setLinkInvalido(false)} className="shrink-0 -m-1 p-1 rounded-full hover:bg-amber-500/10"><X className="w-4 h-4"/></button>
                    </div>
                )}

                {/* 🟢 BUSCA */}
                <div className="relative group">
                    <Search className={`absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${isDarkMode ? 'text-white/40' : 'text-black/35'}`}/>
                    <input
                        type="text"
                        enterKeyHint="search"
                        placeholder={filtroEstado ? t('publicSchedule.searchIn', { state: filtroEstado }) : t('publicSchedule.searchPlaceholder', "Buscar unidade, endereço ou modalidade...")}
                        className={`w-full h-16 pl-14 pr-14 rounded-[1.25rem] border outline-none font-semibold text-base transition-all focus:ring-4 ${isDarkMode ? 'bg-[#161618] border-white/10 text-white placeholder:text-white/35 focus:border-red-500/60 focus:ring-red-500/15' : 'bg-white border-black/[0.08] text-black placeholder:text-black/35 shadow-[0_8px_30px_rgba(0,0,0,0.06)] focus:border-red-500/50 focus:ring-red-500/10'}`}
                        value={busca}
                        onChange={e => { setBusca(e.target.value); limparGPS(); }}
                    />
                    {busca && busca !== termoDebounce && <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-[#ed1c24]"/>}
                    {busca && busca === termoDebounce && (
                        <button onClick={() => setBusca("")} title={t('publicSchedule.clearSearch')} className={`absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center ${isDarkMode ? 'text-white/50 hover:bg-white/10' : 'text-black/40 hover:bg-black/5'}`}>
                            <X className="w-5 h-5"/>
                        </button>
                    )}
                </div>

                {/* 🟢 PERTO DE MIM + REGIÕES */}
                <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <span className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${mutedText}`}>
                            <MapPin className="w-3.5 h-3.5"/> {t('publicSchedule.location', 'Localização')}
                        </span>
                        {filtroEstado && (
                            <button onClick={() => setFiltroEstado("")} className="text-xs font-bold text-[#ed1c24] hover:underline py-2">{t('publicSchedule.clearState', 'Limpar Estado')}</button>
                        )}
                    </div>

                    <button
                        onClick={userCoords ? limparGPS : ativarRadarGPS}
                        className={`w-full h-14 rounded-2xl font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] ${userCoords
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400/60'
                            : 'bg-gradient-to-r from-sky-600 to-sky-500 text-white shadow-lg shadow-sky-500/25 hover:brightness-110'}`}
                    >
                        {isLocating ? <Loader2 className="w-5 h-5 animate-spin"/> : <LocateFixed className="w-5 h-5"/>}
                        {userCoords ? t('publicSchedule.gpsActive', "GPS Ativado (Limpar)") : t('publicSchedule.nearMe', "Perto de Mim")}
                    </button>

                    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1 snap-x">
                        <button
                            onClick={() => { setFiltroEstado(""); limparGPS(); }}
                            className={`snap-start shrink-0 h-11 px-5 rounded-full font-bold text-xs uppercase whitespace-nowrap border transition-all active:scale-95 ${!filtroEstado && !userCoords ? chipActive : chipIdle}`}
                        >
                            {t('publicSchedule.allRegions', 'Todas as Regiões')}
                        </button>
                        {estadosDisponiveis.map(uf => (
                            <button
                                key={uf}
                                onClick={() => { setFiltroEstado(uf); limparGPS(); }}
                                className={`snap-start shrink-0 h-11 min-w-[3.25rem] px-4 rounded-full font-bold text-xs uppercase whitespace-nowrap border transition-all active:scale-95 ${filtroEstado === uf ? chipActive : chipIdle}`}
                            >
                                {uf}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 🟢 RESULTADOS */}
                <section className="mt-8">
                    {!temBuscaAtiva && !busca && (
                        <div className={`rounded-3xl border p-8 text-center animate-in fade-in ${surface}`}>
                            <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ed1c24] to-[#00adef] text-white flex items-center justify-center shadow-lg">
                                <CalendarDays className="w-7 h-7"/>
                            </div>
                            <h2 className="text-lg font-black tracking-tight">{t('publicSchedule.startTitle')}</h2>
                            <p className={`mt-1.5 text-sm leading-relaxed ${mutedText}`}>{t('publicSchedule.startDesc')}</p>
                        </div>
                    )}

                    {userCoords && (
                         <div className="mb-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                             <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-2 px-1">
                                 <span className="p-1.5 bg-emerald-500/10 rounded-lg"><LocateFixed className="w-3.5 h-3.5"/></span>
                                 {t('publicSchedule.radar', 'No seu Radar (Raio de 15km)')}
                             </h3>

                             <div className={`grid grid-cols-2 p-1 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-black/[0.03] border-black/[0.06]'}`}>
                                 <button onClick={() => setViewMode('list')} className={`h-10 flex items-center justify-center gap-2 px-4 rounded-xl text-xs font-black uppercase transition-all ${viewMode === 'list' ? (isDarkMode ? 'bg-white/10 text-white' : 'bg-white shadow text-sky-600') : mutedText}`}>
                                     <List className="w-4 h-4"/> {t('publicSchedule.list', 'Lista')}
                                 </button>
                                 <button onClick={() => setViewMode('map')} className={`h-10 flex items-center justify-center gap-2 px-4 rounded-xl text-xs font-black uppercase transition-all ${viewMode === 'map' ? (isDarkMode ? 'bg-white/10 text-white' : 'bg-white shadow text-emerald-600') : mutedText}`}>
                                     <Map className="w-4 h-4"/> {t('publicSchedule.map', 'Mapa')}
                                 </button>
                             </div>
                         </div>
                    )}

                    {userCoords && viewMode === 'map' && (
                        <div className={`w-full h-[60vh] min-h-[380px] max-h-[560px] rounded-3xl overflow-hidden border shadow-2xl animate-in zoom-in-95 duration-500 relative z-0 ${isDarkMode ? 'border-white/10' : 'border-black/10'}`}>
                            <MapContainer center={[userCoords.lat, userCoords.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
                                <TileLayer
                                    url={isDarkMode ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}
                                    attribution='© OpenStreetMap contributors'
                                />

                                <Marker position={[userCoords.lat, userCoords.lng]} icon={userIcon}>
                                    <Popup className="custom-popup">
                                        <div className="text-center font-bold text-sm text-slate-800">{t('publicSchedule.youAreHere', '📍 Você está aqui!')}</div>
                                    </Popup>
                                </Marker>
                                <Circle center={[userCoords.lat, userCoords.lng]} pathOptions={{ fillColor: '#10b981', color: '#10b981' }} radius={1500} />

                                {resultadosUnidade.map(u => {
                                    if (!u.coords) return null;
                                    const isSelected = unidadeSelecionada?.id === u.id;

                                    return (
                                        <Marker
                                            key={u.id}
                                            position={[u.coords.lat, u.coords.lng]}
                                            icon={isSelected ? greenIcon : blueIcon}
                                            zIndexOffset={isSelected ? 1000 : 0}
                                        >
                                            <Popup>
                                                <div className="flex flex-col gap-2 min-w-[200px]">
                                                    <span className="font-black text-sm uppercase text-slate-800">{u.nome}</span>
                                                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded w-fit uppercase">🚗 {u.distance.toFixed(1)} km</span>
                                                    <a href={getMapsLink(u)} target="_blank" rel="noopener noreferrer" className="text-[10px] text-sky-700 leading-tight hover:underline">{displayAddressLocal(u)}</a>
                                                    <button onClick={() => abrirUnidade(u)} className="mt-2 w-full py-2.5 bg-[#ed1c24] text-white rounded-lg text-[11px] font-black uppercase tracking-widest hover:brightness-110">{t('publicSchedule.viewSchedules', 'Ver Horários')}</button>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    )
                                })}
                            </MapContainer>
                        </div>
                    )}

                    {(!userCoords || viewMode === 'list') && (
                        <div className="space-y-8">

                            {termoDebounce.length > 0 && resultadosModalidade && resultadosModalidade.length > 0 && !userCoords && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <h3 className="text-xs font-bold text-sky-500 uppercase tracking-wider flex items-center gap-2 mb-3 px-1">
                                        <span className="p-1.5 bg-sky-500/10 rounded-lg"><Dumbbell className="w-3.5 h-3.5"/></span>
                                        {t('publicSchedule.classesFound', 'Aulas Encontradas')}
                                    </h3>
                                    <div className="grid gap-3">
                                        {resultadosModalidade.map((item) => renderUnitCard(item.unidade, (
                                                <div className={`mt-4 pt-3 border-t flex flex-wrap gap-1.5 ${isDarkMode ? 'border-white/[0.06]' : 'border-black/[0.05]'}`}>
                                                    {item.aulas.slice(0, 4).map((aula, idx) => (
                                                        <span key={idx} className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${isDarkMode ? 'bg-white/[0.06] text-white/75' : 'bg-black/[0.04] text-black/65'}`}>
                                                            {aula.modalidadeNome} · {formatWeekday(aula.dias[0], { short: true })} {aula.hora}
                                                        </span>
                                                    ))}
                                                    {item.aulas.length > 4 && (
                                                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full italic ${mutedText}`}>
                                                            +{item.aulas.length - 4} {t('publicSchedule.schedules', 'horários')}
                                                        </span>
                                                    )}
                                                </div>
                                        )))}
                                    </div>
                                </div>
                            )}

                            {resultadosUnidade.length > 0 && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                                    {!userCoords && (
                                        <h3 className="text-xs font-bold text-[#ed1c24] uppercase tracking-wider flex items-center justify-between gap-2 mb-3 px-1">
                                            <span className="flex items-center gap-2">
                                                <span className="p-1.5 bg-red-500/10 rounded-lg"><MapPin className="w-3.5 h-3.5"/></span>
                                                {t('publicSchedule.unitsAvailable', 'Unidades Disponíveis')}
                                            </span>
                                            <span className={`normal-case tracking-normal font-semibold ${mutedText}`}>{t('publicSchedule.unitsCount', { count: resultadosUnidade.length })}</span>
                                        </h3>
                                    )}
                                    <div className="grid gap-3">
                                        {resultadosUnidade.map(u => renderUnitCard(u))}
                                    </div>
                                </div>
                            )}

                            {(temBuscaAtiva && !resultadosUnidade.length && !resultadosModalidade) && (
                                <div className={`rounded-3xl border p-10 text-center animate-in fade-in zoom-in-95 ${surface}`}>
                                    <div className={`mb-3 inline-flex p-4 rounded-full ${isDarkMode ? 'bg-white/5' : 'bg-black/[0.04]'}`}><Search className="w-6 h-6 opacity-60"/></div>
                                    <p className="text-sm font-bold">{t('publicSchedule.noUnitsFound', 'Nenhuma unidade ou aula encontrada.')}</p>
                                    <p className={`text-xs mt-1 ${mutedText}`}>{t('publicSchedule.tryChangeFilter', 'Tente expandir o raio de busca ou mudar o termo.')}</p>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </main>

            <footer className={`relative z-10 pb-6 text-center text-[10px] font-semibold tracking-widest uppercase ${isDarkMode ? 'text-white/25' : 'text-black/30'}`}>
                {t('publicSchedule.developedBy', 'Desenvolvido por Pratique Fitness')}
            </footer>
        </div>
      );
  }

  return (
    <div className={`min-h-screen ${bgPage} pb-10 print:bg-black print:text-white print:p-0 print:h-screen print:overflow-hidden`} onClick={() => { setIsLangMenuOpen(false); }}>

        <style>{`
            @media print {
                @page { size: landscape; margin: 0; }
                body, #root, html { background-color: #000000 !important; color: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; width: 100vw; height: 100vh; margin: 0; padding: 0; overflow: hidden; }
                body > *:not(#root) { display: none; }
                .print-container { width: 100vw !important; height: 100vh !important; display: flex !important; flex-direction: column !important; padding: 10px !important; box-sizing: border-box !important; }
                .density-ultra-compact .print-header { height: 60px !important; margin-bottom: 5px !important; }
                .density-ultra-compact .ph-title { font-size: 24px !important; }
                .density-ultra-compact .print-card-title { font-size: 11px !important; line-height: 1.1 !important; }
                .density-ultra-compact .print-card { padding: 1px !important; border-radius: 4px !important; }
                .density-ultra-compact .print-cell-header { font-size: 10px !important; padding: 2px !important; }
                .density-ultra-compact .print-time { font-size: 12px !important; }
                .density-compact .print-header { height: 80px !important; margin-bottom: 10px !important; }
                .density-compact .ph-title { font-size: 30px !important; }
                .density-compact .print-card-title { font-size: 14px !important; }
                .density-compact .print-card { padding: 3px !important; }
                .density-comfortable .print-header { height: 100px !important; margin-bottom: 15px !important; }
                .density-comfortable .ph-title { font-size: 36px !important; }
                .density-comfortable .print-card-title { font-size: 18px !important; }
                .density-comfortable .print-card { padding: 6px !important; }
                .print-header { display: flex !important; justify-content: space-between !important; align-items: center !important; width: 100% !important; border-bottom: 2px solid rgba(255,255,255,0.3) !important; flex-shrink: 0; }
                .ph-left { width: 25%; display: flex; justify-content: flex-start; }
                .ph-center { width: 50%; text-align: center; }
                .ph-right { width: 25%; display: flex; justify-content: flex-end; }
                .ph-title { font-weight: 900; text-transform: uppercase; margin: 0; line-height: 1; font-style: italic; color: white; }
                .ph-sub { font-weight: bold; text-transform: uppercase; color: #ccc; margin-top: 5px; }
                .print-grid-wrapper { flex: 1; width: 100% !important; display: flex !important; flex-direction: column !important; border: 1px solid rgba(255,255,255,0.3) !important; overflow: visible !important; }
                .print-grid-header, .print-grid-body { display: grid; grid-template-columns: 80px repeat(${gradeOrganizada.dias.length}, 1fr); }
                .print-grid-header { border-bottom: 1px solid rgba(255,255,255,0.3); background-color: #111 !important; }
                .print-grid-body { grid-auto-rows: 1fr; height: 100%; }
                .print-cell { border-right: 1px solid rgba(255,255,255,0.2) !important; border-bottom: 1px solid rgba(255,255,255,0.2) !important; display: flex; align-items: stretch; justify-content: center; padding: 2px !important; }
                .print-card { width: 100% !important; display: flex; flex: 1; flex-direction: column; justify-content: center; align-items: center; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background-blend-mode: normal !important; box-shadow: none !important; }
                .print-card-title { color: white !important; font-weight: 900 !important; text-transform: uppercase; text-align: center; text-shadow: 1px 1px 1px rgba(0,0,0,0.8); }
                .screen-only { display: none !important; }
            }
            @media screen {
                .screen-grid { display: grid; grid-template-columns: 64px repeat(${diasExibidos.length}, minmax(128px, 1fr)); }
                .print-header { display: none; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            }
            @media screen and (min-width: 768px) {
                .screen-grid { grid-template-columns: 84px repeat(${diasExibidos.length}, minmax(168px, 1fr)); }
            }
        `}</style>

        {/* 🟢 BARRA SUPERIOR (só na tela) */}
        <div className={`sticky top-0 z-50 print:hidden border-b backdrop-blur-xl ${isDarkMode ? 'bg-[#0b0b0c]/85 border-white/[0.08]' : 'bg-white/85 border-black/[0.06]'}`}>
            <div className="max-w-[1920px] mx-auto px-3 md:px-6 py-3 md:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                    <button onClick={voltarParaLista} title={t('publicSchedule.back', 'Voltar')} className={`shrink-0 h-11 flex items-center gap-2 pl-2.5 pr-3 md:pr-4 rounded-full border transition-all active:scale-95 ${iconButton}`}>
                        <ArrowLeft className="w-5 h-5"/> <span className="text-xs font-bold uppercase hidden md:inline">{t('publicSchedule.back', 'Voltar')}</span>
                    </button>
                    <div className="flex flex-col min-w-0">
                        <h2 className="text-lg md:text-2xl font-black italic tracking-tight uppercase truncate leading-tight">{unidadeSelecionada.nome}</h2>
                        <a href={getMapsLink(unidadeSelecionada)} target="_blank" rel="noopener noreferrer" title={t('publicSchedule.openInMaps')} className={`flex items-center gap-1.5 text-[11px] md:text-xs font-semibold transition-colors w-fit max-w-full ${isDarkMode ? 'text-sky-400 hover:text-sky-300' : 'text-sky-600 hover:text-sky-700'}`}>
                            <MapPin className="w-3.5 h-3.5 shrink-0"/>
                            <span className="truncate hover:underline">{displayAddressLocal(unidadeSelecionada)}</span>
                        </a>
                    </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-2 shrink-0">
                    {/* 🟢 HOJE / SEMANA */}
                    <div role="group" aria-label={t('publicSchedule.viewToggle')} className={`grid grid-cols-2 p-1 rounded-full border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-black/[0.03] border-black/[0.06]'}`}>
                        {[
                            { id: 'hoje', icon: CalendarClock, label: t('publicSchedule.viewToday', 'Hoje') },
                            { id: 'semana', icon: CalendarDays, label: t('publicSchedule.viewWeek', 'Semana') },
                        ].map(opcao => (
                            <button
                                key={opcao.id}
                                onClick={() => setVisao(opcao.id)}
                                aria-pressed={visao === opcao.id}
                                className={`h-9 flex items-center justify-center gap-1.5 px-3.5 rounded-full text-xs font-black uppercase transition-all ${visao === opcao.id ? 'bg-[#ed1c24] text-white shadow-md shadow-red-500/25' : mutedText}`}
                            >
                                <opcao.icon className="w-4 h-4"/> {opcao.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                    <button onClick={compartilharUnidade} title={t('publicSchedule.share')} className={`h-11 flex items-center gap-2 px-3 rounded-full border transition-all active:scale-95 ${linkCopiado ? 'bg-emerald-500 border-transparent text-white' : iconButton}`}>
                        {linkCopiado ? <Check className="w-5 h-5"/> : <Share2 className="w-5 h-5"/>}
                        <span className="text-xs font-bold uppercase hidden lg:inline">{linkCopiado ? t('publicSchedule.linkCopied') : t('publicSchedule.share')}</span>
                    </button>
                    <div className="hidden sm:block">
                        <LanguageMenu isDarkMode={isDarkMode} open={isLangMenuOpen} setOpen={setIsLangMenuOpen} onChange={changeLanguage} currentLang={currentLang} language={i18n.language} title={t('sidebar.changeLanguage')} />
                    </div>
                    <button onClick={() => setIsDarkMode(!isDarkMode)} title={t('sidebar.changeTheme')} className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all active:scale-95 ${iconButton}`}>
                        {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400"/> : <Moon className="w-5 h-5"/>}
                    </button>

                    <div className="relative">
                        <button onClick={(e) => { e.stopPropagation(); setShowPrintMenu(!showPrintMenu); }} title={t('publicSchedule.print')} className="h-11 px-3 bg-[#ed1c24] text-white rounded-full hover:brightness-110 shadow-lg shadow-red-500/25 transition-all active:scale-95 flex items-center gap-1.5">
                            <Printer className="w-5 h-5"/> <ChevronDown className="w-3 h-3 hidden md:block"/>
                        </button>

                        {showPrintMenu && (
                            <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-14 bg-white rounded-2xl shadow-2xl border border-gray-200 w-64 overflow-hidden z-50 animate-in fade-in zoom-in-95">
                                <div className="p-3 border-b border-gray-100 bg-gray-50"><p className="text-xs font-bold text-gray-500 uppercase tracking-wider text-center">{t('publicSchedule.printAdjustment', 'Ajuste de Impressão')}</p></div>
                                <button onClick={() => handlePrint('auto')} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-3 border-b border-gray-100">
                                    <span className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center text-blue-600 text-xs">✨</span>
                                    <div><span className="block">{t('publicSchedule.printAuto', 'Automático')}</span><span className="text-[10px] text-gray-400 font-normal">{t('publicSchedule.printAutoDesc', 'O sistema decide')}</span></div>
                                </button>
                                <button onClick={() => handlePrint('ultra-compact')} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-700 hover:bg-purple-50 hover:text-purple-600 flex items-center gap-3 border-b border-gray-100">
                                    <span className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center text-purple-600 text-xs">📉</span>
                                    <div><span className="block">{t('publicSchedule.printCompact', 'Compactar')}</span><span className="text-[10px] text-gray-400 font-normal">{t('publicSchedule.printCompactDesc', 'Para grades grandes')}</span></div>
                                </button>
                                <button onClick={() => handlePrint('comfortable')} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-700 hover:bg-green-50 hover:text-green-600 flex items-center gap-3">
                                    <span className="w-6 h-6 rounded bg-green-100 flex items-center justify-center text-green-600 text-xs">📈</span>
                                    <div><span className="block">{t('publicSchedule.printExpand', 'Expandir')}</span><span className="text-[10px] text-gray-400 font-normal">{t('publicSchedule.printExpandDesc', 'Para grades pequenas')}</span></div>
                                </button>
                            </div>
                        )}
                    </div>
                    </div>
                </div>
            </div>
        </div>

        <div className={`print-container max-w-[1920px] mx-auto p-3 md:p-8 print:p-0 density-${appliedDensity}`}>
            <div className="hidden print:flex print-header">
                <div className="ph-left"><img src={LOGOS['pratique']} alt="Logo" className="h-16 brightness-0 invert object-contain"/></div>
                <div className="ph-center"><h1 className="ph-title">{unidadeSelecionada.nome}</h1><p className="ph-sub">{t('publicSchedule.boardTitle', 'Quadro Happy Zone')}</p></div>
                <div className="ph-right"><div className="bg-white p-1 rounded"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent("https://gestaodecoletivas.vercel.app/horarios")}`} alt="QR" className="w-16 h-16"/></div></div>
            </div>

            {/* 🟢 RESUMO E LEGENDA CLICÁVEL (só na tela) */}
            {!loadingGrade && gradeUnidade.length > 0 && (
                <div className="screen-only print:hidden mb-4 md:mb-6 space-y-3">
                    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold uppercase tracking-wider ${mutedText}`}>
                        <span>{visao === 'hoje' ? t('publicSchedule.todayClasses', { count: totalAulasExibidas }) : t('publicSchedule.weeklyClasses', { count: totalAulasExibidas })}</span>
                        <span className="opacity-40">•</span>
                        <span>{t('publicSchedule.modalitiesCount', { count: modalidadesDaGrade.length })}</span>
                        <span className="opacity-40 hidden sm:inline">•</span>
                        <span className="normal-case tracking-normal font-semibold hidden sm:inline">{t('publicSchedule.filterHint')}</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-3 px-3 md:mx-0 md:px-0 md:flex-wrap">
                        {modalidadesDaGrade.map(m => {
                            const ativa = filtroModalidade === m.id;
                            const apagada = filtroModalidade && !ativa;
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => setFiltroModalidade(ativa ? null : m.id)}
                                    aria-pressed={ativa}
                                    className={`shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-full border text-xs font-bold uppercase cursor-pointer transition-all active:scale-95 ${ativa ? 'border-transparent shadow-md' : (isDarkMode ? 'bg-white/[0.04] border-white/10 hover:bg-white/10' : 'bg-white border-black/[0.06] shadow-sm hover:bg-black/[0.03]')} ${apagada ? 'opacity-45 hover:opacity-100' : ''}`}
                                    style={ativa ? { backgroundColor: m.cor, color: getContrastColor(m.cor) } : undefined}
                                >
                                    <span className={`w-2.5 h-2.5 rounded-full ${ativa ? 'ring-2 ring-white/70' : ''}`} style={{ backgroundColor: m.cor }}></span>
                                    {m.nome}
                                    {ativa && <X className="w-3.5 h-3.5"/>}
                                </button>
                            );
                        })}
                        {filtroModalidade && (
                            <button onClick={() => setFiltroModalidade(null)} className={`shrink-0 inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-xs font-bold uppercase transition-all active:scale-95 ${isDarkMode ? 'text-white/60 hover:text-white' : 'text-black/50 hover:text-black'}`}>
                                <X className="w-3.5 h-3.5"/> {t('publicSchedule.clearModalityFilter')}
                            </button>
                        )}
                    </div>
                    {diasExibidos.length > 2 && (
                        <p className={`md:hidden text-[11px] font-semibold flex items-center gap-1.5 ${mutedText}`}>
                            <ChevronRight className="w-3.5 h-3.5 animate-pulse"/> {t('publicSchedule.scrollHint')}
                        </p>
                    )}
                </div>
            )}

            {loadingGrade ? <div className="flex justify-center h-[50vh] items-center screen-only"><Loader2 className="w-12 h-12 animate-spin text-[#ed1c24]"/></div> :
            gradeUnidade.length === 0 ? <div className="text-center py-20 opacity-50 screen-only"><p className="font-bold text-xl">{t('publicSchedule.emptyGrid', 'Grade vazia.')}</p></div> :
            horariosExibidos.length === 0 ? (
                <div className={`screen-only rounded-3xl border p-10 md:p-14 text-center animate-in fade-in ${surface}`}>
                    <div className={`mx-auto mb-4 w-14 h-14 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-white/5' : 'bg-black/[0.04]'}`}>
                        <CalendarClock className="w-7 h-7 opacity-60"/>
                    </div>
                    <p className="text-base md:text-lg font-black">
                        {modalidadeFiltrada
                            ? t('publicSchedule.noModalityToday', { day: formatWeekday(diaDeHoje), modality: modalidadeFiltrada.nome })
                            : t('publicSchedule.noClassesToday', { day: formatWeekday(diaDeHoje) })}
                    </p>
                    <button onClick={() => setVisao('semana')} className="mt-5 h-11 px-6 rounded-full bg-[#ed1c24] text-white text-xs font-black uppercase shadow-lg shadow-red-500/25 active:scale-95 transition-all">
                        {t('publicSchedule.seeFullWeek')}
                    </button>
                </div>
            ) :
            (
                <div className={`print-grid-wrapper overflow-x-auto overscroll-x-contain rounded-3xl border ${isDarkMode ? 'bg-[#111113] border-white/[0.08]' : 'bg-white border-black/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.05)]'} print:bg-black print:border-0 print:rounded-none print:shadow-none`}>
                    <div className={`screen-grid print-grid-header ${isDarkMode ? 'bg-[#18181b] border-white/10' : 'bg-gray-50 border-gray-200'} border-b flex`}>
                        <div className={`p-3 md:p-4 flex items-center justify-center border-r print-cell-header sticky left-0 z-20 print:static print:bg-transparent ${isDarkMode ? 'border-white/10 bg-[#18181b]' : 'border-gray-200 bg-gray-50'}`}>
                            <Clock className="w-5 h-5 md:w-6 md:h-6 opacity-40"/>
                        </div>
                        {diasExibidos.map(dia => (
                            <div key={dia} className={`p-3 md:p-4 flex flex-col items-center justify-center gap-1 font-black text-base md:text-lg uppercase border-r print-cell-header ${isDarkMode ? 'text-white border-white/10' : 'text-slate-800 border-slate-200'}`}>
                                {formatWeekday(dia, { short: true })}
                                {dia === diaDeHoje && (
                                    <span className="print:hidden text-[9px] tracking-widest px-2 py-0.5 rounded-full bg-[#ed1c24] text-white">{t('publicSchedule.today')}</span>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="screen-grid print-grid-body">
                        {horariosExibidos.map((hora) => (
                            <React.Fragment key={hora}>
                                <div className={`print-cell border-r border-b font-mono font-bold text-base md:text-xl sticky left-0 z-10 print:static print:bg-transparent ${isDarkMode ? 'border-white/10 text-[#00adef] bg-[#111113]' : 'border-gray-200 text-sky-600 bg-white'} print:text-[#00adef] print:font-black print-time p-2 md:p-4 flex items-center justify-center`}>
                                    {hora}
                                </div>
                                {diasExibidos.map(dia => {
                                    const aulasNoHorario = getAulasCell(dia, hora);
                                    const borderClass = `border-r border-b ${isDarkMode ? 'border-white/10' : 'border-gray-200'} print:border-[#222]`;
                                    const colunaHoje = dia === diaDeHoje ? `print:bg-transparent ${isDarkMode ? 'bg-white/[0.02]' : 'bg-red-50/40'}` : '';

                                    if (aulasNoHorario.length === 0) return <div key={`${dia}-${hora}`} className={`print-cell ${borderClass} ${colunaHoje} ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}></div>;

                                    return (
                                        <div key={`${dia}-${hora}`} className={`print-cell ${borderClass} ${colunaHoje} p-1 md:p-1.5 flex flex-col gap-1`}>
                                            {aulasNoHorario.map((aula, i) => {
                                                const cor = aula.modalidadeCor || '#333';
                                                const corTexto = getContrastColor(cor);
                                                return (
                                                    <div
                                                        key={i}
                                                        className="print-card w-full rounded-xl p-2 flex flex-col justify-center items-center text-center shadow-sm md:hover:scale-[1.03] transition-transform cursor-default flex-1 min-h-[60px] print:min-h-0"
                                                        style={{ backgroundColor: cor }}
                                                    >
                                                        <p className="print-card-title font-black text-[12px] md:text-[14px] uppercase leading-tight line-clamp-2" style={{ color: corTexto }}>
                                                            {aula.modalidadeNome}
                                                        </p>
                                                        <p className="print-card-sub text-[10px] md:text-[11px] font-bold uppercase opacity-85 truncate w-full print:hidden mt-1" style={{ color: corTexto }}>
                                                            {aula.professorNome}
                                                        </p>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-10 text-center opacity-40 screen-only">
                <img src={LOGOS['pratique']} alt="Pratique" className={`h-8 mx-auto ${isDarkMode ? 'invert' : ''}`}/>
            </div>
        </div>
    </div>
  );
}

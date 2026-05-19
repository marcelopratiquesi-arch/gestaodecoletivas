import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/firebase'; 
import { collection, getDocs, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { 
  Search, Clock, ChevronRight, Loader2, 
  Printer, ArrowLeft, Dumbbell, Sun, Moon, ChevronDown, MapPin, Navigation, LocateFixed, Map, List
} from 'lucide-react';

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
    // 1. Blindagem de Status e Campos Booleanos
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

    // 2. Blindagem de Datas (String e Timestamps do Firebase)
    const todayStr = getTodayStr(); // 'YYYY-MM-DD'
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

    return true; // Passou em todos os testes, está ATIVA!
};

const formatProfessorName = (name) => {
  if (!name) return "Instrutor";
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
};

const removerAcentos = (str) => {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

const cleanGoogleMapsLink = (url) => {
    if (!url) return "";
    if (url.includes('googleusercontent.com')) {
        const match = url.match(/(?:q=|query=|@)([-.\d]+),([-.\d]+)/);
        if (match) return `http://googleusercontent.com/maps.google.com/?q=${match[1]},${match[2]}`;
    }
    return url;
};

const getMapsLink = (unidade) => {
    if (!unidade) return '#';
    let linkOficial = unidade.linkGoogleMaps || unidade.localizacao;
    if (linkOficial && linkOficial.startsWith('http')) return cleanGoogleMapsLink(linkOficial);
    if (unidade.enderecoCompleto) return `http://googleusercontent.com/maps.google.com/?q=${encodeURIComponent(unidade.enderecoCompleto)}`;
    const queryBackup = `${unidade.nome} ${unidade.cidade || ''} ${unidade.estado || ''}`.trim();
    return `http://googleusercontent.com/maps.google.com/?q=${encodeURIComponent(queryBackup)}`;
};

const displayAddress = (unidade) => {
    if (unidade.enderecoCompleto) return unidade.enderecoCompleto;
    return "Endereço não informado. Toque para ver no mapa.";
};

const extractCoords = (unidade) => {
    const url = unidade.linkGoogleMaps || unidade.localizacao || "";
    const match = url.match(/(?:q=|query=|@)([-.\d]+),([-.\d]+)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    return null;
};

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

export default function PublicSchedule() {
  const [unidades, setUnidades] = useState([]);
  const [modalidadesMap, setModalidadesMap] = useState({});
  const [professoresMap, setProfessoresMap] = useState({});
  
  const [loading, setLoading] = useState(true);
  const [loadingGrade, setLoadingGrade] = useState(false);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState(null);
  const [gradeUnidade, setGradeUnidade] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  
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
          alert("O seu navegador ou dispositivo não suporta GPS.");
          return;
      }
      setIsLocating(true);
      setUserCoords(null); 
      navigator.geolocation.getCurrentPosition((position) => {
          setUserCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
          setBusca(""); setFiltroEstado(""); setTermoDebounce("");
          setViewMode('map'); 
          setIsLocating(false);
      }, (error) => {
          alert("Não foi possível aceder ao seu GPS. Verifique as permissões de localização.");
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
  }, [termoDebounce, unidades, modalidadesMap, filtroEstado, userCoords]);

  const buscarOndeTemModalidade = async (modIds, estadoFilter) => {
      try {
          const q = query(collection(db, 'aulas'), where('modalidadeId', 'in', modIds.slice(0, 10)));
          const snap = await getDocs(q);
          const agrupado = {};
          
          snap.docs.forEach(doc => {
              const aula = doc.data();
              if (!isAulaAtiva(aula)) return; // 🟢 EXORCISMO NA LUPA DE BUSCA

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

  useEffect(() => {
      if (!unidadeSelecionada) return;
      setLoadingGrade(true);
      
      const q = query(collection(db, 'aulas'), where('unidadeId', '==', unidadeSelecionada.id));
      
      const unsubscribe = onSnapshot(q, (snap) => {
          const data = snap.docs.map(d => {
              const a = d.data();
              if (!isAulaAtiva(a)) return null; // 🟢 EXORCISMO NA GRADE PRINCIPAL

              const mod = modalidadesMap[a.modalidadeId];
              if(!mod) return null;
              
              return {
                  ...a,
                  modalidadeNome: mod.nome,
                  modalidadeCor: mod.cor || '#333',
                  professorNome: formatProfessorName(professoresMap[a.professorId])
              };
          }).filter(Boolean); 
          
          setGradeUnidade(data);
          setLoadingGrade(false);
      }, (error) => {
          console.error("Erro na grelha tempo real:", error);
          setLoadingGrade(false);
      });

      return () => unsubscribe();
  }, [unidadeSelecionada, modalidadesMap, professoresMap]);

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

  const getAulasCell = (dia, hora) => gradeUnidade.filter(a => a.hora === hora && a.dias?.includes(dia));

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

  const bgGradient = isDarkMode ? "bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#0f0f0f]" : "bg-gradient-to-br from-gray-50 via-white to-gray-100";
  const cardGlass = isDarkMode ? "bg-[#1a1a1a]/80 backdrop-blur-xl border-white/10 shadow-2xl shadow-black/50" : "bg-white/80 backdrop-blur-xl border-white/40 shadow-2xl shadow-gray-200/50";
  const inputGlass = isDarkMode ? "bg-black/30 border-white/10 text-white placeholder:text-white/30 focus:border-red-500/50 focus:bg-black/50" : "bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-red-500/50 focus:bg-white";

  if (!unidadeSelecionada) {
      return (
        <div className={`min-h-screen ${bgGradient} transition-colors duration-500 p-4 flex flex-col items-center justify-start pt-8 relative overflow-hidden`}>
            
            <div className={`absolute top-0 left-0 w-full h-96 ${isDarkMode ? 'opacity-20' : 'opacity-10'} pointer-events-none`}>
                <div className="absolute top-[-50%] left-[-10%] w-[50%] h-[100%] rounded-full bg-red-600 blur-[120px]"></div>
                <div className="absolute top-[-50%] right-[-10%] w-[50%] h-[100%] rounded-full bg-blue-600 blur-[120px]"></div>
            </div>

            <button onClick={() => setIsDarkMode(!isDarkMode)} className={`absolute top-6 right-6 p-3 rounded-full border z-20 transition-all hover:scale-110 ${isDarkMode ? 'bg-black/40 border-white/10 text-yellow-400 hover:bg-black/60' : 'bg-white/80 border-gray-200 text-gray-600 hover:bg-white'}`}>
                {isDarkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
            </button>
            
            <div className={`w-full max-w-4xl relative z-10 rounded-3xl p-6 md:p-10 border ${cardGlass} transition-all duration-500 animate-in fade-in slide-in-from-bottom-8`}>
                
                <div className="flex flex-col items-center mb-8">
                    <div className="relative mb-2 group">
                        <img src={LOGOS['pratique']} alt="Pratique" className={`h-24 md:h-32 object-contain transition-transform duration-500 group-hover:scale-105 ${isDarkMode ? 'brightness-0 invert' : ''}`} />
                        <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 h-1 bg-red-600 rounded-full blur-sm opacity-50`}></div>
                    </div>
                    
                    <div className="text-center space-y-1">
                        <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter flex justify-center gap-2 drop-shadow-sm">
                            <span className="text-[#ed1c24]">HAPPY</span>
                            <span className="text-[#00adef]">ZONE</span>
                        </h2>
                        <div className="flex items-center justify-center gap-2 opacity-60">
                            <div className={`h-[1px] w-8 ${isDarkMode ? 'bg-white' : 'bg-black'}`}></div>
                            <p className={`text-[10px] font-bold uppercase tracking-[0.3em] ${isDarkMode ? 'text-white' : 'text-black'}`}>Quadro de Horários</p>
                            <div className={`h-[1px] w-8 ${isDarkMode ? 'bg-white' : 'bg-black'}`}></div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6 max-w-2xl mx-auto">
                    
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                <MapPin className="w-3 h-3 inline mr-1 mb-0.5"/> Localização
                            </span>
                            {filtroEstado && (
                                <button onClick={() => setFiltroEstado("")} className="text-[10px] font-bold text-red-500 hover:underline">Limpar Estado</button>
                            )}
                        </div>
                        
                        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar mask-gradient-right">
                            <button 
                                onClick={userCoords ? limparGPS : ativarRadarGPS}
                                className={`px-5 py-2.5 rounded-2xl font-black text-xs uppercase whitespace-nowrap transition-all duration-300 transform active:scale-95 border flex items-center gap-2 shadow-lg ${userCoords 
                                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white border-transparent shadow-emerald-500/30 ring-2 ring-emerald-400' 
                                    : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white border-transparent shadow-blue-500/20'}`}
                            >
                                {isLocating ? <Loader2 className="w-4 h-4 animate-spin"/> : <LocateFixed className="w-4 h-4"/>}
                                {userCoords ? "GPS Ativado (Limpar)" : "Perto de Mim"}
                            </button>

                            <button 
                                onClick={() => { setFiltroEstado(""); limparGPS(); }}
                                className={`px-5 py-2.5 rounded-2xl font-bold text-xs uppercase whitespace-nowrap transition-all duration-300 transform active:scale-95 border ${!filtroEstado && !userCoords
                                    ? 'bg-gradient-to-r from-red-600 to-red-500 text-white border-transparent shadow-lg shadow-red-500/20 translate-y-[-2px]' 
                                    : `${isDarkMode ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white' : 'bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200 hover:text-gray-800'}`}`}
                            >
                                Brasil Todo
                            </button>
                            {estadosDisponiveis.map(uf => (
                                <button 
                                    key={uf}
                                    onClick={() => { setFiltroEstado(uf); limparGPS(); }}
                                    className={`px-5 py-2.5 rounded-2xl font-bold text-xs uppercase whitespace-nowrap transition-all duration-300 transform active:scale-95 border ${filtroEstado === uf 
                                        ? 'bg-gradient-to-r from-red-600 to-red-500 text-white border-transparent shadow-lg shadow-red-500/20 translate-y-[-2px]' 
                                        : `${isDarkMode ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white' : 'bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200 hover:text-gray-800'}`}`}
                                >
                                    {uf}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="relative group">
                        <div className={`absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-red-500 to-blue-500 opacity-0 group-focus-within:opacity-50 blur transition duration-500`}></div>
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder={filtroEstado ? `Buscar em ${filtroEstado}...` : "Buscar unidade, endereço ou modalidade..."} 
                                className={`w-full h-14 pl-12 pr-4 rounded-2xl border outline-none font-semibold text-sm shadow-inner transition-all ${inputGlass}`} 
                                value={busca} 
                                onChange={e => { setBusca(e.target.value); limparGPS(); }} 
                            />
                            <Search className={`absolute left-4 top-4 w-6 h-6 transition-colors ${isDarkMode ? 'text-white/30 group-focus-within:text-white' : 'text-gray-400 group-focus-within:text-gray-600'}`}/>
                            {busca && busca !== termoDebounce && <Loader2 className="absolute right-4 top-4 w-6 h-6 animate-spin text-red-500"/>}
                        </div>
                    </div>
                </div>

                <div className={`mt-8 transition-all duration-500 ${(busca || filtroEstado || userCoords) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                    
                    {userCoords && (
                         <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
                             <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-2 px-1">
                                 <span className="p-1 bg-emerald-500/10 rounded"><LocateFixed className="w-3 h-3"/></span>
                                 No seu Radar (Raio de 15km)
                             </h3>
                             
                             <div className="flex p-1 bg-black/10 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                                 <button onClick={() => setViewMode('list')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                                     <List className="w-3 h-3"/> Lista
                                 </button>
                                 <button onClick={() => setViewMode('map')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'map' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                                     <Map className="w-3 h-3"/> Mapa
                                 </button>
                             </div>
                         </div>
                    )}

                    {userCoords && viewMode === 'map' && (
                        <div className="w-full h-[500px] rounded-3xl overflow-hidden border border-white/10 shadow-2xl animate-in zoom-in-95 duration-500 relative z-0">
                            <MapContainer center={[userCoords.lat, userCoords.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
                                <TileLayer 
                                    url={isDarkMode ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}
                                    attribution='© OpenStreetMap contributors'
                                />
                                
                                <Marker position={[userCoords.lat, userCoords.lng]} icon={userIcon}>
                                    <Popup className="custom-popup">
                                        <div className="text-center font-bold text-sm text-slate-800">📍 Você está aqui!</div>
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
                                                    <span className="text-[10px] text-slate-500 leading-tight">{displayAddress(u)}</span>
                                                    <button onClick={() => setUnidadeSelecionada(u)} className="mt-2 w-full py-2 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700">Ver Horários</button>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    )
                                })}
                            </MapContainer>
                        </div>
                    )}

                    {(!userCoords || viewMode === 'list') && (
                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar pr-2 max-w-2xl mx-auto">
                            
                            {termoDebounce.length > 0 && resultadosModalidade && resultadosModalidade.length > 0 && !userCoords && (
                                <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider flex items-center gap-2 mb-3 px-1">
                                        <span className="p-1 bg-blue-500/10 rounded"><Dumbbell className="w-3 h-3"/></span> 
                                        Aulas Encontradas
                                    </h3>
                                    <div className="grid gap-3">
                                        {resultadosModalidade.map((item) => (
                                            <div key={item.unidade.id} className={`p-4 rounded-2xl border flex flex-col gap-3 transition-all hover:shadow-md ${isDarkMode ? 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                                                
                                                <div className="flex justify-between items-start gap-4">
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <span className={`font-black text-sm uppercase truncate ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{item.unidade.nome}</span>
                                                        
                                                        <a href={getMapsLink(item.unidade)} target="_blank" rel="noopener noreferrer" className={`mt-1 flex items-start gap-1 text-[10px] font-medium leading-snug group/map w-fit ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}>
                                                            <Navigation className="w-3 h-3 shrink-0 mt-0.5 group-hover/map:scale-110 transition-transform"/>
                                                            <span className="group-hover/map:underline">{displayAddress(item.unidade)}</span>
                                                        </a>
                                                    </div>
                                                    
                                                    <button onClick={() => setUnidadeSelecionada(item.unidade)} className="shrink-0 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg transition-colors flex items-center shadow-md active:scale-95">
                                                        VER GRADE <ChevronRight className="w-3 h-3 ml-1"/>
                                                    </button>
                                                </div>

                                                <div className={`h-px w-full ${isDarkMode ? 'bg-white/10' : 'bg-gray-100'}`}></div>
                                                
                                                <div className="flex flex-wrap gap-1.5">
                                                    {item.aulas.slice(0, 4).map((aula, idx) => (
                                                        <span key={idx} className={`text-[10px] font-bold px-2 py-1 rounded-md border ${isDarkMode ? 'bg-black/30 border-white/10 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                                                            {aula.dias[0]?.substring(0,3)} {aula.hora}
                                                        </span>
                                                    ))}
                                                    {item.aulas.length > 4 && (
                                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md border italic ${isDarkMode ? 'bg-black/30 border-transparent text-gray-500' : 'bg-gray-50 border-transparent text-gray-400'}`}>
                                                            +{item.aulas.length - 4} horários
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {resultadosUnidade.length > 0 && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                                    {!userCoords && (
                                        <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider flex items-center gap-2 mb-3 px-1">
                                            <span className="p-1 bg-red-500/10 rounded"><MapPin className="w-3 h-3"/></span>
                                            Unidades Disponíveis
                                        </h3>
                                    )}
                                    <div className="grid gap-3">
                                        {resultadosUnidade.map(u => (
                                            <div key={u.id} className={`p-4 rounded-2xl border flex flex-col gap-3 transition-all hover:shadow-md ${isDarkMode ? 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-red-500/30' : 'bg-white border-gray-200 hover:border-red-200'}`}>
                                                
                                                <div className="flex justify-between items-start gap-4">
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`block font-black text-sm md:text-base uppercase truncate ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{u.nome}</span>
                                                            
                                                            {userCoords && u.distance < 9999 && (
                                                                <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 rounded-md text-[9px] font-black tracking-widest uppercase flex items-center gap-1 shrink-0">
                                                                    🚗 {u.distance.toFixed(1)} KM
                                                                </span>
                                                            )}
                                                        </div>

                                                        <a href={getMapsLink(u)} target="_blank" rel="noopener noreferrer" className={`mt-1.5 flex items-start gap-1.5 text-[10px] font-medium leading-snug group/map w-fit ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}>
                                                            <Navigation className="w-3.5 h-3.5 shrink-0 mt-0.5 group-hover/map:scale-110 transition-transform"/>
                                                            <span className="group-hover/map:underline">{displayAddress(u)}</span>
                                                        </a>
                                                    </div>
                                                    
                                                    <button onClick={() => setUnidadeSelecionada(u)} className={`shrink-0 p-3 rounded-xl transition-colors active:scale-95 ${isDarkMode ? 'bg-white/5 hover:bg-red-600 hover:text-white text-gray-400' : 'bg-gray-50 hover:bg-red-100 hover:text-red-600 text-gray-500 border border-gray-200'}`}>
                                                        <ChevronRight className="w-5 h-5"/>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {((termoDebounce.length > 0 || filtroEstado || userCoords) && !resultadosUnidade.length && !resultadosModalidade) && (
                                <div className="text-center py-12 opacity-50 animate-in fade-in zoom-in-95">
                                    <div className="mb-3 inline-flex p-4 rounded-full bg-white/5"><Search className="w-6 h-6"/></div>
                                    <p className="text-sm font-medium">Nenhuma unidade ou aula encontrada.</p>
                                    <p className="text-xs mt-1">Tente expandir o raio de busca ou mudar o termo.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            <div className={`absolute bottom-4 text-[10px] font-medium tracking-widest uppercase opacity-30 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                Desenvolvido por Pratique Fitness
            </div>
        </div>
      );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? "bg-[#101010] text-white" : "bg-[#f5f5f5] text-[#1f1f1f]"} pb-10 print:bg-black print:text-white print:p-0 print:h-screen print:overflow-hidden`}>
        
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
                .screen-grid { display: grid; grid-template-columns: 80px repeat(${gradeOrganizada.dias.length}, minmax(180px, 1fr)); }
                .print-header { display: none; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            }
        `}</style>

        <div className="sticky top-0 z-50 shadow-md print:hidden bg-[#111] border-b border-white/10">
            <div className="max-w-[1920px] mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0 pr-4">
                    <button onClick={() => setUnidadeSelecionada(null)} className="shrink-0 flex items-center gap-2 text-gray-500 hover:text-blue-500 transition-colors">
                        <ArrowLeft className="w-6 h-6"/> <span className="text-sm font-bold uppercase hidden md:inline">Voltar</span>
                    </button>
                    <div className="flex flex-col min-w-0">
                        <h2 className="text-xl md:text-3xl font-black italic tracking-tighter uppercase text-white truncate">{unidadeSelecionada.nome}</h2>
                        <div className="flex flex-col mt-0.5">
                            <a href={getMapsLink(unidadeSelecionada)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors group mt-1 w-fit">
                                <MapPin className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform"/>
                                <span className="truncate max-w-[250px] md:max-w-md group-hover:underline">{displayAddress(unidadeSelecionada)}</span>
                            </a>
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-2 md:gap-3 relative shrink-0">
                    <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2.5 md:p-3 rounded-full border transition-all ${isDarkMode ? 'bg-[#222] border-white/10 text-yellow-400' : 'bg-gray-100 border-gray-200 text-gray-600'}`}>{isDarkMode ? <Sun className="w-4 h-4 md:w-5 md:h-5"/> : <Moon className="w-4 h-4 md:w-5 md:h-5"/>}</button>
                    
                    <div className="relative">
                        <button onClick={() => setShowPrintMenu(!showPrintMenu)} className="p-2.5 md:p-3 bg-blue-600 text-white rounded-full hover:bg-blue-500 shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2">
                            <Printer className="w-4 h-4 md:w-5 md:h-5"/> <ChevronDown className="w-3 h-3 hidden md:block"/>
                        </button>
                        
                        {showPrintMenu && (
                            <div className="absolute right-0 top-14 bg-white rounded-xl shadow-2xl border border-gray-200 w-64 overflow-hidden z-50 animate-in fade-in zoom-in-95">
                                <div className="p-3 border-b border-gray-100 bg-gray-50"><p className="text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Ajuste de Impressão</p></div>
                                <button onClick={() => handlePrint('auto')} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-3 border-b border-gray-100">
                                    <span className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center text-blue-600 text-xs">✨</span> 
                                    <div><span className="block">Automático</span><span className="text-[10px] text-gray-400 font-normal">O sistema decide</span></div>
                                </button>
                                <button onClick={() => handlePrint('ultra-compact')} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-700 hover:bg-purple-50 hover:text-purple-600 flex items-center gap-3 border-b border-gray-100">
                                    <span className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center text-purple-600 text-xs">📉</span> 
                                    <div><span className="block">Compactar</span><span className="text-[10px] text-gray-400 font-normal">Para grades grandes</span></div>
                                </button>
                                <button onClick={() => handlePrint('comfortable')} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-700 hover:bg-green-50 hover:text-green-600 flex items-center gap-3">
                                    <span className="w-6 h-6 rounded bg-green-100 flex items-center justify-center text-green-600 text-xs">📈</span> 
                                    <div><span className="block">Expandir</span><span className="text-[10px] text-gray-400 font-normal">Para grades pequenas</span></div>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        <div className={`print-container max-w-[1920px] mx-auto p-4 md:p-8 print:p-0 density-${appliedDensity}`}>
            <div className="hidden print:flex print-header">
                <div className="ph-left"><img src={LOGOS['pratique']} alt="Logo" className="h-16 brightness-0 invert object-contain"/></div>
                <div className="ph-center"><h1 className="ph-title">{unidadeSelecionada.nome}</h1><p className="ph-sub">Quadro Happy Zone</p></div>
                <div className="ph-right"><div className="bg-white p-1 rounded"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent("https://gestaodecoletivas.vercel.app/horarios")}`} alt="QR" className="w-16 h-16"/></div></div>
            </div>

            {loadingGrade ? <div className="flex justify-center h-[50vh] items-center screen-only"><Loader2 className="w-12 h-12 animate-spin text-blue-600"/></div> : 
            gradeUnidade.length === 0 ? <div className="text-center py-20 opacity-50 screen-only"><p className="font-bold text-xl">Grade vazia.</p></div> : 
            (
                <div className={`print-grid-wrapper overflow-x-auto rounded-2xl border ${isDarkMode ? 'bg-[#111] border-white/10' : 'bg-white border-gray-200'} print:bg-black print:border-0 print:rounded-none`}>
                    <div className={`screen-grid print-grid-header ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-gray-50 border-gray-200'} border-b flex`}>
                        <div className={`p-4 flex items-center justify-center border-r print-cell-header ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                            <Clock className="w-6 h-6 opacity-40"/>
                        </div>
                        {gradeOrganizada.dias.map(dia => (
                            <div key={dia} className={`p-4 flex items-center justify-center font-black text-lg uppercase border-r print-cell-header ${isDarkMode ? 'text-white border-white/10' : 'text-slate-800 border-slate-200'}`}>
                                {dia.substring(0,3)}
                            </div>
                        ))}
                    </div>

                    <div className="screen-grid print-grid-body">
                        {gradeOrganizada.horarios.map((hora, idx) => (
                            <React.Fragment key={hora}>
                                <div className={`print-cell border-r border-b font-mono font-bold text-xl ${isDarkMode ? 'border-white/10 text-[#00adef]' : 'border-gray-200 text-blue-600'} print:text-[#00adef] print:font-black print-time p-4 flex items-center justify-center`}>
                                    {hora}
                                </div>
                                {gradeOrganizada.dias.map(dia => {
                                    const aulasNoHorario = getAulasCell(dia, hora);
                                    const borderClass = `border-r border-b ${isDarkMode ? 'border-white/10' : 'border-gray-200'} print:border-[#222]`;
                                    
                                    if (aulasNoHorario.length === 0) return <div key={`${dia}-${hora}`} className={`print-cell ${borderClass} ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}></div>;
                                    
                                    return (
                                        <div key={`${dia}-${hora}`} className={`print-cell ${borderClass} p-1 flex flex-col gap-1`}>
                                            {aulasNoHorario.map((aula, i) => {
                                                const cor = aula.modalidadeCor || '#333';
                                                return (
                                                    <div 
                                                        key={i}
                                                        className="print-card w-full rounded-xl p-2 flex flex-col justify-center items-center text-center shadow-sm hover:scale-105 transition-transform cursor-default flex-1"
                                                        style={{ backgroundColor: cor }}
                                                    >
                                                        <p className="print-card-title font-black text-[13px] md:text-[15px] uppercase leading-tight line-clamp-2 text-white drop-shadow-md">
                                                            {aula.modalidadeNome}
                                                        </p>
                                                        <p className="print-card-sub text-[10px] md:text-[11px] font-bold uppercase opacity-90 truncate w-full text-white drop-shadow-md print:hidden mt-1">
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
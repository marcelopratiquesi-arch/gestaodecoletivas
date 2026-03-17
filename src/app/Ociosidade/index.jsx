import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCatalogs } from '../../contexts/CatalogContext';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { 
  Radar, Filter, Clock, MapPin, Target, AlertTriangle, PlusCircle, 
  Loader2, Flame, LayoutGrid, CalendarDays, Sun, Sunset, Moon, X, 
  Calendar as CalendarIcon, ArrowRight, BookOpen, User, GripHorizontal, 
  BarChart, Activity, Zap, Lock, Save, CalendarPlus, ChevronDown, Search, CheckSquare, Square,
  TrendingUp, CheckCircle2, AlertOctagon, ArrowUpRight, PieChart, Users, Siren
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ============================================================================
// 1. HELPERS & CONFIGURAÇÕES GLOBAIS
// ============================================================================
const ALL_DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const DIAS_UTEIS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']; 
const HORARIO_ABERTURA = "06:00"; 
const HORARIO_FECHAMENTO = "22:00"; 
const DURACAO_AULA_PADRAO = 40; 
const GAP_MINIMO_OCIOSO = 60; 

const getTodayStr = () => new Date().toLocaleDateString('en-CA');
const timeToMins = (timeStr) => { if (!timeStr) return 0; const [h, m] = timeStr.split(':').map(Number); return h * 60 + m; };
const minsToTime = (mins) => { const h = Math.floor(mins / 60).toString().padStart(2, '0'); const m = (mins % 60).toString().padStart(2, '0'); return `${h}:${m}`; };

const getCenterPos = (modalWidth, modalHeight) => {
    if (typeof window === 'undefined') return { x: 50, y: 50 };
    return { x: Math.max(10, (window.innerWidth - modalWidth) / 2), y: Math.max(10, (window.innerHeight - modalHeight) / 2) };
};

const getDisciplinaColor = (nome) => {
    const n = nome?.toLowerCase() || '';
    if (n.includes('robótica')) return 'bg-blue-500 border-blue-400 text-white';
    if (n.includes('dance') || n.includes('ritmos') || n.includes('fit')) return 'bg-rose-600 border-rose-500 text-white';
    if (n.includes('inglês') || n.includes('idioma')) return 'bg-[#39ff14] border-[#39ff14] text-black';
    if (n.includes('core') || n.includes('abdominal')) return 'bg-purple-600 border-purple-500 text-white';
    if (n.includes('spinning') || n.includes('bike')) return 'bg-amber-500 border-amber-400 text-white';
    if (n.includes('jump')) return 'bg-emerald-500 border-emerald-400 text-white';
    return 'bg-slate-600 border-slate-500 text-white';
};

// ============================================================================
// 2. COMPONENTES ESTRATÉGICOS (UX AVANÇADA)
// ============================================================================
const MultiSelectDropdown = ({ label, options, selected, onChange, placeholder = "SELECIONAR..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");

    const filteredOptions = options.filter(o => (o.label || '').toUpperCase().includes(search.toUpperCase()));

    const toggle = (id) => {
        if (selected.includes(id)) onChange(selected.filter(x => x !== id));
        else onChange([...selected, id]);
    };

    const handleSelectAll = () => {
        const allIds = filteredOptions.map(o => o.id);
        const uniqueSelected = Array.from(new Set([...selected, ...allIds]));
        onChange(uniqueSelected);
    };

    return (
        <div className="relative w-full">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 block tracking-widest">{label}</label>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full p-3 bg-slate-50 dark:bg-slate-900 border ${isOpen ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900/30' : 'border-slate-200 dark:border-slate-700'} rounded-xl text-[10px] font-black outline-none cursor-pointer flex justify-between items-center transition-all uppercase shadow-sm`}
            >
                <span className="truncate text-slate-700 dark:text-slate-300">
                    {selected.length === 0 ? placeholder : selected.length === 1 ? options.find(o => o.id === selected[0])?.label : `${selected.length} SELECIONADOS`}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
            </div>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[40]" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[50] overflow-hidden flex flex-col max-h-[350px]">
                        <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 shrink-0">
                            <div className="relative">
                                <Search className="w-3 h-3 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input 
                                    type="text" placeholder="BUSCAR..." value={search} onChange={(e) => setSearch(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-2 text-[10px] font-black uppercase outline-none focus:border-blue-500 dark:text-white placeholder-slate-300 dark:placeholder-slate-600"
                                />
                            </div>
                        </div>
                        <div className="overflow-y-auto custom-scrollbar p-2 flex-1 space-y-1">
                            {filteredOptions.length === 0 ? (
                                <div className="p-3 text-center text-[10px] font-bold text-slate-400 uppercase">NENHUM RESULTADO</div>
                            ) : (
                                filteredOptions.map(opt => (
                                    <div key={opt.id} onClick={() => toggle(opt.id)} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selected.includes(opt.id) ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300'}`}>
                                        {selected.includes(opt.id) ? <CheckSquare className="w-4 h-4 text-blue-500 shrink-0" /> : <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />}
                                        <span className="text-[10px] font-black uppercase truncate">{opt.label}</span>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 shrink-0 flex gap-2">
                            <button onClick={handleSelectAll} className="flex-1 py-2 text-[9px] font-black text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded uppercase transition-colors">TODOS</button>
                            {selected.length > 0 && <button onClick={() => onChange([])} className="flex-1 py-2 text-[9px] font-black text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded uppercase transition-colors">LIMPAR</button>}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const ResizableModal = ({ isOpen, onClose, title, icon: Icon, pos, setPos, size, setSize, children, minW = 320, minH = 300, headerColor = "bg-[#1e293b] text-white border-slate-800", headerButtons }) => {
    if (!isOpen) return null;

    const startTransform = (e, dir) => {
        e.stopPropagation(); e.preventDefault();
        const startX = e.clientX || e.touches?.[0].clientX;
        const startY = e.clientY || e.touches?.[0].clientY;
        const startW = size.w; const startH = size.h;
        const startPosX = pos.x; const startPosY = pos.y;

        const onMove = (moveEvent) => {
            const currentX = moveEvent.clientX || moveEvent.touches?.[0].clientX;
            const currentY = moveEvent.clientY || moveEvent.touches?.[0].clientY;
            const dx = currentX - startX; const dy = currentY - startY;
            let newW = startW, newH = startH, newX = startPosX, newY = startPosY;

            if (dir === 'drag') {
                newX = startPosX + dx; newY = Math.max(0, startPosY + dy); 
            } else {
                if (dir.includes('e')) newW = startW + dx;
                if (dir.includes('s')) newH = startH + dy;
                if (dir.includes('w')) { newW = startW - dx; newX = startPosX + dx; }
                if (dir.includes('n')) { newH = startH - dy; newY = startPosY + dy; }
                if (newW < minW) { if (dir.includes('w')) newX = startPosX + (startW - minW); newW = minW; }
                if (newH < minH) { if (dir.includes('n')) newY = startPosY + (startH - minH); newH = minH; }
            }
            setPos({ x: newX, y: newY });
            if (dir !== 'drag') setSize({ w: newW, h: newH });
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp);
        };

        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
        window.addEventListener('touchmove', onMove, { passive: false }); window.addEventListener('touchend', onUp);
    };

    return (
        <div className="fixed z-[300] bg-white dark:bg-slate-800 rounded-3xl shadow-[0_40px_100px_-15px_rgba(0,0,0,0.8)] border border-slate-300 dark:border-slate-700 flex flex-col uppercase" style={{ left: pos.x, top: pos.y, width: size.w, height: size.h, position: 'fixed' }}>
            <div className={`p-4 border-b flex items-center justify-between cursor-grab active:cursor-grabbing select-none shrink-0 rounded-t-3xl ${headerColor}`} onMouseDown={(e) => startTransform(e, 'drag')} onTouchStart={(e) => startTransform(e, 'drag')}>
                <div className="flex items-center gap-3">
                    <GripHorizontal className="w-5 h-5 opacity-40"/>
                    <h3 className="text-xs font-black tracking-widest flex items-center gap-2">{Icon && <Icon className="w-4 h-4"/>} {title}</h3>
                </div>
                <div className="flex items-center gap-2">
                    {headerButtons}
                    <button onClick={onClose} className="p-1.5 hover:bg-black/20 rounded-full transition-colors" onMouseDown={e => e.stopPropagation()}><X className="w-4 h-4 text-white"/></button>
                </div>
            </div>
            <div className="flex flex-col flex-1 overflow-hidden bg-slate-50 dark:bg-slate-900 rounded-b-3xl">
                {children}
            </div>
            <div className="absolute top-0 left-0 w-full h-2 cursor-n-resize" onMouseDown={(e) => startTransform(e, 'n')} />
            <div className="absolute bottom-0 left-0 w-full h-2 cursor-s-resize" onMouseDown={(e) => startTransform(e, 's')} />
            <div className="absolute top-0 left-0 w-2 h-full cursor-w-resize" onMouseDown={(e) => startTransform(e, 'w')} />
            <div className="absolute top-0 right-0 w-2 h-full cursor-e-resize" onMouseDown={(e) => startTransform(e, 'e')} />
            <div className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-10" onMouseDown={(e) => startTransform(e, 'nw')} />
            <div className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-10" onMouseDown={(e) => startTransform(e, 'ne')} />
            <div className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-10" onMouseDown={(e) => startTransform(e, 'sw')} />
            <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10" onMouseDown={(e) => startTransform(e, 'se')} />
        </div>
    );
};

// ============================================================================
// 3. COMPONENTE: VISÃO GLOBAL (CEO)
// ============================================================================
const VisaoGlobal = ({ resumoCEO, executeDrillDown }) => {
    const [showAll1, setShowAll1] = useState(false);
    const [showAll2, setShowAll2] = useState(false);
    const [showAll3, setShowAll3] = useState(false);

    if (!resumoCEO) return <div className="p-20 text-center font-black text-slate-400 dark:text-slate-500">CALCULANDO DADOS...</div>;

    const list1 = showAll1 ? resumoCEO.ranking : resumoCEO.ranking.slice(0, 5);
    const list2 = showAll2 ? resumoCEO.ranking : resumoCEO.ranking.slice(0, 5);
    const list3 = showAll3 ? resumoCEO.otimizadas : resumoCEO.otimizadas.slice(0, 5);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in uppercase items-start">
            {/* CARD 1: HORAS OCIOSAS */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border-t-4 border-t-[#c69c6d] shadow-sm flex flex-col">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                    <div className="w-4 h-4 bg-[#c69c6d]/20 rounded flex items-center justify-center"><TrendingUp className="w-3 h-3 text-[#c69c6d]" /></div>
                    <h3 className="text-[10px] font-black tracking-widest text-[#9c7a52]">HORAS OCIOSAS NA REDE</h3>
                </div>
                <div className="mb-2">
                    <span className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter">{resumoCEO.totalHoras}H</span>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">ESTA SEMANA • <span className="text-slate-800 dark:text-white font-black">{resumoCEO.ranking.length} UNIDADES</span></p>
                </div>
                <div className="flex items-end h-8 gap-1 mb-4 mt-2">
                    {resumoCEO.sparkline.map((val, idx) => (
                        <div key={idx} className={`flex-1 rounded-sm transition-all hover:opacity-80 ${idx === 4 ? 'bg-[#7a5c37]' : 'bg-[#c6cbce] dark:bg-slate-600'}`} style={{ height: `${Math.max(10, (val / resumoCEO.maxSpark) * 100)}%` }} title={`${resumoCEO.diasSparkline[idx]}: ${val} aulas vazias`}></div>
                    ))}
                </div>
                <div className="border-t border-slate-100 dark:border-slate-700 mb-3"></div>
                <div className="flex-1 space-y-3 mb-2">
                    {list1.map((u) => (
                        <div key={u.id} className="flex justify-between items-center text-xs font-bold border-b border-slate-50 dark:border-slate-700/50 pb-2">
                            <span className="text-slate-600 dark:text-slate-300 truncate pr-2 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer" onClick={() => executeDrillDown(u.id)}>{u.nome}</span>
                            <span className="text-[#a06842] dark:text-[#c69c6d] font-black shrink-0">{u.aulasPerdidas} JANELAS</span>
                        </div>
                    ))}
                </div>
                {resumoCEO.ranking.length > 5 && (
                    <button onClick={() => setShowAll1(!showAll1)} className="text-[9px] font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center justify-center gap-1 py-2 uppercase">
                        {showAll1 ? 'VER MENOS' : 'VER MAIS...'} <ChevronDown className={`w-3 h-3 transition-transform ${showAll1 ? 'rotate-180' : ''}`}/>
                    </button>
                )}
            </div>

            {/* CARD 2: MAIOR OCIOSIDADE */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border-t-4 border-t-rose-800 shadow-sm flex flex-col">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                    <div className="w-4 h-4 bg-rose-100 dark:bg-rose-900/30 rounded flex items-center justify-center"><AlertOctagon className="w-3 h-3 text-rose-700 dark:text-rose-400" /></div>
                    <h3 className="text-[10px] font-black tracking-widest text-slate-500 dark:text-slate-400">MAIOR OCIOSIDADE</h3>
                </div>
                <div className="mb-6">
                    <span className="text-3xl font-black text-slate-800 dark:text-white leading-tight block truncate mb-1">{resumoCEO.maiorOciosidade?.nome || 'N/A'}</span>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400"><span className="text-slate-800 dark:text-white font-black">{resumoCEO.maiorOciosidade?.aulasPerdidas || 0} JANELAS</span> ABERTAS ESTA SEMANA</p>
                </div>
                <div className="border-t border-slate-100 dark:border-slate-700 mb-3"></div>
                <div className="flex-1 space-y-3 mb-2">
                    {list2.map((u) => (
                        <div key={u.id} className="flex justify-between items-center text-xs font-bold border-b border-slate-50 dark:border-slate-700/50 pb-2">
                            <span className="text-slate-600 dark:text-slate-300 truncate pr-2 hover:text-rose-600 cursor-pointer" onClick={() => executeDrillDown(u.id)}>{u.nome}</span>
                            <span className="text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded font-black shrink-0">{u.aulasPerdidas} JANELAS</span>
                        </div>
                    ))}
                </div>
                {resumoCEO.ranking.length > 5 && (
                    <button onClick={() => setShowAll2(!showAll2)} className="text-[9px] font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center justify-center gap-1 py-2 uppercase">
                        {showAll2 ? 'VER MENOS' : 'VER MAIS...'} <ChevronDown className={`w-3 h-3 transition-transform ${showAll2 ? 'rotate-180' : ''}`}/>
                    </button>
                )}
            </div>

            {/* CARD 3: UNIDADES OTIMIZADAS */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border-t-4 border-t-emerald-700 shadow-sm flex flex-col">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                    <div className="w-4 h-4 bg-emerald-100 dark:bg-emerald-900/30 rounded flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-emerald-700 dark:text-emerald-400" /></div>
                    <h3 className="text-[10px] font-black tracking-widest text-slate-500 dark:text-slate-400">UNIDADES OTIMIZADAS</h3>
                </div>
                <div className="mb-6">
                    <span className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter">{resumoCEO.otimizadas.length}</span>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">COM ALTO VOLUME DE AULAS E GRADE CHEIA</p>
                </div>
                <div className="border-t border-slate-100 dark:border-slate-700 mb-3"></div>
                <div className="flex-1 space-y-3 mb-2">
                    {list3.length === 0 ? <div className="text-xs font-bold text-slate-400 text-center py-4">Nenhuma unidade 100% cheia.</div> : list3.map((u) => (
                        <div key={u.id} className="flex justify-between items-center text-xs font-bold border-b border-slate-50 dark:border-slate-700/50 pb-2">
                            <span className="text-slate-600 dark:text-slate-300 truncate pr-2 hover:text-emerald-600 cursor-pointer" onClick={() => executeDrillDown(u.id)}>{u.nome}</span>
                            <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded font-black shrink-0">{u.totalAulas} AULAS</span>
                        </div>
                    ))}
                </div>
                {resumoCEO.otimizadas.length > 5 && (
                    <button onClick={() => setShowAll3(!showAll3)} className="text-[9px] font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center justify-center gap-1 py-2 uppercase">
                        {showAll3 ? 'VER MENOS' : 'VER MAIS...'} <ChevronDown className={`w-3 h-3 transition-transform ${showAll3 ? 'rotate-180' : ''}`}/>
                    </button>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// 4. COMPONENTE: VISÃO DE PERFORMANCE (O Pulo do Gato)
// ============================================================================
const VisaoPerformance = ({ resumoPerformance, executeDrillDown }) => {
    const [showAll1, setShowAll1] = useState(false);
    const [showAll2, setShowAll2] = useState(false);

    if (!resumoPerformance) return <div className="p-20 text-center font-black text-slate-400 dark:text-slate-500">Mapeando dados de ocupação...</div>;

    const listOcupacao = showAll1 ? resumoPerformance.rankingOcupacao : resumoPerformance.rankingOcupacao.slice(0, 5);
    const listVacancia = showAll2 ? resumoPerformance.rankingVacancia : resumoPerformance.rankingVacancia.slice(0, 5);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in uppercase items-start">
            
            {/* CARD 1: RANKING DE OCUPAÇÃO (Eficiência da Sala) */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border-t-4 border-t-purple-600 shadow-sm flex flex-col">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                    <div className="w-4 h-4 bg-purple-100 dark:bg-purple-900/30 rounded flex items-center justify-center"><Users className="w-3 h-3 text-purple-600 dark:text-purple-400" /></div>
                    <h3 className="text-[10px] font-black tracking-widest text-purple-700 dark:text-purple-400">TAXA DE OCUPAÇÃO (MÉDIA)</h3>
                </div>
                <div className="mb-2">
                    <span className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter">
                        {resumoPerformance.rankingOcupacao[0]?.taxaOcupacao.toFixed(1) || 0}%
                    </span>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">LÍDER: <span className="text-slate-800 dark:text-white font-black">{resumoPerformance.rankingOcupacao[0]?.nome || 'N/A'}</span></p>
                </div>
                <p className="text-[9px] font-bold text-slate-400 mb-4 lowercase normal-case italic">(Alunos Presentes vs Capacidade m² da Sala)</p>
                <div className="border-t border-slate-100 dark:border-slate-700 mb-3"></div>

                <div className="flex-1 space-y-3 mb-2">
                    {listOcupacao.map((u) => (
                        <div key={u.id} className="flex justify-between items-center text-xs font-bold border-b border-slate-50 dark:border-slate-700/50 pb-2">
                            <span className="text-slate-600 dark:text-slate-300 truncate pr-2 hover:text-purple-600 cursor-pointer" onClick={() => executeDrillDown(u.id)}>{u.nome}</span>
                            <span className={`px-2 py-0.5 rounded font-black shrink-0 ${u.taxaOcupacao >= 100 ? 'bg-rose-100 text-rose-700' : 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'}`}>
                                {u.taxaOcupacao.toFixed(1)}%
                            </span>
                        </div>
                    ))}
                </div>
                {resumoPerformance.rankingOcupacao.length > 5 && (
                    <button onClick={() => setShowAll1(!showAll1)} className="text-[9px] font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center justify-center gap-1 py-2 uppercase">
                        {showAll1 ? 'VER MENOS' : 'VER MAIS...'} <ChevronDown className={`w-3 h-3 transition-transform ${showAll1 ? 'rotate-180' : ''}`}/>
                    </button>
                )}
            </div>

            {/* CARD 2: RANKING DE VACÂNCIA (Tempo Ocioso Absoluto) */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border-t-4 border-t-amber-500 shadow-sm flex flex-col">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                    <div className="w-4 h-4 bg-amber-100 dark:bg-amber-900/30 rounded flex items-center justify-center"><PieChart className="w-3 h-3 text-amber-600 dark:text-amber-400" /></div>
                    <h3 className="text-[10px] font-black tracking-widest text-amber-700 dark:text-amber-400">TAXA DE VACÂNCIA</h3>
                </div>
                <div className="mb-2">
                    <span className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter">
                        {resumoPerformance.rankingVacancia[0]?.taxaVacancia.toFixed(1) || 0}%
                    </span>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">PIOR CASO: <span className="text-slate-800 dark:text-white font-black">{resumoPerformance.rankingVacancia[0]?.nome || 'N/A'}</span></p>
                </div>
                <p className="text-[9px] font-bold text-slate-400 mb-4 lowercase normal-case italic">(% do horário útil da semana sem nenhuma aula)</p>
                <div className="border-t border-slate-100 dark:border-slate-700 mb-3"></div>

                <div className="flex-1 space-y-3 mb-2">
                    {listVacancia.map((u) => (
                        <div key={u.id} className="flex justify-between items-center text-xs font-bold border-b border-slate-50 dark:border-slate-700/50 pb-2">
                            <span className="text-slate-600 dark:text-slate-300 truncate pr-2 hover:text-amber-600 cursor-pointer" onClick={() => executeDrillDown(u.id)}>{u.nome}</span>
                            <span className="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 px-2 py-0.5 rounded font-black shrink-0">
                                {u.taxaVacancia.toFixed(1)}%
                            </span>
                        </div>
                    ))}
                </div>
                {resumoPerformance.rankingVacancia.length > 5 && (
                    <button onClick={() => setShowAll2(!showAll2)} className="text-[9px] font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center justify-center gap-1 py-2 uppercase">
                        {showAll2 ? 'VER MENOS' : 'VER MAIS...'} <ChevronDown className={`w-3 h-3 transition-transform ${showAll2 ? 'rotate-180' : ''}`}/>
                    </button>
                )}
            </div>

            {/* CARD 3: ALERTA DE GARGALO (A Mágica do Cruzamento) */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border-t-4 border-t-rose-600 shadow-sm flex flex-col">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                    <div className="w-4 h-4 bg-rose-100 dark:bg-rose-900/30 rounded flex items-center justify-center"><Siren className="w-3 h-3 text-rose-600 dark:text-rose-400" /></div>
                    <h3 className="text-[10px] font-black tracking-widest text-rose-700 dark:text-rose-400">GARGALOS (RISCO DE RECEITA)</h3>
                </div>
                <div className="mb-2">
                    <span className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter">
                        {resumoPerformance.alertas.length}
                    </span>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">UNIDADES PRECISANDO DE AÇÃO IMEDIATA</p>
                </div>
                <p className="text-[9px] font-bold text-slate-400 mb-4 lowercase normal-case italic">(Alta Ocupação nas salas + Muito horário livre na semana)</p>
                <div className="border-t border-slate-100 dark:border-slate-700 mb-3"></div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                    {resumoPerformance.alertas.length === 0 ? (
                        <div className="text-center py-6">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-50"/>
                            <p className="text-xs font-bold text-slate-400 uppercase">Rede Saudável.<br/>Nenhum Gargalo Detectado.</p>
                        </div>
                    ) : (
                        resumoPerformance.alertas.map((u) => (
                            <div key={u.id} className="bg-rose-50 dark:bg-rose-900/10 p-3 rounded-xl border border-rose-100 dark:border-rose-900/50">
                                <h4 className="text-xs font-black text-rose-800 dark:text-rose-400 mb-1 cursor-pointer hover:underline" onClick={() => executeDrillDown(u.id)}>{u.nome}</h4>
                                <p className="text-[9px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed uppercase">
                                    Tem <span className="text-rose-600 dark:text-rose-400 font-black">{u.taxaOcupacao.toFixed(0)}%</span> de Ocupação Média nas aulas, mas ainda tem <span className="text-amber-600 dark:text-amber-400 font-black">{u.taxaVacancia.toFixed(0)}%</span> de horários ociosos. <br/><span className="text-rose-700 font-black underline mt-1 inline-block">Solução: Abra novas turmas urgente!</span>
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>

        </div>
    );
};


// ============================================================================
// 5. O CORAÇÃO DO SISTEMA (RADAR DE GRADE)
// ============================================================================
export default function RadarDeGrade() {
    const { userData } = useAuth();
    const { catalogs, loadingCatalogs } = useCatalogs();
    const navigate = useNavigate();
    const role = String(userData?.role || "").toLowerCase();
    const userId = userData?.id || userData?.uid;

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // 🟢 ESTADOS DE VISÃO E FILTROS
    const [modoVisao, setModoVisao] = useState('matriz'); // matriz | cartoes | global | performance
    const [estadosFiltro, setEstadosFiltro] = useState([]);
    const [mentoresFiltro, setMentoresFiltro] = useState([]);
    const [unidadesFiltro, setUnidadesFiltro] = useState([]);
    const [turnoFiltro, setTurnoFiltro] = useState(""); 
    
    const [validacoesRecentes, setValidacoesRecentes] = useState([]);
    const [mentoresList, setMentoresList] = useState([]);
    const [vinculosList, setVinculosList] = useState([]); 

    // --- ESTADOS DOS MODAIS FLUTUANTES ---
    const [previewModal, setPreviewModal] = useState({ isOpen: false, unidadeNome: '', unidadeId: '', dia: '', aulas: [], buracos: [], pos: { x: 0, y: 0 }, size: { w: 450, h: 500 } });
    const [floatingSchedule, setFloatingSchedule] = useState({ isOpen: false, unidadeId: null, unidadeNome: '', pos: { x: 0, y: 0 }, size: { w: 480, h: 600 } });
    const [flowPreview, setFlowPreview] = useState({ isOpen: false, unidadeId: null, unidadeNome: '', media: 0, saude: null, ultimasAulas: [], pos: { x: 0, y: 0 }, size: { w: 380, h: 550 } });
    const [addAulaModal, setAddAulaModal] = useState({ isOpen: false, pos: { x: 0, y: 0 }, size: { w: 400, h: 650 } });
    
    const [formData, setFormData] = useState({ modalidadeId: '', professorId: '', hora: '', valor: '', dias: [], dataInicio: getTodayStr() });

    if (role === 'professor' || role === 'unidade') {
        return <div className="p-20 text-center font-black text-slate-300 dark:text-slate-600">ACESSO RESTRITO.</div>;
    }

    const isCofreFechado = (role === 'admin' || role === 'mentor') && (estadosFiltro.length === 0 && mentoresFiltro.length === 0 && unidadesFiltro.length === 0 && !turnoFiltro);

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            try {
                if (role === 'admin') {
                    const usersSnap = await getDocs(query(collection(db, 'usuarios'), where('role', '==', 'mentor')));
                    setMentoresList(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                }
                const vinculosSnap = await getDocs(collection(db, 'vinculos'));
                setVinculosList(vinculosSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(v => v.status === 'ativo'));

                const dataCorte = new Date();
                dataCorte.setDate(dataCorte.getDate() - 90);
                const dataCorteStr = dataCorte.toISOString().split('T')[0];
                const q = query(collection(db, 'validacoes'), where('data', '>=', dataCorteStr));
                const snap = await getDocs(q);
                setValidacoesRecentes(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(v => v.status === 'realizada'));
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchInitialData();
    }, [role]);

    // 🟢 MATEMÁTICA DE OCIOSIDADE CORRIGIDA PARA O TURNO (PAREDES DE TEMPO)
    const processarBuracos = (aulasDoDia, turno) => {
        let abertura = timeToMins("06:00");
        let fechamento = timeToMins("22:00");

        if (turno === 'manha') { fechamento = timeToMins("12:00"); }
        else if (turno === 'tarde') { abertura = timeToMins("12:00"); fechamento = timeToMins("18:00"); }
        else if (turno === 'noite') { abertura = timeToMins("18:00"); fechamento = timeToMins("22:00"); }

        const janelas = [];
        
        const aulasNoTurno = aulasDoDia.filter(a => {
            const inicioAula = timeToMins(a.hora);
            return inicioAula >= abertura && inicioAula < fechamento;
        }).sort((a, b) => timeToMins(a.hora) - timeToMins(b.hora));
        
        let tempoAtual = abertura;

        aulasNoTurno.forEach(aula => {
            const inicioAula = timeToMins(aula.hora);
            if (inicioAula - tempoAtual >= GAP_MINIMO_OCIOSO) {
                janelas.push({ inicio: tempoAtual, fim: inicioAula });
            }
            tempoAtual = Math.max(tempoAtual, inicioAula + DURACAO_AULA_PADRAO);
        });
        
        if (fechamento - tempoAtual >= GAP_MINIMO_OCIOSO) {
            janelas.push({ inicio: tempoAtual, fim: fechamento });
        }
        
        return janelas.map(j => `${minsToTime(j.inicio)} - ${minsToTime(j.fim)}`);
    };

    const dadosRadar = useMemo(() => {
        if (isCofreFechado || !catalogs.unidades) return [];
        let unidades = catalogs.unidades;
        if (role === 'mentor') unidades = unidades.filter(u => u.mentorId === userId);
        
        if (estadosFiltro.length > 0) unidades = unidades.filter(u => estadosFiltro.includes(u.estado));
        if (mentoresFiltro.length > 0) unidades = unidades.filter(u => mentoresFiltro.includes(u.mentorId));
        if (unidadesFiltro.length > 0) unidades = unidades.filter(u => unidadesFiltro.includes(u.id));

        return unidades.map(u => {
            const diasData = {};
            
            let aulasDaUnidade = (catalogs.aulas || []).filter(a => a.unidadeId === u.id);
            if (turnoFiltro) {
                aulasDaUnidade = aulasDaUnidade.filter(a => {
                    const mins = timeToMins(a.hora);
                    if (turnoFiltro === 'manha') return mins >= timeToMins("06:00") && mins < timeToMins("12:00");
                    if (turnoFiltro === 'tarde') return mins >= timeToMins("12:00") && mins < timeToMins("18:00");
                    if (turnoFiltro === 'noite') return mins >= timeToMins("18:00") && mins <= timeToMins("22:00");
                    return true;
                });
            }

            const totalAulas = aulasDaUnidade.length;

            ALL_DAYS.forEach(dia => {
                let aulasNoDia = aulasDaUnidade.filter(a => a.dias?.includes(dia));
                diasData[dia] = processarBuracos(aulasNoDia, turnoFiltro);
            });

            // Calcula o Fluxo de Alunos respeitando o turno filtrado
            const valsUnidade = validacoesRecentes.filter(v => {
                if (v.unidadeId !== u.id) return false;
                if (turnoFiltro && v.hora) {
                    const mins = timeToMins(v.hora);
                    if (turnoFiltro === 'manha' && !(mins >= timeToMins("06:00") && mins < timeToMins("12:00"))) return false;
                    if (turnoFiltro === 'tarde' && !(mins >= timeToMins("12:00") && mins < timeToMins("18:00"))) return false;
                    if (turnoFiltro === 'noite' && !(mins >= timeToMins("18:00") && mins <= timeToMins("22:00"))) return false;
                }
                return true;
            });

            const media = valsUnidade.length > 0 ? Math.round(valsUnidade.reduce((acc, v) => acc + (Number(v.alunos) || 0), 0) / valsUnidade.length) : 0;
            
            let saude = { label: 'MÉDIA', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', icon: <Activity className="w-3 h-3"/> };
            if (media >= 20) saude = { label: 'ALTA DEMANDA', color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-200 dark:border-rose-800', icon: <Flame className="w-3 h-3"/> };
            if (media > 0 && media < 10) saude = { label: 'BAIXA DEMANDA', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700', icon: <AlertTriangle className="w-3 h-3"/> };
            
            return { ...u, dias: diasData, mediaAlunos: media, saude, totalAulas };
        }).filter(Boolean).sort((a, b) => b.mediaAlunos - a.mediaAlunos);
    }, [catalogs, validacoesRecentes, estadosFiltro, mentoresFiltro, unidadesFiltro, turnoFiltro, role, userId, isCofreFechado]);

    // O CÉREBRO DO DASHBOARD CEO
    const resumoCEO = useMemo(() => {
        if (!dadosRadar.length) return null;

        let totalAulasPerdidas = 0;
        const ranking = dadosRadar.map(u => {
            let aulasPerdidasUnidade = 0;
            Object.entries(u.dias).forEach(([dia, janelasDia]) => {
                if (!DIAS_UTEIS.includes(dia)) return;
                janelasDia.forEach(j => {
                    const [inicio, fim] = j.split(' - ');
                    const duracaoMins = timeToMins(fim) - timeToMins(inicio);
                    aulasPerdidasUnidade += Math.floor(duracaoMins / DURACAO_AULA_PADRAO);
                });
            });
            totalAulasPerdidas += aulasPerdidasUnidade;
            return { ...u, aulasPerdidas: aulasPerdidasUnidade };
        }).sort((a, b) => b.aulasPerdidas - a.aulasPerdidas);

        const totalHoras = Math.round((totalAulasPerdidas * DURACAO_AULA_PADRAO) / 60);
        const maiorOciosidade = ranking[0];
        const otimizadas = [...ranking].filter(u => u.totalAulas > 0).sort((a, b) => b.totalAulas - a.totalAulas);

        const sparkline = DIAS_UTEIS.map(dia => {
            let perdidasDoDia = 0;
            dadosRadar.forEach(u => {
                const janelas = u.dias[dia] || [];
                janelas.forEach(j => {
                    const [inicio, fim] = j.split(' - ');
                    perdidasDoDia += Math.floor((timeToMins(fim) - timeToMins(inicio)) / DURACAO_AULA_PADRAO);
                });
            });
            return perdidasDoDia;
        });
        const maxSpark = Math.max(...sparkline) || 1;

        return { totalAulasPerdidas, totalHoras, ranking, maiorOciosidade, otimizadas, sparkline, maxSpark, diasSparkline: DIAS_UTEIS };
    }, [dadosRadar]);

    // 🟢 O NOVO CÉREBRO DE PERFORMANCE (OCUPAÇÃO E VACÂNCIA)
    const resumoPerformance = useMemo(() => {
        if (!dadosRadar.length || !catalogs.aulas || !catalogs.modalidades) return null;

        // Limite da semana útil: 5 dias, 16 horas/dia = 960 mins/dia = 24 aulas/dia = 120 aulas/semana.
        const MAX_AULAS_SEMANA = 120; 

        const dados = dadosRadar.map(u => {
            // 1. Taxa de Vacância (%)
            let aulasPerdidas = 0;
            DIAS_UTEIS.forEach(dia => {
                const janelas = u.dias[dia] || [];
                janelas.forEach(j => {
                    const [inicio, fim] = j.split(' - ');
                    aulasPerdidas += Math.floor((timeToMins(fim) - timeToMins(inicio)) / DURACAO_AULA_PADRAO);
                });
            });
            const taxaVacancia = Math.min((aulasPerdidas / MAX_AULAS_SEMANA) * 100, 100);

            // 2. Taxa de Ocupação (%)
            const aulasDaUnidade = catalogs.aulas.filter(a => a.unidadeId === u.id);
            let sumOcupacao = 0;
            let countOcupadas = 0;
            const metragem = Number(u.metragemSalaColetiva) || 60; // Se a unidade não cadastrou m², assume 60 para não quebrar a matemática

            aulasDaUnidade.forEach(aula => {
                const mod = catalogs.modalidades.find(m => m.id === aula.modalidadeId);
                const indice = Number(mod?.indiceOcupacao) || 3;
                const capacidadeMaxima = Math.floor(metragem / indice) || 1; // Nunca divide por zero
                
                // Média de alunos reais que frequentam essa aula específica
                const validacoesDaAula = validacoesRecentes.filter(v => v.aulaId === aula.id);
                const mediaAlunos = validacoesDaAula.length > 0 
                    ? validacoesDaAula.reduce((acc, v) => acc + (Number(v.alunos) || 0), 0) / validacoesDaAula.length 
                    : 0;

                const ocupacaoDaAula = (mediaAlunos / capacidadeMaxima) * 100;
                sumOcupacao += ocupacaoDaAula;
                countOcupadas++;
            });

            const taxaOcupacao = countOcupadas > 0 ? (sumOcupacao / countOcupadas) : 0;
            
            // 3. Gargalo de Receita (O Alarme de Risco)
            // Regra: Salas muito cheias (>70%) mas com muitos horários vazios na academia (>30%)
            const gargalo = taxaOcupacao > 70 && taxaVacancia > 30;

            return { ...u, taxaVacancia, taxaOcupacao, gargalo };
        });

        const rankingOcupacao = [...dados].sort((a, b) => b.taxaOcupacao - a.taxaOcupacao);
        const rankingVacancia = [...dados].sort((a, b) => b.taxaVacancia - a.taxaVacancia);
        const alertas = dados.filter(d => d.gargalo).sort((a, b) => b.taxaOcupacao - a.taxaOcupacao);

        return { rankingOcupacao, rankingVacancia, alertas };
    }, [dadosRadar, catalogs.aulas, catalogs.modalidades, validacoesRecentes]);


    const getMediaAula = (aulaId) => {
        if (!aulaId) return 0;
        const validacoesDaAula = validacoesRecentes.filter(v => v.aulaId === aulaId);
        if (validacoesDaAula.length === 0) return 0;
        return Math.round(validacoesDaAula.reduce((acc, v) => acc + (Number(v.alunos) || 0), 0) / validacoesDaAula.length);
    };

    const executeDrillDown = (unidadeId) => {
        if (unidadeId) setUnidadesFiltro([unidadeId]);
        setModoVisao('matriz');
    };

    const handleModalidadeChange = (e) => {
        const mId = e.target.value;
        const mod = catalogs.modalidades?.find(m => m.id === mId);
        setFormData(prev => ({ ...prev, modalidadeId: mId, professorId: '', valor: mod?.valorBase || '' }));
    };

    const toggleDia = (dia) => {
        setFormData(prev => {
            const newDias = prev.dias.includes(dia) ? prev.dias.filter(d => d !== dia) : [...prev.dias, dia];
            return { ...prev, dias: newDias };
        });
    };

    const salvarNovaAula = async (e) => {
        e.preventDefault();
        if (!formData.modalidadeId || !formData.professorId || !formData.hora || !formData.dataInicio) return alert("Preencha todos os campos obrigatórios!");
        if (formData.dias.length === 0) return alert("Selecione pelo menos um dia da semana para a aula!");
        if (formData.dataInicio < getTodayStr()) return alert("ERRO DE INTEGRIDADE: A Data de Início não pode ser retroativa!");

        setSaving(true);
        try {
            await addDoc(collection(db, 'aulas'), {
                unidadeId: previewModal.unidadeId, dias: formData.dias, hora: formData.hora,
                modalidadeId: formData.modalidadeId, professorId: formData.professorId,
                valor: formData.valor || 0, dataInicio: formData.dataInicio, excluido: false,
                dataCriacao: new Date().toISOString()
            });
            setAddAulaModal({ ...addAulaModal, isOpen: false });
            alert("AULA BLINDADA E CADASTRADA COM SUCESSO!");
        } catch (error) { alert("Erro ao salvar aula no banco de dados."); } 
        finally { setSaving(false); }
    };

    const optionsEstados = [...new Set(catalogs.unidades?.map(u => u.estado))].sort().map(e => ({ id: e, label: e }));
    const optionsMentores = mentoresList.map(m => ({ id: m.id, label: m.nome }));
    const optionsUnidades = catalogs.unidades?.filter(u => (estadosFiltro.length === 0 || estadosFiltro.includes(u.estado)) && (mentoresFiltro.length === 0 || mentoresFiltro.includes(u.mentorId))).map(u => ({ id: u.id, label: u.nome }));
    
    const professoresVinculados = useMemo(() => {
        if (!previewModal.unidadeId) return [];
        const linksDaUnidade = vinculosList.filter(v => String(v.unidadeId) === String(previewModal.unidadeId));
        const idsPermitidos = linksDaUnidade.map(v => String(v.professorId));
        return (catalogs.professores || []).filter(p => idsPermitidos.includes(String(p.id)));
    }, [previewModal.unidadeId, vinculosList, catalogs.professores]);

    const aulasDaUnidadeFlutuante = useMemo(() => {
        if (!floatingSchedule.isOpen || !floatingSchedule.unidadeId) return [];
        return (catalogs.aulas || []).filter(a => a.unidadeId === floatingSchedule.unidadeId);
    }, [floatingSchedule.isOpen, floatingSchedule.unidadeId, catalogs.aulas]);

    // ============================================================================
    // RENDERIZAÇÃO PRINCIPAL
    // ============================================================================
    return (
        <div className="p-6 md:p-8 w-full min-h-screen max-w-[1920px] mx-auto animate-fade-in space-y-6 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 relative uppercase transition-colors">
            
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 border-b border-slate-200 dark:border-slate-800 pb-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
                        <span className="bg-blue-600 text-white p-2 rounded-lg shadow-lg shadow-blue-500/20 dark:shadow-none"><Radar className="w-7 h-7" /></span>
                        RADAR DE GRADE
                    </h1>
                </div>
                
                {/* 🟢 O BOTÃO DE PERFORMANCE FOI ADICIONADO AQUI NO PAINEL DE NAVEGAÇÃO */}
                <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl shadow-inner shrink-0 overflow-x-auto max-w-full border border-slate-200 dark:border-slate-700">
                    <button onClick={() => setModoVisao('matriz')} className={`px-5 py-2.5 rounded-lg text-[11px] font-black transition-all flex items-center whitespace-nowrap gap-2 ${modoVisao === 'matriz' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}><LayoutGrid className="w-4 h-4"/> MATRIZ GLOBAL</button>
                    <button onClick={() => setModoVisao('cartoes')} className={`px-5 py-2.5 rounded-lg text-[11px] font-black transition-all flex items-center whitespace-nowrap gap-2 ${modoVisao === 'cartoes' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}><CalendarDays className="w-4 h-4"/> VISÃO POR UNIDADE</button>
                    <button onClick={() => setModoVisao('global')} className={`px-5 py-2.5 rounded-lg text-[11px] font-black transition-all flex items-center whitespace-nowrap gap-2 ${modoVisao === 'global' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border dark:border-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}><BarChart className="w-4 h-4"/> RELATÓRIO GLOBAL</button>
                    <button onClick={() => setModoVisao('performance')} className={`px-5 py-2.5 rounded-lg text-[11px] font-black transition-all flex items-center whitespace-nowrap gap-2 ${modoVisao === 'performance' ? 'bg-slate-900 dark:bg-slate-950 text-white dark:text-blue-400 shadow-sm border dark:border-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}><Activity className="w-4 h-4"/> PERFORMANCE (OCUPAÇÃO E VACÂNCIA)</button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5">
                <div className="col-span-full md:col-span-2 xl:col-span-2 flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    {[ {id: '', label: 'TODOS', icon: Zap}, {id: 'manha', label: 'MANHÃ', icon: Sun}, {id: 'tarde', label: 'TARDE', icon: Sunset}, {id: 'noite', label: 'NOITE', icon: Moon} ].map(t => (
                        <button key={t.id} onClick={() => setTurnoFiltro(t.id)} className={`flex-1 py-3 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-2 ${turnoFiltro === t.id ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}><t.icon className="w-3.5 h-3.5"/> {t.label}</button>
                    ))}
                </div>
                
                {role === 'admin' && (
                    <>
                        <MultiSelectDropdown label="ESTADOS" options={optionsEstados} selected={estadosFiltro} onChange={setEstadosFiltro} placeholder="TODOS OS ESTADOS" />
                        <MultiSelectDropdown label="MENTORES" options={optionsMentores} selected={mentoresFiltro} onChange={setMentoresFiltro} placeholder="TODOS OS MENTORES" />
                    </>
                )}
                <MultiSelectDropdown label="UNIDADES" options={optionsUnidades || []} selected={unidadesFiltro} onChange={setUnidadesFiltro} placeholder="TODAS AS UNIDADES" />
            </div>

            {isCofreFechado ? (
                <div className="py-24 text-center bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 shadow-sm">
                    <div className="bg-blue-50 dark:bg-blue-900/30 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-100 dark:border-blue-800 shadow-inner">
                        <Lock className="w-10 h-10 text-blue-500 dark:text-blue-400 animate-pulse"/>
                    </div>
                    <h3 className="text-2xl font-black text-slate-700 dark:text-slate-200 mb-3">COFRE DO RADAR ATIVADO</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-bold max-w-lg mx-auto leading-relaxed">
                        SELECIONE PELO MENOS UM FILTRO AVANÇADO ACIMA PARA RASTREAR OS BURACOS DE OCIOSIDADE.
                    </p>
                </div>
            ) : (
                <>
                    {modoVisao === 'global' && <VisaoGlobal resumoCEO={resumoCEO} executeDrillDown={executeDrillDown} />}
                    
                    {/* 🟢 NOVA ABA DE PERFORMANCE RENDERIZADA AQUI */}
                    {modoVisao === 'performance' && <VisaoPerformance resumoPerformance={resumoPerformance} executeDrillDown={executeDrillDown} />}

                    {modoVisao === 'matriz' && (
                        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative">
                            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                                <table className="w-full text-left text-sm border-separate border-spacing-0 min-w-[1200px]">
                                    <thead className="sticky top-0 z-30 shadow-sm bg-slate-800 dark:bg-slate-900 text-white text-[10px] font-black uppercase">
                                        <tr>
                                            <th className="p-5 w-64 sticky left-0 z-40 bg-slate-900 dark:bg-slate-950 border-r border-slate-700 dark:border-slate-800">UNIDADE / FLUXO</th>
                                            {ALL_DAYS.map(d => <th key={d} className="p-5 text-center border-r border-slate-700/50 dark:border-slate-800/50">{d}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                        {dadosRadar.map(u => (
                                            <tr key={u.id} className="group hover:bg-blue-50/30 dark:hover:bg-slate-700/30 transition-colors">
                                                <td className="p-5 sticky left-0 z-20 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/90 border-r border-slate-200 dark:border-slate-700 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]">
                                                    <div className="font-black text-slate-800 dark:text-slate-100 text-sm mb-1">{u.nome}</div>
                                                    <button 
                                                        onClick={() => setFlowPreview({ isOpen: true, unidadeId: u.id, unidadeNome: u.nome, media: u.mediaAlunos, saude: u.saude, ultimasAulas: validacoesRecentes.filter(v => v.unidadeId === u.id).sort((a,b) => new Date(b.data) - new Date(a.data)), pos: getCenterPos(380, 550), size: flowPreview.size })} 
                                                        className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[10px] font-black w-full shadow-sm hover:scale-105 transition-transform ${u.saude.bg} ${u.saude.color} ${u.saude.border}`}
                                                    >
                                                        {u.saude.icon} {u.mediaAlunos > 0 ? `${u.mediaAlunos} AL/AULA` : 'SEM DADOS'}
                                                    </button>
                                                    <button 
                                                        onClick={() => setFloatingSchedule({ isOpen: true, unidadeId: u.id, unidadeNome: u.nome, pos: getCenterPos(480, 600), size: floatingSchedule.size })} 
                                                        className="mt-2 w-full flex items-center justify-center gap-2 py-1.5 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white rounded-lg text-[9px] font-black border border-slate-200 dark:border-slate-700 transition-colors"
                                                    >
                                                        <CalendarDays className="w-3 h-3"/> QUADRO DE AULAS
                                                    </button>
                                                </td>
                                                {ALL_DAYS.map(dia => (
                                                    <td key={dia} onClick={() => setPreviewModal({ isOpen: true, unidadeNome: u.nome, unidadeId: u.id, dia, aulas: (catalogs.aulas || []).filter(a => a.unidadeId === u.id && a.dias?.includes(dia)).sort((a,b) => timeToMins(a.hora) - timeToMins(b.hora)), buracos: u.dias[dia], pos: getCenterPos(450, 500), size: previewModal.size })} className="p-3 border-r border-slate-100 dark:border-slate-700/50 align-top cursor-pointer group/cell hover:bg-blue-100/40 dark:hover:bg-blue-900/20 transition-colors">
                                                        <div className="flex flex-col gap-1.5 h-full text-center">
                                                            {u.dias[dia].length === 0 ? <span className="text-[9px] font-bold text-slate-400 dark:text-slate-600 py-4 opacity-30">CHEIA</span> : u.dias[dia].map((j, i) => (
                                                                <div key={i} className="text-[10px] font-bold px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 shadow-sm flex items-center gap-1"><Clock className="w-3 h-3 opacity-60"/> {j}</div>
                                                            ))}
                                                            <div className="opacity-0 group-hover/cell:opacity-100 transition-opacity mt-auto text-[8px] font-black text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 py-1 rounded uppercase">CONSULTAR <BookOpen className="w-2.5 h-2.5 inline ml-0.5"/></div>
                                                        </div>
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {modoVisao === 'cartoes' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                            {unidadesFiltro.length === 1 ? ALL_DAYS.map(dia => {
                                const u = dadosRadar.find(x => x.id === unidadesFiltro[0]);
                                if (!u) return null;
                                return (
                                    <div key={dia} className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl cursor-pointer" onClick={() => setPreviewModal({ isOpen: true, unidadeNome: u.nome, unidadeId: u.id, dia, aulas: (catalogs.aulas || []).filter(a => a.unidadeId === u.id && a.dias?.includes(dia)).sort((a,b) => timeToMins(a.hora) - timeToMins(b.hora)), buracos: u.dias[dia], pos: getCenterPos(450, 500), size: previewModal.size })}>
                                        <h3 className="font-black text-lg text-blue-600 dark:text-blue-400 mb-4">{dia}</h3>
                                        <div className="space-y-3">
                                            {u.dias[dia].length === 0 ? <p className="text-xs font-bold text-slate-300 dark:text-slate-600 italic text-center py-4">GRADE TOTALMENTE OCUPADA</p> : u.dias[dia].map((j, i) => (
                                                <div key={i} className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/50 text-blue-700 dark:text-blue-400 font-bold text-xs"><Clock className="w-4 h-4 opacity-50"/> {j}</div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            }) : <div className="col-span-full p-20 text-center text-slate-300 dark:text-slate-600 font-black">SELECIONE EXATAMENTE 1 UNIDADE NO FILTRO PARA GERAR OS CARTÕES.</div>}
                        </div>
                    )}
                </>
            )}

            {/* =====================================================================
                🟢 MODAIS FLUTUANTES (MOTOR DE 8 ALÇAS - FREE TRANSFORM)
                ===================================================================== */}
            <ResizableModal 
                isOpen={previewModal.isOpen} onClose={() => setPreviewModal({...previewModal, isOpen: false})} 
                title={`PRÉVIA: ${previewModal.dia} (${previewModal.unidadeNome})`} icon={CalendarIcon} headerColor="bg-blue-50 dark:bg-slate-900 text-blue-800 dark:text-blue-400 border-blue-100 dark:border-slate-800"
                pos={previewModal.pos} setPos={(pos) => setPreviewModal({...previewModal, pos})} size={previewModal.size} setSize={(size) => setPreviewModal({...previewModal, size})} minW={350} minH={300}
            >
                <div className="p-6 overflow-y-auto flex-1 space-y-4 custom-scrollbar bg-white dark:bg-slate-800">
                    {previewModal.aulas.length === 0 ? <div className="p-6 bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-center text-slate-400 text-xs font-bold uppercase">NENHUMA AULA NESTE DIA.</div> : (
                        <div className="space-y-3">
                            {previewModal.aulas.map((a, i) => {
                                const mod = catalogs.modalidades?.find(m => m.id === a.modalidadeId);
                                const cor = mod?.cor || '#3b82f6';
                                const mediaAula = getMediaAula(a.id); 
                                
                                return (
                                    <div key={i} className="flex items-center gap-4 bg-white dark:bg-slate-900 border-2 p-3 rounded-2xl shadow-sm hover:shadow-md transition-shadow" style={{ borderColor: cor + '30' }}>
                                        <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 border" style={{ backgroundColor: cor + '15', borderColor: cor + '40', color: cor }}>
                                            <span className="text-sm font-black leading-none">{a.hora}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-black text-sm uppercase tracking-tight truncate" style={{ color: cor }}>{mod?.nome || 'AULA COLETIVA'}</div>
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mt-0.5 truncate flex items-center gap-1"><User className="w-3 h-3"/> PROF: {catalogs.professores?.find(p => p.id === a.professorId)?.nome || 'N/A'}</div>
                                            <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 mt-0.5 truncate uppercase">{a.dias?.join(', ')}</div>
                                        </div>
                                        <div className="flex flex-col items-end justify-center bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-1.5 shadow-sm">
                                            <span className="text-lg font-black text-blue-600 dark:text-blue-400 leading-none">{mediaAula} <span className="text-[10px] font-bold opacity-60">AL</span></span>
                                            <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-0.5">Últimos 30 Dias</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div className="p-5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shrink-0">
                    <button onClick={() => { setFormData({ modalidadeId: '', professorId: '', hora: previewModal.buracos.length > 0 ? previewModal.buracos[0].split(' - ')[0] : '', valor: '', dias: [previewModal.dia], dataInicio: getTodayStr() }); setAddAulaModal({ isOpen: true, pos: getCenterPos(400, 650), size: addAulaModal.size }); }} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs tracking-widest uppercase shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"><CalendarPlus className="w-4 h-4"/> PREENCHER HORÁRIO VAGO</button>
                </div>
            </ResizableModal>

            <ResizableModal 
                isOpen={addAulaModal.isOpen} onClose={() => setAddAulaModal({...addAulaModal, isOpen: false})} 
                title={`NOVA AULA: ${previewModal.unidadeNome}`} icon={PlusCircle} headerColor="bg-blue-50 dark:bg-slate-900 text-blue-800 dark:text-blue-400 border-blue-100 dark:border-slate-800"
                pos={addAulaModal.pos} setPos={(pos) => setAddAulaModal({...addAulaModal, pos})} size={addAulaModal.size} setSize={(size) => setAddAulaModal({...addAulaModal, size})} minW={320} minH={450}
            >
                <form onSubmit={salvarNovaAula} className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-slate-800">
                    <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 block">Dias da Semana (Recorrência)</label>
                        <div className="flex flex-wrap gap-2">
                            {ALL_DAYS.map(d => (
                                <button key={d} type="button" onClick={() => toggleDia(d)} className={`px-3 py-2 text-[10px] font-black rounded-lg border uppercase transition-colors ${formData.dias.includes(d) ? 'bg-blue-600 dark:bg-blue-500 text-white border-blue-700 dark:border-blue-600 shadow-md scale-105' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                                    {d.substring(0,3)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Modalidade</label>
                        <select required value={formData.modalidadeId} onChange={handleModalidadeChange} className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-blue-500 bg-slate-50 dark:bg-slate-900 uppercase">
                            <option value="">SELECIONE A MODALIDADE...</option>
                            {catalogs.modalidades?.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Professor (Vinculado Oficial)</label>
                        <select required disabled={!formData.modalidadeId} value={formData.professorId} onChange={e => setFormData({...formData, professorId: e.target.value})} className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-blue-500 bg-slate-50 dark:bg-slate-900 uppercase disabled:opacity-50">
                            <option value="">{!formData.modalidadeId ? 'SELECIONE UMA MODALIDADE PRIMEIRO' : professoresVinculados.length === 0 ? 'NENHUM PROFESSOR VINCULADO A UNIDADE' : 'SELECIONE O PROFESSOR...'}</option>
                            {professoresVinculados.filter(p => !p.modalidades || p.modalidades.includes(formData.modalidadeId)).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        </select>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1"><CalendarIcon className="w-3 h-3"/> Data de Início</label>
                            <input required type="date" min={getTodayStr()} value={formData.dataInicio} onChange={e => setFormData({...formData, dataInicio: e.target.value})} className="w-full p-3 border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-sm font-black text-emerald-700 dark:text-emerald-400 outline-none focus:border-emerald-500 shadow-inner uppercase"/>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Hora Início</label>
                            <input required type="time" value={formData.hora} onChange={e => setFormData({...formData, hora: e.target.value})} className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-black text-slate-800 dark:text-white outline-none focus:border-blue-500 bg-slate-50 dark:bg-slate-900 uppercase"/>
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Valor (R$)</label>
                            <input required type="number" step="0.01" value={formData.valor} onChange={e => setFormData({...formData, valor: e.target.value})} className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-blue-500 bg-slate-50 dark:bg-slate-900 uppercase"/>
                        </div>
                    </div>
                    
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700 shrink-0">
                        <button disabled={saving} type="submit" className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 active:scale-95 transition-all">
                            {saving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} SALVAR NOVA AULA
                        </button>
                    </div>
                </form>
            </ResizableModal>

            <ResizableModal 
                isOpen={floatingSchedule.isOpen} onClose={() => setFloatingSchedule({...floatingSchedule, isOpen: false})} 
                title={`QUADRO DE AULAS: ${floatingSchedule.unidadeNome}`} icon={LayoutGrid} headerColor="bg-[#1e293b] text-white border-slate-800"
                pos={floatingSchedule.pos} setPos={(pos) => setFloatingSchedule({...floatingSchedule, pos})} size={floatingSchedule.size} setSize={(size) => setFloatingSchedule({...floatingSchedule, size})} minW={320} minH={300}
                headerButtons={<button onClick={() => navigate(`/app/cronograma?unidade=${floatingSchedule.unidadeId}`)} className="bg-blue-600 hover:bg-blue-500 p-2 rounded-lg text-white transition-colors"><CalendarIcon className="w-4 h-4"/></button>}
            >
                <div className="p-4 overflow-y-auto bg-slate-50 dark:bg-slate-900 custom-scrollbar space-y-4 flex-1">
                    {aulasDaUnidadeFlutuante.length === 0 ? (
                        <div className="py-10 text-center text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-xs">Nenhuma aula cadastrada nesta unidade.</div>
                    ) : (
                        ALL_DAYS.map(dia => {
                            const aulasDoDia = aulasDaUnidadeFlutuante.filter(a => a.dias?.includes(dia)).sort((a, b) => timeToMins(a.hora) - timeToMins(b.hora));
                            if (aulasDoDia.length === 0) return null; 
                            return (
                                <div key={dia} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                                    <div className="bg-slate-100 dark:bg-slate-900/50 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                                        <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">{dia}</h4>
                                    </div>
                                    <div className="p-3 bg-slate-50/50 dark:bg-slate-800/50">
                                        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
                                            {aulasDoDia.map((aula, idx) => {
                                                const mod = catalogs.modalidades?.find(m => m.id === aula.modalidadeId);
                                                const prof = catalogs.professores?.find(p => p.id === aula.professorId);
                                                const mediaAula = getMediaAula(aula.id);
                                                return (
                                                    <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex items-center gap-3 hover:border-blue-300 dark:hover:border-blue-600 transition-colors shadow-sm">
                                                        <div className={`font-black text-[11px] px-3 py-2 rounded-lg shrink-0 text-center w-16 shadow-sm ${getDisciplinaColor(mod?.nome)}`}>
                                                            {aula.hora}
                                                        </div>
                                                        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                                                            <div className="flex flex-col flex-1 truncate">
                                                                <div className="text-sm font-black text-[#1e293b] dark:text-slate-200 truncate uppercase leading-tight">{mod?.nome || 'AULA COLETIVA'}</div>
                                                                <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide truncate mt-0.5"><User className="w-3 h-3 inline mr-1 -mt-0.5"/> {prof?.nome || 'N/A'}</div>
                                                            </div>
                                                            <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded px-2 py-1 shrink-0">
                                                                <span className="text-xs font-black text-blue-600 dark:text-blue-400 leading-none">{mediaAula} <span className="text-[8px]">AL</span></span>
                                                                <span className="text-[7px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-0.5">30 Dias</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </ResizableModal>

            <ResizableModal 
                isOpen={flowPreview.isOpen} onClose={() => setFlowPreview({...flowPreview, isOpen: false})} 
                title="SAÚDE DA UNIDADE" icon={Activity} headerColor={flowPreview.saude?.bg + " " + flowPreview.saude?.color + " border-b border-slate-200 dark:border-slate-800"}
                pos={flowPreview.pos} setPos={(pos) => setFlowPreview({...flowPreview, pos})} size={flowPreview.size} setSize={(size) => setFlowPreview({...flowPreview, size})} minW={300} minH={350}
            >
                <div className="p-6 text-center border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
                    <div className={`text-6xl font-black tracking-tighter ${flowPreview.saude?.color}`}>{flowPreview.media}</div>
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase mt-1">Média Global da Unidade (90 Dias)</p>
                </div>
                <div className="bg-slate-50/50 dark:bg-slate-900/50 flex flex-col flex-1 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 shrink-0">
                        <h4 className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Hístórico Completo ({flowPreview.ultimasAulas.length} registros)</h4>
                    </div>
                    <div className="p-4 space-y-2 overflow-y-auto custom-scrollbar flex-1">
                        {flowPreview.ultimasAulas.length === 0 ? (
                            <p className="text-xs text-slate-400 dark:text-slate-500 text-center font-bold py-4 uppercase">Nenhum registro encontrado.</p>
                        ) : (
                            flowPreview.ultimasAulas.map((v, i) => {
                                const mod = catalogs.modalidades?.find(m => m.id === v.modalidadeId);
                                return (
                                    <div key={i} className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm shrink-0 hover:border-blue-200 dark:hover:border-blue-800 transition-colors uppercase">
                                        <div className="flex flex-col min-w-0 flex-1 pr-2">
                                            <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 truncate">{mod?.nome || 'AULA COLETIVA'}</span>
                                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">{new Date(v.data).toLocaleDateString('pt-BR')}</span>
                                        </div>
                                        <div className="text-xs font-black text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800 shrink-0">
                                            {v.alunos} <span className="text-[8px] uppercase">Alunos</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
                        <button onClick={() => navigate(`/app/relatorio-gerencial?unidade=${flowPreview.unidadeId}`)} className="w-full py-3.5 bg-slate-900 dark:bg-slate-950 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-slate-800 dark:hover:bg-slate-900 border dark:border-slate-700 transition-all flex items-center justify-center gap-2">RELATÓRIO COMPLETO <ArrowRight className="w-4 h-4"/></button>
                    </div>
                </div>
            </ResizableModal>
        </div>
    );
}
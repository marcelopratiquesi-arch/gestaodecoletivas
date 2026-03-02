import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { collection, getDocs } from 'firebase/firestore';

import { 
  Megaphone, Search, Users, MapPin, CheckSquare, Square, 
  Copy, Smartphone, FileSpreadsheet, Loader2, AlertCircle, 
  Tags, ChevronDown, Filter, Building2, Clock, MessageSquare, 
  Check, UserCog, Eraser, RefreshCw, GraduationCap, Crown
} from 'lucide-react';

// --- HELPERS E CONSTANTES GLOBAIS ---
const CACHE_TTL = 5 * 60 * 1000; 

const TURNOS_OPTIONS = [
    { id: 'manha', nome: 'Manhã (05:00 as 11:59)' },
    { id: 'tarde', nome: 'Tarde (12:00 as 17:59)' },
    { id: 'noite', nome: 'Noite (18:00 as 23:59)' }
];

const getFirstLast = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1]}`;
};

const getPrimeiroNome = (fullName) => {
    if (!fullName) return '';
    return fullName.trim().split(' ')[0];
};

const getSaudacao = () => {
    const hora = new Date().getHours();
    if (hora < 12) return "Bom dia";
    if (hora < 18) return "Boa tarde";
    return "Boa noite";
};

const formatarParaWaSeller = (telefoneRaw) => {
    if (!telefoneRaw) return null;
    const numeroLimpo = String(telefoneRaw).replace(/\D/g, '');
    if (numeroLimpo.length < 10) return null;
    return numeroLimpo.startsWith('55') ? numeroLimpo : `55${numeroLimpo}`;
};

// ============================================================================
// COMPONENTE: MULTI-SELECT COMPACTO E PROFISSIONAL
// ============================================================================
const MultiSelect = ({ label, options, selected, onChange, icon: Icon, searchable = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTxt, setSearchTxt] = useState('');
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTxt(''); 
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (id) => {
        if (selected.includes(id)) onChange(selected.filter(item => item !== id));
        else onChange([...selected, id]);
    };

    const filteredOptions = searchable && searchTxt
        ? options.filter(opt => opt.nome.toLowerCase().includes(searchTxt.toLowerCase()))
        : options;

    const isAllFilteredSelected = filteredOptions.length > 0 && filteredOptions.every(opt => selected.includes(opt.id));
    
    const toggleAll = () => {
        if (isAllFilteredSelected) {
            const filteredIds = filteredOptions.map(o => o.id);
            onChange(selected.filter(id => !filteredIds.includes(id)));
        } else {
            const newSelected = [...selected];
            filteredOptions.forEach(opt => {
                if (!newSelected.includes(opt.id)) newSelected.push(opt.id);
            });
            onChange(newSelected);
        }
    };

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 text-blue-500"/> {label}
            </label>
            <div 
                className="w-full min-h-[42px] px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-white cursor-pointer flex justify-between items-center hover:border-blue-400 transition-colors shadow-sm"
                onClick={() => { if (isOpen) { setIsOpen(false); setSearchTxt(''); } else { setIsOpen(true); } }}
            >
                <span className="truncate pr-4 uppercase">
                    {selected.length === 0 ? <span className="text-slate-400 font-normal">Todos selecionados</span> : <span className="font-bold text-blue-600">{selected.length} selecionado(s)</span>}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 flex flex-col overflow-hidden">
                    {searchable && (
                        <div className="p-2 border-b border-slate-100 dark:border-slate-700 shrink-0 bg-slate-50 dark:bg-slate-900/50">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                                <input type="text" placeholder="Buscar..." className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-md outline-none focus:border-blue-500 dark:text-white uppercase" value={searchTxt} onChange={(e) => setSearchTxt(e.target.value)} onClick={(e) => e.stopPropagation()} />
                            </div>
                        </div>
                    )}
                    
                    <div className="p-1.5 sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 z-10 shrink-0">
                        <button type="button" onClick={toggleAll} className="w-full text-left px-2 py-1.5 text-[10px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md flex items-center gap-1.5 transition-colors uppercase">
                            {isAllFilteredSelected ? <CheckSquare className="w-3.5 h-3.5"/> : <Square className="w-3.5 h-3.5"/>} Marcar Visíveis
                        </button>
                    </div>
                    
                    <div className="p-1 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar">
                        {filteredOptions.length === 0 ? (
                            <div className="text-center text-[10px] font-bold text-slate-400 py-3 uppercase">Nenhum resultado</div>
                        ) : (
                            filteredOptions.map(opt => {
                                const isSelected = selected.includes(opt.id);
                                return (
                                    <div key={opt.id} onClick={() => toggleOption(opt.id)} className={`flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                                        {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-blue-600"/> : <Square className="w-3.5 h-3.5 text-slate-300"/>}
                                        <span className={`text-xs truncate uppercase ${isSelected ? 'font-bold text-blue-700 dark:text-blue-400' : 'font-medium text-slate-600 dark:text-slate-300'}`}>{opt.nome}</span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// TELA PRINCIPAL
// ============================================================================
export default function CentralComunicacao() {
    const { userData } = useAuth();
    const role = String(userData?.role || "").trim().toLowerCase();
    const userId = userData?.id || userData?.uid;

    const [loadingDb, setLoadingDb] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [catalogs, setCatalogs] = useState({ unidades: [], modalidades: [], mentores: [] });
    
    // 🟢 ABAS DE NAVEGAÇÃO DE PÚBLICO
    const [publicoAlvo, setPublicoAlvo] = useState('professores'); // 'professores' | 'lideres' | 'mentores'
    const [resultadosBusca, setResultadosBusca] = useState([]);
    const [buscaRealizada, setBuscaRealizada] = useState(false);

    const cacheRef = useRef({ professores: null, aulas: null, timestamp: 0 });
    const buscaRef = useRef(0);

    const [copiado, setCopiado] = useState(false);
    const [filtrosNaBusca, setFiltrosNaBusca] = useState(null);
    const textareaRef = useRef(null);

    const [filtros, setFiltros] = useState({ estados: [], mentores: [], unidades: [], modalidades: [], turnos: [] });
    const { estados, mentores } = filtros;
    
    // Resetar unidades ao mudar Estado ou Mentor
    useEffect(() => { setFiltros(prev => ({ ...prev, unidades: [] })); }, [estados, mentores]);

    // Limpar tabela e filtros ao trocar a aba de público para evitar bugs cruzados
    useEffect(() => {
        setResultadosBusca([]);
        setBuscaRealizada(false);
        setFiltrosNaBusca(null);
        setFiltros({ estados: [], mentores: [], unidades: [], modalidades: [], turnos: [] });
    }, [publicoAlvo]);

    const resultadoDesatualizado = buscaRealizada && filtrosNaBusca !== JSON.stringify({...filtros, publicoAlvo});
    const [mensagem, setMensagem] = useState("Olá [PRIMEIRO_NOME], tudo bem?\n\nAqui é da gestão Pratique.");

    // CARREGAMENTO INICIAL
    useEffect(() => {
        if (role !== 'admin' && role !== 'mentor') return;
        let isMounted = true; 

        const fetchCatalogs = async () => {
            setLoadingDb(true);
            try {
                const [uniSnap, modSnap, userSnap] = await Promise.all([
                    getDocs(collection(db, 'unidades')),
                    getDocs(collection(db, 'modalidades')),
                    getDocs(collection(db, 'usuarios'))
                ]);
                if (!isMounted) return;

                let unidadesData = uniSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (role === 'mentor') unidadesData = unidadesData.filter(u => u.mentorId === userId);

                const mentoresData = userSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role === 'mentor');

                setCatalogs({
                    unidades: unidadesData,
                    modalidades: modSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                    mentores: mentoresData
                });
            } catch (error) { console.error("Erro ao carregar dados:", error); } 
            finally { if (isMounted) setLoadingDb(false); }
        };
        fetchCatalogs();
        return () => { isMounted = false; };
    }, [role, userId]);

    // OPÇÕES DE FILTROS DINÂMICOS
    const estadosOptions = useMemo(() => [...new Set(catalogs.unidades.map(u => u.estado).filter(Boolean))].sort().map(s => ({ id: s, nome: s })), [catalogs.unidades]);
    const mentoresOptions = useMemo(() => catalogs.mentores.map(m => ({ id: m.id, nome: m.nome })).sort((a,b) => a.nome.localeCompare(b.nome)), [catalogs.mentores]);
    const unidadesOptions = useMemo(() => {
        let filtradas = catalogs.unidades;
        if (filtros.estados.length > 0) filtradas = filtradas.filter(u => filtros.estados.includes(u.estado));
        if (filtros.mentores.length > 0) filtradas = filtradas.filter(u => filtros.mentores.includes(u.mentorId));
        return filtradas.map(u => ({ id: u.id, nome: u.nome })).sort((a,b) => a.nome.localeCompare(b.nome));
    }, [catalogs.unidades, filtros.estados, filtros.mentores]);
    const modalidadesOptions = useMemo(() => catalogs.modalidades.map(m => ({ id: m.id, nome: m.nome })).sort((a,b) => a.nome.localeCompare(b.nome)), [catalogs.modalidades]);

    const limparFiltros = (forcarRefresh = false) => {
        if (forcarRefresh) cacheRef.current = { professores: null, aulas: null, timestamp: 0 };
        setFiltros({ estados: [], mentores: [], unidades: [], modalidades: [], turnos: [] });
        setBuscaRealizada(false);
        setResultadosBusca([]);
        setFiltrosNaBusca(null);
    };

    // 🟢 MOTOR DE BUSCA: PROCESSA O PÚBLICO CORRETO
    const buscarPublico = async () => {
        const currentBuscaId = ++buscaRef.current; 
        setProcessing(true);

        try {
            let resultados = [];

            if (publicoAlvo === 'professores') {
                const agora = Date.now();
                const cacheValido = (agora - cacheRef.current.timestamp) < CACHE_TTL;
                let todosProfessores, todasAulas;

                if (cacheValido && cacheRef.current.professores && cacheRef.current.aulas) {
                    todosProfessores = cacheRef.current.professores;
                    todasAulas = cacheRef.current.aulas;
                } else {
                    const [profsSnap, aulasSnap] = await Promise.all([getDocs(collection(db, 'professores')), getDocs(collection(db, 'aulas'))]);
                    todosProfessores = profsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    todasAulas = aulasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    cacheRef.current = { professores: todosProfessores, aulas: todasAulas, timestamp: agora };
                }

                const modMap = {}; catalogs.modalidades.forEach(m => modMap[m.id] = m.nome);
                const uniMap = {}; catalogs.unidades.forEach(u => uniMap[u.id] = u);
                const relacaoProfessor = {};

                todasAulas.forEach(aula => {
                    let turnoAula = 'manha';
                    const horaInt = parseInt(aula.hora?.split(':')[0] || '0', 10); 
                    if (horaInt >= 12 && horaInt < 18) turnoAula = 'tarde';
                    if (horaInt >= 18) turnoAula = 'noite';

                    const unidade = uniMap[aula.unidadeId];
                    if (!unidade) return;

                    const passaEstado = filtros.estados.length === 0 || filtros.estados.includes(unidade.estado);
                    const passaMentor = filtros.mentores.length === 0 || filtros.mentores.includes(unidade.mentorId);
                    const passaUnidade = filtros.unidades.length === 0 || filtros.unidades.includes(aula.unidadeId);
                    const passaModalidade = filtros.modalidades.length === 0 || filtros.modalidades.includes(aula.modalidadeId);
                    const passaTurno = filtros.turnos.length === 0 || filtros.turnos.includes(turnoAula);

                    if (passaEstado && passaMentor && passaUnidade && passaModalidade && passaTurno) {
                        if (!relacaoProfessor[aula.professorId]) relacaoProfessor[aula.professorId] = { modalidades: new Set(), unidades: new Set() };
                        if (aula.modalidadeId) relacaoProfessor[aula.professorId].modalidades.add(modMap[aula.modalidadeId] || 'Geral');
                        if (unidade.nome) relacaoProfessor[aula.professorId].unidades.add(unidade.nome);
                    }
                });

                const profMap = new Map(todosProfessores.map(p => [String(p.id), p]));
                Object.keys(relacaoProfessor).forEach(profId => {
                    const profData = profMap.get(profId); 
                    const phoneFinal = formatarParaWaSeller(profData?.telefone);
                    if (phoneFinal) {
                        resultados.push({
                            id: profData.id,
                            nome: profData.nome,
                            telefoneFormatado: phoneFinal,
                            detalhe1: Array.from(relacaoProfessor[profId].modalidades).join(', '),
                            detalhe2: Array.from(relacaoProfessor[profId].unidades).join(', ')
                        });
                    }
                });
            } 
            else if (publicoAlvo === 'lideres') {
                let units = catalogs.unidades;
                if (filtros.estados.length > 0) units = units.filter(u => filtros.estados.includes(u.estado));
                if (filtros.mentores.length > 0) units = units.filter(u => filtros.mentores.includes(u.mentorId));
                
                units.forEach(u => {
                    const phoneFinal = formatarParaWaSeller(u.telefone);
                    if (phoneFinal) {
                        resultados.push({
                            id: u.id,
                            nome: u.nome, // Aqui passamos o nome completo da unidade
                            telefoneFormatado: phoneFinal,
                            detalhe1: `LÍDER DE UNIDADE`,
                            detalhe2: u.estado || 'ESTADO NÃO DEFINIDO'
                        });
                    }
                });
            }
            else if (publicoAlvo === 'mentores' && role === 'admin') {
                let mentoresValidos = catalogs.mentores;
                if (filtros.estados.length > 0) {
                    const mentorIdsAtivosNosEstados = new Set(catalogs.unidades.filter(u => filtros.estados.includes(u.estado)).map(u => u.mentorId));
                    mentoresValidos = mentoresValidos.filter(m => mentorIdsAtivosNosEstados.has(m.id));
                }

                mentoresValidos.forEach(m => {
                    const phoneFinal = formatarParaWaSeller(m.telefone || m.phone);
                    if (phoneFinal) {
                        resultados.push({
                            id: m.id,
                            nome: m.nome,
                            telefoneFormatado: phoneFinal,
                            detalhe1: 'MENTOR REGIONAL',
                            detalhe2: 'GESTÃO PRATIQUE'
                        });
                    }
                });
            }

            if (currentBuscaId === buscaRef.current) {
                setResultadosBusca(resultados.sort((a, b) => a.nome.localeCompare(b.nome)));
                setBuscaRealizada(true);
                setFiltrosNaBusca(JSON.stringify({...filtros, publicoAlvo})); 
            }

        } catch (error) {
            console.error("Erro ao cruzar dados:", error);
            alert("Erro ao processar a lista. Tente novamente.");
        } finally {
            if (currentBuscaId === buscaRef.current) setProcessing(false);
        }
    };

    // 🟢 MENSAGEM DINÂMICA: RESPEITA O NOME COMPLETO DO LÍDER (UNIDADE)
    const gerarMensagemFinal = (alvo, template) => {
        let msg = template;
        
        const nomeParaMensagem = publicoAlvo === 'lideres' ? alvo.nome : getPrimeiroNome(alvo.nome);
        const nomeCompletoParaMensagem = publicoAlvo === 'lideres' ? alvo.nome : getFirstLast(alvo.nome);

        msg = msg.replace(/\[NOME_COMPLETO\]/g, nomeCompletoParaMensagem.toUpperCase());
        msg = msg.replace(/\[PRIMEIRO_NOME\]/g, nomeParaMensagem.toUpperCase());
        msg = msg.replace(/\[SAUDACAO\]/g, getSaudacao().toUpperCase());
        msg = msg.replace(/\[MODALIDADES\]/g, alvo.detalhe1 ? alvo.detalhe1.toUpperCase() : "");
        msg = msg.replace(/\[UNIDADES\]/g, alvo.detalhe2 ? alvo.detalhe2.toUpperCase() : "");
        return msg;
    };

    const addTag = (tag) => {
        const el = textareaRef.current;
        if (!el) { setMensagem(prev => prev + ` ${tag} `); return; }
        const start = el.selectionStart;
        const end = el.selectionEnd;
        setMensagem(mensagem.substring(0, start) + ` ${tag} ` + mensagem.substring(end, mensagem.length));
        setTimeout(() => { el.focus(); el.setSelectionRange(start + tag.length + 2, start + tag.length + 2); }, 0);
    };

    // 🟢 EXPORTAÇÃO CORRIGIDA: LÍDER EXPORTA NOME COMPLETO
    const copiarParaDisparador = async () => {
        if (resultadosBusca.length === 0) return;
        const text = resultadosBusca.map(p => {
            const nomeExport = publicoAlvo === 'lideres' ? p.nome : getPrimeiroNome(p.nome);
            return `${p.telefoneFormatado}\t${nomeExport}`;
        }).join('\n');
        
        try {
            await navigator.clipboard.writeText(text);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 3000);
        } catch (err) { alert("❌ Permissão negada. Use o botão Baixar CSV."); }
    };

    const exportarCSV = () => {
        if (resultadosBusca.length === 0) return;
        const headers = "Telefone,Nome\n";
        const rows = resultadosBusca.map(p => {
            const nomeExport = publicoAlvo === 'lideres' ? p.nome.toUpperCase() : getPrimeiroNome(p.nome).toUpperCase();
            return `"${p.telefoneFormatado}","${nomeExport}"`;
        }).join("\n");
        
        const blob = new Blob(["\uFEFF" + headers + rows], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `Contatos_${publicoAlvo.toUpperCase()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const dispararIndividual = (alvo) => {
        const msg = gerarMensagemFinal(alvo, mensagem);
        window.open(`https://api.whatsapp.com/send?phone=${alvo.telefoneFormatado}&text=${encodeURIComponent(msg)}`, '_blank');
    };

    if (role !== 'admin' && role !== 'mentor') {
        return <div className="p-10 text-center text-slate-500 font-bold uppercase tracking-widest text-sm">Acesso Restrito: Apenas Gestão.</div>;
    }

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in space-y-6">
            
            {/* HEADER DA PÁGINA */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 dark:border-slate-700 pb-4 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3 uppercase">
                        <span className="bg-slate-800 text-white p-1.5 rounded-lg shadow-sm">
                            <Megaphone className="w-5 h-5" />
                        </span>
                        Central de Comunicação
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 font-bold text-[11px] uppercase tracking-widest">Segmente e extraia listas para o WaSeller</p>
                </div>
            </div>

            {/* 🟢 SEGMENTED CONTROL: ABAS ELEGANTES E COMPACTAS NO TOPO */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl w-full sm:w-fit shadow-inner">
                <button 
                    onClick={() => setPublicoAlvo('professores')} 
                    className={`flex-1 sm:flex-none px-6 py-2 text-xs font-black uppercase rounded-lg flex items-center justify-center gap-2 transition-all ${publicoAlvo === 'professores' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <GraduationCap className="w-4 h-4"/> Professores
                </button>
                <button 
                    onClick={() => setPublicoAlvo('lideres')} 
                    className={`flex-1 sm:flex-none px-6 py-2 text-xs font-black uppercase rounded-lg flex items-center justify-center gap-2 transition-all ${publicoAlvo === 'lideres' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Building2 className="w-4 h-4"/> Líderes (Unidades)
                </button>
                {role === 'admin' && (
                    <button 
                        onClick={() => setPublicoAlvo('mentores')} 
                        className={`flex-1 sm:flex-none px-6 py-2 text-xs font-black uppercase rounded-lg flex items-center justify-center gap-2 transition-all ${publicoAlvo === 'mentores' ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Crown className="w-4 h-4"/> Mentores
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* COLUNA ESQUERDA: FILTROS DINÂMICOS */}
                <div className="lg:col-span-4 space-y-5">
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h2 className="font-black text-slate-800 dark:text-white uppercase flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-3 mb-4 text-xs tracking-widest">
                            <Filter className="w-4 h-4 text-blue-500"/> 1. Refine a Busca
                        </h2>
                        
                        {loadingDb ? (
                            <div className="flex justify-center py-6 text-slate-400"><Loader2 className="w-5 h-5 animate-spin"/></div>
                        ) : (
                            <div className="space-y-4">
                                <MultiSelect label="ESTADOS (REGIONAL)" options={estadosOptions} selected={filtros.estados} onChange={v => setFiltros({...filtros, estados: v})} icon={MapPin} />
                                
                                {(publicoAlvo === 'professores' || publicoAlvo === 'lideres') && role === 'admin' && (
                                    <MultiSelect label="MENTORES (REDE)" options={mentoresOptions} selected={filtros.mentores} onChange={v => setFiltros({...filtros, mentores: v})} icon={UserCog} searchable={true} />
                                )}

                                {publicoAlvo === 'professores' && (
                                    <>
                                        <MultiSelect label="UNIDADES" options={unidadesOptions} selected={filtros.unidades} onChange={v => setFiltros({...filtros, unidades: v})} icon={Building2} searchable={true} />
                                        <MultiSelect label="MODALIDADES" options={modalidadesOptions} selected={filtros.modalidades} onChange={v => setFiltros({...filtros, modalidades: v})} icon={Users} searchable={true} />
                                        <MultiSelect label="TURNOS" options={TURNOS_OPTIONS} selected={filtros.turnos} onChange={v => setFiltros({...filtros, turnos: v})} icon={Clock} />
                                    </>
                                )}

                                <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-700 mt-2">
                                    <button onClick={() => limparFiltros(false)} className="w-[30%] py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[10px] uppercase rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm">
                                        <Eraser className="w-3.5 h-3.5"/> Limpar
                                    </button>
                                    <button onClick={buscarPublico} disabled={processing} className="w-[70%] bg-slate-800 hover:bg-blue-600 text-white font-black text-[11px] uppercase tracking-widest py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50">
                                        {processing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>} Processar Lista
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* COLUNA DIREITA: MENSAGEM E TABELA */}
                <div className="lg:col-span-8 space-y-5">
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h2 className="font-black text-slate-800 dark:text-white uppercase flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-3 mb-4 text-xs tracking-widest">
                            <MessageSquare className="w-4 h-4 text-green-500"/> 2. Rascunho da Mensagem
                        </h2>
                        
                        <div className="mb-3">
                            <div className="flex flex-wrap gap-2">
                                {[ { tag: '[PRIMEIRO_NOME]', label: 'Nome / Unidade' }, { tag: '[SAUDACAO]', label: 'Bom dia/tarde' }].map(t => (
                                    <button key={t.tag} onClick={() => addTag(t.tag)} className="bg-slate-50 hover:bg-blue-50 text-slate-600 text-[10px] font-bold uppercase px-3 py-1.5 rounded-md flex items-center gap-1.5 border border-slate-200 transition-colors shadow-sm">
                                        <Tags className="w-3 h-3 text-blue-500"/> {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <textarea ref={textareaRef} className="w-full h-28 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white font-medium focus:border-blue-500 outline-none resize-none custom-scrollbar" value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Digite sua mensagem aqui..."></textarea>
                    </div>

                    {resultadoDesatualizado && (
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 shadow-sm animate-in fade-in">
                            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                            <div>
                                <h3 className="text-xs font-black text-amber-800 uppercase tracking-tight">Filtros Alterados</h3>
                                <p className="text-[10px] text-amber-700 mt-0.5 font-bold uppercase tracking-widest">A lista abaixo pode estar desatualizada. Clique em "Processar Lista".</p>
                            </div>
                        </div>
                    )}

                    {buscaRealizada && (
                        <div className={`bg-white dark:bg-slate-800 rounded-2xl border shadow-sm overflow-hidden transition-all duration-300 ${resultadoDesatualizado ? 'border-amber-300 opacity-60' : 'border-slate-200 dark:border-slate-700'}`}>
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h2 className="font-black text-slate-800 dark:text-white uppercase flex items-center gap-2 text-xs tracking-widest">
                                        <Users className="w-4 h-4 text-indigo-500"/> 3. Lista Final ({publicoAlvo})
                                    </h2>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">
                                        {resultadosBusca.length} CONTATOS VÁLIDOS
                                    </p>
                                </div>
                                
                                <div className="flex gap-2 w-full md:w-auto">
                                    <button onClick={exportarCSV} disabled={resultadoDesatualizado} className="flex-1 md:flex-none px-4 py-2 bg-white border border-slate-200 text-emerald-600 hover:bg-emerald-50 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50">
                                        <FileSpreadsheet className="w-3.5 h-3.5"/> Baixar CSV
                                    </button>
                                    <button onClick={copiarParaDisparador} disabled={resultadoDesatualizado} className={`flex-1 md:flex-none px-4 py-2 text-white rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50 ${copiado ? 'bg-green-500' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                                        {copiado ? <Check className="w-3.5 h-3.5"/> : <Copy className="w-3.5 h-3.5"/>} 
                                        {copiado ? 'COPIADO! ✅' : 'COPIAR (WASELLER)'}
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto max-h-[350px] custom-scrollbar">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-white dark:bg-slate-700 text-slate-400 font-black uppercase text-[9px] tracking-widest sticky top-0 z-10 border-b border-slate-100">
                                        <tr>
                                            <th className="p-3 pl-5">{publicoAlvo === 'professores' ? 'Professor' : publicoAlvo === 'lideres' ? 'Unidade' : 'Mentor'}</th>
                                            <th className="p-3">{publicoAlvo === 'professores' ? 'Modalidades' : 'Perfil'}</th>
                                            <th className="p-3">WhatsApp</th>
                                            <th className="p-3 pr-5 text-center">Teste Rápido</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                        {resultadosBusca.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                                                    Nenhum contato encontrado.
                                                </td>
                                            </tr>
                                        ) : (
                                            resultadosBusca.map((p) => (
                                                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                    <td className="p-3 pl-5">
                                                        <div className="font-bold text-slate-800 dark:text-slate-200 uppercase text-xs">{p.nome}</div>
                                                        {publicoAlvo === 'professores' && <div className="text-[9px] font-medium text-slate-400 uppercase mt-0.5">{p.detalhe2}</div>}
                                                    </td>
                                                    <td className="p-3 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">{p.detalhe1}</td>
                                                    <td className="p-3 font-mono font-medium text-xs text-slate-500">{p.telefoneFormatado}</td>
                                                    <td className="p-3 pr-5 text-center">
                                                        <button onClick={() => dispararIndividual(p)} className="p-1.5 bg-slate-100 text-slate-600 hover:bg-green-500 hover:text-white rounded-md transition-colors inline-flex items-center gap-1.5 shadow-sm font-bold text-[9px] uppercase border border-slate-200 hover:border-transparent">
                                                            <Smartphone className="w-3.5 h-3.5"/> Enviar
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
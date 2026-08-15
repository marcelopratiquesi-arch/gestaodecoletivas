import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Calendar, Clock, Plus, Filter, 
  Search, Trash2, Edit2, X, Check, 
  MapPin, Loader2, AlertTriangle, Users,
  DollarSign, Globe, ChevronRight, List, ChevronDown, User, CalendarDays, EyeOff, History, ArrowRightLeft 
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext'; 
import { db } from '../../services/firebase'; 
import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp, onSnapshot 
} from 'firebase/firestore';
import { useTranslation } from "react-i18next"; // 🟢 MOTOR ACIONADO

// --- FUNÇÕES UTILITÁRIAS ---
const getTodayStr = () => new Date().toLocaleDateString('en-CA');

const formatFirstLastName = (fullName, defaultName) => {
  if (!fullName) return defaultName;
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
};

const getContrastColor = (hexColor) => {
  if (!hexColor) return '#000000';
  let hex = hexColor.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) return '#000000';
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? '#1e293b' : '#ffffff';
};

// 🟢 FUNÇÃO INTELIGENTE DE MOEDA
const getMoedaSymbol = (pais) => {
    if (pais === "AR" || pais === "Argentina") return "$ ARS";
    if (pais === "US" || pais === "Estados Unidos") return "$ USD";
    return "R$";
};

// --- COMPONENTES VISUAIS ---

const ClassCard = ({ data, onClick, isReadOnly, defaultTeacher, t }) => {
  const textColor = getContrastColor(data.modalidadeCor || '#E6332A');
  const isEncerrada = data.dataFim && data.dataFim < getTodayStr();

  return (
    <div 
      onClick={!isReadOnly ? onClick : undefined}
      style={{ backgroundColor: data.modalidadeCor || '#E6332A' }}
      className={`group relative mb-2 p-2 rounded-lg shadow-sm transition-all duration-200 overflow-hidden flex flex-col items-center justify-center min-h-[70px] text-center w-full 
      ${!isReadOnly ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02]' : 'cursor-default'} 
      ${isEncerrada ? 'opacity-40 grayscale border-2 border-dashed border-slate-900' : ''}`}
      title={isEncerrada ? t('schedulePage.closedClassTitle', 'Aula Encerrada (Apenas Histórico)') : t('schedulePage.activeClassTitle', 'Aula Ativa')}
    >
      <h4 style={{ color: textColor }} className="font-black text-[10px] uppercase tracking-wide leading-tight w-full break-words">
        {data.modalidadeNome}
      </h4>
      <div className="flex items-center gap-1 mt-1 opacity-90">
        <Users className="w-3 h-3" style={{ color: textColor }} />
        <span style={{ color: textColor }} className="text-[9px] font-bold uppercase truncate max-w-[120px]">
          {formatFirstLastName(data.professorNome, defaultTeacher)}
        </span>
      </div>
      {!isReadOnly && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-white/30 backdrop-blur-md p-1 rounded hover:bg-white/50" style={{ color: textColor }}>
            <Edit2 className="w-3 h-3" />
          </div>
        </div>
      )}
    </div>
  );
};

const GlobalUnitBlock = ({ unitName, classes, isReadOnly, onEdit, t }) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow mb-6">
      <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <h4 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2.5">
          <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
             <MapPin className="w-5 h-5 text-red-600"/>
          </div>
          {unitName}
        </h4>
        <span className="text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full">
          {classes.length} {t('publicSchedule.schedules', 'horários')}
        </span>
      </div>
      
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {classes.map(aula => {
          const isEncerrada = aula.dataFim && aula.dataFim < getTodayStr();
          const diasTraduzidos = (aula.dias || []).map(d => t('publicSchedule.days.' + d, d)).join(', ');

          return (
            <div 
              key={aula.id} 
              onClick={() => !isReadOnly && onEdit(aula)} 
              className={`px-6 py-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group ${!isReadOnly ? 'cursor-pointer' : ''} ${isEncerrada ? 'opacity-50 grayscale' : ''}`}
            >
              <div className="flex-shrink-0 md:w-24">
                 <div className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-mono font-bold text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center gap-2 shadow-sm">
                    <Clock className="w-4 h-4 text-red-500"/>
                    {aula.hora}
                 </div>
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-center">
                 <h5 className="font-black text-slate-800 dark:text-white text-base truncate flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: aula.modalidadeCor || '#ccc' }}></div>
                    {aula.modalidadeNome}
                    {isEncerrada && <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase tracking-wide font-bold">{t('schedulePage.closedBadge', 'Encerrada')}</span>}
                 </h5>
                 <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wide mt-1">
                    <Calendar className="w-3.5 h-3.5"/>
                    {diasTraduzidos}
                 </div>
              </div>

              <div className="flex items-center gap-3 md:w-1/4 border-l border-transparent md:border-slate-100 md:dark:border-slate-700 md:pl-4">
                 <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 border border-slate-200 dark:border-slate-600">
                    <User className="w-4 h-4"/>
                 </div>
                 <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-slate-400">{t('publicSchedule.defaultTeacher', 'Instrutor')}</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{formatFirstLastName(aula.professorNome, t('publicSchedule.defaultTeacher', 'Instrutor'))}</p>
                 </div>
              </div>

              {!isReadOnly && (
                 <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 pl-2">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                      <Edit2 className="w-4 h-4"/>
                    </div>
                 </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
};

export default function CronogramaPage() {
  const { userData } = useAuth();
  const { t } = useTranslation(); // 🟢 MOTOR ACIONADO
  
  // --- PERMISSÕES ---
  const role = useMemo(() => String(userData?.role || "").trim().toLowerCase(), [userData?.role]);
  const userId = useMemo(() => userData?.id || userData?.uid, [userData]);
  const isReadOnly = role === 'professor';

  // --- DADOS GLOBAIS E DE TELA ---
  const [catalogs, setCatalogs] = useState({ unidades: [], modalidades: [], professores: [], vinculos: [] });
  const [aulas, setAulas] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // --- FILTROS ---
  const [availableUnits, setAvailableUnits] = useState([]); 
  const [uniqueStates, setUniqueStates] = useState([]); 
  const [selectedState, setSelectedState] = useState(""); 
  const [selectedUnit, setSelectedUnit] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  
  // --- ESTADOS DO MODAL E VISUALIZAÇÃO ---
  const [mostrarEncerradas, setMostrarEncerradas] = useState(false); 
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);

  // 🟢 ESTADO DO MOTOR DE TRANSIÇÃO (CÉREBRO TEMPORAL)
  const [pendingSplit, setPendingSplit] = useState(null);
  const [dataCorteTransicao, setDataCorteTransicao] = useState("");

  const [formData, setFormData] = useState({
    unidadeId: '', modalidadeId: '', professorId: '', hora: '07:00', valor: '', dias: [],
    dataInicio: getTodayStr(), dataFim: '' 
  });

  const allDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  useEffect(() => {
      const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
      return () => clearTimeout(timer);
  }, [searchTerm]);

  // 1. CARREGAMENTO DOS CATÁLOGOS
  useEffect(() => {
    const fetchCatalogs = async () => {
      try {
        setLoading(true);
        const [unitsSnap, modsSnap, profsSnap, vinculosSnap] = await Promise.all([
          getDocs(collection(db, 'unidades')),
          getDocs(collection(db, 'modalidades')),
          getDocs(collection(db, 'professores')),
          getDocs(collection(db, 'vinculos')) 
        ]);

        let finalUnidades = unitsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        finalUnidades.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        const states = [...new Set(finalUnidades.map(u => u.estado).filter(Boolean))].sort();
        setUniqueStates(states);

        const todosProfessores = profsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const todosVinculos = vinculosSnap.docs.map(d => ({
            id: d.id, ...d.data(),
            professorId: String(d.data().professorId),
            unidadeId: String(d.data().unidadeId),
            status: d.data().status || 'ativo'
        })).filter(v => v.status === 'ativo');

        // Aplicando ACL
        let unitsToShow = [];
        if (role === 'admin') unitsToShow = finalUnidades;
        else if (role === 'mentor') unitsToShow = finalUnidades.filter(u => u.mentorId === userId);
        else if (role === 'unidade') unitsToShow = finalUnidades.filter(u => u.id === userData.unidadeId);
        else if (role === 'professor') {
            const meuPerfil = todosProfessores.find(p => p.uidLogin === userId);
            if (meuPerfil) {
                const meusLinks = todosVinculos.filter(v => v.professorId === String(meuPerfil.id));
                const minhasUnidadesIds = meusLinks.map(v => v.unidadeId);
                unitsToShow = finalUnidades.filter(u => minhasUnidadesIds.includes(String(u.id)));
            }
        }

        setCatalogs({ unidades: finalUnidades, modalidades: modsSnap.docs.map(d => ({ id: d.id, ...d.data() })), professores: todosProfessores, vinculos: todosVinculos });
        setAvailableUnits(unitsToShow);

        if (unitsToShow.length > 0 && !selectedUnit) {
            if(unitsToShow.length === 1) setSelectedUnit(unitsToShow[0].id);
        }

      } catch (error) { 
          console.error("Erro no load inicial:", error); 
      } finally { 
          setLoading(false); 
      }
    };
    fetchCatalogs();
  }, [role, userId, userData]); 

  // 2. MOTOR DE TEMPO REAL DAS AULAS (COM FILTRO DA LIXEIRA OCULTA)
  useEffect(() => {
    let qAulas;
    
    if (selectedUnit) {
      qAulas = query(collection(db, 'aulas'), where('unidadeId', '==', selectedUnit));
    } 
    else if (!selectedUnit && debouncedSearchTerm.length > 1) {
      const unitIds = availableUnits.map(u => u.id);
      if(unitIds.length > 0) {
          qAulas = query(collection(db, 'aulas')); 
      } else {
          setAulas([]);
          return;
      }
    } else {
      setAulas([]);
      return;
    }

    const unsubscribe = onSnapshot(qAulas, (snap) => {
        // Ignora qualquer aula que tenha a tag { excluido: true }
        const aulasData = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(aula => aula.excluido !== true); 
          
        setAulas(aulasData);
    });

    return () => unsubscribe();
  }, [selectedUnit, debouncedSearchTerm, availableUnits]);

  // 3. PROCESSADOR VISUAL DA TELA
  const filteredClasses = useMemo(() => {
    let classes = aulas;

    if (!selectedUnit) {
        const allowedIds = availableUnits.map(u => u.id);
        classes = classes.filter(c => allowedIds.includes(String(c.unidadeId)));
    }

    if (!mostrarEncerradas) {
        const today = getTodayStr();
        classes = classes.filter(c => !(c.dataFim && c.dataFim < today));
    }

    return classes.map(c => {
      const mod = catalogs.modalidades.find(m => String(m.id) === String(c.modalidadeId));
      const prof = catalogs.professores.find(p => String(p.id) === String(c.professorId));
      const uni = catalogs.unidades.find(u => String(u.id) === String(c.unidadeId));
      
      return {
        ...c,
        modalidadeNome: mod?.nome || 'Desconhecido',
        modalidadeCor: mod?.cor || '#9ca3af',
        professorNome: prof?.nome || t('publicSchedule.defaultTeacher', 'Sem Professor'),
        unidadeNome: uni?.nome || 'Unidade Desconhecida'
      };
    }).filter(c => {
      if (!debouncedSearchTerm) return true;
      const term = debouncedSearchTerm.toLowerCase();
      return (c.modalidadeNome.toLowerCase().includes(term) || c.professorNome.toLowerCase().includes(term));
    });
  }, [selectedUnit, debouncedSearchTerm, aulas, catalogs, availableUnits, mostrarEncerradas, t]);

  const visibleDays = useMemo(() => {
    const defaultDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']; 
    const hasSaturday = filteredClasses.some(c => c.dias && c.dias.includes('Sábado'));
    const hasSunday = filteredClasses.some(c => c.dias && c.dias.includes('Domingo'));

    const result = [...defaultDays];
    if (hasSaturday) result.push('Sábado');
    if (hasSunday) result.push('Domingo');
    return result;
  }, [filteredClasses]);

  const groupedClasses = useMemo(() => {
      if (selectedUnit) return [];
      const groups = {};
      filteredClasses.forEach(cls => {
          if (!groups[cls.unidadeId]) { groups[cls.unidadeId] = { unidadeNome: cls.unidadeNome, aulas: [] }; }
          groups[cls.unidadeId].aulas.push(cls);
      });
      return Object.values(groups).sort((a,b) => a.unidadeNome.localeCompare(b.unidadeNome));
  }, [filteredClasses, selectedUnit]);

  const activeTimeSlots = useMemo(() => {
    const times = new Set(filteredClasses.map(c => c.hora));
    return Array.from(times).sort();
  }, [filteredClasses]);

  const filteredUnitsDropdown = useMemo(() => {
      if (!selectedState) return availableUnits;
      return availableUnits.filter(u => u.estado === selectedState);
  }, [availableUnits, selectedState]);


  // 🟢 DESCOBRIR MOEDA DA UNIDADE SELECIONADA NO MODAL
  const modalCurrencySymbol = useMemo(() => {
      if (!formData.unidadeId) return "R$";
      const unit = catalogs.unidades.find(u => String(u.id) === String(formData.unidadeId));
      if (!unit) return "R$";
      return getMoedaSymbol(unit.pais);
  }, [formData.unidadeId, catalogs.unidades]);


  // ==========================================
  // 4. AÇÕES DO MODAL E MOTOR DE AUDITORIA X-9 ("DE -> PARA")
  // ==========================================

  const buildEstadoCompleto = (aulaData) => {
      if (!aulaData) return null;
      const uni = catalogs.unidades.find(u => u.id === aulaData.unidadeId)?.nome || 'Unidade Desconhecida';
      const mod = catalogs.modalidades.find(m => m.id === aulaData.modalidadeId)?.nome || 'Modalidade Desconhecida';
      const prof = catalogs.professores.find(p => p.id === aulaData.professorId)?.nome || 'Professor Desconhecido';
      
      return {
          unidade: uni,
          modalidade: mod,
          professor: prof,
          hora: aulaData.hora || '',
          dias: [...(aulaData.dias || [])].sort().join(', '),
          valor: aulaData.valor ? parseFloat(aulaData.valor) : 0,
          dataInicio: aulaData.dataInicio || '',
          dataFim: aulaData.dataFim || 'N/A'
      };
  };

  const registrarLogAuditoria = async (tipoAcao, descricao, diffExtras = "", estadoAnterior = null, estadoNovo = null) => {
    try {
        const nomeUsuario = userData?.nome || userData?.email || 'Administrador do Sistema';
        const ref = estadoNovo || estadoAnterior || {};

        await addDoc(collection(db, 'auditoria_cronograma'), {
            tipoAcao,
            descricao,
            diffExtras,
            estadoAnterior, 
            estadoNovo,     
            modulo: 'CRONOGRAMA', 
            
            unidadeNome: ref.unidade || 'Unidade Desconhecida',
            modalidadeNome: ref.modalidade || 'Modalidade Desconhecida',
            professorNome: ref.professor || 'Professor Desconhecido',
            dias: ref.dias ? (typeof ref.dias === 'string' ? ref.dias.split(', ') : ref.dias) : [],
            hora: ref.hora || '',
            valor: ref.valor || 0,
            
            usuarioAcaoNome: nomeUsuario,
            usuarioAcaoId: userId,
            dataAcao: serverTimestamp()
        });
    } catch (e) { console.error("Erro ao gerar log de auditoria", e); }
  };

  const handleFirstSaveClick = (e) => {
    e.preventDefault();
    if (isReadOnly || saving) return; 

    if (!formData.unidadeId || !formData.modalidadeId || !formData.professorId || !formData.hora || formData.dias.length === 0 || !formData.dataInicio) {
        return alert(t('schedulePage.alerts.fillRequired', "❌ Preencha todos os campos obrigatórios."));
    }
    if (formData.dataFim && formData.dataInicio > formData.dataFim) {
        return alert(t('schedulePage.alerts.invalidDates', "❌ A data de encerramento não pode ser anterior à data de início."));
    }

    const payload = {
        unidadeId: formData.unidadeId, modalidadeId: formData.modalidadeId, professorId: formData.professorId,
        hora: formData.hora, valor: formData.valor ? parseFloat(formData.valor) : 0, 
        dias: formData.dias, dataInicio: formData.dataInicio, dataFim: formData.dataFim || null,
        excluido: false 
    };

    if (editingClass) {
        const diasAntigos = [...(editingClass.dias || [])].sort();
        const diasNovos = [...formData.dias].sort();
        const valorAntigo = editingClass.valor ? parseFloat(editingClass.valor) : 0;
        const valorNovo = formData.valor ? parseFloat(formData.valor) : 0;

        let mudancas = [];
        
        if (editingClass.professorId !== formData.professorId) {
            const pAntigo = catalogs.professores.find(p => p.id === editingClass.professorId)?.nome || 'Sem Prof';
            const pNovo = catalogs.professores.find(p => p.id === formData.professorId)?.nome || 'Sem Prof';
            mudancas.push(`Prof: ${pAntigo} ➔ ${pNovo}`);
        }
        if (editingClass.modalidadeId !== formData.modalidadeId) {
            const mAntigo = catalogs.modalidades.find(m => m.id === editingClass.modalidadeId)?.nome || 'Desconhecida';
            const mNovo = catalogs.modalidades.find(m => m.id === formData.modalidadeId)?.nome || 'Desconhecida';
            mudancas.push(`Modalidade: ${mAntigo} ➔ ${mNovo}`);
        }
        if (valorAntigo !== valorNovo) mudancas.push(`Valor: ${modalCurrencySymbol} ${valorAntigo} ➔ ${modalCurrencySymbol} ${valorNovo}`);
        if (editingClass.hora !== formData.hora) mudancas.push(`Hora: ${editingClass.hora} ➔ ${formData.hora}`);
        
        const diasAdicionados = diasNovos.filter(d => !diasAntigos.includes(d));
        const diasRemovidos = diasAntigos.filter(d => !diasNovos.includes(d));
        if (diasAdicionados.length > 0 || diasRemovidos.length > 0) {
            let diasTexto = [];
            if (diasAdicionados.length > 0) diasTexto.push(`+ ${diasAdicionados.join(', ')}`);
            if (diasRemovidos.length > 0) diasTexto.push(`- ${diasRemovidos.join(', ')}`);
            mudancas.push(`Dias: ${diasTexto.join(' e ')}`);
        }

        if (mudancas.length > 0) {
            let defaultDate = getTodayStr();
            if (new Date().getHours() >= 12) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                defaultDate = tomorrow.toLocaleDateString('en-CA');
            }
            setDataCorteTransicao(defaultDate);
            setPendingSplit({ payload, mudancas });
            return;
        }

        let isVigencia = false;
        if (editingClass.dataInicio !== formData.dataInicio || editingClass.dataFim !== formData.dataFim) {
            isVigencia = true;
        }
        executeDirectSave(payload, isVigencia);
    } else {
        executeDirectSave(payload, false);
    }
  };

  const executeDirectSave = async (payload, isVigencia = false) => {
      setSaving(true);
      try {
          if (editingClass) {
              const estadoAnt = buildEstadoCompleto(editingClass);
              const estadoNov = buildEstadoCompleto(payload);
              await updateDoc(doc(db, "aulas", editingClass.id), { ...payload, updatedAt: serverTimestamp() });
              const acao = isVigencia ? 'VIGÊNCIA' : 'ALTERADA';
              const desc = isVigencia ? 'Datas limite atualizadas.' : 'Aula editada (Correção Direta).';
              await registrarLogAuditoria(acao, desc, "Atualização de dados sem quebra de histórico.", estadoAnt, estadoNov);
          } else {
              const estadoNov = buildEstadoCompleto(payload);
              await addDoc(collection(db, "aulas"), { ...payload, createdAt: serverTimestamp() });
              await registrarLogAuditoria('NOVA', 'Aula adicionada na grade.', `Dias: ${payload.dias.join(', ')} | Hora: ${payload.hora}`, null, estadoNov);
          }
          closeModal();
      } catch (e) {
          alert(t('schedulePage.alerts.saveError', "Erro ao salvar."));
      } finally {
          setSaving(false);
      }
  };

  const executeSplitSave = async () => {
      if (!dataCorteTransicao) return alert(t('schedulePage.splitModal.selectDateAlert', "Selecione a data exata em que a nova configuração começa a valer."));
      
      setSaving(true);
      try {
          const { payload, mudancas } = pendingSplit;
          const diffString = mudancas.join('\n'); 
          
          const dataInicioObj = new Date(dataCorteTransicao + 'T12:00:00');
          dataInicioObj.setDate(dataInicioObj.getDate() - 1);
          const dataFimAntiga = dataInicioObj.toISOString().split('T')[0];

          const payloadNova = { ...payload, dataInicio: dataCorteTransicao };

          const estadoAnt = buildEstadoCompleto(editingClass);
          estadoAnt.dataFim = dataFimAntiga; 
          const estadoNov = buildEstadoCompleto(payloadNova);

          await updateDoc(doc(db, "aulas", editingClass.id), { dataFim: dataFimAntiga, updatedAt: serverTimestamp() });
          await addDoc(collection(db, "aulas"), { ...payloadNova, createdAt: serverTimestamp() });
          
          await registrarLogAuditoria('ALTERADA', 'Transição estrutural gravada.', `[A PARTIR DE ${dataCorteTransicao.split('-').reverse().join('/')}]\n${diffString}`, estadoAnt, estadoNov);
          
          closeModal();
      } catch (e) {
          alert(t('schedulePage.alerts.saveError', "Erro ao executar a transição da grade."));
      } finally {
          setSaving(false);
      }
  };

  const handleDelete = async () => {
    if (isReadOnly) return;
    
    if (confirm(t('schedulePage.alerts.deleteConfirm', "🗑️ LIXEIRA INTELIGENTE:\n\nDeseja ocultar esta aula da grade? Ela será removida da visualização de todos, mas o histórico e o banco de dados serão preservados (Soft Delete)."))) {
      try {
        setSaving(true);
        const estadoAnt = buildEstadoCompleto(editingClass);
        
        await updateDoc(doc(db, "aulas", editingClass.id), { 
            excluido: true,
            deletedAt: serverTimestamp(),
            deletedBy: userId
        });
        
        await registrarLogAuditoria('EXCLUÍDA', 'Aula enviada para a Lixeira (Soft Delete).', 'Ação de ocultar ativada. Relatórios antigos preservados.', estadoAnt, null);
        closeModal();
      } catch (error) { 
          console.error(error);
          alert(t('schedulePage.alerts.deleteError', "Erro ao enviar a aula para a lixeira.")); 
      } finally { 
          setSaving(false); 
      }
    }
  };

  const toggleDay = (day) => setFormData(prev => ({ ...prev, dias: prev.dias.includes(day) ? prev.dias.filter(d => d !== day) : [...prev.dias, day] }));

  const openNewModal = () => {
    if (isReadOnly) return;
    setFormData({ unidadeId: selectedUnit || '', modalidadeId: '', professorId: '', hora: '07:00', valor: '', dias: [], dataInicio: getTodayStr(), dataFim: '' });
    setEditingClass(null);
    setPendingSplit(null);
    setShowModal(true);
  };

  const openEditModal = (cls) => {
    if (isReadOnly) return;
    setEditingClass(cls);
    setFormData({ 
        ...cls, 
        dias: cls.dias || [],
        dataInicio: cls.dataInicio || getTodayStr(), 
        dataFim: cls.dataFim || ''
    });
    setPendingSplit(null);
    setShowModal(true);
  };

  const closeModal = () => {
      setShowModal(false);
      setPendingSplit(null);
  }

  const professoresDoModal = useMemo(() => {
    if (!formData.unidadeId) return [];
    const linksDaUnidade = catalogs.vinculos.filter(v => String(v.unidadeId) === String(formData.unidadeId));
    const idsPermitidos = linksDaUnidade.map(v => String(v.professorId));
    return catalogs.professores.filter(p => idsPermitidos.includes(String(p.id)));
  }, [formData.unidadeId, catalogs.vinculos, catalogs.professores]);

  if (loading) return <div className="flex h-screen items-center justify-center text-slate-400 gap-2"><Loader2 className="w-6 h-6 animate-spin text-red-600" /> {t('layout.loading', 'Carregando...')}</div>;

  return (
    <div className="p-8 max-w-[1800px] mx-auto animate-fade-in space-y-8">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 dark:border-slate-700 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <span className="bg-red-600 text-white p-2 rounded-lg shadow-red-200 dark:shadow-none shadow-lg">
              <Calendar className="w-6 h-6" />
            </span>
            {t('schedulePage.title', 'Agenda de Coletivas')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
            {isReadOnly ? t('schedulePage.subtitleReadOnly', "Consulte os horários de todas as unidades") : t('schedulePage.subtitle', "Gerenciamento Inteligente de Grade e Horário")}
          </p>
        </div>
      </div>

      {/* CONTROL BAR */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 p-6">
        <div className="flex flex-col xl:flex-row gap-4 items-end">
          
          <div className="w-full md:w-32 space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Globe className="w-3 h-3" /> {t('schedulePage.filters.state', 'Estado')}
            </label>
            <div className="relative">
                <select 
                    className="w-full h-12 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-bold focus:border-red-500 outline-none appearance-none cursor-pointer"
                    value={selectedState}
                    onChange={(e) => { setSelectedState(e.target.value); setSelectedUnit(""); }}
                >
                    <option value="">{t('schedulePage.filters.allStates', 'Todos')}</option>
                    {uniqueStates.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="w-full md:w-64 space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {t('schedulePage.filters.unit', 'Unidade')}
            </label>
            <div className="relative group">
              <select 
                className="w-full h-12 pl-4 pr-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-700 dark:text-white focus:border-red-500 outline-none appearance-none cursor-pointer"
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                disabled={availableUnits.length <= 1 && (role === 'unidade' || role === 'professor')}
              >
                <option value="">{t('schedulePage.filters.allUnits', 'Selecione...')}</option>
                {filteredUnitsDropdown.map(u => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex-1 w-full space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Search className="w-3 h-3" /> {selectedUnit ? t('schedulePage.filters.searchInGrid', "Filtrar nesta grade") : t('schedulePage.filters.searchEverywhere', "Buscar Modalidade em todas as unidades")}
            </label>
            <div className="relative">
              <input 
                type="text" 
                placeholder={selectedUnit ? t('schedulePage.filters.searchPlaceholderInGrid', "Ex: Spinning...") : t('schedulePage.filters.searchPlaceholderEverywhere', "Ex: Digite 'Pilates' para ver onde tem...")}
                className="w-full h-12 pl-11 pr-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-700 dark:text-white focus:border-red-500 outline-none transition-all shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>

          <button 
              onClick={() => setMostrarEncerradas(!mostrarEncerradas)}
              className={`h-12 px-4 rounded-xl font-bold text-[11px] uppercase flex items-center gap-2 shadow-sm transition-all whitespace-nowrap
              ${mostrarEncerradas 
                  ? 'bg-slate-800 text-white border border-slate-900 dark:bg-slate-700' 
                  : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-600 hover:bg-slate-50'}`}
          >
              {mostrarEncerradas ? <EyeOff className="w-4 h-4"/> : <History className="w-4 h-4"/>}
              <span className="hidden sm:inline">{mostrarEncerradas ? t('schedulePage.buttons.hideHistory', "Ocultar Encerradas") : t('schedulePage.buttons.showHistory', "Ver Encerradas")}</span>
          </button>

          {!isReadOnly && (
            <button 
                onClick={openNewModal}
                disabled={!selectedUnit}
                className={`
                h-12 px-6 rounded-xl font-bold text-xs uppercase flex items-center gap-2 shadow-lg transition-all active:scale-95 whitespace-nowrap
                ${selectedUnit 
                    ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-200 dark:shadow-none' 
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-600'}
                `}
            >
                <Plus className="w-4 h-4" /> {t('schedulePage.buttons.add', 'Adicionar')}
            </button>
          )}
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO */}
      <div className="min-h-[500px] relative">
        
        {!selectedUnit && !debouncedSearchTerm && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
            <Globe className="w-16 h-16 mb-4 text-slate-300 dark:text-slate-600" />
            <h3 className="text-xl font-black text-slate-600 dark:text-slate-400">{t('schedulePage.placeholders.startSearchTitle', 'Comece sua busca')}</h3>
            <p className="text-sm mt-1">{t('schedulePage.placeholders.startSearchDesc', 'Selecione uma Unidade para ver o calendário ou digite uma Modalidade para buscar em todas.')}</p>
          </div>
        )}

        {!selectedUnit && debouncedSearchTerm && (
            <div className="space-y-6">
                <h3 className="text-lg font-bold text-slate-600 flex items-center gap-2">
                    <List className="w-5 h-5"/> {t('schedulePage.placeholders.resultsFor', 'Resultados para')} "{debouncedSearchTerm}"
                </h3>
                {groupedClasses.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">{t('schedulePage.placeholders.noClassesFound', 'Nenhuma aula encontrada com este nome.')}</div>
                ) : (
                    <div className="space-y-6">
                        {groupedClasses.map((group) => (
                            <GlobalUnitBlock 
                                key={group.unidadeNome} 
                                unitName={group.unidadeNome} 
                                classes={group.aulas} 
                                isReadOnly={isReadOnly}
                                onEdit={openEditModal}
                                t={t}
                            />
                        ))}
                    </div>
                )}
            </div>
        )}

        {selectedUnit && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                {filteredClasses.length === 0 && !debouncedSearchTerm ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                        <Calendar className="w-12 h-12 mb-3 opacity-20" />
                        <p>{mostrarEncerradas ? t('schedulePage.placeholders.noClassesInUnit', "Nenhuma aula cadastrada nesta unidade.") : t('schedulePage.placeholders.emptyGrid', "A grade atual está vazia. Tente clicar em 'Ver Encerradas'.")}</p>
                        {!isReadOnly && <button onClick={openNewModal} className="mt-2 text-red-600 hover:underline font-bold text-sm">{t('schedulePage.placeholders.createFirstClass', 'Criar nova aula')}</button>}
                    </div>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar pb-6">
                        <div 
                            className="grid w-full"
                            style={{ 
                                gridTemplateColumns: `80px repeat(${visibleDays.length}, minmax(180px, 1fr))`, 
                                minWidth: `${80 + visibleDays.length * 180}px` 
                            }}
                        >
                            <div className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700 p-4 text-center text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest sticky top-0 left-0 z-20">{t('schedulePage.modal.time', 'Horário')}</div>
                            {visibleDays.map(day => (
                                <div key={day} className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700 border-l border-slate-100 dark:border-slate-800 p-4 text-center text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest sticky top-0 z-10">
                                    {t('publicSchedule.days.' + day, day)}
                                </div>
                            ))}
                            
                            {activeTimeSlots.map(time => (
                                <React.Fragment key={time}>
                                    <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 flex items-start justify-end pt-5 sticky left-0 z-10">{time}</div>
                                    {visibleDays.map(day => {
                                        const classesInSlot = filteredClasses.filter(c => c.dias.includes(day) && c.hora === time);
                                        return (
                                            <div key={`${day}-${time}`} className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 border-l border-slate-100 dark:border-slate-700 p-2 min-h-[110px] h-auto hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors flex flex-col gap-1">
                                                {classesInSlot.map(cls => <ClassCard key={cls.id} data={cls} onClick={() => openEditModal(cls)} isReadOnly={isReadOnly} defaultTeacher={t('publicSchedule.defaultTeacher', 'Instrutor')} t={t} />)}
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* MODAL PRINCIPAL DE EDIÇÃO E CÉREBRO DE TRANSIÇÃO */}
      {showModal && !isReadOnly && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 dark:border-slate-700 flex flex-col max-h-[90vh]">
            
            {/* ESTADO 1: FORMULÁRIO NORMAL DE AULA */}
            {!pendingSplit ? (
                <>
                    <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                        <h3 className="font-black text-xl text-slate-800 dark:text-white uppercase tracking-tight">{editingClass ? t('schedulePage.modal.editTitle', 'EDITAR AULA') : t('schedulePage.modal.newTitle', 'CRIAR NOVA AULA')}</h3>
                        <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-rose-500 hover:bg-rose-50 transition-colors"><X className="w-5 h-5" /></button>
                    </div>
                    
                    <form onSubmit={handleFirstSaveClick} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                    
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">{t('schedulePage.filters.unit', 'Unidade')}</label>
                            <select className="w-full p-3.5 bg-slate-100 dark:bg-slate-900 border-transparent rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 outline-none" value={formData.unidadeId} onChange={e => setFormData({...formData, unidadeId: e.target.value})} disabled={userData?.role === 'unidade'}>
                                <option value="">{t('schedulePage.filters.allUnits', 'Selecione...')}</option>
                                {availableUnits.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                            </select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-5">
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">{t('schedulePage.modal.modality', 'Modalidade')}</label>
                                <select className="w-full p-3.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-white rounded-xl text-sm focus:border-red-500 outline-none font-bold" value={formData.modalidadeId} onChange={e => setFormData({...formData, modalidadeId: e.target.value})} required>
                                    <option value="">{t('schedulePage.filters.allUnits', 'Selecione...')}</option>
                                    {catalogs.modalidades.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">{t('schedulePage.modal.teacher', 'Professor Titular')}</label>
                                <select className="w-full p-3.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-white rounded-xl text-sm focus:border-red-500 outline-none font-bold" value={formData.professorId} onChange={e => setFormData({...formData,professorId: e.target.value})} required disabled={!formData.unidadeId}>
                                    <option value="">{!formData.unidadeId ? t('schedulePage.modal.selectUnitAlert', "Selecione a unidade") : (professoresDoModal.length === 0 ? t('schedulePage.modal.noTeacherLinked', "Nenhum vinculado") : t('schedulePage.filters.allUnits', 'Selecione...'))}</option>
                                    {professoresDoModal.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                </select>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-5">
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 flex items-center gap-1"><Clock className="w-3 h-3"/> {t('schedulePage.modal.time', 'Horário')}</label>
                                <input type="time" className="w-full p-3.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-white rounded-xl text-sm focus:border-red-500 outline-none font-bold" value={formData.hora} onChange={e => setFormData({...formData, hora: e.target.value})} required />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5 flex items-center gap-1"><DollarSign className="w-3 h-3 text-green-600"/> {t('schedulePage.modal.value', 'Valor Hora/Aula')}</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{modalCurrencySymbol}</span>
                                    <input type="number" step="0.01" min="0" className="w-full p-3.5 pl-14 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl text-sm focus:border-green-500 outline-none font-black text-slate-700 dark:text-white" value={formData.valor} onChange={e => setFormData({...formData, valor: e.target.value})} placeholder="0.00" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 block">{t('schedulePage.modal.daysOfWeek', 'Dias da Semana')}</label>
                            <div className="flex flex-wrap gap-2">
                                {allDays.map(day => (
                                    <button key={day} type="button" onClick={() => toggleDay(day)} className={`flex-1 min-w-[65px] py-3 rounded-xl text-[10px] font-black uppercase tracking-wider border-2 transition-all ${formData.dias.includes(day) ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-200 dark:shadow-none transform scale-105' : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-red-300 hover:text-red-500'}`}>
                                        {t('publicSchedule.days.' + day, day).substring(0, 3)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* DATAS DA CONFIGURAÇÃO */}
                        <div className="grid grid-cols-2 gap-5 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div>
                                <label className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase mb-1.5 block">{t('schedulePage.modal.startDate', 'Aula Registrada a partir de')}</label>
                                <input type="date" required className="w-full p-2.5 bg-transparent border-b-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white text-sm focus:border-blue-500 outline-none font-bold" value={formData.dataInicio} onChange={e => setFormData({...formData, dataInicio: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">{t('schedulePage.modal.endDate', 'Encerrar Permanentemente em')}</label>
                                <input type="date" className="w-full p-2.5 bg-transparent border-b-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white text-sm focus:border-rose-500 outline-none font-bold" value={formData.dataFim} onChange={e => setFormData({...formData, dataFim: e.target.value})} />
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end gap-3 shrink-0">
                            {editingClass && (
                                <button type="button" onClick={handleDelete} disabled={saving} className="mr-auto text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 px-4 py-3.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 disabled:opacity-50 transition-colors">
                                    <Trash2 className="w-4 h-4"/> {t('schedulePage.modal.delete', 'Excluir')}
                                </button>
                            )}
                            <button type="button" onClick={closeModal} disabled={saving} className="px-6 py-3.5 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl disabled:opacity-50 transition-colors">{t('schedulePage.modal.cancel', 'Cancelar')}</button>
                            <button type="submit" disabled={saving} className="px-8 py-3.5 bg-red-600 text-white rounded-xl font-black uppercase text-xs hover:bg-red-700 shadow-lg shadow-red-200 dark:shadow-none flex items-center gap-2 disabled:opacity-70 transition-all active:scale-95">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4" />} {editingClass ? t('schedulePage.modal.saveEdit', 'Salvar Alterações') : t('schedulePage.modal.save', 'Salvar')}
                            </button>
                        </div>
                    </form>
                </>
            ) : (
                /* ESTADO 2: CÉREBRO TEMPORAL (PERGUNTA AO USUÁRIO COMO CORTAR A AULA) */
                <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
                    <div className="p-8 pb-0 text-center shrink-0">
                        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200">
                            <ArrowRightLeft className="w-8 h-8" />
                        </div>
                        <h3 className="font-black text-2xl text-slate-800 dark:text-white uppercase tracking-tight">{t('schedulePage.splitModal.title', 'Alteração de Grade')}</h3>
                        <p className="text-slate-500 text-sm font-bold mt-2">{t('schedulePage.splitModal.desc', 'Você alterou dados importantes da aula. Como deseja que o sistema aplique essas mudanças no banco de dados?')}</p>
                    </div>

                    <div className="p-8 space-y-6 overflow-y-auto">
                        
                        {/* OPÇÃO 1: TRANSIÇÃO SEGURA (CRIAR FASE) */}
                        <div className="border-2 border-emerald-500 rounded-2xl p-5 bg-emerald-50/50 dark:bg-emerald-900/10 relative">
                            <div className="absolute -top-3 left-6 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
                                {t('schedulePage.splitModal.recommendedBadge', 'RECOMENDADO (Preserva o Passado)')}
                            </div>
                            <h4 className="font-black text-emerald-800 dark:text-emerald-400 text-lg mb-2 flex items-center gap-2">
                                {t('schedulePage.splitModal.newPhaseTitle', 'Criar Nova Fase')} <Check className="w-5 h-5"/>
                            </h4>
                            <p className="text-emerald-700/80 dark:text-emerald-500/80 text-xs font-bold leading-relaxed mb-4">
                                {t('schedulePage.splitModal.newPhaseDesc', 'Encerra a aula antiga de forma invisível e cria a nova. Nenhum relatório ou presença passada será perdida. Ideal para troca de horários, dias ou professores.')}
                            </p>
                            
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
                                <div className="flex-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('schedulePage.splitModal.startDateLabel', 'A NOVA CONFIGURAÇÃO PASSA A VALER NO DIA:')}</label>
                                    <div className="relative mt-1">
                                        <Calendar className="absolute left-3 top-3 w-4 h-4 text-emerald-600"/>
                                        <input 
                                            type="date" 
                                            className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-700 dark:text-emerald-400 font-black focus:ring-2 focus:ring-emerald-500 outline-none uppercase" 
                                            value={dataCorteTransicao} 
                                            onChange={e => setDataCorteTransicao(e.target.value)} 
                                        />
                                    </div>
                                </div>
                                <button 
                                    onClick={executeSplitSave} 
                                    disabled={saving || !dataCorteTransicao}
                                    className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : t('schedulePage.splitModal.applyChange', 'Aplicar Troca')}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 opacity-50">
                            <div className="h-px bg-slate-300 flex-1"></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('schedulePage.splitModal.or', 'OU')}</span>
                            <div className="h-px bg-slate-300 flex-1"></div>
                        </div>

                        {/* OPÇÃO 2: CORREÇÃO DIRETA (SOBRESCREVER) */}
                        <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:border-rose-300 transition-colors">
                            <h4 className="font-black text-slate-700 dark:text-slate-300 text-base mb-2 flex items-center gap-2">
                                {t('schedulePage.splitModal.directFixTitle', 'Corrigir Erro de Digitação')} <Edit2 className="w-4 h-4 text-slate-400"/>
                            </h4>
                            <p className="text-slate-500 text-xs font-bold leading-relaxed mb-4">
                                {t('schedulePage.splitModal.directFixDesc', 'Substitui os dados diretamente. Atenção: Isso altera o nome do professor e horários no passado. Use apenas se a aula foi cadastrada errada agora mesmo.')}
                            </p>
                            <button 
                                onClick={() => executeDirectSave(pendingSplit.payload, false)} 
                                disabled={saving}
                                className="w-full py-3 bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-900/20 text-slate-600 hover:text-rose-600 border border-slate-200 dark:border-slate-700 hover:border-rose-200 font-black text-xs uppercase rounded-xl transition-all flex items-center justify-center disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : t('schedulePage.splitModal.justReplace', 'Apenas Substituir Dados')}
                            </button>
                        </div>

                    </div>

                    <div className="px-8 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shrink-0 text-center">
                        <button onClick={() => setPendingSplit(null)} className="text-slate-400 hover:text-slate-600 font-bold text-xs uppercase tracking-wider underline">{t('schedulePage.splitModal.backToForm', 'Voltar para o formulário')}</button>
                    </div>
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
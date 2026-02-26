import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, Clock, Plus, Filter, 
  Search, Trash2, Edit2, X, Check, 
  MapPin, Loader2, AlertTriangle, Users,
  DollarSign, Globe, ChevronRight, List, ChevronDown, User, CalendarDays, EyeOff, History 
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext'; 
import { db } from '../../services/firebase'; 
import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp, onSnapshot 
} from 'firebase/firestore';

// --- FUNÇÕES UTILITÁRIAS ---
const getTodayStr = () => new Date().toLocaleDateString('en-CA');

const formatFirstLastName = (fullName) => {
  if (!fullName) return "Instrutor";
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

// --- COMPONENTES VISUAIS ---

const ClassCard = ({ data, onClick, isReadOnly }) => {
  const textColor = getContrastColor(data.modalidadeCor || '#E6332A');
  const isEncerrada = data.dataFim && data.dataFim < getTodayStr();

  return (
    <div 
      onClick={!isReadOnly ? onClick : undefined}
      style={{ backgroundColor: data.modalidadeCor || '#E6332A' }}
      className={`group relative mb-2 p-2 rounded-lg shadow-sm transition-all duration-200 overflow-hidden flex flex-col items-center justify-center min-h-[70px] text-center w-full 
      ${!isReadOnly ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02]' : 'cursor-default'} 
      ${isEncerrada ? 'opacity-40 grayscale border-2 border-dashed border-slate-900' : ''}`}
      title={isEncerrada ? "Aula Encerrada (Apenas Histórico)" : "Aula Ativa"}
    >
      <h4 style={{ color: textColor }} className="font-black text-[10px] uppercase tracking-wide leading-tight w-full break-words">
        {data.modalidadeNome}
      </h4>
      <div className="flex items-center gap-1 mt-1 opacity-90">
        <Users className="w-3 h-3" style={{ color: textColor }} />
        <span style={{ color: textColor }} className="text-[9px] font-bold uppercase truncate max-w-[120px]">
          {formatFirstLastName(data.professorNome)}
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

const GlobalUnitBlock = ({ unitName, classes, isReadOnly, onEdit }) => {
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
          {classes.length} horários
        </span>
      </div>
      
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {classes.map(aula => {
          const isEncerrada = aula.dataFim && aula.dataFim < getTodayStr();

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
                    {isEncerrada && <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase tracking-wide font-bold">Encerrada</span>}
                 </h5>
                 <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wide mt-1">
                    <Calendar className="w-3.5 h-3.5"/>
                    {aula.dias.join(', ')}
                 </div>
              </div>

              <div className="flex items-center gap-3 md:w-1/4 border-l border-transparent md:border-slate-100 md:dark:border-slate-700 md:pl-4">
                 <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 border border-slate-200 dark:border-slate-600">
                    <User className="w-4 h-4"/>
                 </div>
                 <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Instrutor</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{formatFirstLastName(aula.professorNome)}</p>
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

  // 2. MOTOR DE TEMPO REAL DAS AULAS
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
        const aulasData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
        professorNome: prof?.nome || 'Sem Professor',
        unidadeNome: uni?.nome || 'Unidade Desconhecida'
      };
    }).filter(c => {
      if (!debouncedSearchTerm) return true;
      const term = debouncedSearchTerm.toLowerCase();
      return (c.modalidadeNome.toLowerCase().includes(term) || c.professorNome.toLowerCase().includes(term));
    });
  }, [selectedUnit, debouncedSearchTerm, aulas, catalogs, availableUnits, mostrarEncerradas]);

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


  // ==========================================
  // 4. AÇÕES DO MODAL E MOTOR DE AUDITORIA FINO
  // ==========================================

  // O Motor Invisível que envia os detalhes exatos para o Histórico Global
  const registrarLogAuditoria = async (tipoAcao, descricao, aulaReferencia, diffExtras = "") => {
    try {
        const uni = catalogs.unidades.find(u => u.id === aulaReferencia.unidadeId);
        const mod = catalogs.modalidades.find(m => m.id === aulaReferencia.modalidadeId);
        const prof = catalogs.professores.find(p => p.id === aulaReferencia.professorId);
        const nomeUsuario = userData?.nome || userData?.email || 'Administrador do Sistema';

        await addDoc(collection(db, 'auditoria_cronograma'), {
            tipoAcao,
            descricao,
            diffExtras,
            unidadeNome: uni?.nome || 'Unidade Desconhecida',
            modalidadeNome: mod?.nome || 'Modalidade Desconhecida',
            professorNome: prof?.nome || 'Professor Desconhecido',
            dias: aulaReferencia.dias || [],
            hora: aulaReferencia.hora || '',
            valor: aulaReferencia.valor || 0,
            usuarioAcaoNome: nomeUsuario,
            usuarioAcaoId: userId,
            dataAcao: serverTimestamp()
        });
    } catch (e) { console.error("Erro ao gerar log de auditoria", e); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isReadOnly || saving) return; 

    if (!formData.unidadeId || !formData.modalidadeId || !formData.professorId || !formData.hora || formData.dias.length === 0 || !formData.dataInicio) {
        return alert("❌ Preencha todos os campos obrigatórios.");
    }
    if (formData.dataFim && formData.dataInicio > formData.dataFim) {
        return alert("❌ A data de encerramento não pode ser anterior à data de início.");
    }

    try {
      setSaving(true);
      const payload = {
        unidadeId: formData.unidadeId, modalidadeId: formData.modalidadeId, professorId: formData.professorId,
        hora: formData.hora, valor: formData.valor ? parseFloat(formData.valor) : 0, 
        dias: formData.dias, dataInicio: formData.dataInicio, dataFim: formData.dataFim || null 
      };

      if (editingClass) {
        const diasAntigos = [...(editingClass.dias || [])].sort();
        const diasNovos = [...formData.dias].sort();
        const valorAntigo = editingClass.valor ? parseFloat(editingClass.valor) : 0;
        const valorNovo = formData.valor ? parseFloat(formData.valor) : 0;

        let mudancas = [];
        
        // 1. Comparação de Professor
        if (editingClass.professorId !== formData.professorId) {
            const pAntigo = catalogs.professores.find(p => p.id === editingClass.professorId)?.nome || 'Sem Prof';
            const pNovo = catalogs.professores.find(p => p.id === formData.professorId)?.nome || 'Sem Prof';
            mudancas.push(`Prof: ${pAntigo} ➔ ${pNovo}`);
        }

        // 2. Comparação de Modalidade
        if (editingClass.modalidadeId !== formData.modalidadeId) {
            const mAntigo = catalogs.modalidades.find(m => m.id === editingClass.modalidadeId)?.nome || 'Desconhecida';
            const mNovo = catalogs.modalidades.find(m => m.id === formData.modalidadeId)?.nome || 'Desconhecida';
            mudancas.push(`Modalidade: ${mAntigo} ➔ ${mNovo}`);
        }

        // 3. Comparação de Valor Financeiro
        if (valorAntigo !== valorNovo) mudancas.push(`Valor: R$ ${valorAntigo} ➔ R$ ${valorNovo}`);
        
        // 4. Comparação de Horário
        if (editingClass.hora !== formData.hora) mudancas.push(`Hora: ${editingClass.hora} ➔ ${formData.hora}`);
        
        // 5. Comparação Detalhada dos Dias (O que acrescentou e o que tirou)
        const diasAdicionados = diasNovos.filter(d => !diasAntigos.includes(d));
        const diasRemovidos = diasAntigos.filter(d => !diasNovos.includes(d));
        
        if (diasAdicionados.length > 0 || diasRemovidos.length > 0) {
            let diasTexto = [];
            if (diasAdicionados.length > 0) diasTexto.push(`+ ${diasAdicionados.join(', ')}`);
            if (diasRemovidos.length > 0) diasTexto.push(`- ${diasRemovidos.join(', ')}`);
            mudancas.push(`Dias: ${diasTexto.join(' e ')}`);
        }

        const isCriticalChange = mudancas.length > 0;

        if (isCriticalChange) {
            const diffString = mudancas.join('\n'); 
            const dataInicioObj = new Date(formData.dataInicio + 'T12:00:00');
            dataInicioObj.setDate(dataInicioObj.getDate() - 1);
            const dataFimAntiga = dataInicioObj.toISOString().split('T')[0];

            const dataNovaBR = new Date(formData.dataInicio + 'T12:00:00').toLocaleDateString('pt-BR');
            const dataFimAntigaBR = dataInicioObj.toLocaleDateString('pt-BR');

            const confirmacao = window.confirm(
                "🚨 ALTERAÇÃO DETECTADA\n\n" +
                "Você está salvando as seguintes mudanças:\n" + mudancas.join(' | ') + "\n\n" +
                "Para preservar o histórico passado:\n" +
                `👉 A aula antiga será ENCERRADA em: ${dataFimAntigaBR}\n` +
                `👉 A aula NOVA começará em: ${dataNovaBR}\n\n` +
                "Confirma a transição?"
            );
            if (!confirmacao) { setSaving(false); return; }

            // Fecha a aula velha, abre a nova e loga tudo
            await updateDoc(doc(db, "aulas", editingClass.id), { dataFim: dataFimAntiga, updatedAt: serverTimestamp() });
            await addDoc(collection(db, "aulas"), { ...payload, createdAt: serverTimestamp() });
            await registrarLogAuditoria('ALTERADA', 'Transição estrutural gravada.', payload, diffString);

        } else {
            // Mudança simples de data de validade
            let msgData = [];
            if (editingClass.dataInicio !== formData.dataInicio) msgData.push(`Início: ${editingClass.dataInicio} ➔ ${formData.dataInicio}`);
            if (editingClass.dataFim !== formData.dataFim) msgData.push(`Fim: ${editingClass.dataFim || 'Vazio'} ➔ ${formData.dataFim || 'Vazio'}`);
            
            await updateDoc(doc(db, "aulas", editingClass.id), { ...payload, updatedAt: serverTimestamp() });
            await registrarLogAuditoria('VIGÊNCIA', 'Datas limite atualizadas.', payload, msgData.join(' | '));
        }
      } else {
        // Aula totalmente nova
        await addDoc(collection(db, "aulas"), { ...payload, createdAt: serverTimestamp() });
        await registrarLogAuditoria('NOVA', 'Aula adicionada na grade.', payload, `Dias: ${formData.dias.join(', ')} | Hora: ${formData.hora} | Valor: R$ ${formData.valor}`);
      }
      setShowModal(false);
    } catch (error) { 
        console.error(error); alert("Erro ao salvar."); 
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (isReadOnly) return;
    
    if (confirm("🚨 ATENÇÃO: Excluir esta aula apaga ela da grade e pode afetar relatórios do passado.\n\n👉 Se houve apenas troca de professor, NÃO EXCLUA. Apenas edite e preencha a 'Data de Encerramento', e crie uma aula nova para o novo professor.\n\nTem certeza que deseja EXCLUIR DEFINITIVAMENTE esta aula?")) {
      try {
        setSaving(true);
        await deleteDoc(doc(db, "aulas", editingClass.id));
        await registrarLogAuditoria('EXCLUÍDA', 'Aula apagada do banco de dados.', editingClass, 'Ação definitiva de exclusão.');
        setShowModal(false);
      } catch (error) { 
          alert("Erro ao excluir do banco de dados."); 
      } finally { 
          setSaving(false); 
      }
    }
  };

  // --- HELPERS DE INTERFACE ---
  const toggleDay = (day) => setFormData(prev => ({ ...prev, dias: prev.dias.includes(day) ? prev.dias.filter(d => d !== day) : [...prev.dias, day] }));

  const openNewModal = () => {
    if (isReadOnly) return;
    setFormData({ unidadeId: selectedUnit || '', modalidadeId: '', professorId: '', hora: '07:00', valor: '', dias: [], dataInicio: getTodayStr(), dataFim: '' });
    setEditingClass(null);
    setShowModal(true);
  };

  const openEditModal = (cls) => {
    if (isReadOnly) return;
    setEditingClass(cls);
    setFormData({ 
        ...cls, 
        dias: cls.dias || [],
        dataInicio: cls.dataInicio || `${new Date().getFullYear()}-01-01`, 
        dataFim: cls.dataFim || ''
    });
    setShowModal(true);
  };

  const professoresDoModal = useMemo(() => {
    if (!formData.unidadeId) return [];
    const linksDaUnidade = catalogs.vinculos.filter(v => String(v.unidadeId) === String(formData.unidadeId));
    const idsPermitidos = linksDaUnidade.map(v => String(v.professorId));
    return catalogs.professores.filter(p => idsPermitidos.includes(String(p.id)));
  }, [formData.unidadeId, catalogs.vinculos, catalogs.professores]);

  if (loading) return <div className="flex h-screen items-center justify-center text-slate-400 gap-2"><Loader2 className="w-6 h-6 animate-spin text-red-600" /> Carregando...</div>;

  return (
    <div className="p-8 max-w-[1800px] mx-auto animate-fade-in space-y-8">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 dark:border-slate-700 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <span className="bg-red-600 text-white p-2 rounded-lg shadow-red-200 dark:shadow-none shadow-lg">
              <Calendar className="w-6 h-6" />
            </span>
            Agenda de Coletivas
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
            {isReadOnly ? "Consulte os horários de todas as unidades" : "Gerenciamento de Grade e Horário"}
          </p>
        </div>
      </div>

      {/* CONTROL BAR */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 p-6">
        <div className="flex flex-col xl:flex-row gap-4 items-end">
          
          <div className="w-full md:w-32 space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Globe className="w-3 h-3" /> Estado
            </label>
            <div className="relative">
                <select 
                    className="w-full h-12 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-bold focus:border-red-500 outline-none appearance-none cursor-pointer"
                    value={selectedState}
                    onChange={(e) => { setSelectedState(e.target.value); setSelectedUnit(""); }}
                >
                    <option value="">Todos</option>
                    {uniqueStates.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="w-full md:w-64 space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Unidade
            </label>
            <div className="relative group">
              <select 
                className="w-full h-12 pl-4 pr-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-700 dark:text-white focus:border-red-500 outline-none appearance-none cursor-pointer"
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                disabled={availableUnits.length <= 1 && (role === 'unidade' || role === 'professor')}
              >
                <option value="">Selecione...</option>
                {filteredUnitsDropdown.map(u => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex-1 w-full space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Search className="w-3 h-3" /> {selectedUnit ? "Filtrar nesta grade" : "Buscar Modalidade em todas as unidades"}
            </label>
            <div className="relative">
              <input 
                type="text" 
                placeholder={selectedUnit ? "Ex: Spinning..." : "Ex: Digite 'Pilates' para ver onde tem..."}
                className="w-full h-12 pl-11 pr-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-700 dark:text-white focus:border-red-500 outline-none transition-all shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>

          {/* BOTÃO DE VER HISTÓRICO/ENCERRADAS */}
          <button 
              onClick={() => setMostrarEncerradas(!mostrarEncerradas)}
              className={`h-12 px-4 rounded-xl font-bold text-[11px] uppercase flex items-center gap-2 shadow-sm transition-all whitespace-nowrap
              ${mostrarEncerradas 
                  ? 'bg-slate-800 text-white border border-slate-900 dark:bg-slate-700' 
                  : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-600 hover:bg-slate-50'}`}
          >
              {mostrarEncerradas ? <EyeOff className="w-4 h-4"/> : <History className="w-4 h-4"/>}
              <span className="hidden sm:inline">{mostrarEncerradas ? "Ocultar Encerradas" : "Ver Encerradas"}</span>
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
                <Plus className="w-4 h-4" /> Adicionar
            </button>
          )}
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO */}
      <div className="min-h-[500px] relative">
        
        {!selectedUnit && !debouncedSearchTerm && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
            <Globe className="w-16 h-16 mb-4 text-slate-300 dark:text-slate-600" />
            <h3 className="text-xl font-black text-slate-600 dark:text-slate-400">Comece sua busca</h3>
            <p className="text-sm mt-1">Selecione uma <strong>Unidade</strong> para ver o calendário ou digite uma <strong>Modalidade</strong> para buscar em todas.</p>
          </div>
        )}

        {!selectedUnit && debouncedSearchTerm && (
            <div className="space-y-6">
                <h3 className="text-lg font-bold text-slate-600 flex items-center gap-2">
                    <List className="w-5 h-5"/> Resultados em todas as unidades para "{debouncedSearchTerm}"
                </h3>
                {groupedClasses.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">Nenhuma aula encontrada com este nome.</div>
                ) : (
                    <div className="space-y-6">
                        {groupedClasses.map((group) => (
                            <GlobalUnitBlock 
                                key={group.unidadeNome} 
                                unitName={group.unidadeNome} 
                                classes={group.aulas} 
                                isReadOnly={isReadOnly}
                                onEdit={openEditModal}
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
                        <p>{mostrarEncerradas ? "Nenhuma aula cadastrada nesta unidade." : "A grade atual está vazia. Tente clicar em 'Ver Encerradas'."}</p>
                        {!isReadOnly && <button onClick={openNewModal} className="mt-2 text-red-600 hover:underline font-bold text-sm">Criar nova aula</button>}
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
                            <div className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700 p-4 text-center text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest sticky top-0 left-0 z-20">Horário</div>
                            {visibleDays.map(day => (
                                <div key={day} className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700 border-l border-slate-100 dark:border-slate-800 p-4 text-center text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest sticky top-0 z-10">{day}</div>
                            ))}
                            
                            {activeTimeSlots.map(time => (
                                <React.Fragment key={time}>
                                    <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 flex items-start justify-end pt-5 sticky left-0 z-10">{time}</div>
                                    {visibleDays.map(day => {
                                        const classesInSlot = filteredClasses.filter(c => c.dias.includes(day) && c.hora === time);
                                        return (
                                            <div key={`${day}-${time}`} className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 border-l border-slate-100 dark:border-slate-700 p-2 min-h-[110px] h-auto hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors flex flex-col gap-1">
                                                {classesInSlot.map(cls => <ClassCard key={cls.id} data={cls} onClick={() => openEditModal(cls)} isReadOnly={isReadOnly} />)}
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

      {/* MODAL */}
      {showModal && !isReadOnly && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 dark:border-slate-700 max-h-[90vh] flex flex-col">
            <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
              <h3 className="font-bold text-xl text-slate-800 dark:text-white">{editingClass ? 'Editar Aula' : 'Criar Nova Aula'}</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-red-500" /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-8 space-y-5 overflow-y-auto custom-scrollbar">
              
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                 <h4 className="text-blue-800 dark:text-blue-300 font-bold text-sm mb-1 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4"/> Regra de Vigência (Auditoria)
                 </h4>
                 <p className="text-blue-600 dark:text-blue-400 text-xs">
                    <strong>Troca de Professor, Dia ou Valor:</strong> O sistema fechará a aula antiga e criará uma nova para proteger seu histórico financeiro, detalhando cada mudança na Auditoria Geral.
                 </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">Unidade</label>
                <select className="w-full p-3 bg-slate-100 dark:bg-slate-900 border-transparent rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 outline-none" value={formData.unidadeId} onChange={e => setFormData({...formData, unidadeId: e.target.value})} disabled={userData?.role === 'unidade'}>
                  <option value="">Selecione...</option>
                  {availableUnits.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">Modalidade</label>
                  <select className="w-full p-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-white rounded-xl text-sm focus:border-red-500 outline-none" value={formData.modalidadeId} onChange={e => setFormData({...formData, modalidadeId: e.target.value})} required>
                    <option value="">Selecione...</option>
                    {catalogs.modalidades.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">Professor Titular</label>
                  <select className="w-full p-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-white rounded-xl text-sm focus:border-red-500 outline-none" value={formData.professorId} onChange={e => setFormData({...formData,professorId: e.target.value})} required disabled={!formData.unidadeId}>
                    <option value="">{!formData.unidadeId ? "Selecione a unidade" : (professoresDoModal.length === 0 ? "Nenhum vinculado" : "Selecione...")}</option>
                    {professoresDoModal.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 flex items-center gap-1"><Clock className="w-3 h-3"/> Horário</label>
                  <input type="time" className="w-full p-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-white rounded-xl text-sm focus:border-red-500 outline-none" value={formData.hora} onChange={e => setFormData({...formData, hora: e.target.value})} required />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5 flex items-center gap-1"><DollarSign className="w-3 h-3 text-green-600"/> Valor Hora/Aula</label>
                  <input type="number" step="0.01" min="0" className="w-full p-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl text-sm focus:border-green-500 outline-none font-bold text-slate-700 dark:text-white" value={formData.valor} onChange={e => setFormData({...formData, valor: e.target.value})} placeholder="0.00" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase mb-1.5 block">Válida A partir de *</label>
                  <input 
                    type="date" 
                    required 
                    className="w-full p-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-white rounded-lg text-sm focus:border-blue-500 outline-none" 
                    value={formData.dataInicio} 
                    onChange={e => setFormData({...formData, dataInicio: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">Encerrada em (Opcional)</label>
                  <input 
                    type="date" 
                    className="w-full p-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-white rounded-lg text-sm focus:border-rose-500 outline-none" 
                    value={formData.dataFim} 
                    onChange={e => setFormData({...formData, dataFim: e.target.value})} 
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 block">Dias da Semana</label>
                <div className="flex flex-wrap gap-2">
                  {allDays.map(day => (
                    <button key={day} type="button" onClick={() => toggleDay(day)} className={`flex-1 min-w-[70px] py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wide border transition-all ${formData.dias.includes(day) ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-200 dark:shadow-none transform scale-105' : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-red-300 hover:text-red-500'}`}>{day.substring(0, 3)}</button>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3 shrink-0">
                {editingClass && (
                    <button type="button" onClick={handleDelete} disabled={saving} className="mr-auto text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-3 rounded-xl text-xs font-bold uppercase flex items-center gap-2 disabled:opacity-50">
                        <Trash2 className="w-4 h-4"/> Excluir
                    </button>
                )}
                <button type="button" onClick={() => setShowModal(false)} disabled={saving} className="px-6 py-3 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={saving} className="px-8 py-3 bg-red-600 text-white rounded-xl font-bold uppercase text-xs hover:bg-red-700 shadow-lg shadow-red-200 dark:shadow-none flex items-center gap-2 disabled:opacity-70">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4" />} Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
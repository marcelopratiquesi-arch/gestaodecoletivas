import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import { useAuth } from "../../../contexts/AuthContext"; // Importado para Auditoria
import { 
  collection, addDoc, getDocs, deleteDoc, doc, 
  writeBatch, query, where, serverTimestamp 
} from 'firebase/firestore';
import { Calendar, Plus, Trash2, AlertTriangle, Loader2, CalendarDays } from 'lucide-react';

// Helpers de Data
const diasSemanaMap = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };

const getDatesInRange = (startDate, endDate) => {
  const date = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const dates = [];
  while (date <= end) {
    dates.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return dates;
};

export function FeriadosTab() {
  const { userData } = useAuth(); // Pegando dados do Admin para Auditoria
  const userId = userData?.id || userData?.uid;

  const [feriados, setFeriados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processando, setProcessando] = useState(false);
  
  const [form, setForm] = useState({ 
    nome: '', 
    dataInicio: '', 
    dataFim: '', 
    tipo: 'Recesso' 
  });

  // ==========================================
  // 0. MOTOR DE AUDITORIA (CÂMERA INVISÍVEL)
  // ==========================================
  const registrarLogAuditoria = async (tipoAcao, descricao, nomeFeriado, detalhes = "") => {
      try {
          const nomeUsuario = userData?.nome || userData?.email || 'Administrador do Sistema';
          await addDoc(collection(db, 'auditoria_cronograma'), {
              tipoAcao,
              descricao: `Calendário: ${descricao}`,
              diffExtras: detalhes,
              modulo: 'CONFIGURACOES',
              unidadeNome: 'Rede Global',
              professorNome: '-', 
              modalidadeNome: nomeFeriado || '-', 
              usuarioAcaoNome: nomeUsuario,
              usuarioAcaoId: userId,
              dataAcao: serverTimestamp()
          });
      } catch (e) { console.error("Erro ao gerar log de auditoria", e); }
  };

  useEffect(() => { loadFeriados(); }, []);

  async function loadFeriados() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "feriados"));
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                             .sort((a, b) => new Date(a.dataInicio) - new Date(b.dataInicio));
      setFeriados(lista);
    } catch (e) { 
      console.error("Erro ao carregar feriados"); 
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.nome || !form.dataInicio || !form.dataFim) return alert("Preencha o nome e as datas!");

    if (!window.confirm(`ATENÇÃO: Isso irá CANCELAR AUTOMATICAMENTE todas as aulas entre ${formatDate(form.dataInicio)} e ${formatDate(form.dataFim)}.\n\nDeseja continuar?`)) {
      return;
    }

    setProcessando(true);
    try {
      const feriadoDoc = await addDoc(collection(db, "feriados"), form);
      
      const aulasSnap = await getDocs(collection(db, "aulas"));
      const todasAulas = aulasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const datasDoRecesso = getDatesInRange(form.dataInicio, form.dataFim);
      
      let batch = writeBatch(db);
      let count = 0;

      for (const dateObj of datasDoRecesso) {
        const dataStr = dateObj.toISOString().split('T')[0];
        const diaSemana = diasSemanaMap[dateObj.getDay()];

        const aulasDoDia = todasAulas.filter(aula => aula.dias && aula.dias.includes(diaSemana));

        for (const aula of aulasDoDia) {
          const validacaoRef = doc(collection(db, "validacoes")); 
          
          batch.set(validacaoRef, {
            aulaId: aula.id,
            unidadeId: aula.unidadeId,
            professorId: aula.professorId,
            data: dataStr,
            status: 'cancelada',
            motivoCancelamento: `Recesso: ${form.nome}`,
            validadoPor: 'SISTEMA_FERIADO',
            feriadoId: feriadoDoc.id, 
            timestamp: serverTimestamp()
          });

          count++;
          if (count >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
      }

      if (count > 0) {
        await batch.commit();
      }

      // 🟢 AUDITORIA: Registro de novo feriado e quantidade de cancelamentos
      await registrarLogAuditoria(
          'NOVA', 
          `Novo ${form.tipo} agendado na rede.`, 
          form.nome, 
          `Período: ${formatDate(form.dataInicio)} até ${formatDate(form.dataFim)} | 🚨 Aulas canceladas automaticamente: ${count}`
      );

      setFeriados([...feriados, { id: feriadoDoc.id, ...form }]);
      setForm({ nome: '', dataInicio: '', dataFim: '', tipo: 'Recesso' });
      alert(`Sucesso! Recesso criado e ${count} aulas foram canceladas automaticamente.`);

    } catch (e) { 
      console.error(e);
      alert("Erro ao salvar feriado."); 
    } finally {
      setProcessando(false);
    }
  }

  async function handleDelete(id, nomeFeriado) {
    if (!window.confirm(`Deseja excluir o recesso "${nomeFeriado}"?\n\nNota: As aulas que foram canceladas NÃO serão reativadas automaticamente por segurança. Você deve excluí-las na validação diária se necessário.`)) return;
    
    try {
      await deleteDoc(doc(db, "feriados", id));
      
      // 🟢 AUDITORIA
      await registrarLogAuditoria('EXCLUÍDA', 'Evento removido do calendário.', nomeFeriado, 'O recesso/feriado foi deletado do sistema.');

      setFeriados(feriados.filter(f => f.id !== id));
    } catch (e) { alert("Erro ao excluir"); }
  }

  const formatDate = (date) => {
    if(!date) return "";
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y}`;
  }

  return (
    <div className="p-6 animate-fade-in space-y-8">
      
      {/* CARD DE CADASTRO */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-red-600"></div>
        <div className="flex items-center gap-2 mb-6">
          <CalendarDays className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="font-bold text-slate-700 dark:text-white uppercase text-sm">Agendar Recesso ou Feriado</h3>
            <p className="text-xs text-slate-400">Isso cancelará automaticamente todas as aulas no período selecionado.</p>
          </div>
        </div>
        
        <form onSubmit={handleSave} className="flex flex-col xl:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Nome do Evento</label>
            <input className="w-full p-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" 
                   value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: Recesso de Carnaval" />
          </div>
          
          <div className="w-full xl:w-40">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Data Início</label>
            <input type="date" className="w-full p-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-white rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500" 
                   value={form.dataInicio} onChange={e => setForm({...form, dataInicio: e.target.value})} />
          </div>

          <div className="w-full xl:w-40">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Data Fim</label>
            <input type="date" className="w-full p-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-white rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500" 
                   value={form.dataFim} onChange={e => setForm({...form, dataFim: e.target.value})} />
          </div>

          <div className="w-full xl:w-40">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Tipo</label>
            <select className="w-full p-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" 
                    value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
              <option>Recesso</option>
              <option>Feriado Nacional</option>
              <option>Feriado Municipal</option>
            </select>
          </div>

          <button disabled={processando} className="w-full xl:w-auto px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {processando ? "Processando..." : "Criar Recesso"}
          </button>
        </form>
      </div>

      {/* LISTA DE FERIADOS */}
      <div>
        <h4 className="font-bold text-slate-700 dark:text-white text-sm uppercase mb-4 pl-1 flex items-center gap-2">
            <Calendar className="w-4 h-4"/> Calendário de Folgas
        </h4>
        
        {loading ? (
            <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400"/></div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {feriados.map(f => (
                <div key={f.id} className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:shadow-md transition-all relative">
                <div className="flex justify-between items-start">
                    <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border ${f.tipo.includes('Feriado') ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                        {f.tipo}
                        </span>
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-lg mb-1">{f.nome}</h4>
                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <CalendarDays className="w-4 h-4"/>
                        {formatDate(f.dataInicio)} até {formatDate(f.dataFim)}
                    </div>
                    </div>
                    <button onClick={() => handleDelete(f.id, f.nome)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                    </button>
                </div>
                </div>
            ))}
            {feriados.length === 0 && (
                <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-20"/>
                Nenhum recesso ou feriado cadastrado.
                </div>
            )}
            </div>
        )}
      </div>
    </div>
  );
}
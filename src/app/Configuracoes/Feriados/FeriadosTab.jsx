import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { Calendar, Plus, Trash2 } from 'lucide-react';

export function FeriadosTab() {
  const [feriados, setFeriados] = useState([]);
  const [form, setForm] = useState({ nome: '', data: '', tipo: 'Nacional' });

  useEffect(() => { loadFeriados(); }, []);

  async function loadFeriados() {
    try {
      const snap = await getDocs(collection(db, "feriados"));
      setFeriados(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error("Erro ao carregar feriados"); }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.nome || !form.data) return alert("Preencha todos os campos!");
    try {
      const docRef = await addDoc(collection(db, "feriados"), form);
      setFeriados([...feriados, { id: docRef.id, ...form }]);
      setForm({ nome: '', data: '', tipo: 'Nacional' });
      alert("Feriado adicionado!");
    } catch (e) { alert("Erro ao salvar"); }
  }

  async function handleDelete(id) {
    if (!window.confirm("Apagar este feriado?")) return;
    try {
      await deleteDoc(doc(db, "feriados", id));
      setFeriados(feriados.filter(f => f.id !== id));
    } catch (e) { alert("Erro ao excluir"); }
  }

  // Ordenar datas
  const feriadosOrdenados = feriados.sort((a, b) => new Date(a.data) - new Date(b.data));

  const formatDate = (date) => {
    if(!date) return "";
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y}`;
  }

  return (
    <div className="p-6 animate-fade-in space-y-8">
      
      {/* CADASTRO */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-red-600"></div>
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="w-5 h-5 text-red-600" />
          <h3 className="font-bold text-slate-700 uppercase text-sm">Adicionar no Calendário</h3>
        </div>
        
        <form onSubmit={handleSave} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nome do Evento</label>
            <input className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-100" 
                   value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: Natal" />
          </div>
          <div className="w-full md:w-40">
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Data</label>
            <input type="date" className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-red-100" 
                   value={form.data} onChange={e => setForm({...form, data: e.target.value})} />
          </div>
          <div className="w-full md:w-40">
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Tipo</label>
            <select className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-100" 
                    value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
              <option>Nacional</option>
              <option>Estadual</option>
              <option>Municipal</option>
            </select>
          </div>
          <button className="w-full md:w-auto px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm shadow-md transition-all flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </form>
      </div>

      {/* VISUALIZAÇÃO DE CARDS */}
      <div>
        <h4 className="font-bold text-slate-700 text-sm uppercase mb-4 pl-1">Próximos Feriados</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {feriadosOrdenados.map(f => (
            <div key={f.id} className="group bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all relative">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${f.tipo === 'Nacional' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {f.tipo}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-slate-800 text-xl">{formatDate(f.data).substring(0, 5)}</h4>
                  <p className="text-sm font-bold text-slate-600 mt-1">{f.nome}</p>
                  <p className="text-xs text-slate-400">{formatDate(f.data).substring(6)}</p>
                </div>
                <button onClick={() => handleDelete(f.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {feriados.length === 0 && (
            <div className="col-span-full py-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
              Nenhum feriado cadastrado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
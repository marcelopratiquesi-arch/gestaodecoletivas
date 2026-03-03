import React, { useState, useEffect, useRef } from 'react';
import { Trophy, CheckCircle2, Activity, Construction, CalendarClock, AlertCircle, Palmtree, Clock, ChevronDown, ArrowUpDown, Search, Users } from 'lucide-react';

export const diasSemanaMap = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };
export const getTodayStr = () => new Date().toLocaleDateString('en-CA'); 

export const normalizeDate = (d) => {
    if (!d) return null;
    if (d.seconds) return new Date(d.seconds * 1000).toLocaleDateString('en-CA');
    if (typeof d === 'string') {
        if (d.includes('/')) { 
            const [dia, mes, ano] = d.split('/');
            return `${ano}-${mes}-${dia}`;
        }
        return d.substring(0, 10);
    }
    return null;
};

export const getDatesInRange = (startDate, endDate) => {
  const dates = [];
  const curr = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (curr <= end) {
    dates.push(new Date(curr).toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
};

export const formatDateShort = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr;
};

export const formatHeaderPeriodo = (inicio, fim) => {
    if (!inicio || !fim) return '';
    const d1 = new Date(inicio + 'T12:00:00'); 
    const d2 = new Date(fim + 'T12:00:00');
    if (inicio === fim) return d1.toLocaleDateString('pt-BR');
    return `${d1.toLocaleDateString('pt-BR')} A ${d2.toLocaleDateString('pt-BR')}`;
};

export const getFirstLast = (fullName) => {
    if (!fullName) return '-';
    const parts = fullName.trim().split(' ');
    return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1]}`;
};

export const sendWhatsApp = (telefone, mensagem) => {
    if (!telefone) { alert("⚠️ TELEFONE NÃO CADASTRADO!"); return; }
    const numeroLimpo = telefone.replace(/\D/g, '');
    window.open(`https://api.whatsapp.com/send?phone=${numeroLimpo}&text=${encodeURIComponent(mensagem)}`, '_blank');
};

// 🟢 CORREÇÃO: Função exportada corretamente para não dar erro SyntaxError
export const getEmojiByPercent = (percent) => {
    if (percent === 100) return '✅';
    if (percent >= 90) return '🟢'; 
    if (percent >= 80) return '🟡'; 
    if (percent >= 60) return '🟠'; 
    return '🔴'; 
};

export const getColorClassByPercent = (percent) => {
    if (percent === 100) return 'bg-emerald-500 shadow-emerald-500/50 text-white';
    if (percent >= 90) return 'bg-lime-500 shadow-lime-500/50 text-white';
    if (percent >= 80) return 'bg-yellow-400 shadow-yellow-400/50 text-yellow-950';
    if (percent >= 60) return 'bg-orange-500 shadow-orange-500/50 text-white';
    return 'bg-red-600 shadow-red-600/50 text-white';
};

export const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('TEXTO COPIADO COM SUCESSO!');
};

export const filterPendingDates = (pendencias) => {
    const today = getTodayStr(); 
    return [...new Set(pendencias.map(p => p.data || p).filter(d => d <= today))].sort();
};

export const getRowColor = (status, diffDays) => {
    if (status === 'FERIADO') return 'bg-purple-50/50 hover:bg-purple-50';
    if (status !== 'REALIZADA' && status !== 'CANCELADA') return 'bg-white hover:bg-slate-50';
    if (diffDays <= 0) return 'bg-emerald-50/30 hover:bg-emerald-50';
    if (diffDays === 1) return 'bg-amber-50/30 hover:bg-amber-50';
    return 'bg-rose-50/30 hover:bg-rose-50';
};

export const SortableHeader = ({ label, sortKey, currentSort, onSort, align = 'left' }) => (
    <th className={`p-4 cursor-pointer hover:bg-slate-100 transition-colors select-none text-[10px] uppercase font-black text-slate-400 tracking-widest ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}`} onClick={() => onSort(sortKey)}>
        <div className={`flex items-center gap-1 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}>
            {label} <ArrowUpDown className={`w-3 h-3 ${currentSort.key === sortKey ? 'text-blue-500 opacity-100' : 'opacity-30'}`}/>
        </div>
    </th>
);

export const KPICard = ({ title, value, icon: Icon, colorClass, iconBg, subTitle }) => (
  <div className={`bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between transition-all hover:shadow-md ${colorClass || ''}`}>
    <div>
      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{title}</p>
      <h3 className="text-3xl font-black text-slate-800 tracking-tight">{value}</h3>
      {subTitle && <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{subTitle}</p>}
    </div>
    <div className={`p-3 rounded-xl shadow-inner ${iconBg}`}>
      <Icon className="w-6 h-6" />
    </div>
  </div>
);

export const StatusBadge = ({ type }) => {
    const configs = {
        'PARABÉNS!': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'TUDO OK!': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'EM ANDAMENTO': 'bg-blue-50 text-blue-600 border-blue-100',
        'EM CONSTRUÇÃO': 'bg-slate-100 text-slate-500 border-slate-200',
        'AGUARDANDO INÍCIO': 'bg-amber-50 text-amber-600 border-amber-100',
        'REALIZADA': 'bg-emerald-50 text-emerald-700 border-emerald-200',
        'CANCELADA': 'bg-rose-50 text-rose-700 border-rose-200',
        'FERIADO': 'bg-purple-50 text-purple-700 border-purple-200',
        'ATRASADO': 'bg-orange-50 text-orange-700 border-orange-200',
        'PENDENTE': 'bg-rose-50 text-rose-700 border-rose-200',
        'FUTURO': 'bg-slate-50 text-slate-400 border-slate-200'
    };
    
    const Icons = {
        'PARABÉNS!': Trophy, 'TUDO OK!': CheckCircle2, 'EM ANDAMENTO': Activity, 
        'EM CONSTRUÇÃO': Construction, 'AGUARDANDO INÍCIO': CalendarClock, 
        'REALIZADA': CheckCircle2, 'CANCELADA': AlertCircle, 'FERIADO': Palmtree, 
        'ATRASADO': Clock, 'PENDENTE': AlertCircle
    };

    const upperType = String(type || '').toUpperCase().trim();
    const IconComp = Icons[upperType] || Activity;

    return (
        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border flex items-center justify-center gap-1.5 shadow-sm w-fit mx-auto whitespace-nowrap ${configs[upperType] || configs['FUTURO']}`}>
            <IconComp className="w-3 h-3" /> {upperType}
        </span>
    );
};

export const MultiSelectDropdown = ({ options, selectedValues, onChange, placeholder, icon: Icon }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [buscaInterna, setBuscaInterna] = useState('');
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => { if (!isOpen) setBuscaInterna(''); }, [isOpen]);

    const toggleOption = (val) => {
        if (selectedValues.includes(val)) onChange(selectedValues.filter(v => v !== val));
        else onChange([...selectedValues, val]);
    };

    const selectAll = () => onChange(options.map(o => o.value));
    const clearAll = () => onChange([]);

    const filteredOptions = options.filter(o => (o.label||'').toLowerCase().includes(buscaInterna.toLowerCase()));

    const displayText = selectedValues.length === 0 
        ? placeholder
        : selectedValues.includes('todos') || (selectedValues.length === options.length && options.length > 0)
            ? `TODOS SELECIONADOS`
            : selectedValues.length === 1 
                ? options.find(o => o.value === selectedValues[0])?.label 
                : `${selectedValues.length} SELECIONADOS`;

    return (
        <div className="relative w-full sm:flex-1" ref={dropdownRef}>
            <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10 pointer-events-none"/>
            <div onClick={() => setIsOpen(!isOpen)} className={`w-full pl-12 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 cursor-pointer shadow-sm flex items-center justify-between hover:border-blue-400 transition-all ${isOpen ? 'ring-2 ring-blue-500' : ''}`}>
                <span className="truncate uppercase">{displayText}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
            </div>
            
            {isOpen && (
                <div className="absolute top-12 left-0 w-full min-w-[250px] bg-white border border-slate-200 shadow-xl rounded-xl z-50 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-slate-100 bg-slate-50 flex gap-2">
                        <button onClick={selectAll} className="text-[9px] font-black text-blue-600 px-3 py-1.5 hover:bg-blue-100 rounded-md uppercase transition-colors flex-1">TODOS</button>
                        <button onClick={clearAll} className="text-[9px] font-black text-rose-600 px-3 py-1.5 hover:bg-rose-100 rounded-md uppercase transition-colors flex-1">LIMPAR</button>
                    </div>
                    <div className="p-2 bg-slate-50 border-b border-slate-100 relative">
                        <Search className="w-3 h-3 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input type="text" placeholder="PESQUISAR..." value={buscaInterna} onChange={(e) => setBuscaInterna(e.target.value)} className="w-full pl-8 pr-2 py-1.5 text-[10px] font-bold uppercase rounded border border-slate-200 outline-none focus:border-blue-500"/>
                    </div>
                    <div className="overflow-y-auto max-h-60 p-1 custom-scrollbar">
                        {filteredOptions.length === 0 && <div className="p-3 text-[10px] text-slate-400 text-center font-bold uppercase">NENHUM RESULTADO</div>}
                        {filteredOptions.map(o => (
                            <label key={o.value} className="flex items-center gap-2 p-2.5 hover:bg-slate-50 cursor-pointer rounded-lg transition-colors">
                                <input type="checkbox" checked={selectedValues.includes(o.value)} onChange={() => toggleOption(o.value)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"/>
                                <span className="text-[10px] font-black uppercase text-slate-700">{o.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
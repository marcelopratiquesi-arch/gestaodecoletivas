import React, { useState, useEffect, useRef } from 'react';
import { Trophy, CheckCircle2, Activity, Construction, CalendarClock, AlertCircle, Palmtree, Clock, ChevronDown, ArrowUpDown, Search, Users } from 'lucide-react';

import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { formatDate, formatPeriod } from '../../utils/formatters';
import { linkWhatsApp } from '../../centrais/contato';
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

export const formatDateShort = (dateStr) => (dateStr ? formatDate(dateStr, 'dayMonth') : '');

export const formatHeaderPeriodo = (inicio, fim) => formatPeriod(inicio, fim);

export const getFirstLast = (fullName) => {
    if (!fullName) return '-';
    const parts = fullName.trim().split(' ');
    return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1]}`;
};

// O número pode estar cadastrado sem o código do país: linkWhatsApp completa com o do país da unidade.
export const sendWhatsApp = (telefone, mensagem, pais = 'BR') => {
    const link = linkWhatsApp(telefone, pais);
    if (!link) { alert(i18n.t('groupValidation.alerts.noPhone')); return; }
    window.open(`${link}?text=${encodeURIComponent(mensagem)}`, '_blank', 'noopener');
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
    if (percent >= 90) return 'bg-emerald-400 shadow-emerald-400/50 text-white';
    if (percent >= 80) return 'bg-amber-400 shadow-amber-400/50 text-amber-950';
    if (percent >= 60) return 'bg-amber-500 shadow-amber-500/50 text-white';
    return 'bg-red-600 shadow-red-600/50 text-white';
};

// Só avisa "copiado" quando copiou de verdade (antes avisava mesmo se o navegador recusasse).
export const copyToClipboard = async (text) => {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch { /* tenta o jeito antigo */ }
    if (!ok) {
        try {
            const area = document.createElement('textarea');
            area.value = text; area.style.position = 'fixed'; area.style.opacity = '0';
            document.body.appendChild(area); area.select();
            ok = document.execCommand('copy');
            document.body.removeChild(area);
        } catch { ok = false; }
    }
    alert(i18n.t(ok ? 'groupValidation.alerts.copied' : 'groupValidation.alerts.copyFailed'));
};

export const filterPendingDates = (pendencias) => {
    const today = getTodayStr();
    return [...new Set(pendencias.map(p => p.data || p).filter(d => d <= today))].sort();
};

export { formatPendencias } from '../../utils/pendencias';

export const getRowColor = (status, diffDays) => {
    if (status === 'FERIADO') return 'bg-slate-50/50 hover:bg-slate-50 dark:bg-slate-900/10 dark:hover:bg-slate-900/20';
    if (status !== 'REALIZADA' && status !== 'CANCELADA') return 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700';
    if (diffDays <= 0) return 'bg-emerald-50/30 hover:bg-emerald-50 dark:bg-emerald-900/10 dark:hover:bg-emerald-900/20';
    if (diffDays === 1) return 'bg-amber-50/30 hover:bg-amber-50 dark:bg-amber-900/10 dark:hover:bg-amber-900/20';
    return 'bg-red-50/30 hover:bg-red-50 dark:bg-red-900/10 dark:hover:bg-red-900/20';
};

export const SortableHeader = ({ label, sortKey, currentSort, onSort, align = 'left' }) => (
    <th className={`p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors select-none text-[10px] uppercase font-black text-slate-400 tracking-widest ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}`} onClick={() => onSort(sortKey)}>
        <div className={`flex items-center gap-1 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}>
            {label} <ArrowUpDown className={`w-3 h-3 ${currentSort.key === sortKey ? 'text-slate-500 opacity-100' : 'opacity-30'}`}/>
        </div>
    </th>
);

export const KPICard = ({ title, value, icon: Icon, colorClass, iconBg, subTitle }) => (
  <div className={`bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between transition-all hover:shadow-md ${colorClass || ''}`}>
    <div>
      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{title}</p>
      <h3 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">{value}</h3>
      {subTitle && <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{subTitle}</p>}
    </div>
    <div className={`p-3 rounded-xl shadow-inner ${iconBg}`}>
      <Icon className="w-6 h-6" />
    </div>
  </div>
);

// Códigos de status usados internamente (em português) -> chave de tradução do selo.
const STATUS_BADGE_KEYS = {
    'PARABÉNS!': 'congrats', 'TUDO OK!': 'allOk', 'EM ANDAMENTO': 'inProgress', 'EM CONSTRUÇÃO': 'underConstruction',
    'AGUARDANDO INÍCIO': 'awaitingStart', 'AGUARDANDO': 'awaiting', 'REALIZADA': 'done', 'VALIDADA': 'validated',
    'CANCELADA': 'canceled', 'FERIADO': 'holiday', 'ATRASADO': 'late', 'PENDENTE': 'pending', 'FUTURO': 'future'
};

export const StatusBadge = ({ type }) => {
    const { t } = useTranslation();
    const configs = {
        'PARABÉNS!': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'TUDO OK!': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'EM ANDAMENTO': 'bg-slate-50 text-slate-600 border-slate-100',
        'EM CONSTRUÇÃO': 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
        'AGUARDANDO INÍCIO': 'bg-amber-50 text-amber-600 border-amber-100',
        'AGUARDANDO': 'bg-amber-50 text-amber-600 border-amber-100',
        'VALIDADA': 'bg-emerald-50 text-emerald-700 border-emerald-200',
        'REALIZADA': 'bg-emerald-50 text-emerald-700 border-emerald-200',
        'CANCELADA': 'bg-red-50 text-red-700 border-red-200',
        'FERIADO': 'bg-slate-50 text-slate-700 border-slate-200',
        'ATRASADO': 'bg-amber-50 text-amber-700 border-amber-200',
        'PENDENTE': 'bg-red-50 text-red-700 border-red-200',
        'FUTURO': 'bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700'
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
            <IconComp className="w-3 h-3" /> {STATUS_BADGE_KEYS[upperType] ? t(`groupValidation.badges.${STATUS_BADGE_KEYS[upperType]}`) : upperType}
        </span>
    );
};

export const MultiSelectDropdown = ({ options, selectedValues, onChange, placeholder, icon: Icon }) => {
    const { t } = useTranslation();
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
            ? t('common.multiSelect.allSelected')
            : selectedValues.length === 1 
                ? options.find(o => o.value === selectedValues[0])?.label 
                : t('common.multiSelect.selected', { count: selectedValues.length });

    return (
        <div className="relative w-full sm:flex-1" ref={dropdownRef}>
            <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10 pointer-events-none"/>
            <div onClick={() => setIsOpen(!isOpen)} className={`w-full pl-12 pr-8 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-600 dark:text-slate-300 cursor-pointer shadow-sm flex items-center justify-between hover:border-slate-400 transition-all ${isOpen ? 'ring-2 ring-red-500' : ''}`}>
                <span className="truncate">{displayText}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
            </div>
            
            {isOpen && (
                <div className="absolute top-12 left-0 w-full min-w-[250px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl z-50 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex gap-2">
                        <button onClick={selectAll} className="text-[9px] font-black text-slate-600 px-3 py-1.5 hover:bg-slate-100 rounded-md uppercase transition-colors flex-1">{t('common.multiSelect.all')}</button>
                        <button onClick={clearAll} className="text-[9px] font-black text-red-600 px-3 py-1.5 hover:bg-red-100 rounded-md uppercase transition-colors flex-1">{t('common.multiSelect.clear')}</button>
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 relative">
                        <Search className="w-3 h-3 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input type="text" placeholder={t('common.multiSelect.search')} value={buscaInterna} onChange={(e) => setBuscaInterna(e.target.value)} className="w-full pl-8 pr-2 py-1.5 text-[10px] font-bold uppercase rounded border border-slate-200 dark:border-slate-700 outline-none focus:border-red-500"/>
                    </div>
                    <div className="overflow-y-auto max-h-60 p-1 custom-scrollbar">
                        {filteredOptions.length === 0 && <div className="p-3 text-[10px] text-slate-400 text-center font-bold uppercase">{t('common.multiSelect.noResults')}</div>}
                        {filteredOptions.map(o => (
                            <label key={o.value} className="flex items-center gap-2 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer rounded-lg transition-colors">
                                <input type="checkbox" checked={selectedValues.includes(o.value)} onChange={() => toggleOption(o.value)} className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-slate-600 focus:ring-red-500"/>
                                <span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-200">{o.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
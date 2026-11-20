// "Quem fez / quem falta": escolhe um workshop (ou uma modalidade) e vê quem já fez e quem ainda não. Baixa em planilha.
// Zero leituras: usa o catálogo de professores que já está carregado. Sem CPF, e-mail ou telefone.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';
import ModalWorkshop from './ModalWorkshop';
import { quemFezWorkshop } from '../../utils/quemFezWorkshop';
import { dataBr, ordenarWorkshops } from '../../utils/workshopCadastro';
import { NOME_POR_GRUPO } from '../../utils/completarModalidade';

const botao = 'px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-all';
const campo = 'p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-bold uppercase text-slate-800 dark:text-white outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100';

export default function QuemFez({ workshops, professores, unidades, onClose }) {
  const { t } = useTranslation();
  const [modo, setModo] = useState('workshop'); // workshop | modalidade
  const [workshopId, setWorkshopId] = useState('');
  const [grupo, setGrupo] = useState('core');
  const [unidadeId, setUnidadeId] = useState('');
  const [mostrar, setMostrar] = useState('faltam'); // faltam | fizeram | todos

  const nomeUnidade = useMemo(() => new Map((unidades || []).map((u) => [String(u.id), u.nome])), [unidades]);
  const validos = useMemo(() => ordenarWorkshops((workshops || []).filter((w) => w.status !== 'cancelado')), [workshops]);
  const alvo = modo === 'workshop' ? { workshopId } : { grupo };
  const pronto = modo === 'modalidade' || !!workshopId;

  const linhas = useMemo(() => {
    if (!pronto) return [];
    return quemFezWorkshop(professores, workshops, alvo)
      .filter((l) => !unidadeId || l.unidadeIds.includes(unidadeId))
      .filter((l) => mostrar === 'todos' || (mostrar === 'fizeram') === l.fez);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professores, workshops, modo, workshopId, grupo, unidadeId, mostrar, pronto]);

  const unidadesDe = (l) => l.unidadeIds.map((id) => nomeUnidade.get(id)).filter(Boolean).join(' · ');
  const fizeram = linhas.filter((l) => l.fez).length;

  const baixar = () => {
    const dados = linhas.map((l) => ({
      [t('shop.ws.who.colName')]: l.nome,
      [t('shop.ws.who.colUnits')]: unidadesDe(l),
      [t('shop.ws.who.colDid')]: l.fez ? t('shop.ws.who.yes') : t('shop.ws.who.no'),
      [t('shop.ws.who.colDate')]: dataBr(l.data),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados), t('shop.ws.who.sheet'));
    XLSX.writeFile(wb, `Workshops_${modo === 'workshop' ? 'workshop' : NOME_POR_GRUPO[grupo].replace(/\s+/g, '_')}.xlsx`);
  };

  return (
    <ModalWorkshop largo titulo={t('shop.ws.who.title')} onClose={onClose}
      rodape={<>
        <button type="button" onClick={onClose} className={`${botao} text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700`}>{t('shop.ws.imp.close')}</button>
        <button type="button" onClick={baixar} disabled={!linhas.length} className={`${botao} bg-red-600 text-white hover:bg-red-700 disabled:opacity-60`}><Download className="w-4 h-4" /> {t('shop.ws.who.download')}</button>
      </>}>
      <p className="text-sm text-slate-500 normal-case">{t('shop.ws.who.hint')}</p>
      <div className="flex flex-wrap gap-2">
        <select className={campo} value={modo} onChange={(e) => setModo(e.target.value)} aria-label={t('shop.ws.who.by')}>
          <option value="workshop">{t('shop.ws.who.byWorkshop')}</option>
          <option value="modalidade">{t('shop.ws.who.byModality')}</option>
        </select>
        {modo === 'workshop' ? (
          <select className={`${campo} flex-1 min-w-[220px]`} value={workshopId} onChange={(e) => setWorkshopId(e.target.value)} aria-label={t('shop.ws.who.pickWorkshop')}>
            <option value="">{t('shop.ws.who.pickWorkshop')}</option>
            {validos.map((w) => <option key={w.id} value={w.id}>{`${w.nome} · ${dataBr(w.data)}`}</option>)}
          </select>
        ) : (
          <select className={campo} value={grupo} onChange={(e) => setGrupo(e.target.value)} aria-label={t('shop.ws.modality')}>
            {Object.entries(NOME_POR_GRUPO).map(([g, nome]) => <option key={g} value={g}>{nome}</option>)}
          </select>
        )}
        <select className={campo} value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)} aria-label={t('shop.ws.who.unit')}>
          <option value="">{t('shop.ws.who.allUnits')}</option>
          {(unidades || []).map((u) => <option key={u.id} value={String(u.id)}>{u.nome}</option>)}
        </select>
        <select className={campo} value={mostrar} onChange={(e) => setMostrar(e.target.value)} aria-label={t('shop.ws.who.show')}>
          <option value="faltam">{t('shop.ws.who.showMissing')}</option>
          <option value="fizeram">{t('shop.ws.who.showDid')}</option>
          <option value="todos">{t('shop.ws.who.showAll')}</option>
        </select>
      </div>
      {!pronto ? (
        <div className="py-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">{t('shop.ws.who.pickFirst')}</div>
      ) : (
        <>
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{t('shop.ws.who.count', { total: linhas.length, did: fizeram })}</p>
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead><tr className="bg-slate-50 dark:bg-slate-900 text-left text-[10px] font-black uppercase tracking-widest text-slate-500"><th className="p-2">{t('shop.ws.who.colName')}</th><th className="p-2">{t('shop.ws.who.colUnits')}</th><th className="p-2">{t('shop.ws.who.colDid')}</th><th className="p-2">{t('shop.ws.who.colDate')}</th></tr></thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.chave} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="p-2 font-bold">{l.nome}</td>
                    <td className="p-2 text-[11px] text-slate-500">{unidadesDe(l)}</td>
                    <td className="p-2"><span className={`px-2 py-1 rounded-full text-[11px] font-bold ${l.fez ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>{l.fez ? t('shop.ws.who.yes') : t('shop.ws.who.no')}</span></td>
                    <td className="p-2 text-[11px] text-slate-500">{dataBr(l.data)}</td>
                  </tr>
                ))}
                {linhas.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">{t('shop.ws.who.empty')}</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </ModalWorkshop>
  );
}

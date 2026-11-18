// Calendário SUGERIDO de feriados nacionais (só admin). Nada é aplicado sozinho: cada item vira um feriado
// de abrangência "país" quando o admin manda; os que ele não quer ficam "dispensados" (só neste navegador).
import React, { useMemo, useState } from 'react';
import { db } from '../../../services/firebase';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { CalendarCheck, ChevronDown, Loader2, CheckSquare, Square, EyeOff, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PAISES_SUGERIDOS, feriadosSugeridos, sugestaoJaAplicada } from '../../../utils/feriadosSugeridos';
import { impactoDoFeriado, comecaNoPassado } from '../../../utils/feriadosImpacto';
import { dataLocalStr } from '../../../utils/agendaAulas';

const CHAVE_DISPENSADOS = 'feriadosSugeridosDispensados';

const lerDispensados = () => {
  try { return new Set(JSON.parse(localStorage.getItem(CHAVE_DISPENSADOS) || '[]')); } catch { return new Set(); }
};
const gravarDispensados = (conjunto) => {
  try { localStorage.setItem(CHAVE_DISPENSADOS, JSON.stringify([...conjunto])); } catch { /* sem armazenamento: só vale nesta tela */ }
};

const formatar = (d) => String(d || '').split('-').reverse().join('/');

export function FeriadosSugeridos({ feriados, unidades, aulas, usuario }) {
  const { t } = useTranslation();
  const anoAtual = new Date().getFullYear();
  const [aberto, setAberto] = useState(false);
  const [pais, setPais] = useState('BR');
  const [ano, setAno] = useState(anoAtual);
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [dispensados, setDispensados] = useState(lerDispensados);
  const [mostrarDispensados, setMostrarDispensados] = useState(false);
  const [processando, setProcessando] = useState(false);

  const hoje = dataLocalStr();
  const sugestoes = useMemo(() => feriadosSugeridos(pais, ano).map(s => ({
    ...s,
    aplicado: sugestaoJaAplicada(s, feriados),
    dispensado: dispensados.has(s.chave),
    passou: s.dataFim < hoje,
  })), [pais, ano, feriados, dispensados, hoje]);

  const visiveis = sugestoes.filter(s => mostrarDispensados || !s.dispensado);
  const pendentes = sugestoes.filter(s => !s.aplicado && !s.dispensado).length;

  const alternar = (chave) => setSelecionados(prev => {
    const novo = new Set(prev);
    if (novo.has(chave)) novo.delete(chave); else novo.add(chave);
    return novo;
  });

  const dispensar = (chave, valor) => {
    const novo = lerDispensados();
    if (valor) novo.add(chave); else novo.delete(chave);
    gravarDispensados(novo);
    setDispensados(novo);
    setSelecionados(prev => { const p = new Set(prev); p.delete(chave); return p; });
  };

  async function aplicar(lista) {
    if (lista.length === 0) return;
    const feriadosNovos = lista.map(s => ({ nome: s.nome, dataInicio: s.dataInicio, dataFim: s.dataFim, tipo: s.tipo, escopo: 'pais', pais: s.pais }));
    const impactos = feriadosNovos.map(f => impactoDoFeriado({ feriado: f, unidades, aulas }));
    const totalAulas = impactos.reduce((soma, i) => soma + i.aulas, 0);
    const nomes = lista.slice(0, 6).map(s => `• ${s.nome} (${formatar(s.dataInicio)}${s.dataFim !== s.dataInicio ? ` – ${formatar(s.dataFim)}` : ''})`).join('\n');
    const mais = lista.length > 6 ? `\n${t('holidaysTab.suggested.andMore', { count: lista.length - 6 })}` : '';
    const passado = feriadosNovos.some(f => comecaNoPassado(f)) ? `\n\n${t('holidaysTab.pastWarn')}` : '';
    if (!window.confirm(`${t('holidaysTab.suggested.confirmApply', { count: lista.length, classes: totalAulas })}\n\n${nomes}${mais}${passado}`)) return;

    setProcessando(true);
    try {
      const nomeUsuario = usuario?.nome || usuario?.email || 'Administrador do Sistema';
      const idUsuario = usuario?.id || usuario?.uid || null;
      const lote = writeBatch(db);
      lista.forEach((s, i) => {
        lote.set(doc(collection(db, 'feriados')), { ...feriadosNovos[i], criadoPor: idUsuario, criadoEm: serverTimestamp(), origemSugestao: s.chave });
        lote.set(doc(collection(db, 'auditoria_cronograma')), {
          tipoAcao: 'NOVA', descricao: 'Calendário: Feriado sugerido aplicado.',
          diffExtras: `Período: ${formatar(s.dataInicio)} até ${formatar(s.dataFim)} | País: ${s.pais} | ${impactos[i].unidades} unidade(s), ${impactos[i].aulas} aula(s)`,
          modulo: 'CONFIGURACOES', unidadeNome: 'Rede Global', professorNome: '-', modalidadeNome: s.nome,
          usuarioAcaoNome: nomeUsuario, usuarioAcaoId: idUsuario, dataAcao: serverTimestamp(),
        });
      });
      await lote.commit();
      setSelecionados(new Set());
      alert(t('holidaysTab.suggested.applied', { count: lista.length }));
    } catch (e) {
      console.error(e);
      alert(t('holidaysTab.suggested.error'));
    } finally { setProcessando(false); }
  }

  const escolhidos = sugestoes.filter(s => selecionados.has(s.chave) && !s.aplicado && !s.dispensado);
  const anos = [anoAtual - 1, anoAtual, anoAtual + 1, anoAtual + 2];
  const inputClass = 'p-2.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500';

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
      <button type="button" onClick={() => setAberto(!aberto)} className="w-full flex items-center justify-between gap-3 px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
        <span className="flex items-center gap-2 font-bold text-slate-700 dark:text-white uppercase text-sm">
          <CalendarCheck className="w-5 h-5 text-pink-600" /> {t('holidaysTab.suggested.title')}
          {pendentes > 0 && <span className="px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 text-[10px]">{t('holidaysTab.suggested.pending', { count: pendentes })}</span>}
        </span>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="px-6 pb-6 space-y-4 border-t border-slate-100 dark:border-slate-700 pt-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('holidaysTab.suggested.desc')}</p>

          <div className="flex flex-wrap items-center gap-3">
            <select className={inputClass} value={pais} onChange={e => { setPais(e.target.value); setSelecionados(new Set()); }}>
              {PAISES_SUGERIDOS.map(p => <option key={p} value={p}>{t(`common.countries.${p}`)}</option>)}
            </select>
            <select className={inputClass} value={ano} onChange={e => { setAno(Number(e.target.value)); setSelecionados(new Set()); }}>
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase cursor-pointer">
              <input type="checkbox" checked={mostrarDispensados} onChange={e => setMostrarDispensados(e.target.checked)} /> {t('holidaysTab.suggested.showDismissed')}
            </label>
            <button
              type="button" disabled={processando || escolhidos.length === 0} onClick={() => aplicar(escolhidos)}
              className="ml-auto px-4 py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-lg text-xs uppercase flex items-center gap-2 disabled:opacity-40"
            >
              {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />} {t('holidaysTab.suggested.applySelected', { count: escolhidos.length })}
            </button>
          </div>

          {(pais === 'AR') && <p className="text-xs text-amber-600">{t('holidaysTab.suggested.warnAR')}</p>}

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
            {visiveis.map(s => {
              const bloqueado = s.aplicado || s.dispensado;
              const marcado = selecionados.has(s.chave);
              return (
                <div key={s.chave} className={`flex items-center gap-3 px-4 py-3 ${bloqueado || s.passou ? 'opacity-60' : ''}`}>
                  <button type="button" disabled={bloqueado} onClick={() => alternar(s.chave)} className="shrink-0 disabled:cursor-not-allowed">
                    {marcado && !bloqueado ? <CheckSquare className="w-5 h-5 text-pink-600" /> : <Square className="w-5 h-5 text-slate-300" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{s.nome}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatar(s.dataInicio)}{s.dataFim !== s.dataInicio ? ` – ${formatar(s.dataFim)}` : ''}
                      {s.nota ? ` · ${s.nota}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.conferir && <span className="px-2 py-1 text-[10px] font-bold uppercase rounded bg-amber-50 text-amber-700 border border-amber-200">{t('holidaysTab.suggested.check')}</span>}
                    {s.passou && <span className="px-2 py-1 text-[10px] font-bold uppercase rounded bg-slate-100 text-slate-500">{t('holidaysTab.suggested.past')}</span>}
                    {s.aplicado && <span className="px-2 py-1 text-[10px] font-bold uppercase rounded bg-emerald-50 text-emerald-700 border border-emerald-200">{t('holidaysTab.suggested.applied_badge')}</span>}
                    {!s.aplicado && !s.dispensado && (
                      <>
                        <button type="button" disabled={processando} onClick={() => aplicar([s])} className="px-3 py-1.5 bg-pink-50 hover:bg-pink-600 text-pink-600 hover:text-white text-[11px] font-bold uppercase rounded-lg transition-colors disabled:opacity-50">{t('holidaysTab.suggested.apply')}</button>
                        <button type="button" onClick={() => dispensar(s.chave, true)} title={t('holidaysTab.suggested.dismiss')} className="p-1.5 text-slate-400 hover:text-slate-600"><EyeOff className="w-4 h-4" /></button>
                      </>
                    )}
                    {s.dispensado && !s.aplicado && (
                      <button type="button" onClick={() => dispensar(s.chave, false)} title={t('holidaysTab.suggested.restore')} className="p-1.5 text-slate-400 hover:text-slate-600"><Undo2 className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
              );
            })}
            {visiveis.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">{t('holidaysTab.suggested.empty')}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

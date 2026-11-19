// Janela "Corrigir" do relatório de repetidos: troca o e-mail/telefone de uma ficha ou de um crachá.
// Telefone em branco = apagar (ex.: conta de admin da mesma pessoa, que não precisa de telefone).
// O e-mail do crachá é o do login do Google: só a ficha da grade tem o e-mail editável aqui.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, Pencil, TriangleAlert, CircleCheck } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useCatalogs } from '../../../contexts/CatalogContext';
import { corrigirContato } from '../../../services/corrigirContatoService';
import { chaveTelefone, emailDeMentira, emailFormatoValido, normalizarEmail } from '../../../utils/repetidos';

const CAMPO = 'w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm';

export default function CorrigirContatoModal({ item, todos = [], rotuloOrigem, aoCorrigir, aoFechar }) {
  const { t } = useTranslation();
  const { user, userData } = useAuth();
  const { catalogs } = useCatalogs();
  const ehFicha = item.origem === 'professor';
  const [email, setEmail] = useState(item.email || '');
  const [telefone, setTelefone] = useState(item.telefone || '');
  const [etapa, setEtapa] = useState('editando'); // editando | gravando | feito
  const [erro, setErro] = useState('');

  // Nome de quem já tem o dado (a reserva guarda o login e/ou a ficha).
  const nomeDoDono = (dono) => {
    if (!dono) return '';
    const achado = todos.find(r => (r.origem === 'cracha' && dono.uid && r.id === dono.uid)
      || (r.origem === 'professor' && dono.professorId && r.id === String(dono.professorId)));
    return achado ? `${rotuloOrigem(achado.origem)} · ${achado.nome || '—'}` : '';
  };

  const salvar = async () => {
    setErro('');
    const emailNovo = normalizarEmail(email);
    const telNovo = telefone.trim();
    if (ehFicha && emailNovo !== normalizarEmail(item.email) && (!emailFormatoValido(emailNovo) || emailDeMentira(emailNovo))) {
      return setErro(t('backupTab.fix.emailInvalid'));
    }
    if (telNovo && !chaveTelefone(telNovo, item.pais)) return setErro(t('backupTab.fix.phoneInvalid'));
    if (emailNovo === normalizarEmail(item.email) && telNovo === (item.telefone || '')) return aoFechar();

    setEtapa('gravando');
    try {
      const { conflitos } = await corrigirContato({
        item, novo: { email: emailNovo, telefone: telNovo }, unidades: catalogs?.unidades || [],
        quem: { id: user?.uid, nome: userData?.nome, email: userData?.email },
      });
      if (conflitos.length) {
        const nomes = [...new Set(conflitos.map(c => nomeDoDono(c.dono)).filter(Boolean))].join(', ');
        setEtapa('editando');
        return setErro(t('backupTab.fix.taken', { who: nomes || t('backupTab.fix.someoneElse') }));
      }
      aoCorrigir?.(item, { email: ehFicha ? emailNovo : item.email, telefone: telNovo });
      setEtapa('feito');
    } catch (e) {
      console.error('Corrigir contato:', e);
      setEtapa('editando');
      setErro(t('backupTab.fix.error'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Pencil className="w-5 h-5 text-amber-600" /> {t('backupTab.fix.title')}
            </h3>
            <p className="text-sm text-slate-500 mt-1">{rotuloOrigem(item.origem)} · {item.nome || '—'}{item.unidade ? ` · ${item.unidade}` : ''}</p>
          </div>
          <button onClick={aoFechar} disabled={etapa === 'gravando'} className="p-1 text-slate-400 hover:text-red-600 rounded" title={t('common.actions.cancel')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {etapa === 'feito' ? (
          <p className="p-3 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-bold flex items-center gap-2">
            <CircleCheck className="w-4 h-4 shrink-0" /> {t('backupTab.fix.done')}
          </p>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase">{t('backupTab.duplicates.sheet.email')}</span>
              <input value={email} onChange={e => setEmail(e.target.value)} disabled={!ehFicha || etapa === 'gravando'} className={`${CAMPO} disabled:opacity-60`} />
              {!ehFicha && <span className="block mt-1 text-[11px] text-slate-400">{t('backupTab.fix.loginEmail')}</span>}
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase">{t('backupTab.duplicates.sheet.phone')}</span>
              <input value={telefone} onChange={e => setTelefone(e.target.value)} disabled={etapa === 'gravando'} className={CAMPO} placeholder={t('backupTab.fix.phoneEmpty')} />
              <span className="block mt-1 text-[11px] text-slate-400">{t('backupTab.fix.phoneHint')}</span>
            </label>
          </div>
        )}
        {erro && (
          <p className="p-3 rounded-lg bg-red-100 text-red-700 text-sm font-bold flex items-center gap-2">
            <TriangleAlert className="w-4 h-4 shrink-0" /> {erro}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {etapa === 'feito' ? (
            <button onClick={aoFechar} className="py-2 px-4 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-bold">{t('backupTab.merge.close')}</button>
          ) : (
            <>
              <button onClick={aoFechar} disabled={etapa === 'gravando'} className="py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 disabled:opacity-50">
                {t('common.actions.cancel')}
              </button>
              <button onClick={salvar} disabled={etapa === 'gravando'}
                className="py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                {etapa === 'gravando' && <Loader2 className="w-4 h-4 animate-spin" />} {t('backupTab.fix.save')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

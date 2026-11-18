// "Criar reservas dos cadastros atuais" (só admin, dentro do relatório de repetidos): grava a trava de e-mail e
// telefone (contatos_unicos) para quem já está cadastrado — fichas da grade e crachás. Não muda nenhum cadastro.
// O que não dá para reservar (o mesmo dado em pessoas diferentes) aparece como conflito: é a limpeza que falta
// antes da parte B da F3 (bloquear repetidos). Lê todas as reservas uma vez (só ao clicar).
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Lock, TriangleAlert } from 'lucide-react';
import { planejarReservas } from '../../../utils/contatos';
import { gravarReservas, lerTodasAsReservas } from '../../../services/contatoService';

// A reserva já gravada é da mesma pessoa do plano? (mesmo login ou mesma ficha)
const compartilhaDono = (a, b) => (!!a.uid && a.uid === b.uid) || (!!a.professorId && a.professorId === b.professorId);
const iguais = (a, b) => a.tipo === b.tipo && (a.uid || '') === (b.uid || '') && (a.professorId || '') === (b.professorId || '');

export default function CriarReservas({ registros, rotuloOrigem }) {
  const { t } = useTranslation();
  const [estado, setEstado] = useState({ trabalhando: false, erro: false, resultado: null });

  const criar = async () => {
    setEstado({ trabalhando: true, erro: false, resultado: null });
    try {
      const { reservas, conflitos } = planejarReservas(registros);
      const existentes = await lerTodasAsReservas();
      const gravar = [];
      const tomadas = [];
      let certas = 0;
      for (const [id, dados] of reservas) {
        const ja = existentes.get(id);
        if (!ja) gravar.push([id, dados]);
        else if (iguais(ja, dados)) certas++;
        else if (compartilhaDono(ja, dados)) gravar.push([id, dados]); // mesma pessoa: completa login/ficha
        else tomadas.push({ id, tipo: dados.tipo, itens: [] });
      }
      await gravarReservas(gravar);
      setEstado({ trabalhando: false, erro: false, resultado: { criadas: gravar.length, certas, conflitos, tomadas } });
    } catch (e) {
      console.error('Criar reservas de e-mail/telefone:', e);
      setEstado({ trabalhando: false, erro: true, resultado: null });
    }
  };

  const valor = (id) => id.replace(/^email_|^tel_[A-Z]{2}:/, '');
  const res = estado.resultado;

  return (
    <div className="mb-4 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">{t('contacts.reserve.hint')}</p>
        <button onClick={criar} disabled={estado.trabalhando}
          className="py-1.5 px-3 border border-slate-300 dark:border-slate-600 rounded-lg flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50">
          {estado.trabalhando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
          {estado.trabalhando ? t('contacts.reserve.working') : t('contacts.reserve.button')}
        </button>
      </div>
      {estado.erro && (
        <p className="mt-2 text-xs font-bold text-red-600 flex items-center gap-1"><TriangleAlert className="w-4 h-4" /> {t('contacts.reserve.error')}</p>
      )}
      {res && (
        <div className="mt-2 space-y-2">
          <p className="text-xs font-bold text-green-700 dark:text-green-400">{t('contacts.reserve.done', { created: res.criadas, ok: res.certas })}</p>
          {res.conflitos.length === 0 && res.tomadas.length === 0 && <p className="text-xs text-slate-500">{t('contacts.reserve.none')}</p>}
          {res.conflitos.length > 0 && (
            <div>
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400">{t('contacts.reserve.conflicts', { count: res.conflitos.length })}</p>
              <ul className="mt-1 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
                {res.conflitos.map(c => (
                  <li key={c.id} className="px-3 py-1.5">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 break-all">
                      {t(`contacts.reserve.type.${c.tipo}`)}: {valor(c.id)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {c.itens.map(i => `${rotuloOrigem(i.origem)} · ${i.nome || '—'}`).join('  |  ')}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {res.tomadas.length > 0 && (
            <p className="text-xs text-slate-500 break-all">
              {t('contacts.reserve.taken', { count: res.tomadas.length })}: {res.tomadas.map(x => valor(x.id)).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

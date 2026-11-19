// Quadros que mais de uma Central usa (professores, grade da semana, "Está tudo em dia?", cartão de pessoa).
// Só leitura: mostram e levam para a tela certa.
import { useTranslation } from 'react-i18next';
import { ListChecks, Phone, Mail } from 'lucide-react';
import Quadro from './pecas/Quadro';
import ItemEmDia from './pecas/ItemEmDia';
import Contato from './pecas/Contato';
import EmBreve from './pecas/EmBreve';
import { Vazio } from './pecas/Basicos';
import { ROTULO, TH, TD, SELO_ATIVO, SELO_INATIVO } from './pecas/cores';
import LinkCentral from './LinkCentral';
import { resumoDoAcesso } from '../utils/ultimoAcesso';
import { formatWeekday, formatNumber, formatCurrency } from '../utils/formatters';

// ---------- Está tudo em dia? ----------
// itens: [{ id, ok, nivel, quantidade? }] · prefixo: onde estão os textos (ex.: 'centrais.unidade.emDia.itens')
// caminhos: { [id]: função que leva para a tela de resolver } (sem função = sem botão)
export function QuadroEmDia({ itens, prefixo, caminhos = {} }) {
  const { t } = useTranslation();
  return (
    <Quadro titulo={t('centrais.emDia.titulo')} icone={ListChecks}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {itens.map((item) => (
          <ItemEmDia
            key={item.id}
            ok={item.ok}
            nivel={item.nivel}
            titulo={t(`${prefixo}.${item.id}.titulo`)}
            frase={item.ok ? t('centrais.emDia.ok') : t(`${prefixo}.${item.id}.falta`, { n: item.quantidade })}
            textoAcao={t(`${prefixo}.${item.id}.acao`)}
            onAcao={caminhos[item.id] || null}
          />
        ))}
      </div>
    </Quadro>
  );
}

// ---------- Tabela de professores ----------
// linhas: [{ professor, ativo, aulasNaSemana, unidades? }] — com `unidades`, mostra a coluna de unidades.
// pagamentos (opcional): Map professorId -> { realizadas, valor } do período; mostra as colunas
// "Aulas dadas" e "Recebeu" (null = ainda carregando).
export function TabelaProfessores({ linhas, paisPadrao, textoVazio, pagamentos, moedaDoPais }) {
  const { t } = useTranslation();
  if (linhas.length === 0) return <Vazio texto={textoVazio} />;
  const comUnidades = linhas.some((l) => l.unidades);
  const comPagamentos = pagamentos !== undefined;
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className={`w-full text-[12px] ${comPagamentos ? 'min-w-[720px]' : 'min-w-[560px]'}`}>
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800">
            <th className={TH}>{t('centrais.professores.nome')}</th>
            <th className={TH}>{t('centrais.professores.contato')}</th>
            {comUnidades && <th className={TH}>{t('centrais.professores.unidades')}</th>}
            <th className={`${TH} text-center`}>{t('centrais.professores.aulasSemana')}</th>
            {comPagamentos && <th className={`${TH} text-center`}>{t('centrais.professores.aulasDadas')}</th>}
            {comPagamentos && <th className={`${TH} text-right`}>{t('centrais.professores.recebeu')}</th>}
            <th className={TH}>{t('centrais.professores.situacao')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {linhas.map(({ professor, ativo, aulasNaSemana, unidades }) => (
            <tr key={professor.id}>
              <td className={`${TD} font-bold text-slate-800 dark:text-white`}>
                <LinkCentral tipo="professor" alvo={professor}>{professor.nome}</LinkCentral>
              </td>
              <td className={TD}>
                <div className="flex flex-col gap-0.5">
                  {professor.telefone && <Contato icone={Phone} texto={professor.telefone} copiar whatsapp pais={professor.pais || paisPadrao} />}
                  {professor.email && <Contato icone={Mail} texto={professor.email} copiar />}
                  {!professor.telefone && !professor.email && <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{t('centrais.professores.semContato')}</span>}
                </div>
              </td>
              {comUnidades && (
                <td className={`${TD} text-[11px] font-semibold text-slate-600 dark:text-slate-300`}>
                  {(unidades || []).map((u) => u.nome).join(', ')}
                </td>
              )}
              <td className={`${TD} text-center font-extrabold ${aulasNaSemana ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>{aulasNaSemana}</td>
              {comPagamentos && (
                <td className={`${TD} text-center font-extrabold text-slate-800 dark:text-white`}>
                  {pagamentos ? formatNumber(pagamentos.get(String(professor.id))?.realizadas || 0) : '…'}
                </td>
              )}
              {comPagamentos && (
                <td className={`${TD} text-right font-extrabold text-slate-800 dark:text-white whitespace-nowrap`}>
                  {pagamentos ? formatCurrency(pagamentos.get(String(professor.id))?.valor || 0, moedaDoPais || paisPadrao) : '…'}
                </td>
              )}
              <td className={TD}>
                <span className={ativo ? SELO_ATIVO : SELO_INATIVO}>{ativo ? t('centrais.ativo') : t('centrais.inativo')}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Grade da semana ----------
// grade: [{ dia, aulas }] (gradePorDia). Segunda linha de cada aula: o professor (padrão) ou a unidade.
export function GradeSemanal({ grade, modalidadePorId, professorPorId, unidadePorId = null, textoVazio }) {
  const { t } = useTranslation();
  if (grade.length === 0) return <Vazio texto={textoVazio} />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {grade.map(({ dia, aulas }) => (
        <div key={dia} className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <p className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-300 flex items-center justify-between">
            {formatWeekday(dia)}
            <span className="text-slate-400">{aulas.length}</span>
          </p>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {aulas.map((aula) => {
              const modalidade = modalidadePorId.get(String(aula.modalidadeId));
              const professor = professorPorId?.get(String(aula.professorId));
              const unidade = unidadePorId?.get(String(aula.unidadeId));
              return (
                <li key={`${dia}-${aula.id}`} className="px-3 py-2 flex items-center gap-2 text-[12px]">
                  <span className="font-extrabold text-slate-800 dark:text-white tabular-nums w-11 shrink-0">{aula.hora}</span>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: modalidade?.cor || '#94a3b8' }} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-slate-700 dark:text-slate-200 truncate">{modalidade?.nome || t('common.unknown.modality')}</span>
                    {unidadePorId ? (
                      <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">{unidade?.nome || t('common.unknown.unit')}</span>
                    ) : professor ? (
                      <LinkCentral tipo="professor" alvo={professor} className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{professor.nome}</LinkCentral>
                    ) : (
                      <span className="block text-[11px] font-semibold text-rose-600 dark:text-rose-400 truncate">{t('common.unknown.noTeacher')}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ---------- Cartão de pessoa (mentor, líder) ----------
// `link` = { tipo, alvo } deixa o nome clicável (abre a Central daquela pessoa).
export function CartaoPessoa({ icone: Icone, papel, nome, vazio, link = null, children }) {
  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-4">
      <p className={`${ROTULO} flex items-center gap-1.5`}>{Icone && <Icone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />} {papel}</p>
      {nome ? (
        <>
          <p className="mt-1 text-[14px] font-extrabold uppercase text-slate-800 dark:text-white break-words">
            {link ? <LinkCentral tipo={link.tipo} alvo={link.alvo}>{nome}</LinkCentral> : nome}
          </p>
          <div className="mt-2 flex flex-col gap-1">{children}</div>
        </>
      ) : (
        <p className="mt-1 text-[13px] font-bold text-rose-600 dark:text-rose-400">{vazio}</p>
      )}
    </div>
  );
}

// Data e hora do último acesso ("12/11/2026 · 14:32 (hoje)"); sem o dado, "Em breve".
export function UltimoAcessoTexto({ quando }) {
  const { i18n } = useTranslation();
  const ac = resumoDoAcesso(quando, i18n.language);
  return ac ? <span className="text-slate-700 dark:text-slate-200">{ac.dia} · {ac.hora} ({ac.relativo})</span> : <EmBreve />;
}

// "Último acesso: ..." (só o mentor tem o dado por enquanto; os demais mostram "Em breve").
export function UltimoAcesso({ quando }) {
  const { t } = useTranslation();
  return (
    <p className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
      {t('centrais.ultimoAcesso')} <UltimoAcessoTexto quando={quando} />
    </p>
  );
}

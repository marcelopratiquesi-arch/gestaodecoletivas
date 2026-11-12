// O que uma aula permite agora na Validação Diária (usado pelo cartão e pela lista).
export function estadoDaAula(item, isFuture, t) {
    const bloqueioPrazo = !isFuture && item.prazo && !item.prazo.pode ? item.prazo.motivo : null;
    const bloqueado = !isFuture && (item.somenteLeitura || !!bloqueioPrazo);
    const textoBloqueio = item.somenteLeitura
        ? (item.isAulao ? t('dailyValidation.deadline.cardReadOnly') : t('dailyValidation.deadline.cardSubstitute'))
        : bloqueioPrazo === 'mesFechado' ? t('dailyValidation.deadline.cardClosedMonth')
        : bloqueioPrazo ? t('dailyValidation.deadline.cardOutOfDeadline') : null;
    const exigeJustificativa = !isFuture && !bloqueado && !!item.prazo?.precisaJustificativa;
    // Validar direto: aula da grade pendente, liberada e sem justificativa pendente.
    const validacaoRapida = item.status === 'pendente' && !isFuture && !bloqueado && !exigeJustificativa && !item.isAulao;
    return { bloqueado, textoBloqueio, exigeJustificativa, validacaoRapida };
}

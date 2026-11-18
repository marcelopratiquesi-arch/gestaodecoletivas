// Calcula os selos de "possível repetido" de uma lista de registros ({ origem, id, nome, email, telefone, pais, uidLogin? }).
// Chave de cada selo: `${origem}:${id}`.
import { useMemo } from 'react';
import { analisarRepetidos } from '../../../utils/repetidos';

export function useSelosRepetidos(registros) {
  return useMemo(() => analisarRepetidos(registros).selos, [registros]);
}

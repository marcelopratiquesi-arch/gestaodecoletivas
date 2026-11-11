// "Vitrine" da página pública de horários (/horarios).
//
// A página pública é aberta sem login. Antes ela lia os cadastros completos de unidades e professores,
// expondo na internet e-mails, telefones e IDs de login. Agora ela lê UM documento (publico/vitrine)
// que contém só o que aparece na tela:
//   unidades:    { [id]: { nome, cidade, estado, enderecoCompleto, linkGoogleMaps, localizacao } }
//   professores: { [id]: nome }
// Bônus: 1 leitura por visita em vez de (nº de unidades + nº de professores).
//
// As telas de cadastro chamam as funções abaixo depois de salvar. Se alguma falhar, o cadastro
// continua salvo normalmente e o admin pode usar "Atualizar página pública" (reconstruirVitrine).
// Enquanto a vitrine não for montada pela primeira vez, essas funções não fazem nada (só avisam no console).
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteField, serverTimestamp, FieldPath } from 'firebase/firestore';
import { db } from './firebase';

export const VITRINE_CAMINHO = ['publico', 'vitrine'];
const refVitrine = () => doc(db, ...VITRINE_CAMINHO);

// Únicos campos da unidade que a página pública usa.
const CAMPOS_PUBLICOS_UNIDADE = ['nome', 'cidade', 'estado', 'enderecoCompleto', 'linkGoogleMaps', 'localizacao'];

export const ehCampoPublicoUnidade = (campo) => CAMPOS_PUBLICOS_UNIDADE.includes(campo);

export function dadosPublicosUnidade(dados) {
    const publico = {};
    for (const campo of CAMPOS_PUBLICOS_UNIDADE) {
        const valor = dados?.[campo];
        if (typeof valor === 'string' && valor.trim() !== '') publico[campo] = valor;
    }
    return publico;
}

const avisar = (acao, erro) => console.warn(`[vitrine] não foi possível ${acao}; use "Atualizar página pública".`, erro);

/** Unidades criadas/editadas: grava (substitui) a versão pública delas, tudo numa gravação só. */
export async function publicarUnidades(lista) {
    if (!lista.length) return;
    try {
        const pares = lista.flatMap(({ id, dados }) => [new FieldPath('unidades', id), dadosPublicosUnidade(dados)]);
        await updateDoc(refVitrine(), 'atualizadoEm', serverTimestamp(), ...pares);
    } catch (e) { avisar('atualizar as unidades', e); }
}

export const publicarUnidade = (id, dados) => publicarUnidades([{ id, dados }]);

export async function removerUnidadeDaVitrine(id) {
    try {
        await updateDoc(refVitrine(), new FieldPath('unidades', id), deleteField(), 'atualizadoEm', serverTimestamp());
    } catch (e) { avisar('remover a unidade', e); }
}

/** Professor criado/editado: grava só o nome. */
export async function publicarProfessor(id, nome) {
    try {
        await updateDoc(refVitrine(), new FieldPath('professores', id), String(nome || ''), 'atualizadoEm', serverTimestamp());
    } catch (e) { avisar('atualizar o professor', e); }
}

export async function removerProfessorDaVitrine(id) {
    try {
        await updateDoc(refVitrine(), new FieldPath('professores', id), deleteField(), 'atualizadoEm', serverTimestamp());
    } catch (e) { avisar('remover o professor', e); }
}

// Limite de 1 MiB por documento no Firestore; paramos antes, com folga.
const LIMITE_BYTES = 900 * 1024;

/**
 * Remonta a vitrine inteira a partir dos cadastros (só admin, precisa de login).
 * Custa 1 leitura por unidade + 1 por professor, e 1 gravação. Retorna os totais.
 */
export async function reconstruirVitrine() {
    const [uSnap, pSnap] = await Promise.all([
        getDocs(collection(db, 'unidades')),
        getDocs(collection(db, 'professores')),
    ]);
    const unidades = {};
    uSnap.forEach(d => {
        const dados = d.data();
        // A página antiga usava orderBy('nome'), que ignora unidades sem nome; mantemos igual.
        if (typeof dados.nome === 'string') unidades[d.id] = dadosPublicosUnidade(dados);
    });
    const professores = {};
    pSnap.forEach(d => { professores[d.id] = String(d.data().nome || ''); });

    const tamanho = new Blob([JSON.stringify({ unidades, professores })]).size;
    if (tamanho > LIMITE_BYTES) throw new Error(`Vitrine grande demais (${Math.round(tamanho / 1024)} KB).`);

    await setDoc(refVitrine(), { unidades, professores, atualizadoEm: serverTimestamp() });
    return { unidades: Object.keys(unidades).length, professores: Object.keys(professores).length, tamanhoKb: Math.round(tamanho / 1024) };
}

/** Leitura usada pela página pública. Retorna null se a vitrine ainda não foi montada. */
export async function lerVitrine() {
    const snap = await getDoc(refVitrine());
    if (!snap.exists()) return null;
    const { unidades = {}, professores = {} } = snap.data();
    return { unidades, professores };
}

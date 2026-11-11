// Converte documentos do Firestore para JSON (backup) e de volta (restauração) sem perder os tipos.
// JSON puro não conhece datas do Firestore: sem isto, um Timestamp vira {seconds, nanoseconds}
// e, ao restaurar, volta como um objeto comum, quebrando ordenações e telas que esperam data.
import { Timestamp, GeoPoint, DocumentReference, Bytes, doc } from 'firebase/firestore';

const MARCA = '__tipo';

const ehObjetoSimples = (v) => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

// Backups antigos (antes desta versão) gravavam datas como {seconds, nanoseconds} (às vezes com "type").
const ehTimestampLegado = (v) => {
    if (!ehObjetoSimples(v)) return false;
    const chaves = Object.keys(v);
    return typeof v.seconds === 'number' && typeof v.nanoseconds === 'number'
        && chaves.every(k => k === 'seconds' || k === 'nanoseconds' || k === 'type');
};

/** Firestore -> valor que pode ir para JSON.stringify. */
export function serializarValor(v) {
    if (v instanceof Timestamp) return { [MARCA]: 'timestamp', segundos: v.seconds, nanos: v.nanoseconds };
    if (v instanceof GeoPoint) return { [MARCA]: 'geopoint', lat: v.latitude, lng: v.longitude };
    if (v instanceof DocumentReference) return { [MARCA]: 'ref', caminho: v.path };
    if (v instanceof Bytes) return { [MARCA]: 'bytes', base64: v.toBase64() };
    if (Array.isArray(v)) return v.map(serializarValor);
    if (v !== null && typeof v === 'object') {
        return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, serializarValor(x)]));
    }
    return v;
}

/** JSON do backup -> valor pronto para gravar no Firestore. `db` só é usado para referências. */
export function desserializarValor(v, db) {
    if (Array.isArray(v)) return v.map(x => desserializarValor(x, db));
    if (ehObjetoSimples(v)) {
        switch (v[MARCA]) {
            case 'timestamp': return new Timestamp(v.segundos, v.nanos);
            case 'geopoint': return new GeoPoint(v.lat, v.lng);
            case 'ref': return doc(db, v.caminho);
            case 'bytes': return Bytes.fromBase64String(v.base64);
            default: break;
        }
        if (ehTimestampLegado(v)) return new Timestamp(v.seconds, v.nanoseconds);
        return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, desserializarValor(x, db)]));
    }
    return v;
}

// Campos que não vão para a planilha de conferência (o JSON completo continua com eles para a restauração).
const CAMPOS_FORA_DO_EXCEL = new Set(['senhaPainel']);

const doisDigitos = (n) => String(n).padStart(2, '0');
const dataLegivel = (d) =>
    `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())} ${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}:${doisDigitos(d.getSeconds())}`;

/** Linha da planilha: datas legíveis, objetos/listas como texto, sem senhas. */
export function linhaParaExcel(registro) {
    const linha = {};
    for (const [k, v] of Object.entries(registro)) {
        if (CAMPOS_FORA_DO_EXCEL.has(k)) continue;
        if (v instanceof Timestamp) linha[k] = dataLegivel(v.toDate());
        else if (v !== null && typeof v === 'object') linha[k] = JSON.stringify(serializarValor(v));
        else linha[k] = v;
    }
    return linha;
}

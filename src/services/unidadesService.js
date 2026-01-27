// src/services/unidadesService.js
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { db } from "./firebase";

// referência da coleção
const unidadesCol = collection(db, "unidades");

/**
 * Escuta unidades em tempo real, aplicando filtro por role:
 * - admin: todas
 * - mentor: somente mentorId == uid
 */
export function listenUnidades({ role, uid }, onData, onError) {
  let q = query(unidadesCol, orderBy("nome", "asc"));

  if (role === "mentor") {
    q = query(unidadesCol, where("mentorId", "==", uid), orderBy("nome", "asc"));
  }

  // Para outros perfis (unidade/professor), por segurança, retorna vazio
  if (role !== "admin" && role !== "mentor") {
    onData([]);
    return () => {};
  }

  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData(rows);
    },
    (err) => {
      console.error("listenUnidades error:", err);
      onError?.(err);
    }
  );
}

/**
 * Cria unidade
 * Campos definitivos:
 * nome, status ("ativa"|"inativa"), mentorId, criadoEm, criadoPor
 */
export async function createUnidade({ nome, mentorId, criadoPor }) {
  const payload = {
    nome: String(nome || "").trim(),
    status: "ativa",
    mentorId: mentorId || null,
    criadoEm: serverTimestamp(),
    criadoPor
  };

  if (!payload.nome) throw new Error("Nome da unidade é obrigatório.");
  if (!payload.mentorId) throw new Error("mentorId é obrigatório.");

  const docRef = await addDoc(unidadesCol, payload);
  return docRef.id;
}

/**
 * Atualiza nome/status/mentorId (admin) ou nome/status (mentor nas suas unidades)
 */
export async function updateUnidade(unidadeId, patch) {
  const ref = doc(db, "unidades", unidadeId);
  await updateDoc(ref, patch);
}

/**
 * Exclui unidade (recomendado: só admin)
 */
export async function deleteUnidade(unidadeId) {
  const ref = doc(db, "unidades", unidadeId);
  await deleteDoc(ref);
}

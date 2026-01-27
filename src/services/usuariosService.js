import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "./firebase";

export async function listarMentores() {
  const ref = collection(db, "usuarios");
  const q = query(
    ref,
    where("role", "==", "mentor"),
    where("status", "==", "ativo"),
    orderBy("nome")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    uid: doc.id,
    nome: doc.data().nome
  }));
}

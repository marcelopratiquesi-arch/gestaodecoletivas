import AppRoutes from "./routes/AppRoutes";
// 🟢 IMPORTANDO O CÉREBRO DO PLAYER
import { PlayerProvider } from "./contexts/PlayerContext";
// 🟢 IMPORTANDO O CÉREBRO DOS DADOS ESTÁTICOS (MEMÓRIA DE ELEFANTE)
import { CatalogProvider } from "./contexts/CatalogContext";

export default function App() {
  return (
    // 🟢 ENVELOPANDO O SITE COM O PLAYER E A MEMÓRIA DE ELEFANTE
    <PlayerProvider>
      <CatalogProvider>
        <AppRoutes />
      </CatalogProvider>
    </PlayerProvider>
  );
}
import AppRoutes from "./routes/AppRoutes";
// 🟢 IMPORTANDO O CÉREBRO DO PLAYER
import { PlayerProvider } from "./contexts/PlayerContext";

export default function App() {
  return (
    // 🟢 ENVELOPANDO O SITE COM O PLAYER PARA A MÚSICA NUNCA PARAR
    <PlayerProvider>
      <AppRoutes />
    </PlayerProvider>
  );
}
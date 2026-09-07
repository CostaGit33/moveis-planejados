import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import PlayerProfile from "./pages/PlayerProfile";

export default function App() {
  const path = window.location.pathname;
  const page = path.startsWith("/jogadores/") || path === "/perfil" ? <PlayerProfile /> : <Home />;

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          {page}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

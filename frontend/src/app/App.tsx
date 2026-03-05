import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/Navbar";
import AppRouter from "@/app/router";
import { useLayerStore } from "@/store/layerStore";
import { useAuthStore } from "@/store/authStore";

const App = () => {
  const fetchLayers = useLayerStore((s) => s.fetchLayers);
  const role = useAuthStore((s) => s.role);

  // Re-fetch the layer hierarchy whenever the role changes.
  // The JWT interceptor attaches the current token automatically so the
  // backend returns the correct set of layers for the user's role.
  useEffect(() => {
    fetchLayers();
  }, [role, fetchLayers]);

  return (
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <div className="flex flex-col h-screen">
          <Navbar />
          <AppRouter />
        </div>
      </BrowserRouter>
    </TooltipProvider>
  );
};

export default App;

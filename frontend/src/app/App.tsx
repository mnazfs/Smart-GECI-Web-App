import { BrowserRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/Navbar";
import AppRouter from "@/app/router";

const App = () => (
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

export default App;

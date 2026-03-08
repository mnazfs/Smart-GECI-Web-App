import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useNlpPopupStore } from "@/store/nlpPopupStore";
import { LogIn, LogOut, MessageSquare, Shield, MapPin, Thermometer } from "lucide-react";

const Navbar = () => {
  const { role, logout } = useAuthStore();
  const navigate = useNavigate();
  const openNlp = useNlpPopupStore((s) => s.open);
  const isAuthenticated = role !== "guest";
  const isAdmin = role === "admin";

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav className="h-12 bg-navbar flex items-center justify-between px-4 shadow-md z-50">
      <Link to="/" className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-accent" />
        <span className="font-bold text-navbar-foreground text-sm tracking-wide">
          Smart GECI
        </span>
      </Link>

      <div className="flex items-center gap-2">
        {isAuthenticated && (
          <button
            onClick={openNlp}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-navbar-foreground/20 text-navbar-foreground hover:bg-navbar-foreground/10 transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Ask GECI
          </button>
        )}

        {isAuthenticated && (
          <Link
            to="/uhi-dashboard"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-navbar-foreground/20 text-navbar-foreground hover:bg-navbar-foreground/10 transition-colors"
          >
            <Thermometer className="h-3.5 w-3.5" />
            Urban Heat Island Dashboard
          </Link>
        )}

        {isAdmin && (
          <Link
            to="/admin"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-accent text-accent-foreground hover:opacity-90 transition-opacity"
          >
            <Shield className="h-3.5 w-3.5" />
            Admin Console
          </Link>
        )}

        {isAuthenticated ? (
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-navbar-foreground/20 text-navbar-foreground hover:bg-navbar-foreground/10 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-navbar-foreground/20 text-navbar-foreground hover:bg-navbar-foreground/10 transition-colors"
          >
            <LogIn className="h-3.5 w-3.5" />
            Login
          </Link>
        )}

        {isAuthenticated && (
          <span className="text-xs text-navbar-foreground/60 capitalize ml-1">
            {role}
          </span>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

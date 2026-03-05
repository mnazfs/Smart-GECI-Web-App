import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { User, Shield, MapPin } from "lucide-react";

const LoginPage = () => {
  const { loginAsAuthorized, loginAsAdmin } = useAuthStore();
  const navigate = useNavigate();

  const handleAuthorizedLogin = () => {
    loginAsAuthorized();
    navigate("/");
  };

  const handleAdminLogin = () => {
    loginAsAdmin();
    navigate("/");
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="w-full max-w-sm mx-auto p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 mb-4">
            <MapPin className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Smart GECI</h1>
          <p className="text-sm text-muted-foreground mt-1">
            GIS-based Smart Campus
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleAuthorizedLogin}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
          >
            <User className="h-4 w-4" />
            Login as Authorized User
          </button>

          <button
            onClick={handleAdminLogin}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-accent text-accent-foreground font-medium text-sm hover:opacity-90 transition-opacity"
          >
            <Shield className="h-4 w-4" />
            Login as Admin
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Demo mode — no backend authentication required
        </p>
      </div>
    </div>
  );
};

export default LoginPage;

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { User, Shield, MapPin, LogIn, Eye, EyeOff } from "lucide-react";
import type { AxiosError } from "axios";

const LoginPage = () => {
  const { login, loginAsAuthorized, loginAsAdmin } = useAuthStore();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password);
      navigate("/admin");
    } catch (err) {
      const status = (err as AxiosError)?.response?.status;
      if (status === 401) {
        setError("Invalid username or password.");
      } else {
        setError("Login failed. Is the backend running?");
      }
    } finally {
      setLoading(false);
    }
  };

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

        {/* ── Credential login form ──────────────────────────────── */}
        <form onSubmit={handleCredentialLogin} className="space-y-3 mb-6">
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-medium text-foreground mb-1"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              disabled={loading}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-foreground mb-1"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 pr-9 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogIn className="h-4 w-4" />
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* ── Divider ───────────────────────────────────────────── */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-background text-muted-foreground">or demo</span>
          </div>
        </div>

        {/* ── Demo shortcuts (no JWT — map/NLP only) ────────────── */}
        <div className="space-y-2">
          <button
            onClick={handleAuthorizedLogin}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-colors"
          >
            <User className="h-4 w-4" />
            Demo — Authorized User
          </button>

          <button
            onClick={handleAdminLogin}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-colors"
          >
            <Shield className="h-4 w-4" />
            Demo — Admin (read-only)
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-5">
          Admin layer operations require real credentials.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;

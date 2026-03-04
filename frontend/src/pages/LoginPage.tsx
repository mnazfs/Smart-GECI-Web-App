import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const { loginDemoAuthorized, loginDemoAdmin, loginReal, isAuthenticated } = useAuthStore();

  // Real-login form state
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Already authenticated → redirect to map
  if (isAuthenticated) {
    navigate('/', { replace: true });
    return null;
  }

  const handleDemoAuthorized = () => {
    loginDemoAuthorized();
    navigate('/');
  };

  const handleDemoAdmin = () => {
    loginDemoAdmin();
    navigate('/');
  };

  const handleRealLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setIsSubmitting(true);
    try {
      await loginReal(username.trim(), password);
      navigate('/');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const msg = (err.response?.data as { message?: string })?.message;
        toast.error(msg ?? 'Login failed. Check your credentials.');
      } else {
        toast.error('Login failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.1),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(59,130,246,0.1),transparent_50%)]" />

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden relative z-10 fade-in">

        {/* ── header ── */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-8 pt-10 pb-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(16,185,129,0.1),transparent_70%)]" />
          <div className="relative">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
              <span className="text-white text-3xl">⬡</span>
            </div>
            <h1 className="text-white text-2xl font-bold tracking-tight">Smart GECI</h1>
            <p className="text-slate-400 text-sm mt-2">Smart Campus GIS Platform</p>
          </div>
        </div>

        <div className="px-8 py-8 flex flex-col gap-6">

          {/* ══ SECTION A: Real Login ══════════════════════════════════════ */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Sign in with account
              </span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
            <form onSubmit={handleRealLogin} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all duration-200 bg-slate-50/50"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all duration-200 bg-slate-50/50"
              />
              <button
                type="submit"
                disabled={isSubmitting || !username.trim() || !password}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md disabled:shadow-none"
              >
                {isSubmitting ? 'Signing in…' : 'Login'}
              </button>
            </form>
          </div>

          {/* ── divider ── */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">or demo mode</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* ══ SECTION B: Demo Login ══════════════════════════════════════ */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleDemoAuthorized}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-50/50 border border-emerald-200/50 hover:border-emerald-300 hover:shadow-md transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-lg shadow-sm">
                👤
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-slate-700 group-hover:text-emerald-700 text-sm transition-colors">
                  Demo — Authorized User
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Access restricted campus layers</p>
              </div>
            </button>

            <button
              onClick={handleDemoAdmin}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-xl bg-gradient-to-r from-blue-50 to-blue-50/50 border border-blue-200/50 hover:border-blue-300 hover:shadow-md transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-lg shadow-sm">
                🛡️
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-slate-700 group-hover:text-blue-700 text-sm transition-colors">
                  Demo — Admin
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Full access + Admin Console</p>
              </div>
            </button>
          </div>

          {/* ── guest ── */}
          <div className="border-t border-slate-200 pt-4 -mb-2">
            <button
              onClick={() => navigate('/')}
              className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors font-medium"
            >
              ← Continue as Guest
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

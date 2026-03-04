import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export default function Navbar() {
  const navigate    = useNavigate();
  const role        = useAuthStore(state => state.role);
  const authMode    = useAuthStore(state => state.authMode);
  const user        = useAuthStore(state => state.user);
  const logout      = useAuthStore(state => state.logout);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const displayName = user?.username ?? (role !== 'guest' ? role : null);

  return (
    <nav className="sticky top-0 flex items-center justify-between px-6 py-3 bg-white/95 backdrop-blur-md text-slate-800 shadow-sm border-b border-slate-200/50 z-50 shrink-0">
      {/* ── brand ── */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2.5 hover:opacity-70 transition-all duration-200 group"
      >
        <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow duration-200">
          <span className="text-white text-lg font-bold">⬡</span>
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold tracking-tight text-slate-900">Smart GECI</span>
          <span className="text-xs text-slate-500 font-normal hidden sm:inline leading-tight">
            Smart Campus GIS
          </span>
        </div>
      </button>

      {/* ── right side ── */}
      <div className="flex items-center gap-3">

        {/* role + mode badge */}
        {role !== 'guest' && (
          <div
            className={`text-xs px-3 py-1.5 rounded-full font-medium shadow-sm ${
              role === 'admin'
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
            }`}
          >
            {displayName
              ? `${displayName} · ${authMode === 'demo' ? 'Demo' : 'Real'}`
              : (role === 'admin' ? 'Admin' : 'Authorized User')}
          </div>
        )}

        {/* Admin Console — only for admins */}
        {role === 'admin' && (
          <button
            onClick={() => navigate('/admin')}
            className="text-sm px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white transition-all duration-200 font-medium shadow-sm hover:shadow-md"
          >
            Admin Console
          </button>
        )}

        {/* Login / Logout */}
        {role === 'guest' ? (
          <button
            onClick={() => navigate('/login')}
            className="text-sm px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white transition-all duration-200 font-medium shadow-sm hover:shadow-md"
          >
            Login
          </button>
        ) : (
          <button
            onClick={handleLogout}
            className="text-sm px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all duration-200 font-medium"
          >
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}

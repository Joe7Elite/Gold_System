import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getQueueCount, syncPendingOps } from '../api';

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done'>('idle');

  useEffect(() => {
    const goOnline = () => { setOnline(true); syncPendingOps(); };
    const goOffline = () => setOnline(false);
    const updateQueue = async () => setPendingCount(await getQueueCount());
    const handleSync = (e: Event) => setSyncStatus((e as CustomEvent).detail);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('offline-queue-update', updateQueue);
    window.addEventListener('sync-status', handleSync);
    updateQueue();

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('offline-queue-update', updateQueue);
      window.removeEventListener('sync-status', handleSync);
    };
  }, []);

  const isActive = (path: string, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const sidebarLinkClass = (path: string, exact = false) => {
    const active = isActive(path, exact);
    return `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-150 text-sm font-medium ${
      active
        ? 'bg-amber-500/15 text-amber-400 border-r-2 border-amber-400'
        : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
    }`;
  };

  const showStatusBar = !online || pendingCount > 0;

  return (
    <div className="flex min-h-screen bg-[#f8f5f0]" dir="rtl">

      {/* ── Connection Status Bar ── */}
      {showStatusBar && (
        <div
          className={`fixed top-0 left-0 right-0 z-[60] text-center text-xs py-1.5 font-medium ${
            !online
              ? 'bg-red-500 text-white'
              : syncStatus === 'syncing'
              ? 'bg-yellow-400 text-yellow-900'
              : 'bg-amber-500 text-white'
          }`}
        >
          {!online
            ? `لا يوجد اتصال — ${pendingCount > 0 ? `${pendingCount} عملية في الانتظار` : 'العمليات ستُحفظ محلياً'}`
            : syncStatus === 'syncing'
            ? 'جارٍ مزامنة العمليات...'
            : `${pendingCount} عملية في انتظار المزامنة`}
        </div>
      )}

      {/* ── Desktop Sidebar (hidden on mobile) ── */}
      <aside
        className={`hidden md:flex flex-col fixed inset-y-0 right-0 w-64 bg-stone-950 z-50 ${
          showStatusBar ? 'pt-7' : ''
        }`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-stone-800">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-amber-400 text-lg leading-none">◆</span>
            <h1 className="text-base font-bold text-amber-400 leading-snug">
              نظام حسابات الذهب
            </h1>
          </div>
          <p className="text-xs text-stone-400 pr-6 truncate">{user?.full_name}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {/* Dashboard */}
          <NavLink to="/" end className={() => sidebarLinkClass('/', true)}>
            {/* Chart icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 21V9" />
            </svg>
            لوحة التحكم
          </NavLink>

          {/* Traders */}
          <NavLink to="/traders" className={() => sidebarLinkClass('/traders')}>
            {/* Users icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            التجار
          </NavLink>

          {/* Admin-only links */}
          {user?.role === 'admin' && (
            <>
              {/* Audit */}
              <NavLink to="/audit" className={() => sidebarLinkClass('/audit')}>
                {/* Clipboard icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  <line x1="9" y1="12" x2="15" y2="12" />
                  <line x1="9" y1="16" x2="13" y2="16" />
                </svg>
                سجل التعديلات
              </NavLink>

              {/* Users */}
              <NavLink to="/users" className={() => sidebarLinkClass('/users')}>
                {/* Key icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="7.5" cy="15.5" r="5.5" />
                  <path d="M21 2l-9.6 9.6" />
                  <path d="M15.5 7.5l3 3L22 7l-3-3" />
                </svg>
                المستخدمين
              </NavLink>
            </>
          )}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-stone-800">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-200 transition-colors text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            تسجيل خروج
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 md:mr-64 flex flex-col min-h-screen">
        <main
          className={`flex-1 p-4 md:p-6 pb-20 md:pb-6 ${showStatusBar ? 'mt-7' : ''}`}
        >
          <Outlet />
        </main>
      </div>

      {/* ── Mobile Bottom Navigation Bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-stone-200 shadow-lg flex items-stretch">
        {/* Dashboard */}
        <NavLink
          to="/"
          end
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
        >
          {({ isActive }) => (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${isActive ? 'text-amber-500' : 'text-stone-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
              <span className={`text-[10px] font-medium ${isActive ? 'text-amber-500' : 'text-stone-400'}`}>
                لوحة التحكم
              </span>
            </>
          )}
        </NavLink>

        {/* Traders */}
        <NavLink
          to="/traders"
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
        >
          {({ isActive }) => (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${isActive ? 'text-amber-500' : 'text-stone-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span className={`text-[10px] font-medium ${isActive ? 'text-amber-500' : 'text-stone-400'}`}>
                التجار
              </span>
            </>
          )}
        </NavLink>

        {/* Audit (admin only) */}
        {user?.role === 'admin' && (
          <NavLink
            to="/audit"
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
          >
            {({ isActive }) => (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${isActive ? 'text-amber-500' : 'text-stone-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  <line x1="9" y1="12" x2="15" y2="12" />
                  <line x1="9" y1="16" x2="13" y2="16" />
                </svg>
                <span className={`text-[10px] font-medium ${isActive ? 'text-amber-500' : 'text-stone-400'}`}>
                  السجل
                </span>
              </>
            )}
          </NavLink>
        )}

        {/* Users (admin only) */}
        {user?.role === 'admin' && (
          <NavLink
            to="/users"
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
          >
            {({ isActive }) => (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${isActive ? 'text-amber-500' : 'text-stone-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="7.5" cy="15.5" r="5.5" />
                  <path d="M21 2l-9.6 9.6" />
                  <path d="M15.5 7.5l3 3L22 7l-3-3" />
                </svg>
                <span className={`text-[10px] font-medium ${isActive ? 'text-amber-500' : 'text-stone-400'}`}>
                  المستخدمين
                </span>
              </>
            )}
          </NavLink>
        )}
      </nav>
    </div>
  );
}

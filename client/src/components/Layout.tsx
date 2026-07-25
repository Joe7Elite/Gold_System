import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getQueueCount, syncPendingOps } from '../api';

export default function Layout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const lnk = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-amber-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`;

  const handleNav = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Connection Status Bar */}
      {(!online || pendingCount > 0) && (
        <div className={`fixed top-0 left-0 right-0 z-[60] text-center text-xs py-1.5 font-medium ${
          !online ? 'bg-red-500 text-white' :
          syncStatus === 'syncing' ? 'bg-yellow-400 text-yellow-900' :
          'bg-amber-500 text-white'
        }`}>
          {!online
            ? `مفيش اتصال - ${pendingCount > 0 ? `${pendingCount} عملية في الانتظار` : 'العمليات هتتحفظ محلياً'}`
            : syncStatus === 'syncing'
            ? 'جاري مزامنة العمليات...'
            : `${pendingCount} عملية في انتظار المزامنة`}
        </div>
      )}

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 right-0 z-50 w-64 bg-gray-900 text-white flex flex-col shrink-0 transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
      } ${(!online || pendingCount > 0) ? 'md:pt-7' : ''}`}>
        <div className="p-5 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-amber-400">نظام حسابات الذهب</h1>
            <p className="text-sm text-gray-400 mt-1">{user?.full_name}</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white text-2xl">
            &times;
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavLink to="/" end className={lnk} onClick={handleNav}>لوحة التحكم</NavLink>
          <NavLink to="/traders" className={lnk} onClick={handleNav}>التجار</NavLink>
          {user?.role === 'admin' && (
            <>
              <NavLink to="/audit" className={lnk} onClick={handleNav}>سجل التعديلات</NavLink>
              <NavLink to="/users" className={lnk} onClick={handleNav}>المستخدمين</NavLink>
            </>
          )}
        </nav>
        <div className="p-3 border-t border-gray-700">
          <button onClick={logout} className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-sm">
            تسجيل خروج
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className={`md:hidden bg-white shadow-sm px-4 py-3 flex items-center justify-between shrink-0 ${(!online || pendingCount > 0) ? 'mt-7' : ''}`}>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-amber-600">نظام الذهب</h1>
            {!online && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          </div>
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const lnk = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-amber-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`;

  const handleNav = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 right-0 z-50 w-64 bg-gray-900 text-white flex flex-col shrink-0 transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
      }`}>
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
        <header className="md:hidden bg-white shadow-sm px-4 py-3 flex items-center justify-between shrink-0">
          <h1 className="text-lg font-bold text-amber-600">نظام الذهب</h1>
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

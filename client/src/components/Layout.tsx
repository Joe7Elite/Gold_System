import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();

  const lnk = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-amber-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`;

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-60 bg-gray-900 text-white flex flex-col shrink-0">
        <div className="p-5 border-b border-gray-700">
          <h1 className="text-lg font-bold text-amber-400">نظام حسابات الذهب</h1>
          <p className="text-sm text-gray-400 mt-1">{user?.full_name}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavLink to="/" end className={lnk}>لوحة التحكم</NavLink>
          <NavLink to="/traders" className={lnk}>التجار</NavLink>
          {user?.role === 'admin' && (
            <>
              <NavLink to="/audit" className={lnk}>سجل التعديلات</NavLink>
              <NavLink to="/users" className={lnk}>المستخدمين</NavLink>
            </>
          )}
        </nav>
        <div className="p-3 border-t border-gray-700">
          <button onClick={logout} className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-sm">
            تسجيل خروج
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}

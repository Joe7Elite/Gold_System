import { useEffect, useState } from 'react';
import api from '../api';

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'user' });
  const [error, setError] = useState('');

  const load = () => api.get('/users').then((r) => setUsers(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users', form);
      setShowAdd(false);
      setForm({ username: '', password: '', full_name: '', role: 'user' });
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'حصل مشكلة');
    }
  };

  const toggleActive = async (u: any) => {
    await api.put(`/users/${u.id}`, { is_active: u.is_active ? 0 : 1 });
    load();
  };

  if (loading) return <div className="text-center py-10 text-gray-500">جاري التحميل...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">إدارة المستخدمين</h1>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm">
          إضافة مستخدم
        </button>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">إضافة مستخدم جديد</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              {error && <div className="bg-red-50 text-red-600 p-2 rounded text-sm">{error}</div>}
              <input placeholder="اسم المستخدم" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" required />
              <input placeholder="الاسم الكامل" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" required />
              <input type="password" placeholder="كلمة السر" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" required />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500">
                <option value="user">مستخدم</option>
                <option value="admin">مدير</option>
              </select>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg">إضافة</button>
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-right font-medium text-gray-600">اسم المستخدم</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">الاسم الكامل</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">الصلاحية</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">الحالة</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.username}</td>
                <td className="px-4 py-3">{u.full_name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {u.role === 'admin' ? 'مدير' : 'مستخدم'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {u.is_active ? 'نشط' : 'موقوف'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(u)} className="text-xs text-blue-600 hover:underline">
                    {u.is_active ? 'إيقاف' : 'تفعيل'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

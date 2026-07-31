import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/ui/Modal';
import { PageLoader } from '../components/ui/Spinner';

interface User {
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'user';
  is_active: number;
  is_protected?: number;
}

const emptyAdd = { username: '', password: '', full_name: '', role: 'user' };
const emptyEdit = { full_name: '', role: 'user', password: '' };

export default function Users() {
  const { user: me, logout } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(emptyAdd);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState(emptyEdit);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api.get('/users').then((r) => setUsers(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await api.post('/users', addForm);
      setShowAdd(false);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'حصل خطأ');
    } finally { setBusy(false); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setError(''); setBusy(true);
    try {
      const body: any = { full_name: editForm.full_name, role: editForm.role };
      if (editForm.password.trim()) body.password = editForm.password;
      await api.put(`/users/${editUser.id}`, body);
      setEditUser(null);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'حصل خطأ');
    } finally { setBusy(false); }
  };

  const toggleActive = async (u: User) => {
    if (u.is_protected) return;
    setTogglingId(u.id);
    try {
      await api.put(`/users/${u.id}`, { is_active: u.is_active ? 0 : 1 });
      load();
    } finally { setTogglingId(null); }
  };

  const deleteUser = async (u: User) => {
    if (u.is_protected) return;
    if (!window.confirm(`متأكد إنك عايز تحذف ${u.full_name}؟`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || 'مقدرش أحذف المستخدم');
    }
  };

  return (
    <div className="max-w-3xl pb-4">
      {/* ===== حسابك + تسجيل خروج ===== */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-gold-100 to-gold-300 text-gold-900 flex items-center justify-center font-extrabold text-lg shrink-0">
            {(me?.full_name || me?.username || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-stone-800 truncate">{me?.full_name}</p>
            <p className="text-xs text-stone-400 truncate">@{me?.username}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 text-red-600 font-bold text-sm active:bg-red-100 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          تسجيل خروج
        </button>
      </div>

      {/* ===== Header ===== */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h1 className="text-xl font-bold text-stone-800">المستخدمين</h1>
          <p className="text-xs text-stone-400 mt-0.5">{loading ? '...' : `${users.length} مستخدم`}</p>
        </div>
        <button
          onClick={() => { setAddForm(emptyAdd); setError(''); setShowAdd(true); }}
          className="btn-primary shrink-0"
        >
          + مستخدم
        </button>
      </div>

      {loading ? (
        <PageLoader />
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className={`card px-4 py-3 ${!u.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center font-bold shrink-0">
                  {(u.full_name || u.username || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-stone-800 text-sm truncate">{u.full_name || '—'}</p>
                  <p className="text-xs text-stone-400 truncate">
                    @{u.username}
                    <span className="mx-1.5 text-stone-200">•</span>
                    {u.is_protected ? 'حساب أساسي' : u.role === 'admin' ? 'مدير' : 'مستخدم'}
                    {!u.is_active && <span className="text-red-500"> • موقوف</span>}
                  </p>
                </div>
              </div>

              {!u.is_protected && (
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => { setEditUser(u); setEditForm({ full_name: u.full_name, role: u.role, password: '' }); setError(''); }}
                    className="flex-1 py-1.5 rounded-lg bg-stone-100 text-stone-700 font-semibold text-xs active:bg-stone-200"
                  >
                    تعديل
                  </button>
                  <button
                    onClick={() => toggleActive(u)}
                    disabled={togglingId === u.id}
                    className={`flex-1 py-1.5 rounded-lg font-semibold text-xs disabled:opacity-60 ${
                      u.is_active ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {togglingId === u.id ? '...' : u.is_active ? 'إيقاف' : 'تفعيل'}
                  </button>
                  <button
                    onClick={() => deleteUser(u)}
                    className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 font-semibold text-xs active:bg-red-100"
                  >
                    حذف
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ===== Add ===== */}
      {showAdd && (
        <Modal title="مستخدم جديد" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd} className="space-y-3">
            {error && <Err msg={error} />}
            <input type="text" placeholder="اسم المستخدم" value={addForm.username}
              onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
              className="input-field" required autoFocus />
            <input type="text" placeholder="الاسم الكامل" value={addForm.full_name}
              onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
              className="input-field" required />
            <input type="password" placeholder="كلمة السر" value={addForm.password}
              onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
              className="input-field" required />
            <select value={addForm.role}
              onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
              className="input-field">
              <option value="user">مستخدم</option>
              <option value="admin">مدير</option>
            </select>
            <Actions busy={busy} label="إضافة" onCancel={() => setShowAdd(false)} />
          </form>
        </Modal>
      )}

      {/* ===== Edit ===== */}
      {editUser && (
        <Modal title={`تعديل: ${editUser.username}`} onClose={() => setEditUser(null)}>
          <form onSubmit={handleEdit} className="space-y-3">
            {error && <Err msg={error} />}
            <input type="text" placeholder="الاسم الكامل" value={editForm.full_name}
              onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              className="input-field" required autoFocus />
            <select value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              className="input-field">
              <option value="user">مستخدم</option>
              <option value="admin">مدير</option>
            </select>
            <input type="password" placeholder="كلمة سر جديدة (اختياري)" value={editForm.password}
              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              className="input-field" />
            <Actions busy={busy} label="حفظ" onCancel={() => setEditUser(null)} />
          </form>
        </Modal>
      )}
    </div>
  );
}

function Err({ msg }: { msg: string }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm">{msg}</div>
  );
}

function Actions({ busy, label, onCancel }: { busy: boolean; label: string; onCancel: () => void }) {
  return (
    <div className="flex gap-2 pt-1">
      <button type="submit" disabled={busy} className="btn-primary flex-1 py-2.5 disabled:opacity-50">
        {busy ? 'جاري...' : label}
      </button>
      <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-2.5">إلغاء</button>
    </div>
  );
}

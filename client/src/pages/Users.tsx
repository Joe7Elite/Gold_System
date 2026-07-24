import { useEffect, useState } from 'react';
import api from '../api';

interface User {
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'user';
  is_active: number;
}

const AVATAR_COLORS = [
  'bg-amber-500',
  'bg-purple-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-orange-500',
  'bg-teal-500',
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const emptyAdd = { username: '', password: '', full_name: '', role: 'user' };
const emptyEdit = { full_name: '', role: 'user', password: '' };

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(emptyAdd);
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // Edit modal
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState(emptyEdit);
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Toggle loading per user
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api.get('/users').then((r) => setUsers(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  /* ─── Add ─── */
  const openAdd = () => {
    setAddForm(emptyAdd);
    setAddError('');
    setShowAdd(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setAddLoading(true);
    try {
      await api.post('/users', addForm);
      setShowAdd(false);
      load();
    } catch (err: any) {
      setAddError(err.response?.data?.error || 'حصل خطأ، حاول مرة ثانية');
    } finally {
      setAddLoading(false);
    }
  };

  /* ─── Edit ─── */
  const openEdit = (u: User) => {
    setEditUser(u);
    setEditForm({ full_name: u.full_name, role: u.role, password: '' });
    setEditError('');
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setEditError('');
    setEditLoading(true);
    try {
      const body: any = { full_name: editForm.full_name, role: editForm.role };
      if (editForm.password.trim()) body.password = editForm.password;
      await api.put(`/users/${editUser.id}`, body);
      setEditUser(null);
      load();
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'حصل خطأ، حاول مرة ثانية');
    } finally {
      setEditLoading(false);
    }
  };

  /* ─── Toggle Active ─── */
  const toggleActive = async (u: User) => {
    setTogglingId(u.id);
    try {
      await api.put(`/users/${u.id}`, { is_active: u.is_active ? 0 : 1 });
      load();
    } finally {
      setTogglingId(null);
    }
  };

  /* ─── Render ─── */
  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">إدارة المستخدمين</h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? '...' : `${users.length} مستخدم مسجّل`}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-semibold rounded-xl shadow-md shadow-amber-200 transition-all"
        >
          <span className="text-lg leading-none">+</span>
          إضافة مستخدم
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm p-5 animate-pulse">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-6 bg-gray-100 rounded-full w-16" />
                <div className="h-6 bg-gray-100 rounded-full w-16" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cards Grid */}
      {!loading && (
        <>
          {users.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <div className="text-5xl mb-3">👤</div>
              <p className="text-lg font-medium">لا يوجد مستخدمون بعد</p>
              <p className="text-sm mt-1">أضف أول مستخدم بالضغط على الزر أعلاه</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {users.map((u) => (
                <UserCard
                  key={u.id}
                  user={u}
                  toggling={togglingId === u.id}
                  onEdit={() => openEdit(u)}
                  onToggle={() => toggleActive(u)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Add Modal */}
      {showAdd && (
        <Modal title="إضافة مستخدم جديد" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd} className="space-y-4">
            {addError && <ErrorBanner msg={addError} />}

            <Field label="اسم المستخدم">
              <input
                type="text"
                placeholder="مثال: ahmed"
                value={addForm.username}
                onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                className="input-field"
                required
                autoFocus
              />
            </Field>

            <Field label="الاسم الكامل">
              <input
                type="text"
                placeholder="مثال: أحمد محمد"
                value={addForm.full_name}
                onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                className="input-field"
                required
              />
            </Field>

            <Field label="كلمة السر">
              <input
                type="password"
                placeholder="••••••••"
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                className="input-field"
                required
              />
            </Field>

            <Field label="الصلاحية">
              <select
                value={addForm.role}
                onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                className="input-field"
              >
                <option value="user">مستخدم</option>
                <option value="admin">مدير</option>
              </select>
            </Field>

            <ModalActions
              submitLabel="إضافة المستخدم"
              loading={addLoading}
              onCancel={() => setShowAdd(false)}
            />
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editUser && (
        <Modal title={`تعديل: ${editUser.username}`} onClose={() => setEditUser(null)}>
          <form onSubmit={handleEdit} className="space-y-4">
            {editError && <ErrorBanner msg={editError} />}

            <Field label="الاسم الكامل">
              <input
                type="text"
                placeholder="الاسم الكامل"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                className="input-field"
                required
                autoFocus
              />
            </Field>

            <Field label="الصلاحية">
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                className="input-field"
              >
                <option value="user">مستخدم</option>
                <option value="admin">مدير</option>
              </select>
            </Field>

            <Field label="كلمة السر الجديدة (اختياري)">
              <input
                type="password"
                placeholder="اتركها فارغة إذا لا تريد تغييرها"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                className="input-field"
              />
            </Field>

            <ModalActions
              submitLabel="حفظ التغييرات"
              loading={editLoading}
              onCancel={() => setEditUser(null)}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   Sub-components
───────────────────────────────────────── */

function UserCard({
  user,
  toggling,
  onEdit,
  onToggle,
}: {
  user: User;
  toggling: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const initials = (user.full_name || user.username || '?').charAt(0).toUpperCase();
  const color = avatarColor(user.full_name || user.username);

  return (
    <div
      className={`relative bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4 transition-all hover:shadow-md ${
        !user.is_active ? 'opacity-70' : ''
      }`}
    >
      {/* Inactive ribbon */}
      {!user.is_active && (
        <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-red-400 ring-2 ring-red-100" />
      )}

      {/* Top section: avatar + name */}
      <div className="flex items-center gap-4">
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-sm ${color}`}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-gray-900 font-bold text-lg leading-tight truncate">
            {user.full_name || '—'}
          </p>
          <p className="text-gray-400 text-sm mt-0.5 truncate">@{user.username}</p>
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
            user.role === 'admin'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {user.role === 'admin' ? 'مدير' : 'مستخدم'}
        </span>

        <span
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
            user.is_active
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-600'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {user.is_active ? 'نشط' : 'موقوف'}
        </span>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onEdit}
          className="flex-1 py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-700 font-semibold text-sm transition-colors"
        >
          تعديل
        </button>
        <button
          onClick={onToggle}
          disabled={toggling}
          className={`flex-1 py-2 px-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60 ${
            user.is_active
              ? 'bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-600'
              : 'bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700'
          }`}
        >
          {toggling ? '...' : user.is_active ? 'إيقاف' : 'تفعيل'}
        </button>
      </div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Modal body */}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
      <span className="font-bold text-red-500">!</span>
      {msg}
    </div>
  );
}

function ModalActions({
  submitLabel,
  loading,
  onCancel,
}: {
  submitLabel: string;
  loading: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        type="submit"
        disabled={loading}
        className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-60 text-white font-bold rounded-xl transition-colors shadow-sm shadow-amber-200"
      >
        {loading ? 'جاري الحفظ...' : submitLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 font-semibold rounded-xl transition-colors"
      >
        إلغاء
      </button>
    </div>
  );
}

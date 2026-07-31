import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/ui/Badge';
import { PageLoader } from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';

export default function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const { user } = useAuth();

  const load = () => {
    setLoading(true);
    api.get('/audit').then((r) => setLogs(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleReset = async () => {
    if (!window.confirm('متأكد إنك عايز تمسح كل البيانات؟\nالعملية دي مش هترجع!')) return;
    if (!window.confirm('تأكيد أخير: كل التجار والعمليات هتتمسح.\nحسابات صابر فوده هتتصفر بس ومتتمسحش. متأكد؟')) return;
    setResetting(true);
    try {
      await api.delete('/reset-all');
      alert('تم مسح كل البيانات');
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || 'حصل مشكلة');
    } finally {
      setResetting(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-3xl pb-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h1 className="text-xl font-bold text-stone-800">السجل</h1>
          <p className="text-xs text-stone-400 mt-0.5">{logs.length} عملية</p>
        </div>
        {(user as any)?.is_protected && (
          <button
            onClick={handleReset}
            disabled={resetting}
            className="px-3 py-2 bg-red-600 active:bg-red-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 shrink-0"
          >
            {resetting ? 'جاري المسح...' : 'مسح كل البيانات'}
          </button>
        )}
      </div>

      {logs.length === 0 ? (
        <EmptyState icon="📋" title="مفيش عمليات" />
      ) : (
        <div className="space-y-1.5">
          {logs.map((log) => (
            <div key={log.id} className="card px-4 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-stone-700 text-sm min-w-0 flex-1">{log.description}</p>
                <Badge
                  label={log.action === 'create' ? 'إضافة' : log.action === 'update' ? 'تعديل' : 'حذف'}
                  color={log.action === 'create' ? 'green' : log.action === 'update' ? 'blue' : 'red'}
                />
              </div>
              <p className="text-[11px] text-stone-400 mt-1">
                {log.user_name} <span className="mx-1 text-stone-200">•</span> {log.created_at}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

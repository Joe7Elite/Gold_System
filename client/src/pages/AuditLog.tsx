import { useEffect, useState } from 'react';
import api from '../api';
import Badge from '../components/ui/Badge';
import { PageLoader } from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';

export default function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/audit').then((r) => setLogs(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl md:text-2xl font-bold text-stone-800 mb-5">سجل التعديلات</h1>

      {/* Desktop */}
      <div className="hidden md:block card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50/80">
              <th className="px-5 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">المستخدم</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">العملية</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">الوصف</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-stone-100 hover:bg-gold-50/30 transition-colors">
                <td className="px-5 py-3 font-semibold text-stone-700">{log.user_name}</td>
                <td className="px-5 py-3">
                  <Badge
                    label={log.action === 'create' ? 'إضافة' : log.action === 'update' ? 'تعديل' : 'حذف'}
                    color={log.action === 'create' ? 'green' : log.action === 'update' ? 'blue' : 'red'}
                  />
                </td>
                <td className="px-5 py-3 text-stone-600">{log.description}</td>
                <td className="px-5 py-3 text-stone-400 text-xs">{log.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <EmptyState icon="📋" title="لا توجد تعديلات" />}
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-stone-700 text-sm">{log.user_name}</span>
              <Badge
                label={log.action === 'create' ? 'إضافة' : log.action === 'update' ? 'تعديل' : 'حذف'}
                color={log.action === 'create' ? 'green' : log.action === 'update' ? 'blue' : 'red'}
              />
            </div>
            <p className="text-stone-600 text-sm">{log.description}</p>
            <p className="text-stone-400 text-xs mt-1">{log.created_at}</p>
          </div>
        ))}
        {logs.length === 0 && <EmptyState icon="📋" title="لا توجد تعديلات" />}
      </div>
    </div>
  );
}

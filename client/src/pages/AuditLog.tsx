import { useEffect, useState } from 'react';
import api from '../api';

export default function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/audit').then((r) => setLogs(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-10 text-gray-500">جاري التحميل...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">سجل التعديلات</h1>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-right font-medium text-gray-600">المستخدم</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">العملية</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">الوصف</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{log.user_name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    log.action === 'create' ? 'bg-green-100 text-green-700' :
                    log.action === 'update' ? 'bg-blue-100 text-blue-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {log.action === 'create' ? 'إضافة' : log.action === 'update' ? 'تعديل' : 'حذف'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{log.description}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{log.created_at}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={4} className="text-center py-8 text-gray-400">لا توجد تعديلات</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

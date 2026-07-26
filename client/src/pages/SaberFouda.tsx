import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import { PageLoader } from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';

export default function SaberFouda() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const { user } = useAuth();

  const load = () => { setLoading(true); api.get('/saber/balance').then(r => setData(r.data)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const fmt = (n: number) => Math.abs(n).toLocaleString('ar-EG');
  const fmtW = (n: number) => Math.abs(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 });

  const handleReset = async () => {
    if (!window.confirm('متأكد إنك عايز تصفر حساب صابر فوده؟')) return;
    if (!window.confirm('تأكيد أخير: كل العمليات هتتمسح. متأكد؟')) return;
    setResetting(true);
    try { await api.delete('/saber/reset'); alert('تم تصفير الحساب'); load(); } catch (err: any) { alert(err.response?.data?.error || 'حصل مشكلة'); } finally { setResetting(false); }
  };

  if (loading) return <PageLoader />;
  if (!data?.trader) return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-bold text-stone-800 mb-4">صابر فوده</h1>
      <EmptyState icon="👤" title="التاجر مش موجود" sub="أضف تاجر اسمه صابر فوده من صفحة التجار الأول" />
    </div>
  );

  const { karat_18, karat_21, craftsmanship, transactions, transfers } = data;

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-stone-800">صابر فوده</h1>
          <p className="text-stone-400 text-sm">عيار 18 و 21 - استلام شغل وتسليم</p>
        </div>
        {(user as any)?.is_protected && (
          <button onClick={handleReset} disabled={resetting}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50">
            {resetting ? 'جاري...' : 'صفر الحساب'}
          </button>
        )}
      </div>

      {/* Karat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* عيار 18 */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-3 h-3 rounded-full bg-orange-400"></span>
            <h2 className="font-bold text-stone-800 text-lg">عيار 18</h2>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-red-50 rounded-xl p-3">
              <p className="text-xs text-stone-400 mb-1">استلمت</p>
              <p className="font-bold text-red-600">{fmtW(karat_18.received)}</p>
              <p className="text-xs text-stone-400">جم</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-xs text-stone-400 mb-1">سلمت</p>
              <p className="font-bold text-emerald-600">{fmtW(karat_18.returned)}</p>
              <p className="text-xs text-stone-400">جم</p>
            </div>
            <div className={`${karat_18.balance > 0 ? 'bg-red-50' : 'bg-emerald-50'} rounded-xl p-3`}>
              <p className="text-xs text-stone-400 mb-1">الباقي</p>
              <p className={`font-bold ${karat_18.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmtW(karat_18.balance)}</p>
              <p className="text-xs text-stone-400">جم {karat_18.balance > 0 ? 'عليك' : 'خلصت'}</p>
            </div>
          </div>
        </div>

        {/* عيار 21 */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-3 h-3 rounded-full bg-amber-400"></span>
            <h2 className="font-bold text-stone-800 text-lg">عيار 21</h2>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-red-50 rounded-xl p-3">
              <p className="text-xs text-stone-400 mb-1">استلمت</p>
              <p className="font-bold text-red-600">{fmtW(karat_21.received)}</p>
              <p className="text-xs text-stone-400">جم</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-xs text-stone-400 mb-1">سلمت</p>
              <p className="font-bold text-emerald-600">{fmtW(karat_21.returned)}</p>
              <p className="text-xs text-stone-400">جم</p>
            </div>
            <div className={`${karat_21.balance > 0 ? 'bg-red-50' : 'bg-emerald-50'} rounded-xl p-3`}>
              <p className="text-xs text-stone-400 mb-1">الباقي</p>
              <p className={`font-bold ${karat_21.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmtW(karat_21.balance)}</p>
              <p className="text-xs text-stone-400">جم {karat_21.balance > 0 ? 'عليك' : 'خلصت'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Craftsmanship */}
      <StatCard title="إجمالي المصنعية" value={`${fmt(craftsmanship)} ج`} color={craftsmanship > 0 ? 'text-red-600' : 'text-stone-400'} sub={craftsmanship > 0 ? 'عليك' : 'مفيش مصنعية'} />

      {/* Transactions */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-stone-100">
          <h2 className="font-bold text-stone-700 text-sm">آخر العمليات</h2>
        </div>
        <div className="divide-y divide-stone-50">
          {transactions.length === 0 && transfers.length === 0 ? (
            <EmptyState icon="📋" title="مفيش عمليات" />
          ) : (
            <>
              {transactions.map((t: any) => (
                <div key={`d-${t.id}`} className="px-5 py-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge label={t.deal_type === 'work' ? 'شغل' : t.deal_type === 'give' ? 'لوجوهات' : t.deal_type === 'give_local_bar' ? 'سبيكة' : t.deal_type}
                      color={t.deal_type === 'work' ? 'red' : 'green'} />
                    <span className="text-stone-500">{fmtW(t.original_weight || t.weight)} جم عيار {t.original_karat}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {t.total_amount > 0 && <span className="text-stone-400 text-xs">{fmt(t.total_amount)} ج</span>}
                    <span className="text-stone-400 text-xs">{t.created_at?.split(' ')[0]}</span>
                  </div>
                </div>
              ))}
              {transfers.map((t: any) => (
                <div key={`t-${t.id}`} className="px-5 py-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge label="تحويل" color="blue" />
                    <span className="text-stone-500">لـ {t.to_trader_name} - {fmtW(t.weight)} جم</span>
                  </div>
                  <span className="text-stone-400 text-xs">{t.created_at?.split(' ')[0]}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

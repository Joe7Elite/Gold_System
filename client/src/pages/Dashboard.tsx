import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/ui/StatCard';
import { PageLoader } from '../components/ui/Spinner';
import Badge from '../components/ui/Badge';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    api.get('/dashboard').then((r) => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;
  if (!data) return null;

  const { stats, recent } = data;
  const fmt = (n: number) => n.toLocaleString('ar-EG');
  const fmtW = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 });

  const todayAr = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const moneyPositive = stats.money_balance <= 0;

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Welcome Section */}
      <div>
        <h1 className="text-xl font-bold text-stone-800">مرحبا، {user?.full_name}</h1>
        <p className="text-stone-400 text-xs mt-0.5">{todayAr}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* رصيد الفلوس */}
        <StatCard
          title="رصيد الفلوس"
          value={`${fmt(Math.abs(stats.money_balance))} ج`}
          sub={stats.money_balance > 0 ? 'عليك' : stats.money_balance < 0 ? 'ليك' : 'مفيش رصيد'}
          color={moneyPositive ? 'text-emerald-600' : 'text-red-600'}
          iconBg={moneyPositive ? 'bg-emerald-50' : 'bg-red-50'}
          icon={
            <svg className={`w-6 h-6 ${moneyPositive ? 'text-emerald-500' : 'text-red-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        {/* إجمالي الذهب */}
        <StatCard
          title="إجمالي الذهب"
          value={`${fmtW(Math.abs(stats.total_gold))} جم`}
          sub={stats.total_gold > 0 ? 'ليك' : stats.total_gold < 0 ? 'عليك' : 'مفيش رصيد'}
          color={stats.total_gold > 0 ? 'text-emerald-600' : stats.total_gold < 0 ? 'text-red-600' : 'text-stone-400'}
          iconBg="bg-amber-50"
          icon={
            <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
        />
      </div>

      {/* Recent Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* آخر عمليات الذهب */}
        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-stone-100 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <h2 className="font-bold text-stone-600 text-xs">آخر عمليات الذهب</h2>
          </div>
          <div className="px-4">
            {recent.deals.length === 0 ? (
              <p className="py-4 text-center text-xs text-stone-300">مفيش عمليات</p>
            ) : (
              recent.deals.map((d: any, i: number) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-stone-50 last:border-0">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-stone-800 text-sm truncate">{d.trader_name}</span>
                      <Badge
                        label={d.deal_type === 'sell' ? 'بيع' : 'شراء'}
                        color={d.deal_type === 'sell' ? 'orange' : 'amber'}
                      />
                    </div>
                    <span className="text-[11px] text-stone-400">{fmtW(d.weight)} جم</span>
                  </div>
                  <span className={`font-bold text-sm shrink-0 mr-2 ${d.deal_type === 'sell' ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(d.total_amount)} ج
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* آخر عمليات الفلوس */}
        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-stone-100 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <h2 className="font-bold text-stone-600 text-xs">آخر عمليات الفلوس</h2>
          </div>
          <div className="px-4">
            {recent.payments.length === 0 ? (
              <p className="py-4 text-center text-xs text-stone-300">مفيش عمليات</p>
            ) : (
              recent.payments.map((p: any, i: number) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-stone-50 last:border-0">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-medium text-stone-800 text-sm truncate">{p.trader_name}</span>
                    <Badge
                      label={p.payment_type === 'loan' ? 'سلفة' : 'دفع'}
                      color={p.payment_type === 'loan' ? 'red' : 'green'}
                    />
                  </div>
                  <span className={`font-bold text-sm shrink-0 mr-2 ${p.payment_type === 'loan' ? 'text-red-600' : 'text-green-600'}`}>
                    {fmt(p.amount)} ج
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* آخر التحويلات */}
        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-stone-100 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            <h2 className="font-bold text-stone-600 text-xs">آخر التحويلات</h2>
          </div>
          <div className="px-4">
            {recent.transfers.length === 0 ? (
              <p className="py-4 text-center text-xs text-stone-300">مفيش تحويلات</p>
            ) : (
              recent.transfers.map((t: any, i: number) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-stone-50 last:border-0">
                  <span className="text-stone-700 text-sm min-w-0 truncate">
                    <span className="font-medium">{t.from_name}</span>
                    <span className="text-stone-400 mx-1">←</span>
                    <span className="font-medium">{t.to_name}</span>
                  </span>
                  <span className="text-blue-600 font-bold text-sm shrink-0 mr-2">{fmtW(t.weight)} جم</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

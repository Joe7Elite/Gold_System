import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/ui/StatCard';
import { PageLoader } from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
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
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-bold text-stone-800">
          مرحبا، {user?.full_name}
        </h1>
        <p className="text-stone-400 text-sm">{todayAr}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        {/* عدد التجار */}
        <StatCard
          title="عدد التجار"
          value={fmt(stats.total_traders)}
          color="text-stone-800"
          iconBg="bg-stone-100"
          icon={
            <svg className="w-5 h-5 text-stone-500" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM17 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 0 0-1.5-4.33A5 5 0 0 1 19 16v1h-6.07ZM6 11a5 5 0 0 1 5 5v1H1v-1a5 5 0 0 1 5-5Z" />
            </svg>
          }
        />

        {/* رصيد الفلوس */}
        <StatCard
          title="رصيد الفلوس"
          value={`${fmt(stats.money_balance)} ج`}
          color={moneyPositive ? 'text-green-600' : 'text-red-600'}
          iconBg={moneyPositive ? 'bg-green-50' : 'bg-red-50'}
          icon={
            <svg className={`w-5 h-5 ${moneyPositive ? 'text-green-500' : 'text-red-500'}`} viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2a8 8 0 1 0 0 16A8 8 0 0 0 10 2Zm1 11.5V14a1 1 0 1 1-2 0v-.535A3.002 3.002 0 0 1 10 7a1 1 0 1 0 0-2 1 1 0 0 0-1 1H7a3 3 0 0 1 4-2.83V3a1 1 0 1 1 2 0v.17A3.001 3.001 0 0 1 13 9a3 3 0 0 1-2 2.83V13.5Z" />
              <path fillRule="evenodd" d="M10 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
          }
        />

        {/* إجمالي الذهب */}
        <StatCard
          title="إجمالي الذهب"
          value={`${fmtW(stats.total_gold)} جم`}
          color="text-amber-600"
          iconBg="bg-amber-50"
          icon={
            <svg className="w-5 h-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 1 3 7h14L10 1ZM3 9h14v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9Zm4 2a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7Z" clipRule="evenodd" />
            </svg>
          }
        />

        {/* إجمالي التحويلات */}
        <StatCard
          title="إجمالي التحويلات"
          value={`${fmtW(stats.total_transfers)} جم`}
          color="text-blue-600"
          iconBg="bg-blue-50"
          icon={
            <svg className="w-5 h-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.389Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0v2.43l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clipRule="evenodd" />
            </svg>
          }
        />
      </div>

      {/* Recent Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* آخر عمليات الذهب */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <h2 className="font-bold text-stone-700 text-sm">آخر عمليات الذهب</h2>
            </div>
          </div>
          <div className="px-5 py-3">
            {recent.deals.length === 0 ? (
              <EmptyState title="لا توجد بيانات" />
            ) : (
              recent.deals.map((d: any, i: number) => (
                <div key={i} className="flex justify-between items-center py-2.5 border-b border-stone-50 last:border-0">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-stone-800 text-sm truncate">{d.trader_name}</span>
                      <Badge
                        label={d.deal_type === 'sell' ? 'بيع' : 'شراء'}
                        color={d.deal_type === 'sell' ? 'orange' : 'amber'}
                      />
                    </div>
                    <span className="text-xs text-stone-400">{fmtW(d.weight)} جم × {fmt(d.price_per_gram)}</span>
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
          <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <h2 className="font-bold text-stone-700 text-sm">آخر عمليات الفلوس</h2>
            </div>
          </div>
          <div className="px-5 py-3">
            {recent.payments.length === 0 ? (
              <EmptyState title="لا توجد بيانات" />
            ) : (
              recent.payments.map((p: any, i: number) => (
                <div key={i} className="flex justify-between items-center py-2.5 border-b border-stone-50 last:border-0">
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
          <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              <h2 className="font-bold text-stone-700 text-sm">آخر التحويلات</h2>
            </div>
          </div>
          <div className="px-5 py-3">
            {recent.transfers.length === 0 ? (
              <EmptyState title="لا توجد بيانات" />
            ) : (
              recent.transfers.map((t: any, i: number) => (
                <div key={i} className="flex justify-between items-center py-2.5 border-b border-stone-50 last:border-0">
                  <span className="text-stone-700 text-sm">
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

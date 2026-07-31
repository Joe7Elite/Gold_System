import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import TraderOps, { OpKind, GiveType } from '../components/TraderOps';
import { PageLoader } from '../components/ui/Spinner';

export default function SaberFouda() {
  const [traders, setTraders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<OpKind>('none');
  const [initial, setInitial] = useState<any>({});
  const [giveType, setGiveType] = useState<GiveType>('give_scrap');
  const [opId, setOpId] = useState(0);
  const [resetting, setResetting] = useState<number | null>(null);

  const load = async () => {
    try {
      const res = await api.get('/traders');
      setTraders(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const accounts = traders
    .filter((t) => t.is_pinned)
    .sort((a, b) => Number(a.base_karat) - Number(b.base_karat));

  const open = (kind: OpKind, extra: any = {}, gt?: GiveType) => {
    if (gt) setGiveType(gt);
    setInitial(extra);
    setOpId((n) => n + 1);
    setModal(kind);
  };

  const reset = async (t: any) => {
    if (!confirm(`تصفير حساب "${t.name}"؟\nكل العمليات هتتمسح ويبدأ الحساب من الأول.`)) return;
    setResetting(t.id);
    try {
      await api.delete(`/traders/${t.id}/reset`);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'فشل التصفير');
    } finally {
      setResetting(null);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4 max-w-3xl">
      {/* ── العنوان ── */}
      <div>
        <h1 className="text-2xl font-extrabold text-stone-800">صابر فوده</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          حسابين ثابتين — عيار 18 وعيار 21، كل واحد لوحده
        </p>
      </div>

      {accounts.length === 0 && (
        <div className="card p-6 text-center text-stone-500 text-sm">
          الحسابات مش موجودة. حدّث الصفحة بعد شوية.
        </div>
      )}

      {/* ── الحسابات ── */}
      {accounts.map((t) => {
        const base = Number(t.base_karat) === 18 ? 18 : 21;
        const gold = Number(t.gold_balance) || 0;
        const money = Number(t.money_balance) || 0;
        return (
          <div key={t.id} className="card overflow-hidden">
            {/* رأس الكارت */}
            <div className="px-4 py-3 border-b border-stone-100">
              <h2 className="font-bold text-stone-800">عيار {base}</h2>
            </div>

            {/* الأرصدة */}
            <div className="grid grid-cols-2 divide-x divide-x-reverse divide-stone-100 border-b border-stone-100">
              <Balance
                label={`الدهب (عيار ${base})`}
                value={`${Math.abs(gold).toLocaleString('ar-EG', { maximumFractionDigits: 2 })} جم`}
                positive={gold >= 0}
                zero={Math.abs(gold) < 0.01}
              />
              <Balance
                label="الفلوس"
                value={`${Math.abs(Math.round(money)).toLocaleString('ar-EG')} ج`}
                positive={money <= 0}
                zero={Math.abs(money) < 1}
              />
            </div>

            {/* العمليات */}
            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Op label="استلام شغل" primary onClick={() => open('work', { trader_id: t.id, _locked: true, original_karat: String(base) })} />
              <Op label="إدي كسر" onClick={() => open('give', { trader_id: t.id, _locked: true, _fixedGive: true, original_karat: String(base) }, 'give_scrap')} />
              <Op label="سبيكة بلدي" onClick={() => open('give', { trader_id: t.id, _locked: true, _fixedGive: true }, 'give_local_bar')} />
              <Op label="حوالة له" onClick={() => open('transfer', { to_trader_id: t.id, _lockedTo: true, original_karat: '21' })} />
              <Op label="فلوس" onClick={() => open('payment', { trader_id: t.id, _locked: true })} />
              <Link
                to={`/traders/${t.id}`}
                className="py-2.5 rounded-xl text-sm font-semibold text-center bg-stone-800 text-white hover:bg-stone-700 transition-colors"
              >
                كشف الحساب
              </Link>
            </div>

            {/* صفر الحساب */}
            <div className="px-4 pb-3">
              <button
                onClick={() => reset(t)}
                disabled={resetting === t.id}
                className="text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-50"
              >
                {resetting === t.id ? 'جاري التصفير...' : 'صفر الحساب'}
              </button>
            </div>
          </div>
        );
      })}

      {/* ── المودالات ── */}
      {modal !== 'none' && (
        <TraderOps
          key={opId}
          kind={modal}
          initial={initial}
          traders={traders}
          giveType={giveType}
          onClose={() => setModal('none')}
          onDone={load}
        />
      )}
    </div>
  );
}

function Balance({ label, value, positive, zero }: { label: string; value: string; positive: boolean; zero: boolean }) {
  const color = zero ? 'text-stone-400' : positive ? 'text-emerald-600' : 'text-red-600';
  return (
    <div className="px-4 py-3">
      <p className="text-[11px] text-stone-400 mb-1">{label}</p>
      <p className={`text-lg font-extrabold ${color}`}>{value}</p>
      <p className="text-[10px] text-stone-400">{zero ? 'مفيش' : positive ? 'ليك' : 'عليك'}</p>
    </div>
  );
}

function Op({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${
        primary
          ? 'bg-amber-600 text-white hover:bg-amber-700'
          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
      }`}
    >
      {label}
    </button>
  );
}

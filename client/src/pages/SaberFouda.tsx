import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import TraderOps, { OpKind, GiveType, FormError } from '../components/TraderOps';
import Modal from '../components/ui/Modal';
import { PageLoader } from '../components/ui/Spinner';

export default function SaberFouda() {
  const { user } = useAuth();
  const isAdmin = !!(user as any)?.is_protected;

  const [traders, setTraders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<OpKind>('none');
  const [initial, setInitial] = useState<any>({});
  const [giveType, setGiveType] = useState<GiveType>('give_scrap');
  const [opId, setOpId] = useState(0);
  const [resetting, setResetting] = useState<number | null>(null);

  const [openingFor, setOpeningFor] = useState<any>(null);

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
    <div className="space-y-4 max-w-3xl pb-4">
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
            {/* رأس الكارت — clickable → كشف الحساب */}
            <Link
              to={`/traders/${t.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 border-b border-stone-100 hover:bg-stone-50 transition-colors"
            >
              <div>
                <h2 className="font-bold text-stone-800">عيار {base}</h2>
                <p className="text-[11px] text-stone-400 mt-0.5">دوس لكشف الحساب</p>
              </div>
              <svg className="w-4 h-4 text-stone-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>

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
            <div className="p-3 grid grid-cols-3 gap-2">
              <Op label="استلام شغل" primary onClick={() => open('work', { trader_id: t.id, _locked: true, original_karat: String(base) })} />
              <Op label="إدي" onClick={() => open('give', { trader_id: t.id, _locked: true, original_karat: String(base) }, 'give_scrap')} />
              <Op label="فلوس" onClick={() => open('payment', { trader_id: t.id, _locked: true })} />
            </div>

            {/* أزرار الإدارة */}
            <div className="px-4 pb-3 flex items-center gap-4">
              <button
                onClick={() => reset(t)}
                disabled={resetting === t.id}
                className="text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-50"
              >
                {resetting === t.id ? 'جاري التصفير...' : 'صفر الحساب'}
              </button>
              {isAdmin && (
                <button
                  onClick={() => setOpeningFor(t)}
                  className="text-xs font-semibold text-stone-500 hover:text-stone-700"
                >
                  رصيد افتتاحي
                </button>
              )}
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
          giveOptions={['give_scrap', 'give_local_bar']}
          onClose={() => setModal('none')}
          onDone={load}
        />
      )}

      {openingFor && (
        <OpeningBalance
          trader={openingFor}
          onClose={() => setOpeningFor(null)}
          onDone={load}
        />
      )}
    </div>
  );
}

/* ===================== رصيد افتتاحي ===================== */

function OpeningBalance({ trader, onClose, onDone }: { trader: any; onClose: () => void; onDone: () => void }) {
  const base = Number(trader.base_karat) === 18 ? 18 : 21;
  const [weight, setWeight] = useState('');
  const [weightSide, setWeightSide] = useState<'ليك' | 'عليك'>('ليك');
  const [money, setMoney] = useState('');
  const [moneySide, setMoneySide] = useState<'loan' | 'payment'>('loan');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const w = Number(weight) || 0;
    const m = Number(money) || 0;
    if (w <= 0 && m <= 0) { setError('اكتب دهب أو فلوس'); return; }
    setSubmitting(true);
    try {
      if (w > 0) {
        await api.post('/transactions/deal', {
          trader_id: trader.id,
          weight: w,
          price_per_gram: 0,
          total_amount: 0,
          original_karat: base,
          original_weight: w,
          deal_type: weightSide === 'عليك' ? 'work' : 'buy',
          notes: 'رصيد افتتاحي - دهب',
        });
      }
      if (m > 0) {
        await api.post('/transactions/payment', {
          trader_id: trader.id,
          amount: m,
          payment_type: moneySide,
          notes: 'رصيد افتتاحي - فلوس',
        });
      }
      onDone();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'حصل مشكلة');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`رصيد افتتاحي — عيار ${base}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && <FormError msg={error} />}

        <div className="space-y-2">
          <input
            type="number" step="any" min="0"
            placeholder={`الدهب (جرام عيار ${base})`}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="input-field"
          />
          {Number(weight) > 0 && (
            <Toggle
              options={[
                { value: 'ليك', label: 'ليك', active: 'bg-emerald-500' },
                { value: 'عليك', label: 'عليك', active: 'bg-red-500' },
              ]}
              value={weightSide}
              onChange={(v) => setWeightSide(v as any)}
            />
          )}
        </div>

        <div className="space-y-2">
          <input
            type="number" step="any" min="0"
            placeholder="الفلوس (جنيه)"
            value={money}
            onChange={(e) => setMoney(e.target.value)}
            className="input-field"
          />
          {Number(money) > 0 && (
            <Toggle
              options={[
                { value: 'loan', label: 'عليك', active: 'bg-red-500' },
                { value: 'payment', label: 'ليك', active: 'bg-emerald-500' },
              ]}
              value={moneySide}
              onChange={(v) => setMoneySide(v as any)}
            />
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={submitting} className="btn-primary flex-1 py-2.5 disabled:opacity-50">
            {submitting ? 'جاري...' : 'تسجيل'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">إلغاء</button>
        </div>
      </form>
    </Modal>
  );
}

function Toggle({
  options, value, onChange,
}: {
  options: { value: string; label: string; active: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-2 bg-stone-100 rounded-xl p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            value === o.value ? `${o.active} text-white shadow-sm` : 'text-stone-500'
          }`}
        >
          {o.label}
        </button>
      ))}
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

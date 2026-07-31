import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/ui/Modal';
import { PageLoader } from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import TraderOps, { OpKind, FormError } from '../components/TraderOps';

export default function Traders() {
  const { user } = useAuth();
  const [traders, setTraders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [modal, setModal] = useState<OpKind>('none');
  const [initial, setInitial] = useState<any>({});
  const [opId, setOpId] = useState(0);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () =>
    api.get('/traders').then((r) => setTraders(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const fmt = (n: number) => n?.toLocaleString('ar-EG') || '0';
  const fmtW = (n: number) => n?.toLocaleString('ar-EG', { maximumFractionDigits: 2 }) || '0';

  const normal = traders.filter((t) => !t.is_pinned);
  const filtered = normal.filter((t) => t.name.includes(search) || t.phone?.includes(search));

  const open = (kind: OpKind, extra: any = {}) => {
    setInitial(extra);
    setOpId((n) => n + 1);
    setModal(kind);
  };

  const deleteTrader = async (t: any) => {
    if (!window.confirm(`متأكد إنك عايز تحذف ${t.name}؟`)) return;
    try {
      await api.delete(`/traders/${t.id}`);
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || 'مقدرش أحذف التاجر');
    }
  };

  const addTrader = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const newBase = Number(form.base_karat) === 18 ? 18 : 21;
      const res = await api.post('/traders', {
        name: form.name, phone: form.phone, address: form.address, notes: form.notes,
        base_karat: newBase,
      });
      const newId = res.data.id;
      if (form.init_weight && Number(form.init_weight) > 0) {
        const isGoldAgainstMe = form.init_weight_type === 'عليك';
        await api.post('/transactions/deal', {
          trader_id: newId, weight: Number(form.init_weight), price_per_gram: 0,
          total_amount: 0, original_karat: newBase, original_weight: Number(form.init_weight),
          deal_type: isGoldAgainstMe ? 'work' : 'buy', notes: 'رصيد افتتاحي - دهب',
        });
      }
      if (form.init_money && Number(form.init_money) > 0) {
        await api.post('/transactions/payment', {
          trader_id: newId, amount: Number(form.init_money),
          payment_type: form.init_money_type || 'loan', notes: 'رصيد افتتاحي - فلوس',
        });
      }
      setAddOpen(false);
      setForm({});
      load();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'حصل مشكلة');
    } finally {
      setSubmitting(false);
    }
  };

  // ── عرض الأرصدة بالألوان ──
  const goldView = (v: number) =>
    v > 0.004
      ? { amount: fmtW(v), tag: 'ليك', cls: 'text-emerald-600' }
      : v < -0.004
      ? { amount: fmtW(-v), tag: 'عليك', cls: 'text-red-600' }
      : { amount: '0', tag: 'مظبوط', cls: 'text-stone-400' };

  const moneyView = (v: number) =>
    v > 0.5
      ? { amount: fmt(Math.round(v)), tag: 'عليك', cls: 'text-red-600' }
      : v < -0.5
      ? { amount: fmt(Math.round(-v)), tag: 'ليك', cls: 'text-emerald-600' }
      : { amount: '0', tag: 'مظبوط', cls: 'text-stone-400' };

  if (loading) return <PageLoader />;

  return (
    <div className="pb-4">
      {/* ===== Header ===== */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-stone-800">التجار</h1>
          <p className="text-xs text-stone-400 mt-0.5">{normal.length} تاجر</p>
        </div>
        <button onClick={() => { setForm({}); setFormError(''); setAddOpen(true); }} className="btn-primary shrink-0">
          + تاجر جديد
        </button>
      </div>

      {/* ===== رابط صابر فوده ===== */}
      <Link
        to="/saber"
        className="flex items-center justify-between gap-3 card px-4 py-3 mb-3 hover:shadow-card transition-shadow"
      >
        <span className="font-bold text-stone-800 text-sm">صابر فوده</span>
        <span className="flex items-center gap-2 text-xs text-stone-400">
          حساب ثابت 18 / 21
          <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </span>
      </Link>

      {/* Search */}
      <div className="card px-4 py-2.5 mb-3">
        <div className="flex items-center gap-3">
          <svg className="w-4 h-4 text-stone-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            placeholder="بحث بالاسم أو التليفون..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-stone-700 placeholder:text-stone-400 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-stone-400 hover:text-stone-600 text-lg leading-none">×</button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="👥" title="مفيش تجار" sub="أضف أول تاجر من زر (+ تاجر جديد)" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => {
            const base = Number(t.base_karat) === 18 ? 18 : 21;
            const g = goldView(t.gold_balance);
            const m = moneyView(t.money_balance);
            return (
              <div key={t.id} className="card p-0 overflow-hidden hover:shadow-card transition-shadow">
                {/* Card header */}
                <div className="px-3.5 py-3 flex items-center justify-between gap-2 border-b border-stone-100 bg-stone-50/70">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold-100 to-gold-300 text-gold-900 flex items-center justify-center font-extrabold shrink-0">
                      {(t.name || '?').trim().charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <Link to={`/traders/${t.id}`} className="block font-bold text-stone-800 truncate hover:text-gold-700">
                        {t.name}
                      </Link>
                      <p className="text-[11px] text-stone-400 truncate">{t.phone || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] font-bold px-1.5 py-1 rounded ${base === 18 ? 'bg-amber-100 text-amber-800' : 'bg-stone-200 text-stone-600'}`}>
                      ع{base}
                    </span>
                    {(user as any)?.is_protected && (
                      <button
                        onClick={() => deleteTrader(t)}
                        title="حذف التاجر"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Card body */}
                <div className="p-3 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-stone-50 border border-stone-100 px-3 py-2">
                      <p className="text-[11px] text-stone-400 mb-0.5">الدهب</p>
                      <p className={`font-extrabold text-[15px] leading-tight ${g.cls}`}>
                        {g.amount} <span className="text-[11px] font-semibold">جم</span>
                      </p>
                      <p className={`text-[11px] font-bold ${g.cls}`}>{g.tag}</p>
                    </div>
                    <div className="rounded-xl bg-stone-50 border border-stone-100 px-3 py-2">
                      <p className="text-[11px] text-stone-400 mb-0.5">الفلوس</p>
                      <p className={`font-extrabold text-[15px] leading-tight ${m.cls}`}>
                        {m.amount} <span className="text-[11px] font-semibold">ج</span>
                      </p>
                      <p className={`text-[11px] font-bold ${m.cls}`}>{m.tag}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <ActionBtn tone="amber" label="قطع" onClick={() => open('deal', { trader_id: t.id, _locked: true })} />
                    <ActionBtn tone="red" label="شغل" onClick={() => open('work', { trader_id: t.id, _locked: true })} />
                    <ActionBtn tone="emerald" label="إدي" onClick={() => open('give', { trader_id: t.id, _locked: true })} />
                    <ActionBtn tone="green" label="فلوس" onClick={() => open('payment', { trader_id: t.id, _locked: true })} />
                    <ActionBtn tone="blue" label="تحويل" onClick={() => open('transfer', { from_trader_id: t.id, _lockedFrom: true })} />
                    <Link
                      to={`/traders/${t.id}`}
                      className="text-center text-xs font-bold py-2 rounded-lg bg-stone-800 text-white hover:bg-stone-700 transition-colors"
                    >
                      كشف
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== العمليات ===== */}
      {modal !== 'none' && (
        <TraderOps
          key={opId}
          kind={modal}
          initial={initial}
          traders={traders}
          onClose={() => setModal('none')}
          onDone={load}
        />
      )}

      {/* ===== إضافة تاجر ===== */}
      {addOpen && (
        <Modal title="إضافة تاجر جديد" onClose={() => setAddOpen(false)}>
          <form onSubmit={addTrader} className="space-y-3">
            {formError && <FormError msg={formError} />}
            <input
              placeholder="اسم التاجر *"
              value={form.name || ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field"
              required
            />
            <input
              placeholder="التليفون"
              value={form.phone || ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input-field"
            />
            <input
              placeholder="العنوان"
              value={form.address || ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="input-field"
            />
            <textarea
              placeholder="ملاحظات"
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-field"
              rows={2}
            />

            {/* عيار الحساب */}
            <div className="border-t border-stone-100 pt-3 mt-2">
              <p className="text-sm font-semibold text-stone-500 mb-2">عيار الحساب</p>
              <div className="flex gap-2 bg-stone-100 rounded-xl p-1">
                <button type="button"
                  onClick={() => setForm({ ...form, base_karat: 21 })}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${Number(form.base_karat || 21) === 21 ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'}`}>
                  عيار 21
                </button>
                <button type="button"
                  onClick={() => setForm({ ...form, base_karat: 18 })}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${Number(form.base_karat) === 18 ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'}`}>
                  عيار 18
                </button>
              </div>
              <p className="text-xs text-stone-400 mt-1.5">
                كل الأوزان في حساب التاجر ده هتتحول لعيار {Number(form.base_karat) === 18 ? '18' : '21'}
              </p>
            </div>

            {/* رصيد افتتاحي (اختياري) */}
            <div className="border-t border-stone-100 pt-3 mt-2">
              <p className="text-sm font-semibold text-stone-500 mb-3">رصيد افتتاحي (اختياري)</p>
              <div className="space-y-3">
                <input
                  type="number" step="any" min="0"
                  placeholder={`رصيد الدهب (جرام عيار ${Number(form.base_karat) === 18 ? '18' : '21'})`}
                  value={form.init_weight || ''}
                  onChange={(e) => setForm({ ...form, init_weight: e.target.value })}
                  className="input-field"
                />
                {form.init_weight && Number(form.init_weight) > 0 && (
                  <div>
                    <p className="text-xs text-stone-400 mb-1.5">الدهب ده عليك ولا ليك؟</p>
                    <div className="flex gap-2 bg-stone-100 rounded-xl p-1">
                      <button type="button"
                        onClick={() => setForm({ ...form, init_weight_type: 'ليك' })}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${(form.init_weight_type || 'ليك') === 'ليك' ? 'bg-emerald-500 text-white shadow-sm' : 'text-stone-500'}`}>
                        ليك
                      </button>
                      <button type="button"
                        onClick={() => setForm({ ...form, init_weight_type: 'عليك' })}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${form.init_weight_type === 'عليك' ? 'bg-red-500 text-white shadow-sm' : 'text-stone-500'}`}>
                        عليك
                      </button>
                    </div>
                  </div>
                )}
                <input
                  type="number" step="any" min="0"
                  placeholder="رصيد الفلوس (جنيه)"
                  value={form.init_money || ''}
                  onChange={(e) => setForm({ ...form, init_money: e.target.value })}
                  className="input-field"
                />
                {form.init_money && Number(form.init_money) > 0 && (
                  <div>
                    <p className="text-xs text-stone-400 mb-1.5">الفلوس دي عليك ولا ليك؟</p>
                    <div className="flex gap-2 bg-stone-100 rounded-xl p-1">
                      <button type="button"
                        onClick={() => setForm({ ...form, init_money_type: 'loan' })}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${(form.init_money_type || 'loan') === 'loan' ? 'bg-red-500 text-white shadow-sm' : 'text-stone-500'}`}>
                        عليك
                      </button>
                      <button type="button"
                        onClick={() => setForm({ ...form, init_money_type: 'payment' })}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${form.init_money_type === 'payment' ? 'bg-emerald-500 text-white shadow-sm' : 'text-stone-500'}`}>
                        ليك
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={submitting} className="btn-primary flex-1 py-2.5 disabled:opacity-50">
                {submitting ? 'جاري...' : 'إضافة'}
              </button>
              <button type="button" onClick={() => setAddOpen(false)} className="btn-secondary flex-1 py-2.5">
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ===================== Action Button ===================== */

const TONES: Record<string, string> = {
  amber: 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-100',
  red: 'bg-red-50 text-red-700 hover:bg-red-100 border-red-100',
  emerald: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-100',
  green: 'bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-100',
  blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100',
  stone: 'bg-stone-100 text-stone-700 hover:bg-stone-200 border-stone-200',
};

function ActionBtn({ label, onClick, tone = 'stone' }: { label: string; onClick: () => void; tone?: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-bold py-2 rounded-lg border transition-colors ${TONES[tone] || TONES.stone}`}
    >
      {label}
    </button>
  );
}

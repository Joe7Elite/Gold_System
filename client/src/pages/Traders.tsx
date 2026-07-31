import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/ui/Modal';
import { PageLoader } from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';

type ModalKind = 'none' | 'add-trader' | 'deal' | 'payment' | 'transfer' | 'work' | 'give';
type DealType = 'buy' | 'sell';
type PaymentType = 'payment' | 'loan';
type GiveType = 'give' | 'give_scrap' | 'give_local_bar';

const GIVE_LABELS: Record<GiveType, string> = {
  give: 'لوجوهات',
  give_scrap: 'كسر',
  give_local_bar: 'سبيكة بلدي',
};

export default function Traders() {
  const { user } = useAuth();
  const [traders, setTraders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalKind>('none');
  const [form, setForm] = useState<any>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dealType, setDealType] = useState<DealType>('buy');
  const [paymentType, setPaymentType] = useState<PaymentType>('payment');
  const [giveType, setGiveType] = useState<GiveType>('give');

  const load = () =>
    api.get('/traders').then((r) => setTraders(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const fmt = (n: number) => n?.toLocaleString('ar-EG') || '0';
  const fmtW = (n: number) =>
    n?.toLocaleString('ar-EG', { maximumFractionDigits: 2 }) || '0';

  const pinned = traders.filter((t) => t.is_pinned);
  const normal = traders.filter((t) => !t.is_pinned);
  const filtered = normal.filter(
    (t) => t.name.includes(search) || t.phone?.includes(search)
  );

  const openModal = (
    type: ModalKind,
    prefill?: any,
    opts?: { giveType?: GiveType; dealType?: DealType; paymentType?: PaymentType }
  ) => {
    setModal(type);
    setForm(prefill || {});
    setFormError('');
    setDealType(opts?.dealType || 'buy');
    setPaymentType(opts?.paymentType || 'payment');
    setGiveType(opts?.giveType || 'give');
  };

  const closeModal = () => {
    setModal('none');
    setForm({});
    setFormError('');
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

  const effectiveKarat = Number(form.original_karat || 21);

  // عيار حساب التاجر (21 أو 18)
  const baseKaratOf = (traderId: any) => {
    const t = traders.find((x) => String(x.id) === String(traderId));
    return Number(t?.base_karat) === 18 ? 18 : 21;
  };
  const traderById = (id: any) => traders.find((x) => String(x.id) === String(id));

  // عيار حساب التاجر المختار حالياً في المودال
  const selectedBase = baseKaratOf(form.trader_id);

  // تحويل الوزن لعيار حساب التاجر
  const toBase = (w: number, karat: number, isFineness: boolean, base: number) => {
    if (isFineness) return (w * karat) / ((base * 1000) / 24); // سبيكة بلدي: 21→875, 18→750
    return karat !== base ? (w * karat) / base : w; // عيار عادي: 18, 21, 24
  };

  const dealTotal = () => {
    const karat = effectiveKarat;
    const w = Number(form.weight) || 0;
    const p = Number(form.price_per_gram) || 0;
    const wb = toBase(w, karat, false, selectedBase);
    return { weight21: wb, total: wb * p };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      if (modal === 'add-trader') {
        const res = await api.post('/traders', {
          name: form.name, phone: form.phone, address: form.address, notes: form.notes,
          base_karat: Number(form.base_karat) === 18 ? 18 : 21,
        });
        const newId = res.data.id;
        const newBase = Number(form.base_karat) === 18 ? 18 : 21;
        // لو فيه رصيد افتتاحي (وزن أو فلوس) سجله - الوزن بعيار حساب التاجر
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
      } else if (modal === 'deal') {
        const karat = effectiveKarat;
        const origWeight = Number(form.weight);
        const base = baseKaratOf(form.trader_id);
        const weightBase = toBase(origWeight, karat, false, base);
        await api.post('/transactions/deal', {
          trader_id: form.trader_id,
          weight: weightBase,
          price_per_gram: Number(form.price_per_gram),
          original_karat: karat,
          original_weight: origWeight,
          deal_type: dealType,
          notes: form.notes || '',
        });
      } else if (modal === 'work') {
        const karat = effectiveKarat;
        const origWeight = Number(form.weight);
        const base = baseKaratOf(form.trader_id);
        const weightBase = toBase(origWeight, karat, false, base);
        await api.post('/transactions/deal', {
          trader_id: form.trader_id,
          weight: weightBase,
          price_per_gram: 0,
          total_amount: Number(form.craftsmanship) || 0,
          original_karat: karat,
          original_weight: origWeight,
          deal_type: 'work',
          notes: form.notes || '',
        });
      } else if (modal === 'payment') {
        await api.post('/transactions/payment', {
          trader_id: form.trader_id,
          amount: Number(form.amount),
          payment_type: paymentType,
          notes: form.notes || '',
        });
      } else if (modal === 'give') {
        const isLocalBar = giveType === 'give_local_bar';
        const karat = isLocalBar ? Number(form.fineness) : effectiveKarat;
        const origWeight = Number(form.weight);
        const base = baseKaratOf(form.trader_id);
        const weightBase = toBase(origWeight, karat, isLocalBar, base);
        await api.post('/transactions/deal', {
          trader_id: form.trader_id,
          weight: weightBase,
          price_per_gram: 0,
          original_karat: karat,
          original_weight: origWeight,
          deal_type: giveType,
          notes: form.notes || '',
        });
      } else if (modal === 'transfer') {
        const karat = effectiveKarat;
        const origWeight = Number(form.weight);
        let toTraderId = form.to_trader_id;
        // لو التاجر مش موجود، أنشئه أول
        if (!toTraderId && form.to_trader_name?.trim()) {
          const res = await api.post('/traders', {
            name: form.to_trader_name.trim(),
            base_karat: Number(form.to_base_karat) === 18 ? 18 : 21,
          });
          toTraderId = res.data.id;
        }
        if (!toTraderId) { setFormError('اختار أو اكتب اسم التاجر'); setSubmitting(false); return; }
        // السيرفر بيحسب الوزن بعيار حساب كل تاجر لوحده
        await api.post('/transactions/transfer', {
          from_trader_id: form.from_trader_id,
          to_trader_id: toTraderId,
          weight: origWeight,
          original_karat: karat,
          original_weight: origWeight,
          notes: form.notes || '',
        });
      }
      closeModal();
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

  const Balances = ({ t }: { t: any }) => {
    const g = goldView(t.gold_balance);
    const m = moneyView(t.money_balance);
    return (
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
    );
  };

  if (loading) return <PageLoader />;

  return (
    <div className="pb-4">
      {/* ===== Header ===== */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-stone-800">التجار</h1>
          <p className="text-xs text-stone-400 mt-0.5">{normal.length} تاجر + {pinned.length} حساب ثابت</p>
        </div>
        <button onClick={() => openModal('add-trader')} className="btn-primary shrink-0">
          + تاجر جديد
        </button>
      </div>

      {/* ===== قسم صابر فوده ===== */}
      {pinned.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm shrink-0">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.368 2.446a1 1 0 00-.363 1.118l1.285 3.957c.3.922-.755 1.688-1.538 1.118l-3.367-2.446a1 1 0 00-1.176 0l-3.367 2.446c-.783.57-1.838-.196-1.538-1.118l1.285-3.957a1 1 0 00-.363-1.118L2.078 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.951-.69l1.27-3.958z" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-stone-800 text-lg leading-tight">صابر فوده</h2>
              <p className="text-xs text-stone-400">حساب ثابت — عيار 18 و عيار 21 كل واحد لوحده</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {pinned.map((t) => {
              const base = Number(t.base_karat) === 18 ? 18 : 21;
              return (
                <div key={t.id} className="rounded-2xl border border-amber-200/80 bg-white shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gradient-to-l from-amber-600 to-amber-500 flex items-center justify-between">
                    <div>
                      <p className="text-white font-bold text-base leading-tight">{t.name}</p>
                      <p className="text-amber-100 text-[11px] mt-0.5">كل الأوزان بعيار {base}</p>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                      <span className="text-white text-lg font-extrabold">{base}</span>
                    </div>
                  </div>

                  <div className="p-3.5 space-y-3">
                    <Balances t={t} />

                    <div className="grid grid-cols-2 gap-2">
                      <ActionBtn
                        tone="red"
                        label="استلام شغل"
                        onClick={() => openModal('work', { trader_id: t.id, _locked: true, original_karat: String(base) })}
                      />
                      <ActionBtn
                        tone="emerald"
                        label="إدي كسر"
                        onClick={() => openModal('give', { trader_id: t.id, _locked: true, _fixedGive: true, original_karat: String(base) }, { giveType: 'give_scrap' })}
                      />
                      <ActionBtn
                        tone="yellow"
                        label="سبيكة بلدي"
                        onClick={() => openModal('give', { trader_id: t.id, _locked: true, _fixedGive: true }, { giveType: 'give_local_bar' })}
                      />
                      <ActionBtn
                        tone="blue"
                        label="تحويل منه"
                        onClick={() => openModal('transfer', { from_trader_id: t.id, _lockedFrom: true, original_karat: String(base) })}
                      />
                      <ActionBtn
                        tone="stone"
                        label="فلوس"
                        onClick={() => openModal('payment', { trader_id: t.id, _locked: true })}
                      />
                      <Link
                        to={`/traders/${t.id}`}
                        className="text-center text-xs font-bold py-2.5 rounded-xl bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                      >
                        كشف الحساب
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== قسم التجار ===== */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-stone-600 to-stone-800 flex items-center justify-center shadow-sm shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <div>
          <h2 className="font-bold text-stone-800 text-lg leading-tight">باقي التجار</h2>
          <p className="text-xs text-stone-400">كل العمليات جوه كارت التاجر</p>
        </div>
      </div>

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
                  <Balances t={t} />

                  <div className="grid grid-cols-3 gap-1.5">
                    <ActionBtn tone="amber" label="قطع" onClick={() => openModal('deal', { trader_id: t.id, _locked: true })} />
                    <ActionBtn tone="red" label="شغل" onClick={() => openModal('work', { trader_id: t.id, _locked: true })} />
                    <ActionBtn tone="emerald" label="إدي" onClick={() => openModal('give', { trader_id: t.id, _locked: true })} />
                    <ActionBtn tone="green" label="فلوس" onClick={() => openModal('payment', { trader_id: t.id, _locked: true })} />
                    <ActionBtn tone="blue" label="تحويل" onClick={() => openModal('transfer', { from_trader_id: t.id, _lockedFrom: true })} />
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

      {/* ===== MODALS ===== */}

      {/* ── Add Trader ── */}
      {modal === 'add-trader' && (
        <Modal title="إضافة تاجر جديد" onClose={closeModal}>
          <form onSubmit={handleSubmit} className="space-y-3">
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

            <ModalButtons submitting={submitting} onCancel={closeModal} label="إضافة" />
          </form>
        </Modal>
      )}

      {/* ── قطع (شراء / بيع بسعر) ── */}
      {modal === 'deal' && (
        <Modal title="قطع" onClose={closeModal}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && <FormError msg={formError} />}

            <TraderField
              form={form} setForm={setForm} traders={traders} traderById={traderById} field="trader_id"
            />

            <div>
              <p className="text-sm font-medium text-stone-600 mb-2">نوع القطع</p>
              <div className="bg-stone-100 rounded-xl p-1 flex gap-1">
                {([
                  { value: 'buy' as DealType, label: 'شراء (عليك)' },
                  { value: 'sell' as DealType, label: 'بيع (ليك)' },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDealType(opt.value)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      dealType === opt.value
                        ? 'bg-white text-stone-800 shadow-sm'
                        : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number" step="any" min="0"
                placeholder="الوزن (جرام)"
                value={form.weight || ''}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                className="input-field"
                required
              />
              <KaratSelect form={form} setForm={setForm} />
            </div>

            <input
              type="number" step="any" min="0"
              placeholder="سعر الجرام"
              value={form.price_per_gram || ''}
              onChange={(e) => setForm({ ...form, price_per_gram: e.target.value })}
              className="input-field"
              required
            />

            {form.weight && form.price_per_gram && (
              <div className="card p-3 text-sm space-y-1">
                {effectiveKarat !== selectedBase && (
                  <div className="text-stone-600">الوزن بعيار {selectedBase}: <span className="font-bold text-amber-800">{dealTotal().weight21.toFixed(3)} جم</span></div>
                )}
                <div className="text-stone-600">الإجمالي: <span className="font-bold text-amber-700 text-base">{fmt(Math.round(dealTotal().total))} جنيه</span></div>
                <div className={`font-medium ${dealType === 'buy' ? 'text-red-600' : 'text-green-600'}`}>
                  {dealType === 'buy' ? '(عليك للتاجر)' : '(ليك من التاجر)'}
                </div>
              </div>
            )}

            <textarea
              placeholder="ملاحظات"
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-field"
              rows={2}
            />
            <ModalButtons submitting={submitting} onCancel={closeModal} label={dealType === 'buy' ? 'تسجيل شراء' : 'تسجيل بيع'} />
          </form>
        </Modal>
      )}

      {/* ── استلام شغل (جرامات + مصنعية) ── */}
      {modal === 'work' && (
        <Modal title="استلام شغل" onClose={closeModal}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && <FormError msg={formError} />}

            <TraderField
              form={form} setForm={setForm} traders={traders} traderById={traderById} field="trader_id"
            />

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number" step="any" min="0"
                placeholder="الوزن (جرام)"
                value={form.weight || ''}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                className="input-field"
                required
              />
              <KaratSelect form={form} setForm={setForm} />
            </div>

            <input
              type="number" step="any" min="0"
              placeholder="المصنعية (جنيه)"
              value={form.craftsmanship || ''}
              onChange={(e) => setForm({ ...form, craftsmanship: e.target.value })}
              className="input-field"
            />

            {form.weight && (
              <div className="card p-3 text-sm space-y-1">
                {effectiveKarat !== selectedBase && (
                  <div className="text-stone-600">الوزن بعيار {selectedBase}: <span className="font-bold text-amber-800">{dealTotal().weight21.toFixed(3)} جم</span></div>
                )}
                <div className="text-red-600 font-medium">
                  هيتحسب {effectiveKarat !== selectedBase ? dealTotal().weight21.toFixed(3) : form.weight} جم <span className="font-bold">عليك</span>
                </div>
                {form.craftsmanship && (
                  <div className="text-red-600 font-medium">+ مصنعية عليك: {fmt(Number(form.craftsmanship))} جنيه</div>
                )}
              </div>
            )}

            <textarea
              placeholder="ملاحظات (نوع الشغل...)"
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-field"
              rows={2}
            />
            <ModalButtons submitting={submitting} onCancel={closeModal} label="تسجيل استلام" />
          </form>
        </Modal>
      )}

      {/* ── إدي للتاجر (لوجوهات / كسر / سبيكة بلدي) ── */}
      {modal === 'give' && (
        <Modal title={form._fixedGive ? `إدي ${GIVE_LABELS[giveType]}` : 'إدي للتاجر'} onClose={closeModal}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && <FormError msg={formError} />}

            <TraderField
              form={form} setForm={setForm} traders={traders} traderById={traderById} field="trader_id"
            />

            {!form._fixedGive && (
              <div>
                <p className="text-sm font-medium text-stone-600 mb-2">النوع</p>
                <div className="bg-stone-100 rounded-xl p-1 flex gap-1">
                  {(['give', 'give_scrap', 'give_local_bar'] as GiveType[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setGiveType(v)}
                      className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                        giveType === v
                          ? 'bg-white text-stone-800 shadow-sm'
                          : 'text-stone-500 hover:text-stone-700'
                      }`}
                    >
                      {GIVE_LABELS[v]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number" step="any" min="0"
                placeholder="الوزن (جرام)"
                value={form.weight || ''}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                className="input-field"
                required
              />
              {giveType === 'give_local_bar' ? (
                <input
                  type="number" step="any" min="0"
                  placeholder="عيار السبيكة (750, 817...)"
                  value={form.fineness || ''}
                  onChange={(e) => setForm({ ...form, fineness: e.target.value })}
                  className="input-field"
                  required
                />
              ) : (
                <KaratSelect form={form} setForm={setForm} />
              )}
            </div>

            {form.weight && (() => {
              const isBar = giveType === 'give_local_bar';
              const k = isBar ? Number(form.fineness) : effectiveKarat;
              const wb = toBase(Number(form.weight) || 0, k, isBar, selectedBase);
              const changed = isBar ? !!form.fineness : k !== selectedBase;
              return (
                <div className="card p-3 text-sm space-y-1">
                  {changed && (
                    <div className="text-stone-600">الوزن بعيار {selectedBase}: <span className="font-bold text-amber-800">{wb.toFixed(3)} جم</span></div>
                  )}
                  <div className="text-emerald-700 font-medium">
                    {changed ? wb.toFixed(3) : form.weight} جم <span className="font-bold">ليك</span>
                  </div>
                  {isBar && (
                    <div className="text-emerald-700 font-medium">
                      + {fmt(Number(form.weight) * 8)} جنيه <span className="font-bold">ليك</span> (8ج × {form.weight} جرام)
                    </div>
                  )}
                </div>
              );
            })()}

            <textarea
              placeholder="ملاحظات"
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-field"
              rows={2}
            />
            <ModalButtons submitting={submitting} onCancel={closeModal} label="تسجيل" />
          </form>
        </Modal>
      )}

      {/* ── Cash Payment (عملية فلوس) ── */}
      {modal === 'payment' && (
        <Modal title="عملية فلوس" onClose={closeModal}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && <FormError msg={formError} />}

            <TraderField
              form={form} setForm={setForm} traders={traders} traderById={traderById} field="trader_id"
            />

            <div>
              <p className="text-sm font-medium text-stone-600 mb-2">نوع العملية</p>
              <div className="bg-stone-100 rounded-xl p-1 flex gap-1">
                {(
                  [
                    { value: 'payment', label: 'دفع فلوس' },
                    { value: 'loan', label: 'استلام سلفة' },
                  ] as { value: PaymentType; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPaymentType(opt.value)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      paymentType === opt.value
                        ? 'bg-white text-stone-800 shadow-sm'
                        : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="number" step="any" min="0"
              placeholder="المبلغ (جنيه)"
              value={form.amount || ''}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="input-field"
              required
            />

            <textarea
              placeholder="ملاحظات"
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-field"
              rows={2}
            />
            <ModalButtons
              submitting={submitting}
              onCancel={closeModal}
              label={paymentType === 'payment' ? 'تسجيل الدفع' : 'تسجيل السلفة'}
            />
          </form>
        </Modal>
      )}

      {/* ── Gold Transfer (تحويل دهب) ── */}
      {modal === 'transfer' && (
        <Modal title="تحويل دهب" onClose={closeModal}>
          <form onSubmit={handleSubmit} className="space-y-3">
            {formError && <FormError msg={formError} />}

            {form._lockedFrom ? (
              <LockedTrader label="من" trader={traderById(form.from_trader_id)} />
            ) : (
              <select
                value={form.from_trader_id || ''}
                onChange={(e) => setForm({ ...form, from_trader_id: Number(e.target.value) })}
                className="input-field"
                required
              >
                <option value="">من تاجر...</option>
                {traders.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}{Number(t.base_karat) === 18 ? ' (عيار 18)' : ''}</option>
                ))}
              </select>
            )}

            <div>
              <input
                list="to-trader-list"
                placeholder="لـ تاجر... (اختار أو اكتب اسم جديد)"
                value={form.to_trader_name || ''}
                onChange={(e) => {
                  const name = e.target.value;
                  const match = traders.find((t) => t.name === name);
                  setForm({ ...form, to_trader_name: name, to_trader_id: match?.id || 0 });
                }}
                className="input-field"
                required
              />
              <datalist id="to-trader-list">
                {traders.filter((t) => t.id !== form.from_trader_id).map((t) => (
                  <option key={t.id} value={t.name} />
                ))}
              </datalist>
            </div>

            {/* عيار حساب التاجر الجديد */}
            {!form.to_trader_id && form.to_trader_name?.trim() && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-800 mb-2">تاجر جديد - اختار عيار حسابه</p>
                <div className="flex gap-2 bg-white rounded-lg p-1">
                  <button type="button"
                    onClick={() => setForm({ ...form, to_base_karat: 21 })}
                    className={`flex-1 py-1.5 rounded-md text-sm font-semibold ${Number(form.to_base_karat || 21) === 21 ? 'bg-amber-100 text-amber-800' : 'text-stone-500'}`}>
                    عيار 21
                  </button>
                  <button type="button"
                    onClick={() => setForm({ ...form, to_base_karat: 18 })}
                    className={`flex-1 py-1.5 rounded-md text-sm font-semibold ${Number(form.to_base_karat) === 18 ? 'bg-amber-100 text-amber-800' : 'text-stone-500'}`}>
                    عيار 18
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number" step="any" min="0"
                placeholder="الوزن (جرام)"
                value={form.weight || ''}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                className="input-field"
                required
              />
              <KaratSelect form={form} setForm={setForm} />
            </div>

            {form.weight && (() => {
              const k = Number(form.original_karat || 21);
              const w = Number(form.weight) || 0;
              const fBase = baseKaratOf(form.from_trader_id);
              const tBase = form.to_trader_id
                ? baseKaratOf(form.to_trader_id)
                : (Number(form.to_base_karat) === 18 ? 18 : 21);
              if (k === fBase && k === tBase) return null;
              return (
                <div className="card p-3 text-sm space-y-1">
                  <div className="text-stone-600">
                    يتخصم من التاجر الأول:{' '}
                    <span className="font-bold text-red-600">{((w * k) / fBase).toFixed(3)} جم</span>
                    <span className="text-xs text-stone-400"> (عيار {fBase})</span>
                  </div>
                  <div className="text-stone-600">
                    يتضاف للتاجر التاني:{' '}
                    <span className="font-bold text-emerald-700">{((w * k) / tBase).toFixed(3)} جم</span>
                    <span className="text-xs text-stone-400"> (عيار {tBase})</span>
                  </div>
                </div>
              );
            })()}

            <textarea
              placeholder="ملاحظات"
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-field"
              rows={2}
            />
            <ModalButtons submitting={submitting} onCancel={closeModal} label="تسجيل التحويل" />
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ===================== Sub components ===================== */

const TONES: Record<string, string> = {
  amber: 'bg-amber-50 text-amber-800 hover:bg-amber-100',
  red: 'bg-red-50 text-red-700 hover:bg-red-100',
  emerald: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  green: 'bg-green-50 text-green-700 hover:bg-green-100',
  blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
  yellow: 'bg-yellow-50 text-yellow-800 hover:bg-yellow-100',
  stone: 'bg-stone-100 text-stone-600 hover:bg-stone-200',
};

function ActionBtn({ label, tone, onClick }: { label: string; tone: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-bold py-2 sm:py-2.5 rounded-lg transition-colors ${TONES[tone] || TONES.stone}`}
    >
      {label}
    </button>
  );
}

function FormError({ msg }: { msg: string }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">{msg}</div>
  );
}

function LockedTrader({ trader, label = 'التاجر' }: { trader: any; label?: string }) {
  const base = Number(trader?.base_karat) === 18 ? 18 : 21;
  return (
    <div className="flex items-center gap-3 rounded-xl bg-stone-50 border border-stone-200 px-3.5 py-2.5">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-100 to-gold-300 text-gold-900 flex items-center justify-center font-extrabold text-sm shrink-0">
        {(trader?.name || '?').trim().charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-stone-400 leading-none mb-0.5">{label}</p>
        <p className="font-bold text-stone-800 text-sm truncate">{trader?.name || '—'}</p>
      </div>
      <span className={`text-[10px] font-bold px-1.5 py-1 rounded shrink-0 ${base === 18 ? 'bg-amber-100 text-amber-800' : 'bg-stone-200 text-stone-600'}`}>
        حساب ع{base}
      </span>
    </div>
  );
}

function TraderField({
  form, setForm, traders, traderById, field,
}: {
  form: any; setForm: (v: any) => void; traders: any[]; traderById: (id: any) => any; field: string;
}) {
  if (form._locked) return <LockedTrader trader={traderById(form[field])} />;
  return (
    <select
      value={form[field] || ''}
      onChange={(e) => setForm({ ...form, [field]: Number(e.target.value) })}
      className="input-field"
      required
    >
      <option value="">اختار التاجر</option>
      {traders.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}{Number(t.base_karat) === 18 ? ' (عيار 18)' : ''}
        </option>
      ))}
    </select>
  );
}

function KaratSelect({ form, setForm }: { form: any; setForm: (v: any) => void }) {
  return (
    <select
      value={form.original_karat || '21'}
      onChange={(e) => setForm({ ...form, original_karat: e.target.value })}
      className="input-field"
    >
      <option value="21">عيار 21</option>
      <option value="18">عيار 18</option>
      <option value="24">عيار 24 (سبايك)</option>
    </select>
  );
}

function ModalButtons({
  submitting,
  onCancel,
  label,
}: {
  submitting: boolean;
  onCancel: () => void;
  label: string;
}) {
  return (
    <div className="flex gap-2 pt-2">
      <button
        type="submit"
        disabled={submitting}
        className="btn-primary flex-1 py-2.5 disabled:opacity-50"
      >
        {submitting ? 'جاري...' : label}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="btn-secondary flex-1 py-2.5"
      >
        إلغاء
      </button>
    </div>
  );
}

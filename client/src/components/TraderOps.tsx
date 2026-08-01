import { useState } from 'react';
import api from '../api';
import Modal from './ui/Modal';

export type OpKind = 'none' | 'deal' | 'payment' | 'transfer' | 'work' | 'give';
export type DealType = 'buy' | 'sell';
export type PaymentType = 'payment' | 'loan';
export type GiveType = 'give_scrap' | 'give_local_bar';

export const GIVE_LABELS: Record<GiveType, string> = {
  give_scrap: 'كسر',
  give_local_bar: 'سبيكة بلدي',
};

const TITLES: Record<string, string> = {
  deal: 'قطع',
  work: 'استلام شغل',
  give: 'إدي للتاجر',
  payment: 'عملية فلوس',
  transfer: 'تحويل دهب',
};

interface Props {
  kind: OpKind;
  initial?: any;
  traders: any[];
  dealType?: DealType;
  paymentType?: PaymentType;
  giveType?: GiveType;
  giveOptions?: GiveType[];
  onClose: () => void;
  onDone: () => void;
}

export default function TraderOps({
  kind, initial, traders, dealType: dt0, paymentType: pt0, giveType: gt0, giveOptions, onClose, onDone,
}: Props) {
  const [form, setForm] = useState<any>(initial || {});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dealType, setDealType] = useState<DealType>(dt0 || 'buy');
  const [paymentType, setPaymentType] = useState<PaymentType>(pt0 || 'payment');
  const [giveType, setGiveType] = useState<GiveType>(gt0 || 'give_scrap');

  if (kind === 'none') return null;

  const fmt = (n: number) => n?.toLocaleString('ar-EG') || '0';

  const traderById = (id: any) => traders.find((x) => String(x.id) === String(id));
  const baseKaratOf = (id: any) => (Number(traderById(id)?.base_karat) === 18 ? 18 : 21);

  const effectiveKarat = Number(form.original_karat || 21);
  const selectedBase = baseKaratOf(form.trader_id);

  // تحويل الوزن لعيار حساب التاجر
  const toBase = (w: number, karat: number, isFineness: boolean, base: number) => {
    if (isFineness) return (w * karat) / ((base * 1000) / 24); // سبيكة بلدي: 21→875, 18→750
    return karat !== base ? (w * karat) / base : w;
  };

  const dealTotal = () => {
    const w = Number(form.weight) || 0;
    const p = Number(form.price_per_gram) || 0;
    const wb = toBase(w, effectiveKarat, false, selectedBase);
    return { weightBase: wb, total: wb * p };
  };

  // ينشئ التاجر لو مكتوب اسم جديد
  const resolveTrader = async (idField: string, nameField: string) => {
    if (form[idField]) return form[idField];
    const name = form[nameField]?.trim();
    if (!name) return null;
    const exists = traders.find((t) => t.name === name);
    if (exists) return exists.id;
    const res = await api.post('/traders', { name, base_karat: 21 });
    return res.data.id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      if (kind === 'deal' || kind === 'work') {
        const origWeight = Number(form.weight);
        const base = baseKaratOf(form.trader_id);
        await api.post('/transactions/deal', {
          trader_id: form.trader_id,
          weight: toBase(origWeight, effectiveKarat, false, base),
          price_per_gram: kind === 'deal' ? Number(form.price_per_gram) : 0,
          total_amount: kind === 'work' ? Number(form.craftsmanship) || 0 : undefined,
          original_karat: effectiveKarat,
          original_weight: origWeight,
          deal_type: kind === 'deal' ? dealType : 'work',
          notes: form.notes || '',
        });
      } else if (kind === 'give') {
        const isLocalBar = giveType === 'give_local_bar';
        const karat = isLocalBar ? Number(form.fineness) : effectiveKarat;
        const origWeight = Number(form.weight);
        const base = baseKaratOf(form.trader_id);
        await api.post('/transactions/deal', {
          trader_id: form.trader_id,
          weight: toBase(origWeight, karat, isLocalBar, base),
          price_per_gram: 0,
          original_karat: karat,
          original_weight: origWeight,
          deal_type: giveType,
          notes: form.notes || '',
        });
      } else if (kind === 'payment') {
        await api.post('/transactions/payment', {
          trader_id: form.trader_id,
          amount: Number(form.amount),
          payment_type: paymentType,
          notes: form.notes || '',
        });
      } else if (kind === 'transfer') {
        const fromId = await resolveTrader('from_trader_id', 'from_trader_name');
        if (!fromId) { setFormError('اختار أو اكتب اسم التاجر'); setSubmitting(false); return; }

        // لو مختار تاجر مسجل ياخد الـ id، غير كده الاسم يتسجل من غير حساب
        const toName = (form.to_trader_name || '').trim();
        const existingTo = form.to_trader_id || traders.find((t) => t.name === toName)?.id;
        if (!existingTo && !toName) { setFormError('اكتب اسم اللي بتحوّل له'); setSubmitting(false); return; }
        if (existingTo && String(fromId) === String(existingTo)) {
          setFormError('مينفعش تحول لنفس التاجر'); setSubmitting(false); return;
        }

        const origWeight = Number(form.weight);
        // الوزن المكتوب بيبقى بعيار حساب التاجر اللي بنحوّل منه
        // والسيرفر بيحوّله لعيار حساب التاجر اللي بنحوّل له
        const fromBase = baseKaratOf(fromId);
        await api.post('/transactions/transfer', {
          from_trader_id: fromId,
          to_trader_id: existingTo || null,
          to_external_name: existingTo ? null : toName,
          weight: origWeight,
          original_karat: fromBase,
          original_weight: origWeight,
          notes: form.notes || '',
        });
      }
      onDone();
      onClose();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'حصل مشكلة');
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    kind === 'give' && form._fixedGive
      ? `إدي ${GIVE_LABELS[giveType]}`
      : kind === 'transfer' && form._lockedTo
      ? 'حوالة للحساب'
      : TITLES[kind] || '';

  const traderSelect = (field: string) => (
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

  const nameInput = (
    idField: string, nameField: string, placeholder: string, listId: string, excludeId?: any, external?: boolean
  ) => (
    <div>
      <input
        list={listId}
        placeholder={placeholder}
        value={form[nameField] || ''}
        onChange={(e) => {
          const name = e.target.value;
          const match = traders.find((t) => t.name === name);
          setForm({ ...form, [nameField]: name, [idField]: match?.id || 0 });
        }}
        className="input-field"
        required
      />
      <datalist id={listId}>
        {traders.filter((t) => String(t.id) !== String(excludeId)).map((t) => (
          <option key={t.id} value={t.name} />
        ))}
      </datalist>
      {!form[idField] && form[nameField]?.trim() && (
        <p className="mt-1.5 text-xs text-stone-500">
          {external ? 'اسم من غير حساب — هيتسجل في كشف الحساب بس' : 'تاجر جديد — هيتعمل حساب جديد باسمه'}
        </p>
      )}
    </div>
  );

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && <FormError msg={formError} />}

        {/* ── التاجر ── */}
        {kind !== 'transfer' &&
          (form._locked ? <LockedTrader trader={traderById(form.trader_id)} /> : traderSelect('trader_id'))}

        {kind === 'transfer' && (
          <div className="space-y-3">
            {form._lockedFrom
              ? <LockedTrader label="من" trader={traderById(form.from_trader_id)} />
              : nameInput('from_trader_id', 'from_trader_name', 'من تاجر... (اختار أو اكتب اسم جديد)', 'from-list', form.to_trader_id)}
            {form._lockedTo
              ? <LockedTrader label="لـ" trader={traderById(form.to_trader_id)} />
              : nameInput('to_trader_id', 'to_trader_name', 'لـ... (اختار تاجر أو اكتب أي اسم)', 'to-list', form.from_trader_id, true)}
          </div>
        )}

        {/* ── نوع القطع ── */}
        {kind === 'deal' && (
          <Segmented
            label="نوع القطع"
            value={dealType}
            onChange={(v) => setDealType(v as DealType)}
            options={[
              { value: 'buy', label: 'شراء (عليك)' },
              { value: 'sell', label: 'بيع (ليك)' },
            ]}
          />
        )}

        {/* ── نوع الإدي ── */}
        {kind === 'give' && !form._fixedGive && (
          <Segmented
            label="النوع"
            value={giveType}
            onChange={(v) => setGiveType(v as GiveType)}
            options={(giveOptions || (['give_scrap', 'give_local_bar'] as GiveType[])).map((v) => ({
              value: v, label: GIVE_LABELS[v],
            }))}
          />
        )}

        {/* ── نوع الفلوس ── */}
        {kind === 'payment' && (
          <Segmented
            label="نوع العملية"
            value={paymentType}
            onChange={(v) => setPaymentType(v as PaymentType)}
            options={[
              { value: 'payment', label: 'دفع فلوس' },
              { value: 'loan', label: 'استلام سلفة' },
            ]}
          />
        )}

        {/* ── الوزن + العيار ── */}
        {kind !== 'payment' && (
          kind === 'transfer' ? (
            <input
              type="number" step="any" min="0"
              placeholder="الوزن (جرام)"
              value={form.weight || ''}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
              className="input-field"
              required
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number" step="any" min="0"
                placeholder="الوزن (جرام)"
                value={form.weight || ''}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                className="input-field"
                required
              />
              {kind === 'give' && giveType === 'give_local_bar' ? (
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
          )
        )}

        {/* ── سعر الجرام ── */}
        {kind === 'deal' && (
          <input
            type="number" step="any" min="0"
            placeholder="سعر الجرام"
            value={form.price_per_gram || ''}
            onChange={(e) => setForm({ ...form, price_per_gram: e.target.value })}
            className="input-field"
            required
          />
        )}

        {/* ── المصنعية ── */}
        {kind === 'work' && (
          <input
            type="number" step="any" min="0"
            placeholder="المصنعية (جنيه)"
            value={form.craftsmanship || ''}
            onChange={(e) => setForm({ ...form, craftsmanship: e.target.value })}
            className="input-field"
          />
        )}

        {/* ── المبلغ ── */}
        {kind === 'payment' && (
          <input
            type="number" step="any" min="0"
            placeholder="المبلغ (جنيه)"
            value={form.amount || ''}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="input-field"
            required
          />
        )}

        {/* ── معاينة القطع ── */}
        {kind === 'deal' && form.weight && form.price_per_gram && (
          <div className="card p-3 text-sm space-y-1">
            {effectiveKarat !== selectedBase && (
              <div className="text-stone-600">
                الوزن بعيار {selectedBase}: <span className="font-bold text-amber-800">{dealTotal().weightBase.toFixed(3)} جم</span>
              </div>
            )}
            <div className="text-stone-600">
              الإجمالي: <span className="font-bold text-amber-700 text-base">{fmt(Math.round(dealTotal().total))} جنيه</span>
            </div>
            <div className={`font-medium ${dealType === 'buy' ? 'text-red-600' : 'text-emerald-600'}`}>
              {dealType === 'buy' ? '(عليك للتاجر)' : '(ليك من التاجر)'}
            </div>
          </div>
        )}

        {/* ── معاينة الشغل ── */}
        {kind === 'work' && form.weight && (
          <div className="card p-3 text-sm space-y-1">
            {effectiveKarat !== selectedBase && (
              <div className="text-stone-600">
                الوزن بعيار {selectedBase}: <span className="font-bold text-amber-800">{dealTotal().weightBase.toFixed(3)} جم</span>
              </div>
            )}
            <div className="text-red-600 font-medium">
              هيتحسب {dealTotal().weightBase.toFixed(3)} جم <span className="font-bold">عليك</span>
            </div>
            {form.craftsmanship && (
              <div className="text-red-600 font-medium">+ مصنعية عليك: {fmt(Number(form.craftsmanship))} جنيه</div>
            )}
          </div>
        )}

        {/* ── معاينة الإدي ── */}
        {kind === 'give' && form.weight && (() => {
          const isBar = giveType === 'give_local_bar';
          const k = isBar ? Number(form.fineness) : effectiveKarat;
          const wb = toBase(Number(form.weight) || 0, k, isBar, selectedBase);
          const changed = isBar ? !!form.fineness : k !== selectedBase;
          return (
            <div className="card p-3 text-sm space-y-1">
              {changed && (
                <div className="text-stone-600">
                  الوزن بعيار {selectedBase}: <span className="font-bold text-amber-800">{wb.toFixed(3)} جم</span>
                </div>
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

        {/* ── معاينة التحويل ── */}
        {kind === 'transfer' && form.weight && (() => {
          const w = Number(form.weight) || 0;
          const fBase = form.from_trader_id ? baseKaratOf(form.from_trader_id) : 21;
          if (!form.to_trader_id) return null;
          const tBase = baseKaratOf(form.to_trader_id);
          if (fBase === tBase) return null;
          return (
            <div className="card p-3 text-sm space-y-1">
              <div className="text-stone-600">
                يتخصم من التاجر الأول: <span className="font-bold text-red-600">{w.toFixed(3)} جم</span>
                <span className="text-xs text-stone-400"> (عيار {fBase})</span>
              </div>
              <div className="text-stone-600">
                يتضاف للتاجر التاني: <span className="font-bold text-emerald-700">{((w * fBase) / tBase).toFixed(3)} جم</span>
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

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={submitting} className="btn-primary flex-1 py-2.5 disabled:opacity-50">
            {submitting ? 'جاري...' : 'تسجيل'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ===================== Sub components ===================== */

function Segmented({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <p className="text-sm font-medium text-stone-600 mb-2">{label}</p>
      <div className="bg-stone-100 rounded-xl p-1 flex gap-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
              value === o.value ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FormError({ msg }: { msg: string }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">{msg}</div>
  );
}

function LockedTrader({ trader, label = 'التاجر' }: { trader: any; label?: string }) {
  const base = Number(trader?.base_karat) === 18 ? 18 : 21;
  return (
    <div className="flex items-center gap-3 rounded-xl bg-stone-50 border border-stone-200 px-3.5 py-2.5">
      <div className="w-8 h-8 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center font-extrabold text-sm shrink-0">
        {(trader?.name || '?').trim().charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-stone-400 leading-none mb-0.5">{label}</p>
        <p className="font-bold text-stone-800 text-sm truncate">{trader?.name || '—'}</p>
      </div>
      {base === 18 && (
        <span className="text-[10px] font-bold px-1.5 py-1 rounded shrink-0 bg-amber-100 text-amber-800">
          حساب ع18
        </span>
      )}
    </div>
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

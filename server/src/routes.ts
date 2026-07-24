import { Router, Request, Response, NextFunction } from 'express';
import db from './db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'gold-system-secret-2024';

// ==== Types ====
interface AuthRequest extends Request {
  user?: { id: number; username: string; role: string; full_name: string };
}

// ==== Middleware ====
function auth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) { res.status(401).json({ error: 'غير مصرح' }); return; }
  try {
    req.user = jwt.verify(token, JWT_SECRET) as any;
    next();
  } catch {
    res.status(401).json({ error: 'جلسة منتهية' });
  }
}

function adminOnly(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') { res.status(403).json({ error: 'غير مسموح' }); return; }
  next();
}

// ==== Audit Helper ====
function logAudit(userId: number, action: string, tableName: string, recordId: number, description: string, oldValues?: any, newValues?: any) {
  db.prepare(
    'INSERT INTO audit_log (user_id, action, table_name, record_id, description, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, action, tableName, recordId, description, oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null);
}

// ==================== AUTH ====================
router.post('/auth/login', (req: Request, res: Response): void => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username) as any;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'اسم المستخدم أو كلمة السر غلط' });
    return;
  }
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  res.json({ token, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } });
});

router.get('/auth/me', auth, (req: AuthRequest, res: Response): void => {
  res.json({ user: req.user });
});

// ==================== TRADERS ====================
router.get('/traders', auth, (_req: AuthRequest, res: Response): void => {
  const traders = db.prepare(`
    SELECT t.*,
      COALESCE((SELECT SUM(gd.total_amount) FROM gold_deals gd WHERE gd.trader_id = t.id), 0) as total_deals,
      COALESCE((SELECT SUM(cp.amount) FROM cash_payments cp WHERE cp.trader_id = t.id), 0) as total_payments,
      COALESCE((SELECT SUM(gd.weight) FROM gold_deals gd WHERE gd.trader_id = t.id), 0) as total_gold_bought,
      COALESCE((SELECT SUM(gt.weight) FROM gold_transfers gt WHERE gt.from_trader_id = t.id), 0) as gold_out,
      COALESCE((SELECT SUM(gt.weight) FROM gold_transfers gt WHERE gt.to_trader_id = t.id), 0) as gold_in
    FROM traders t WHERE t.is_active = 1 ORDER BY t.name
  `).all() as any[];

  const result = traders.map(t => ({
    ...t,
    money_balance: t.total_deals - t.total_payments,
    gold_balance: t.total_gold_bought - t.gold_out + t.gold_in,
  }));

  res.json(result);
});

router.get('/traders/:id', auth, (req: AuthRequest, res: Response): void => {
  const trader = db.prepare('SELECT * FROM traders WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!trader) { res.status(404).json({ error: 'التاجر مش موجود' }); return; }
  res.json(trader);
});

router.post('/traders', auth, (req: AuthRequest, res: Response): void => {
  const { name, phone, address, notes } = req.body;
  if (!name) { res.status(400).json({ error: 'اسم التاجر مطلوب' }); return; }
  const result = db.prepare(
    'INSERT INTO traders (name, phone, address, notes, created_by) VALUES (?, ?, ?, ?, ?)'
  ).run(name, phone || '', address || '', notes || '', req.user!.id);
  logAudit(req.user!.id, 'create', 'traders', result.lastInsertRowid as number, `إضافة تاجر: ${name}`);
  res.json({ id: result.lastInsertRowid, message: 'تم إضافة التاجر' });
});

router.put('/traders/:id', auth, (req: AuthRequest, res: Response): void => {
  const old = db.prepare('SELECT * FROM traders WHERE id = ?').get(req.params.id) as any;
  if (!old) { res.status(404).json({ error: 'التاجر مش موجود' }); return; }
  const { name, phone, address, notes } = req.body;
  db.prepare('UPDATE traders SET name=?, phone=?, address=?, notes=? WHERE id=?')
    .run(name || old.name, phone ?? old.phone, address ?? old.address, notes ?? old.notes, req.params.id);
  logAudit(req.user!.id, 'update', 'traders', +req.params.id, `تعديل تاجر: ${old.name}`, old, req.body);
  res.json({ message: 'تم التعديل' });
});

router.delete('/traders/:id', auth, adminOnly, (req: AuthRequest, res: Response): void => {
  const old = db.prepare('SELECT * FROM traders WHERE id = ?').get(req.params.id) as any;
  if (!old) { res.status(404).json({ error: 'التاجر مش موجود' }); return; }
  db.prepare('UPDATE traders SET is_active = 0 WHERE id = ?').run(req.params.id);
  logAudit(req.user!.id, 'delete', 'traders', +req.params.id, `حذف تاجر: ${old.name}`, old);
  res.json({ message: 'تم الحذف' });
});

// ==== Trader Account Statement (كشف حساب) ====
router.get('/traders/:id/statement', auth, (req: AuthRequest, res: Response): void => {
  const trader = db.prepare('SELECT * FROM traders WHERE id = ?').get(req.params.id) as any;
  if (!trader) { res.status(404).json({ error: 'التاجر مش موجود' }); return; }

  const deals = db.prepare(
    'SELECT gd.*, u.full_name as created_by_name FROM gold_deals gd LEFT JOIN users u ON gd.created_by=u.id WHERE gd.trader_id=? ORDER BY gd.created_at DESC'
  ).all(req.params.id) as any[];
  const payments = db.prepare(
    'SELECT cp.*, u.full_name as created_by_name FROM cash_payments cp LEFT JOIN users u ON cp.created_by=u.id WHERE cp.trader_id=? ORDER BY cp.created_at DESC'
  ).all(req.params.id) as any[];
  const transfersOut = db.prepare(
    'SELECT gt.*, t.name as to_trader_name, u.full_name as created_by_name FROM gold_transfers gt LEFT JOIN traders t ON gt.to_trader_id=t.id LEFT JOIN users u ON gt.created_by=u.id WHERE gt.from_trader_id=? ORDER BY gt.created_at DESC'
  ).all(req.params.id) as any[];
  const transfersIn = db.prepare(
    'SELECT gt.*, t.name as from_trader_name, u.full_name as created_by_name FROM gold_transfers gt LEFT JOIN traders t ON gt.from_trader_id=t.id LEFT JOIN users u ON gt.created_by=u.id WHERE gt.to_trader_id=? ORDER BY gt.created_at DESC'
  ).all(req.params.id) as any[];

  const totalDeals = deals.reduce((s, d) => s + d.total_amount, 0);
  const totalPayments = payments.reduce((s, p) => s + p.amount, 0);
  const totalGoldBought = deals.reduce((s, d) => s + d.weight, 0);
  const totalGoldOut = transfersOut.reduce((s, t) => s + t.weight, 0);
  const totalGoldIn = transfersIn.reduce((s, t) => s + t.weight, 0);

  res.json({
    trader,
    deals,
    payments,
    transfers_out: transfersOut,
    transfers_in: transfersIn,
    summary: {
      money_balance: totalDeals - totalPayments,
      gold_balance: totalGoldBought - totalGoldOut + totalGoldIn,
      total_deals: totalDeals,
      total_payments: totalPayments,
      total_gold_bought: totalGoldBought,
      total_gold_out: totalGoldOut,
      total_gold_in: totalGoldIn,
    },
  });
});

// ==================== TRANSACTIONS ====================

// قطع دهب
router.post('/transactions/deal', auth, (req: AuthRequest, res: Response): void => {
  const { trader_id, weight, price_per_gram, original_karat, original_weight, notes } = req.body;
  if (!trader_id || !weight || !price_per_gram) { res.status(400).json({ error: 'بيانات ناقصة' }); return; }

  const total_amount = weight * price_per_gram;
  const result = db.prepare(
    'INSERT INTO gold_deals (trader_id, weight, price_per_gram, total_amount, original_karat, original_weight, notes, created_by) VALUES (?,?,?,?,?,?,?,?)'
  ).run(trader_id, weight, price_per_gram, total_amount, original_karat || 21, original_weight || weight, notes || '', req.user!.id);

  const trader = db.prepare('SELECT name FROM traders WHERE id=?').get(trader_id) as any;
  logAudit(req.user!.id, 'create', 'gold_deals', result.lastInsertRowid as number,
    `قطع دهب مع ${trader?.name}: ${weight}جم × ${price_per_gram} = ${total_amount}`);

  res.json({ id: result.lastInsertRowid, total_amount, message: 'تم تسجيل القطع' });
});

// دفع فلوس
router.post('/transactions/payment', auth, (req: AuthRequest, res: Response): void => {
  const { trader_id, amount, notes } = req.body;
  if (!trader_id || !amount) { res.status(400).json({ error: 'بيانات ناقصة' }); return; }

  const result = db.prepare(
    'INSERT INTO cash_payments (trader_id, amount, notes, created_by) VALUES (?,?,?,?)'
  ).run(trader_id, amount, notes || '', req.user!.id);

  const trader = db.prepare('SELECT name FROM traders WHERE id=?').get(trader_id) as any;
  logAudit(req.user!.id, 'create', 'cash_payments', result.lastInsertRowid as number,
    `دفع فلوس لـ ${trader?.name}: ${amount} جنيه`);

  res.json({ id: result.lastInsertRowid, message: 'تم تسجيل الدفع' });
});

// تحويل دهب
router.post('/transactions/transfer', auth, (req: AuthRequest, res: Response): void => {
  const { from_trader_id, to_trader_id, weight, original_karat, original_weight, notes } = req.body;
  if (!from_trader_id || !to_trader_id || !weight) { res.status(400).json({ error: 'بيانات ناقصة' }); return; }
  if (from_trader_id === to_trader_id) { res.status(400).json({ error: 'مينفعش تحول من تاجر لنفسه' }); return; }

  const result = db.prepare(
    'INSERT INTO gold_transfers (from_trader_id, to_trader_id, weight, original_karat, original_weight, notes, created_by) VALUES (?,?,?,?,?,?,?)'
  ).run(from_trader_id, to_trader_id, weight, original_karat || 21, original_weight || weight, notes || '', req.user!.id);

  const from = db.prepare('SELECT name FROM traders WHERE id=?').get(from_trader_id) as any;
  const to = db.prepare('SELECT name FROM traders WHERE id=?').get(to_trader_id) as any;
  logAudit(req.user!.id, 'create', 'gold_transfers', result.lastInsertRowid as number,
    `تحويل ${weight}جم من ${from?.name} لـ ${to?.name}`);

  res.json({ id: result.lastInsertRowid, message: 'تم التحويل' });
});

// حذف عملية
router.delete('/transactions/:type/:id', auth, adminOnly, (req: AuthRequest, res: Response): void => {
  const { type, id } = req.params;
  const tableMap: Record<string, string> = { deal: 'gold_deals', payment: 'cash_payments', transfer: 'gold_transfers' };
  const table = tableMap[type];
  if (!table) { res.status(400).json({ error: 'نوع غلط' }); return; }

  const old = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  if (!old) { res.status(404).json({ error: 'العملية مش موجودة' }); return; }

  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  logAudit(req.user!.id, 'delete', table, +id, `حذف عملية من ${table}`, old);

  res.json({ message: 'تم الحذف' });
});

// ==================== USERS ====================
router.get('/users', auth, adminOnly, (_req: AuthRequest, res: Response): void => {
  const users = db.prepare('SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

router.post('/users', auth, adminOnly, (req: AuthRequest, res: Response): void => {
  const { username, password, full_name, role } = req.body;
  if (!username || !password || !full_name) { res.status(400).json({ error: 'بيانات ناقصة' }); return; }

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) { res.status(400).json({ error: 'اسم المستخدم موجود' }); return; }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, full_name, role) VALUES (?,?,?,?)'
  ).run(username, hash, full_name, role || 'user');
  logAudit(req.user!.id, 'create', 'users', result.lastInsertRowid as number, `إضافة مستخدم: ${username}`);

  res.json({ id: result.lastInsertRowid, message: 'تم إضافة المستخدم' });
});

router.put('/users/:id', auth, adminOnly, (req: AuthRequest, res: Response): void => {
  const old = db.prepare('SELECT id, username, full_name, role, is_active FROM users WHERE id=?').get(req.params.id) as any;
  if (!old) { res.status(404).json({ error: 'المستخدم مش موجود' }); return; }

  const { full_name, role, is_active, password } = req.body;

  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, req.params.id);
  }

  db.prepare('UPDATE users SET full_name=?, role=?, is_active=? WHERE id=?')
    .run(full_name ?? old.full_name, role ?? old.role, is_active ?? old.is_active, req.params.id);

  logAudit(req.user!.id, 'update', 'users', +req.params.id, `تعديل مستخدم: ${old.username}`, old, req.body);
  res.json({ message: 'تم التعديل' });
});

// ==================== AUDIT LOG ====================
router.get('/audit', auth, adminOnly, (_req: AuthRequest, res: Response): void => {
  const logs = db.prepare(
    'SELECT al.*, u.full_name as user_name FROM audit_log al LEFT JOIN users u ON al.user_id=u.id ORDER BY al.created_at DESC LIMIT 500'
  ).all();
  res.json(logs);
});

// ==================== DASHBOARD ====================
router.get('/dashboard', auth, (_req: AuthRequest, res: Response): void => {
  const totalTraders = (db.prepare('SELECT COUNT(*) as c FROM traders WHERE is_active=1').get() as any).c;
  const totalDeals = (db.prepare('SELECT COALESCE(SUM(total_amount),0) as t FROM gold_deals').get() as any).t;
  const totalPayments = (db.prepare('SELECT COALESCE(SUM(amount),0) as t FROM cash_payments').get() as any).t;
  const totalGold = (db.prepare('SELECT COALESCE(SUM(weight),0) as t FROM gold_deals').get() as any).t;
  const totalTransfers = (db.prepare('SELECT COALESCE(SUM(weight),0) as t FROM gold_transfers').get() as any).t;

  const recentDeals = db.prepare(
    'SELECT gd.*, t.name as trader_name, u.full_name as created_by_name FROM gold_deals gd LEFT JOIN traders t ON gd.trader_id=t.id LEFT JOIN users u ON gd.created_by=u.id ORDER BY gd.created_at DESC LIMIT 5'
  ).all();
  const recentPayments = db.prepare(
    'SELECT cp.*, t.name as trader_name, u.full_name as created_by_name FROM cash_payments cp LEFT JOIN traders t ON cp.trader_id=t.id LEFT JOIN users u ON cp.created_by=u.id ORDER BY cp.created_at DESC LIMIT 5'
  ).all();
  const recentTransfers = db.prepare(
    'SELECT gt.*, tf.name as from_name, tt.name as to_name, u.full_name as created_by_name FROM gold_transfers gt LEFT JOIN traders tf ON gt.from_trader_id=tf.id LEFT JOIN traders tt ON gt.to_trader_id=tt.id LEFT JOIN users u ON gt.created_by=u.id ORDER BY gt.created_at DESC LIMIT 5'
  ).all();

  res.json({
    stats: { total_traders: totalTraders, money_balance: totalDeals - totalPayments, total_gold: totalGold, total_transfers: totalTransfers },
    recent: { deals: recentDeals, payments: recentPayments, transfers: recentTransfers },
  });
});

export { router };

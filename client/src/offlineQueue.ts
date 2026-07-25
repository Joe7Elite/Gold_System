import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'gold-system-offline';
const STORE_NAME = 'pending-ops';

interface PendingOp {
  id?: number;
  method: string;
  url: string;
  data: any;
  createdAt: number;
}

let db: IDBPDatabase | null = null;

async function getDb() {
  if (!db) {
    db = await openDB(DB_NAME, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }
  return db;
}

export async function addToQueue(method: string, url: string, data: any): Promise<void> {
  const database = await getDb();
  await database.add(STORE_NAME, { method, url, data, createdAt: Date.now() } as PendingOp);
}

export async function getQueue(): Promise<PendingOp[]> {
  const database = await getDb();
  return database.getAll(STORE_NAME);
}

export async function removeFromQueue(id: number): Promise<void> {
  const database = await getDb();
  await database.delete(STORE_NAME, id);
}

export async function getQueueCount(): Promise<number> {
  const database = await getDb();
  return database.count(STORE_NAME);
}

export async function syncQueue(
  sendFn: (method: string, url: string, data: any) => Promise<boolean>,
  onProgress?: (synced: number, total: number) => void
): Promise<{ synced: number; failed: number }> {
  const ops = await getQueue();
  let synced = 0;
  let failed = 0;

  for (const op of ops) {
    try {
      const success = await sendFn(op.method, op.url, op.data);
      if (success && op.id) {
        await removeFromQueue(op.id);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
    onProgress?.(synced, ops.length);
  }

  return { synced, failed };
}

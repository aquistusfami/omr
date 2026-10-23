/**
 * IndexedDB storage. Sheets and thumbnails live in separate stores so that
 * listing/exporting 500 sheets never loads the images.
 */

export interface SheetRecord {
  id?: number;
  at: number;
  ok: boolean;
  reason?: string;
  studentId: string;
  examCode: string;
  p1: Record<string, string>;
  p2: Record<string, string>;
  flags: string[];
  anchors: { used: number; residual: number };
  duplicate?: boolean;
}

const DB_NAME = "omr";
const SHEETS = "sheets";
const THUMBS = "thumbs";

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SHEETS)) {
        db.createObjectStore(SHEETS, { keyPath: "id", autoIncrement: true }).createIndex(
          "studentId",
          "studentId",
        );
      }
      if (!db.objectStoreNames.contains(THUMBS)) db.createObjectStore(THUMBS, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function add(record: SheetRecord, thumb?: Blob | null): Promise<SheetRecord> {
  const db = await open();
  const tx = db.transaction([SHEETS, THUMBS], "readwrite");
  const sheets = tx.objectStore(SHEETS);
  let saved: SheetRecord = record;

  // write only lands when the transaction commits; "received" must mean stored
  const count = sheets.index("studentId").count(record.studentId);
  count.onsuccess = () => {
    saved = { ...record, duplicate: count.result > 0 };
    const req = sheets.add(saved);
    req.onsuccess = () => {
      saved = { ...saved, id: req.result as number };
      if (thumb) tx.objectStore(THUMBS).put({ id: saved.id, blob: thumb });
    };
  };

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(saved);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function all(): Promise<SheetRecord[]> {
  const db = await open();
  return done(db.transaction(SHEETS).objectStore(SHEETS).getAll());
}

/** Newest first, for the on-screen list. */
export async function recent(limit: number): Promise<SheetRecord[]> {
  const db = await open();
  const store = db.transaction(SHEETS).objectStore(SHEETS);
  return new Promise((resolve, reject) => {
    const out: SheetRecord[] = [];
    const req = store.openCursor(null, "prev");
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || out.length >= limit) return resolve(out);
      out.push(cursor.value as SheetRecord);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function thumb(id: number): Promise<Blob | null> {
  const db = await open();
  const row = await done<{ id: number; blob: Blob } | undefined>(
    db.transaction(THUMBS).objectStore(THUMBS).get(id),
  );
  return row?.blob ?? null;
}

export async function remove(id: number): Promise<void> {
  const db = await open();
  await commit(db.transaction([SHEETS, THUMBS], "readwrite"), (tx) => {
    tx.objectStore(SHEETS).delete(id);
    tx.objectStore(THUMBS).delete(id);
  });
}

export async function clear(): Promise<void> {
  const db = await open();
  await commit(db.transaction([SHEETS, THUMBS], "readwrite"), (tx) => {
    tx.objectStore(SHEETS).clear();
    tx.objectStore(THUMBS).clear();
  });
}

function commit(tx: IDBTransaction, work: (tx: IDBTransaction) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    work(tx);
  });
}

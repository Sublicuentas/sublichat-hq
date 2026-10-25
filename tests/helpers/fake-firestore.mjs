// Firestore simulado para pruebas: documentos, consultas simples y transacciones con
// concurrencia optimista (si otro commit cambió un documento leído, la transacción se reintenta).
export function fakeFirestore(seed = {}) {
  const data = new Map(); // "col/id" → { v, data }
  let auto = 0;
  for (const [col, docs] of Object.entries(seed)) for (const [id, d] of Object.entries(docs)) data.set(`${col}/${id}`, { v: 1, data: structuredClone(d) });
  const snap = (path, rec) => {
    const [col, id] = path.split('/');
    return { id, exists: !!rec, data: () => (rec ? structuredClone(rec.data) : undefined), ref: docRef(col, id), _v: rec ? rec.v : 0, _path: path };
  };
  const write = (path, val) => { const cur = data.get(path); data.set(path, { v: (cur ? cur.v : 0) + 1, data: structuredClone(val) }); };
  function docRef(col, id) {
    const path = `${col}/${id}`;
    return {
      id, path, _path: path,
      get: async () => snap(path, data.get(path)),
      set: async (v, o) => write(path, o && o.merge ? { ...(data.get(path)?.data || {}), ...v } : v),
      update: async (v) => { if (!data.get(path)) throw new Error('NOT_FOUND ' + path); write(path, { ...data.get(path).data, ...v }); },
      delete: async () => { data.delete(path); },
    };
  }
  function query(col, filters = []) {
    return {
      where: (f, op, v) => query(col, [...filters, [f, op, v]]),
      get: async () => {
        const docs = [...data.entries()].filter(([p]) => p.startsWith(col + '/') && p.split('/').length === 2)
          .filter(([, r]) => filters.every(([f, , v]) => r.data[f] === v)).map(([p, r]) => snap(p, r));
        return { docs, size: docs.length, empty: !docs.length, forEach: (fn) => docs.forEach(fn) };
      },
    };
  }
  const db = {
    _data: data,
    collection: (col) => ({ ...query(col), doc: (id) => docRef(col, id ?? `auto${++auto}`), add: async (v) => { const id = `auto${++auto}`; write(`${col}/${id}`, v); return docRef(col, id); } }),
    async runTransaction(fn) {
      for (let intento = 0; intento < 8; intento++) {
        const leidos = new Map(), escrituras = [];
        const tx = {
          get: async (ref) => { const rec = data.get(ref._path); leidos.set(ref._path, rec ? rec.v : 0); await new Promise((r) => setTimeout(r, 1)); return snap(ref._path, rec); },
          set: (ref, v, o) => escrituras.push(() => write(ref._path, o && o.merge ? { ...(data.get(ref._path)?.data || {}), ...v } : v)),
          update: (ref, v) => escrituras.push(() => { if (!data.get(ref._path)) throw new Error('NOT_FOUND ' + ref._path); write(ref._path, { ...data.get(ref._path).data, ...v }); }),
          delete: (ref) => escrituras.push(() => data.delete(ref._path)),
        };
        const r = await fn(tx);
        const conflicto = [...leidos].some(([p, v]) => (data.get(p)?.v || 0) !== v);
        if (conflicto) continue; // otro commit ganó: reintentar con datos frescos
        escrituras.forEach((w) => w());
        return r;
      }
      throw new Error('ABORTED: demasiados conflictos');
    },
  };
  return db;
}

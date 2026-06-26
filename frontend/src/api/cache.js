const store = new Map();
const TTL = 45_000; // 45 seconds

export function getCached(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function setCached(key, data) {
  store.set(key, { data, ts: Date.now() });
}

// Blow away all cached entries whose key contains the module prefix.
// e.g. invalidateModule('receivables') clears /receivables/summary, /receivables/invoices, etc.
export function invalidateModule(module) {
  for (const key of store.keys()) {
    if (key.startsWith(`/${module}`) || key.includes(`/${module}/`)) {
      store.delete(key);
    }
  }
}

// Forcibly clear the whole cache (used on logout / tenant switch)
export function clearCache() {
  store.clear();
}

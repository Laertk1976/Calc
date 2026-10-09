export const PRO_PRODUCT_ID = 'calc_pro_lifetime';

export function localDay(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function accessibleRecords(records, hasPro, today = localDay(new Date())) {
  return hasPro ? records : records.filter(row => !row.deletedAt && localDay(row.savedAt || row.createdAt) === today);
}

export function cachedProAccess(cache, uid, now = Date.now()) {
  // A short offline grace period; online snapshots always supersede this cache.
  return !!uid && cache?.uid === uid && cache.active === true
    && Number.isFinite(cache.checkedAt) && cache.checkedAt <= now
    && now - cache.checkedAt < 7 * 24 * 60 * 60 * 1000;
}

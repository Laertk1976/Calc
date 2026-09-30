const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const csvCell = value => {
  const text = String(value ?? '');
  const safe = /^[=+@\-\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export function buildListExport({ rows, amountField, title, summary, t, formatDate }) {
  const invoice = amountField === 'fact';
  const paidAt = invoice ? 'invoicePaidOffAt' : 'paidOffAt';
  const paidAmount = invoice ? 'invoicePaidOffAmount' : 'paidOffAmount';
  const headers = ['Name', 'Date', invoice ? 'Invoice' : 'Debt', 'Paid off amount', 'Paid off at', 'Comments'].map(key => t(key));
  const values = rows.map(row => [row.title || t('Untitled'), formatDate(row.savedAt || row.createdAt), row[amountField], row[paidAt] ? row[paidAmount] : '', row[paidAt] ? formatDate(row[paidAt]) : '', row.comment || '']);
  const total = rows.reduce((sum, row) => sum + (Number(String(row[amountField]).replace(/,/g, '')) || 0), 0);
  const totalText = String(Number(total.toPrecision(15)));
  const csv = [[title], [summary], headers, ...values, [t('TOTAL'), '', totalText]].map(row => row.map(csvCell).join(',')).join('\r\n');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;padding:24px;color:#111}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #ccc;padding:8px;text-align:left;overflow-wrap:anywhere;white-space:pre-wrap;font-size:12px}th{background:#eee}thead{display:table-header-group}tr{break-inside:avoid}
    </style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(summary)}</p><table><thead><tr>${headers.map(value => `<th>${escapeHtml(value)}</th>`).join('')}</tr></thead><tbody>${values.map(row => `<tr>${row.map(value => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('')}</tbody></table><h2>${escapeHtml(t('TOTAL'))}: ${escapeHtml(totalText)}</h2></body></html>`;
  return { csv, html };
}

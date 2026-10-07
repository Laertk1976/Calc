export function getPaidOffEntries(row) {
  return [
    { category: 'Debt', at: row.paidOffAt, amount: row.paidOffAmount },
    { category: 'Invoice', at: row.invoicePaidOffAt, amount: row.invoicePaidOffAmount },
  ].filter(entry => entry.at && entry.amount !== '' && entry.amount != null);
}

export function getPaidOffTotal(rows) {
  return rows.reduce((total, row) => total + getPaidOffEntries(row).reduce((sum, entry) => {
    const amount = Number(String(entry.amount).replace(/,/g, ''));
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0), 0);
}

// Payment entries are display-only: never move or duplicate the original amounts.
export function getTablePaymentRows(rows) {
  return rows.filter(row => !row.deletedAt).flatMap(row => {
    const original = { ...row, paidOffAt: '', paidOffAmount: '', invoicePaidOffAt: '', invoicePaidOffAmount: '' };
    const payments = getPaidOffEntries(row).map(entry => ({
      id: JSON.stringify([row.id, 'payment', entry.category, entry.at]),
      paymentOnly: true,
      title: row.title,
      createdAt: entry.at,
      savedAt: entry.at,
      info: '', expression: '', comment: '', cred: '', fact: '', fcash: '', value: '',
      ...(entry.category === 'Debt'
        ? { paidOffAt: entry.at, paidOffAmount: entry.amount }
        : { invoicePaidOffAt: entry.at, invoicePaidOffAmount: entry.amount }),
    }));
    return [original, ...payments];
  });
}

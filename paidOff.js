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

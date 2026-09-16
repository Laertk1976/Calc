function cleanName(value) {
  return String(value || '').normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '-')
    .replace(/\s+/g, ' ').trim().replace(/^[. ]+|[. ]+$/g, '') || 'Unnamed customer';
}

export function buildDriveExportFileName(calculations, format, exportedAt = new Date()) {
  if (!['pdf', 'csv'].includes(format)) throw new Error('Unsupported export format.');
  const names = [...new Set(calculations.filter((row) => !row.deletedAt).map((row) => cleanName(row.title)))].sort();
  const label = names.length ? names.slice(0, 3).map((name) => Array.from(name).slice(0, 36).join('')).join(' + ')
    + (names.length > 3 ? ` + ${names.length - 3} more` : '') : 'Calculator table';
  const pad = (value) => String(value).padStart(2, '0');
  const date = `${exportedAt.getFullYear()}-${pad(exportedAt.getMonth() + 1)}-${pad(exportedAt.getDate())}`;
  const time = `${pad(exportedAt.getHours())}-${pad(exportedAt.getMinutes())}-${pad(exportedAt.getSeconds())}`;
  return `${label}_${date}_${time}.${format}`;
}

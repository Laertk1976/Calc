export function buildDriveExportFileName(_calculations, format, exportedAt = new Date()) {
  if (!['pdf', 'csv'].includes(format)) throw new Error('Unsupported export format.');
  const pad = (value) => String(value).padStart(2, '0');
  const date = `${exportedAt.getFullYear()}-${pad(exportedAt.getMonth() + 1)}-${pad(exportedAt.getDate())}`;
  return `${date}.${format}`;
}

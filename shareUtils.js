import { Share } from 'react-native';
import { formatSavedDate } from './calculatorUtils';
import i18n from './i18n';
import { getPaidOffEntries } from './paidOff';

export async function shareRowSummary(row) {
  if (!row) return;
  const t = i18n.t.bind(i18n);

  const lines = [
    `${t('Name')}: ${row.title || t('Untitled')}`,
    row.savedAt || row.createdAt ? `${t('Date')}: ${formatSavedDate(row.savedAt || row.createdAt)}` : '',
    row.info || row.expression ? `${t('Info')}: ${row.info || row.expression}` : '',
    row.cred ? `${t('Cred')}: ${row.cred}` : '',
    row.fact ? `${t('Fact')}: ${row.fact}` : '',
    row.fcash ? `${t('Fcash')}: ${row.fcash}` : '',
    ...getPaidOffEntries(row).map(entry => `${t('Paid off')} (${t(entry.category)}): ${entry.amount}`),
  ].filter(Boolean);

  if (!lines.length) return;

  try {
    await Share.share({
      title: row.title || t('Calculation'),
      message: lines.join('\n'),
    });
  } catch (error) {
    console.log('Share row summary error:', error);
  }
}

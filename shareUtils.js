import { Share } from 'react-native';
import { formatSavedDate } from './calculatorUtils';

export async function shareRowSummary(row) {
  if (!row) return;

  const lines = [
    row.title ? `Name: ${row.title}` : 'Name: Untitled',
    row.savedAt || row.createdAt ? `Date: ${formatSavedDate(row.savedAt || row.createdAt)}` : '',
    row.info || row.expression ? `Info: ${row.info || row.expression}` : '',
    row.cred ? `Cred: ${row.cred}` : '',
    row.fact ? `Fact: ${row.fact}` : '',
    row.fcash ? `Fcash: ${row.fcash}` : '',
  ].filter(Boolean);

  if (!lines.length) return;

  try {
    await Share.share({
      title: row.title || 'Calculation',
      message: lines.join('\n'),
    });
  } catch (error) {
    console.log('Share row summary error:', error);
  }
}

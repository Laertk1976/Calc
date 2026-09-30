import { useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import TableActionsMenu from './TableActionsMenu';
import useDriveAuthorization from '../useDriveAuthorization';
import { uploadFileToGoogleDrive } from '../googleDrive';
import { buildListExport } from '../listExport';
import { formatSavedDate } from '../calculatorUtils';

export default function ListExportActions({ rows, amountField, summary }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const drive = useDriveAuthorization();
  const title = t(amountField === 'fact' ? 'Invoices' : 'Debts');
  const run = async (format, toDrive = false) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      if (toDrive && format === 'pdf' && Platform.OS === 'web') {
        Alert.alert(t('PDF upload unavailable'), t('Google Drive PDF upload requires an Android or iOS build. Use Save PDF on web.'));
        return;
      }
      const { csv, html } = buildListExport({ rows, amountField, title, summary, t, formatDate: value => value ? formatSavedDate(value) : '' });
      const fileName = `${amountField === 'fact' ? 'invoices' : 'debts'}-${new Date().toISOString().slice(0, 10)}.${format}`;
      if (toDrive) {
        if (!drive.configured) {
          Alert.alert(t('Google Drive setup required'), t('Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID before uploading to Google Drive.'));
          return;
        }
        if (!drive.ready) {
          Alert.alert(t('Google Drive is not ready'), t('Please wait a moment and try again. If this continues, restart the app after rebuilding it.'));
          return;
        }
        const accessToken = await drive.authorize();
        if (!accessToken) return;
        const content = format === 'csv' ? `\ufeff${csv}` : await (await fetch((await Print.printToFileAsync({ html })).uri)).blob();
        await uploadFileToGoogleDrive({ accessToken, fileName, mimeType: format === 'csv' ? 'text/csv' : 'application/pdf', content });
        Alert.alert('Google Drive', t('Saved to {{path}}', { path: `Calculator/${fileName}` }));
      } else if (Platform.OS === 'web') {
        if (format === 'pdf') {
          const page = window.open('', '_blank');
          if (!page) throw new Error('Allow browser pop-ups and try again.');
          page.document.write(html);
          page.document.close();
          page.focus();
          setTimeout(() => page.print(), 250);
        } else {
          const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      } else {
        let uri;
        if (format === 'pdf') {
          uri = (await Print.printToFileAsync({ html })).uri;
        } else {
          uri = `${FileSystem.cacheDirectory}${fileName}`;
          await FileSystem.writeAsStringAsync(uri, `\ufeff${csv}`);
        }
        await Sharing.shareAsync(uri, { mimeType: format === 'pdf' ? 'application/pdf' : 'text/csv', UTI: format === 'pdf' ? 'com.adobe.pdf' : 'public.comma-separated-values-text' });
      }
    } catch (error) {
      Alert.alert(t(toDrive ? 'Google Drive upload failed' : format === 'csv' ? 'CSV export failed' : 'Save failed'), error?.message || t('Please try again.'));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return <TableActionsMenu accessibilityLabel={title} open={open} onToggle={() => setOpen(value => !value)} onDismiss={() => setOpen(false)} actions={[
    { id: 'pdf', label: t('Save PDF'), onPress: () => run('pdf') },
    { id: 'csv', label: t('Save CSV'), onPress: () => run('csv') },
    { id: 'share', label: t('Share'), onPress: () => run('pdf') },
    { id: 'drivePdf', label: t('Drive PDF'), onPress: () => run('pdf', true) },
    { id: 'driveCsv', label: t('Drive CSV'), onPress: () => run('csv', true) },
  ].map(action => ({ ...action, disabled: busy || !rows.length }))} />;
}

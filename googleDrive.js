const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

export async function uploadFileToGoogleDrive({ accessToken, fileName, mimeType, content }) {
  const metadata = {
    name: fileName,
    mimeType,
  };
  const boundary = `calc_${Date.now()}`;
  const fileBlob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const body = new Blob([
    `--${boundary}\r\n`,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\n`,
    `Content-Type: ${mimeType}\r\n\r\n`,
    fileBlob,
    `\r\n--${boundary}--\r\n`,
  ], { type: `multipart/related; boundary=${boundary}` });

  const response = await fetch(DRIVE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Google Drive upload failed (${response.status})`);
  }

  return response.json();
}

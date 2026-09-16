const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const folderRequests = new Map();

async function readDriveResponse(response) {
  if (!response.ok) {
    const details = await response.json().catch(() => null);
    throw new Error(details?.error?.message || `Google Drive request failed (${response.status})`);
  }
  return response.json();
}

async function findOrCreateCalculatorFolder(accessToken) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const query = "name = 'Calculator' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and 'root' in parents";
  let pageToken;
  do {
    const params = new URLSearchParams({
      q: query, spaces: 'drive', pageSize: '100', orderBy: 'createdTime',
      fields: 'nextPageToken,files(id,capabilities(canAddChildren))',
      ...(pageToken ? { pageToken } : {}),
    });
    const result = await readDriveResponse(await fetch(`${DRIVE_FILES_URL}?${params}`, { headers }));
    const existing = result.files?.find((folder) => folder.capabilities?.canAddChildren);
    if (existing) return existing.id;
    pageToken = result.nextPageToken;
  } while (pageToken);

  const folder = await readDriveResponse(await fetch(`${DRIVE_FILES_URL}?fields=id`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Calculator', mimeType: 'application/vnd.google-apps.folder', parents: ['root'] }),
  }));
  if (!folder.id) throw new Error('Google Drive did not return the Calculator folder.');
  return folder.id;
}

function getCalculatorFolder(accessToken) {
  // Share concurrent lookups only for the same token. Recheck Drive on later
  // exports so account switches, deleted folders, and changed access are respected.
  if (!folderRequests.has(accessToken)) {
    folderRequests.set(accessToken, findOrCreateCalculatorFolder(accessToken).finally(() => folderRequests.delete(accessToken)));
  }
  return folderRequests.get(accessToken);
}

export async function uploadFileToGoogleDrive({ accessToken, fileName, mimeType, content }) {
  const folderId = await getCalculatorFolder(accessToken);
  const metadata = {
    name: fileName,
    mimeType,
    parents: [folderId],
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

  return readDriveResponse(response);
}

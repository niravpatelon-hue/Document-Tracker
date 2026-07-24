/**
 * Google Drive REST v3 client — the app's real database.
 *
 * Every file/folder this app creates is tagged with `appProperties.app =
 * 'document-tracker'`, so we only ever discover our own data, never stray
 * files the user happens to have lying around with a similar name.
 *
 * Personal data lives in `appDataFolder` — a hidden, per-user, per-app Drive
 * space Google guarantees no other account or app can read; that's the whole
 * enforcement mechanism for "personal expenses are private". Group data lives
 * in a regular folder shared (via Drive's own permissions) with that group's
 * members; Drive's sharing is the enforcement mechanism for "group expenses
 * are visible to common members only" — there is no custom access-control
 * code to get wrong.
 *
 * Pure functions over fetch + an access token — no auth-refresh logic here
 * (see drive/store.ts, which wraps every call with 401-triggered retry).
 */

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const JSON_MIME = 'application/json';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

export const APP_TAG = 'document-tracker';

export interface DriveFile {
  id: string;
  name: string;
  appProperties?: Record<string, string>;
}

export class DriveHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function req(accessToken: string, url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new DriveHttpError(res.status, `Drive API ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res;
}

/** Find a file by exact name in a given scope (a parent folder, or the hidden appDataFolder space). */
export async function findFileByName(
  accessToken: string,
  name: string,
  scope: { parentId: string } | { appData: true },
): Promise<DriveFile | null> {
  const nameEsc = name.replace(/'/g, "\\'");
  const parentClause = 'appData' in scope ? '' : ` and '${scope.parentId}' in parents`;
  const params = new URLSearchParams({
    q: `name = '${nameEsc}' and trashed = false${parentClause}`,
    fields: 'files(id,name,appProperties)',
    pageSize: '1',
  });
  if ('appData' in scope) params.set('spaces', 'appDataFolder');
  const res = await req(accessToken, `${API}/files?${params.toString()}`);
  const data = await res.json();
  return data.files?.[0] ?? null;
}

/** List every file directly inside a folder (not recursive). */
export async function listFolderChildren(accessToken: string, folderId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id,name,appProperties)',
      pageSize: '200',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await req(accessToken, `${API}/files?${params.toString()}`);
    const data = await res.json();
    files.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
}

/** Discover every app-tagged folder of a given kind the current account owns or has been shared. */
export async function findAppFolders(accessToken: string, kind: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `mimeType = '${FOLDER_MIME}' and trashed = false and appProperties has { key='app' and value='${APP_TAG}' } and appProperties has { key='kind' and value='${kind}' }`,
      fields: 'nextPageToken, files(id,name,appProperties)',
      pageSize: '200',
      includeItemsFromAllDrives: 'false',
      supportsAllDrives: 'false',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await req(accessToken, `${API}/files?${params.toString()}`);
    const data = await res.json();
    files.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
}

/** Read a file's raw text content. */
export async function readFileContent(accessToken: string, fileId: string): Promise<string> {
  const res = await req(accessToken, `${API}/files/${fileId}?alt=media`);
  return res.text();
}

function multipartBody(metadata: object, content: string, mimeType: string): { body: string; boundary: string } {
  const boundary = `docTracker-${Math.random().toString(36).slice(2)}`;
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n${content}\r\n` +
    `--${boundary}--`;
  return { body, boundary };
}

/** Create a new file with content in one call (multipart upload). */
export async function createFile(
  accessToken: string,
  opts: { name: string; content: string; mimeType?: string; parents?: string[]; appDataFolder?: boolean; appProperties?: Record<string, string> },
): Promise<DriveFile> {
  const metadata: Record<string, unknown> = { name: opts.name, appProperties: opts.appProperties };
  if (opts.appDataFolder) metadata.parents = ['appDataFolder'];
  else if (opts.parents) metadata.parents = opts.parents;
  const { body, boundary } = multipartBody(metadata, opts.content, opts.mimeType ?? JSON_MIME);
  const res = await req(accessToken, `${UPLOAD_API}/files?uploadType=multipart&fields=id,name,appProperties`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return res.json();
}

/** Overwrite an existing file's content. */
export async function updateFileContent(accessToken: string, fileId: string, content: string, mimeType = JSON_MIME): Promise<void> {
  await req(accessToken, `${UPLOAD_API}/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Content-Type': mimeType },
    body: content,
  });
}

/** Create a folder (optionally tagged + parented). */
export async function createFolder(
  accessToken: string,
  opts: { name: string; parents?: string[]; appProperties?: Record<string, string> },
): Promise<DriveFile> {
  const res = await req(accessToken, `${API}/files?fields=id,name,appProperties`, {
    method: 'POST',
    headers: { 'Content-Type': JSON_MIME },
    body: JSON.stringify({ name: opts.name, mimeType: FOLDER_MIME, parents: opts.parents, appProperties: opts.appProperties }),
  });
  return res.json();
}

/** Share a file/folder with someone by email — this IS the access-control mechanism for group visibility. */
export async function shareWithEmail(
  accessToken: string,
  fileId: string,
  email: string,
  role: 'writer' | 'reader' = 'writer',
): Promise<void> {
  await req(accessToken, `${API}/files/${fileId}/permissions?sendNotificationEmail=true`, {
    method: 'POST',
    headers: { 'Content-Type': JSON_MIME },
    body: JSON.stringify({ type: 'user', role, emailAddress: email }),
  });
}

export async function deleteFile(accessToken: string, fileId: string): Promise<void> {
  await req(accessToken, `${API}/files/${fileId}`, { method: 'DELETE' });
}

/** Rename/patch appProperties on an existing file (e.g. updating group meta). */
export async function patchFile(
  accessToken: string,
  fileId: string,
  patch: { name?: string; appProperties?: Record<string, string> },
): Promise<void> {
  await req(accessToken, `${API}/files/${fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': JSON_MIME },
    body: JSON.stringify(patch),
  });
}

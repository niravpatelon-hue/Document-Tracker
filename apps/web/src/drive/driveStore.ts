/**
 * Domain-level Drive persistence — maps the app's entities onto the file
 * layout described in driveClient.ts, and is the only place that layout is
 * known. App.tsx and the screens never call driveClient directly.
 *
 * Personal data (groupId === null): one JSON blob, `personal.json`, in the
 * signed-in user's hidden appDataFolder. Single writer (only this account
 * ever touches its own appDataFolder), so a whole-blob read-modify-write is
 * safe and simple.
 *
 * Group data: a regular folder per group (tagged + shared with members), one
 * small file per record (`expense-<id>.json`, `settlement-<id>.json`,
 * `recurring-<id>.json`) so concurrent writes from different members create
 * different files instead of clobbering a shared blob.
 */
import {
  APP_TAG,
  createFile,
  createFolder,
  findAppFolders,
  findFileByName,
  listFolderChildren,
  readFileContent,
  shareWithEmail,
  updateFileContent,
  deleteFile,
  patchFile,
  type DriveFile,
} from './driveClient';
import type { DriveSession } from './session';
import { materializeDueRecurring } from '../recurring';
import {
  newId,
  type Budget,
  type CardPayment,
  type CreditCard,
  type Expense,
  type Group,
  type GroupType,
  type MileageTrip,
  type Member,
  type RecurringExpense,
  type Settlement,
} from '../store';

const PERSONAL_FILE_NAME = 'personal.json';

export interface PersonalFile {
  expenses: Expense[];
  budgets: Budget[];
  cards: CreditCard[];
  cardPayments: CardPayment[];
  mileage: MileageTrip[];
  recurring: RecurringExpense[];
  rewardCoins: number;
}

export function emptyPersonalFile(): PersonalFile {
  return { expenses: [], budgets: [], cards: [], cardPayments: [], mileage: [], recurring: [], rewardCoins: 0 };
}

function normalizePersonalFile(raw: any): PersonalFile {
  return {
    expenses: Array.isArray(raw?.expenses) ? raw.expenses : [],
    budgets: Array.isArray(raw?.budgets) ? raw.budgets : [],
    cards: Array.isArray(raw?.cards) ? raw.cards : [],
    cardPayments: Array.isArray(raw?.cardPayments) ? raw.cardPayments : [],
    mileage: Array.isArray(raw?.mileage) ? raw.mileage : [],
    recurring: Array.isArray(raw?.recurring) ? raw.recurring : [],
    rewardCoins: Number(raw?.rewardCoins) || 0,
  };
}

export async function getOrCreatePersonalFileId(session: DriveSession): Promise<string> {
  const existing = await session.call((t) => findFileByName(t, PERSONAL_FILE_NAME, { appData: true }));
  if (existing) return existing.id;
  const created = await session.call((t) =>
    createFile(t, { name: PERSONAL_FILE_NAME, content: JSON.stringify(emptyPersonalFile()), appDataFolder: true }),
  );
  return created.id;
}

export async function loadPersonalFile(session: DriveSession, fileId: string): Promise<PersonalFile> {
  const text = await session.call((t) => readFileContent(t, fileId));
  try {
    return normalizePersonalFile(JSON.parse(text));
  } catch {
    return emptyPersonalFile();
  }
}

export async function savePersonalFile(session: DriveSession, fileId: string, data: PersonalFile): Promise<void> {
  await session.call((t) => updateFileContent(t, fileId, JSON.stringify(data)));
}

export interface GroupMeta {
  id: string;
  name: string;
  emoji?: string;
  type: GroupType;
  members: Member[];
  createdAt: number;
}

export interface GroupBundle {
  folderId: string;
  meta: GroupMeta;
  expenses: Expense[];
  settlements: Settlement[];
  recurring: RecurringExpense[];
}

const metaFileName = 'meta.json';
const expenseFileName = (id: string) => `expense-${id}.json`;
const settlementFileName = (id: string) => `settlement-${id}.json`;
const recurringFileName = (id: string) => `recurring-${id}.json`;
/** Deterministic per-occurrence name — lets two members' clients racing to catch up the same overdue bill de-duplicate instead of double-booking it. */
export const recurringOccurrenceId = (ruleId: string, dateISO: string) => `recur-${ruleId}-${dateISO}`;

async function readJson<T>(session: DriveSession, fileId: string): Promise<T | null> {
  try {
    const text = await session.call((t) => readFileContent(t, fileId));
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function loadGroupBundle(session: DriveSession, folder: DriveFile): Promise<GroupBundle | null> {
  const children = await session.call((t) => listFolderChildren(t, folder.id));
  const metaFile = children.find((c) => c.name === metaFileName);
  if (!metaFile) return null; // a folder without meta.json isn't one of ours in good standing — skip it

  const expenseFiles = children.filter((c) => c.name.startsWith('expense-'));
  const settlementFiles = children.filter((c) => c.name.startsWith('settlement-'));
  const recurringFiles = children.filter((c) => c.name.startsWith('recurring-'));

  const [meta, expenses, settlements, recurring] = await Promise.all([
    readJson<GroupMeta>(session, metaFile.id),
    Promise.all(expenseFiles.map((f) => readJson<Expense>(session, f.id))),
    Promise.all(settlementFiles.map((f) => readJson<Settlement>(session, f.id))),
    Promise.all(recurringFiles.map((f) => readJson<RecurringExpense>(session, f.id))),
  ]);
  if (!meta) return null;

  return {
    folderId: folder.id,
    meta,
    expenses: expenses.filter((e): e is Expense => e != null),
    settlements: settlements.filter((s): s is Settlement => s != null),
    recurring: recurring.filter((r): r is RecurringExpense => r != null),
  };
}

/** Discover every group folder shared with (or owned by) the signed-in account and load its contents. */
export async function discoverGroups(session: DriveSession): Promise<GroupBundle[]> {
  const folders = await session.call((t) => findAppFolders(t, 'group'));
  const bundles = await Promise.all(folders.map((f) => loadGroupBundle(session, f)));
  return bundles.filter((b): b is GroupBundle => b != null);
}

export async function createGroupFolder(
  session: DriveSession,
  input: { name: string; emoji?: string; type: GroupType; members: Member[] },
  ownerEmail: string,
): Promise<GroupBundle> {
  const id = newId();
  const folder = await session.call((t) =>
    createFolder(t, { name: `DocTracker – ${input.name}`, appProperties: { app: APP_TAG, kind: 'group', groupId: id } }),
  );
  const meta: GroupMeta = { id, name: input.name, emoji: input.emoji, type: input.type, members: input.members, createdAt: Date.now() };
  await session.call((t) => createFile(t, { name: metaFileName, content: JSON.stringify(meta), parents: [folder.id] }));

  const others = input.members.filter((m) => m.id.toLowerCase() !== ownerEmail.toLowerCase());
  await Promise.all(others.map((m) => session.call((t) => shareWithEmail(t, folder.id, m.id, 'writer'))));

  return { folderId: folder.id, meta, expenses: [], settlements: [], recurring: [] };
}

/** Invite a new member by email: shares the folder (Drive's own ACL is the enforcement) and records them in meta.json. */
export async function inviteMember(session: DriveSession, folderId: string, meta: GroupMeta, member: Member): Promise<GroupMeta> {
  await session.call((t) => shareWithEmail(t, folderId, member.id, 'writer'));
  const updated: GroupMeta = { ...meta, members: [...meta.members, member] };
  const metaFile = await session.call((t) => findFileByName(t, metaFileName, { parentId: folderId }));
  if (metaFile) await session.call((t) => updateFileContent(t, metaFile.id, JSON.stringify(updated)));
  return updated;
}

async function upsertGroupFile(session: DriveSession, folderId: string, name: string, content: unknown): Promise<void> {
  const existing = await session.call((t) => findFileByName(t, name, { parentId: folderId }));
  if (existing) {
    await session.call((t) => updateFileContent(t, existing.id, JSON.stringify(content)));
  } else {
    await session.call((t) => createFile(t, { name, content: JSON.stringify(content), parents: [folderId] }));
  }
}

async function removeGroupFile(session: DriveSession, folderId: string, name: string): Promise<void> {
  const existing = await session.call((t) => findFileByName(t, name, { parentId: folderId }));
  if (existing) await session.call((t) => deleteFile(t, existing.id));
}

export const writeGroupExpense = (session: DriveSession, folderId: string, expense: Expense) =>
  upsertGroupFile(session, folderId, expenseFileName(expense.id), expense);

export const deleteGroupExpense = (session: DriveSession, folderId: string, expenseId: string) =>
  removeGroupFile(session, folderId, expenseFileName(expenseId));

export const writeGroupSettlement = (session: DriveSession, folderId: string, settlement: Settlement) =>
  upsertGroupFile(session, folderId, settlementFileName(settlement.id), settlement);

export const writeGroupRecurring = (session: DriveSession, folderId: string, rule: RecurringExpense) =>
  upsertGroupFile(session, folderId, recurringFileName(rule.id), rule);

export const deleteGroupRecurring = (session: DriveSession, folderId: string, ruleId: string) =>
  removeGroupFile(session, folderId, recurringFileName(ruleId));

export async function renameGroupMeta(session: DriveSession, folderId: string, meta: GroupMeta): Promise<void> {
  await upsertGroupFile(session, folderId, metaFileName, meta);
}

/**
 * Catch up a group's recurring rules, writing only occurrences that don't
 * already exist in Drive — the guard against two members materializing the
 * same overdue bill twice.
 */
export async function materializeGroupRecurring(
  session: DriveSession,
  folderId: string,
  rules: RecurringExpense[],
  todayISO: string,
): Promise<{ newExpenses: Expense[]; updatedRules: RecurringExpense[] }> {
  const { newExpenses, updatedRules } = materializeDueRecurring(rules, todayISO, (rule, dateISO) => recurringOccurrenceId(rule.id, dateISO));

  const existingChildren = await session.call((t) => listFolderChildren(t, folderId));
  const existingNames = new Set(existingChildren.map((c) => c.name));

  const toWrite = newExpenses.filter((e) => !existingNames.has(expenseFileName(e.id)));
  await Promise.all(toWrite.map((e) => writeGroupExpense(session, folderId, e)));
  await Promise.all(updatedRules.filter((r) => r.groupId).map((r) => writeGroupRecurring(session, folderId, r)));

  return { newExpenses: toWrite, updatedRules };
}

export async function patchGroupFolderName(session: DriveSession, folderId: string, driveFolderName: string): Promise<void> {
  await session.call((t) => patchFile(t, folderId, { name: driveFolderName }));
}

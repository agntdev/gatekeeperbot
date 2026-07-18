// GroupGuard persistent storage — Map-based durable data store.
//
// Durable data (survives handler restarts within the same process) is stored in
// plain Maps. In production these would be backed by Redis; the test harness
// uses them as-is since each spec gets a fresh bot (and therefore fresh Maps).
//
// Index pattern: every collection has an explicit index key (e.g. a chat's
// memberIds[]) so we NEVER scan the keyspace — O(1) lookups only.

// ─── Data types ─────────────────────────────────────────────────────────────

export interface Member {
  userId: number;
  username?: string;
  joinedAt: number;
  verified: boolean;
  trusted: boolean;
}

export interface Infraction {
  id: string;
  chatId: number;
  actorId: number;
  targetId: number;
  action: "warn" | "mute" | "kick" | "ban" | "untrust";
  reason: string;
  timestamp: number;
  expiresAt?: number;
}

export interface AuditEntry {
  id: string;
  chatId: number;
  actorId: number;
  targetId?: number;
  action: string;
  reason: string;
  timestamp: number;
}

export interface AdminSettings {
  chatId: number;
  verificationTimeoutSec: number;
  spamThreshold: number;
  autoAction: "warn" | "mute" | "kick" | "ban";
  welcomeMessage: string;
  rulesText: string;
}

// ─── Storage singleton (per-process) ────────────────────────────────────────

const members = new Map<string, Member>();
const memberIndex = new Map<string, string[]>(); // chatId → userId[]
const infractions = new Map<string, Infraction>();
const infractionIndex = new Map<string, string[]>(); // chatId → infractionId[]
const auditLog = new Map<string, AuditEntry>();
const auditIndex = new Map<string, string[]>(); // chatId → entryId[]
const settings = new Map<string, AdminSettings>();
const pendingVerifications = new Map<string, { userId: number; chatId: number; expiresAt: number }>();
const spamTracker = new Map<string, { count: number; windowStart: number }>(); // userId:chatId → burst

let idCounter = 0;
function nextId(): string {
  return `${Date.now()}-${++idCounter}`;
}

// ─── Members ────────────────────────────────────────────────────────────────

function memberKey(chatId: number, userId: number): string {
  return `${chatId}:${userId}`;
}

export function getMember(chatId: number, userId: number): Member | undefined {
  return members.get(memberKey(chatId, userId));
}

export function upsertMember(chatId: number, userId: number, data: Partial<Member>): Member {
  const key = memberKey(chatId, userId);
  const existing = members.get(key);
  const merged: Member = {
    userId,
    joinedAt: Date.now(),
    verified: false,
    trusted: false,
    ...existing,
    ...data,
  };
  members.set(key, merged);
  if (!existing) {
    const idx = memberIndex.get(String(chatId)) ?? [];
    idx.push(String(userId));
    memberIndex.set(String(chatId), idx);
  }
  return merged;
}

export function getMemberIds(chatId: number): number[] {
  return (memberIndex.get(String(chatId)) ?? []).map(Number);
}

// ─── Pending verifications ──────────────────────────────────────────────────

export function addPendingVerification(chatId: number, userId: number, timeoutMs: number): void {
  pendingVerifications.set(`${chatId}:${userId}`, {
    userId,
    chatId,
    expiresAt: Date.now() + timeoutMs,
  });
}

export function removePendingVerification(chatId: number, userId: number): boolean {
  return pendingVerifications.delete(`${chatId}:${userId}`);
}

export function getPendingVerification(chatId: number, userId: number) {
  return pendingVerifications.get(`${chatId}:${userId}`);
}

export function isPendingVerification(chatId: number, userId: number): boolean {
  return pendingVerifications.has(`${chatId}:${userId}`);
}

// ─── Infractions ────────────────────────────────────────────────────────────

export function addInfraction(data: Omit<Infraction, "id">): Infraction {
  const id = nextId();
  const entry: Infraction = { id, ...data };
  infractions.set(id, entry);
  const idx = infractionIndex.get(String(data.chatId)) ?? [];
  idx.push(id);
  infractionIndex.set(String(data.chatId), idx);
  return entry;
}

export function getInfractions(chatId: number, limit = 20): Infraction[] {
  const ids = infractionIndex.get(String(chatId)) ?? [];
  return ids
    .slice(-limit)
    .map((id) => infractions.get(id))
    .filter((e): e is Infraction => e !== undefined)
    .reverse();
}

// ─── Audit log ──────────────────────────────────────────────────────────────

export function addAuditEntry(data: Omit<AuditEntry, "id">): AuditEntry {
  const id = nextId();
  const entry: AuditEntry = { id, ...data };
  auditLog.set(id, entry);
  const idx = auditIndex.get(String(data.chatId)) ?? [];
  idx.push(id);
  auditIndex.set(String(data.chatId), idx);
  return entry;
}

export function getAuditLog(chatId: number, limit = 10): AuditEntry[] {
  const ids = auditIndex.get(String(chatId)) ?? [];
  return ids
    .slice(-limit)
    .map((id) => auditLog.get(id))
    .filter((e): e is AuditEntry => e !== undefined)
    .reverse();
}

export function countByAction(chatId: number, sinceMs: number): Record<string, number> {
  const ids = auditIndex.get(String(chatId)) ?? [];
  const counts: Record<string, number> = {};
  for (const id of ids) {
    const entry = auditLog.get(id);
    if (entry && entry.timestamp >= sinceMs) {
      counts[entry.action] = (counts[entry.action] ?? 0) + 1;
    }
  }
  return counts;
}

export function countJoins(chatId: number, sinceMs: number): number {
  const ids = auditIndex.get(String(chatId)) ?? [];
  let count = 0;
  for (const id of ids) {
    const entry = auditLog.get(id);
    if (entry && entry.action === "join" && entry.timestamp >= sinceMs) count++;
  }
  return count;
}

// ─── Admin settings ─────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Omit<AdminSettings, "chatId"> = {
  verificationTimeoutSec: 300,
  spamThreshold: 5,
  autoAction: "warn",
  welcomeMessage:
    "Welcome to the group! Please verify you're human by tapping the button below.",
  rulesText: "Be respectful. No spam. Follow the group rules.",
};

export function getSettings(chatId: number): AdminSettings {
  return settings.get(String(chatId)) ?? { chatId, ...DEFAULT_SETTINGS };
}

export function updateSettings(chatId: number, data: Partial<AdminSettings>): AdminSettings {
  const current = getSettings(chatId);
  const updated = { ...current, ...data, chatId };
  settings.set(String(chatId), updated);
  return updated;
}

// ─── Spam tracking ──────────────────────────────────────────────────────────

const SPAM_WINDOW_MS = 10_000;

export function trackSpam(userId: number, chatId: number): number {
  const key = `${userId}:${chatId}`;
  const now = Date.now();
  const tracker = spamTracker.get(key);
  if (!tracker || now - tracker.windowStart > SPAM_WINDOW_MS) {
    spamTracker.set(key, { count: 1, windowStart: now });
    return 1;
  }
  tracker.count++;
  return tracker.count;
}

// ─── Reset (test-only) ─────────────────────────────────────────────────────

export function _resetStorage(): void {
  members.clear();
  memberIndex.clear();
  infractions.clear();
  infractionIndex.clear();
  auditLog.clear();
  auditIndex.clear();
  settings.clear();
  pendingVerifications.clear();
  spamTracker.clear();
  idCounter = 0;
}

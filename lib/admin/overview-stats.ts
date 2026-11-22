import { createServiceClient } from "@/lib/supabase/service";
import { ADMIN_ROUTES, TABLES } from "./overview-config";

type Row = Record<string, unknown>;
type Res = {
  data: Row[] | null;
  count: number | null;
  error: { message: string } | null;
};

export type Stat<T> = { ok: true; value: T } | { ok: false; error: string };
export type Queue = { count: number; oldest: string | null };
export type Item = {
  kind: "profile" | "photo" | "bio" | "report";
  title: string;
  createdAt: string;
  href: string;
};
export type Conv = { signups: number; paid: number };
export type DayBar = { label: string; total: number; approved: number };

type QueueResult = { queue: Queue; items: Item[] };

export function serviceClient() {
  return createServiceClient();
}
type Db = ReturnType<typeof serviceClient>;

const DAY = 86_400_000;
const KAMPALA_OFFSET = 3 * 3_600_000; // UTC+3, no daylight saving

const iso = (ms: number) => new Date(ms).toISOString();
const dayStart = (ms: number) =>
  Math.floor((ms + KAMPALA_OFFSET) / DAY) * DAY - KAMPALA_OFFSET;
const dayLabel = (ms: number) =>
  new Date(ms + KAMPALA_OFFSET).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  });

function check(res: unknown): Res {
  const r = res as Res;
  if (r.error) throw new Error(r.error.message);
  return r;
}

async function safe<T>(fn: () => Promise<T>): Promise<Stat<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/* ---------- queues ---------- */

async function profilesQueue(db: Db): Promise<QueueResult> {
  const t = TABLES.profiles;
  const res = check(
    await db
      .from("profiles")
      .select("id, display_name, campus, created_at", { count: "exact" })
      .eq("status", t.waitingStatus)
      .order("created_at", { ascending: true })
      .limit(5),
  );
  const rows = res.data ?? [];
  return {
    queue: {
      count: res.count ?? rows.length,
      oldest: rows.length ? String(rows[0].created_at) : null,
    },
    items: rows.map((r) => ({
      kind: "profile" as const,
      title:
        [r.display_name, r.campus].filter(Boolean).join(", ") || "New signup",
      createdAt: String(r.created_at),
      href: ADMIN_ROUTES.profiles,
    })),
  };
}

async function photosQueue(db: Db): Promise<QueueResult> {
  const t = TABLES.photos;
  const res = check(
    await db
      .from(t.table)
      .select("id, created_at", { count: "exact" })
      .not("status", "in", `(${t.doneStatuses.join(",")})`)
      .order("created_at", { ascending: true })
      .limit(5),
  );
  const rows = res.data ?? [];
  return {
    queue: {
      count: res.count ?? rows.length,
      oldest: rows.length ? String(rows[0].created_at) : null,
    },
    items: rows.map((r) => ({
      kind: "photo" as const,
      title: "Photo awaiting review",
      createdAt: String(r.created_at),
      href: ADMIN_ROUTES.photos,
    })),
  };
}

async function genericQueue(
  db: Db,
  cfg: {
    table: string;
    statusColumn: string;
    waitingStatus: string;
    createdColumn: string;
  },
  kind: "bio" | "report",
  title: string,
  href: string,
): Promise<QueueResult> {
  const res = check(
    await db
      .from(cfg.table)
      .select("*", { count: "exact" })
      .eq(cfg.statusColumn, cfg.waitingStatus)
      .order(cfg.createdColumn, { ascending: true })
      .limit(5),
  );
  const rows = res.data ?? [];
  return {
    queue: {
      count: res.count ?? rows.length,
      oldest: rows.length ? String(rows[0][cfg.createdColumn]) : null,
    },
    items: rows.map((r) => ({
      kind,
      title,
      createdAt: String(r[cfg.createdColumn]),
      href,
    })),
  };
}

async function paidAwaitingQueue(db: Db, now: number): Promise<Queue> {
  const [{ data: pendingProfiles, error: profErr }, { data: activeSubs, error: subErr }] = await Promise.all([
    db
      .from("profiles")
      .select("user_id, created_at")
      .eq("status", TABLES.profiles.waitingStatus)
      .order("created_at", { ascending: true })
      .limit(500),
    db
      .from(TABLES.subscriptions.table)
      .select("user_id")
      .eq(TABLES.subscriptions.statusColumn, TABLES.subscriptions.activeStatus)
      .gt(TABLES.subscriptions.expiresColumn ?? "end_date", iso(now))
      .limit(2000),
  ]);
  if (profErr) throw new Error(profErr.message);
  if (subErr) throw new Error(subErr.message);

  const activeUsers = new Set((activeSubs ?? []).map((s) => String(s.user_id)));
  const matched = (pendingProfiles ?? []).filter((p) => activeUsers.has(String(p.user_id)));
  return {
    count: matched.length,
    oldest: matched.length ? String(matched[0].created_at) : null,
  };
}

/* ---------- growth ---------- */

async function signupStats(db: Db, days: number, start: number, prev: number) {
  const cur = check(
    await db
      .from("profiles")
      .select("user_id, created_at, status")
      .gte("created_at", iso(start))
      .limit(5000),
  );
  const before = check(
    await db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", iso(prev))
      .lt("created_at", iso(start)),
  );

  const rows = cur.data ?? [];
  const perDay: DayBar[] = Array.from({ length: days }, (_, i) => ({
    label: dayLabel(start + i * DAY),
    total: 0,
    approved: 0,
  }));
  let draft = 0;
  let submitted = 0;
  let approved = 0;
  let rejected = 0;
  let pendingReview = 0;

  for (const r of rows) {
    const st = String(r.status ?? "draft");
    if (st === "draft") {
      draft += 1;
    } else {
      submitted += 1;
      if (st === TABLES.profiles.approvedStatus) approved += 1;
      else if (st === "rejected") rejected += 1;
      else pendingReview += 1;
    }

    const i = Math.floor((new Date(String(r.created_at)).getTime() - start) / DAY);
    if (i >= 0 && i < days) {
      perDay[i].total += 1;
      if (r.status === TABLES.profiles.approvedStatus) perDay[i].approved += 1;
    }
  }

  return {
    current: rows.length,
    previous: before.count ?? 0,
    perDay,
    funnel: {
      signedUp: rows.length,
      draft,
      submitted,
      pendingReview,
      approved,
      rejected,
    },
  };
}

async function subscriberStats(db: Db, now: number) {
  const t = TABLES.subscriptions;

  let countQ = db
    .from(t.table)
    .select("*", { count: "exact", head: true })
    .eq(t.statusColumn, t.activeStatus);
  if (t.expiresColumn) countQ = countQ.gt(t.expiresColumn, iso(now));
  const total = check(await countQ);

  let byPlan: Record<string, number> | null = null;
  try {
    let planQ = db
      .from(t.table)
      .select(t.planColumn)
      .eq(t.statusColumn, t.activeStatus);
    if (t.expiresColumn) planQ = planQ.gt(t.expiresColumn, iso(now));
    const rows = check(await planQ.limit(5000)).data ?? [];
    byPlan = {};
    for (const r of rows) {
      const k = String(r[t.planColumn] ?? "other");
      byPlan[k] = (byPlan[k] ?? 0) + 1;
    }
  } catch {
    byPlan = null;
  }
  return { active: total.count ?? 0, byPlan };
}

async function revenueStats(db: Db, start: number, prev: number) {
  const t = TABLES.payments;
  const res = check(
    await db
      .from(t.table)
      .select(`${t.amountColumn}, ${t.dateColumn}`)
      .in(t.statusColumn, t.paidStatuses)
      .gte(t.dateColumn, iso(prev))
      .limit(5000),
  );
  let current = 0;
  let previous = 0;
  let payments = 0;
  for (const r of res.data ?? []) {
    const amount = Number(r[t.amountColumn]) || 0;
    const when = new Date(String(r[t.dateColumn])).getTime();
    if (when >= start) {
      current += amount;
      payments += 1;
    } else {
      previous += amount;
    }
  }
  return { current, previous, payments };
}

async function conversionFor(db: Db, from: number, to: number): Promise<Conv> {
  const t = TABLES.payments;
  const res = check(
    await db
      .from("profiles")
      .select("user_id")
      .gte("created_at", iso(from))
      .lt("created_at", iso(to))
      .limit(5000),
  );
  const ids = (res.data ?? []).map((r) => String(r.user_id)).filter(Boolean);

  const paid = new Set<string>();
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    const p = check(
      await db
        .from(t.table)
        .select(t.userColumn)
        .in(t.userColumn, chunk)
        .in(t.statusColumn, t.paidStatuses)
        .limit(5000),
    );
    for (const r of p.data ?? []) paid.add(String(r[t.userColumn]));
  }
  return { signups: ids.length, paid: paid.size };
}

/* ---------- everything the page needs ---------- */

export async function getOverview(days: number) {
  const db = serviceClient();
  const now = Date.now();
  const start = dayStart(now) - (days - 1) * DAY;
  const prev = start - days * DAY;

  const [p, paidAwaiting, ph, bio, rep, sg, subs, rev, conv] = await Promise.all([
    safe(() => profilesQueue(db)),
    safe(() => paidAwaitingQueue(db, now)),
    safe(() => photosQueue(db)),
    safe(() =>
      genericQueue(db, TABLES.bioEdits, "bio", "Bio change", ADMIN_ROUTES.bioEdits),
    ),
    safe(() =>
      genericQueue(db, TABLES.reports, "report", "Report", ADMIN_ROUTES.reports),
    ),
    safe(() => signupStats(db, days, start, prev)),
    safe(() => subscriberStats(db, now)),
    safe(() => revenueStats(db, start, prev)),
    safe(async () => ({
      current: await conversionFor(db, start, now + 1),
      previous: await conversionFor(db, prev, start),
    })),
  ]);

  const q = (s: Stat<QueueResult>): Stat<Queue> =>
    s.ok ? { ok: true, value: s.value.queue } : s;

  const next: Item[] = [p, ph, bio, rep]
    .flatMap((s) => (s.ok ? s.value.items : []))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, 6);

  return {
    now,
    days,
    queues: {
      paidAwaiting,
      profiles: q(p),
      photos: q(ph),
      bioEdits: q(bio),
      reports: q(rep),
    },
    signups: sg,
    subscribers: subs,
    revenue: rev,
    conversion: conv,
    next,
  };
}

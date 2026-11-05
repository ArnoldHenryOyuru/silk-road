import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import {
  getOverview,
  serviceClient,
  type DayBar,
  type Queue,
  type Stat,
} from "@/lib/admin/overview-stats";
import { ADMIN_ROUTES } from "@/lib/admin/overview-config";
import s from "./overview.module.css";

async function requireAdmin() {
  const store = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll() {},
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/sign-in");

  const { data } = await serviceClient()
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!data?.is_admin) redirect("/admin/sign-in");
}

function ago(iso: string | null, now: number) {
  if (!iso) return "—";
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

function ugx(n: number) {
  return n >= 1_000_000
    ? `UGX ${(n / 1_000_000).toFixed(1)}M`
    : `UGX ${Math.round(n).toLocaleString("en-US")}`;
}

function delta(cur: number, prev: number, days: number) {
  if (prev === 0) {
    return cur === 0
      ? { note: `same as previous ${days} days`, up: undefined }
      : { note: `new vs previous ${days} days`, up: true as boolean | undefined };
  }
  const pct = Math.round(((cur - prev) / prev) * 100);
  return {
    note: `${pct >= 0 ? "+" : ""}${pct}% vs previous ${days} days`,
    up: (pct >= 0) as boolean | undefined,
  };
}

function Card(props: {
  label: string;
  value?: string;
  note?: string;
  up?: boolean;
  error?: string;
}) {
  const tone = props.up === true ? s.up : props.up === false ? s.down : "";
  return (
    <div className={s.card}>
      <p className={s.label}>{props.label}</p>
      <p className={s.value}>{props.error ? "—" : props.value}</p>
      {props.error ? (
        <p className={s.err}>Couldn&apos;t load: {props.error}</p>
      ) : props.note ? (
        <p className={`${s.note} ${tone}`}>{props.note}</p>
      ) : null}
    </div>
  );
}

function QueueCard(props: {
  label: string;
  stat: Stat<Queue>;
  href: string;
  now: number;
}) {
  const { label, stat, href, now } = props;
  if (!stat.ok) return <Card label={label} error={stat.error} />;
  const { count, oldest } = stat.value;
  const late = oldest ? now - new Date(oldest).getTime() > 24 * 3_600_000 : false;
  return (
    <Link href={href} className={`${s.card} ${s.cardLink}`}>
      <p className={s.label}>{label}</p>
      <p className={s.value}>{count}</p>
      <p className={`${s.note} ${late ? s.late : ""}`}>
        {count === 0 ? "All clear" : `oldest waiting ${ago(oldest, now)}`}
      </p>
    </Link>
  );
}

function Chart({ bars, days }: { bars: DayBar[]; days: number }) {
  const max = Math.max(1, ...bars.map((b) => b.total));
  return (
    <div>
      <div className={s.bars}>
        {bars.map((b, i) => (
          <div
            key={i}
            className={s.barCol}
            title={`${b.label}: ${b.total} signups, ${b.approved} approved`}
          >
            <div
              className={s.barStack}
              style={{ height: `${(b.total / max) * 100}%` }}
            >
              <div className={s.barRest} style={{ flex: b.total - b.approved }} />
              <div className={s.barOk} style={{ flex: b.approved }} />
            </div>
          </div>
        ))}
      </div>
      <div className={s.barLabels}>
        {bars.map((b, i) => (
          <span key={i}>{days === 7 || i % 5 === 0 ? b.label : ""}</span>
        ))}
      </div>
      <div className={s.legend}>
        <span>
          <i className={s.dot} style={{ background: "#6C4FF6" }} />
          Approved
        </span>
        <span>
          <i className={s.dot} style={{ background: "#D9D9E3" }} />
          Waiting or rejected
        </span>
      </div>
    </div>
  );
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ days?: string }>;
}) {
  await requireAdmin();

  const params = (await searchParams) ?? {};
  const days = params.days === "30" ? 30 : 7;
  const o = await getOverview(days);
  const { signups, subscribers, revenue, conversion } = o;

  const pct = (c: { signups: number; paid: number }) =>
    c.signups === 0 ? 0 : Math.round((c.paid / c.signups) * 100);

  return (
    <main className={s.wrap}>
      <div className={s.head}>
        <h1 className={s.title}>Overview</h1>
        <div className={s.range}>
          <Link
            href="/admin/overview?days=7"
            className={`${s.rangeLink} ${days === 7 ? s.on : ""}`}
          >
            Last 7 days
          </Link>
          <Link
            href="/admin/overview?days=30"
            className={`${s.rangeLink} ${days === 30 ? s.on : ""}`}
          >
            Last 30 days
          </Link>
        </div>
      </div>

      <p className={s.sectionLabel}>Needs your attention</p>
      <div className={s.grid}>
        <QueueCard label="Pending profiles" stat={o.queues.profiles} href={ADMIN_ROUTES.profiles} now={o.now} />
        <QueueCard label="Pending photos" stat={o.queues.photos} href={ADMIN_ROUTES.photos} now={o.now} />
        <QueueCard label="Bio edits" stat={o.queues.bioEdits} href={ADMIN_ROUTES.bioEdits} now={o.now} />
        <QueueCard label="Open reports" stat={o.queues.reports} href={ADMIN_ROUTES.reports} now={o.now} />
      </div>

      <p className={s.sectionLabel}>Growth and revenue</p>
      <div className={s.grid}>
        {signups.ok ? (
          <Card
            label="New signups"
            value={String(signups.value.current)}
            {...delta(signups.value.current, signups.value.previous, days)}
          />
        ) : (
          <Card label="New signups" error={signups.error} />
        )}

        {subscribers.ok ? (
          <Card
            label="Active subscribers"
            value={String(subscribers.value.active)}
            note={
              subscribers.value.byPlan
                ? Object.entries(subscribers.value.byPlan)
                    .map(([plan, n]) => `${n} ${plan}`)
                    .join(", ")
                : undefined
            }
          />
        ) : (
          <Card label="Active subscribers" error={subscribers.error} />
        )}

        {revenue.ok ? (
          <Card
            label="Revenue"
            value={ugx(revenue.value.current)}
            {...delta(revenue.value.current, revenue.value.previous, days)}
          />
        ) : (
          <Card label="Revenue" error={revenue.error} />
        )}

        {conversion.ok ? (
          <Card
            label="Signup to paid"
            value={`${pct(conversion.value.current)}%`}
            note={`${conversion.value.current.paid} of ${conversion.value.current.signups} new signups have paid`}
          />
        ) : (
          <Card label="Signup to paid" error={conversion.error} />
        )}
      </div>

      <div className={s.two}>
        <section className={s.panel}>
          <p className={s.panelTitle}>Signups per day</p>
          <p className={s.panelSub}>Kampala time</p>
          {signups.ok ? (
            <Chart bars={signups.value.perDay} days={days} />
          ) : (
            <p className={s.err}>Couldn&apos;t load: {signups.error}</p>
          )}
        </section>

        <section className={s.panel}>
          <p className={s.panelTitle}>Review next</p>
          <p className={s.panelSub}>Oldest items across all queues</p>
          {o.next.length === 0 ? (
            <p className={s.empty}>Nothing is waiting for review.</p>
          ) : (
            o.next.map((item, i) => (
              <Link key={i} href={item.href} className={s.row}>
                <span className={`${s.pill} ${item.kind === "report" ? s.pillReport : ""}`}>
                  {item.kind === "profile" ? "Profile" : item.kind === "photo" ? "Photo" : item.kind === "bio" ? "Bio" : "Report"}
                </span>
                <span className={s.rowTitle}>{item.title}</span>
                <span className={s.age}>{ago(item.createdAt, o.now)}</span>
              </Link>
            ))
          )}
        </section>
      </div>
    </main>
  );
}

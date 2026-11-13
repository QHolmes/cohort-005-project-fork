// PROTOTYPE — throwaway. Lives on branch `prototype/inbox` only.
// Question (wayfinder ticket "What does the Inbox look like?"): where the
// Inbox lives, what a Notification looks like in it, unread state, marking
// read, linking through, and the empty state.
//
// Variants, switchable via `?variant=` and the floating bar:
//   A  — Bell in the sidebar header, popover list (2-line preview, click = open)
//   A2 — A, plus expand-in-place to read the full text without leaving
//        (chevron only when the preview is truncated), a mark-read icon
//        button (MailOpen, fixed slot) that doesn't navigate, and text search. CHOSEN.
//   A3 — A, plus "View all" footer → full history page with search
//   B — "Inbox" sidebar nav item opening a right-hand slide-over drawer
//   C — A full Inbox page (/inbox-prototype), grouped by day, filter by
//       Notification Category, bulk actions
// State is in memory only (resets on reload). Links go to real routes.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, NavLink, useNavigate, useSearchParams } from "react-router";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  GraduationCap,
  Inbox as InboxIcon,
  MailOpen,
  MessageSquare,
  UsersRound,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";

// ─── Fake data + in-memory store ─────────────────────────────────────────

type Category = "Payments" | "Courses" | "Questions" | "Team";

type FakeNotification = {
  id: number;
  category: Category;
  title: string;
  body: string;
  href: string;
  minutesAgo: number;
  read: boolean;
};

const SEED: FakeNotification[] = [
  { id: 1, category: "Questions", title: "Sarah Chen answered your question", body: "“Use a loader instead of useEffect here — it runs on the server before render, so the data is there on first paint and you avoid the waterfall. You can also return a promise and stream it with <Await> if the query is slow, which keeps the rest of the lesson page interactive while it loads.”", href: "/courses", minutesAgo: 4, read: false },
  { id: 2, category: "Payments", title: "Refund Request approved", body: "Your refund of $49.00 for Advanced TypeScript is on its way.", href: "/dashboard", minutesAgo: 52, read: false },
  { id: 3, category: "Courses", title: "New lesson in React Router Deep Dive", body: "“Nested layouts and outlets” was just published.", href: "/courses", minutesAgo: 180, read: false },
  { id: 4, category: "Team", title: "Marcus joined your team", body: "Marcus Lee redeemed a seat on Acme Corp.", href: "/team", minutesAgo: 60 * 26, read: true },
  { id: 5, category: "Payments", title: "Purchase confirmed", body: "You bought Advanced TypeScript for $49.00. Receipt sent to your email.", href: "/dashboard", minutesAgo: 60 * 30, read: true },
  { id: 6, category: "Questions", title: "New question on “Generics 101”", body: "Priya asked: “Why does T extend unknown here?”", href: "/instructor/questions", minutesAgo: 60 * 24 * 4, read: true },
  { id: 7, category: "Courses", title: "You finished CSS Foundations", body: "Nice work — 24 of 24 lessons complete.", href: "/dashboard", minutesAgo: 60 * 24 * 9, read: true },
];

let items: FakeNotification[] = SEED;
let empty = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));
const snapshot = () => (empty ? EMPTY : items);
const EMPTY: FakeNotification[] = [];

const store = {
  markRead(id: number) {
    items = items.map((n) => (n.id === id ? { ...n, read: true } : n));
    emit();
  },
  toggleRead(id: number) {
    items = items.map((n) => (n.id === id ? { ...n, read: !n.read } : n));
    emit();
  },
  markAllRead() {
    items = items.map((n) => ({ ...n, read: true }));
    emit();
  },
  toggleEmpty() {
    empty = !empty;
    emit();
  },
  addNew() {
    const id = Math.max(0, ...items.map((n) => n.id)) + 1;
    items = [
      { id, category: "Questions", title: `New reply #${id} on your question`, body: "Simulated live Notification.", href: "/courses", minutesAgo: 0, read: false },
      ...items,
    ];
    emit();
  },
  reset() {
    items = SEED;
    empty = false;
    emit();
  },
};

function useNotifications() {
  const list = useSyncExternalStore(subscribe, snapshot, () => SEED);
  return { list, unread: list.filter((n) => !n.read).length, isEmpty: empty };
}

// ─── Variant selection (URL param, remembered across navigation) ─────────

const VARIANTS = [
  { key: "A", name: "Bell + popover (click to open)" },
  { key: "A2", name: "Bell + expand in place" },
  { key: "A3", name: "Bell + View all page w/ search" },
  { key: "B", name: "Nav item + slide-over drawer" },
  { key: "C", name: "Full Inbox page" },
] as const;
type VariantKey = (typeof VARIANTS)[number]["key"];

export function useInboxVariant(): VariantKey {
  const [params] = useSearchParams();
  const fromUrl = params.get("variant");
  const [remembered, setRemembered] = useState<VariantKey>("A");
  useEffect(() => {
    const v = (fromUrl ?? localStorage.getItem("inbox-prototype-variant")) as VariantKey | null;
    if (v && VARIANTS.some((x) => x.key === v)) {
      setRemembered(v);
      localStorage.setItem("inbox-prototype-variant", v);
    }
  }, [fromUrl]);
  return (fromUrl as VariantKey) ?? remembered;
}

// ─── Shared bits ─────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<Category, React.ReactNode> = {
  Payments: <CreditCard className="size-4" />,
  Courses: <GraduationCap className="size-4" />,
  Questions: <MessageSquare className="size-4" />,
  Team: <UsersRound className="size-4" />,
};

function ago(m: number) {
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 60 / 24)}d ago`;
}

function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <span className={cn("inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground", className)}>
      {count > 9 ? "9+" : count}
    </span>
  );
}

// ─── Variant A: bell in sidebar header, popover ──────────────────────────
// Compact rows, blue dot for unread, click row = mark read + navigate.

function VariantABell({ mode }: { mode: "link" | "expand" | "viewall" }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const { list: all, unread } = useNotifications();
  const list = mode === "expand" && q ? all.filter((n) => (n.title + " " + n.body).toLowerCase().includes(q.toLowerCase())) : all;
  const [open, setOpen] = useState(false);
  const [overflowing, setOverflowing] = useState<Record<number, boolean>>({});
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Inbox"
        className="relative rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-10 z-40 w-96 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="font-semibold">Inbox</span>
            {unread > 0 && (
              <button onClick={store.markAllRead} className="text-xs text-primary hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          {mode === "expand" && all.length > 0 && (
            <div className="border-b px-3 py-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search Notifications…"
                className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
              />
            </div>
          )}
          {mode === "expand" && all.length > 0 && list.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">No Notifications match “{q}”.</div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
              <BellOff className="size-8 opacity-40" />
              <div className="font-medium text-foreground">You're all caught up</div>
              <div>Notifications about your courses, questions and payments will show up here.</div>
            </div>
          ) : (
            <ul className="max-h-[28rem] overflow-y-auto">
              {list.map((n) => {
                const isOpen = mode === "expand" && expanded === n.id;
                return (
                <li key={n.id} className={cn("flex", !n.read && "bg-primary/5")}>
                  <button
                    onClick={() => {
                      store.markRead(n.id);
                      setOpen(false);
                      navigate(n.href);
                    }}
                    className="flex min-w-0 flex-1 gap-3 px-4 py-3 text-left hover:bg-accent"
                  >
                    <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: n.read ? "transparent" : "var(--color-primary, #3b82f6)" }} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", !n.read ? "font-semibold" : "text-muted-foreground")}>{n.title}</span>
                      {mode === "expand" ? (
                        <TruncatedBody text={n.body} open={isOpen} onOverflow={(o) => setOverflowing((s) => (s[n.id] === o ? s : { ...s, [n.id]: o }))} />
                      ) : (
                        <span className="block line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
                      )}
                      <span className="mt-0.5 block text-[11px] text-muted-foreground/70">
                        {n.category} · {ago(n.minutesAgo)}
                        {isOpen && <span className="ml-2 text-primary">Open →</span>}
                      </span>
                    </span>
                  </button>
                  {mode === "expand" && (
                    // Two fixed-width slots so the mark-read button never moves when the chevron is absent.
                    <div className="flex shrink-0 self-start pt-2.5 pr-2">
                      <span className="flex w-7 justify-center">
                        {!n.read && (
                          <button
                            title="Mark as read"
                            onClick={() => store.markRead(n.id)}
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <MailOpen className="size-4" />
                          </button>
                        )}
                      </span>
                      <span className="flex w-7 justify-center">
                        {(overflowing[n.id] || isOpen) && (
                          <button
                            title={isOpen ? "Collapse" : "Read full text"}
                            onClick={() => {
                              setExpanded(isOpen ? null : n.id);
                              store.markRead(n.id);
                            }}
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                          </button>
                        )}
                      </span>
                    </div>
                  )}
                </li>
                );
              })}
            </ul>
          )}
          {mode === "viewall" && (
            <Link
              to="/inbox-prototype?variant=A3"
              onClick={() => setOpen(false)}
              className="block border-t px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-accent"
            >
              View all Notifications
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/** One-line body that reports whether it's truncated, so A2 only offers expand when there's more to read. */
function TruncatedBody({ text, open, onOverflow }: { text: string; open: boolean; onOverflow: (o: boolean) => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (open || !ref.current) return;
    onOverflow(ref.current.scrollWidth > ref.current.clientWidth);
  });
  return (
    <span ref={ref} className={cn("block text-xs text-muted-foreground", open ? "whitespace-pre-wrap" : "truncate")}>
      {text}
    </span>
  );
}

// ─── Variant B: nav item + slide-over drawer ─────────────────────────────
// Roomier cards with category icon, explicit per-item read toggle, unread
// pinned above "Earlier". Opening the drawer does NOT mark anything read.

function VariantBNavItem() {
  const { unread } = useNotifications();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <InboxIcon className="size-4" />
        <span className="flex-1 text-left">Inbox</span>
        <UnreadBadge count={unread} />
      </button>
      {open && <Drawer onClose={() => setOpen(false)} />}
    </>
  );
}

function Drawer({ onClose }: { onClose: () => void }) {
  const { list, unread } = useNotifications();
  const navigate = useNavigate();
  const fresh = list.filter((n) => !n.read);
  const earlier = list.filter((n) => n.read);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const Card = ({ n }: { n: FakeNotification }) => (
    <div className={cn("group flex gap-3 rounded-lg border p-3", !n.read ? "border-primary/40 bg-primary/5" : "bg-card")}>
      <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", !n.read ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
        {CATEGORY_ICON[n.category]}
      </div>
      <button
        className="min-w-0 flex-1 text-left"
        onClick={() => {
          store.markRead(n.id);
          onClose();
          navigate(n.href);
        }}
      >
        <div className="text-sm font-medium">{n.title}</div>
        <div className="mt-0.5 text-sm text-muted-foreground">{n.body}</div>
        <div className="mt-1 text-xs text-muted-foreground/70">{ago(n.minutesAgo)}</div>
      </button>
      <button
        onClick={() => store.toggleRead(n.id)}
        title={n.read ? "Mark as unread" : "Mark as read"}
        className="self-start rounded p-1 text-muted-foreground opacity-0 hover:bg-accent group-hover:opacity-100"
      >
        <Check className="size-4" />
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative flex h-full w-[26rem] flex-col border-l bg-background shadow-2xl">
        <div className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2 font-semibold">
            Inbox <UnreadBadge count={unread} />
          </div>
          <div className="flex items-center gap-1">
            <button onClick={store.markAllRead} disabled={unread === 0} title="Mark all as read" className="rounded p-1.5 hover:bg-accent disabled:opacity-30">
              <CheckCheck className="size-4" />
            </button>
            <button onClick={onClose} className="rounded p-1.5 hover:bg-accent">
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {list.length === 0 && (
            <div className="mt-20 flex flex-col items-center gap-3 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                <InboxIcon className="size-6 text-muted-foreground" />
              </div>
              <div className="font-medium">Nothing here yet</div>
              <p className="max-w-64 text-sm text-muted-foreground">
                When an instructor answers you, a course gets a new lesson, or a payment goes through, you'll see it here.
              </p>
              <Link to="/settings" onClick={onClose} className="text-sm text-primary hover:underline">
                Notification Preferences
              </Link>
            </div>
          )}
          {fresh.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New</h3>
              {fresh.map((n) => <Card key={n.id} n={n} />)}
            </section>
          )}
          {earlier.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Earlier</h3>
              {earlier.map((n) => <Card key={n.id} n={n} />)}
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

// ─── Variant C: full page ────────────────────────────────────────────────
// Sidebar nav item links to /inbox-prototype. Table-ish list grouped by day,
// category filter tabs, unread-only toggle, checkbox bulk mark-read.

function VariantCNavItem() {
  const { unread } = useNotifications();
  return (
    <NavLink
      to="/inbox-prototype?variant=C"
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      <InboxIcon className="size-4" />
      <span className="flex-1">Inbox</span>
      <UnreadBadge count={unread} />
    </NavLink>
  );
}

function dayBucket(m: number) {
  if (m < 60 * 24) return "Today";
  if (m < 60 * 48) return "Yesterday";
  if (m < 60 * 24 * 7) return "This week";
  return "Older";
}

export function VariantCPage() {
  const { list, unread } = useNotifications();
  const [cat, setCat] = useState<Category | "All">("All");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const shown = list.filter((n) => (cat === "All" || n.category === cat) && (!unreadOnly || !n.read) && (q === "" || (n.title + " " + n.body).toLowerCase().includes(q.toLowerCase())));
  const groups = ["Today", "Yesterday", "This week", "Older"]
    .map((g) => ({ g, rows: shown.filter((n) => dayBucket(n.minutesAgo) === g) }))
    .filter((x) => x.rows.length > 0);

  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-sm text-muted-foreground">{unread} unread</p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button
              onClick={() => {
                selected.forEach((id) => store.markRead(id));
                setSelected(new Set());
              }}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Mark {selected.size} as read
            </button>
          )}
          <button onClick={store.markAllRead} disabled={unread === 0} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40">
            Mark all as read
          </button>
          <Link to="/settings" className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
            Preferences
          </Link>
        </div>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search Notifications…"
        className="mb-4 w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
      <div className="mb-4 flex items-center gap-1 border-b">
        {(["All", "Payments", "Courses", "Questions", "Team"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm", cat === c ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {c}
            {c !== "All" && (
              <UnreadBadge className="ml-1.5" count={list.filter((n) => n.category === c && !n.read).length} />
            )}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 pb-1 text-sm text-muted-foreground">
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
          Unread only
        </label>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <CheckCheck className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <div className="font-medium">{list.length === 0 ? "No Notifications yet" : "Nothing matches this filter"}</div>
          <p className="mt-1 text-sm text-muted-foreground">
            {list.length === 0 ? "Activity on your courses, questions, team and payments lands here." : "Try another category, or turn off “Unread only”."}
          </p>
        </div>
      ) : (
        groups.map(({ g, rows }) => (
          <section key={g} className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g}</h2>
            <ul className="divide-y rounded-lg border">
              {rows.map((n) => (
                <li key={n.id} className={cn("flex items-center gap-3 px-4 py-3", !n.read && "bg-primary/5")}>
                  <input type="checkbox" checked={selected.has(n.id)} onChange={() => toggle(n.id)} />
                  <span className="text-muted-foreground">{CATEGORY_ICON[n.category]}</span>
                  <Link to={n.href} onClick={() => store.markRead(n.id)} className="min-w-0 flex-1">
                    <div className={cn("truncate text-sm", !n.read && "font-semibold")}>{n.title}</div>
                    <div className="truncate text-sm text-muted-foreground">{n.body}</div>
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">{ago(n.minutesAgo)}</span>
                  <button onClick={() => store.toggleRead(n.id)} className="shrink-0 text-xs text-primary hover:underline">
                    {n.read ? "Mark unread" : "Mark read"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

// ─── Sidebar mount points ────────────────────────────────────────────────

/** Rendered next to the "Cadence" wordmark. */
export function InboxPrototypeHeaderSlot() {
  const v = useInboxVariant();
  if (v === "A") return <VariantABell mode="link" />;
  if (v === "A2") return <VariantABell mode="expand" />;
  if (v === "A3") return <VariantABell mode="viewall" />;
  return null;
}

/** Rendered at the top of the sidebar nav. */
export function InboxPrototypeNavSlot() {
  const v = useInboxVariant();
  if (v === "B") return <VariantBNavItem />;
  if (v === "C") return <VariantCNavItem />;
  return null;
}

// ─── Floating switcher ───────────────────────────────────────────────────

export function PrototypeSwitcher() {
  const current = useInboxVariant();
  const [params, setParams] = useSearchParams();
  const { list, unread, isEmpty } = useNotifications();
  const idx = Math.max(0, VARIANTS.findIndex((v) => v.key === current));

  const go = (delta: number) => {
    const next = VARIANTS[(idx + delta + VARIANTS.length) % VARIANTS.length].key;
    localStorage.setItem("inbox-prototype-variant", next);
    const p = new URLSearchParams(params);
    p.set("variant", next);
    setParams(p, { replace: true });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-zinc-900 px-2 py-1.5 text-xs text-white shadow-2xl ring-2 ring-fuchsia-500">
      <button onClick={() => go(-1)} className="rounded-full p-1 hover:bg-white/15"><ChevronLeft className="size-4" /></button>
      <span className="min-w-52 text-center font-medium">
        {current} ({VARIANTS[idx].name})
      </span>
      <button onClick={() => go(1)} className="rounded-full p-1 hover:bg-white/15"><ChevronRight className="size-4" /></button>
      <span className="mx-1 h-4 w-px bg-white/30" />
      <span className="text-white/70">{list.length} total · {unread} unread</span>
      <button onClick={store.addNew} className="rounded-full px-2 py-1 hover:bg-white/15">+ new</button>
      <button onClick={store.toggleEmpty} className={cn("rounded-full px-2 py-1 hover:bg-white/15", isEmpty && "bg-fuchsia-600")}>empty</button>
      <button onClick={store.reset} className="rounded-full px-2 py-1 hover:bg-white/15">reset</button>
    </div>
  );
}

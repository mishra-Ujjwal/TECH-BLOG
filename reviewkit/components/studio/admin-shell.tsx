"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The admin panel frame: a fixed sidebar on wide screens, a top bar with a menu
 * button on narrow ones. Every item links to a working studio page.
 */

type Item = { href: string; label: string; icon: IconName; exact?: boolean };
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Overview",
    items: [
      { href: "/studio", label: "Dashboard", icon: "grid", exact: true },
      { href: "/studio/adsense", label: "AdSense readiness", icon: "shield" },
      { href: "/studio/assistant", label: "Assistant", icon: "chat" },
    ],
  },
  {
    title: "Content",
    items: [
      { href: "/studio/posts", label: "All posts", icon: "file" },
      { href: "/studio/new", label: "New post", icon: "plus" },
      { href: "/studio/import", label: "Import JSON", icon: "upload" },
      { href: "/studio/pages", label: "Static pages", icon: "layers" },
      { href: "/studio/media", label: "Media library", icon: "image" },
    ],
  },
  {
    title: "Site",
    items: [
      { href: "/studio/categories", label: "Categories", icon: "tag" },
      { href: "/studio/authors", label: "Authors", icon: "user" },
      { href: "/studio/settings", label: "Global settings", icon: "gear" },
    ],
  },
  { title: "Help", items: [{ href: "/studio/guide", label: "Writing guide", icon: "book" }] },
];

function active(pathname: string, item: Item): boolean {
  if (item.exact) return pathname === item.href;
  // The editor belongs to "All posts".
  if (item.href === "/studio/posts" && pathname.startsWith("/studio/edit/")) return true;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AdminShell({
  children,
  siteName,
  logout,
}: {
  children: React.ReactNode;
  siteName: string;
  logout: () => Promise<void>;
}) {
  const pathname = usePathname() ?? "/studio";
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const nav = (
    <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-4">
      {GROUPS.map((g) => (
        <div key={g.title} className="mb-5">
          <p className="px-3 text-micro font-semibold text-ink-3">{g.title}</p>
          <ul className="mt-1.5 space-y-0.5">
            {g.items.map((item) => {
              const on = active(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={on ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-small font-medium ${
                      on ? "bg-accent-wash text-accent" : "text-ink-2 hover:bg-paper-2 hover:text-ink"
                    }`}
                  >
                    <Icon name={item.icon} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="space-y-0.5 border-t border-rule px-3 py-3">
      <a
        href="/"
        target="_blank"
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-small font-medium text-ink-2 hover:bg-paper-2 hover:text-ink"
      >
        <Icon name="external" />
        View live site
        <span className="ml-auto rounded-full bg-measured-wash px-2 py-0.5 text-micro font-semibold text-measured">
          Live
        </span>
      </a>
      <form action={logout}>
        <button
          type="submit"
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-small font-medium text-caution hover:bg-paper-2"
        >
          <Icon name="logout" />
          Sign out
        </button>
      </form>
    </div>
  );

  const brand = (
    <Link href="/studio" className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/tw-badge.png" alt="" width={36} height={36} className="size-9 rounded-[9px]" />
      <span className="leading-tight">
        <span className="block text-small font-bold tracking-[-0.01em] text-ink">{siteName}</span>
        <span className="block text-micro text-ink-3">Admin</span>
      </span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-paper-2 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      {/* Wide screens: fixed sidebar */}
      <aside className="hidden border-r border-rule bg-paper lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="border-b border-rule px-5 py-4">{brand}</div>
        {nav}
        {footer}
      </aside>

      {/* Narrow screens: top bar and a slide-down menu */}
      <div className="sticky top-0 z-30 border-b border-rule bg-paper lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          {brand}
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-rule-strong px-3 py-1.5 text-small font-medium"
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
        {open && (
          <div className="flex max-h-[80vh] flex-col border-t border-rule">
            {nav}
            {footer}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="mx-auto w-full max-w-[72rem] px-5 py-8 sm:px-8 lg:py-10">{children}</div>
      </div>
    </div>
  );
}

type IconName =
  | "grid" | "file" | "plus" | "upload" | "layers" | "image" | "tag" | "user" | "gear" | "book" | "external" | "logout" | "shield" | "chat";

const PATHS: Record<IconName, React.ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  plus: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  upload: <><path d="M12 15V4M7 9l5-5 5 5" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></>,
  tag: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="8" cy="8" r="1.5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  shield: <><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  chat: <><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></>,
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-[1.05rem] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}

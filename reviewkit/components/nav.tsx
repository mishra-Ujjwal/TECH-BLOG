"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Two navigation rows. MainNav holds the links from site.json (inline from `lg`
 * up, a Menu panel below it). CategoryStrip is the row of categories under the
 * masthead, straight from content/categories.json, so it never drifts.
 */

type NavItem = { label: string; href: string };
type NavCategory = { slug: string; name: string; brands: string[]; topics: string[] };

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Top bar links sit on the orange masthead: bold navy text, underlined in navy
// on hover and for the page you are on.
const linkBase = "text-ink underline-offset-[0.45em] decoration-2 hover:underline";
const linkActive = "text-ink underline decoration-ink decoration-2 underline-offset-[0.45em]";

export function MainNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname() ?? "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  // A new page closes the menu.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const searchActive = isActive(pathname, "/search");

  return (
    <>
      {/* ------------------------------------------------------------ wide -- */}
      <nav aria-label="Main" className="hidden lg:block">
        <ul className="flex items-center gap-x-6 text-base font-semibold tracking-[-0.01em]">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className={isActive(pathname, item.href) ? linkActive : linkBase}
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/search"
              aria-current={searchActive ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-full border-2 border-ink px-3.5 py-1.5 transition-colors ${
                searchActive ? "bg-ink text-paper" : "text-ink hover:bg-ink hover:text-paper"
              }`}
            >
              <SearchIcon />
              Search
            </Link>
          </li>
        </ul>
      </nav>

      {/* ---------------------------------------------------------- narrow -- */}
      <div className="flex items-center gap-2 lg:hidden">
        <Link
          href="/search"
          aria-label="Search"
          className="rounded-full border-2 border-ink p-2 text-ink hover:bg-ink hover:text-paper"
        >
          <SearchIcon />
        </Link>
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1.5 text-small font-semibold text-ink hover:bg-ink hover:text-paper"
        >
          <MenuIcon open={menuOpen} />
          {menuOpen ? "Close" : "Menu"}
        </button>
      </div>

      {menuOpen && (
        <nav
          id={menuId}
          aria-label="Main"
          className="w-full border-t border-rule pt-2 lg:hidden"
        >
          <ul className="text-base">
            {items.map((item) => (
              <li key={item.href} className="border-b border-rule">
                <Link
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className={`block py-3 ${
                    isActive(pathname, item.href) ? "font-medium text-accent" : "text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <form action="/search" method="get" role="search" className="mt-4 flex gap-2 pb-2">
            <label htmlFor={`${menuId}-q`} className="sr-only">
              Search reviews and guides
            </label>
            <input
              id={`${menuId}-q`}
              name="q"
              type="search"
              placeholder="Search reviews and guides"
              className="min-w-0 flex-1 rounded-lg border border-rule-strong bg-paper px-3 py-2 text-base placeholder:text-ink-3"
            />
            <button
              type="submit"
              className="rounded-lg bg-accent px-3.5 py-2 text-small font-medium text-paper hover:bg-accent-2"
            >
              Search
            </button>
          </form>
        </nav>
      )}
    </>
  );
}

/**
 * The category row. Every category on one line from `lg` up; on smaller screens the
 * row scrolls sideways, with a fade at the right edge to show there is more.
 *
 * From `lg` up, hovering or tabbing onto a category opens its menu: popular brands,
 * what it covers, and more from that category. Brands and topics have no pages of
 * their own yet, so they open a search. The panel sits inside its list item, so the
 * keyboard reaches its links straight after the category.
 */
export function CategoryStrip({ categories }: { categories: NavCategory[] }) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setOpen(null), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const show = (slug: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(slug);
  };
  // A short delay so the pointer can travel from the label into the panel.
  const hide = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(null), 120);
  };


  return (
    <nav aria-label="Categories" className="relative border-t border-rule" onMouseLeave={hide}>
      <ul className="no-scrollbar mx-auto flex w-full max-w-[72rem] gap-x-7 overflow-x-auto px-5 text-small font-semibold lg:justify-between lg:gap-x-4 lg:overflow-visible lg:text-base">
        {categories.map((c) => {
          const href = `/categories/${c.slug}`;
          const active = isActive(pathname, href);
          const isOpen = open === c.slug;
          return (
            <li
              key={c.slug}
              className="shrink-0"
              onMouseEnter={() => show(c.slug)}
              onFocus={() => show(c.slug)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) hide();
              }}
            >
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap border-b-2 py-3 tracking-[-0.01em] ${
                  active || isOpen
                    ? "border-brand-orange text-accent"
                    : "border-transparent text-ink hover:border-brand-orange hover:text-accent"
                }`}
              >
                {c.name}
              </Link>
              <CategoryPanel category={c} open={isOpen} />
            </li>
          );
        })}
      </ul>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-paper lg:hidden"
      />
    </nav>
  );
}

function CategoryPanel({ category: c, open }: { category: NavCategory; open: boolean }) {
  const search = (term: string) => `/search?q=${encodeURIComponent(term)}`;
  const singular = c.name.toLowerCase();
  const columns = [
    { title: "Popular brands", links: c.brands.map((b) => ({ label: b, href: search(b) })) },
    { title: "What we cover", links: c.topics.map((t) => ({ label: t, href: search(t) })) },
    {
      title: `More from ${c.name}`,
      links: [
        { label: `Everything in ${singular}`, href: `/categories/${c.slug}` },
        { label: "Latest reviews", href: "/reviews" },
        { label: "How-tos and fixes", href: "/articles" },
        { label: "Buying guides", href: "/guides" },
      ],
    },
  ].filter((col) => col.links.length > 0);

  // A rounded card floating just under the strip. The transparent padding above it
  // belongs to the list item, so the pointer can cross the gap without closing it.
  return (
    <div className={`absolute inset-x-0 top-full z-40 hidden px-5 pt-2 ${open ? "lg:block" : ""}`}>
      <div className="mx-auto grid w-full max-w-[72rem] grid-cols-3 divide-x divide-rule overflow-hidden rounded-[20px] border border-rule-strong bg-paper">
        {columns.map((col) => (
          <div key={col.title} className="px-8 py-7">
            <p className="text-small font-normal text-ink-3">{col.title}</p>
            <ul className="mt-4 space-y-3.5 text-base font-normal">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-ink hover:text-accent hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5">
      <circle cx="7" cy="7" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="m10.5 10.5 3.5 3.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5">
      {open ? (
        <path d="m3.5 3.5 9 9m0-9-9 9" stroke="currentColor" strokeWidth="1.5" />
      ) : (
        <path d="M2 4.5h12M2 8h12M2 11.5h12" stroke="currentColor" strokeWidth="1.5" />
      )}
    </svg>
  );
}

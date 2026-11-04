"use client";

import { useMemo, useState } from "react";
import type { Site, SocialNetwork } from "@/lib/content/schema";

/**
 * Global settings: an editor for content/site.json, split into tabs. Saving sends
 * the whole object back to the server, which checks it against the site schema
 * before writing, then refreshes every page.
 */

type Tab = "identity" | "seo" | "search" | "navigation" | "monetisation";
const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "identity", label: "Site identity", hint: "Name, address, publisher" },
  { id: "seo", label: "Homepage SEO", hint: "Title and description" },
  { id: "search", label: "Search engines", hint: "Verification, sitemap" },
  { id: "navigation", label: "Navigation & social", hint: "Top bar links, profiles" },
  { id: "monetisation", label: "Ads & affiliates", hint: "AdSense, disclosure" },
];

const NETWORKS: SocialNetwork[] = ["x", "instagram", "linkedin", "github", "youtube", "facebook"];
const NETWORK_LABELS: Record<SocialNetwork, string> = {
  x: "X",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  github: "GitHub",
  youtube: "YouTube",
  facebook: "Facebook",
};

const input =
  "mt-1.5 w-full rounded-lg border border-rule-strong bg-paper px-3 py-2 text-small text-ink placeholder:text-ink-3";
const btn = "rounded-lg border border-rule-strong px-3 py-1.5 text-small font-medium hover:bg-paper-2";

type Issue = { path: string; message: string };

export function SettingsForm({ initial }: { initial: Site }) {
  const [site, setSite] = useState<Site>(initial);
  const [tab, setTab] = useState<Tab>("identity");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Issue[]>([]);
  const [message, setMessage] = useState("");
  const dirty = useMemo(() => JSON.stringify(site) !== JSON.stringify(initial), [site, initial]);

  const set = (updater: (s: Site) => Site) => {
    setSite((s) => updater(structuredClone(s)));
    setMessage("");
  };
  const errorFor = (p: string) => errors.find((e) => e.path === p)?.message;

  async function save() {
    setSaving(true);
    setErrors([]);
    setMessage("");
    try {
      const res = await fetch("/api/studio/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ site }),
      });
      const data = await res.json();
      if (!data.ok) {
        setErrors(data.errors ?? []);
        setMessage("Not saved. Fix the fields marked below.");
        // Jump to the tab holding the first problem.
        const first: string = data.errors?.[0]?.path ?? "";
        const tabFor: Tab = /^(homeTitle|description)/.test(first)
          ? "seo"
          : /^verification/.test(first)
            ? "search"
            : /^(nav|social)/.test(first)
              ? "navigation"
              : /^(adsense|adsTxtExtra|affiliate)/.test(first)
                ? "monetisation"
                : "identity";
        setTab(tabFor);
        return;
      }
      setSite(data.site);
      setMessage("Saved. Every page now uses the new settings.");
      // Reflect the new baseline so "unsaved changes" clears.
      window.location.reload();
    } catch (e) {
      setMessage(`Not saved: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Tabs */}
      <div role="tablist" aria-label="Settings" className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-[12px] border px-4 py-2.5 text-left ${
                on ? "border-accent bg-accent text-paper" : "border-rule bg-paper text-ink hover:border-rule-strong"
              }`}
            >
              <span className="block text-small font-semibold">{t.label}</span>
              <span className={`block text-micro ${on ? "text-paper/80" : "text-ink-3"}`}>{t.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-[14px] border border-rule bg-paper p-5 sm:p-7">
        {tab === "identity" && (
          <Section title="Site identity and publisher" description="How the site names itself everywhere: the header, footer, legal pages, share cards and Google.">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Site name" err={errorFor("name")}>
                <input className={input} value={site.name} onChange={(e) => set((s) => ({ ...s, name: e.target.value }))} />
              </Field>
              <Field label="Short name" err={errorFor("shortName")} hint="Used where space is tight, such as the admin panel.">
                <input className={input} value={site.shortName ?? ""} onChange={(e) => set((s) => ({ ...s, shortName: e.target.value }))} />
              </Field>
              <Field label="Canonical site address (production)" err={errorFor("url")} hint="The live address, starting https://. Used for links in the sitemap and for Google.">
                <input className={`${input} font-mono`} value={site.url} onChange={(e) => set((s) => ({ ...s, url: e.target.value }))} />
              </Field>
              <Field label="Default language" err={errorFor("defaultLocale")} hint="British or American English. Sets spelling expectations and the page language.">
                <select className={input} value={site.defaultLocale} onChange={(e) => set((s) => ({ ...s, defaultLocale: e.target.value as Site["defaultLocale"] }))}>
                  <option value="en-GB">English (UK), en-GB</option>
                  <option value="en-US">English (US), en-US</option>
                </select>
              </Field>
            </div>
            <div className="mt-5">
              <Field label="Tagline" err={errorFor("tagline")} hint="One line about the site, shown on share cards.">
                <input className={input} value={site.tagline} onChange={(e) => set((s) => ({ ...s, tagline: e.target.value }))} />
              </Field>
            </div>

            <h3 className="mt-8 border-t border-rule pt-6 text-small font-bold">Publisher</h3>
            <p className="mt-1 text-micro text-ink-3">Shown in the footer copyright line, on the legal pages and to Google.</p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <Field label="Publisher name" err={errorFor("publisher.name")}>
                <input className={input} value={site.publisher.name} onChange={(e) => set((s) => ({ ...s, publisher: { ...s.publisher, name: e.target.value } }))} />
              </Field>
              <Field label="Contact email" err={errorFor("publisher.email")} hint="Must be a real inbox you check: privacy requests have legal deadlines.">
                <input type="email" className={input} value={site.publisher.email} onChange={(e) => set((s) => ({ ...s, publisher: { ...s.publisher, email: e.target.value } }))} />
              </Field>
              <Field label="Country code" err={errorFor("publisher.country")} hint="Two letters, for example GB.">
                <input className={`${input} max-w-[6rem] uppercase`} maxLength={2} value={site.publisher.country} onChange={(e) => set((s) => ({ ...s, publisher: { ...s.publisher, country: e.target.value.toUpperCase() } }))} />
              </Field>
              <Field label="Logo" err={errorFor("publisher.logo")} hint="Path under public/, used by Google.">
                <input className={`${input} font-mono`} value={site.publisher.logo ?? ""} onChange={(e) => set((s) => ({ ...s, publisher: { ...s.publisher, logo: e.target.value } }))} />
              </Field>
            </div>
            <div className="mt-5">
              <Field label="Postal address" err={errorFor("publisher.address")} hint="Optional. Leave empty to show only the country.">
                <input className={input} value={site.publisher.address ?? ""} onChange={(e) => set((s) => ({ ...s, publisher: { ...s.publisher, address: e.target.value } }))} />
              </Field>
            </div>
          </Section>
        )}

        {tab === "seo" && (
          <Section title="Homepage SEO" description="What Google shows for your homepage. Every other page sets its own title and description.">
            <div className="space-y-5">
              <Field label="Homepage title" err={errorFor("homeTitle")} counter={{ value: site.homeTitle, min: 10, max: 60 }} hint="Under 60 characters so Google shows all of it.">
                <input className={input} value={site.homeTitle} onChange={(e) => set((s) => ({ ...s, homeTitle: e.target.value }))} />
              </Field>
              <Field label="Homepage description" err={errorFor("description")} counter={{ value: site.description, min: 140, max: 160 }} hint="140 to 160 characters. Also used in the footer.">
                <textarea className={`${input} min-h-[5.5rem]`} value={site.description} onChange={(e) => set((s) => ({ ...s, description: e.target.value }))} />
              </Field>
            </div>
            <div className="mt-7 rounded-[12px] border border-rule bg-paper-2 p-4">
              <p className="text-micro font-semibold text-ink-3">Preview in Google</p>
              <p className="mt-2 truncate text-micro text-ink-2">{site.url.replace(/^https?:\/\//, "")}</p>
              <p className="mt-0.5 truncate text-[1.15rem] leading-snug text-accent">{site.homeTitle}</p>
              <p className="mt-1 line-clamp-2 text-small text-ink-2">{site.description}</p>
            </div>
            <p className="mt-4 text-micro text-ink-3">
              Other pages use the format <code>Page title | {site.name}</code>, and drop the site name when the title would be longer than 60 characters.
            </p>
          </Section>
        )}

        {tab === "search" && (
          <Section title="Search engines" description="Prove you own the site to Google and Bing, then submit your sitemap in their consoles.">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Google Search Console verification code" err={errorFor("verification.google")} hint={<>From Search Console, choose the HTML tag method and paste only the <code>content</code> value.</>}>
                <input className={`${input} font-mono`} value={site.verification?.google ?? ""} onChange={(e) => set((s) => ({ ...s, verification: { ...s.verification, google: e.target.value } }))} />
              </Field>
              <Field label="Bing Webmaster Tools verification code" err={errorFor("verification.bing")} hint={<>The <code>content</code> value of Bing&rsquo;s msvalidate.01 meta tag.</>}>
                <input className={`${input} font-mono`} value={site.verification?.bing ?? ""} onChange={(e) => set((s) => ({ ...s, verification: { ...s.verification, bing: e.target.value } }))} />
              </Field>
            </div>
            <h3 className="mt-8 border-t border-rule pt-6 text-small font-bold">Generated for you</h3>
            <p className="mt-1 text-micro text-ink-3">These update automatically when you publish. Submit the sitemap address in Search Console.</p>
            <ul className="mt-3 space-y-2 text-small">
              {[
                ["Sitemap", "/sitemap.xml"],
                ["Robots rules", "/robots.txt"],
                ["Ads.txt", "/ads.txt"],
              ].map(([label, href]) => (
                <li key={href} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rule px-3 py-2">
                  <span className="font-medium">{label}</span>
                  <a href={href} target="_blank" className="link font-mono text-micro">
                    {site.url.replace(/\/$/, "")}
                    {href}
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {tab === "navigation" && (
          <Section title="Navigation and social profiles" description="The links in the orange top bar, and your social profiles for the footer and Google.">
            <h3 className="text-small font-bold">Top bar links</h3>
            <p className="mt-1 text-micro text-ink-3">The categories are shown automatically in the row below. Links to unpublished pages are hidden.</p>
            <ul className="mt-3 space-y-2">
              {site.nav.map((n, i) => (
                <li key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-2">
                  <div>
                    <input aria-label="Link text" placeholder="Link text" className={input} value={n.label} onChange={(e) => set((s) => { s.nav[i].label = e.target.value; return s; })} />
                    {errorFor(`nav.${i}.label`) && <span className="text-micro text-caution">{errorFor(`nav.${i}.label`)}</span>}
                  </div>
                  <div>
                    <input aria-label="Address" placeholder="/about" className={`${input} font-mono`} value={n.href} onChange={(e) => set((s) => { s.nav[i].href = e.target.value; return s; })} />
                    {errorFor(`nav.${i}.href`) && <span className="text-micro text-caution">{errorFor(`nav.${i}.href`)}</span>}
                  </div>
                  <div className="mt-1.5 flex gap-1">
                    <button type="button" className={btn} disabled={i === 0} onClick={() => set((s) => { [s.nav[i - 1], s.nav[i]] = [s.nav[i], s.nav[i - 1]]; return s; })} aria-label="Move up">Up</button>
                    <button type="button" className={btn} onClick={() => set((s) => { s.nav.splice(i, 1); return s; })}>Remove</button>
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className={`${btn} mt-3`} onClick={() => set((s) => ({ ...s, nav: [...s.nav, { label: "", href: "/" }] }))}>
              Add link
            </button>

            <h3 className="mt-8 border-t border-rule pt-6 text-small font-bold">Social profiles</h3>
            <p className="mt-1 text-micro text-ink-3">Only add profiles you own. Each one shows as an icon in the footer.</p>
            <ul className="mt-3 space-y-2">
              {site.social.map((p, i) => (
                <li key={i} className="grid grid-cols-[9rem_minmax(0,1fr)_auto] items-start gap-2">
                  <select aria-label="Network" className={input} value={p.network} onChange={(e) => set((s) => { s.social[i].network = e.target.value as SocialNetwork; return s; })}>
                    {NETWORKS.map((n) => (
                      <option key={n} value={n}>{NETWORK_LABELS[n]}</option>
                    ))}
                  </select>
                  <div>
                    <input aria-label="Profile address" placeholder="https://..." className={`${input} font-mono`} value={p.url} onChange={(e) => set((s) => { s.social[i].url = e.target.value; return s; })} />
                    {errorFor(`social.${i}.url`) && <span className="text-micro text-caution">{errorFor(`social.${i}.url`)}</span>}
                  </div>
                  <button type="button" className={`${btn} mt-1.5`} onClick={() => set((s) => { s.social.splice(i, 1); return s; })}>Remove</button>
                </li>
              ))}
            </ul>
            <button type="button" className={`${btn} mt-3`} onClick={() => set((s) => ({ ...s, social: [...s.social, { network: "x", url: "" }] }))}>
              Add profile
            </button>
          </Section>
        )}

        {tab === "monetisation" && (
          <Section title="Ads and affiliates" description="Ads only ever load when AdSense is switched on here and the visitor has accepted cookies.">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="AdSense publisher ID" err={errorFor("adsense.publisherId")} hint="Looks like ca-pub-0000000000000000. Leave empty until you are approved.">
                <input className={`${input} font-mono`} value={site.adsense.publisherId} onChange={(e) => set((s) => ({ ...s, adsense: { ...s.adsense, publisherId: e.target.value } }))} />
              </Field>
              <div>
                <span className="text-small font-semibold">Show ads</span>
                <label className="mt-2.5 flex items-start gap-2.5 text-small">
                  <input type="checkbox" className="mt-1" checked={site.adsense.enabled} onChange={(e) => set((s) => ({ ...s, adsense: { ...s.adsense, enabled: e.target.checked } }))} />
                  <span>
                    Load AdSense for visitors who accept cookies
                    <span className="block text-micro text-ink-3">Turn on only after AdSense approves the site and the publisher ID is set.</span>
                  </span>
                </label>
                {site.adsense.enabled && !site.adsense.publisherId && (
                  <p className="mt-1 text-micro text-caution">Ads cannot load without a publisher ID.</p>
                )}
              </div>
            </div>
            <div className="mt-5">
              <Field label="Extra ads.txt lines" err={errorFor("adsTxtExtra")} hint="One per line, for other ad or affiliate partners. Your AdSense line is added automatically.">
                <textarea className={`${input} min-h-[5rem] font-mono`} value={site.adsTxtExtra.join("\n")} onChange={(e) => set((s) => ({ ...s, adsTxtExtra: e.target.value.split("\n") }))} />
              </Field>
            </div>
            <h3 className="mt-8 border-t border-rule pt-6 text-small font-bold">Affiliate links</h3>
            <div className="mt-4 space-y-5">
              <Field label="Disclosure" err={errorFor("affiliate.disclosure")} hint="Shown next to any prices with affiliate links. At least 40 characters.">
                <textarea className={`${input} min-h-[5rem]`} value={site.affiliate.disclosure} onChange={(e) => set((s) => ({ ...s, affiliate: { ...s.affiliate, disclosure: e.target.value } }))} />
              </Field>
              <Field label="Programmes you have joined" err={errorFor("affiliate.programmes")} hint="One per line, for example Amazon Associates.">
                <textarea className={`${input} min-h-[4rem]`} value={site.affiliate.programmes.join("\n")} onChange={(e) => set((s) => ({ ...s, affiliate: { ...s.affiliate, programmes: e.target.value.split("\n") } }))} />
              </Field>
            </div>
          </Section>
        )}
      </div>

      <div className="sticky bottom-0 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-rule bg-paper-2 py-4">
        <p className={`text-small ${errors.length ? "text-caution" : "text-ink-2"}`} role="status">
          {message ||
            (dirty
              ? "You have unsaved changes."
              : "Saving updates every page, the sitemap and the share cards straight away.")}
        </p>
        <div className="flex gap-2">
          {dirty && (
            <button type="button" className={btn} onClick={() => { setSite(initial); setErrors([]); setMessage(""); }}>
              Discard changes
            </button>
          )}
          <button
            type="button"
            disabled={saving || !dirty}
            onClick={save}
            className="rounded-lg bg-accent px-5 py-2 text-small font-semibold text-paper hover:bg-accent-2 disabled:opacity-50"
          >
            {saving ? "Saving" : "Save settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  err,
  hint,
  children,
  counter,
}: {
  label: string;
  err?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  counter?: { value: string; min?: number; max?: number };
}) {
  const n = counter?.value.length ?? 0;
  const bad = counter && ((counter.min && n < counter.min) || (counter.max && n > counter.max));
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-small font-semibold">{label}</span>
        {counter && (
          <span className={`num text-micro ${bad ? "text-caution" : "text-ink-3"}`}>
            {n}
            {counter.min && counter.max ? ` (${counter.min} to ${counter.max})` : counter.max ? ` / ${counter.max}` : ""}
          </span>
        )}
      </span>
      {children}
      {hint && <span className="mt-1 block text-micro text-ink-3">{hint}</span>}
      {err && <span className="mt-1 block text-micro text-caution">{err}</span>}
    </label>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <>
      <h2 className="text-base font-bold">{title}</h2>
      <p className="mt-1 text-small text-ink-2">{description}</p>
      <div className="mt-6 border-t border-rule pt-6">{children}</div>
    </>
  );
}

/** The heading at the top of each admin page: title, one line of help, actions. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-h1 font-bold tracking-[-0.025em]">{title}</h1>
        {description && <p className="mt-1.5 max-w-[42rem] text-small text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** A white panel on the grey admin background. */
export function Panel({
  title,
  description,
  children,
  className = "",
}: {
  title?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[14px] border border-rule bg-paper p-5 sm:p-6 ${className}`}>
      {title && <h2 className="text-base font-bold">{title}</h2>}
      {description && <p className="mt-1 text-small text-ink-2">{description}</p>}
      <div className={title || description ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

export const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-small font-semibold text-paper hover:bg-accent-2";
export const btnSecondary =
  "inline-flex items-center gap-2 rounded-lg border border-rule-strong bg-paper px-4 py-2 text-small font-semibold text-ink hover:bg-paper-2";

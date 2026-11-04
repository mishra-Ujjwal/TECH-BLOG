"use client";

import { usePathname } from "next/navigation";

/** The studio has its own chrome; everything else gets the public header and footer. */
function inStudio(pathname: string | null): boolean {
  return Boolean(pathname && (pathname === "/studio" || pathname.startsWith("/studio/")));
}

export function PublicOnly({ children }: { children: React.ReactNode }) {
  return inStudio(usePathname()) ? null : <>{children}</>;
}

/** The main region: padded for public pages, edge to edge in the studio. */
export function MainArea({ children }: { children: React.ReactNode }) {
  const studio = inStudio(usePathname());
  return (
    <main id="main" className={studio ? "flex-1" : "flex-1 py-10 sm:py-14"}>
      {children}
    </main>
  );
}

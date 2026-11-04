"use client";

import { useEffect } from "react";

/** Opens the <details> inside #id when the page is visited or linked with #id. */
export function OpenOnHash({ id }: { id: string }) {
  useEffect(() => {
    const open = () => {
      if (window.location.hash !== `#${id}`) return;
      const el = document.getElementById(id);
      el?.querySelector("details")?.setAttribute("open", "");
      el?.scrollIntoView();
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [id]);
  return null;
}

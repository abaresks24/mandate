"use client";

import { ReactNode } from "react";
import { Reveal } from "./motion";

// Consistent screen header: eyebrow pill, big balanced title, subhead, actions.
export function PageHeader({
  eyebrow,
  title,
  sub,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Reveal>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 pb-2">
        <div className="space-y-3">
          {eyebrow && <div>{eyebrow}</div>}
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white text-balance leading-[1.1]">
            {title}
          </h1>
          {sub && (
            <p className="text-[15px] leading-relaxed text-zinc-400 max-w-2xl text-pretty">
              {sub}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </Reveal>
  );
}

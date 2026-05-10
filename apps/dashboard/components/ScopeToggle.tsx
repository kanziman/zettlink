// 리뷰 보드의 active/all 스코프 링크를 렌더링합니다.
import Link from "next/link";
import React from "react";

import type { FilterState } from "../lib/filter.js";

export function ScopeToggle({ filter }: { filter: FilterState }) {
  return (
    <nav aria-label="Card scope" className="flex rounded-md border border-line-solid bg-background-elevated p-2">
      <ScopeLink filter={filter} label="Active" scope="active" />
      <ScopeLink filter={filter} label="All cards" scope="all" />
    </nav>
  );
}

function ScopeLink({
  filter,
  label,
  scope,
}: {
  filter: FilterState;
  label: string;
  scope: FilterState["scope"];
}) {
  const selected = filter.scope === scope;

  return (
    <Link
      aria-current={selected ? "page" : undefined}
      className={`rounded-sm px-10 py-6 text-label-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        selected
          ? "bg-primary text-inverse-label"
          : "text-label-alternative hover:bg-background-alternative hover:text-label-normal"
      }`}
      href={hrefForFilter({ ...filter, scope })}
    >
      {label}
    </Link>
  );
}

function hrefForFilter(filter: FilterState): string {
  const params = new URLSearchParams();
  params.set("scope", filter.scope);
  if (filter.q.trim()) params.set("q", filter.q.trim());
  if (filter.platform !== "all") params.set("platform", filter.platform);
  if (filter.tags.length > 0) params.set("tags", filter.tags.join(","));
  if (filter.publish !== "all") params.set("publish", filter.publish);
  if (filter.artifact !== "all") params.set("artifact", filter.artifact);
  return `/?${params.toString()}`;
}

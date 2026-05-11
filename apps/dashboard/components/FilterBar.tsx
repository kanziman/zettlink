// 리뷰 보드의 URL 기반 필터 폼을 렌더링합니다.
import React from "react";

import type { FilterState } from "../lib/filter";

export function FilterBar({ filter }: { filter: FilterState }) {
  return (
    <form action="/" className="grid gap-8 md:grid-cols-[minmax(180px,1fr)_120px_136px_132px_minmax(160px,220px)_auto]" method="get">
      <input name="scope" type="hidden" value={filter.scope} />

      <label className="flex min-w-0 flex-col gap-4 text-label-sm text-label-alternative">
        Search
        <input
          className="h-36 min-w-0 rounded-md border border-line-solid bg-background-elevated px-10 text-body-sm text-label-normal outline-none focus:border-primary"
          name="q"
          placeholder="Title, summary, tag"
          type="search"
          defaultValue={filter.q}
        />
      </label>

      <label className="flex min-w-0 flex-col gap-4 text-label-sm text-label-alternative">
        Platform
        <select
          className="h-36 min-w-0 rounded-md border border-line-solid bg-background-elevated px-8 text-body-sm text-label-normal outline-none focus:border-primary"
          name="platform"
          defaultValue={filter.platform}
        >
          <option value="all">All</option>
          <option value="youtube">YouTube</option>
          <option value="github">GitHub</option>
        </select>
      </label>

      <label className="flex min-w-0 flex-col gap-4 text-label-sm text-label-alternative">
        Publish
        <select
          className="h-36 min-w-0 rounded-md border border-line-solid bg-background-elevated px-8 text-body-sm text-label-normal outline-none focus:border-primary"
          name="publish"
          defaultValue={filter.publish}
        >
          <option value="all">All</option>
          <option value="published">Published</option>
          <option value="not_published">Draft</option>
        </select>
      </label>

      <label className="flex min-w-0 flex-col gap-4 text-label-sm text-label-alternative">
        Artifact
        <select
          className="h-36 min-w-0 rounded-md border border-line-solid bg-background-elevated px-8 text-body-sm text-label-normal outline-none focus:border-primary"
          name="artifact"
          defaultValue={filter.artifact}
        >
          <option value="all">All</option>
          <option value="deep">Deep</option>
          <option value="til">TIL</option>
          <option value="guide">Guide</option>
          <option value="none">None</option>
        </select>
      </label>

      <label className="flex min-w-0 flex-col gap-4 text-label-sm text-label-alternative">
        Tags
        <input
          className="h-36 min-w-0 rounded-md border border-line-solid bg-background-elevated px-10 text-body-sm text-label-normal outline-none focus:border-primary"
          name="tags"
          placeholder="ai, systems"
          type="text"
          defaultValue={filter.tags.join(", ")}
        />
      </label>

      <div className="flex items-end">
        <button
          className="h-36 rounded-md bg-label-strong px-12 text-label-sm text-inverse-label transition hover:bg-label-neutral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          type="submit"
        >
          Apply
        </button>
      </div>
    </form>
  );
}

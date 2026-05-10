// 리뷰 보드의 한 컬럼과 카드 목록을 렌더링합니다.
import React from "react";

import type { BoardColumn as BoardColumnName } from "../lib/board";
import type { DashboardCardRow } from "../lib/scan";
import { CardChip } from "./CardChip";

export function BoardColumn({
  column,
  rows,
}: {
  column: BoardColumnName;
  rows: DashboardCardRow[];
}) {
  return (
    <section
      aria-labelledby={`column-${column.toLowerCase().replaceAll(" ", "-")}`}
      className="flex min-h-160 min-w-240 flex-col rounded-md border border-line-solid bg-background p-10"
    >
      <header className="mb-10 flex items-center justify-between gap-8">
        <h2
          className="truncate text-label-md text-label-strong"
          id={`column-${column.toLowerCase().replaceAll(" ", "-")}`}
        >
          {column}
        </h2>
        <span
          aria-label={`${rows.length} cards`}
          className="shrink-0 rounded-sm bg-background-alternative px-6 py-2 text-label-sm text-label-alternative"
        >
          {rows.length}
        </span>
      </header>

      {rows.length > 0 ? (
        <div className="flex flex-col gap-8">
          {rows.map((row) => (
            <CardChip key={row.frontmatter.slug} row={row} />
          ))}
        </div>
      ) : (
        <div className="flex min-h-96 items-center justify-center rounded-md border border-dashed border-line-normal px-10 py-16 text-center text-label-sm text-label-alternative">
          No cards
        </div>
      )}
    </section>
  );
}

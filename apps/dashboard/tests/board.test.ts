// 칸반 보드 컬럼 우선순위를 검증합니다.
import { strict as assert } from "node:assert";
import test from "node:test";

import {
  computeColumn,
  type ArtifactSnapshot,
  type CardSnapshot,
} from "../lib/board.ts";

type CardOverrides = Partial<Omit<CardSnapshot, "artifacts">> & {
  artifacts?: Partial<Record<keyof CardSnapshot["artifacts"], ArtifactSnapshot>>;
};

function card(overrides: CardOverrides = {}): CardSnapshot {
  return {
    reviewed: true,
    index_published: false,
    ...overrides,
    artifacts: {
      deep: {
        exists: false,
        published: false,
        ...overrides.artifacts?.deep,
      },
      til: {
        exists: false,
        published: false,
        ...overrides.artifacts?.til,
      },
      guide: {
        exists: false,
        published: false,
        ...overrides.artifacts?.guide,
      },
    },
  };
}

test("puts index-published cards in Published", () => {
  assert.equal(computeColumn(card({ index_published: true })), "Published");
});

test("puts cards with any published artifact in Published", () => {
  assert.equal(
    computeColumn(card({ artifacts: { deep: { exists: false, published: true } } })),
    "Published",
  );
  assert.equal(
    computeColumn(card({ artifacts: { til: { exists: false, published: true } } })),
    "Published",
  );
  assert.equal(
    computeColumn(card({ artifacts: { guide: { exists: false, published: true } } })),
    "Published",
  );
});

test("puts unreviewed cards in Needs review", () => {
  assert.equal(computeColumn(card({ reviewed: false })), "Needs review");
});

test("puts unreviewed cards with an unpublished TIL in Needs review", () => {
  assert.equal(
    computeColumn(
      card({
        reviewed: false,
        artifacts: { til: { exists: true, published: false } },
      }),
    ),
    "Needs review",
  );
});

test("puts unreviewed cards with an unpublished deep artifact in Needs review", () => {
  assert.equal(
    computeColumn(
      card({
        reviewed: false,
        artifacts: { deep: { exists: true, published: false } },
      }),
    ),
    "Needs review",
  );
});

test("puts reviewed cards with an existing TIL in TIL ready", () => {
  assert.equal(
    computeColumn(card({ artifacts: { til: { exists: true, published: false } } })),
    "TIL ready",
  );
});

test("puts reviewed cards with only an existing deep artifact in Deep done", () => {
  assert.equal(
    computeColumn(card({ artifacts: { deep: { exists: true, published: false } } })),
    "Deep done",
  );
});

test("leaves reviewed cards with no artifacts or published state out of active columns", () => {
  assert.equal(computeColumn(card()), null);
});

test("leaves reviewed cards with only an existing guide out of active columns", () => {
  assert.equal(
    computeColumn(card({ artifacts: { guide: { exists: true, published: false } } })),
    null,
  );
});

test("applies priority ordering for published before review and TIL before deep", () => {
  assert.equal(
    computeColumn(
      card({
        reviewed: false,
        artifacts: { til: { exists: true, published: true } },
      }),
    ),
    "Published",
  );
  assert.equal(
    computeColumn(
      card({
        artifacts: {
          deep: { exists: true, published: false },
          til: { exists: true, published: false },
        },
      }),
    ),
    "TIL ready",
  );
});

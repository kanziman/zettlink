// 칸반 보드 컬럼 우선순위를 검증합니다.
import { expect, test } from "vitest";

import {
  computeColumn,
  type ArtifactSnapshot,
  type CardSnapshot,
} from "../lib/board.js";

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
  expect(computeColumn(card({ index_published: true }))).toBe("Published");
});

test("puts cards with any published artifact in Published", () => {
  expect(
    computeColumn(card({ artifacts: { deep: { exists: false, published: true } } })),
  ).toBe("Published");
  expect(
    computeColumn(card({ artifacts: { til: { exists: false, published: true } } })),
  ).toBe("Published");
  expect(
    computeColumn(card({ artifacts: { guide: { exists: false, published: true } } })),
  ).toBe("Published");
});

test("puts unreviewed cards in Needs review", () => {
  expect(computeColumn(card({ reviewed: false }))).toBe("Needs review");
});

test("puts unreviewed cards with an unpublished TIL in Needs review", () => {
  expect(
    computeColumn(
      card({
        reviewed: false,
        artifacts: { til: { exists: true, published: false } },
      }),
    ),
  ).toBe("Needs review");
});

test("puts unreviewed cards with an unpublished deep artifact in Needs review", () => {
  expect(
    computeColumn(
      card({
        reviewed: false,
        artifacts: { deep: { exists: true, published: false } },
      }),
    ),
  ).toBe("Needs review");
});

test("puts reviewed cards with an existing TIL in TIL ready", () => {
  expect(
    computeColumn(card({ artifacts: { til: { exists: true, published: false } } })),
  ).toBe("TIL ready");
});

test("puts reviewed cards with only an existing deep artifact in Deep done", () => {
  expect(
    computeColumn(card({ artifacts: { deep: { exists: true, published: false } } })),
  ).toBe("Deep done");
});

test("leaves reviewed cards with no artifacts or published state out of active columns", () => {
  expect(computeColumn(card())).toBeNull();
});

test("leaves reviewed cards with only an existing guide out of active columns", () => {
  expect(
    computeColumn(card({ artifacts: { guide: { exists: true, published: false } } })),
  ).toBeNull();
});

test("applies priority ordering for published before review and TIL before deep", () => {
  expect(
    computeColumn(
      card({
        reviewed: false,
        artifacts: { til: { exists: true, published: true } },
      }),
    ),
  ).toBe("Published");
  expect(
    computeColumn(
      card({
        artifacts: {
          deep: { exists: true, published: false },
          til: { exists: true, published: false },
        },
      }),
    ),
  ).toBe("TIL ready");
});

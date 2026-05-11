// 칸반 보드 컬럼 배치를 계산합니다.
export type BoardColumn = "Published" | "Needs review" | "TIL ready" | "Deep done";

export type ArtifactSnapshot = {
  exists: boolean;
  published: boolean;
};

export type CardSnapshot = {
  reviewed: boolean;
  index_published: boolean;
  artifacts: {
    deep: ArtifactSnapshot;
    til: ArtifactSnapshot;
    guide: ArtifactSnapshot;
  };
};

export function computeColumn(card: CardSnapshot): BoardColumn | null {
  if (
    card.index_published ||
    card.artifacts.deep.published ||
    card.artifacts.til.published ||
    card.artifacts.guide.published
  ) {
    return "Published";
  }

  if (!card.reviewed) {
    return "Needs review";
  }

  if (card.artifacts.til.exists) {
    return "TIL ready";
  }

  if (card.artifacts.deep.exists) {
    return "Deep done";
  }

  return null;
}

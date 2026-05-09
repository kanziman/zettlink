// 카드 폴더명에 사용할 영문 slug 를 만든다. 한글 변환 라이브러리는 의도적으로 사용하지 않는다.

export function youtubeTitleSlug(title: string): string {
  const ascii = title
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]+/g, ' ')   // 비ASCII 제거 (한글 등)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return ascii || 'untitled';
}

export function githubSlug(owner: string, repo: string): string {
  return `${owner.toLowerCase()}-${repo.toLowerCase()}`;
}

export function datedFolder(dateYmd: string, slug: string): string {
  return `${dateYmd}-${slug}`;
}

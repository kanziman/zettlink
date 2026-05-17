// 영어 제목과 GitHub repo ID를 URL-safe kebab-case slug로 변환하는 유틸리티

export function titleToSlug(title: string): string {
  let slug = title.toLowerCase()
  // 영숫자·하이픈·공백만 유지 (한글, 이모지, 특수문자 제거)
  slug = slug.replace(/[^a-z0-9\- ]/g, '')
  // 공백 → 하이픈
  slug = slug.replace(/ +/g, '-')
  // 연속 하이픈 → 단일 하이픈
  slug = slug.replace(/-+/g, '-')
  // 앞뒤 하이픈 제거
  slug = slug.replace(/^-+|-+$/g, '')

  if (slug.length > 80) {
    const truncated = slug.slice(0, 80)
    const lastHyphen = truncated.lastIndexOf('-')
    slug = lastHyphen > 0 ? truncated.slice(0, lastHyphen) : truncated
    slug = slug.replace(/-+$/g, '')
  }

  return slug || 'untitled'
}

export function repoToSlug(externalId: string): string {
  return externalId.replace(/[/.]/g, '-')
}

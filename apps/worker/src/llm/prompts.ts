// YouTube/GitHub 추출 결과를 LLM 프롬프트로 변환하는 빌더
import type { YoutubeExtract } from '../extractors/youtube.js'
import type { GithubExtract } from '../extractors/github.js'

export function buildPrompt(
  extract: YoutubeExtract | GithubExtract,
  platform: 'youtube' | 'github',
): string {
  if (platform === 'youtube') {
    const yt = extract as YoutubeExtract
    return [
      '당신은 기술 콘텐츠 큐레이터입니다.',
      '아래 YouTube 영상의 자막과 메타데이터를 분석해 save_summary 도구를 호출하세요.',
      '',
      `제목: ${yt.title}`,
      `설명: ${yt.description.slice(0, 500)}`,
      `자막 (일부): ${yt.transcript.slice(0, 8000)}`,
    ].join('\n')
  }

  const gh = extract as GithubExtract
  return [
    '당신은 기술 콘텐츠 큐레이터입니다.',
    '아래 GitHub 저장소를 분석해 save_summary 도구를 호출하세요.',
    '',
    `이름: ${gh.fullName}`,
    `설명: ${gh.description ?? '없음'}`,
    `주요 언어: ${gh.language ?? '없음'}`,
    `토픽: ${gh.topics.join(', ') || '없음'}`,
    `README: ${gh.readme.slice(0, 8000)}`,
  ].join('\n')
}

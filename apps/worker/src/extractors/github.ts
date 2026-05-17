// GitHub 저장소 메타데이터와 README를 GitHub REST API로 추출하는 extractor
import { config } from '@zettlink/shared'

export interface GithubExtract {
  owner: string
  repo: string
  fullName: string
  description: string | null
  stars: number
  forks: number
  language: string | null
  topics: string[]
  readme: string
  rawMetadata: Record<string, unknown>
}

export async function extractGithub(externalId: string): Promise<GithubExtract> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'zettlink/1.0',
  }
  if (config.github.token) {
    headers['Authorization'] = `Bearer ${config.github.token}`
  }

  const repoRes = await fetch(`https://api.github.com/repos/${externalId}`, { headers })
  if (!repoRes.ok) {
    if (repoRes.status === 404) throw new Error('repository not found or private')
    throw new Error(`GitHub API error: ${repoRes.status}`)
  }
  const repoData = (await repoRes.json()) as Record<string, unknown>

  const readmeRes = await fetch(`https://api.github.com/repos/${externalId}/readme`, { headers })
  let readme = ''
  if (readmeRes.ok) {
    const readmeData = (await readmeRes.json()) as { content: string }
    readme = Buffer.from(readmeData.content, 'base64').toString('utf-8')
  }
  if (readme.length > 32_000) readme = readme.slice(0, 32_000) + '\n[truncated]'

  const topicsRes = await fetch(`https://api.github.com/repos/${externalId}/topics`, {
    headers: { ...headers, 'Accept': 'application/vnd.github.mercy-preview+json' },
  })
  const topics: string[] = topicsRes.ok ? ((await topicsRes.json()) as { names?: string[] }).names ?? [] : []

  const [owner, repo] = externalId.split('/')

  return {
    owner,
    repo,
    fullName: externalId,
    description: (repoData['description'] as string | null) ?? null,
    stars: Number(repoData['stargazers_count'] ?? 0),
    forks: Number(repoData['forks_count'] ?? 0),
    language: (repoData['language'] as string | null) ?? null,
    topics,
    readme,
    rawMetadata: repoData,
  }
}

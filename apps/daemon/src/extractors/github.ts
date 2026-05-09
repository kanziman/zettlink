// octokit 으로 README + depth-2 디렉토리 트리 + 메타데이터를 받아 extract.md 본문을 만든다.
import type { Octokit } from '@octokit/rest';

export interface GithubMeta {
  owner: string;
  repo: string;
  stars: number;
  primary_language: string;
  topics: string[];
}

export interface GithubExtraction {
  meta: GithubMeta;
  extract: string;
}

export async function extractGithub(octokit: Octokit, owner: string, repo: string): Promise<GithubExtraction> {
  const repoInfo = await octokit.repos.get({ owner, repo });
  const readme = await octokit.repos.getReadme({ owner, repo });
  const readmeText = Buffer.from((readme.data as any).content, 'base64').toString('utf8');

  const root = await octokit.repos.getContent({ owner, repo, path: '' });
  const lines: string[] = ['# 디렉토리 트리 (depth 2)', ''];
  for (const entry of root.data as Array<{ type: string; path: string }>) {
    if (entry.type === 'dir') {
      lines.push(`${entry.path}/`);
      const sub = await octokit.repos.getContent({ owner, repo, path: entry.path });
      for (const c of sub.data as Array<{ path: string }>) {
        lines.push(`  ${c.path}`);
      }
    } else {
      lines.push(entry.path);
    }
  }
  return {
    meta: {
      owner,
      repo,
      stars: repoInfo.data.stargazers_count ?? 0,
      primary_language: repoInfo.data.language ?? '',
      topics: repoInfo.data.topics ?? [],
    },
    extract: `# README\n\n${readmeText}\n\n${lines.join('\n')}\n`,
  };
}

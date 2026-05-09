// Git 저장소에 카드를 commit하고 push하는 재시도 헬퍼.
import simpleGit, { type SimpleGit } from 'simple-git';

export function openRepo(path: string): SimpleGit {
  return simpleGit(path);
}

export async function commitAndPushWithRetry(
  git: SimpleGit,
  files: string[],
  message: string,
  options: { delayMs?: number } = {},
): Promise<void> {
  await git.add(files);
  await git.commit(message);
  const delay = options.delayMs ?? 5000;
  let lastErr: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      await git.push();
      return;
    } catch (e) {
      lastErr = e;
      if (i < 2) await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(`git push 3 회 시도 실패. ${(lastErr as Error)?.message ?? lastErr}`);
}

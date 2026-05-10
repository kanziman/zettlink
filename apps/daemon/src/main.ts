// Telegram 데몬의 부트스트랩.
import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
loadDotenv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

import { Octokit } from '@octokit/rest';
import OpenAI from 'openai';
import { Telegraf } from 'telegraf';
import { loadConfig, openRepo, runAutoSummary as runAutoSummaryCore } from '@zettlink/core';
import { handleMessage } from './handler.js';
import { processUrl } from './pipeline.js';
import { extractYoutube } from './extractors/youtube.js';
import { extractGithub } from './extractors/github.js';
import { whisperTranscribe } from './extractors/youtube-whisper.js';

const cfg = loadConfig(process.env);
const llmClient = new OpenAI({
  apiKey: cfg.openrouterApiKey,
  baseURL: 'https://openrouter.ai/api/v1',
});
const whisperClient = cfg.openaiApiKey ? new OpenAI({ apiKey: cfg.openaiApiKey }) : undefined;
const octokit = new Octokit({ auth: cfg.githubToken });
const git = openRepo(cfg.repoLocalPath);

const pipelineDeps = {
  repoLocalPath: cfg.repoLocalPath,
  extractYoutube,
  extractGithub: (owner: string, repo: string) => extractGithub(octokit, owner, repo),
  whisperTranscribe: whisperClient
    ? (url: string, workDir: string) => whisperTranscribe(url, workDir, whisperClient)
    : undefined,
  runAutoSummary: (input: { transcript: string; tagHints: string; truncated: boolean; modelId: string }) =>
    runAutoSummaryCore(llmClient, input),
  git,
  now: () => new Date(),
  modelId: cfg.openrouterModel,
};

const bot = new Telegraf(cfg.telegram.token);
bot.on('message', async (ctx) => {
  await handleMessage(ctx, { allowedUserId: cfg.telegram.userId, processUrl, pipelineDeps });
});
bot.launch();
console.log(`[daemon] Telegram long polling 시작. model=${cfg.openrouterModel}`);
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

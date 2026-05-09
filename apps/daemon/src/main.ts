// Telegram 데몬의 부트스트랩.
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
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
const anthropic = new Anthropic({ apiKey: cfg.anthropicApiKey });
const openai = cfg.openaiApiKey ? new OpenAI({ apiKey: cfg.openaiApiKey }) : undefined;
const octokit = new Octokit({ auth: cfg.githubToken });
const git = openRepo(cfg.repoLocalPath);

const pipelineDeps = {
  repoLocalPath: cfg.repoLocalPath,
  extractYoutube,
  extractGithub: (owner: string, repo: string) => extractGithub(octokit, owner, repo),
  whisperTranscribe: openai
    ? (url: string, workDir: string) => whisperTranscribe(url, workDir, openai)
    : undefined,
  runAutoSummary: (input: { transcript: string; tagHints: string; truncated: boolean; modelId: string }) =>
    runAutoSummaryCore(anthropic, input),
  git,
  now: () => new Date(),
  modelId: 'claude-sonnet-4-6',
};

const bot = new Telegraf(cfg.telegram.botToken);
bot.on('message', async (ctx) => {
  await handleMessage(ctx, { allowedUserId: cfg.telegram.userId, processUrl, pipelineDeps });
});
bot.launch();
console.log(`[daemon] Telegram long polling 시작.`);
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

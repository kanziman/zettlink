import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';

const baseEnv = {
  ANTHROPIC_API_KEY: 'sk-ant-x',
  TELEGRAM_BOT_TOKEN: 'token',
  TELEGRAM_USER_ID: '12345',
  GITHUB_TOKEN: 'ghp_x',
  REPO_LOCAL_PATH: '/tmp/zettlink',
  CLOUDFLARE_DEPLOY_HOOK_URL: 'https://api.cloudflare.com/x',
};

describe('loadConfig', () => {
  it('필수 키가 모두 있으면 정상 객체를 반환한다', () => {
    const cfg = loadConfig(baseEnv);
    expect(cfg.telegram.userId).toBe(12345);
    expect(cfg.openaiApiKey).toBeUndefined();
  });

  it('필수 키가 빠지면 throw 한다', () => {
    const env = { ...baseEnv, TELEGRAM_BOT_TOKEN: '' };
    expect(() => loadConfig(env)).toThrow(/TELEGRAM_BOT_TOKEN/);
  });

  it('TELEGRAM_USER_ID가 정수가 아니면 throw 한다', () => {
    const env = { ...baseEnv, TELEGRAM_USER_ID: 'abc' };
    expect(() => loadConfig(env)).toThrow(/TELEGRAM_USER_ID/);
  });

  it('OPENAI_API_KEY는 선택값이며 없으면 undefined 다', () => {
    expect(loadConfig(baseEnv).openaiApiKey).toBeUndefined();
    expect(loadConfig({ ...baseEnv, OPENAI_API_KEY: 'sk-x' }).openaiApiKey).toBe('sk-x');
  });
});

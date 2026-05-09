// Telegram 데몬의 부트스트랩. 환경변수 검증 후 Telegraf long polling 을 시작한다.
import { loadConfig } from '@zettlink/core';

const cfg = loadConfig(process.env);
console.log(`[daemon] 시작. user_id=${cfg.telegram.userId}`);

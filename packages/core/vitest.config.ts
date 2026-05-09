// 공유 패키지 단위 테스트 설정.
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { globals: false, environment: 'node' } });

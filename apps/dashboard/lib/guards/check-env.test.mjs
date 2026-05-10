// 프로덕션 대시보드 빌드 가드를 검증합니다.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const guardPath = join(dirname(fileURLToPath(import.meta.url)), "check-env.mjs");

test("blocks production dashboard builds by default", () => {
  const result = spawnSync(process.execPath, [guardPath], {
    env: { ...process.env, ALLOW_PROD_DASHBOARD_BUILD: "" },
    encoding: "utf8",
  });

  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/프로덕션 대시보드 빌드가 차단되었습니다/);
});

test("allows production dashboard builds when explicitly enabled", () => {
  const result = spawnSync(process.execPath, [guardPath], {
    env: { ...process.env, ALLOW_PROD_DASHBOARD_BUILD: "1" },
    encoding: "utf8",
  });

  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
});

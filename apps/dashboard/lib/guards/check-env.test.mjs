// 프로덕션 대시보드 빌드 가드를 검증합니다.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const guardPath = join(dirname(fileURLToPath(import.meta.url)), "check-env.mjs");

test("blocks production dashboard builds by default", () => {
  const result = spawnSync(process.execPath, [guardPath], {
    env: { ...process.env, ALLOW_PROD_DASHBOARD_BUILD: "" },
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /프로덕션 대시보드 빌드가 차단되었습니다/);
});

test("allows production dashboard builds when explicitly enabled", () => {
  const result = spawnSync(process.execPath, [guardPath], {
    env: { ...process.env, ALLOW_PROD_DASHBOARD_BUILD: "1" },
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
});

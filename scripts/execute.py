#!/usr/bin/env python3
"""
Harness Step Executor — phase 내 step을 순차 실행하고 자가 교정한다.

Usage:
    python3 scripts/execute.py <phase-dir> [--push]
"""

import argparse
import contextlib
import json
import os
import subprocess
import sys
import threading
import time
import types
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent


@contextlib.contextmanager
def progress_indicator(label: str):
    """터미널 진행 표시기. with 문으로 사용하며 .elapsed 로 경과 시간을 읽는다."""
    frames = "◐◓◑◒"
    stop = threading.Event()
    t0 = time.monotonic()

    def _animate():
        idx = 0
        while not stop.wait(0.12):
            sec = int(time.monotonic() - t0)
            sys.stderr.write(f"\r{frames[idx % len(frames)]} {label} [{sec}s]")
            sys.stderr.flush()
            idx += 1
        sys.stderr.write("\r" + " " * (len(label) + 20) + "\r")
        sys.stderr.flush()

    th = threading.Thread(target=_animate, daemon=True)
    th.start()
    info = types.SimpleNamespace(elapsed=0.0)
    try:
        yield info
    finally:
        stop.set()
        th.join()
        info.elapsed = time.monotonic() - t0


class StepExecutor:
    """Phase 디렉토리 안의 step들을 순차 실행하는 하네스."""

    MAX_RETRIES = 3
    REVIEWER_MAX_RETRIES = 3
    FEAT_MSG = "feat({phase}): step {num} — {name}"
    CHORE_MSG = "chore({phase}): step {num} output"
    TZ = timezone(timedelta(hours=9))

    # 기본 게이트 기준 — index.json의 workflow.gate1_criteria / gate2_criteria로 오버라이드 가능
    DEFAULT_GATE1_CRITERIA = (
        "1. 플랜이 Phase 체크리스트의 모든 항목을 커버하는가?\n"
        "2. CLAUDE.md의 CRITICAL 규칙과 충돌하는 계획이 있는가?\n"
        "3. 각 step의 검증 방법(AC)이 명시되어 있는가?\n"
        "4. 생성될 파일 목록이 프로젝트 아키텍처와 일치하는가?"
    )
    DEFAULT_GATE2_CRITERIA = (
        "1. CLAUDE.md의 CRITICAL 규칙이 모두 준수되었는가?\n"
        "2. 단위 테스트가 명시된 모듈에 대해 작성되었는가?\n"
        "3. 커밋 메시지가 Conventional Commits 형식을 준수하는가?\n"
        "4. 기존 마이그레이션/설정 파일이 무단 수정되지 않았는가?"
    )

    def __init__(self, phase_dir_name: str, *, auto_push: bool = False):
        self._root = str(ROOT)
        self._phases_dir = ROOT / "phases"
        self._phase_dir = self._phases_dir / phase_dir_name
        self._phase_dir_name = phase_dir_name
        self._top_index_file = self._phases_dir / "index.json"
        self._auto_push = auto_push

        if not self._phase_dir.is_dir():
            print(f"ERROR: {self._phase_dir} not found")
            sys.exit(1)

        self._index_file = self._phase_dir / "index.json"
        if not self._index_file.exists():
            print(f"ERROR: {self._index_file} not found")
            sys.exit(1)

        idx = self._read_json(self._index_file)
        self._project = idx.get("project", "project")
        self._phase_name = idx.get("phase", phase_dir_name)
        self._total = len(idx["steps"])
        workflow = idx.get("workflow", {})
        self._gates_enabled = workflow.get("gates", False)
        self._gate1_criteria = workflow.get("gate1_criteria", self.DEFAULT_GATE1_CRITERIA)
        self._gate2_criteria = workflow.get("gate2_criteria", self.DEFAULT_GATE2_CRITERIA)

    def run(self):
        self._print_header()
        self._check_blockers()
        self._checkout_branch()
        guardrails = self._load_guardrails()
        self._ensure_created_at()

        if self._gates_enabled:
            # Gate 1: PO가 플랜 작성 → Reviewer 승인 (docs/AGENT_WORKFLOW.md)
            self._run_plan_phase(guardrails)
            self._run_gate(1, self._gate1_criteria, "플랜 승인", guardrails)

        self._execute_all_steps(guardrails)

        if self._gates_enabled:
            # Gate 2: Reviewer가 구현 결과 검토 (docs/AGENT_WORKFLOW.md)
            self._run_gate(2, self._gate2_criteria, "구현 결과 검토", guardrails)

        self._finalize()

    # --- timestamps ---

    def _stamp(self) -> str:
        return datetime.now(self.TZ).strftime("%Y-%m-%dT%H:%M:%S%z")

    # --- JSON I/O ---

    @staticmethod
    def _read_json(p: Path) -> dict:
        return json.loads(p.read_text(encoding="utf-8"))

    @staticmethod
    def _write_json(p: Path, data: dict):
        p.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    # --- git ---

    def _run_git(self, *args) -> subprocess.CompletedProcess:
        cmd = ["git"] + list(args)
        return subprocess.run(cmd, cwd=self._root, capture_output=True, text=True)

    def _checkout_branch(self):
        branch = f"feat-{self._phase_name}"

        r = self._run_git("rev-parse", "--abbrev-ref", "HEAD")
        if r.returncode != 0:
            print(f"  ERROR: git을 사용할 수 없거나 git repo가 아닙니다.")
            print(f"  {r.stderr.strip()}")
            sys.exit(1)

        if r.stdout.strip() == branch:
            return

        r = self._run_git("rev-parse", "--verify", branch)
        r = self._run_git("checkout", branch) if r.returncode == 0 else self._run_git("checkout", "-b", branch)

        if r.returncode != 0:
            print(f"  ERROR: 브랜치 '{branch}' checkout 실패.")
            print(f"  {r.stderr.strip()}")
            print(f"  Hint: 변경사항을 stash하거나 commit한 후 다시 시도하세요.")
            sys.exit(1)

        print(f"  Branch: {branch}")

    def _commit_step(self, step_num: int, step_name: str):
        output_rel = f"phases/{self._phase_dir_name}/step{step_num}-output.json"
        index_rel = f"phases/{self._phase_dir_name}/index.json"

        self._run_git("add", "-A")
        self._run_git("reset", "HEAD", "--", output_rel)
        self._run_git("reset", "HEAD", "--", index_rel)

        if self._run_git("diff", "--cached", "--quiet").returncode != 0:
            msg = self.FEAT_MSG.format(phase=self._phase_name, num=step_num, name=step_name)
            r = self._run_git("commit", "-m", msg)
            if r.returncode == 0:
                print(f"  Commit: {msg}")
            else:
                print(f"  WARN: 코드 커밋 실패: {r.stderr.strip()}")

        self._run_git("add", "-A")
        if self._run_git("diff", "--cached", "--quiet").returncode != 0:
            msg = self.CHORE_MSG.format(phase=self._phase_name, num=step_num)
            r = self._run_git("commit", "-m", msg)
            if r.returncode != 0:
                print(f"  WARN: housekeeping 커밋 실패: {r.stderr.strip()}")

    # --- top-level index ---

    def _update_top_index(self, status: str):
        if not self._top_index_file.exists():
            return
        top = self._read_json(self._top_index_file)
        ts = self._stamp()
        for phase in top.get("phases", []):
            if phase.get("dir") == self._phase_dir_name:
                phase["status"] = status
                ts_key = {"completed": "completed_at", "error": "failed_at", "blocked": "blocked_at"}.get(status)
                if ts_key:
                    phase[ts_key] = ts
                break
        self._write_json(self._top_index_file, top)

    # --- guardrails & context ---

    def _load_guardrails(self) -> str:
        sections = []
        claude_md = ROOT / "CLAUDE.md"
        if claude_md.exists():
            sections.append(f"## 프로젝트 규칙 (CLAUDE.md)\n\n{claude_md.read_text()}")
        docs_dir = ROOT / "docs"
        if docs_dir.is_dir():
            for doc in sorted(docs_dir.glob("*.md")):
                sections.append(f"## {doc.stem}\n\n{doc.read_text()}")
        return "\n\n---\n\n".join(sections) if sections else ""

    @staticmethod
    def _build_step_context(index: dict) -> str:
        lines = [
            f"- Step {s['step']} ({s['name']}): {s['summary']}"
            for s in index["steps"]
            if s["status"] == "completed" and s.get("summary")
        ]
        if not lines:
            return ""
        return "## 이전 Step 산출물\n\n" + "\n".join(lines) + "\n\n"

    def _build_preamble(self, guardrails: str, step_context: str,
                        prev_error: Optional[str] = None) -> str:
        commit_example = self.FEAT_MSG.format(
            phase=self._phase_name, num="N", name="<step-name>"
        )
        retry_section = ""
        if prev_error:
            retry_section = (
                f"\n## ⚠ 이전 시도 실패 — 아래 에러를 반드시 참고하여 수정하라\n\n"
                f"{prev_error}\n\n---\n\n"
            )
        return (
            f"당신은 {self._project} 프로젝트의 개발자입니다. 아래 step을 수행하세요.\n\n"
            f"{guardrails}\n\n---\n\n"
            f"{step_context}{retry_section}"
            f"## 작업 규칙\n\n"
            f"1. 이전 step에서 작성된 코드를 확인하고 일관성을 유지하라.\n"
            f"2. 이 step에 명시된 작업만 수행하라. 추가 기능이나 파일을 만들지 마라.\n"
            f"3. 기존 테스트를 깨뜨리지 마라.\n"
            f"4. AC(Acceptance Criteria) 검증을 직접 실행하라.\n"
            f"5. React 컴포넌트·훅·페이지를 생성하거나 수정할 때 반드시 /react-best-practices 스킬을 먼저 호출하라.\n"
            f"6. /phases/{self._phase_dir_name}/index.json의 해당 step status를 업데이트하라:\n"
            f"   - AC 통과 → \"completed\" + \"summary\" 필드에 이 step의 산출물을 한 줄로 요약\n"
            f"   - {self.MAX_RETRIES}회 수정 시도 후에도 실패 → \"error\" + \"error_message\" 기록\n"
            f"   - 사용자 개입이 필요한 경우 (API 키, 인증, 수동 설정 등) → \"blocked\" + \"blocked_reason\" 기록 후 즉시 중단\n"
            f"7. 모든 변경사항을 커밋하라:\n"
            f"   {commit_example}\n\n---\n\n"
        )

    # --- Claude 호출 ---

    def _invoke_claude(self, step: dict, preamble: str) -> dict:
        step_num, step_name = step["step"], step["name"]
        step_file = self._phase_dir / f"step{step_num}.md"

        if not step_file.exists():
            print(f"  ERROR: {step_file} not found")
            sys.exit(1)

        prompt = preamble + step_file.read_text()
        result = subprocess.run(
            ["claude", "-p", "--dangerously-skip-permissions", "--output-format", "json", prompt],
            cwd=self._root, capture_output=True, text=True, timeout=1800,
        )

        if result.returncode != 0:
            print(f"\n  WARN: Claude가 비정상 종료됨 (code {result.returncode})")
            if result.stderr:
                print(f"  stderr: {result.stderr[:500]}")

        output = {
            "step": step_num, "name": step_name,
            "exitCode": result.returncode,
            "stdout": result.stdout, "stderr": result.stderr,
        }
        out_path = self._phase_dir / f"step{step_num}-output.json"
        with open(out_path, "w") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        return output

    # --- 헤더 & 검증 ---

    def _print_header(self):
        print(f"\n{'='*60}")
        print(f"  Harness Step Executor")
        print(f"  Phase: {self._phase_name} | Steps: {self._total}")
        if self._gates_enabled:
            print(f"  Workflow: PO + Reviewer (Gate 1 + Gate 2)")
        if self._auto_push:
            print(f"  Auto-push: enabled")
        print(f"{'='*60}")

    def _check_blockers(self):
        index = self._read_json(self._index_file)
        for s in reversed(index["steps"]):
            if s["status"] == "error":
                print(f"\n  ✗ Step {s['step']} ({s['name']}) failed.")
                print(f"  Error: {s.get('error_message', 'unknown')}")
                print(f"  Fix and reset status to 'pending' to retry.")
                sys.exit(1)
            if s["status"] == "blocked":
                print(f"\n  ⏸ Step {s['step']} ({s['name']}) blocked.")
                print(f"  Reason: {s.get('blocked_reason', 'unknown')}")
                print(f"  Resolve and reset status to 'pending' to retry.")
                sys.exit(2)
            if s["status"] != "pending":
                break

    def _ensure_created_at(self):
        index = self._read_json(self._index_file)
        if "created_at" not in index:
            index["created_at"] = self._stamp()
            self._write_json(self._index_file, index)

    # --- 실행 루프 ---

    def _execute_single_step(self, step: dict, guardrails: str) -> bool:
        """단일 step 실행 (재시도 포함). 완료되면 True, 실패/차단이면 False."""
        step_num, step_name = step["step"], step["name"]
        done = sum(1 for s in self._read_json(self._index_file)["steps"] if s["status"] == "completed")
        prev_error = None

        for attempt in range(1, self.MAX_RETRIES + 1):
            index = self._read_json(self._index_file)
            step_context = self._build_step_context(index)
            preamble = self._build_preamble(guardrails, step_context, prev_error)

            tag = f"Step {step_num}/{self._total - 1} ({done} done): {step_name}"
            if attempt > 1:
                tag += f" [retry {attempt}/{self.MAX_RETRIES}]"

            with progress_indicator(tag) as pi:
                self._invoke_claude(step, preamble)
                elapsed = int(pi.elapsed)

            index = self._read_json(self._index_file)
            status = next((s.get("status", "pending") for s in index["steps"] if s["step"] == step_num), "pending")
            ts = self._stamp()

            if status == "completed":
                for s in index["steps"]:
                    if s["step"] == step_num:
                        s["completed_at"] = ts
                self._write_json(self._index_file, index)
                self._commit_step(step_num, step_name)
                print(f"  ✓ Step {step_num}: {step_name} [{elapsed}s]")
                return True

            if status == "blocked":
                for s in index["steps"]:
                    if s["step"] == step_num:
                        s["blocked_at"] = ts
                self._write_json(self._index_file, index)
                reason = next((s.get("blocked_reason", "") for s in index["steps"] if s["step"] == step_num), "")
                print(f"  ⏸ Step {step_num}: {step_name} blocked [{elapsed}s]")
                print(f"    Reason: {reason}")
                self._update_top_index("blocked")
                sys.exit(2)

            err_msg = next(
                (s.get("error_message", "Step did not update status") for s in index["steps"] if s["step"] == step_num),
                "Step did not update status",
            )

            if attempt < self.MAX_RETRIES:
                for s in index["steps"]:
                    if s["step"] == step_num:
                        s["status"] = "pending"
                        s.pop("error_message", None)
                self._write_json(self._index_file, index)
                prev_error = err_msg
                print(f"  ↻ Step {step_num}: retry {attempt}/{self.MAX_RETRIES} — {err_msg}")
            else:
                for s in index["steps"]:
                    if s["step"] == step_num:
                        s["status"] = "error"
                        s["error_message"] = f"[{self.MAX_RETRIES}회 시도 후 실패] {err_msg}"
                        s["failed_at"] = ts
                self._write_json(self._index_file, index)
                self._commit_step(step_num, step_name)
                print(f"  ✗ Step {step_num}: {step_name} failed after {self.MAX_RETRIES} attempts [{elapsed}s]")
                print(f"    Error: {err_msg}")
                self._update_top_index("error")
                sys.exit(1)

        return False  # unreachable

    def _execute_all_steps(self, guardrails: str):
        while True:
            index = self._read_json(self._index_file)
            pending = next((s for s in index["steps"] if s["status"] == "pending"), None)
            if pending is None:
                print("\n  All steps completed!")
                return

            step_num = pending["step"]
            for s in index["steps"]:
                if s["step"] == step_num and "started_at" not in s:
                    s["started_at"] = self._stamp()
                    self._write_json(self._index_file, index)
                    break

            self._execute_single_step(pending, guardrails)

    def _finalize(self):
        index = self._read_json(self._index_file)
        index["completed_at"] = self._stamp()
        self._write_json(self._index_file, index)
        self._update_top_index("completed")

        self._run_git("add", "-A")
        if self._run_git("diff", "--cached", "--quiet").returncode != 0:
            msg = f"chore({self._phase_name}): mark phase completed"
            r = self._run_git("commit", "-m", msg)
            if r.returncode == 0:
                print(f"  ✓ {msg}")

        if self._auto_push:
            branch = f"feat-{self._phase_name}"
            r = self._run_git("push", "-u", "origin", branch)
            if r.returncode != 0:
                print(f"\n  ERROR: git push 실패: {r.stderr.strip()}")
                sys.exit(1)
            print(f"  ✓ Pushed to origin/{branch}")

        print(f"\n{'='*60}")
        print(f"  Phase '{self._phase_name}' completed!")
        print(f"{'='*60}")

    # ─── PO + Reviewer 워크플로우 (docs/AGENT_WORKFLOW.md) ───

    def _plan_file(self) -> Path:
        return ROOT / "docs" / f"phase-{self._phase_dir_name}-plan.md"

    def _verdict_file(self, gate_num: int) -> Path:
        return self._phase_dir / f"gate{gate_num}-verdict.json"

    def _gate_already_approved(self, gate_num: int) -> bool:
        vf = self._verdict_file(gate_num)
        if not vf.exists():
            return False
        try:
            return json.loads(vf.read_text()).get("verdict") == "APPROVED"
        except (json.JSONDecodeError, OSError):
            return False

    def _call_claude(self, prompt: str, timeout: int = 900) -> str:
        """Claude를 비대화형으로 호출하고 stdout을 반환한다."""
        result = subprocess.run(
            ["claude", "-p", "--dangerously-skip-permissions", "--output-format", "json", prompt],
            cwd=self._root, capture_output=True, text=True, timeout=timeout,
        )
        return result.stdout

    def _run_plan_phase(self, guardrails: str):
        """Gate 1 전: PO가 구현 플랜을 작성하고 커밋한다."""
        plan_file = self._plan_file()
        if plan_file.exists():
            print(f"  Plan: {plan_file.name} (exists, skipping)")
            return

        index = self._read_json(self._index_file)
        steps_text = "\n".join(
            f"  - Step {s['step']}: {s['name']}" for s in index["steps"]
        )
        rel_plan = plan_file.relative_to(ROOT)
        prompt = (
            f"{guardrails}\n\n---\n\n"
            f"당신은 {self._project} 프로젝트의 PO입니다.\n\n"
            f"## 임무\n"
            f"Phase '{self._phase_name}'의 구현 플랜을 `{rel_plan}`에 작성하라.\n\n"
            f"## Phase 체크리스트 ({self._total}개 step)\n{steps_text}\n\n"
            f"## 플랜 포함 내용\n"
            f"1. 각 Step의 구현 순서와 이유\n"
            f"2. 각 Step의 검증 방법 (AC)\n"
            f"3. 생성될 파일 목록\n"
            f"4. CLAUDE.md CRITICAL 규칙 충돌 여부 확인\n\n"
            f"파일 작성 후 커밋하라:\n"
            f"  git add {rel_plan}\n"
            f"  git commit -m \"plan({self._phase_name}): Gate 1 implementation plan\"\n"
        )

        with progress_indicator(f"PO: writing plan ({self._phase_name})"):
            self._call_claude(prompt, timeout=600)

        if plan_file.exists():
            print(f"  ✓ Plan: {plan_file.name}")
        else:
            print(f"  WARN: PO가 플랜 파일을 생성하지 않았습니다.")

    def _run_reviewer(self, gate_num: int, criteria: str) -> tuple[bool, list]:
        """Reviewer Claude를 실행하고 (approved, issues) 반환한다."""
        verdict_file = self._verdict_file(gate_num)
        verdict_file.unlink(missing_ok=True)
        rel_verdict = verdict_file.relative_to(ROOT)

        prompt = (
            f"당신은 {self._project} 프로젝트의 코드 리뷰어입니다.\n\n"
            f"## Gate {gate_num} 검토\n\n"
            f"1. `git diff $(git merge-base HEAD main)..HEAD` 또는 `git log --oneline -20`을 실행해 변경사항을 파악하라.\n"
            f"2. 아래 기준을 각각 확인하라:\n\n{criteria}\n\n"
            f"3. 검토 결과를 `{rel_verdict}` 파일에 JSON으로 저장하라:\n"
            f'   이슈 없음: {{"verdict": "APPROVED", "issues": []}}\n'
            f'   이슈 있음: {{"verdict": "ISSUES", "issues": ["이슈1", "이슈2"]}}\n\n'
            f"반드시 Write 도구로 해당 파일을 저장해야 한다."
        )

        with progress_indicator(f"Reviewer: Gate {gate_num}"):
            self._call_claude(prompt, timeout=600)

        if not verdict_file.exists():
            return False, ["Reviewer가 verdict 파일을 생성하지 못했습니다."]

        try:
            v = json.loads(verdict_file.read_text())
            return v.get("verdict") == "APPROVED", v.get("issues", [])
        except (json.JSONDecodeError, OSError):
            return False, ["verdict 파일 파싱 실패"]

    def _run_po_fix(self, gate_num: int, issues: list, guardrails: str):
        """PO가 Reviewer 피드백을 반영해 수정하고 커밋한다."""
        issues_text = "\n".join(f"- {i}" for i in issues)
        prompt = (
            f"{guardrails}\n\n---\n\n"
            f"## Gate {gate_num} 수정 임무\n\n"
            f"Reviewer가 다음 이슈를 발견했다. 수정하라:\n\n{issues_text}\n\n"
            f"수정 완료 후 Conventional Commits 형식으로 커밋하라."
        )

        with progress_indicator(f"PO: fixing Gate {gate_num} issues"):
            self._call_claude(prompt, timeout=900)

    def _run_gate(self, gate_num: int, criteria: str, description: str, guardrails: str):
        """게이트 리뷰를 실행한다. 통과 실패 시 sys.exit(1)."""
        print(f"\n  ── Gate {gate_num}: {description} ──")

        if self._gate_already_approved(gate_num):
            print(f"  ✓ Gate {gate_num}: already APPROVED")
            return

        for attempt in range(1, self.REVIEWER_MAX_RETRIES + 1):
            approved, issues = self._run_reviewer(gate_num, criteria)

            if approved:
                print(f"  ✓ Gate {gate_num}: APPROVED")
                return

            print(f"  ✗ Gate {gate_num}: ISSUES ({len(issues)}개, attempt {attempt}/{self.REVIEWER_MAX_RETRIES})")
            for issue in issues[:5]:
                print(f"    - {issue}")

            if attempt < self.REVIEWER_MAX_RETRIES:
                self._run_po_fix(gate_num, issues, guardrails)
            else:
                print(f"\n  Gate {gate_num} failed after {self.REVIEWER_MAX_RETRIES} attempts.")
                print(f"  Fix issues manually and delete {self._verdict_file(gate_num).name} to re-run.")
                sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Harness Step Executor")
    parser.add_argument("phase_dir", help="Phase directory name (e.g. 0-mvp)")
    parser.add_argument("--push", action="store_true", help="Push branch after completion")
    args = parser.parse_args()

    StepExecutor(args.phase_dir, auto_push=args.push).run()


if __name__ == "__main__":
    main()

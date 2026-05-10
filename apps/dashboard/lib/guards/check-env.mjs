// 프로덕션 대시보드 빌드 차단 조건을 확인합니다.
if (process.env.ALLOW_PROD_DASHBOARD_BUILD !== "1") {
  console.error(
    [
      "프로덕션 대시보드 빌드가 차단되었습니다.",
      "zettlink dashboard는 로컬 개발용입니다.",
      "정말 빌드해야 한다면 ALLOW_PROD_DASHBOARD_BUILD=1을 설정하세요.",
    ].join("\n"),
  );
  process.exit(1);
}

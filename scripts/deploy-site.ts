// 공개 사이트 Vercel deploy hook을 POST로 호출하는 스크립트
const hookUrl = process.env.VERCEL_DEPLOY_HOOK_SITE

if (!hookUrl) {
  console.error('VERCEL_DEPLOY_HOOK_SITE 환경변수가 설정되지 않았습니다.')
  process.exit(1)
}

const res = await fetch(hookUrl, { method: 'POST' })
if (!res.ok) {
  console.error(`deploy hook 실패: ${res.status}`)
  process.exit(1)
}

console.log('사이트 배포 트리거 완료')

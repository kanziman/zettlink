// 공개 사이트 404 페이지
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
      <h1 className="text-title1 font-bold text-label-strong m-0">
        404
      </h1>
      <p className="text-label-alternative m-0 text-body1">
        페이지를 찾을 수 없습니다.
      </p>
      <a
        href="/"
        className="text-primary-normal no-underline text-body2 hover:underline"
      >
        홈으로 돌아가기
      </a>
    </div>
  )
}

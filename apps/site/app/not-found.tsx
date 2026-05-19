// 공개 사이트 404 페이지
export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '40vh',
        gap: '1rem',
      }}
    >
      <h1
        style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: 'var(--color-label-strong)',
          margin: 0,
        }}
      >
        404
      </h1>
      <p style={{ color: 'var(--color-label-alternative)', margin: 0 }}>
        페이지를 찾을 수 없습니다.
      </p>
      <a
        href="/"
        style={{
          color: 'var(--color-primary-normal)',
          textDecoration: 'none',
          fontSize: '0.9375rem',
        }}
      >
        홈으로 돌아가기
      </a>
    </div>
  )
}

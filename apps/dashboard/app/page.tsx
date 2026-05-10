// 리뷰 보드 자리표시자 화면입니다.
export default function ReviewBoardPage() {
  return (
    <main className="min-h-screen bg-background-alternative px-24 py-20 text-label-normal">
      <section className="mx-auto flex max-w-5xl flex-col gap-16">
        <header className="flex flex-col gap-6">
          <p className="text-label-md text-label-alternative">zettlink dashboard</p>
          <div className="flex flex-col gap-8">
            <h1 className="text-headline-lg text-label-strong">Review Board</h1>
            <p className="max-w-2xl text-body-md text-label-neutral">
              Placeholder for the local review workflow dashboard.
            </p>
          </div>
        </header>
        <div className="rounded-md border border-line-solid bg-background-elevated p-24 shadow-elevated">
          <p className="text-body-sm text-label-alternative">Review Board (placeholder)</p>
        </div>
      </section>
    </main>
  );
}

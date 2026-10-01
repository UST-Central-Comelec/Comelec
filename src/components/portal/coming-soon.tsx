/** A tab that's in the sidebar but not built yet: its heading, and a line on what it will hold. */
export function ComingSoon({ section, title, children }: { section: string; title: string; children: React.ReactNode }) {
  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">{section}</p>
          <h1>{title}</h1>
        </div>
      </header>
      <section className="portal-card is-flush">
        <p className="portal-empty">{children}</p>
      </section>
    </main>
  );
}

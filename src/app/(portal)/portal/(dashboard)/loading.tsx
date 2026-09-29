// Shown the moment a sidebar tab is clicked, while the page checks the session and loads its data
// from Supabase. Without it, the old page stays up until the new one has fully rendered. The sidebar
// (layout) stays put; only this part is swapped.

export default function PortalLoading() {
  return (
    <main className="portal-page portal-loading" aria-busy="true" aria-label="Loading">
      <div className="portal-loading-head">
        <span className="portal-skeleton is-eyebrow" />
        <span className="portal-skeleton is-title" />
      </div>
      <div className="portal-skeleton is-bar" />
      <div className="portal-skeleton is-card" />
      <div className="portal-skeleton is-card is-short" />
    </main>
  );
}

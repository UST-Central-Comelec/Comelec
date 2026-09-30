// Shown the moment someone switches to Become a Commissioner (or Track application) while the page loads its
// slot counts from Supabase, so the switch feels instant. The banner above stays put.

export default function ApplyLoading() {
  return (
    <div className="apply-form apply-skeleton" aria-busy="true" aria-label="Loading">
      <div className="apply-tracker">
        <div className="apply-tracker-inner">
          <div className="apply-skeleton-steps">
            {Array.from({ length: 8 }, (_, index) => <span key={index} />)}
          </div>
        </div>
      </div>
      <div className="apply-body">
        <div className="apply-body-head">
          <span className="apply-skeleton-line is-short" />
          <span className="apply-skeleton-line is-title" />
          <span className="apply-skeleton-line" />
        </div>
        <div className="apply-skeleton-card" />
      </div>
    </div>
  );
}

/** Skeleton for the dashboard workspace while a route's data resolves. */
export default function WorkspaceLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="dashSrOnly">Loading…</p>
      <div className="dashHeader">
        <div style={{ display: "grid", gap: 8 }}>
          <span
            style={{
              display: "block",
              width: 180,
              height: 28,
              borderRadius: 8,
              background: "var(--dash-surface-strong)",
            }}
          />
          <span
            style={{
              display: "block",
              width: 320,
              height: 14,
              borderRadius: 6,
              background: "var(--dash-surface)",
            }}
          />
        </div>
      </div>
      <div className="dashList">
        {[0, 1, 2, 3].map((row) => (
          <span
            key={row}
            className="dashRow"
            style={{ height: 62, background: "var(--dash-surface)" }}
          />
        ))}
      </div>
    </div>
  );
}

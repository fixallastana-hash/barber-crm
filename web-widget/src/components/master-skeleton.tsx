export function MasterSkeleton() {
  return (
    <main className="master-page">
      <div className="master-shell">
        {/* Profile card */}
        <header className="master-profile-card">
          <div className="master-profile-main">
            <div className="master-avatar-wrap">
              <div className="sk master-avatar" />
            </div>
            <div className="master-profile-copy" style={{ flex: 1 }}>
              <div className="sk" style={{ height: 10, width: 90, marginBottom: 8 }} />
              <div className="sk" style={{ height: 26, width: 180, marginBottom: 10, borderRadius: 8 }} />
              <div className="sk" style={{ height: 14, width: 110 }} />
            </div>
          </div>
          <div className="sk" style={{ height: 28, width: 70, borderRadius: 999 }} />
        </header>

        {/* Toolbar */}
        <div className="master-toolbar">
          <div style={{ flex: 1 }}>
            <div className="sk" style={{ height: 16, width: 140, marginBottom: 8 }} />
            <div className="sk" style={{ height: 12, width: 100 }} />
          </div>
          <div className="sk" style={{ height: 36, width: 100, borderRadius: 11 }} />
        </div>

        {/* Days */}
        <div className="master-days">
          {[1, 2, 3].map((dayIdx) => (
            <section key={dayIdx} className="master-day-section">
              <div className="master-day-heading">
                <div className="sk master-day-number" />
                <div style={{ flex: 1 }}>
                  <div className="sk" style={{ height: 15, width: 50, marginBottom: 6 }} />
                  <div className="sk" style={{ height: 11, width: 80 }} />
                </div>
                <div className="sk" style={{ height: 11, width: 40 }} />
              </div>
              <div className="master-appointments">
                {[1, 2].map((apptIdx) => (
                  <article key={apptIdx} className="master-appointment">
                    <div className="master-time-column">
                      <div className="sk" style={{ height: 14, width: 40, marginLeft: 'auto', marginBottom: 6 }} />
                      <div className="sk" style={{ height: 10, width: 30, marginLeft: 'auto' }} />
                    </div>
                    <div className="master-appointment-line" />
                    <div className="master-appointment-body">
                      <div className="sk" style={{ height: 14, width: '60%', marginBottom: 8 }} />
                      <div className="sk" style={{ height: 12, width: '40%', marginBottom: 8 }} />
                      <div className="sk" style={{ height: 10, width: 90 }} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
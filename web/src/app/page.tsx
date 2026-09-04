export default function Home() {
  return (
    <main>
      <nav className="topbar" aria-label="Primary navigation">
        <a className="wordmark" href="/">
          <span aria-hidden="true">LL</span>LiveLecture AI
        </a>
        <span className="build-state">Simulation demo</span>
      </nav>
      <section className="hero">
        <div>
          <p className="kicker">From lecture confusion to focused practice</p>
          <h1>
            Get unstuck now.
            <br />
            Practice that gap later.
          </h1>
          <p className="hero-copy">
            Follow a sample calculus lecture, ask for help when a step feels unclear, and return to
            that exact topic after class.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="/demo">
              Try the learning demo
            </a>
            <span>Run locally with npm run dev:demo.</span>
          </div>
        </div>
        <aside className="lecture-window" aria-label="How to try the demo">
          <div className="window-header">
            <span className="simulation-label">SIMULATION</span>
          </div>
          <h2>One lecture. Two useful practice topics.</h2>
          <ol>
            <li>Start the sample lecture. The transcript appears as it plays.</li>
            <li>
              Use “I’m Lost” for an explanation. Click its timestamps to check the lecture evidence.
            </li>
            <li>Finish the lecture and choose a saved confusion moment to practice.</li>
          </ol>
          <p>PREWRITTEN DEMO HELP — no AI provider used</p>
          <p>
            This private demo uses synthetic text and temporary local memory. It does not record
            audio. Live transcription and real AI help are still pending.
          </p>
        </aside>
      </section>
    </main>
  );
}

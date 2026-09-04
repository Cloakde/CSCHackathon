import { simulationFixture } from "@livelecture/shared";

const loopSteps = [
  { number: "01", title: "Follow the lecture", detail: "Timestamped transcript context" },
  { number: "02", title: "Signal confusion", detail: "One honest “I’m Lost” moment" },
  { number: "03", title: "Get grounded help", detail: "Evidence tied to real chunks" },
  { number: "04", title: "Practice the gap", detail: "A drill from that same event" },
];

export default function Home() {
  const expected = simulationFixture.expected;

  return (
    <main>
      <nav className="topbar" aria-label="Primary navigation">
        <a className="wordmark" href="#top" aria-label="LiveLecture AI home">
          <span aria-hidden="true">LL</span>
          LiveLecture AI
        </a>
        <span className="build-state">Canonical bootstrap</span>
      </nav>

      <section className="hero" id="top">
        <div>
          <p className="kicker">A learning assistant for the moment you fall behind</p>
          <h1>
            Stay with the lecture.
            <br />
            Study the exact gaps later.
          </h1>
          <p className="hero-copy">
            LiveLecture AI connects an in-class confusion signal to focused practice after class,
            using the lecture itself as evidence.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#proof">
              See the product loop
            </a>
            <span>No recording or paid AI is enabled in this baseline.</span>
          </div>
        </div>

        <aside className="lecture-window" aria-label="Synthetic lecture preview">
          <div className="window-header">
            <span className="simulation-label">SIMULATION</span>
            <span>07:15 / 08:00</span>
          </div>
          <p className="lecture-topic">{simulationFixture.session.title}</p>
          <blockquote>
            “For sine of x squared, cosine of x squared is the outside derivative and two x is the
            inside derivative.”
          </blockquote>
          <div className="confusion-signal">
            <span aria-hidden="true">?</span>
            <div>
              <strong>I’m Lost</strong>
              <small>Anchor help to this exact moment</small>
            </div>
          </div>
        </aside>
      </section>

      <section className="product-loop" id="proof" aria-labelledby="loop-heading">
        <div className="section-heading">
          <p className="kicker">The differentiating loop</p>
          <h2 id="loop-heading">One moment of confusion becomes a useful next step.</h2>
        </div>
        <ol>
          {loopSteps.map((step) => (
            <li key={step.number}>
              <span>{step.number}</span>
              <strong>{step.title}</strong>
              <small>{step.detail}</small>
            </li>
          ))}
        </ol>
      </section>

      <section className="proof-grid">
        <article>
          <p className="kicker">Deterministic proof data</p>
          <h2>{expected.confusionEvent.conceptTitle}</h2>
          <p>
            The canonical fixture records a confusion event, its evidence, and a weak-area drill
            with the same concept and source event IDs.
          </p>
          <dl>
            <div>
              <dt>Lecture length</dt>
              <dd>8 minutes</dd>
            </div>
            <div>
              <dt>Committed chunks</dt>
              <dd>10</dd>
            </div>
            <div>
              <dt>Practice items</dt>
              <dd>{expected.weakAreaDrill.practiceItems.length}</dd>
            </div>
          </dl>
        </article>

        <article className="scope-card">
          <p className="kicker">Honest scope</p>
          <h2>What this baseline proves</h2>
          <ul>
            <li>Shared runtime contracts</li>
            <li>Validated synthetic transcript replay</li>
            <li>Visible Simulation Mode</li>
            <li>Extension and companion shells</li>
          </ul>
          <p className="not-yet">
            Live tab capture, ElevenLabs, and generation providers remain isolated Day 3–5 spikes.
          </p>
        </article>
      </section>
    </main>
  );
}

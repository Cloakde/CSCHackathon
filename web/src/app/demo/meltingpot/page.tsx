"use client";

import { App } from "../../../../../extension/src/App";
import "../../../../../extension/src/styles.css";

export default function MeltingPotDemoPage() {
  return (
    <>
      <nav className="demo-rehearsal-nav">
        <a href="/">LiveLecture AI home</a>
        <p>MeltingPot rehearsal · the same lecture screen used by the extension</p>
        <p>Finish opens your private review in the separate local MeltingPot preview.</p>
      </nav>
      <App companionDestination="meltingpot" />
    </>
  );
}

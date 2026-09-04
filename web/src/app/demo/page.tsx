"use client";

import { App } from "../../../../extension/src/App";
import "../../../../extension/src/styles.css";

export default function DemoPage() {
  return (
    <>
      <nav className="demo-rehearsal-nav">
        <a href="/">LiveLecture AI home</a>
        <p>Browser rehearsal · the same lecture screen used by the extension</p>
      </nav>
      <App />
    </>
  );
}

import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /api/health", () => {
  it("reports the bootstrap source without claiming live providers", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "livelecture-web",
      source: "simulation",
      liveProvidersEnabled: false,
    });
  });
});

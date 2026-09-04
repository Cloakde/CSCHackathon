export function GET(): Response {
  return Response.json(
    {
      ok: true,
      service: "livelecture-web",
      source: "simulation",
      liveProvidersEnabled: false,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

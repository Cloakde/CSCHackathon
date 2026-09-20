export function GET(): Response {
  return Response.json(
    {
      ok: true,
      service: "livelecture-web",
      source: "simulation",
      liveAudioEnabled: false,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

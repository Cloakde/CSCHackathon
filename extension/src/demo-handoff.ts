import { EndSessionResponseSchema, StableIdSchema } from "@livelecture/shared";
import { DEMO_ORIGIN } from "./demo-api";

export type CompanionDestination = "prototype" | "meltingpot";
export const MELTINGPOT_ORIGIN = "http://127.0.0.1:3111";

/** Only a checked completed sample session can produce either fixed local destination. */
export function demoHandoffUrl(
  destination: CompanionDestination,
  expectedSessionId: string,
  response: unknown,
): string {
  const expected = StableIdSchema.safeParse(expectedSessionId);
  const completed = EndSessionResponseSchema.safeParse(response);
  if (
    !expected.success ||
    !completed.success ||
    completed.data.session.sessionId !== expected.data ||
    completed.data.session.sourceMode !== "simulation"
  ) {
    throw new Error("The finished lecture did not match this sample session. Please try again.");
  }

  switch (destination) {
    case "prototype":
      return `${DEMO_ORIGIN}${completed.data.handoff.companionRoute}`;
    case "meltingpot":
      return `${MELTINGPOT_ORIGIN}/lectures/${expected.data}`;
    default:
      throw new Error("This practice destination is not supported.");
  }
}

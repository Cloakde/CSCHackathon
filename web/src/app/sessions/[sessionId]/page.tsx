import { SessionReview } from "../../../components/SessionReview";

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <SessionReview key={sessionId} sessionId={sessionId} />;
}

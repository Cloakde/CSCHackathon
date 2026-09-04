import { handleDemoRequest } from "../../../../server/demo-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = handleDemoRequest;
export const DELETE = handleDemoRequest;
export const OPTIONS = handleDemoRequest;
export const POST = handleDemoRequest;
export const PUT = handleDemoRequest;
export const PATCH = handleDemoRequest;
export const HEAD = handleDemoRequest;

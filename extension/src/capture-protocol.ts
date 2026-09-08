/**
 * Extension-private message protocol for browser-tab audio capture (TASK-101).
 *
 * Every message carries an explicit `generation` (except the two messages that
 * precede a generation existing at all: the initial disclosure step and a bare
 * status query) so a stale acknowledgment or terminal event from an earlier
 * capture attempt can never be mistaken for one from the current attempt.
 *
 * This module has no Chrome API dependency — it is pure types and runtime
 * validators, testable in plain Node/jsdom without stubbing `chrome`.
 */

export type CaptureState =
  "idle" | "awaiting_consent" | "armed" | "starting" | "active" | "stopping" | "error";

/** A safe, non-sensitive reason class for UI copy. Never a raw Chrome error string. */
export type CaptureErrorReason =
  | "consent_expired"
  | "arm_expired"
  | "tab_mismatch"
  | "tab_closed"
  | "tab_restricted"
  | "permission_denied"
  | "capture_failed"
  | "offscreen_failed"
  | "stream_id_failed"
  | "getusermedia_failed"
  | "unexpected";

export interface CaptureStatusSnapshot {
  state: CaptureState;
  generation: number;
  tabId?: number;
  reason?: CaptureErrorReason;
}

export const IDLE_STATUS: CaptureStatusSnapshot = { state: "idle", generation: 0 };

function isCaptureState(value: unknown): value is CaptureState {
  return (
    value === "idle" ||
    value === "awaiting_consent" ||
    value === "armed" ||
    value === "starting" ||
    value === "active" ||
    value === "stopping" ||
    value === "error"
  );
}

function isCaptureErrorReason(value: unknown): value is CaptureErrorReason {
  return (
    value === "consent_expired" ||
    value === "arm_expired" ||
    value === "tab_mismatch" ||
    value === "tab_closed" ||
    value === "tab_restricted" ||
    value === "permission_denied" ||
    value === "capture_failed" ||
    value === "offscreen_failed" ||
    value === "stream_id_failed" ||
    value === "getusermedia_failed" ||
    value === "unexpected"
  );
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function isCaptureStatusSnapshot(value: unknown): value is CaptureStatusSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (!isCaptureState(record.state)) return false;
  if (!isPositiveInteger(record.generation)) return false;
  if (record.tabId !== undefined && !isPositiveInteger(record.tabId)) return false;
  if (record.reason !== undefined && !isCaptureErrorReason(record.reason)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Side panel (capture-client) <-> background (capture-controller)
// ---------------------------------------------------------------------------

export const PANEL_CHANNEL = "livelecture-capture" as const;

export type PanelToBackgroundMessage =
  | { channel: typeof PANEL_CHANNEL; kind: "get_status" }
  | { channel: typeof PANEL_CHANNEL; kind: "consent"; generation: number }
  | { channel: typeof PANEL_CHANNEL; kind: "stop"; generation: number };

export function isPanelToBackgroundMessage(value: unknown): value is PanelToBackgroundMessage {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.channel !== PANEL_CHANNEL) return false;
  if (record.kind === "get_status") return true;
  if (record.kind === "consent" || record.kind === "stop")
    return isPositiveInteger(record.generation);
  return false;
}

export const PANEL_STATUS_CHANNEL = "livelecture-capture-status" as const;

export interface BackgroundToPanelStatusMessage {
  channel: typeof PANEL_STATUS_CHANNEL;
  status: CaptureStatusSnapshot;
}

export function isBackgroundToPanelStatusMessage(
  value: unknown,
): value is BackgroundToPanelStatusMessage {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.channel === PANEL_STATUS_CHANNEL && isCaptureStatusSnapshot(record.status);
}

// ---------------------------------------------------------------------------
// Background (capture-controller) <-> offscreen document
// ---------------------------------------------------------------------------

export const OFFSCREEN_COMMAND_CHANNEL = "livelecture-offscreen-command" as const;

export type BackgroundToOffscreenMessage =
  | {
      channel: typeof OFFSCREEN_COMMAND_CHANNEL;
      kind: "consume_stream";
      generation: number;
      streamId: string;
    }
  | { channel: typeof OFFSCREEN_COMMAND_CHANNEL; kind: "stop"; generation: number }
  | { channel: typeof OFFSCREEN_COMMAND_CHANNEL; kind: "get_status"; generation: number };

export function isBackgroundToOffscreenMessage(
  value: unknown,
): value is BackgroundToOffscreenMessage {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.channel !== OFFSCREEN_COMMAND_CHANNEL) return false;
  if (!isPositiveInteger(record.generation)) return false;
  if (record.kind === "stop" || record.kind === "get_status") return true;
  if (record.kind === "consume_stream")
    return typeof record.streamId === "string" && record.streamId.length > 0;
  return false;
}

export const OFFSCREEN_ACK_CHANNEL = "livelecture-offscreen-ack" as const;

export type OffscreenAckKind = "track_active" | "track_failed" | "track_ended" | "stopped";

export interface OffscreenToBackgroundMessage {
  channel: typeof OFFSCREEN_ACK_CHANNEL;
  kind: OffscreenAckKind;
  generation: number;
  reason?: CaptureErrorReason;
}

export function isOffscreenToBackgroundMessage(
  value: unknown,
): value is OffscreenToBackgroundMessage {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.channel !== OFFSCREEN_ACK_CHANNEL) return false;
  if (!isPositiveInteger(record.generation)) return false;
  if (
    record.kind !== "track_active" &&
    record.kind !== "track_failed" &&
    record.kind !== "track_ended" &&
    record.kind !== "stopped"
  )
    return false;
  if (record.reason !== undefined && !isCaptureErrorReason(record.reason)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// chrome.storage.session control-metadata record (no audio, no stream ID)
// ---------------------------------------------------------------------------

export const CAPTURE_STORAGE_KEY = "livelecture.capture.v1" as const;

export interface CaptureStorageRecord {
  version: 1;
  state: CaptureState;
  generation: number;
  tabId: number;
  /** Epoch ms. Present only while state is "awaiting_consent". */
  awaitingConsentExpiresAt?: number;
  /** Epoch ms. Present only while state is "armed". */
  armedExpiresAt?: number;
  /** Present only while state is "error". */
  reason?: CaptureErrorReason;
}

export function isCaptureStorageRecord(value: unknown): value is CaptureStorageRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.version !== 1) return false;
  if (!isCaptureState(record.state)) return false;
  if (!isPositiveInteger(record.generation)) return false;
  if (!isPositiveInteger(record.tabId)) return false;
  if (
    record.awaitingConsentExpiresAt !== undefined &&
    !isPositiveInteger(record.awaitingConsentExpiresAt)
  )
    return false;
  if (record.armedExpiresAt !== undefined && !isPositiveInteger(record.armedExpiresAt))
    return false;
  if (record.reason !== undefined && !isCaptureErrorReason(record.reason)) return false;
  return true;
}

export const CONSENT_EXPIRY_MS = 120_000;
export const ARM_EXPIRY_MS = 60_000;

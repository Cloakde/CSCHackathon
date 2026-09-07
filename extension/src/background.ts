import { createCaptureController, type CaptureControllerChrome } from "./capture-controller";

interface SidePanelController {
  setPanelBehavior(options: { openPanelOnActionClick: boolean }): Promise<void>;
}

interface BackgroundLogger {
  error(message: string): void;
}

/**
 * Chrome may retain an installed build's `openPanelOnActionClick: true` preference
 * across an update. Capture (TASK-101) needs deterministic invocation, so every
 * worker startup and update explicitly clears it before the action is advertised
 * as ready — the capture controller's own listener is the only thing that opens
 * the panel from then on.
 */
export async function configureSidePanel(
  sidePanel: SidePanelController,
  logger: BackgroundLogger = console,
): Promise<void> {
  try {
    await sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  } catch {
    logger.error("LiveLecture AI: unable to configure side-panel behavior.");
  }
}

export function startBackground(
  chromeApis: CaptureControllerChrome,
  logger: BackgroundLogger = console,
): void {
  const controller = createCaptureController(chromeApis, logger);
  // Registered synchronously at module scope: a service-worker restart must not
  // miss an action click or message that arrives before an async setup completes.
  controller.attachListeners();
  void configureSidePanel(chromeApis.sidePanel, logger);
  void controller.reconcileOnWake();
}

declare const chrome: CaptureControllerChrome | undefined;

if (typeof chrome !== "undefined" && chrome.action) {
  startBackground(chrome);
}

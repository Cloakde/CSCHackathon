interface SidePanelController {
  setPanelBehavior(options: { openPanelOnActionClick: boolean }): Promise<void>;
}

interface BackgroundLogger {
  error(message: string): void;
}

export async function configureSidePanel(
  sidePanel: SidePanelController,
  logger: BackgroundLogger = console,
): Promise<void> {
  try {
    await sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch {
    logger.error("LiveLecture AI: unable to configure side-panel behavior.");
  }
}

if (typeof chrome !== "undefined" && chrome.sidePanel) {
  void configureSidePanel(chrome.sidePanel);
}

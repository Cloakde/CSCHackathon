/**
 * ElevenLabs Scribe Realtime STT WebSocket Client
 * Connects to wss://api.elevenlabs.io/v1/speech-to-text/realtime for live lecture transcription.
 */

export interface ScribeTranscriptEvent {
  type: "partial" | "committed";
  text: string;
  startMs: number;
  endMs: number;
}

export interface ScribeClientOptions {
  apiKey?: string;
  token?: string;
  modelId?: string;
  sampleRate?: number;
  onTranscript: (event: ScribeTranscriptEvent) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

export class ElevenLabsScribeClient {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private readonly options: ScribeClientOptions;

  constructor(options: ScribeClientOptions) {
    this.options = options;
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const { apiKey, token, modelId = "scribe_v2_realtime" } = this.options;
      const url = new URL("wss://api.elevenlabs.io/v1/speech-to-text/realtime");
      url.searchParams.set("model_id", modelId);
      if (token) {
        url.searchParams.set("token", token);
      } else if (apiKey) {
        url.searchParams.set("xi-api-key", apiKey);
      }

      try {
        this.ws = new WebSocket(url.toString());

        this.ws.onopen = () => {
          this.isConnected = true;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(String(event.data));
            if (data.type === "partial_transcript" && data.text) {
              this.options.onTranscript({
                type: "partial",
                text: data.text,
                startMs: data.start_time_ms ?? 0,
                endMs: data.end_time_ms ?? 0,
              });
            } else if (data.type === "committed_transcript" && data.text) {
              this.options.onTranscript({
                type: "committed",
                text: data.text,
                startMs: data.start_time_ms ?? 0,
                endMs: data.end_time_ms ?? 0,
              });
            }
          } catch {
            // Ignore non-JSON control messages
          }
        };

        this.ws.onerror = () => {
          const err = new Error("ElevenLabs Scribe WebSocket connection error");
          this.options.onError?.(err);
          reject(err);
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.options.onClose?.();
        };
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  public sendAudioChunk(pcmData: Int16Array | ArrayBuffer): void {
    if (this.ws && this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(pcmData);
    }
  }

  public close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }
}

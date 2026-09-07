/**
 * Tab Audio Capture with WebAudio Passthrough
 * Captures browser tab audio (e.g. Google Meet), keeps speaker audio audible,
 * and extracts 16kHz mono PCM audio chunks for live transcription.
 */

import { ElevenLabsScribeClient, type ScribeTranscriptEvent } from "./elevenlabs-scribe";

export interface TabCaptureOptions {
  streamId?: string;
  onTranscript: (event: ScribeTranscriptEvent) => void;
  onError?: (error: Error) => void;
  elevenLabsApiKey?: string;
}

export class TabAudioCapture {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private scribeClient: ElevenLabsScribeClient | null = null;
  private isCapturing = false;

  constructor(private readonly options: TabCaptureOptions) {}

  public async startCapture(streamId?: string): Promise<void> {
    if (this.isCapturing) return;

    try {
      // 1. Acquire Tab Audio Stream
      const constraints: MediaStreamConstraints = streamId
        ? ({
            audio: {
              mandatory: {
                chromeMediaSource: "tab",
                chromeMediaSourceId: streamId,
              },
            },
            video: false,
          } as unknown as MediaStreamConstraints)
        : { audio: true, video: false };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // 2. Setup WebAudio Context with Passthrough
      // This is crucial: tab audio is routed to destination so the student still hears class
      this.audioContext = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )({
        sampleRate: 16000,
      });

      const sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Passthrough connection: source -> destination (headphones/speakers)
      sourceNode.connect(this.audioContext.destination);

      // 3. Setup Scribe Realtime Client
      if (this.options.elevenLabsApiKey) {
        this.scribeClient = new ElevenLabsScribeClient({
          apiKey: this.options.elevenLabsApiKey,
          onTranscript: this.options.onTranscript,
          onError: this.options.onError,
        });
        await this.scribeClient.connect();
      }

      // 4. PCM Audio Extractor (ScriptProcessorNode / AudioWorklet)
      this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.processorNode.onaudioprocess = (e) => {
        if (!this.isCapturing) return;
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert float32 [-1.0, 1.0] to int16 PCM
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i] ?? 0));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        if (this.scribeClient) {
          this.scribeClient.sendAudioChunk(pcm16.buffer);
        }
      };

      sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      this.isCapturing = true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.options.onError?.(error);
      this.stopCapture();
      throw error;
    }
  }

  public stopCapture(): void {
    this.isCapturing = false;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }
    if (this.scribeClient) {
      this.scribeClient.close();
      this.scribeClient = null;
    }
  }

  public getStatus(): { isCapturing: boolean } {
    return { isCapturing: this.isCapturing };
  }
}

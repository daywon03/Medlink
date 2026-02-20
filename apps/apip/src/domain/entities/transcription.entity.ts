/**
 * Domain Entity: Transcription
 * Text transcription of a segment of an emergency call
 */
export class Transcription {
  constructor(
    public readonly transcriptionId: string,
    public readonly callId: string,
    public readonly text: string,
    public readonly createdAt: Date = new Date(),
  ) {}

  isEmpty(): boolean {
    return !this.text || this.text.trim().length === 0;
  }

  getWordCount(): number {
    return this.text.split(/\s+/).filter(Boolean).length;
  }
}

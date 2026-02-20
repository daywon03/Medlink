/**
 * Domain Entity: Call (Emergency Call)
 * Pure business logic, no framework dependencies
 */
export class Call {
  constructor(
    public readonly callId: string,
    public readonly citizenId: string,
    public locationInputText: string | null,
    public status: string,
    public dateHeure: Date,
    public updatedAt?: Date,
    public extractedAddress?: string | null,
  ) {}

  finish(): void {
    if (this.status === 'terminé' || this.status === 'closed') {
      throw new Error('Call already finished');
    }
    this.status = 'terminé';
    this.updatedAt = new Date();
  }

  isFinished(): boolean {
    return this.status === 'terminé' || this.status === 'closed' || this.status === 'clos';
  }

  isActive(): boolean {
    return this.status === 'en_cours';
  }

  getDurationMs(): number | null {
    if (!this.updatedAt || !this.isFinished()) return null;
    return this.updatedAt.getTime() - this.dateHeure.getTime();
  }

  getDurationFormatted(): string | null {
    const ms = this.getDurationMs();
    if (ms === null) return null;
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}min ${seconds}s`;
  }

  updateAddress(address: string): void {
    this.locationInputText = address;
    this.extractedAddress = address;
  }
}

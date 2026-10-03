export class RingBuffer {
  private readonly data: Float32Array;
  private readIndex = 0;
  private writeIndex = 0;
  private size = 0;

  constructor(capacity: number) {
    if (capacity < 1) {
      throw new Error("El buffer necesita capacidad.");
    }
    this.data = new Float32Array(capacity);
  }

  push(sample: number): boolean {
    if (this.size === this.data.length) {
      return false;
    }
    this.data[this.writeIndex] = sample;
    this.writeIndex = (this.writeIndex + 1) % this.data.length;
    this.size += 1;
    return true;
  }

  pull(): number | null {
    if (this.size === 0) {
      return null;
    }
    const value = this.data[this.readIndex];
    this.readIndex = (this.readIndex + 1) % this.data.length;
    this.size -= 1;
    return value;
  }

  get available(): number {
    return this.size;
  }
}

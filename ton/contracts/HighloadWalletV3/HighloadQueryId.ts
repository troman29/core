const BIT_NUMBER_SIZE = 10n; // 10 bit
const MAX_BIT_NUMBER = 1022n;
const MAX_SHIFT = 8191n; // 2^13 = 8192
// const SHIFT_SIZE = 13n; // 13 bit
// const MAX_QUERY_ID = 2n ** 23n;

export class HighloadQueryId {
  private shift: bigint; // [0 .. 8191]
  private bitnumber: bigint; // [0 .. 1022]

  constructor() {
    this.shift = 0n;
    this.bitnumber = 0n;
  }

  static fromShiftAndBitNumber(shift: bigint, bitnumber: bigint): HighloadQueryId {
    const q = new HighloadQueryId();
    q.shift = shift;
    if (q.shift < 0) throw new Error('invalid shift');
    if (q.shift > MAX_SHIFT) throw new Error('invalid shift');
    q.bitnumber = bitnumber;
    if (q.bitnumber < 0) throw new Error('invalid bitnumber');
    if (q.bitnumber > MAX_BIT_NUMBER) throw new Error('invalid bitnumber');
    return q;
  }

  getNext() {
    let newBitnumber = this.bitnumber + 1n;
    let newShift = this.shift;

    if (newShift === MAX_SHIFT && newBitnumber > (MAX_BIT_NUMBER - 1n)) {
      throw new Error('Overload'); // NOTE: we left one queryId for emergency withdraw
    }

    if (newBitnumber > MAX_BIT_NUMBER) {
      newBitnumber = 0n;
      newShift += 1n;
      if (newShift > MAX_SHIFT) {
        throw new Error('Overload');
      }
    }

    return HighloadQueryId.fromShiftAndBitNumber(newShift, newBitnumber);
  }

  hasNext() {
    const isEnd = this.bitnumber >= (MAX_BIT_NUMBER - 1n) && this.shift === MAX_SHIFT; // NOTE: we left one queryId for emergency withdraw;
    return !isEnd;
  }

  getShift(): bigint {
    return this.shift;
  }

  getBitNumber(): bigint {
    return this.bitnumber;
  }

  getQueryId(): bigint {
    // eslint-disable-next-line no-bitwise
    return (this.shift << BIT_NUMBER_SIZE) + this.bitnumber;
  }

  static fromQueryId(queryId: bigint): HighloadQueryId {
    // eslint-disable-next-line no-bitwise
    const shift = queryId >> BIT_NUMBER_SIZE;
    // eslint-disable-next-line no-bitwise
    const bitnumber = queryId & 1023n;
    return this.fromShiftAndBitNumber(shift, bitnumber);
  }

  static fromSeqno(i: bigint): HighloadQueryId {
    const shift = (i / 1023n) % 8192n;
    const bitnumber = i % 1023n;
    return this.fromShiftAndBitNumber(shift, bitnumber);
  }

  /**
   * @return {bigint} [0 .. 8380415]
   */
  toSeqno(): bigint {
    return this.bitnumber + this.shift * 1023n;
  }
}

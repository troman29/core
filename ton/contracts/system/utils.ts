// eslint-disable-next-line max-classes-per-file
import type { TupleReader } from '@ton/core';

interface IAny {}
interface TupleReaderConstructor <T extends IAny> {
  new (...args: any[]) : T;
  fromReader(rdr: TupleReader) : T;
}

class TupleReaderFactory<T extends IAny> {
  private constructable: TupleReaderConstructor<T>;
  constructor(constructable: TupleReaderConstructor<T>) {
    this.constructable = constructable;
  }
  createObject(rdr: TupleReader) : T {
    return this.constructable.fromReader(rdr);
  }
}

class LispIterator <T extends IAny> implements Iterator <T> {
  private curItem:TupleReader | null;
  private done:boolean;
  private ctor: TupleReaderFactory<T>;

  constructor(tuple:TupleReader | null, ctor: TupleReaderFactory<T>) {
    this.done = false; // tuple === null || tuple.remaining == 0;
    this.curItem = tuple;
    this.ctor = ctor;
  }

  public next(): IteratorResult<T> {
    // eslint-disable-next-line no-null/no-null
    this.done = this.curItem === null || this.curItem.remaining === 0;
    let value: TupleReader;
    if (!this.done) {
      const head = this.curItem!.readTuple();
      const tail = this.curItem!.readTupleOpt();

      // eslint-disable-next-line no-null/no-null
      if (tail !== null) {
        this.curItem = tail;
      }

      value = head;
      return { done: this.done, value: this.ctor.createObject(value) };
    } else {
      // eslint-disable-next-line no-null/no-null
      return { done: true, value: null };
    }
  }
}

export class LispList <T extends IAny> {
  private tuple: TupleReader | null;
  private ctor: TupleReaderFactory<T>;

  constructor(tuple: TupleReader | null, ctor: TupleReaderConstructor<T>) {
    this.tuple = tuple;
    this.ctor = new TupleReaderFactory(ctor);
  }

  toArray() : T[] {
    return [...this];
  }

  [Symbol.iterator]() {
    return new LispIterator(this.tuple, this.ctor);
  }
}

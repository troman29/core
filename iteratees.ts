type AnyLiteral = Record<string, any>;
type CollectionByKey<Member> = Record<number | string, Member>;
type GroupedByKey<Member> = Record<number | string, Member[]>;

export function pick<T, K extends keyof T>(object: T, keys: K[]) {
  return keys.reduce((result, key) => {
    result[key] = object[key];
    return result;
  }, {} as Pick<T, K>);
}

export function buildCollectionByKey<T extends AnyLiteral>(collection: T[], key: keyof T) {
  return collection.reduce((byKey: CollectionByKey<T>, member: T) => {
    // eslint-disable-next-line no-param-reassign
    byKey[member[key]] = member;

    return byKey;
  }, {});
}

export function buildArrayCollectionByKey<T extends AnyLiteral>(collection: T[], key: keyof T) {
  return collection.reduce((byKey: CollectionByKey<Array<T>>, member: T) => {
    const collectionKey = member[key];
    if (!byKey[collectionKey]) {
      // eslint-disable-next-line no-param-reassign
      byKey[collectionKey] = [];
    }
    byKey[collectionKey].push(member);

    return byKey;
  }, {});
}

export function difference<T>(x: Set<T>, y: Set<T>): Set<T> {
  const result = new Set(x);
  // eslint-disable-next-line no-restricted-syntax
  for (const elem of y) {
    result.delete(elem);
  }
  return result;
}

export function union<T>(x: Set<T>, y: Set<T>): Set<T> {
  const result = new Set(x);
  // eslint-disable-next-line no-restricted-syntax
  for (const elem of y) {
    result.add(elem);
  }
  return result;
}

export function intersection<T>(x: Set<T>, y: Set<T>): Set<T> {
  const result = new Set() as Set<T>;
  // eslint-disable-next-line no-restricted-syntax
  for (const elem of y) {
    if (x.has(elem)) {
      result.add(elem);
    }
  }
  return result;
}

export function fromKeyValueArrays<T>(keys: string[], values: T[] | T) {
  return keys.reduce((acc, key, index) => {
    acc[key] = Array.isArray(values) ? values[index] : values;
    return acc;
  }, {} as Record<string, T>);
}

export function compact<T extends any>(array: T[]) {
  return array.filter(Boolean);
}

export function splitArray<T>(array: T[], length: number, splitFn: (item: T) => number) {
  const resultArrays: T[][] = Array(length).fill(undefined).map(() => []);

  for (const item of array) {
    const index = splitFn(item);
    resultArrays[index].push(item);
  }

  return resultArrays;
}

export function extractKey<T, K extends keyof T>(array: T[], key: K): T[K][] {
  return array.map((value) => value[key]);
}

export function* chunkify<T>(array: Iterable<T>, size: number) {
  let chunk: T[] = [];
  for (const value of array) {
    chunk.push(value);
    if (chunk.length === size) {
      yield chunk;
      chunk = [];
    }
  }
  if (chunk.length) yield chunk;
}

export function range(start: number, end: number, interval = 1) {
  const arr: number[] = [];
  for (let i = start; i < end;) {
    arr.push(i);
    i += interval;
  }
  return arr;
}

export function sequence(length: number) {
  return Array.from({ length }, (_, index) => index);
}

export function uniqueByKey<T>(array: T[], key: keyof T, shouldKeepFirst?: boolean) {
  if (shouldKeepFirst) {
    array = Array.from(array);
    array.reverse();
  }

  const result = [...new Map(array.map((item) => [item[key], item])).values()];

  if (shouldKeepFirst) {
    result.reverse();
  }

  return result;
}

export function filterValues<M extends any>(
  byKey: CollectionByKey<M>,
  callback: (member: M, key: string, index: number, originalByKey: CollectionByKey<M>) => boolean,
): CollectionByKey<M> {
  return Object.keys(byKey).reduce((newByKey: CollectionByKey<M>, key, index) => {
    if (!callback(byKey[key], key, index, byKey)) {
      newByKey[key] = byKey[key];
    }

    return newByKey;
  }, {});
}

export function unique<T extends any>(array: T[]): T[] {
  return Array.from(new Set(array));
}

export function deleteItem<T>(array: T[], value: T) {
  const index = array.indexOf(value);
  if (index > -1) {
    array.splice(index, 1);
    return true;
  }
  return false;
}

export function omitUndefined<T extends object>(object: T): T {
  return Object.keys(object).reduce((result, stringKey) => {
    const key = stringKey as keyof T;
    if (object[key] !== undefined) {
      result[key as keyof T] = object[key];
    }
    return result;
  }, {} as T);
}

export function mapValues<R extends any, M extends any>(
  byKey: CollectionByKey<M>,
  callback: (member: M, key: string, index: number, originalByKey: CollectionByKey<M>) => R,
): CollectionByKey<R> {
  return Object.keys(byKey).reduce((newByKey: CollectionByKey<R>, key, index) => {
    newByKey[key] = callback(byKey[key], key, index, byKey);
    return newByKey;
  }, {});
}

export function groupBy<T extends AnyLiteral>(collection: T[], key: keyof T): GroupedByKey<T> {
  return collection.reduce((byKey: GroupedByKey<T>, member: T) => {
    const groupKey = member[key];

    if (!byKey[groupKey]) {
      byKey[groupKey] = [member];
    } else {
      byKey[groupKey]!.push(member);
    }

    return byKey;
  }, {});
}

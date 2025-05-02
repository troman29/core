type AnyLiteral = Record<string, any>;
type AnyClass = new (...args: any[]) => any;
type AnyFunction = (...args: any[]) => any;
type AnyAsyncFunction = (...args: any[]) => Promise<any>;
type AnyToVoidFunction = (...args: any[]) => void;
type NoneToVoidFunction = () => void;
type ValueOf<T> = T[keyof T];
type Maybe<T> = T | null;
type MaybePromise<T> = Promise<T> | T;

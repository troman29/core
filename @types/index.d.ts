type AnyLiteral = Record<string, any>;
type AnyClass = new (...args: any[]) => any;
type AnyFunction = (...args: any[]) => any;
type AnyAsyncFunction = (...args: any[]) => Promise<any>;
type AnyToVoidFunction = (...args: any[]) => void;
type NoneToVoidFunction = () => void;
type ValueOf<T> = T[keyof T];
type Maybe<T> = T | null;
type MaybePromise<T> = Promise<T> | T;

type BaseTransaction = {
  hash: string;
  timestamp: number;
  amount: bigint;
  fromAddress: string;
  toAddress: string;
  comment?: string;
  fee: bigint;
  isIncoming: boolean;
};

type TonTransaction = BaseTransaction & {
  index: number;
  normalizedAddress: string;
  externalMsgHash?: string;
  msgHash: string;
  opCode?: number;
  exitCode?: number;
};

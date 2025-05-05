import { logError } from './logs';

type SafeExecOptions = {
  rescue?: (err: Error) => void;
  always?: NoneToVoidFunction;
  shouldIgnoreError?: boolean;
};

export async function safeExecAsync<T extends AnyAsyncFunction>(
  cb: T,
  options?: SafeExecOptions,
): Promise<ReturnType<T> | undefined> {
  const { rescue, always, shouldIgnoreError } = options ?? {};

  try {
    return await cb();
  } catch (err: any) {
    rescue?.(err);
    if (!shouldIgnoreError) {
      logError('safeExecAsync', err);
    }
    return undefined;
  } finally {
    always?.();
  }
}

export default function safeExec<T extends AnyFunction>(cb: T, options?: SafeExecOptions): ReturnType<T> | undefined {
  const { rescue, always, shouldIgnoreError } = options ?? {};

  try {
    return cb();
  } catch (err: any) {
    rescue?.(err);
    if (!shouldIgnoreError) {
      logError('safeExec', err);
    }
    return undefined;
  } finally {
    always?.();
  }
}

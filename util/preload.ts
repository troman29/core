import { handleErrorAndExit } from './logs';

const promises: Promise<any>[] = [];

export function registerPreload(promise: Promise<any>) {
  const promiseWithCatch = promise.catch(handleErrorAndExit);
  promises.push(promiseWithCatch);
  return promiseWithCatch;
}

export function waitPreloads() {
  return Promise.all(promises);
}

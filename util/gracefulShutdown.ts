import { DEBUG_MORE } from '../../config';
import { logError } from './logs';
import { pause } from './schedulers';

class GracefulShutdown {
  isShutdownStarted: boolean;
  tasks: Record<string, {
    isOnPause?: boolean;
  }>;

  constructor() {
    this.isShutdownStarted = false;
    this.tasks = {};
  }

  registerTask(name: string) {
    // eslint-disable-next-line no-console
    console.log(`Task "${name}" is registered`);

    this.tasks[name] = {};
  }

  unregisterTask(name: string) {
    if (!(name in this.tasks)) {
      return;
    }

    // eslint-disable-next-line no-console
    console.log(`Task "${name}" is finished`);

    delete this.tasks[name];
    if (!Object.keys(this.tasks).length && this.isShutdownStarted) {
      this.shutdown();
    }
  }

  async pauseTask(name: string, ms: number) {
    if (this.isShutdownStarted) return;

    const task = this.tasks[name];
    task.isOnPause = true;
    await pause(ms);
    task.isOnPause = false;
  }

  startShutdown() {
    // eslint-disable-next-line no-console
    console.log('A shutdown signal has been received');

    this.isShutdownStarted = true;

    const entries = Object.entries(this.tasks);

    if (!entries.length) {
      this.shutdown();
    }

    for (const [name, { isOnPause }] of entries) {
      if (isOnPause) {
        this.unregisterTask(name);
      }
    }
  }

  // eslint-disable-next-line class-methods-use-this
  shutdown() {
    process.exit(0);
  }

  createMonitor(
    name: string,
    func: AnyAsyncFunction,
    pauseMs: number,
    errorPauseMs: number = pauseMs,
  ) {
    return async () => {
      this.registerTask(name);

      while (!this.isShutdownStarted) {
        try {
          // eslint-disable-next-line no-console
          if (DEBUG_MORE) console.time(name);

          await func();

          // eslint-disable-next-line no-console
          if (DEBUG_MORE) console.timeEnd(name);

          await this.pauseTask(name, pauseMs);
        } catch (err) {
          // eslint-disable-next-line no-console
          if (DEBUG_MORE) console.timeEnd(name);

          logError(name, err);
          await this.pauseTask(name, errorPauseMs);
        }
      }

      this.unregisterTask(name);
    };
  }
}

const gracefulShutdown = new GracefulShutdown();

export default gracefulShutdown;

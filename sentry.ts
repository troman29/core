import * as Sentry from '@sentry/node';

import { SENTRY_DSN } from '../config';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}

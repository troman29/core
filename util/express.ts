import type { NextFunction, Request, Response } from 'express';
import type { ValidationChain } from 'express-validator';
import { validationResult } from 'express-validator';
import { JSONRPCErrorException } from 'json-rpc-2.0';
import os from 'node:os';

import { DEBUG } from '../config';
import { HttpError } from './errors';

export type RequestHandler = (req: Request, res: Response, next: NextFunction) => any;

export type CustomRequest = Request & {
  parsed?: {
    isAdmin?: boolean;
  };
};

export type CustomRequestHandler = {
  (req: CustomRequest, res?: Response): MaybePromise<Object>;
  validators?: ValidationChain[];
};

const hostname = os.hostname();

export function shouldSentryHandleError(error: any): boolean {
  if (error instanceof HttpError) {
    return Boolean((error.status && error.status >= 500) || error.args?.shouldSentryCapture);
  }
  return true;
}

export function debugMiddleware(req: Request, res: Response, next: NextFunction) {
  if (DEBUG || (req as CustomRequest).parsed?.isAdmin) {
    res.setHeader('X-Server-Hostname', hostname);
  }

  next();
}

export function asEndpoint(endpoint: CustomRequestHandler): (RequestHandler | ValidationChain)[] {
  const handler: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    if ('validators' in endpoint) {
      const resultErrors = validationResult(req);
      if (!resultErrors.isEmpty()) {
        res.status(400);
        res.json({ errors: resultErrors.array() });
        return;
      }
    }

    try {
      res.json(await endpoint(req as CustomRequest, res));
    } catch (err) {
      if (err instanceof JSONRPCErrorException) {
        res.status(400);
        res.json({ error: err.message });
      } else {
        next(err);
      }
    }
  };

  return [...(endpoint.validators ?? []), handler];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function defaultErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err instanceof HttpError) {
    // eslint-disable-next-line no-console
    console.error(`[ERROR][HTTP-${err.status}]`, req.url, err.message);
    res.status(err.status);
    res.json(err.args?.jsonBody || { error: err.message });
    return;
  }

  // eslint-disable-next-line no-console
  console.error('[ERROR][HTTP-500]', req.url, DEBUG ? err : err?.message || err);
  res.status(500);
  res.json({ error: 'Unexpected error' });

  next(err);
}

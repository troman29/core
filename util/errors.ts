// eslint-disable-next-line max-classes-per-file
export class CustomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

type HttpErrorArgs = {
  jsonBody?: object;
  url?: string;
  text?: string;
  shouldSentryCapture?: boolean;
};

export class HttpError extends CustomError {
  constructor(
    message: string,
    public readonly status: number,
    public readonly args?: HttpErrorArgs,
  ) {
    super(message);
  }

  toString() {
    return `${this.name}: ${this.message}\n${this.args?.text}`;
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not found') {
    super(message, 404);
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad request', args?: HttpErrorArgs) {
    super(message, 400, args);
  }
}

export class ValidationError extends BadRequestError {
  constructor(message = 'Validation error', args?: HttpErrorArgs) {
    super(message, args);
  }
}

export class AccessDenied extends HttpError {
  constructor(message = 'Access denied') {
    super(message, 403);
  }
}

export class UnexpectedError extends HttpError {
  constructor(message = 'Unexpected error', args?: HttpErrorArgs) {
    super(message, 500, args);
  }
}

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
    public readonly status?: number,
    public readonly args?: HttpErrorArgs,
  ) {
    super(message);
  }
}

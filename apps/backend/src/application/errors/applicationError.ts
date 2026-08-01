export type ApplicationErrorCode = "unsupported_geography" | "area_not_found";

export class ApplicationError extends Error {
  constructor(
    readonly code: ApplicationErrorCode,
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

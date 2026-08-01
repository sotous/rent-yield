import { ZodError } from "zod";

import { ApplicationError } from "../../application/errors/applicationError.js";

export type ErrorResponse = {
  error: {
    code: string;
    message: string;
    request_id: string | null;
  };
};

export function mapErrorToResponse(error: unknown): {
  statusCode: number;
  body: ErrorResponse;
} {
  if (error instanceof ApplicationError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          request_id: null,
        },
      },
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      body: {
        error: {
          code: "invalid_request",
          message: "The request did not match the prototype API contract.",
          request_id: null,
        },
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: {
        code: "internal_error",
        message: "Something went wrong while loading prototype explorer data.",
        request_id: null,
      },
    },
  };
}

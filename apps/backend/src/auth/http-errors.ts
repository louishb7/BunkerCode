import {
  Catch,
  HttpException,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import { AuthLimited } from "./rate-limit";
import type { Response } from "express";
// Never serialize or log ORM errors: they may contain SQL parameters or connection details.
@Catch()
export class HttpErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof AuthLimited)
      response.setHeader("Retry-After", String(error.retryAfter));
    if (error instanceof HttpException) {
      const body = error.getResponse();
      response
        .status(error.getStatus())
        .json(
          typeof body === "string"
            ? { statusCode: error.getStatus(), message: body }
            : body,
        );
      return;
    }
    response.status(500).json({
      statusCode: 500,
      message: "Não foi possível concluir a operação.",
    });
  }
}

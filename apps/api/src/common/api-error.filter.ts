import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      response
        .status(exception.getStatus())
        .json(typeof body === 'string' ? { message: body } : body);
      return;
    }
    const code = (exception as { code?: string })?.code;
    if (code === 'P2002') {
      response.status(409).json({ message: 'Kode atau nama sudah digunakan.' });
      return;
    }
    if (code === 'P2003') {
      response.status(400).json({ message: 'Referensi data tidak valid.' });
      return;
    }
    // Do not log raw Prisma errors: they may contain credentials or personal data.
    this.logger.error(
      `Unhandled API error (${exception instanceof Error ? exception.name : 'unknown'})`,
    );
    response
      .status(500)
      .json({ message: 'Terjadi kesalahan server. Coba lagi atau hubungi admin.' });
  }
}

import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export function validate<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestException({
      message: 'Data tidak valid.',
      issues: result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  return result.data;
}

export const idSchema = z.uuid();
export const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[A-Z0-9_-]+$/);
export const nameSchema = z.string().trim().min(2).max(120);
export const quantitySchema = z.string().regex(/^\d{1,9}(\.\d{1,6})?$/);

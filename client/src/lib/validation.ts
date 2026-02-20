import { z } from "zod";

const MIN_DATE = new Date();
MIN_DATE.setFullYear(MIN_DATE.getFullYear() - 100);

const MAX_DATE = new Date();
MAX_DATE.setFullYear(MAX_DATE.getFullYear() + 100);

export const MIN_DATE_STR = MIN_DATE.toISOString().split("T")[0];
export const MAX_DATE_STR = MAX_DATE.toISOString().split("T")[0];

export function isReasonableDate(dateStr: string | null | undefined): boolean {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d >= MIN_DATE && d <= MAX_DATE;
}

export const reasonableDateSchema = z
  .string()
  .optional()
  .nullable()
  .refine((val) => isReasonableDate(val), {
    message: "Date must be within the last 100 years and not more than 100 years in the future",
  });

export const requiredReasonableDateSchema = z
  .string()
  .min(1, "Date is required")
  .refine((val) => isReasonableDate(val), {
    message: "Date must be within the last 100 years and not more than 100 years in the future",
  });

export const positiveNumberSchema = z.coerce
  .number()
  .min(0, "Must be a positive number");

export const positiveIntegerSchema = z.coerce
  .number()
  .int("Must be a whole number")
  .min(0, "Must be a positive number");

export const currencySchema = z.coerce
  .number()
  .min(0, "Must be a positive amount")
  .multipleOf(0.01, "Maximum 2 decimal places");

export const percentageSchema = z.coerce
  .number()
  .min(0, "Must be at least 0%")
  .max(100, "Cannot exceed 100%");

export const quantitySchema = z.coerce
  .number()
  .int("Must be a whole number")
  .min(1, "Must be at least 1");

export const dateInputProps = {
  min: MIN_DATE_STR,
  max: MAX_DATE_STR,
} as const;

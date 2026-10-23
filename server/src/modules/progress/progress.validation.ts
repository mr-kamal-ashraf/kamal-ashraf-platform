import { z } from "zod";

export const updateProgressSchema = z.object({
  lastWatchedSecond: z.coerce.number().min(0).max(86400),
  totalSeconds: z.coerce.number().min(0).max(86400).optional(),
});

export type UpdateProgressInput = z.infer<typeof updateProgressSchema>;

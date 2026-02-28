import { z } from "zod";

export const OfficialQuestionSchema = z.object({
  id: z.number().int().positive(),
  text: z.string().trim().min(1),
  answers: z
    .array(z.string().trim().min(1))
    .length(3, "answers.length must be exactly 3"),
  correctIndex: z.number().int().min(0).max(2),
});

export const OfficialBankSchema = z
  .array(OfficialQuestionSchema)
  .length(257, "Official bank must contain exactly 257 questions")
  .superRefine((questions, ctx) => {
    const seenIds = new Set<number>();
    const seenTexts = new Set<string>();

    for (const q of questions) {
      if (seenIds.has(q.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate question id: ${q.id}`,
          path: [q.id],
        });
      }
      seenIds.add(q.id);

      const normText = q.text.replace(/\s+/g, " ").trim();
      if (seenTexts.has(normText)) {
        // warning-like signal in logs; keep schema strict for critical issues only.
        console.warn(`[WARN] Duplicate question text detected for id=${q.id}`);
      }
      seenTexts.add(normText);

      q.answers.forEach((ans, idx) => {
        if (!ans.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Empty answer at question ${q.id}, answer index ${idx}`,
            path: [q.id, "answers", idx],
          });
        }
      });
    }
  });

export type OfficialQuestion = z.infer<typeof OfficialQuestionSchema>;
export type OfficialBank = z.infer<typeof OfficialBankSchema>;

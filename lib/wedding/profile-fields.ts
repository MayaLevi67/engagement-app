import { z } from 'zod';
import { VenueSetting, CeremonyType, Priority } from '@prisma/client';

// --- Field metadata (drives rendering: labels, steps, input types) ---
export type FieldType = 'text' | 'date' | 'number' | 'enum' | 'orderedMulti';

export interface ProfileFieldDef {
  key: string;               // matches a Wedding column
  step: OnboardingStepId;
  type: FieldType;
  labelKey: string;          // i18n key under WeddingProfile
  required?: boolean;
  options?: readonly string[]; // enum / orderedMulti values
  maxSelections?: number;      // orderedMulti
}

export type OnboardingStepId =
  | 'names' | 'date' | 'sizeBudget' | 'style' | 'priorities' | 'done';

export const PRIORITY_OPTIONS = [
  'FOOD', 'PARTY', 'PHOTOGRAPHY', 'GUEST_EXPERIENCE', 'DESIGN', 'FASHION',
] as const satisfies readonly Priority[];

export const VENUE_OPTIONS = ['INDOOR', 'OUTDOOR', 'MIXED'] as const satisfies readonly VenueSetting[];
export const CEREMONY_OPTIONS = ['RELIGIOUS', 'CIVIL', 'MIXED'] as const satisfies readonly CeremonyType[];

export const PROFILE_FIELDS: ProfileFieldDef[] = [
  { key: 'partner1Name', step: 'names', type: 'text', labelKey: 'partner1Name', required: true },
  { key: 'partner2Name', step: 'names', type: 'text', labelKey: 'partner2Name' },
  { key: 'weddingDate', step: 'date', type: 'date', labelKey: 'weddingDate' },
  { key: 'guestCount', step: 'sizeBudget', type: 'number', labelKey: 'guestCount' },
  { key: 'budgetTotal', step: 'sizeBudget', type: 'number', labelKey: 'budgetTotal' },
  { key: 'city', step: 'style', type: 'text', labelKey: 'city' },
  { key: 'venueSetting', step: 'style', type: 'enum', labelKey: 'venueSetting', options: VENUE_OPTIONS },
  { key: 'ceremonyType', step: 'style', type: 'enum', labelKey: 'ceremonyType', options: CEREMONY_OPTIONS },
  { key: 'priorities', step: 'priorities', type: 'orderedMulti', labelKey: 'priorities', options: PRIORITY_OPTIONS, maxSelections: 3 },
];

export const ONBOARDING_STEPS: { id: OnboardingStepId; titleKey: string }[] = [
  { id: 'names', titleKey: 'stepNames' },
  { id: 'date', titleKey: 'stepDate' },
  { id: 'sizeBudget', titleKey: 'stepSizeBudget' },
  { id: 'style', titleKey: 'stepStyle' },
  { id: 'priorities', titleKey: 'stepPriorities' },
  { id: 'done', titleKey: 'stepDone' },
];

// --- Validation schemas (co-located with metadata: single source of truth) ---
// Nullable scalars accept `null` (cleared) as well as `undefined` (untouched)
// so that emptying a field persists `null` instead of being a silent no-op.
const nullableName = z.string().trim().min(1).max(80).nullish();

export const namesSchema = z.object({
  partner1Name: z.string().trim().min(1, 'required').max(80),
  partner2Name: nullableName,
});

export const dateSchema = z.object({
  weddingDate: z.coerce.date().nullable().optional(),
  dateIsApproximate: z.boolean().optional(),
});

export const sizeBudgetSchema = z.object({
  guestCount: z.number().int().min(0).max(100000).nullish(),
  budgetTotal: z.number().int().min(0).max(1000000000).nullish(),
});

export const styleSchema = z.object({
  city: z.string().trim().max(120).nullish(),
  venueSetting: z.nativeEnum(VenueSetting).nullish(),
  ceremonyType: z.nativeEnum(CeremonyType).nullish(),
});

export const prioritiesSchema = z.object({
  priorities: z
    .array(z.nativeEnum(Priority))
    .max(3)
    .refine((arr) => new Set(arr).size === arr.length, 'no duplicates')
    .optional()
    .default([]),
});

export const fullProfileSchema = namesSchema
  .merge(dateSchema)
  .merge(sizeBudgetSchema)
  .merge(styleSchema)
  .merge(prioritiesSchema);

export type WeddingProfileInput = z.infer<typeof fullProfileSchema>;

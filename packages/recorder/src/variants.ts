import type { Step, TestCase } from '@kiemi/schema';
import { elementLabel } from './names';

/** Why a variant should be rejected by the form [M-03]. */
export type VariantReason =
  | 'required'
  | 'email'
  | 'phone'
  | 'date'
  | 'number'
  | 'zero'
  | 'negative'
  | 'belowMin'
  | 'aboveMax'
  | 'tooLong'
  | 'special';

export type VariantKind = 'empty' | 'format' | 'boundary' | 'special';

export interface Variant {
  /** Stable within one call: `<stepId>:<reason>`. */
  id: string;
  stepId: string;
  /** Field name for labels ("Email", "Số ngày"…). */
  field: string;
  kind: VariantKind;
  reason: VariantReason;
  /** Value typed instead of the recorded one. */
  value: string;
}

const SPECIAL = `!@#$%^&*()<>"'\\/;`;

interface FieldInfo {
  type: string;
  required: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  hint: string;
}

function fieldInfo(step: Step): FieldInfo {
  const target = step.params.target as
    | { fingerprint?: { attributes?: Record<string, string>; neighbors?: string[] } }
    | undefined;
  const a = target?.fingerprint?.attributes ?? {};
  const label = elementLabel(step.params.target);
  const num = (v: string | undefined) =>
    v !== undefined && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined;
  const maxLength = num(a.maxlength);
  const min = num(a.min);
  const max = num(a.max);
  return {
    type: (a.type ?? (a.inputmode === 'numeric' ? 'number' : 'text')).toLowerCase(),
    required: 'required' in a || a['aria-required'] === 'true' || /\*\s*$/.test(label),
    ...(maxLength === undefined ? {} : { maxLength }),
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
    hint: [label, a.name, a.id, a.placeholder, a.autocomplete]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  };
}

/**
 * Negative / boundary variants of the recorded form, no AI needed [M-03]: empty
 * required fields, wrong formats (email, phone, date, number), limits (0,
 * negative, min/max, too long) and special characters. The tester ticks the
 * ones to turn into test cases.
 */
export function formVariants(tc: TestCase): Variant[] {
  const out: Variant[] = [];
  for (const step of tc.steps) {
    if (step.action !== 'fill' || !step.enabled) continue;
    const value = String(step.params.value ?? '');
    if (value.includes('{{secret.')) continue;
    const f = fieldInfo(step);
    const field = elementLabel(step.params.target) || step.id;
    const add = (kind: VariantKind, reason: VariantReason, v: string) => {
      if (v !== value)
        out.push({ id: `${step.id}:${reason}`, stepId: step.id, field, kind, reason, value: v });
    };
    if (f.required) add('empty', 'required', '');
    const isEmail = f.type === 'email' || /e-?mail/.test(f.hint);
    const isPhone =
      f.type === 'tel' || /phone|sdt|so dien thoai|số điện thoại|điện thoại|mobile/.test(f.hint);
    const isDate = f.type === 'date' || /dd\/mm|ngày|ngay|date/.test(f.hint);
    const isNumber = f.type === 'number' || f.type === 'range';
    if (isEmail) add('format', 'email', 'abc@');
    if (isPhone) add('format', 'phone', '12ab');
    if (isDate && !isNumber && f.type !== 'date') add('format', 'date', '32/13/2024');
    if (isNumber) {
      add('format', 'number', 'abc');
      add('boundary', 'zero', '0');
      add('boundary', 'negative', '-1');
      if (f.min !== undefined) add('boundary', 'belowMin', String(f.min - 1));
      if (f.max !== undefined) add('boundary', 'aboveMax', String(f.max + 1));
    } else if (f.type !== 'date') {
      add('boundary', 'tooLong', 'a'.repeat((f.maxLength ?? 255) + 1));
      add('special', 'special', SPECIAL);
    }
  }
  return out;
}

/** A copy of the test with one field changed to the variant's value [M-03]. */
export function applyVariant(
  tc: TestCase,
  variant: Variant,
  copy: { id: string; name: string; description?: string },
): TestCase {
  return {
    ...structuredClone(tc),
    id: copy.id,
    name: copy.name,
    ...(copy.description ? { description: copy.description } : {}),
    tags: [...new Set([...tc.tags, 'negative'])],
    steps: tc.steps.map((s) =>
      s.id === variant.stepId
        ? { ...s, params: { ...s.params, value: variant.value } }
        : structuredClone(s),
    ),
  };
}

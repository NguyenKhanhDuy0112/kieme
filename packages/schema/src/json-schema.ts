import { z } from 'zod';
import { TestCaseSchema } from './test-case';
import { CURRENT_SCHEMA_VERSION } from './version';

export const TEST_CASE_SCHEMA_ID = `https://kiemi.app/schema/test-case.v${CURRENT_SCHEMA_VERSION}.json`;

/**
 * JSON Schema (draft 2020-12) of a `.kiemi.json` file, as authors write it
 * (fields with defaults are optional). Cross-field rules stay in Zod only.
 */
export function testCaseJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(TestCaseSchema, { io: 'input', unrepresentable: 'any' }),
    $id: TEST_CASE_SCHEMA_ID,
    title: 'Kiemi test case',
  };
}

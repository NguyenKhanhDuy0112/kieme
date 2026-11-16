import { describe, expect, it } from 'vitest';
import { TEST_CASE_SCHEMA_ID, testCaseJsonSchema } from './json-schema';

describe('testCaseJsonSchema', () => {
  const schema = testCaseJsonSchema();

  it('is a draft 2020-12 object schema with a versioned $id', () => {
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$id).toBe(TEST_CASE_SCHEMA_ID);
    expect(schema.type).toBe('object');
  });

  it('only requires fields without defaults (author view)', () => {
    expect([...(schema.required as string[])].sort()).toEqual(['id', 'name', 'schemaVersion']);
  });

  // Committed file consumed by editors (`$schema` in .kiemi.json). Update: `pnpm test -u`.
  it('matches the committed json-schema/test-case.schema.json', async () => {
    await expect(`${JSON.stringify(schema, null, 2)}\n`).toMatchFileSnapshot(
      '../json-schema/test-case.schema.json',
    );
  });
});

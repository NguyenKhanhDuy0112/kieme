import { describe, expect, it } from 'vitest';
import { notesFor, versionFromTag } from './release-notes.mjs';

const CHANGELOG = `# @kiemi/desktop

## 1.2.0

### Minor Changes

- abc123: Thêm bước "Chọn ngày" trên lịch

### Patch Changes

- def456: Sửa lỗi xuất báo cáo

## 1.1.0

### Minor Changes

- 111111: Bản cũ
`;

describe('release notes from CHANGELOG [N-11]', () => {
  it('takes only the section of the released version', () => {
    const notes = notesFor(CHANGELOG, '1.2.0');
    expect(notes).toContain('Thêm bước "Chọn ngày" trên lịch');
    expect(notes).toContain('Sửa lỗi xuất báo cáo');
    expect(notes).not.toContain('Bản cũ');
    expect(notes.startsWith('### Minor Changes')).toBe(true);
    expect(notesFor(CHANGELOG, '1.1.0')).toBe('### Minor Changes\n\n- 111111: Bản cũ');
    expect(notesFor(CHANGELOG, '9.9.9')).toBe('');
  });

  it('reads the version from a release tag', () => {
    expect(versionFromTag('v1.2.0')).toBe('1.2.0');
    expect(versionFromTag('v1.2.0-beta.1')).toBe('1.2.0-beta.1');
    expect(versionFromTag('1.2.0')).toBeUndefined();
    expect(versionFromTag('vX')).toBeUndefined();
  });
});

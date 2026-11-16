import { describe, expect, it } from 'vitest';
import { elementLabel, secretRef, suggestSecretName, toIdentifier } from './names';

describe('names [K-05]', () => {
  it('turns Vietnamese labels into identifiers', () => {
    expect(toIdentifier('Mật khẩu đăng nhập')).toBe('matKhauDangNhap');
    expect(toIdentifier('Số điện thoại (*)')).toBe('soDienThoai');
    expect(toIdentifier('2 bước')).toBe('_2Buoc');
    expect(toIdentifier('***')).toBe('value');
  });

  it('labels elements by accessible name, label, placeholder, then attributes', () => {
    expect(
      elementLabel({ strategies: [{ kind: 'role', role: 'textbox', name: 'Mật khẩu' }] }),
    ).toBe('Mật khẩu');
    expect(elementLabel({ strategies: [{ kind: 'placeholder', value: 'Email' }] })).toBe('Email');
    expect(
      elementLabel({
        strategies: [{ kind: 'css', value: '#pw' }],
        fingerprint: { tag: 'input', attributes: { name: 'pwd' }, neighbors: [] },
      }),
    ).toBe('pwd');
  });

  it('proposes a free secret name and references it', () => {
    const t = { strategies: [{ kind: 'label', value: 'Mật khẩu' }] };
    expect(suggestSecretName(t)).toBe('matKhau');
    expect(suggestSecretName(t, ['matKhau', 'matKhau2'])).toBe('matKhau3');
    expect(suggestSecretName({ strategies: [{ kind: 'css', value: '#x' }] })).toBe('matKhau');
    expect(secretRef('matKhau')).toBe('{{secret.matKhau}}');
  });
});

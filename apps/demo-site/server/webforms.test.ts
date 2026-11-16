import { describe, expect, it } from 'vitest';
import { decodeViewState, encodeViewState, handleWebForms } from './webforms';

const ctlOf = (html: string) => html.match(/ctl00_MainContent_(ctl\d+)_txtHoTen/)?.[1];
const viewState = (html: string) =>
  html.match(/name="__VIEWSTATE" id="__VIEWSTATE" value="([^"]*)"/)?.[1] ?? '';

function seq(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
}

describe('fake WebForms page', () => {
  it('changes control IDs on every render', () => {
    const rand = seq(0.1, 0.9);
    const a = handleWebForms(null, rand);
    const b = handleWebForms(null, rand);
    expect(ctlOf(a)).toBeDefined();
    expect(ctlOf(a)).not.toBe(ctlOf(b));
  });

  it('saves a name on postback and keeps it in view state', () => {
    const vs = encodeViewState({ province: 'HN', savedNames: [] });
    const html = handleWebForms({
      __EVENTTARGET: '',
      __VIEWSTATE: vs,
      ctl00$MainContent$ctl42$txtHoTen: 'Phạm Hoa',
      ctl00$MainContent$ctl42$ddlTinh: 'HN',
      ctl00$MainContent$ctl42$ddlQuan: 'Cầu Giấy',
      ctl00$MainContent$ctl42$btnLuu: 'Lưu',
    });
    expect(html).toContain('Đã lưu nhân viên: Phạm Hoa');
    expect(decodeViewState(viewState(html)).savedNames).toEqual(['Phạm Hoa — Cầu Giấy, Hà Nội']);
  });

  it('rejects an empty name', () => {
    const html = handleWebForms({
      ctl00$MainContent$ctl11$txtHoTen: ' ',
      ctl00$MainContent$ctl11$btnLuu: 'Lưu',
    });
    expect(html).toContain('Họ tên không được để trống');
  });

  it('reloads districts when the province auto-posts back', () => {
    const html = handleWebForms({
      __EVENTTARGET: 'ctl00$MainContent$ctl20$ddlTinh',
      ctl00$MainContent$ctl20$ddlTinh: 'HCM',
    });
    expect(html).toContain('<option value="HCM" selected>');
    expect(html).toContain('Bình Thạnh');
    expect(html).not.toContain('Hoàn Kiếm');
  });

  it('clears the list via the LinkButton postback', () => {
    const vs = encodeViewState({ province: 'DN', savedNames: ['A', 'B'] });
    const html = handleWebForms({
      __EVENTTARGET: 'ctl00$MainContent$ctl33$lnkXoaHet',
      __VIEWSTATE: vs,
    });
    expect(decodeViewState(viewState(html))).toEqual({ province: 'DN', savedNames: [] });
    expect(html).toContain('Chưa có dữ liệu');
  });

  it('falls back to defaults on a corrupt view state', () => {
    expect(decodeViewState('%%%')).toEqual({ province: 'HN', savedNames: [] });
  });
});

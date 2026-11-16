import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  exportBundle,
  exportTestCase,
  importBundle,
  importTestCase,
  safeFileName,
} from './io/bundle';
import { createMemoryServices } from './testing';

function sampleProject() {
  const { services: s, defaultProjectId: projectId } = createMemoryServices();
  const folder = s.folders.create({ projectId, name: 'Nghỉ phép' });
  const sub = s.folders.create({ projectId, parentId: folder.id, name: 'Duyệt' });
  const login = s.sharedSteps.create({
    projectId,
    name: 'Đăng nhập',
    params: ['user'],
    steps: [{ id: 'l1', action: 'goto', params: { url: '/login' } }],
  });
  const t = s.testCases.create({ projectId, folderId: sub.id, name: 'Tạo / duyệt: đơn?' });
  s.testCases.save(t.id, {
    ...t.content,
    steps: [{ id: 's1', action: 'call', params: { shared: login.id, args: { user: 'an' } } }],
  });
  const t2 = s.testCases.create({ projectId, name: 'Đơn khác' });
  const env = s.environments.list(projectId)[0] as { id: string };
  s.environments.setVariables(env.id, { portal: 'https://p' });
  s.environments.setSecret(env.id, 'nvPass', 'TOP-SECRET');
  const ds = s.datasets.create({
    projectId,
    name: 'Dữ liệu',
    columns: ['ma'],
    rows: [{ ma: 'A1' }],
  });
  const suite = s.suites.create({ projectId, name: 'Hồi quy', environmentId: env.id });
  s.suites.setItems(suite.id, [{ testCaseId: t.id, datasetId: ds.id }]);
  s.elements.create({
    projectId,
    name: 'Nút Lưu',
    locator: { strategies: [{ kind: 'text', value: 'Lưu' }] },
  });
  return { s, projectId, t, t2, login, suite, ds };
}

describe('export / import [J-03]', () => {
  it('makes safe file names', () => {
    expect(safeFileName('Tạo / duyệt: đơn?')).toBe('Tạo duyệt đơn');
    expect(safeFileName('...')).toBe('test');
  });

  it('exports one test as .kiemi.json and imports it (fresh id, any older version)', () => {
    const { s, projectId, t, login } = sampleProject();
    const out = exportTestCase(s, t.id);
    expect(out.fileName).toBe('Tạo duyệt đơn.kiemi.json');
    const report = importTestCase(s, projectId, null, out.content);
    const imported = s.testCases.get(report.testCaseIds[0] as string);
    expect(imported.id).not.toBe(t.id);
    expect(imported.content.id).toBe(imported.id);
    expect(report.missingSharedSteps).toEqual([]);
    expect(imported.content.steps[0]?.params).toMatchObject({ shared: login.id });
    expect(() => importTestCase(s, projectId, null, '{nope')).toThrow(/not valid JSON/);
    expect(() =>
      importTestCase(s, projectId, null, JSON.stringify({ schemaVersion: 99 })),
    ).toThrow();
  });

  it('reports shared steps missing in the target project', () => {
    const { s, t } = sampleProject();
    const other = s.projects.create({ name: 'Khác' });
    const report = importTestCase(s, other.id, null, exportTestCase(s, t.id).content);
    expect(report.missingSharedSteps).toHaveLength(1);
  });

  it('round-trips a whole project through .zip with new ids and no secret values', () => {
    const { s, projectId } = sampleProject();
    const { fileName, data } = exportBundle(s, { projectId });
    expect(fileName).toBe('Dự án đầu tiên.zip');
    const files = unzipSync(data);
    expect(Object.keys(files).sort()).toEqual(
      [
        'kiemi.json',
        'tests/Nghỉ phép/Duyệt/Tạo duyệt đơn.kiemi.json',
        'tests/Đơn khác.kiemi.json',
      ].sort(),
    );
    const allText = Object.values(files)
      .map((f) => strFromU8(f))
      .join('\n');
    expect(allText).not.toContain('TOP-SECRET');

    const report = importBundle(s, data, { projectName: 'Bản nhập' });
    expect(report.skipped).toEqual([]);
    expect(report.missingSecrets).toEqual([{ environment: 'Mặc định', names: ['nvPass'] }]);
    expect(report.missingSharedSteps).toEqual([]);
    const p = report.projectId;
    expect(s.projects.get(p).name).toBe('Bản nhập');
    const folders = s.folders.list(p);
    expect(folders.map((f) => f.name).sort()).toEqual(['Duyệt', 'Nghỉ phép']);
    const sub = folders.find((f) => f.name === 'Duyệt');
    expect(folders.find((f) => f.id === sub?.parentId)?.name).toBe('Nghỉ phép');
    const tests = s.testCases.list(p);
    expect(tests.map((x) => x.name).sort()).toEqual(['Tạo / duyệt: đơn?', 'Đơn khác']);
    const moved = s.testCases.get(tests.find((x) => x.folderId === sub?.id)?.id as string);
    const newShared = s.sharedSteps.list(p)[0];
    expect(moved.content.steps[0]?.params).toMatchObject({ shared: newShared?.id });
    const suite = s.suites.list(p)[0];
    const items = s.suites.get(suite?.id as string).items;
    expect(items[0]).toMatchObject({ testCaseId: moved.id, datasetId: s.datasets.list(p)[0]?.id });
    expect(suite?.environmentId).toBe(s.environments.list(p)[0]?.id);
    expect(s.environments.variables(s.environments.list(p)[0]?.id as string)).toEqual({
      portal: 'https://p',
    });
    expect(s.elements.list(p)).toHaveLength(1);
  });

  it('exports one suite with only its tests and data', () => {
    const { s, suite } = sampleProject();
    const { data, fileName } = exportBundle(s, { suiteId: suite.id });
    expect(fileName).toBe('Dự án đầu tiên - Hồi quy.zip');
    const files = Object.keys(unzipSync(data));
    expect(files.filter((f) => f.startsWith('tests/'))).toEqual(['tests/Tạo duyệt đơn.kiemi.json']);
    const report = importBundle(s, data);
    expect(report.testCaseIds).toHaveLength(1);
  });

  it('rejects foreign or broken bundles clearly', () => {
    const { s } = sampleProject();
    const reason = (data: Uint8Array) => {
      try {
        importBundle(s, data);
      } catch (e) {
        return (e as { details?: { reason?: string } }).details?.reason;
      }
      return 'ok';
    };
    expect(reason(new Uint8Array([1, 2, 3]))).toBe('badZip');
    expect(reason(zipSync({ 'a.txt': strToU8('x') }))).toBe('noManifest');
    expect(reason(zipSync({ 'kiemi.json': strToU8('{bad') }))).toBe('badJson');
    expect(
      reason(
        zipSync({
          'kiemi.json': strToU8(JSON.stringify({ format: 'kiemi-bundle', formatVersion: 9 })),
        }),
      ),
    ).toBe('newerVersion');
  });

  it('skips a broken test file but imports the rest', () => {
    const { s, projectId } = sampleProject();
    const files = unzipSync(exportBundle(s, { projectId }).data);
    files['tests/Đơn khác.kiemi.json'] = strToU8('{oops');
    const report = importBundle(s, zipSync(files));
    expect(report.testCaseIds).toHaveLength(1);
    expect(report.skipped).toEqual([{ file: 'tests/Đơn khác.kiemi.json', reason: 'badJson' }]);
  });
});

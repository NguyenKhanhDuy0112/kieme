/** Product identity constants shared across all Kiemi packages. */
export const BRAND = {
  name: 'Kiemi',
  appId: 'app.kiemi.desktop',
  testFileExtension: '.kiemi.json',
  colors: {
    primary: '#1F2A5C',
    pass: '#3DDC84',
    fail: '#E5484D',
    white: '#FFFFFF',
  },
} as const;

/** Returns true when a file name looks like a Kiemi test file. */
export function isKiemiTestFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(BRAND.testFileExtension);
}

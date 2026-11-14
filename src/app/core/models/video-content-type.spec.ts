import { videoContentType } from './video-content-type';

function fileOf(name: string, type = ''): File {
  return new File(['contenido'], name, { type });
}

describe('videoContentType', () => {
  it('keeps the type reported by the browser', () => {
    expect(videoContentType(fileOf('camara.mp4', 'video/mp4'))).toBe('video/mp4');
    expect(videoContentType(fileOf('camara.mkv', 'video/custom'))).toBe('video/custom');
  });

  it.each([
    ['camara.mp4', 'video/mp4'],
    ['camara.mov', 'video/quicktime'],
    ['camara.avi', 'video/x-msvideo'],
    ['camara.mkv', 'video/x-matroska'],
    ['camara.webm', 'video/webm'],
    ['CAMARA.MKV', 'video/x-matroska']
  ])('infers the type of %s', (name, expected) => {
    expect(videoContentType(fileOf(name))).toBe(expected);
  });

  it('returns an empty string for unknown extensions', () => {
    expect(videoContentType(fileOf('notas.txt'))).toBe('');
    expect(videoContentType(fileOf('sinextension'))).toBe('');
  });
});

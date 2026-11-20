import { chartTheme, resolveCssValue } from './chart-factory';

describe('resolveCssValue', () => {
  const root = document.documentElement;

  afterEach(() => {
    root.style.removeProperty('--prueba-color');
    root.style.removeProperty('--prueba-alias');
  });

  it('reads a custom property from the document root, following aliases', () => {
    root.style.setProperty('--prueba-color', '#3987e5');
    root.style.setProperty('--prueba-alias', 'var(--prueba-color)');

    expect(resolveCssValue('var(--prueba-color)')).toBe('#3987e5');
    expect(resolveCssValue('var(--prueba-alias)')).toBe('#3987e5');
  });

  it('returns plain values and unknown properties unchanged', () => {
    expect(resolveCssValue('#ffffff')).toBe('#ffffff');
    expect(resolveCssValue('var(--no-existe)')).toBe('var(--no-existe)');
  });
});

describe('chartTheme', () => {
  it('takes the text, grid, surface and font tokens', () => {
    expect(chartTheme(value => `<${value}>`)).toEqual({
      text: '<var(--texto)>',
      mutedText: '<var(--texto-secundario)>',
      grid: '<var(--borde)>',
      surface: '<var(--superficie)>',
      font: '<var(--fuente)>'
    });
  });
});

import { ActivityCamera } from '../../core/models/activity.model';
import {
  MAX_SLICES,
  OTHERS_COLOR,
  cameraShares,
  formatPercent,
  rankedBars,
  seriesColor,
  shareSummary,
  shareTitle
} from './camera-share';

function camera(cameraId: string, cameraName: string, count: number): ActivityCamera {
  return { cameraId, cameraName, count };
}

const LIVE = [
  camera('c0', 'Entrada Principal', 26),
  camera('c2', 'Zona Común Piscina', 25),
  camera('c1', 'Parqueadero A', 24),
  camera('c9', 'Torre 1', 6)
];
const ORDER = ['c0', 'c1', 'c9', 'c2'];

describe('cameraShares', () => {
  it('follows the given camera order and gives each camera the next series colour', () => {
    const shares = cameraShares(LIVE, ORDER);

    expect(shares.map(share => share.name)).toEqual([
      'Entrada Principal', 'Parqueadero A', 'Torre 1', 'Zona Común Piscina'
    ]);
    expect(shares.map(share => share.color)).toEqual([
      seriesColor(1), seriesColor(2), seriesColor(3), seriesColor(4)
    ]);
  });

  it('computes each share as a percentage of the total with one decimal', () => {
    const shares = cameraShares(LIVE, ORDER);

    expect(shares.map(share => share.percent)).toEqual([32.1, 29.6, 7.4, 30.9]);
    expect(shares.map(share => share.count)).toEqual([26, 24, 6, 25]);
  });

  it('puts cameras missing from the order last, by name, and drops empty ones', () => {
    const shares = cameraShares([
      camera('x2', 'Bodega', 3),
      camera('c0', 'Entrada Principal', 5),
      camera('x1', 'Azotea', 2),
      camera('c1', 'Parqueadero A', 0)
    ], ORDER);

    expect(shares.map(share => share.name)).toEqual(['Entrada Principal', 'Azotea', 'Bodega']);
  });

  it('keeps the five largest and folds the rest into Otras beyond six cameras', () => {
    const many = [1, 2, 3, 4, 5, 6, 7].map(n => camera(`k${n}`, `Cámara ${n}`, n * 10));
    const shares = cameraShares(many, many.map(entry => entry.cameraId));

    expect(shares.length).toBe(MAX_SLICES);
    expect(shares.map(share => share.name)).toEqual([
      'Cámara 3', 'Cámara 4', 'Cámara 5', 'Cámara 6', 'Cámara 7', 'Otras'
    ]);
    expect(shares[5].count).toBe(30);
    expect(shares[5].color).toBe(OTHERS_COLOR);
    expect(shares[5].cameraId).toBeNull();
    expect(shares.slice(0, 5).map(share => share.color)).toEqual([1, 2, 3, 4, 5].map(seriesColor));
  });

  it('keeps exactly six cameras without folding', () => {
    const six = [1, 2, 3, 4, 5, 6].map(n => camera(`k${n}`, `Cámara ${n}`, n));
    expect(cameraShares(six, six.map(entry => entry.cameraId)).map(share => share.name))
      .not.toContain('Otras');
  });

  it('returns nothing when there are no detections', () => {
    expect(cameraShares([camera('c0', 'Entrada', 0)], ORDER)).toEqual([]);
  });
});

describe('rankedBars', () => {
  it('sorts the cameras by count and keeps each camera colour', () => {
    const bars = rankedBars(cameraShares(LIVE, ORDER));

    expect(bars.map(bar => bar.name)).toEqual([
      'Entrada Principal', 'Zona Común Piscina', 'Parqueadero A', 'Torre 1'
    ]);
    expect(bars[1].color).toBe(seriesColor(4));
    expect(bars[0].title).toBe('Entrada Principal: 26 detecciones, 32,1 %');
  });
});

describe('texts', () => {
  it('writes one decimal with a comma', () => {
    expect(formatPercent(7.4)).toBe('7,4 %');
    expect(formatPercent(100)).toBe('100,0 %');
  });

  it('uses the singular for one detection', () => {
    expect(shareTitle({ key: 'c', cameraId: 'c', name: 'Torre 1', count: 1, percent: 50, color: '' }))
      .toBe('Torre 1: 1 detección, 50,0 %');
  });

  it('summarises the shares for screen readers', () => {
    expect(shareSummary(cameraShares(LIVE, ORDER))).toBe(
      'Detecciones por cámara: Entrada Principal 32,1 %, Parqueadero A 29,6 %, ' +
      'Torre 1 7,4 %, Zona Común Piscina 30,9 %'
    );
    expect(shareSummary([])).toBe('Detecciones por cámara: no hay detecciones');
  });
});

import {
  describeVideoTimings,
  formatDetectionCount,
  formatDuration
} from './duration-format';

describe('duration format', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatDuration(0)).toBe('0 s');
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(60)).toBe('1 min');
    expect(formatDuration(80)).toBe('1 min 20 s');
    expect(formatDuration(3600)).toBe('1 h');
    expect(formatDuration(3900)).toBe('1 h 5 min');
  });

  it('rounds fractions and clamps negatives to zero', () => {
    expect(formatDuration(44.6)).toBe('45 s');
    expect(formatDuration(-5)).toBe('0 s');
  });

  it('uses the singular for one detection', () => {
    expect(formatDetectionCount(1)).toBe('1 detección');
    expect(formatDetectionCount(0)).toBe('0 detecciones');
    expect(formatDetectionCount(3)).toBe('3 detecciones');
  });

  it('joins every known part with commas', () => {
    expect(
      describeVideoTimings({
        queueWaitSeconds: 12,
        processingSeconds: 80,
        faceCount: 3
      })
    ).toBe('En cola 12 s, procesado en 1 min 20 s, 3 detecciones');
  });

  it('hides the parts that are missing', () => {
    expect(describeVideoTimings({ queueWaitSeconds: 12 })).toBe('En cola 12 s');
    expect(
      describeVideoTimings({ queueWaitSeconds: null, processingSeconds: null, faceCount: 2 })
    ).toBe('2 detecciones');
    expect(describeVideoTimings({})).toBe('');
  });
});

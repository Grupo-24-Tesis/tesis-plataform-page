import { Injectable } from '@angular/core';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  ChartType,
  Legend,
  LinearScale,
  PieController,
  Title,
  Tooltip
} from 'chart.js';

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  PieController,
  Title,
  Tooltip
);

export interface ChartHandle {
  destroy(): void;
}

export type ValueResolver = (value: string) => string;

const CSS_VARIABLE = /^var\((--[\w-]+)\)$/;

export function resolveCssValue(value: string): string {
  const match = CSS_VARIABLE.exec(value.trim());

  if (!match || typeof document === 'undefined') {
    return value;
  }

  const resolved = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();

  if (!resolved) {
    return value;
  }

  return resolveCssValue(resolved);
}

export interface ChartTheme {
  text: string;
  mutedText: string;
  grid: string;
  surface: string;
  font: string;
}

export function chartTheme(resolve: ValueResolver): ChartTheme {
  return {
    text: resolve('var(--texto)'),
    mutedText: resolve('var(--texto-secundario)'),
    grid: resolve('var(--borde)'),
    surface: resolve('var(--superficie)'),
    font: resolve('var(--fuente)')
  };
}

@Injectable({ providedIn: 'root' })
export class ChartFactory {
  readonly resolve: ValueResolver = resolveCssValue;

  create<T extends ChartType>(canvas: HTMLCanvasElement, config: ChartConfiguration<T>): ChartHandle {
    return new Chart(canvas, config);
  }
}

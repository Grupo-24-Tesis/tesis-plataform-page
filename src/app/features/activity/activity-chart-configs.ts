import { ChartConfiguration, TooltipItem } from 'chart.js';

import { ActivityHour } from '../../core/models/activity.model';
import { ValueResolver, chartTheme } from '../../shared/charts/chart-factory';
import { FollowUpSegment, VideoBar, detectionsText } from './activity-breakdowns';
import { CameraShare, formatPercent, rankedBars } from './camera-share';

const PIE_TITLE = 'Porcentaje de detecciones por cámara';
const BAR_TITLE = 'Detecciones por cámara';
const VIDEO_TITLE = 'Detecciones por video';
const FOLLOW_UP_TITLE = 'Seguimiento de las detecciones';
const LABEL_EVERY = 3;

function shareLabel(share: CameraShare | undefined): string {
  return share ? `${detectionsText(share.count)}, ${formatPercent(share.percent)}` : '';
}

function titleOptions(text: string, color: string, font: string) {
  return {
    display: true,
    text,
    color,
    font: { family: font, size: 13, weight: 600 as const },
    padding: { bottom: 12 }
  };
}

export function cameraPieConfig(shares: CameraShare[], resolve: ValueResolver): ChartConfiguration<'pie'> {
  const theme = chartTheme(resolve);

  return {
    type: 'pie',
    data: {
      labels: shares.map(share => share.name),
      datasets: [
        {
          label: 'Detecciones',
          data: shares.map(share => share.count),
          backgroundColor: shares.map(share => resolve(share.color)),
          borderColor: theme.surface,
          borderWidth: 2,
          hoverOffset: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: theme.mutedText, font: { family: theme.font, size: 12 }, boxWidth: 12, boxHeight: 12 }
        },
        title: titleOptions(PIE_TITLE, theme.text, theme.font),
        tooltip: {
          callbacks: {
            label: (item: TooltipItem<'pie'>) => shareLabel(shares[item.dataIndex])
          }
        }
      }
    }
  };
}

export function cameraBarConfig(shares: CameraShare[], resolve: ValueResolver): ChartConfiguration<'bar'> {
  const theme = chartTheme(resolve);
  const bars = rankedBars(shares);

  return {
    type: 'bar',
    data: {
      labels: bars.map(bar => bar.name),
      datasets: [
        {
          label: 'Detecciones',
          data: bars.map(bar => bar.count),
          backgroundColor: bars.map(bar => resolve(bar.color)),
          borderRadius: 4,
          borderSkipped: 'start',
          maxBarThickness: 28
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0, color: theme.mutedText, font: { family: theme.font } },
          grid: { color: theme.grid }
        },
        y: {
          ticks: { color: theme.text, font: { family: theme.font, size: 12 } },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { display: false },
        title: titleOptions(BAR_TITLE, theme.text, theme.font),
        tooltip: {
          callbacks: {
            label: (item: TooltipItem<'bar'>) => shareLabel(bars[item.dataIndex])
          }
        }
      }
    }
  };
}

export function hourBarConfig(hours: ActivityHour[], resolve: ValueResolver): ChartConfiguration<'bar'> {
  const theme = chartTheme(resolve);

  return {
    type: 'bar',
    data: {
      labels: hours.map(entry => String(entry.hour)),
      datasets: [
        {
          label: 'Detecciones',
          data: hours.map(entry => entry.count),
          backgroundColor: resolve('var(--azul)'),
          borderRadius: 4,
          borderSkipped: 'start'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: {
            autoSkip: false,
            maxRotation: 0,
            color: theme.mutedText,
            font: { family: theme.font, size: 11 },
            callback: (_value: string | number, index: number) =>
              index % LABEL_EVERY === 0 ? String(hours[index]?.hour ?? index) : ''
          },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { precision: 0, color: theme.mutedText, font: { family: theme.font } },
          grid: { color: theme.grid }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items: TooltipItem<'bar'>[]) => `${hours[items[0]?.dataIndex]?.hour ?? ''} h`,
            label: (item: TooltipItem<'bar'>) => detectionsText(hours[item.dataIndex]?.count ?? 0)
          }
        }
      }
    }
  };
}

export function videoBarConfig(bars: VideoBar[], resolve: ValueResolver): ChartConfiguration<'bar'> {
  const theme = chartTheme(resolve);

  return {
    type: 'bar',
    data: {
      labels: bars.map(bar => bar.label),
      datasets: [
        {
          label: 'Detecciones',
          data: bars.map(bar => bar.count),
          backgroundColor: bars.map(bar => resolve(bar.color)),
          borderRadius: 4,
          borderSkipped: 'start',
          maxBarThickness: 28
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0, color: theme.mutedText, font: { family: theme.font } },
          grid: { color: theme.grid }
        },
        y: {
          ticks: { color: theme.text, font: { family: theme.font, size: 12 } },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { display: false },
        title: titleOptions(VIDEO_TITLE, theme.text, theme.font),
        tooltip: {
          callbacks: {
            label: (item: TooltipItem<'bar'>) => bars[item.dataIndex]?.title ?? ''
          }
        }
      }
    }
  };
}

export function followUpConfig(
  segments: FollowUpSegment[],
  total: number,
  resolve: ValueResolver
): ChartConfiguration<'bar'> {
  const theme = chartTheme(resolve);

  return {
    type: 'bar',
    data: {
      labels: ['Detecciones'],
      datasets: segments.map(segment => ({
        label: segment.label,
        data: [segment.count],
        backgroundColor: resolve(segment.color),
        borderColor: theme.surface,
        borderWidth: 2,
        borderSkipped: false,
        borderRadius: 4,
        barThickness: 36,
        stack: 'seguimiento'
      }))
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          beginAtZero: true,
          max: total,
          ticks: { precision: 0, color: theme.mutedText, font: { family: theme.font } },
          grid: { color: theme.grid }
        },
        y: {
          stacked: true,
          ticks: { display: false },
          grid: { display: false }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: theme.mutedText,
            font: { family: theme.font, size: 12 },
            boxWidth: 12,
            boxHeight: 12,
            filter: (item: { datasetIndex?: number }) => (segments[item.datasetIndex ?? -1]?.count ?? 0) > 0
          }
        },
        title: titleOptions(FOLLOW_UP_TITLE, theme.text, theme.font),
        tooltip: {
          callbacks: {
            title: () => '',
            label: (item: TooltipItem<'bar'>) => segments[item.datasetIndex]?.title ?? ''
          }
        }
      }
    }
  };
}

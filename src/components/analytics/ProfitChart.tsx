'use client';

import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ProfitChartProps {
  data: {
    date: string;
    profit: number;
    cumulative: number;
  }[];
}

export function ProfitChart({ data }: ProfitChartProps) {
  const chartData = useMemo(() => {
    return {
      labels: data.map((d) => d.date),
      datasets: [
        {
          label: 'Cumulative Profit',
          data: data.map((d) => d.cumulative),
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [data]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        titleColor: 'white',
        bodyColor: 'rgb(148, 163, 184)',
        borderColor: 'rgb(51, 65, 85)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context: { raw: unknown }) => {
            const value = context.raw as number;
            return `$${value.toFixed(2)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(51, 65, 85, 0.5)',
        },
        ticks: {
          color: 'rgb(148, 163, 184)',
          maxTicksLimit: 10,
        },
      },
      y: {
        grid: {
          color: 'rgba(51, 65, 85, 0.5)',
        },
        ticks: {
          color: 'rgb(148, 163, 184)',
          callback: (value: unknown) => `$${value}`,
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  };

  return (
    <div className="h-64">
      <Line data={chartData} options={options} />
    </div>
  );
}

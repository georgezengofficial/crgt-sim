import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { COLORS } from '../lib/model';

export default function ChoiceChart({ labels, datasets, height = 240 }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const ctx = canvasRef.current.getContext('2d');
    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
          legend: {
            labels: {
              color: '#c9d8ec',
              font: { size: 11, weight: '500' },
              boxWidth: 14,
              padding: 12
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: '#1a212b',
            titleColor: '#e6edf5',
            bodyColor: '#c9d8ec',
            borderColor: COLORS.border,
            borderWidth: 1
          }
        },
        scales: {
          x: {
            ticks: { color: '#8fa4bc', font: { size: 10 }, maxTicksLimit: 30 },
            grid: { color: '#1a212b', drawBorder: false }
          },
          y: {
            min: 0,
            max: 100,
            ticks: {
              color: '#8fa4bc',
              font: { size: 10 },
              callback: v => v + '%'
            },
            grid: { color: '#1a212b', drawBorder: false }
          }
        },
        interaction: { intersect: false, mode: 'index' }
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [labels, datasets]);

  return (
    <div className="chart-wrap" style={{ height }}>
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}
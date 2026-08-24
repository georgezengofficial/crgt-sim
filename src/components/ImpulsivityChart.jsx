import BarChart from './BarChart';
import { COLORS } from '../lib/model';

export default function ImpulsivityChart({ labels, actualData, simulatedData, mode }) {
  const datasets = [];

  if (mode === 'explore' || !actualData) {
    datasets.push({
      label: 'Premature Response Rate',
      data: simulatedData,
      backgroundColor: COLORS.prem + '80',
      borderColor: COLORS.prem,
      borderWidth: 1.5,
      borderRadius: 3
    });
  } else {
    datasets.push({
      label: 'Actual premature',
      data: actualData,
      backgroundColor: COLORS.prem + '66',
      borderColor: COLORS.prem,
      borderWidth: 1.5,
      borderRadius: 3
    });
    datasets.push({
      label: 'Simulated premature',
      data: simulatedData,
      backgroundColor: 'transparent',
      borderColor: COLORS.prem,
      borderWidth: 2,
      borderDash: [6, 4],
      borderRadius: 3
    });
  }

  return <BarChart labels={labels} datasets={datasets} />;
}
import { useEffect, useState } from 'react';
import ChoiceChart from './ChoiceChart';
import { COLORS } from '../lib/model';

export default function ValidationPanel({ validation, onRunValidation, validating }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && !validation && !validating) {
      onRunValidation();
    }
  }, [open, validation, validating, onRunValidation]);

  return (
    <div className="card validation-card">
      <button className="validation-toggle btn secondary" onClick={() => setOpen(o => !o)}>
        {open ? 'Hide Validation' : 'Show Validation'}
      </button>

      {open && (
        <div className="validation-body">
          {validating && <div className="status-badge">running validation…</div>}

          {validation?.error && <div className="warn-box">{validation.error}</div>}

          {validation && !validation.error && (
            <>
              <div className="card-title">75/25 Validation Results</div>
              <div className="card-sub">
                Fit on {validation.trainIds.length} rats ({validation.trainIds.join(', ')}), held out{' '}
                {validation.testIds.length} rats ({validation.testIds.join(', ')}). Population params =
                mean of individual training fits — a naive estimate, not a hierarchical/pooled fit.
              </div>

              <div className="metrics-row" style={{ marginBottom: 16 }}>
                <div className="metric-card">
                  <div className="metric-label">Pop. α-win / α-loss / β</div>
                  <div className="metric-value" style={{ fontSize: '16px' }}>
                    {validation.popParams.alphaWin.toFixed(2)} /{' '}
                    {validation.popParams.alphaLoss.toFixed(2)} / {validation.popParams.beta.toFixed(2)}
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Held-out Log-lik / trial</div>
                  <div className="metric-value">{validation.avgLLPerTrial.toFixed(3)}</div>
                  <div className="sub">vs. {validation.chanceLLPerTrial.toFixed(3)} chance</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Curve Correlation</div>
                  <div className="metric-value">
                    {validation.corr !== null ? validation.corr.toFixed(3) : 'n/a'}
                  </div>
                  <div className="sub">actual vs. predicted choice %</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Mean Abs. Error</div>
                  <div className="metric-value">
                    {validation.mae.toFixed(1)}<span className="unit">pts</span>
                  </div>
                  <div className="sub">choice % per block</div>
                </div>
              </div>

              <div className="chart-title">
                Actual (solid) vs. Model-Predicted (dashed) Choice Curves — Held-out Rats
                <small>averaged across held-out rats, 10-trial blocks</small>
              </div>

              <ChoiceChart
                labels={validation.actualAvgBlocks.map(b => `B${b.block}`)}
                datasets={[
                  ...['p1', 'p2', 'p3', 'p4'].flatMap(key => [
                    {
                      label: `${key.toUpperCase()} actual`,
                      data: validation.actualAvgBlocks.map(b => b[key]),
                      borderColor: COLORS[key.toUpperCase()],
                      borderWidth: 2.5,
                      pointRadius: 0,
                      tension: 0.3,
                      fill: false
                    },
                    {
                      label: `${key.toUpperCase()} predicted`,
                      data: validation.predictedAvgBlocks.map(b => b[key]),
                      borderColor: COLORS[key.toUpperCase()],
                      borderWidth: 2,
                      borderDash: [5, 4],
                      pointRadius: 0,
                      tension: 0.3,
                      fill: false
                    }
                  ])
                ]}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
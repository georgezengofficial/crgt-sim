export default function MetricsRow({ metrics }) {
  const { optimalPct, premTotal, winStayProb, loseShiftProb, winRate } = metrics;

  return (
    <div className="metrics-row">
      <div className="metric-card">
        <div className="metric-label">Optimal Choice (P2)</div>
        <div className="metric-value">
          {optimalPct.toFixed(1)}<span className="unit">%</span>
        </div>
        <div className="sub">of 300 trials</div>
      </div>
      <div className="metric-card">
        <div className="metric-label">Premature Responses</div>
        <div className="metric-value">
          {premTotal}<span className="unit">/ 300</span>
        </div>
        <div className="sub">motor impulsivity</div>
      </div>
      <div className="metric-card">
        <div className="metric-label">Win - Stay</div>
        <div className="metric-value">
          {(winStayProb * 100).toFixed(1)}<span className="unit">%</span>
        </div>
        <div className="sub">P(stay | win)</div>
      </div>
      <div className="metric-card">
        <div className="metric-label">Lose - Shift</div>
        <div className="metric-value">
          {(loseShiftProb * 100).toFixed(1)}<span className="unit">%</span>
        </div>
        <div className="sub">P(shift | loss)</div>
      </div>
    </div>
  );
}
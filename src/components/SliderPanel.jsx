import PresetSelector from './PresetSelector';

const SLIDER_COLORS = {
  alphaWin: '#4f8fd4',
  alphaLoss: '#f5b84a',
  beta: '#4cd9a0',
  gammaImpulse: '#c084d6'
};

const SLIDER_DEFS = [
  { key: 'alphaWin', label: 'α (Learning Rate Wins)', min: 0.01, max: 1.0, step: 0.01 },
  { key: 'alphaLoss', label: 'α (Learning Rate Losses)', min: 0.01, max: 1.0, step: 0.01 },
  { key: 'beta', label: 'β (Exploration / Inverse Temp)', min: 0.1, max: 5.0, step: 0.05 },
  { key: 'gammaImpulse', label: 'γ (Motor Impulsivity Threshold)', min: 0.0, max: 1.0, step: 0.01 }
];

function ParamSlider({ def, value, onChange, baseline, color }) {
  const pct = ((value - def.min) / (def.max - def.min)) * 100;
  const perturbed =
    baseline !== undefined && baseline !== null && Math.abs(value - baseline) > 1e-9;

  const style = {
    background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, #1f2b39 ${pct}%, #1f2b39 100%)`,
    '--thumb-color': color
  };

  return (
    <div className={`param-group${perturbed ? ' perturbed' : ''}`}>
      <div className="param-label">
        <span>{def.label}</span>
        <span className="param-value-row">
          <span className="val">{value.toFixed(2)}</span>
          {perturbed && <span className="perturbed-pill">exploring</span>}
        </span>
      </div>
      {baseline !== undefined && baseline !== null && (
        <div className="param-baseline">fitted: {baseline.toFixed(2)}</div>
      )}
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        style={style}
        onChange={e => onChange(def.key, parseFloat(e.target.value))}
      />
    </div>
  );
}

export default function SliderPanel({
  params,
  onParamChange,
  baseline,
  mode,
  presetKey,
  onSelectPreset,
  onReset,
  presets
}) {
  return (
    <>
      {SLIDER_DEFS.map(def => (
        <ParamSlider
          key={def.key}
          def={def}
          value={params[def.key]}
          onChange={onParamChange}
          baseline={baseline ? baseline[def.key] : undefined}
          color={SLIDER_COLORS[def.key]}
        />
      ))}

      {mode === 'explore' && presets && (
        <PresetSelector presets={presets} current={presetKey} onSelect={onSelectPreset} />
      )}

      {mode === 'fit' && baseline && (
        <div className="reset-wrap">
          <button className="btn secondary" onClick={onReset}>
            Reset to fitted values
          </button>
        </div>
      )}
    </>
  );
}
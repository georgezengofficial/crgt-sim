export default function PresetSelector({ presets, current, onSelect }) {
  return (
    <div className="preset-section">
      <div className="preset-label">Experiment Presets</div>
      <div className="preset-buttons">
        {Object.entries(presets).map(([key, label]) => (
          <button
            key={key}
            className={`preset-btn ${current === key ? 'active' : ''}`}
            onClick={() => onSelect(key)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
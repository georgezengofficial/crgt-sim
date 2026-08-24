import { useMemo } from 'react';

const palette = ['#4f8fd4', '#e8686a', '#4cd9a0', '#f5b84a', '#c084d6'];

export default function ParamDistribution({ fits }) {
  const groups = useMemo(() => {
    const getGroupKey = f => {
      const sex = f.sex && f.sex !== 'unspecified' ? f.sex : null;
      const cohort = f.cohort && f.cohort !== 'unspecified' ? f.cohort : null;
      if (sex) return sex;
      if (cohort) return cohort;
      return 'Unspecified';
    };

    const map = new Map();
    fits.forEach(f => {
      const key = getGroupKey(f);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(f);
    });

    return Array.from(map.entries());
  }, [fits]);

  const groupColors = {};
  groups.forEach(([name], i) => {
    groupColors[name] = palette[i % palette.length];
  });

  const params = [
    { key: 'alphaWin', label: 'α-win (win learning rate)', min: 0, max: 1 },
    { key: 'alphaLoss', label: 'α-loss (loss learning rate)', min: 0, max: 1 },
    { key: 'beta', label: 'β (inverse temperature)', min: 0, max: 5 }
  ];

  return (
    <div className="param-distribution">
      {params.map(param => {
        const svgHeight = Math.max(60, groups.length * 30 + 20);
        return (
          <div key={param.key} className="dist-panel">
            <div className="dist-title">{param.label}</div>
            <svg
              viewBox={`0 0 100 ${svgHeight}`}
              preserveAspectRatio="none"
              className="dist-svg"
            >
              <line x1="10" y1="25" x2="90" y2="25" stroke="#25303e" strokeWidth="0.5" />

              {groups.map(([groupName, members], gi) => {
                const color = groupColors[groupName];
                const yBase = 35 + gi * 26;
                const values = members.map(f => f[param.key]).filter(v => v !== null);

                return (
                  <g key={groupName}>
                    <text x="2" y={yBase + 4} fill="#8fa4bc" fontSize="6">
                      {groupName}
                    </text>

                    {values.map((v, vi) => {
                      const ratio = Math.max(0, Math.min(1, (v - param.min) / (param.max - param.min)));
                      const cx = 10 + ratio * 80;
                      const cy = yBase + (vi % 2 === 0 ? -3 : 3);
                      return <circle key={vi} cx={cx} cy={cy} r="2.5" fill={color} opacity="0.7" />;
                    })}

                    <line
                      x1="10"
                      y1={yBase + 1}
                      x2="90"
                      y2={yBase + 1}
                      stroke="#1a212b"
                      strokeWidth="0.3"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        );
      })}
    </div>
  );
}
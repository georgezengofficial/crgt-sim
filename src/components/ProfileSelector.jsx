import { useMemo, useState } from 'react';

export default function ProfileSelector({ profiles, selectedId, onSelect }) {
  const [search, setSearch] = useState('');

  const filtered = profiles.filter(p =>
    p.label.toLowerCase().includes(search.toLowerCase())
  );

  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach(p => {
      const key = `${p.cohort || 'unspecified'} / ${p.sex || 'unspecified'}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="profile-selector">
      <div className="profile-selector-label">Profile</div>
      <input
        type="search"
        className="profile-search"
        placeholder="Search profiles…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <select
        className="profile-select"
        value={selectedId || ''}
        onChange={e => onSelect(e.target.value)}
      >
        {groups.map(([groupName, members]) => (
          <optgroup key={groupName} label={groupName}>
            {members.map(p => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
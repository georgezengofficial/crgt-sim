import { useCallback, useEffect, useMemo, useState } from 'react';
import SliderPanel from './components/SliderPanel';
import DataUpload from './components/DataUpload';
import ProfileSelector from './components/ProfileSelector';
import ChoiceChart from './components/ChoiceChart';
import ImpulsivityChart from './components/ImpulsivityChart';
import MetricsRow from './components/MetricsRow';
import ParamDistribution from './components/ParamDistribution';
import ValidationPanel from './components/ValidationPanel';

import {
  crGTAgent,
  computeBlockData,
  computeMetrics,
  computeBlockDataFromTrials,
  computePrematureBlockDataFromTrials,
  generateSyntheticCSV,
  downloadBlob,
  COLORS,
  N_TRIALS,
  BLOCK_SIZE
} from './lib/model';

import { fitTrials, runValidation } from './lib/fitting';

const PRESETS = {
  control: 'Control / Baseline',
  female_lc: 'Female + LC Inhibition',
  acin_acq: 'aCIN Inhibition (Acquisition)',
  custom: 'Custom Parameter Set'
};

const PRESET_VALUES = {
  control: { alphaWin: 0.5, alphaLoss: 0.5, beta: 1.0, gammaImpulse: 0.1 },
  female_lc: { alphaWin: 0.5, alphaLoss: 0.2, beta: 1.0, gammaImpulse: 0.4 },
  acin_acq: { alphaWin: 0.3, alphaLoss: 0.3, beta: 3.0, gammaImpulse: 0.15 },
  custom: { alphaWin: 0.5, alphaLoss: 0.5, beta: 1.0, gammaImpulse: 0.1 }
};

const mean = arr => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);

export default function App() {
  const [mode, setMode] = useState('explore');
  const [params, setParams] = useState({ ...PRESET_VALUES.control });
  const [presetKey, setPresetKey] = useState('control');

  const [fitData, setFitData] = useState(null);
  const [fits, setFits] = useState(null);
  const [fitting, setFitting] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState('population');
  const [validation, setValidation] = useState(null);
  const [validating, setValidating] = useState(false);

  // ------- Explore mode simulation -------
  const exploreLog = useMemo(() => {
    const agent = new crGTAgent(
      params.alphaWin,
      params.alphaLoss,
      params.beta,
      params.gammaImpulse
    );
    return agent.run(N_TRIALS);
  }, [params]);

  const exploreBlocks = useMemo(() => computeBlockData(exploreLog, BLOCK_SIZE), [exploreLog]);
  const exploreMetrics = useMemo(() => computeMetrics(exploreLog), [exploreLog]);

  // ------- Fit data handling -------
  const handleProcessed = useCallback(result => {
    setFitData(result);
    setFits(null);
    setValidation(null);
    setSelectedProfileId('population');
  }, []);

  useEffect(() => {
    if (!fitData?.byRat) return;

    setFitting(true);
    const id = requestAnimationFrame(() => {
      const results = Object.entries(fitData.byRat).map(([ratId, trials]) => {
        const rec0 = trials[0];
        const fit = fitTrials(trials);
        return {
          ratId,
          cohort: rec0.cohort,
          sex: rec0.sex,
          ...fit
        };
      });

      setFits(results);
      setFitting(false);
    });

    return () => cancelAnimationFrame(id);
  }, [fitData]);

  const populationProfile = useMemo(() => {
    if (!fits?.length) return null;

    const gammaValues = fits.filter(f => f.gammaImpulse !== null).map(f => f.gammaImpulse);
    return {
      id: 'population',
      label: 'Population average',
      cohort: '—',
      sex: '—',
      baseline: {
        alphaWin: mean(fits.map(f => f.alphaWin)),
        alphaLoss: mean(fits.map(f => f.alphaLoss)),
        beta: mean(fits.map(f => f.beta)),
        gammaImpulse: gammaValues.length ? mean(gammaValues) : null
      }
    };
  }, [fits]);

  const profiles = useMemo(() => {
    if (!fits?.length || !populationProfile) return [];
    return [
      populationProfile,
      ...fits.map(f => ({
        id: f.ratId,
        label: f.ratId,
        cohort: f.cohort,
        sex: f.sex,
        baseline: {
          alphaWin: f.alphaWin,
          alphaLoss: f.alphaLoss,
          beta: f.beta,
          gammaImpulse: f.gammaImpulse
        }
      }))
    ];
  }, [fits, populationProfile]);

  const selectedProfile =
    profiles.find(p => p.id === selectedProfileId) || populationProfile || null;

  useEffect(() => {
    if (mode === 'fit' && selectedProfile?.baseline) {
      setParams(prev => ({
        ...prev,
        ...selectedProfile.baseline,
        gammaImpulse: selectedProfile.baseline.gammaImpulse ?? 0
      }));
      setPresetKey('custom');
    }
  }, [mode, selectedProfileId, selectedProfile]);

  const actualChoiceBlocks = useMemo(() => {
    if (!fitData?.byRat || !selectedProfile) return [];

    if (selectedProfile.id === 'population') {
      const allBlocks = Object.values(fitData.byRat).map(trials =>
        computeBlockDataFromTrials(trials, BLOCK_SIZE)
      );
      const minLen = allBlocks.length ? Math.min(...allBlocks.map(b => b.length)) : 0;
      if (!minLen) return [];

      const avg = [];
      for (let b = 0; b < minLen; b++) {
        avg.push({
          block: b + 1,
          p1: mean(allBlocks.map(bs => bs[b].p1)),
          p2: mean(allBlocks.map(bs => bs[b].p2)),
          p3: mean(allBlocks.map(bs => bs[b].p3)),
          p4: mean(allBlocks.map(bs => bs[b].p4))
        });
      }
      return avg;
    }

    const trials = fitData.byRat[selectedProfile.id];
    return trials ? computeBlockDataFromTrials(trials, BLOCK_SIZE) : [];
  }, [fitData, selectedProfile]);

  const actualPremBlocks = useMemo(() => {
    if (!fitData?.byRat || !selectedProfile) return [];

    if (selectedProfile.id === 'population') {
      const allPrem = Object.values(fitData.byRat).map(trials =>
        computePrematureBlockDataFromTrials(trials, BLOCK_SIZE)
      );
      const minLen = allPrem.length ? Math.min(...allPrem.map(b => b.length)) : 0;
      if (!minLen) return [];

      const avg = [];
      for (let b = 0; b < minLen; b++) {
        avg.push({
          block: b + 1,
          premRate: mean(allPrem.map(bs => bs[b].premRate))
        });
      }
      return avg;
    }

    const trials = fitData.byRat[selectedProfile.id];
    return trials ? computePrematureBlockDataFromTrials(trials, BLOCK_SIZE) : [];
  }, [fitData, selectedProfile]);

  const fitSimBlocks = useMemo(() => {
    if (mode !== 'fit' || !selectedProfile || !actualChoiceBlocks.length) return null;

    const simTrials = actualChoiceBlocks.length * BLOCK_SIZE;
    const agent = new crGTAgent(
      params.alphaWin,
      params.alphaLoss,
      params.beta,
      params.gammaImpulse
    );
    const log = agent.run(simTrials);
    return computeBlockData(log, BLOCK_SIZE);
  }, [mode, selectedProfile, actualChoiceBlocks.length, params]);

  const handleParamChange = useCallback((key, value) => {
    setParams(prev => ({ ...prev, [key]: value }));
    setPresetKey('custom');
  }, []);

  const handleSelectPreset = useCallback(key => {
    setPresetKey(key);
    if (key === 'custom') return;
    const vals = PRESET_VALUES[key];
    if (vals) setParams({ ...vals });
  }, []);

  const handleResetToFitted = useCallback(() => {
    if (!selectedProfile?.baseline) return;
    setParams(prev => ({
      ...prev,
      ...selectedProfile.baseline,
      gammaImpulse: selectedProfile.baseline.gammaImpulse ?? 0
    }));
  }, [selectedProfile]);

  const handleRunValidation = useCallback(() => {
    if (!fitData?.byRat || validating) return;
    setValidating(true);
    requestAnimationFrame(() => {
      const result = runValidation(fitData.byRat);
      setValidation(result);
      setValidating(false);
    });
  }, [fitData, validating]);

  const handleExport = useCallback(() => {
    if (!exploreLog?.length) return;
    downloadBlob(generateSyntheticCSV(exploreLog), 'crGT_simulation_data.csv');
  }, [exploreLog]);

  const slidersBaseline = mode === 'fit' && selectedProfile ? selectedProfile.baseline : null;

  const choiceLabels =
    mode === 'explore'
      ? exploreBlocks.map(b => `B${b.block}`)
      : actualChoiceBlocks.map(b => `B${b.block}`);

  const choiceDatasets =
    mode === 'explore'
      ? [
          {
            label: 'P1 (Safe)',
            data: exploreBlocks.map(b => b.p1),
            borderColor: COLORS.P1,
            backgroundColor: COLORS.P1 + '30',
            borderWidth: 2.5,
            pointRadius: 1.5,
            tension: 0.3,
            fill: false
          },
          {
            label: 'P2 (Optimal)',
            data: exploreBlocks.map(b => b.p2),
            borderColor: COLORS.P2,
            backgroundColor: COLORS.P2 + '30',
            borderWidth: 2.5,
            pointRadius: 1.5,
            tension: 0.3,
            fill: false
          },
          {
            label: 'P3 (Risky)',
            data: exploreBlocks.map(b => b.p3),
            borderColor: COLORS.P3,
            backgroundColor: COLORS.P3 + '30',
            borderWidth: 2.5,
            pointRadius: 1.5,
            tension: 0.3,
            fill: false
          },
          {
            label: 'P4 (HighRisk)',
            data: exploreBlocks.map(b => b.p4),
            borderColor: COLORS.P4,
            backgroundColor: COLORS.P4 + '30',
            borderWidth: 2.5,
            pointRadius: 1.5,
            tension: 0.3,
            fill: false
          }
        ]
      : [
          ...['p1', 'p2', 'p3', 'p4'].flatMap(key => [
            {
              label: `${key.toUpperCase()} actual`,
              data: actualChoiceBlocks.map(b => b[key]),
              borderColor: COLORS[key.toUpperCase()],
              backgroundColor: COLORS[key.toUpperCase()] + '30',
              borderWidth: 3,
              pointRadius: 1.5,
              tension: 0.3,
              fill: false
            },
            {
              label: `${key.toUpperCase()} simulated`,
              data: fitSimBlocks ? fitSimBlocks.map(b => b[key]) : [],
              borderColor: COLORS[key.toUpperCase()],
              backgroundColor: COLORS[key.toUpperCase()] + '20',
              borderWidth: 2,
              borderDash: [6, 4],
              pointRadius: 0,
              tension: 0.3,
              fill: false
            }
          ])
        ];

  const premLabels =
    mode === 'explore'
      ? exploreBlocks.map(b => `B${b.block}`)
      : actualPremBlocks.map(b => `B${b.block}`);

  const premActualData =
    mode === 'fit' ? actualPremBlocks.map(b => b.premRate) : null;

  const premSimData =
    mode === 'explore'
      ? exploreBlocks.map(b => b.premRate)
      : fitSimBlocks
        ? fitSimBlocks.map(b => b.premRate)
        : [];

  return (
    <div>
      <div className="top-tabs">
        <button
          className={`top-tab-btn ${mode === 'explore' ? 'active' : ''}`}
          onClick={() => setMode('explore')}
        >
          Explore
        </button>
        <button
          className={`top-tab-btn ${mode === 'fit' ? 'active' : ''}`}
          onClick={() => setMode('fit')}
        >
          Fit to My Data
        </button>
      </div>

      <div className="app-container">
        <div className="sidebar">
          <div className="sidebar-title">crGT-Sim</div>
          <div className="sidebar-sub">
            Q-Learning & Impulsivity Parameter Explorer
          </div>

          <SliderPanel
            params={params}
            onParamChange={handleParamChange}
            baseline={slidersBaseline}
            mode={mode}
            presetKey={presetKey}
            onSelectPreset={handleSelectPreset}
            onReset={handleResetToFitted}
            presets={PRESETS}
          />

          {mode === 'explore' && (
            <div className="export-wrap">
              <button className="export-btn" onClick={handleExport} disabled={!exploreLog}>
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                  <path d="M12 15l-4-4h2.5V8h3v3H16l-4 4z" />
                  <path d="M8 17h8v1.5H8V17z" />
                </svg>
                Download Synthetic Dataset (.csv)
              </button>
              <div
                style={{
                  fontSize: '11px',
                  color: '#6a8aac',
                  marginTop: '8px',
                  textAlign: 'center'
                }}
              >
                300 trials · crGT P1-P4 · R / Python ready
              </div>
            </div>
          )}
        </div>

        <div className="main">
          {mode === 'explore' ? (
            <>
              <MetricsRow metrics={exploreMetrics} />

              <div className="chart-card">
                <div className="chart-title">
                  Choice Strategy Trajectory
                  <small>10-trial rolling blocks</small>
                  <span className="status-badge">{exploreBlocks.length} blocks</span>
                </div>
                <ChoiceChart labels={choiceLabels} datasets={choiceDatasets} height={240} />
              </div>

              <div className="chart-card">
                <div className="chart-title">
                  Motor Impulsivity Index
                  <small>premature response rate</small>
                  <span className="status-badge">γ = {params.gammaImpulse.toFixed(2)}</span>
                </div>
                <ImpulsivityChart
                  labels={premLabels}
                  actualData={null}
                  simulatedData={premSimData}
                  mode="explore"
                />
              </div>

              <div style={{ fontSize: '11px', color: '#4f647c', textAlign: 'center', padding: '6px 0 2px' }}>
                Based on Hynes et al. · LC / aCIN modulation · crGT paradigm
              </div>
              <div style={{ fontSize: '9px', color: '#2a3447', textAlign: 'center', padding: '8px 0 0', fontStyle: 'italic', opacity: 0.6 }}>
                Made by George Zeng 2026
              </div>
            </>
          ) : (
            <>
              {!fitData ? (
                <DataUpload onProcessed={handleProcessed} />
              ) : (
                <>
                  <div className="card">
                    <div className="card-title">Parsed Dataset</div>
                    <div className="row-flex" style={{ marginBottom: 10 }}>
                      <span className="pill">{Object.keys(fitData.byRat).length} rats</span>
                      <span className="pill">
                        {fitData.dropped.noRatId +
                          fitData.dropped.noTrial +
                          fitData.dropped.badChoice +
                          fitData.dropped.badOutcome ===
                        0
                          ? 'no rows dropped'
                          : `${fitData.dropped.noRatId +
                              fitData.dropped.noTrial +
                              fitData.dropped.badChoice +
                              fitData.dropped.badOutcome} rows dropped`}
                      </span>
                      <span className="pill">{fitData.totalParsed} parsed trials</span>
                    </div>
                    <button className="btn" onClick={() => setFitData(null)}>
                      Replace Data
                    </button>
                  </div>

                  {fitting && <div className="card status-badge">Fitting model to each rat…</div>}

                  {fits && !fitting && (
                    <>
                      <div className="card">
                        <ProfileSelector
                          profiles={profiles}
                          selectedId={selectedProfileId}
                          onSelect={setSelectedProfileId}
                        />
                      </div>

                      <div className="card">
                        <div className="card-title">Parameter Distribution</div>
                        <div className="card-sub">
                          Fitted α-win, α-loss, and β across all rats, colored/split by sex or cohort.
                        </div>
                        <ParamDistribution fits={fits} />
                      </div>

                      <div className="chart-card">
                        <div className="chart-title">
                          Choice Strategy: Actual vs. Simulated
                          <small>{selectedProfile?.label || ''}</small>
                          <span className="status-badge">
                            {selectedProfile?.id === 'population'
                              ? 'population average'
                              : 'single rat'}
                          </span>
                        </div>
                        <ChoiceChart labels={choiceLabels} datasets={choiceDatasets} height={240} />
                      </div>

                      <div className="chart-card">
                        <div className="chart-title">
                          Motor Impulsivity: Actual vs. Simulated
                          <small>premature response rate</small>
                          <span className="status-badge">γ = {params.gammaImpulse.toFixed(2)}</span>
                        </div>
                        <ImpulsivityChart
                          labels={premLabels}
                          actualData={premActualData}
                          simulatedData={premSimData}
                          mode="fit"
                        />
                      </div>

                      <ValidationPanel
                        validation={validation}
                        onRunValidation={handleRunValidation}
                        validating={validating}
                      />
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
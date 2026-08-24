import { crGTAgent, TASK_OPTIONS, computeBlockDataFromTrials } from './model';

export function evalLogLik(trials, alphaWin, alphaLoss, beta) {
  let Q = [0, 0, 0, 0];
  let logLik = 0;

  for (const rec of trials) {
    const exps = Q.map(v => Math.exp(beta * v));
    const sum = exps.reduce((a, b) => a + b, 0);
    const probs =
      sum === 0 || !isFinite(sum)
        ? [0.25, 0.25, 0.25, 0.25]
        : exps.map(e => e / sum);

    const p = Math.max(probs[rec.choice], 1e-9);
    logLik += Math.log(p);

    const opt = TASK_OPTIONS[rec.choice];
    const reward = rec.outcome === 'win' ? opt.winReward : opt.lossPenalty;
    const alpha = rec.outcome === 'win' ? alphaWin : alphaLoss;
    const delta = reward - Q[rec.choice];
    Q[rec.choice] += alpha * delta;

    if (Q[rec.choice] > 50) Q[rec.choice] = 50;
    if (Q[rec.choice] < -50) Q[rec.choice] = -50;
  }

  return logLik;
}

export function fitTrials(trials) {
  const alphaGrid = [0.1, 0.3, 0.5, 0.7, 0.9];
  const betaGrid = [0.25, 0.5, 1, 1.5, 2, 3, 5];
  let best = { alphaWin: 0.5, alphaLoss: 0.5, beta: 1, logLik: -Infinity };

  for (const aw of alphaGrid) {
    for (const al of alphaGrid) {
      for (const b of betaGrid) {
        const ll = evalLogLik(trials, aw, al, b);
        if (ll > best.logLik) {
          best = { alphaWin: aw, alphaLoss: al, beta: b, logLik: ll };
        }
      }
    }
  }

  const premTrials = trials.filter(t => t.premature !== null);
  const gammaImpulse =
    premTrials.length > 0
      ? premTrials.reduce((s, t) => s + t.premature, 0) / premTrials.length
      : null;

  return { ...best, gammaImpulse, nTrials: trials.length };
}

export function pearsonCorr(a, b) {
  const n = Math.min(a.length, b.length);
  if (n === 0) return null;

  const meanA = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanB = b.slice(0, n).reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let denA = 0;
  let denB = 0;

  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }

  if (denA === 0 || denB === 0) return null;
  return num / Math.sqrt(denA * denB);
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function runValidation(byRat) {
  const ratIds = Object.keys(byRat);

  if (ratIds.length < 4) {
    return {
      error: `Need at least 4 rats with usable data for a train/test split (found ${ratIds.length}).`
    };
  }

  const shuffled = shuffle(ratIds);
  const splitIdx = Math.max(1, Math.round(shuffled.length * 0.75));
  const trainIds = shuffled.slice(0, splitIdx);
  const testIds = shuffled.slice(splitIdx);

  const trainFits = trainIds.map(id => fitTrials(byRat[id]));
  const popParams = {
    alphaWin: trainFits.reduce((s, f) => s + f.alphaWin, 0) / trainFits.length,
    alphaLoss: trainFits.reduce((s, f) => s + f.alphaLoss, 0) / trainFits.length,
    beta: trainFits.reduce((s, f) => s + f.beta, 0) / trainFits.length
  };

  let totalLL = 0;
  let totalTrials = 0;
  testIds.forEach(id => {
    const trials = byRat[id];
    totalLL += evalLogLik(trials, popParams.alphaWin, popParams.alphaLoss, popParams.beta);
    totalTrials += trials.length;
  });

  const avgLLPerTrial = totalTrials > 0 ? totalLL / totalTrials : null;
  const chanceLLPerTrial = Math.log(0.25);

  const testBlockSets = testIds.map(id => computeBlockDataFromTrials(byRat[id], 10));
  const minBlocks = Math.min(...testBlockSets.map(b => b.length));

  const actualAvgBlocks = [];
  for (let b = 0; b < minBlocks; b++) {
    actualAvgBlocks.push({
      block: b + 1,
      p1: testBlockSets.reduce((s, bs) => s + bs[b].p1, 0) / testBlockSets.length,
      p2: testBlockSets.reduce((s, bs) => s + bs[b].p2, 0) / testBlockSets.length,
      p3: testBlockSets.reduce((s, bs) => s + bs[b].p3, 0) / testBlockSets.length,
      p4: testBlockSets.reduce((s, bs) => s + bs[b].p4, 0) / testBlockSets.length
    });
  }

  const simRuns = 30;
  const simTrialsLen = minBlocks * 10;
  const simBlockAccum = actualAvgBlocks.map(() => ({ p1: 0, p2: 0, p3: 0, p4: 0 }));

  for (let r = 0; r < simRuns; r++) {
    const agent = new crGTAgent(popParams.alphaWin, popParams.alphaLoss, popParams.beta, 0.1);
    const log = agent.run(simTrialsLen);
    const simBlocks = computeBlockDataFromTrials(
      log.map(l => ({ choice: l.choice })),
      10
    );

    simBlocks.forEach((sb, i) => {
      if (simBlockAccum[i]) {
        simBlockAccum[i].p1 += sb.p1 / simRuns;
        simBlockAccum[i].p2 += sb.p2 / simRuns;
        simBlockAccum[i].p3 += sb.p3 / simRuns;
        simBlockAccum[i].p4 += sb.p4 / simRuns;
      }
    });
  }

  const predictedAvgBlocks = simBlockAccum.map((sb, i) => ({ block: i + 1, ...sb }));

  const flattenActual = [];
  const flattenPred = [];
  actualAvgBlocks.forEach((ab, i) => {
    const pb = predictedAvgBlocks[i];
    ['p1', 'p2', 'p3', 'p4'].forEach(k => {
      flattenActual.push(ab[k]);
      flattenPred.push(pb[k]);
    });
  });

  const corr = pearsonCorr(flattenActual, flattenPred);
  const mae =
    flattenActual.reduce((s, v, i) => s + Math.abs(v - flattenPred[i]), 0) /
    flattenActual.length;

  return {
    trainIds,
    testIds,
    trainFits,
    popParams,
    avgLLPerTrial,
    chanceLLPerTrial,
    actualAvgBlocks,
    predictedAvgBlocks,
    corr,
    mae
  };
}
export const N_TRIALS = 300;
export const BLOCK_SIZE = 10;
export const N_BLOCKS = Math.floor(N_TRIALS / BLOCK_SIZE);

export const TASK_OPTIONS = [
  { id: 'P1', label: 'P1', winProb: 0.90, winReward: 1, lossPenalty: -1, desc: 'Safe' },
  { id: 'P2', label: 'P2', winProb: 0.80, winReward: 2, lossPenalty: -2, desc: 'Optimal' },
  { id: 'P3', label: 'P3', winProb: 0.60, winReward: 3, lossPenalty: -3, desc: 'Risky' },
  { id: 'P4', label: 'P4', winProb: 0.40, winReward: 4, lossPenalty: -4, desc: 'HighRisk' }
];

export const COLORS = {
  P1: '#4f8fd4',
  P2: '#4cd9a0',
  P3: '#f5b84a',
  P4: '#e8686a',
  prem: '#c084d6',
  bg: '#0b0e14',
  card: '#131b26',
  border: '#25303e',
  text: '#e6edf5',
  textMuted: '#8fa4bc'
};

export class crGTAgent {
  constructor(alphaWin, alphaLoss, beta, gammaImpulse) {
    this.alphaWin = alphaWin;
    this.alphaLoss = alphaLoss;
    this.beta = beta;
    this.gammaImpulse = gammaImpulse;
    this.Q = [0, 0, 0, 0];
    this.lastChoice = -1;
    this.lastOutcome = null;
    this.trialLog = [];
  }

  selectAction() {
    const q = this.Q;
    const b = this.beta;
    const exps = q.map(v => Math.exp(b * v));
    const sum = exps.reduce((a, b) => a + b, 0);

    if (sum === 0 || !isFinite(sum)) {
      return Math.floor(Math.random() * 4);
    }

    const probs = exps.map(e => e / sum);
    let r = Math.random();
    for (let i = 0; i < probs.length; i++) {
      r -= probs[i];
      if (r <= 0) return i;
    }
    return 3;
  }

  updateQ(action, reward, outcome) {
    const alpha = outcome === 'win' ? this.alphaWin : this.alphaLoss;
    const delta = reward - this.Q[action];
    this.Q[action] += alpha * delta;
    if (this.Q[action] > 50) this.Q[action] = 50;
    if (this.Q[action] < -50) this.Q[action] = -50;
  }

  checkPremature() {
    return Math.random() < this.gammaImpulse;
  }

  run(nTrials) {
    const T = nTrials || N_TRIALS;
    this.Q = [0, 0, 0, 0];
    this.lastChoice = -1;
    this.lastOutcome = null;
    this.trialLog = [];

    for (let t = 0; t < T; t++) {
      const action = this.selectAction();
      const opt = TASK_OPTIONS[action];

      const isWin = Math.random() < opt.winProb;
      const outcome = isWin ? 'win' : 'loss';
      const reward = isWin ? opt.winReward : opt.lossPenalty;

      this.updateQ(action, reward, outcome);

      const premature = this.checkPremature() ? 1 : 0;

      let winStay = 0;
      let loseShift = 0;
      if (this.lastChoice !== -1 && this.lastOutcome !== null) {
        if (this.lastOutcome === 'win' && action === this.lastChoice) winStay = 1;
        if (this.lastOutcome === 'loss' && action !== this.lastChoice) loseShift = 1;
      }

      this.trialLog.push({
        trial: t + 1,
        choice: action,
        choiceLabel: TASK_OPTIONS[action].id,
        outcome,
        reward,
        premature,
        winStay,
        loseShift,
        Q: [...this.Q]
      });

      this.lastChoice = action;
      this.lastOutcome = outcome;
    }

    return this.trialLog;
  }
}

export function computeBlockData(log, blockSize = BLOCK_SIZE) {
  const nBlocks = Math.floor(log.length / blockSize);
  const blocks = [];

  for (let b = 0; b < nBlocks; b++) {
    const start = b * blockSize;
    const end = start + blockSize;
    const slice = log.slice(start, end);

    const counts = [0, 0, 0, 0];
    let prem = 0;
    let wins = 0;
    let losses = 0;
    let winStay = 0;
    let loseShift = 0;
    let totalWinStay = 0;
    let totalLoseShift = 0;

    for (const rec of slice) {
      counts[rec.choice] += 1;
      if (rec.premature) prem += 1;

      if (rec.outcome === 'win') {
        wins += 1;
        if (rec.winStay) {
          winStay += 1;
        }
        totalWinStay += 1;
      } else {
        losses += 1;
        if (rec.loseShift) {
          loseShift += 1;
        }
        totalLoseShift += 1;
      }
    }

    const total = slice.length;
    blocks.push({
      block: b + 1,
      p1: (counts[0] / total) * 100,
      p2: (counts[1] / total) * 100,
      p3: (counts[2] / total) * 100,
      p4: (counts[3] / total) * 100,
      premRate: (prem / total) * 100,
      winStayProb: totalWinStay > 0 ? winStay / totalWinStay : 0,
      loseShiftProb: totalLoseShift > 0 ? loseShift / totalLoseShift : 0,
      totalPrem: prem
    });
  }

  return blocks;
}

export function computeMetrics(log) {
  const total = log.length;
  let p2Count = 0;
  let premTotal = 0;
  let winStayTotal = 0;
  let winTotal = 0;
  let loseShiftTotal = 0;
  let loseTotal = 0;

  for (const rec of log) {
    if (rec.choice === 1) p2Count += 1;
    if (rec.premature) premTotal += 1;

    if (rec.outcome === 'win') {
      winTotal += 1;
      if (rec.winStay) winStayTotal += 1;
    } else {
      loseTotal += 1;
      if (rec.loseShift) loseShiftTotal += 1;
    }
  }

  return {
    optimalPct: (p2Count / total) * 100,
    premTotal,
    winStayProb: winTotal > 0 ? winStayTotal / winTotal : 0,
    loseShiftProb: loseTotal > 0 ? loseShiftTotal / loseTotal : 0,
    winRate: winTotal / total
  };
}

export function computeBlockDataFromTrials(trials, blockSize = BLOCK_SIZE) {
  const nBlocks = Math.floor(trials.length / blockSize);
  const blocks = [];

  for (let b = 0; b < nBlocks; b++) {
    const slice = trials.slice(b * blockSize, b * blockSize + blockSize);
    const counts = [0, 0, 0, 0];

    slice.forEach(t => {
      if (t.choice >= 0 && t.choice <= 3) counts[t.choice] += 1;
    });

    const total = slice.length;
    blocks.push({
      block: b + 1,
      p1: (counts[0] / total) * 100,
      p2: (counts[1] / total) * 100,
      p3: (counts[2] / total) * 100,
      p4: (counts[3] / total) * 100
    });
  }

  return blocks;
}

export function computePrematureBlockDataFromTrials(trials, blockSize = BLOCK_SIZE) {
  const nBlocks = Math.floor(trials.length / blockSize);
  const blocks = [];

  for (let b = 0; b < nBlocks; b++) {
    const slice = trials.slice(b * blockSize, b * blockSize + blockSize);
    const prem = slice.reduce((s, t) => s + (t.premature ? 1 : 0), 0);
    blocks.push({
      block: b + 1,
      premRate: (prem / slice.length) * 100
    });
  }

  return blocks;
}

export function generateSyntheticCSV(log) {
  const header = 'trial,choice,outcome,premature_response,win_stay,lose_shift\n';
  const rows = log.map(r =>
    `${r.trial},${r.choiceLabel},${r.outcome},${r.premature},${r.winStay},${r.loseShift}`
  );
  return header + rows.join('\n');
}

export function downloadBlob(content, filename, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
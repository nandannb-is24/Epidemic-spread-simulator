/**
 * charts.js — Chart.js helper wrappers.
 *
 * Provides factory functions for all charts used in the labs:
 *  - Centrality live bar chart
 *  - SIR epidemic curve
 *  - Intervention comparison bar chart
 */

// ---------------------------------------------------------------------------
// Shared Chart.js defaults (dark theme)
// ---------------------------------------------------------------------------
Chart.defaults.color = '#8891a4';
Chart.defaults.borderColor = '#2a2f3a';
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size = 11;

// ---------------------------------------------------------------------------
// Centrality bar chart (live updates during Brandes animation)
// ---------------------------------------------------------------------------
export function createCentralityBarChart(canvasId) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: 'Betweenness Centrality',
        data: [],
        backgroundColor: [],
        borderColor: [],
        borderWidth: 1,
        borderRadius: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `Centrality: ${ctx.raw.toFixed(4)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: { maxRotation: 0, font: { size: 9 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          beginAtZero: true,
          ticks: { font: { size: 9 } },
        },
      },
    },
  });
}

/**
 * Update centrality chart with new scores.
 * @param {Chart} chart
 * @param {object} scores — { node_id: float }
 * @param {number[]} topKIds — highlight these node IDs in gold
 */
export function updateCentralityChart(chart, scores, topKIds = []) {
  if (!chart) return;
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const GOLD   = '#c9a24e';
  const TEAL   = '#3db8a0';
  const DIM    = 'rgba(61,184,160,0.25)';

  chart.data.labels = entries.map(([id]) => `N${id}`);
  chart.data.datasets[0].data = entries.map(([, v]) => v);
  chart.data.datasets[0].backgroundColor = entries.map(([id]) =>
    topKIds.includes(Number(id)) ? GOLD + '88' : DIM
  );
  chart.data.datasets[0].borderColor = entries.map(([id]) =>
    topKIds.includes(Number(id)) ? GOLD : TEAL
  );
  chart.update('none');
}

// ---------------------------------------------------------------------------
// SIR epidemic curve
// ---------------------------------------------------------------------------
export function createSIRChart(canvasId) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Susceptible',
          data: [],
          borderColor: '#5cb87a',
          backgroundColor: 'rgba(92,184,122,0.06)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Infected',
          data: [],
          borderColor: '#e05c5c',
          backgroundColor: 'rgba(224,92,92,0.06)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Recovered',
          data: [],
          borderColor: '#5b8fd9',
          backgroundColor: 'rgba(91,143,217,0.06)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: { maxTicksLimit: 8, font: { size: 9 } },
          title: { display: true, text: 'Timestep', font: { size: 9 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          beginAtZero: true,
          ticks: { font: { size: 9 } },
          title: { display: true, text: 'Count', font: { size: 9 } },
        },
      },
    },
  });
}

/**
 * Update SIR chart up to timestep t.
 * @param {Chart} chart
 * @param {Array} timeseries — [{t, S, I, R}, ...]
 * @param {number} upToT    — include only steps 0..upToT
 */
export function updateSIRChart(chart, timeseries, upToT) {
  if (!chart) return;
  const slice = timeseries.slice(0, upToT + 1);
  chart.data.labels = slice.map(s => s.t);
  chart.data.datasets[0].data = slice.map(s => s.S);
  chart.data.datasets[1].data = slice.map(s => s.I);
  chart.data.datasets[2].data = slice.map(s => s.R);
  chart.update('none');
}

// ---------------------------------------------------------------------------
// Intervention comparison bar chart (DP vs. Greedy)
// ---------------------------------------------------------------------------
export function createInterventionCompareChart(canvasId) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Total Value (centrality removed)', 'Total Cost used'],
      datasets: [
        {
          label: 'DP (Optimal)',
          data: [0, 0],
          backgroundColor: 'rgba(91,143,217,0.45)',
          borderColor: '#5b8fd9',
          borderWidth: 1.5,
          borderRadius: 3,
        },
        {
          label: 'Greedy',
          data: [0, 0],
          backgroundColor: 'rgba(212,148,90,0.45)',
          borderColor: '#d4945a',
          borderWidth: 1.5,
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { size: 10 }, padding: 8 },
        },
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.03)' } },
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
      },
    },
  });
}

export function updateInterventionCompareChart(chart, dpResult, greedyResult) {
  if (!chart || !dpResult || !greedyResult) return;
  chart.data.datasets[0].data = [dpResult.total_value, dpResult.total_cost];
  chart.data.datasets[1].data = [greedyResult.total_value, greedyResult.total_cost];
  chart.update();
}

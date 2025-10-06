import React, { useState } from 'react';

// Lightweight single-file React component for recommending staff headcount
// - Tailwind CSS classes used for styling (no imports required)
// - Default export of the component
// - Includes single-store calculator and CSV batch upload + download

export default function StaffingUI() {
  const [squareFootage, setSquareFootage] = useState('1200');
  const [mallFootfall, setMallFootfall] = useState('15000');
  const [roundRule, setRoundRule] = useState('ceil');
  const [minStaff, setMinStaff] = useState(1);
  const [maxStaff, setMaxStaff] = useState('');
  const [batchRows, setBatchRows] = useState([]);
  const [batchResults, setBatchResults] = useState(null);
  const [error, setError] = useState('');

  // Simple heuristic function derived from demo model
  // You can replace this with an API call to a trained model.
  function predictContinuous(area, footfall) {
    const base = 1.5;
    const sqrtArea = Math.sqrt(Math.max(0, area));
    // Keep units consistent with your training data (e.g., daily footfall)
    const cont = base + 0.03 * sqrtArea + footfall / 20000.0;
    return cont;
  }

  function applyRounding(value) {
    const rules = {
      ceil: Math.ceil,
      floor: Math.floor,
      round: Math.round,
    };
    const fn = rules[roundRule] || Math.ceil;
    let rec = fn(value);
    rec = Math.max(rec, Number(minStaff) || 1);
    if (maxStaff !== '') rec = Math.min(rec, Number(maxStaff));
    return rec;
  }

  function computeRecommendation() {
    setError('');
    const area = Number(squareFootage);
    const foot = Number(mallFootfall);
    if (!Number.isFinite(area) || area <= 0) return setError('Enter a valid square footage (> 0)');
    if (!Number.isFinite(foot) || foot < 0) return setError('Enter a valid mall footfall (>= 0)');
    const cont = predictContinuous(area, foot);
    const rec = applyRounding(cont);
    return { cont, rec };
  }

  // CSV utilities (very small parser for simple CSVs with header)
  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const parts = line.split(',');
      const obj = {};
      headers.forEach((h, i) => (obj[h] = (parts[i] || '').trim()));
      return obj;
    });
    return { headers, rows };
  }

  function handleFileUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = parseCSV(ev.target.result || '');
        setBatchRows(parsed.rows || []);
        setBatchResults(null);
        setError('');
      } catch (err) {
        setError('Failed to parse CSV');
      }
    };
    reader.readAsText(file);
  }

  function processBatch() {
    if (!batchRows || batchRows.length === 0) return setError('Upload a CSV first (headers: square_footage,mall_footfall optional store_id).');
    const out = [];
    for (const r of batchRows) {
      // Accept multiple header name variants for convenience
      const area = Number(r.square_footage ?? r.area ?? r.sqft ?? r.SQUARE_FOOTAGE ?? 0);
      const foot = Number(r.mall_footfall ?? r.footfall ?? r.mallTraffic ?? r.MALL_FOOTFALL ?? 0);
      const cont = predictContinuous(area, foot);
      const rec = applyRounding(cont);
      out.push({ ...r, predicted_continuous: Number(cont.toFixed(3)), recommended_staff: rec });
    }
    setBatchResults(out);
    setError('');
  }

  function downloadCSV() {
    if (!batchResults) return setError('No batch results to download');
    const headers = Object.keys(batchResults[0]);
    const lines = [headers.join(',')];
    for (const row of batchResults) {
      const vals = headers.map(h => JSON.stringify(row[h] ?? '') );
      lines.push(vals.join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'staff_recommendations.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // UI pieces
  const result = computeRecommendation();

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-start justify-center">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-lg p-6 grid gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Staffing recommendation</h1>
            <p className="text-sm text-gray-500">Lightweight UI — enter store details or upload a CSV to batch process.</p>
          </div>
          <div className="text-xs text-gray-400">Made with ❤️ — single-file React + Tailwind</div>
        </header>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">Square footage (sqft)</label>
            <input
              type="number"
              min="1"
              value={squareFootage}
              onChange={e => setSquareFootage(e.target.value)}
              className="w-full rounded-lg border p-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />

            <label className="block text-sm font-medium text-gray-700">Mall footfall (same granularity as historical staff)</label>
            <input
              type="number"
              min="0"
              value={mallFootfall}
              onChange={e => setMallFootfall(e.target.value)}
              className="w-full rounded-lg border p-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-sm text-gray-600">Rounding</label>
                <select value={roundRule} onChange={e => setRoundRule(e.target.value)} className="w-full mt-1 rounded-lg border p-2">
                  <option value="ceil">Ceil (conservative)</option>
                  <option value="round">Round</option>
                  <option value="floor">Floor (minimal)</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-600">Min staff</label>
                <input type="number" min="0" value={minStaff} onChange={e => setMinStaff(e.target.value)} className="w-full mt-1 rounded-lg border p-2" />
              </div>

              <div>
                <label className="text-sm text-gray-600">Max staff (optional)</label>
                <input type="number" min="0" value={maxStaff} onChange={e => setMaxStaff(e.target.value)} className="w-full mt-1 rounded-lg border p-2" />
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  const res = computeRecommendation();
                  if (!res) return;
                  // simple UI feedback: focus is enough — computeRecommendation sets error if invalid
                  // we still keep values in the form for user to edit
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white shadow hover:bg-indigo-700"
              >
                Calculate
              </button>
            </div>

            {error && <div className="text-red-600 text-sm">{error}</div>}

          </div>

          <div className="bg-gray-50 rounded-xl p-4 border">
            <h3 className="text-sm font-medium text-gray-700">Recommendation</h3>
            <div className="mt-3">
              {result && !error ? (
                <div className="space-y-3">
                  <div className="text-4xl font-extrabold">{applyRounding(result.cont)}</div>
                  <div className="text-sm text-gray-600">Estimated continuous value: {result.cont.toFixed(3)}</div>

                  <div className="pt-3">
                    <div className="text-sm font-medium text-gray-700">Why this estimate?</div>
                    <ul className="text-sm text-gray-600 list-disc list-inside mt-1">
                      <li>Base heuristic: staff grows with sqrt(area) and with mall footfall.</li>
                      <li>Rounding rule & min/max enforced as per inputs.</li>
                      <li>For better accuracy, plug a trained model or call an API here.</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Fill inputs and press Calculate.</div>
              )}
            </div>
          </div>
        </section>

        <section className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-700">Batch CSV upload</h3>
          <p className="text-xs text-gray-500">CSV must have a header row. Useful headers: <code>store_id</code>, <code>square_footage</code>, <code>mall_footfall</code>.</p>

          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
            <input type="file" accept=".csv" onChange={handleFileUpload} className="text-sm" />
            <button onClick={processBatch} className="px-3 py-2 rounded-lg bg-green-600 text-white">Process file</button>
            <button onClick={downloadCSV} className="px-3 py-2 rounded-lg bg-blue-600 text-white" disabled={!batchResults}>Download results</button>
          </div>

          <div className="mt-4">
            {batchRows && batchRows.length > 0 && (
              <div className="text-sm text-gray-600">Rows loaded: {batchRows.length}</div>
            )}

            {batchResults && (
              <div className="mt-3">
                <div className="text-sm font-medium">Sample output (first 6 rows)</div>
                <div className="overflow-auto mt-2">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-left text-gray-600">
                        {Object.keys(batchResults[0]).slice(0,6).map(h => (
                          <th key={h} className="pr-4 pb-2">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {batchResults.slice(0,6).map((r, i) => (
                        <tr key={i} className="align-top">
                          {Object.keys(batchResults[0]).slice(0,6).map((h, j) => (
                            <td key={j} className="pr-4 py-2 text-gray-700">{String(r[h])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>

        <footer className="text-xs text-gray-400 pt-2">Tip: replace the internal predictContinuous() with a call to your trained model/API for better accuracy.</footer>
      </div>
    </div>
  );
}

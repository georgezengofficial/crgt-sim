import { useState, useCallback } from 'react';
import {
  CANONICAL_FIELDS,
  guessColumnMapping,
  parseUploadedFile,
  applyMapping
} from '../lib/dataPipeline';

export default function DataUpload({ onProcessed }) {
  const [fileName, setFileName] = useState(null);
  const [rawHeaders, setRawHeaders] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [mapping, setMapping] = useState({});
  const [parseError, setParseError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async file => {
    setParseError(null);

    try {
      const { headers, data } = await parseUploadedFile(file);
      if (headers.length === 0) {
        setParseError('Could not find a header row in this file.');
        return;
      }

      setFileName(file.name);
      setRawHeaders(headers);
      setRawData(data);
      setMapping(guessColumnMapping(headers));
    } catch (err) {
      setParseError('Failed to parse file: ' + err.message);
    }
  }, []);

  const onDrop = useCallback(
    e => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile]
  );

  const onFileInput = useCallback(
    e => {
      if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0]);
      }
    },
    [handleFile]
  );

  const updateMapping = (fieldKey, header) => {
    setMapping(prev => ({ ...prev, [fieldKey]: header === '' ? undefined : header }));
  };

  const requiredMissing = CANONICAL_FIELDS.filter(f => f.required && !mapping[f.key]);

  const processMapping = () => {
    const result = applyMapping(rawHeaders, rawData, mapping);
    onProcessed({ ...result, fileName, rawHeaders, rawData, mapping });
  };

  return (
    <div className="data-panel">
      <div className="card">
        <div className="card-title">1. Upload Session Data</div>
        <div className="card-sub">
          CSV or Excel (.xlsx/.xls). Trial-level rows — one row per trial, any column names/order.
        </div>

        <div
          className={`dropzone ${dragOver ? 'dragover' : ''}`}
          onDragOver={e => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById('fileInputHidden').click()}
        >
          <div className="dropzone-label">
            {fileName ? (
              <>
                <b>{fileName}</b> loaded — click to replace
              </>
            ) : (
              <>
                Drag a file here, or <b>click to browse</b>
              </>
            )}
          </div>
          <input
            id="fileInputHidden"
            type="file"
            accept=".csv,.xlsx,.xls,.txt"
            style={{ display: 'none' }}
            onChange={onFileInput}
          />
        </div>

        {parseError && <div className="warn-box">{parseError}</div>}

        <div className="privacy-note">
          This runs entirely in your browser — files are parsed and modeled locally in JS, nothing is
          uploaded to a server or stored anywhere. Still, since this page is on a public URL, don't
          treat it as a substitute for however the lab normally handles data access/retention.
        </div>
      </div>

      {rawHeaders.length > 0 && (
        <div className="card">
          <div className="card-title">2. Confirm Column Mapping</div>
          <div className="card-sub">
            {rawData.length} rows detected. We guessed the mapping below — check it before
            processing.
          </div>

          <div className="scroll-x">
            <table className="map-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Maps to column</th>
                  <th>Required</th>
                </tr>
              </thead>
              <tbody>
                {CANONICAL_FIELDS.map(f => (
                  <tr key={f.key}>
                    <td>{f.label}</td>
                    <td>
                      <select
                        value={mapping[f.key] || ''}
                        onChange={e => updateMapping(f.key, e.target.value)}
                      >
                        <option value="">— none —</option>
                        {rawHeaders.map(h => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {f.required ? (
                        <span className="pill">required</span>
                      ) : (
                        <span className="pill" style={{ opacity: 0.5 }}>
                          optional
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {requiredMissing.length > 0 && (
            <div className="warn-box">
              Still need: {requiredMissing.map(f => f.label).join(', ')}
            </div>
          )}

          <div className="row-flex" style={{ marginTop: 14 }}>
            <button className="btn" disabled={requiredMissing.length > 0} onClick={processMapping}>
              Confirm & Process
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
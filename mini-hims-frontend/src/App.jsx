import React, { useState, useMemo, useEffect, useCallback } from 'react';
import * as api from './api';
import { DEFAULT_DOCTOR, DEFAULT_QUOTA } from './data';
import { convertToWav } from './wavHelper';

// ---------- Reusable bits ----------
function Toast({ msg, type }) {
  return <div className={`toast ${type || ''}`}>{msg}</div>;
}

function Badge({ status }) {
  const map = {
    'In Progress': ['in-progress', 'In Progress'],
    'Draft Ready': ['draft', 'Draft Ready'],
    'Sync Failed': ['sync-failed', 'Sync Failed'],
    'Synced': ['yes', 'Synced'],
  };
  const [cls, label] = map[status] || ['', status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

// ---------- Login & Sign Up ----------
function Login({ onLogin }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [confirmP, setConfirmP] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');

    if (!u.trim() || !p.trim()) {
      setErr('Username dan password wajib diisi.');
      return;
    }

    if (isSignUp) {
      if (p.length < 4) {
        setErr('Password minimal 4 karakter.');
        return;
      }
      if (p !== confirmP) {
        setErr('Konfirmasi password tidak cocok.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isSignUp) {
        // Daftar akun baru ke PostgreSQL
        const regRes = await api.registerUser(u.trim(), p);
        onLogin(regRes);
      } else {
        // Masuk dengan akun yang ada
        const res = await api.loginUser(u.trim(), p);
        onLogin(res);
      }
    } catch (error) {
      setErr(error.message || (isSignUp ? 'Pendaftaran gagal.' : 'Login gagal.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap card">
      <div className="login-logo"><i className="ph-hospital"></i></div>
      <div className="login-title">Mini HIMS — {isSignUp ? 'Sign Up' : 'Sign In'}</div>
      <div className="login-sub">
        {isSignUp ? 'Pendaftaran akun baru ke database PostgreSQL' : 'AI Scribe for independent practitioners'}
      </div>
      <form onSubmit={submit}>
        <div className="field">
          <label>Username</label>
          <input
            value={u}
            onChange={(e) => setU(e.target.value)}
            placeholder="Masukkan username"
            autoFocus
            disabled={loading}
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={p}
            onChange={(e) => setP(e.target.value)}
            placeholder="Masukkan password"
            disabled={loading}
          />
        </div>
        {isSignUp && (
          <div className="field">
            <label>Konfirmasi Password</label>
            <input
              type="password"
              value={confirmP}
              onChange={(e) => setConfirmP(e.target.value)}
              placeholder="Ulangi password"
              disabled={loading}
            />
          </div>
        )}
        {err && <div className="alert error">{err}</div>}
        {msg && <div className="alert success">{msg}</div>}
        <button className="btn primary" style={{ width: '100%', marginTop: 8 }} type="submit" disabled={loading}>
          {loading ? (isSignUp ? 'Mendaftarkan...' : 'Signing in...') : (isSignUp ? 'Sign Up & Masuk' : 'Sign In')}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <button
          type="button"
          className="btn"
          style={{ background: 'transparent', border: 'none', color: 'var(--primary, #0284c7)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}
          onClick={() => {
            setIsSignUp(!isSignUp);
            setErr('');
            setMsg('');
          }}
        >
          {isSignUp ? 'Sudah punya akun? Masuk (Sign In)' : 'Belum punya akun? Buat akun baru (Sign Up)'}
        </button>
      </div>

      <div className="login-demo" style={{ marginTop: 12 }}>
        Akun Master PostgreSQL: username <b>admin</b> · password <b>password</b>
      </div>
    </div>
  );
}

// ---------- Register patient modal ----------
function RegisterModal({ onDone }) {
  const [name, setName] = useState('');
  const [nik, setNik] = useState('');
  const [dob, setDob] = useState('');
  const [allergiesInput, setAllergiesInput] = useState('');
  const [errs, setErrs] = useState({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const e = {};
    if (!name.trim()) e.name = 'Name must not be empty';
    if (nik && (nik.length !== 16 || !/^\d+$/.test(nik))) e.nik = 'NIK must be 16 digits';
    if (!dob) e.dob = 'Date of Birth must not be empty';
    setErrs(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    try {
      const allergies = allergiesInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const pat = await api.createPatient({
        name: name.trim(),
        nik: nik.trim(),
        dob,
        allergies,
      });
      onDone(pat);
    } catch (err) {
      alert(`Gagal mendaftar pasien: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Register New Patient" onClose={() => onDone(null)}>
      <div className="field">
        <label>Full Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
        {errs.name && <div className="error">{errs.name}</div>}
      </div>
      <div className="field">
        <label>NIK (optional)</label>
        <input value={nik} onChange={(e) => setNik(e.target.value)} maxLength={16} disabled={loading} />
        <div className="hint">Leave empty for patient without NIK (e.g. infant)</div>
        {errs.nik && <div className="error">{errs.nik}</div>}
      </div>
      <div className="field">
        <label>Date of Birth</label>
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} disabled={loading} />
        {errs.dob && <div className="error">{errs.dob}</div>}
      </div>
      <div className="field">
        <label>Allergies (pisahkan dengan koma)</label>
        <input
          placeholder="contoh: Amoxicillin, Paracetamol"
          value={allergiesInput}
          onChange={(e) => setAllergiesInput(e.target.value)}
          disabled={loading}
        />
      </div>
      <div className="muted">no.RM will be auto-generated in PostgreSQL</div>
      <div className="modal-actions">
        <button className="btn" onClick={() => onDone(null)} disabled={loading}>Cancel</button>
        <button className="btn primary" onClick={submit} disabled={loading}>
          {loading ? 'Saving...' : 'Register & Continue'}
        </button>
      </div>
    </Modal>
  );
}

// ---------- Patient picker (New Recording) ----------
function PatientPicker({ patients, onSelect }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const results = q
    ? patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.noRM.toLowerCase().includes(q) ||
        (p.nik && p.nik.includes(q))
    )
    : patients;

  return (
    <Modal title="Select patient to start recording" onClose={() => onSelect(null)}>
      <div className="search-row">
        <input
          placeholder="Search by no.RM / NIK / name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>
      {results.length === 0 ? (
        <div>
          <p className="muted">No patients found. Register a patient first (Patients page), then start recording.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Patient Name</th><th>no.RM</th><th>NIK</th></tr>
            </thead>
            <tbody>
              {results.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => onSelect(p)}>
                  <td>{p.name}</td><td>{p.noRM}</td><td>{p.nik || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

// ---------- Patients page ----------
function PatientsPage({ patients, onRefresh, notify }) {
  const [query, setQuery] = useState('');
  const [showReg, setShowReg] = useState(false);
  const q = query.trim().toLowerCase();
  const shown = q
    ? patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.noRM.toLowerCase().includes(q) ||
        (p.nik && p.nik.includes(q))
    )
    : patients;

  const handleDelete = async (p) => {
    if (!window.confirm(`Hapus data pasien ${p.name} (${p.noRM}) beserta konsultasinya?`)) return;
    try {
      await api.deletePatient(p.id);
      notify(`Pasien ${p.name} berhasil dihapus.`, 'success');
      onRefresh();
    } catch (err) {
      notify(`Gagal menghapus: ${err.message}`, 'error');
    }
  };

  return (
    <>
      <div className="toolbar">
        <h1 className="page-title" style={{ margin: 0 }}><i className="ph-users"></i> Patients</h1>
        <button className="btn primary" onClick={() => setShowReg(true)}>
          <i className="ph-user-plus"></i> Register Patient
        </button>
      </div>
      <div className="card">
        <div className="search-row">
          <input
            placeholder="Search by no.RM / NIK / name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {shown.length === 0 ? (
          <div className="empty">
            <i className="ph-user"></i>No patients in database. Click &quot;Register Patient&quot; to add one.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Patient Name</th>
                  <th>no.RM</th>
                  <th>NIK</th>
                  <th>Date of Birth</th>
                  <th>Allergies</th>
                  <th style={{ width: 80 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.name}</b></td>
                    <td>{p.noRM}</td>
                    <td>{p.nik || '—'}</td>
                    <td>{p.dob}</td>
                    <td>{p.allergies && p.allergies.length ? p.allergies.join(', ') : '—'}</td>
                    <td>
                      <button
                        className="btn danger"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                        title="Hapus Pasien"
                        onClick={() => handleDelete(p)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showReg && (
        <RegisterModal
          onDone={(pat) => {
            setShowReg(false);
            if (pat) {
              notify(`Pasien ${pat.name} berhasil didaftarkan.`, 'success');
              onRefresh();
            }
          }}
        />
      )}
    </>
  );
}

// ---------- Consultation list ----------
function ConsultationList({ consultations, patients, quotaLeft, onNew, openRecording, onDelete, loading }) {
  const [query, setQuery] = useState('');

  const patientMap = useMemo(() => {
    const map = new Map();
    patients.forEach((p) => map.set(p.id, p));
    return map;
  }, [patients]);

  const shown = consultations.filter((c) => {
    if (!query.trim()) return true;
    const p = patientMap.get(c.patientId);
    const q = query.trim().toLowerCase();
    return p?.name.toLowerCase().includes(q) || p?.noRM.toLowerCase().includes(q);
  });

  return (
    <>
      <div className="toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>
          <i className="ph-clipboard-text"></i> Consultation
        </h1>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
          <input
            placeholder="Search active sessions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, minWidth: 180, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}
          />
          <button
            className="btn primary"
            disabled={quotaLeft <= 0}
            title={quotaLeft <= 0 ? 'Scribe quota is full' : ''}
            onClick={onNew}
          >
            + New Recording
          </button>
        </div>

        <div className="muted" style={{ marginBottom: 8 }}>
          Active Sessions ({quotaLeft <= 0 ? 'quota full' : `${quotaLeft} recordings left`})
        </div>

        {loading ? (
          <div className="empty">Memuat data konsultasi...</div>
        ) : consultations.length === 0 ? (
          <div className="empty">
            <i className="ph-file-text"></i>No active scribe sessions. Click &quot;+ New Recording&quot; to start.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Patient Name</th>
                  <th>no.RM</th>
                  <th>NIK</th>
                  <th>Status</th>
                  <th>Started At</th>
                  <th style={{ width: 60 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => {
                  const p = patientMap.get(c.patientId);
                  return (
                    <tr key={c.id}>
                      <td className="clickable" onClick={() => openRecording(c)}><b>{p?.name || `Pasien #${c.patientId}`}</b></td>
                      <td className="clickable" onClick={() => openRecording(c)}>{p?.noRM || '—'}</td>
                      <td className="clickable" onClick={() => openRecording(c)}>{p?.nik || '—'}</td>
                      <td className="clickable" onClick={() => openRecording(c)}><Badge status={c.status} /></td>
                      <td className="clickable" onClick={() => openRecording(c)}>{c.startedAt}</td>
                      <td>
                        <button
                          className="btn"
                          style={{ padding: '4px 8px', fontSize: 12, color: 'var(--danger, #dc2626)' }}
                          title="Hapus sesi"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Hapus sesi konsultasi ini?')) onDelete(c.id);
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {shown.length === 0 && consultations.length > 0 && (
                  <tr><td colSpan={6} className="muted">No matching sessions found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ---------- Scribe session ----------
function ScribeSession({ patient, consultation, onFinish, onBack }) {
  const [recording, setRecording] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [audioChunks, setAudioChunks] = useState([]);
  const [audioFile, setAudioFile] = useState(null);
  const [audioFileUrl, setAudioFileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [timer, setTimer] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const audioContextRef = React.useRef(null);
  const animFrameRef = React.useRef(null);
  const chunksRef = React.useRef([]);

  // Timer saat sedang merekam
  useEffect(() => {
    let interval = null;
    if (recording) {
      interval = setInterval(() => setTimer((t) => t + 1), 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [recording]);

  // Bersihkan stream dan audio context saat unmount
  useEffect(() => {
    return () => {
      stopAllMedia();
    };
  }, []);

  const stopAllMedia = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  };

  const formatTimer = (s) => {
    const mins = String(Math.floor(s / 60)).padStart(2, '0');
    const secs = String(s % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const startRecording = async () => {
    setErrorMsg('');
    chunksRef.current = [];
    setAudioChunks([]);
    setAudioFile(null);
    if (audioFileUrl) {
      URL.revokeObjectURL(audioFileUrl);
      setAudioFileUrl('');
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser Anda tidak mendukung perekaman mikrofon langsung. Silakan gunakan Google Chrome atau Microsoft Edge terbaru.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // 1. Live VU Audio Level Meter via Web Audio API
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          if (!streamRef.current) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const pct = Math.min(100, Math.round((avg / 90) * 100));
          setAudioLevel(pct);
          animFrameRef.current = requestAnimationFrame(updateLevel);
        };
        animFrameRef.current = requestAnimationFrame(updateLevel);
      }

      // 2. Setup MediaRecorder
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      let selectedMime = '';
      for (const m of mimeTypes) {
        if (MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }

      const recorder = selectedMime ? new MediaRecorder(stream, { mimeType: selectedMime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
          setAudioChunks([...chunksRef.current]);
        }
      };

      recorder.start(250);
      setRecording(true);
    } catch (err) {
      console.error('Gagal mengakses mikrofon:', err);
      stopAllMedia();
      setRecording(false);
      let msg = err.message || 'Gagal memulai perekaman mikrofon.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Izin akses mikrofon ditolak oleh browser. Silakan klik ikon gembok/izin di samping URL browser untuk mengaktifkan izin mikrofon, lalu coba lagi.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'Perangkat mikrofon tidak ditemukan pada komputer ini. Silakan sambungkan mikrofon atau pilih opsi "Pilih File Audio".';
      }
      setErrorMsg(msg);
    }
  };

  const cancelRecording = () => {
    stopAllMedia();
    setRecording(false);
    chunksRef.current = [];
    setAudioChunks([]);
    setErrorMsg('');
  };

  const processAudio = async (blobOrFile) => {
    if (!blobOrFile || blobOrFile.size < 500) {
      setErrorMsg('File rekaman suara kosong atau terlalu pendek. Pastikan Anda berbicara di depan mikrofon atau unggah file audio yang valid.');
      return;
    }

    setLoading(true);
    setLoadingMsg('Mengonversi audio ke format standar WAV (16kHz PCM)...');
    setErrorMsg('');

    try {
      // Konversi audio di Frontend ke format standar WAV 16-bit Mono (16kHz)
      let wavBlob;
      try {
        wavBlob = await convertToWav(blobOrFile, 16000);
      } catch (convErr) {
        console.warn('WAV conversion fallback:', convErr);
        wavBlob = blobOrFile;
      }

      setLoadingMsg('Sedang mentranskripsi suara dan menyusun draft SOAP medis dengan AI...');

      const formData = new FormData();
      formData.append('audio', wavBlob, 'recording.wav');

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        let displayError = errText;
        try {
          const parsed = JSON.parse(errText);
          if (parsed.detail && parsed.detail.message) {
            displayError = parsed.detail.message;
          } else if (parsed.error) {
            displayError = parsed.error;
          }
        } catch (_) {}
        throw new Error(displayError);
      }

      const data = await res.json();
      const soapResult = data.soap || { subjective: '', objective: '', assessment: '', plan: '' };
      const extractedRx = data.prescription || [];

      setLoading(false);
      onFinish({
        ...consultation,
        status: 'Draft Ready',
        soap: soapResult,
        prescription: extractedRx,
        rawTranscription: data.raw_transcription || '',
      });
    } catch (err) {
      console.error('Transcription API error:', err);
      setLoading(false);
      setErrorMsg(`Gagal memproses AI Scribe: ${err.message}`);
    }
  };

  const finish = () => {
    if (audioFile) {
      processAudio(audioFile);
      return;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        stopAllMedia();
        setRecording(false);

        if (blob.size < 500) {
          setErrorMsg('Durasi rekaman terlalu singkat atau tidak ada suara yang terdeteksi. Silakan coba lagi dan berbicara di mikrofon, atau gunakan file audio.');
          return;
        }
        processAudio(blob);
      };
      recorder.stop();
    } else {
      setErrorMsg('Tidak ada sesi perekaman mikrofon atau file audio yang aktif.');
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div className="rec-indicator" style={{ justifyContent: 'center', marginBottom: 16 }}>
          <span className="rec-dot"></span> AI Scribe Active
        </div>
        <h3 style={{ marginBottom: 8 }}>{loadingMsg}</h3>
        <p className="muted">Memproses transkripsi audio ke teks dan menyusun analisis SOAP klinis serta resep...</p>
      </div>
    );
  }

  if (recording) {
    return (
      <div className="card">
        <div className="toolbar">
          <h1 className="page-title" style={{ margin: 0 }}>
            <button className="btn" onClick={() => setConfirmLeave(true)} title="Kembali"><i className="ph-arrow-left"></i></button>
            Merekam Konsultasi — {patient.name}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '14px 0 6px' }}>
          <div className="rec-indicator">
            <span className="rec-dot"></span> Merekam Suara Langsung ({formatTimer(timer)})
          </div>
        </div>

        {/* Live VU Audio Level Meter */}
        <div className="audio-meter-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8, fontWeight: 600 }}>
            <span><i className="ph-microphone"></i> Status Input Mikrofon:</span>
            <span style={{ color: audioLevel > 8 ? 'var(--success, #10b981)' : 'var(--text-muted)' }}>
              {audioLevel > 8 ? '🎙️ Suara Terdeteksi (Sedang Merekam)' : 'Silakan berbicara ke mikrofon...'}
            </span>
          </div>
          <div className="audio-meter-track">
            <div className="audio-meter-fill" style={{ width: `${Math.max(4, audioLevel)}%` }}></div>
          </div>
        </div>

        <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
          Percakapan dokter dan pasien sedang direkam secara real-time. Klik tombol <b>Finish & Analisis SOAP</b> setelah konsultasi selesai.
        </div>

        {errorMsg && (
          <div className="alert error" style={{ marginBottom: 16 }}>
            {errorMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={finish} style={{ minWidth: 200 }}>
            <i className="ph-check"></i> Finish & Analisis SOAP
          </button>
          <button className="btn danger" onClick={cancelRecording}>
            <i className="ph-x"></i> Batalkan Rekaman
          </button>
        </div>

        {confirmLeave && (
          <Modal title="Tinggalkan sesi perekaman?" onClose={() => setConfirmLeave(false)}>
            <p className="muted">Sesi perekaman sedang berjalan. Yakin ingin meninggalkan halaman? Rekaman suara yang belum diproses akan dibatalkan.</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setConfirmLeave(false)}>Batal</button>
              <button className="btn danger" onClick={() => { stopAllMedia(); onBack(); }}>Tinggalkan</button>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>
          <button className="btn" onClick={onBack} title="Kembali"><i className="ph-arrow-left"></i></button>
          Sesi Konsultasi — {patient.name}
        </h1>
      </div>

      <div style={{ background: 'var(--surface-2)', padding: '12px 16px', borderRadius: 8, marginBottom: 18, fontSize: 13 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div><span className="muted">No. RM:</span> <b>{patient.noRM || '—'}</b></div>
          <div><span className="muted">NIK:</span> <b>{patient.nik || '—'}</b></div>
          <div><span className="muted">Alergi:</span> <b>{patient.allergies?.length > 0 ? patient.allergies.join(', ') : 'Tidak ada alergi'}</b></div>
        </div>
      </div>

      {errorMsg && (
        <div className="alert error" style={{ marginBottom: 16 }}>
          {errorMsg}
        </div>
      )}

      {audioFile ? (
        <div style={{ padding: 18, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-subtle, #f8fafc)', marginBottom: 18 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            <i className="ph-file-audio" style={{ marginRight: 6, color: 'var(--primary)' }}></i> File Audio Terpilih:
          </div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            {audioFile.name} ({(audioFile.size / 1024).toFixed(1)} KB)
          </div>
          {audioFileUrl && (
            <div style={{ marginBottom: 14 }}>
              <audio controls src={audioFileUrl} style={{ width: '100%', maxHeight: 40 }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn primary" onClick={() => processAudio(audioFile)}>
              <i className="ph-check"></i> Proses AI Scribe dengan File Ini
            </button>
            <button className="btn" onClick={() => { setAudioFile(null); if (audioFileUrl) URL.revokeObjectURL(audioFileUrl); setAudioFileUrl(''); }}>
              Ganti / Hapus File
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '24px 20px', border: '1px dashed var(--border)', borderRadius: 12, textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🎙️</div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: 16 }}>Perekaman Suara Konsultasi</h3>
          <p className="muted" style={{ maxWidth: 460, margin: '0 auto 20px', fontSize: 13 }}>
            Pilih untuk merekam percakapan dokter-pasien secara langsung via mikrofon, atau unggah file rekaman suara yang sudah ada.
          </p>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={startRecording} style={{ padding: '10px 20px', fontSize: 14 }}>
              <i className="ph-microphone"></i> Mulai Merekam Suara (Live Mic)
            </button>

            <span className="muted">atau</span>

            <label className="btn" style={{ cursor: 'pointer', padding: '10px 18px', fontSize: 14 }}>
              <i className="ph-file-audio"></i> Pilih File Audio Rekaman
              <input
                type="file"
                accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const f = e.target.files[0];
                    setAudioFile(f);
                    setAudioFileUrl(URL.createObjectURL(f));
                    setErrorMsg('');
                  }
                }}
              />
            </label>
          </div>
        </div>
      )}

      <div className="muted" style={{ fontSize: 12 }}>
        💡 <b>Catatan:</b> Pastikan mendapatkan persetujuan lisan pasien sebelum memulai perekaman konsultasi. Suara akan dikonversi ke format WAV 16kHz sebelum dianalisis oleh AI.
      </div>
    </div>
  );
}

// ---------- Review draft ----------
function ReviewDraft({ patient, consultation, onConfirm, onSaveDraft }) {
  const [soap, setSoap] = useState(consultation?.soap || { subjective: '', objective: '', assessment: '', plan: '' });
  const [prescriptions, setPrescriptions] = useState(consultation?.prescription || []);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setSoap({ ...soap, [k]: e.target.value });
  const addRx = () => setPrescriptions([...prescriptions, { drug: '', dosage: '', qty: '' }]);
  const removeRx = (i) => setPrescriptions(prescriptions.filter((_, idx) => idx !== i));
  const setRx = (i, k) => (e) => {
    const arr = [...prescriptions];
    arr[i][k] = e.target.value;
    setPrescriptions(arr);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    await onSaveDraft(soap, prescriptions);
    setSaving(false);
  };

  return (
    <div className="card">
      <div className="toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>Review Draft — {patient.name}</h1>
        <button className="btn" onClick={handleSaveDraft} disabled={saving}>
          <i className="ph-floppy-disk"></i> {saving ? 'Menyimpan...' : 'Save Draft'}
        </button>
      </div>

      {patient?.allergies && patient.allergies.length > 0 && prescriptions.length > 0 && (
        <div className="alert warning">⚠ Known allergies: {patient.allergies.join(', ')}</div>
      )}

      <div className="soap-block"><h3>Subjective</h3><textarea value={soap.subjective} onChange={set('subjective')} /></div>
      <div className="soap-block"><h3>Objective</h3><textarea value={soap.objective} onChange={set('objective')} /></div>
      <div className="soap-block"><h3>Assessment</h3><textarea value={soap.assessment} onChange={set('assessment')} /></div>
      <div className="soap-block"><h3>Plan</h3><textarea value={soap.plan} onChange={set('plan')} /></div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
            Prescription (Draft Resep)
          </h3>
          <button className="btn" onClick={addRx} style={{ fontSize: 12, padding: '4px 8px' }}>
            <i className="ph-plus"></i> Tambah Obat
          </button>
        </div>

        {prescriptions.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>Tidak ada resep obat. Klik &quot;Tambah Obat&quot; jika diperlukan.</p>
        ) : (
          <div className="table-wrap">
            <table className="prescribe-table">
              <thead>
                <tr><th>Drug (Nama Obat)</th><th>Dosage (Aturan Pakai)</th><th>Qty (Jumlah)</th><th style={{ width: 40 }}></th></tr>
              </thead>
              <tbody>
                {prescriptions.map((rx, i) => (
                  <tr key={i}>
                    <td><input value={rx.drug} onChange={setRx(i, 'drug')} placeholder="cth: Paracetamol 500mg" style={{ minWidth: 160 }} /></td>
                    <td><input value={rx.dosage} onChange={setRx(i, 'dosage')} placeholder="cth: 3x1 tablet" style={{ minWidth: 120 }} /></td>
                    <td><input value={rx.qty} onChange={setRx(i, 'qty')} placeholder="10" style={{ width: 60 }} /></td>
                    <td>
                      <button className="btn" style={{ padding: '2px 6px', color: '#dc2626' }} onClick={() => removeRx(i)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn primary" onClick={() => setShowConfirm(true)}>
          Finalize &amp; Sync to History
        </button>
      </div>

      {showConfirm && (
        <Modal title="Simpan sebagai Rekam Medis Final &amp; Sinkronisasi?" onClose={() => setShowConfirm(false)}>
          <p>Catatan rekam medis dan resep obat akan disimpan secara permanen ke PostgreSQL dan status diubah menjadi Synced.</p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setShowConfirm(false)}>Kembali ke Review</button>
            <button className="btn primary" onClick={() => onConfirm(soap, prescriptions)}>
              Ya, Simpan ke Database
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------- Print prescription dialog ----------
function PrintDialog({ onDone, prescription, patient }) {
  return (
    <Modal title="Cetak Resep Fisik" onClose={onDone}>
      <p>Pasien: <b>{patient?.name}</b> ({patient?.noRM})</p>
      <div className="table-wrap" style={{ margin: '12px 0' }}>
        <table>
          <thead>
            <tr><th>Nama Obat</th><th>Aturan Pakai</th><th>Qty</th></tr>
          </thead>
          <tbody>
            {prescription.map((rx, i) => (
              <tr key={i}>
                <td>{rx.drug}</td><td>{rx.dosage}</td><td>{rx.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="alert info">
        Silakan cetak dan bubuhkan tanda tangan fisik dokter sebelum diserahkan ke farmasi.
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onDone}>Selesai</button>
        <button className="btn primary" onClick={() => { window.print(); }}>Cetak Resep</button>
      </div>
    </Modal>
  );
}

// ---------- History page ----------
function HistoryList({ history, patients, onDelete }) {
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState(null);

  const patientMap = useMemo(() => {
    const map = new Map();
    patients.forEach((p) => map.set(p.id, p));
    return map;
  }, [patients]);

  const shown = history.filter((h) => {
    const p = patientMap.get(h.patientId);
    const q = query.trim().toLowerCase();
    return !q || p?.name.toLowerCase().includes(q) || (p?.nik && p.nik.includes(q)) || p?.noRM.toLowerCase().includes(q);
  });

  if (detail) {
    const p = patientMap.get(detail.patientId);
    return (
      <div className="card">
        <div className="toolbar">
          <h1 className="page-title" style={{ margin: 0 }}>
            <button className="btn" onClick={() => setDetail(null)}><i className="ph-arrow-left"></i></button>
            Consultation Detail — {p?.name || `Pasien #${detail.patientId}`}
          </h1>
        </div>
        <div className="alert info">Status: Synced to PostgreSQL (Read-Only)</div>
        <div className="detail-label">no.RM</div><div className="detail-value">{p?.noRM || '—'}</div>
        <div className="detail-label">Patient</div><div className="detail-value">{p?.name} · NIK {p?.nik || '—'}</div>
        <div className="detail-label">Date</div><div className="detail-value">{detail.startedAt}</div>
        <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
        <div className="soap-block"><h3>Subjective</h3><div>{detail.soap.subjective || '—'}</div></div>
        <div className="soap-block"><h3>Objective</h3><div>{detail.soap.objective || '—'}</div></div>
        <div className="soap-block"><h3>Assessment</h3><div>{detail.soap.assessment || '—'}</div></div>
        <div className="soap-block"><h3>Plan</h3><div>{detail.soap.plan || '—'}</div></div>
        {detail.prescription && detail.prescription.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Prescription</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Drug</th><th>Dosage</th><th>Qty</th></tr></thead>
                <tbody>
                  {detail.prescription.map((rx, i) => (
                    <tr key={i}><td>{rx.drug}</td><td>{rx.dosage}</td><td>{rx.qty}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="search-row">
        <input
          placeholder="Search by patient name, no.RM, or NIK..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>History (Synced Rekam Medis)</h3>
      {shown.length === 0 ? (
        <div className="empty">
          <i className="ph-clock-counter-clockwise"></i>No history yet. Consultations appear here after syncing.
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Patient Name</th>
                <th>no.RM</th>
                <th>NIK</th>
                <th>Date</th>
                <th>Prescription</th>
                <th style={{ width: 60 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((h) => {
                const p = patientMap.get(h.patientId);
                const hasRx = h.prescription && h.prescription.length > 0;
                return (
                  <tr key={h.id}>
                    <td className="clickable" onClick={() => setDetail(h)}><b>{p?.name || `Pasien #${h.patientId}`}</b></td>
                    <td className="clickable" onClick={() => setDetail(h)}>{p?.noRM || '—'}</td>
                    <td className="clickable" onClick={() => setDetail(h)}>{p?.nik || '—'}</td>
                    <td className="clickable" onClick={() => setDetail(h)}>{h.startedAt}</td>
                    <td className="clickable" onClick={() => setDetail(h)}>
                      {hasRx ? <span className="badge yes">Yes ({h.prescription.length})</span> : <span className="badge no">No</span>}
                    </td>
                    <td>
                      <button
                        className="btn"
                        style={{ padding: '4px 8px', fontSize: 12, color: 'var(--danger, #dc2626)' }}
                        title="Hapus riwayat"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Hapus riwayat konsultasi ini?')) onDelete(h.id);
                        }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- App Shell ----------
export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => {
    return Boolean(localStorage.getItem('mini_hims_user_id'));
  });
  const [doctor, setDoctor] = useState(() => {
    const saved = localStorage.getItem('mini_hims_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        if (u) return { username: u.username, name: u.username, role: u.role || 'Practitioner' };
      } catch (_) { }
    }
    return DEFAULT_DOCTOR;
  });
  const [dark, setDark] = useState(false);
  const [page, setPage] = useState('consultation');

  // Database Live States
  const [patients, setPatients] = useState([]);
  const [activeConsultations, setActiveConsultations] = useState([]);
  const [historyConsultations, setHistoryConsultations] = useState([]);
  const [quota, setQuota] = useState(DEFAULT_QUOTA);
  const [loadingData, setLoadingData] = useState(false);

  // Active Session / Flow states
  const [patient, setPatient] = useState(null);
  const [consultation, setConsultation] = useState(null);
  const [toast, setToast] = useState(null);
  const [showPrint, setShowPrint] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [printRx, setPrintRx] = useState([]);

  useEffect(() => {
    document.body.classList.toggle('dark', dark);
    document.body.style.background = dark ? '#0b1220' : '#f4f6f8';
  }, [dark]);

  const notify = (msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const loadData = useCallback(async () => {
    if (!api.getTenantUserId()) return;
    setLoadingData(true);
    try {
      const [pats, actives, syncds, q] = await Promise.all([
        api.fetchPatients(),
        api.fetchConsultations('active'),
        api.fetchConsultations('synced'),
        api.fetchQuota(),
      ]);
      setPatients(pats || []);
      setActiveConsultations(actives || []);
      setHistoryConsultations(syncds || []);
      setQuota(q || DEFAULT_QUOTA);
    } catch (err) {
      console.error('Error loading DB data:', err);
      notify(`Gagal terhubung ke database: ${err.message}`, 'error');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (loggedIn) {
      loadData();
    }
  }, [loggedIn, loadData]);

  const quotaLeft = quota.quota !== undefined ? Math.max(0, quota.quota) : Math.max(0, quota.total - quota.used);

  const openRecording = (c) => {
    if (!c) return;
    const pat = patients.find((p) => p.id === c.patientId);
    setPatient(pat);
    setConsultation(c);
    if (c.status === 'Draft Ready') {
      setPage('review');
    } else {
      setPage('session');
    }
  };

  const startNew = async (p) => {
    if (quotaLeft <= 0) {
      notify('Kuota Scribe habis.', 'error');
      return;
    }
    try {
      const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
      const newConsult = await api.createConsultation({
        patientId: p.id,
        status: 'In Progress',
        startedAt: nowStr,
        soap: { subjective: '', objective: '', assessment: '', plan: '' },
        prescription: [],
      });

      setPatient(p);
      setConsultation(newConsult);
      setPage('session');
      setShowPicker(false);
      loadData();
    } catch (err) {
      notify(`Gagal memulai konsultasi: ${err.message}`, 'error');
    }
  };

  const finishDraft = async (data) => {
    try {
      const updated = await api.updateConsultation({
        id: consultation.id,
        status: 'Draft Ready',
        soap: data.soap,
        prescription: data.prescription,
      });
      setConsultation(updated);
      setPage('review');
      loadData();
    } catch (err) {
      notify(`Gagal menyimpan draft: ${err.message}`, 'error');
      setConsultation({ ...consultation, ...data });
      setPage('review');
    }
  };

  const handleSaveDraft = async (soap, prescriptions) => {
    try {
      const updated = await api.updateConsultation({
        id: consultation.id,
        status: 'Draft Ready',
        soap,
        prescription: prescriptions,
      });
      setConsultation(updated);
      notify('Draft konsultasi berhasil disimpan ke database.', 'success');
      loadData();
    } catch (err) {
      notify(`Gagal menyimpan draft: ${err.message}`, 'error');
    }
  };

  const confirmSave = async (soap, prescriptions) => {
    if (quotaLeft <= 0) {
      notify('Kuota Scribe Anda telah habis (0 tersisa). Tidak dapat memfinalisasi konsultasi.', 'error');
      return;
    }

    try {
      await api.updateConsultation({
        id: consultation.id,
        status: 'Synced',
        soap,
        prescription: prescriptions,
      });

      if (prescriptions && prescriptions.length > 0) {
        setPrintRx(prescriptions);
        setShowPrint(true);
      } else {
        notify('Konsultasi berhasil disinkronisasi ke rekam medis (kuota berkurang 1).', 'success');
        setPage('consultation');
        setPatient(null);
        setConsultation(null);
      }
      loadData();
    } catch (err) {
      notify(`Gagal menyimpan rekam medis: ${err.message}`, 'error');
    }
  };

  const finishPrint = () => {
    setShowPrint(false);
    notify('Resep siap dicetak. Konsultasi telah disinkronisasi ke riwayat.', 'success');
    setPage('consultation');
    setPatient(null);
    setConsultation(null);
    loadData();
  };

  const handleDeleteConsultation = async (id) => {
    try {
      await api.deleteConsultation(id);
      notify('Konsultasi berhasil dihapus.', 'success');
      loadData();
    } catch (err) {
      notify(`Gagal menghapus konsultasi: ${err.message}`, 'error');
    }
  };

  return (
    <div className={dark ? 'app dark' : 'app'}>
      {!loggedIn ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button
              className="theme-toggle btn"
              title={dark ? 'Light mode' : 'Dark mode'}
              onClick={() => setDark(!dark)}
              aria-label="Toggle theme"
            >
              <span aria-hidden="true">{dark ? '☀️' : '🌙'}</span>
              <span className="toggle-label">{dark ? 'Light' : 'Dark'}</span>
            </button>
          </div>
          <Login
            onLogin={(userData) => {
              if (userData.id) {
                api.setTenantUserId(userData.id);
                localStorage.setItem('mini_hims_user', JSON.stringify(userData));
              }
              setDoctor({
                username: userData.username,
                name: userData.username,
                role: userData.role || 'Practitioner',
              });
              setLoggedIn(true);
            }}
          />
        </>
      ) : (
        <>
          <div className="topbar">
            <div className="brand"><i className="ph-hospital"></i> Mini HIMS</div>
            <div className="top-right">
              <button
                className="theme-toggle btn"
                title={dark ? 'Light mode' : 'Dark mode'}
                onClick={() => setDark(!dark)}
                aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <span aria-hidden="true">{dark ? '☀️' : '🌙'}</span>
                <span className="toggle-label">{dark ? 'Light' : 'Dark'}</span>
              </button>
              <span className={`quota-badge ${quotaLeft <= 3 ? 'warning' : ''}`}>
                Scribe quota: {quotaLeft} / {quota.total} left
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span>{doctor.name}</span>
                <span className="muted" style={{ fontSize: 11 }}>{doctor.role}</span>
              </span>
              <button
                className="btn"
                style={{ padding: '6px 10px' }}
                title="Logout"
                onClick={() => {
                  if (window.confirm('Log out of Mini HIMS?')) {
                    api.setTenantUserId('');
                    localStorage.removeItem('mini_hims_user');
                    setLoggedIn(false);
                    setPatient(null);
                    setConsultation(null);
                    setPatients([]);
                    setActiveConsultations([]);
                    setHistoryConsultations([]);
                  }
                }}
              >
                <span aria-hidden="true">⎋</span><span className="logout-label">Logout</span>
              </button>
            </div>
          </div>

          <div className="tabs" role="tablist">
            <button
              role="tab"
              className={page === 'patients' ? 'active' : ''}
              onClick={() => setPage('patients')}
            >
              Patients
            </button>
            <button
              role="tab"
              className={page === 'consultation' || page === 'session' || page === 'review' ? 'active' : ''}
              onClick={() => {
                setPage('consultation');
                setPatient(null);
                setConsultation(null);
              }}
            >
              Consultation
            </button>
            <button
              role="tab"
              className={page === 'history' ? 'active' : ''}
              onClick={() => setPage('history')}
            >
              History
            </button>
          </div>

          {page === 'patients' && (
            <PatientsPage patients={patients} onRefresh={loadData} notify={notify} />
          )}

          {page === 'consultation' && (
            <ConsultationList
              consultations={activeConsultations}
              patients={patients}
              quotaLeft={quotaLeft}
              loading={loadingData}
              onNew={() => setShowPicker(true)}
              openRecording={openRecording}
              onDelete={handleDeleteConsultation}
            />
          )}

          {page === 'session' && patient && consultation && (
            <ScribeSession
              patient={patient}
              consultation={consultation}
              onFinish={finishDraft}
              onBack={() => setPage('consultation')}
            />
          )}

          {page === 'review' && patient && consultation && (
            <ReviewDraft
              patient={patient}
              consultation={consultation}
              onConfirm={confirmSave}
              onSaveDraft={handleSaveDraft}
            />
          )}

          {page === 'history' && (
            <HistoryList
              history={historyConsultations}
              patients={patients}
              onDelete={handleDeleteConsultation}
            />
          )}
        </>
      )}

      {showPicker && (
        <PatientPicker
          patients={patients}
          onSelect={(p) => (p ? startNew(p) : setShowPicker(false))}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {showPrint && (
        <PrintDialog
          prescription={printRx}
          patient={patient}
          onDone={finishPrint}
        />
      )}
    </div>
  );
}

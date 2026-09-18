// API client for Mini HIMS backend (Multi-Tenant enabled)

const API_BASE = '/api';

let currentTenantUserId = localStorage.getItem('mini_hims_user_id') || '';

export function setTenantUserId(id) {
  currentTenantUserId = id ? String(id) : '';
  if (id) {
    localStorage.setItem('mini_hims_user_id', String(id));
  } else {
    localStorage.removeItem('mini_hims_user_id');
  }
}

export function getTenantUserId() {
  return currentTenantUserId || localStorage.getItem('mini_hims_user_id') || '';
}

function getAuthHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  const tenantId = getTenantUserId();
  if (tenantId) {
    headers['X-User-Id'] = tenantId;
  }
  return headers;
}

export async function fetchPatients(query = '') {
  const url = query ? `${API_BASE}/patients?q=${encodeURIComponent(query)}` : `${API_BASE}/patients`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Gagal mengambil data pasien');
  }
  return res.json();
}

export async function createPatient(data) {
  const res = await fetch(`${API_BASE}/patients`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Gagal mendaftarkan pasien');
  }
  return res.json();
}

export async function updatePatient(data) {
  const res = await fetch(`${API_BASE}/patients`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Gagal memperbarui data pasien');
  }
  return res.json();
}

export async function deletePatient(id) {
  const res = await fetch(`${API_BASE}/patients?id=${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Gagal menghapus data pasien');
  }
  return res.json();
}

export async function fetchConsultations(status = '', patientId = '') {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (patientId) params.append('patient_id', patientId);

  const qs = params.toString();
  const url = qs ? `${API_BASE}/consultations?${qs}` : `${API_BASE}/consultations`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Gagal mengambil data konsultasi');
  }
  return res.json();
}

export async function createConsultation(data) {
  const res = await fetch(`${API_BASE}/consultations`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Gagal membuat konsultasi');
  }
  return res.json();
}

export async function updateConsultation(data) {
  const res = await fetch(`${API_BASE}/consultations`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Gagal memperbarui data konsultasi');
  }
  return res.json();
}

export async function deleteConsultation(id) {
  const res = await fetch(`${API_BASE}/consultations?id=${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Gagal menghapus konsultasi');
  }
  return res.json();
}

export async function loginUser(username, password) {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || 'Username atau password salah');
  }
  if (data.id) {
    setTenantUserId(data.id);
  }
  return data;
}

export async function registerUser(username, password) {
  const res = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || 'Pendaftaran gagal');
  }
  if (data.id) {
    setTenantUserId(data.id);
  }
  return data;
}

export async function fetchQuota() {
  const res = await fetch(`${API_BASE}/quota`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Gagal mengambil data kuota');
  }
  return res.json();
}

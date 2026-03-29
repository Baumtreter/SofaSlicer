// API-Basis: im Dev-Modus via Vite-Proxy (/api → localhost:8000)
// Im Production-Build zeigt /api auf NAS_IP:8000 via nginx
const BASE = '/api'

async function req(method, path, body, isFormData = false) {
  const opts = { method, headers: {} }
  if (body && !isFormData) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  } else if (isFormData) {
    opts.body = body   // FormData — kein Content-Type Header setzen
  }
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// ── Files ─────────────────────────────────────────────────────────────────
export const files = {
  list: ()              => req('GET',  '/files/'),
  upload: (file)        => {
    const fd = new FormData()
    fd.append('file', file)
    return req('POST', '/files/upload', fd, true)
  },
  fetchUrl: (url)       => req('POST', '/files/fetch', { url }),
  delete: (filename)    => req('DELETE', `/files/${filename}`),
}

// ── Printers ──────────────────────────────────────────────────────────────
export const printers = {
  list:   ()              => req('GET',    '/printers/'),
  add:    (printer)       => req('POST',   '/printers/',        printer),
  update: (id, printer)   => req('PUT',    `/printers/${id}`,   printer),
  delete: (id)            => req('DELETE', `/printers/${id}`),
  state:  (id)            => req('GET',    `/printers/${id}/state`),
  pause:  (id)            => req('POST',   `/printers/${id}/pause`),
  resume: (id)            => req('POST',   `/printers/${id}/resume`),
  cancel: (id)            => req('POST',   `/printers/${id}/cancel`),
}

// ── Profiles ──────────────────────────────────────────────────────────────
export const profiles = {
  machines:  () => req('GET', '/profiles/machines'),
  filaments: () => req('GET', '/profiles/filaments'),
}

// ── Slice ─────────────────────────────────────────────────────────────────
export const slice = {
  start:  (filename, params)        => req('POST', '/slice/',                    { filename, params }),
  get:    (jobId)                   => req('GET',  `/slice/${jobId}`),
  send:   (jobId, printerId)        => req('POST', `/slice/${jobId}/send/${printerId}`),

  // Pollt alle 2s bis Status sliced/error
  poll: (jobId, onUpdate) => new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const job = await slice.get(jobId)
        onUpdate(job)
        if (job.status === 'sliced' || job.status === 'error') {
          clearInterval(interval)
          job.status === 'error' ? reject(new Error(job.error)) : resolve(job)
        }
      } catch (e) {
        clearInterval(interval)
        reject(e)
      }
    }, 2000)
  }),
}

const meta = document.getElementById('meta')
const statusEl = document.getElementById('status')
const bar = document.getElementById('bar')

const btnUpdate = document.getElementById('btnUpdate')

let lastStatus = 'idle'
let updateAvailable = false
let updateDownloaded = false

function setStatus(text) {
  statusEl.textContent = text
}

function setProgress(pct) {
  const v = Math.max(0, Math.min(100, pct || 0))
  bar.style.width = `${v}%`
}

function updateButtonState() {
  if (lastStatus === 'checking') {
    btnUpdate.textContent = 'Vérification...'
    btnUpdate.disabled = true
    btnUpdate.className = 'btn'
  } else if (updateAvailable && !updateDownloaded) {
    btnUpdate.textContent = 'Télécharger mise à jour'
    btnUpdate.disabled = false
    btnUpdate.className = 'btn primary'
  } else if (updateDownloaded) {
    btnUpdate.textContent = 'Redémarrer'
    btnUpdate.disabled = false
    btnUpdate.className = 'btn primary'
  } else if (lastStatus === 'not-available') {
    btnUpdate.textContent = 'À jour'
    btnUpdate.disabled = true
    btnUpdate.className = 'btn'
  } else {
    btnUpdate.textContent = 'Vérifier mise à jour'
    btnUpdate.disabled = false
    btnUpdate.className = 'btn primary'
  }
}

async function init() {
  try {
    const version = await window.ba9alino.app.getVersion()
    meta.textContent = `v${version}`
  } catch {
    meta.textContent = ''
  }

  window.ba9alino.updater.onStatus((payload) => {
    lastStatus = payload?.status || 'idle'

    if (lastStatus === 'checking') {
      setStatus('Vérification des mises à jour…')
      setProgress(0)
      updateAvailable = false
      updateDownloaded = false
    } else if (lastStatus === 'available') {
      setStatus('Mise à jour disponible')
      updateAvailable = true
      updateDownloaded = false
    } else if (lastStatus === 'not-available') {
      setStatus('Aucune mise à jour disponible')
      setProgress(0)
      updateAvailable = false
      updateDownloaded = false
    } else if (lastStatus === 'downloaded') {
      setStatus('Mise à jour téléchargée - Prêt à redémarrer')
      setProgress(100)
      updateAvailable = true
      updateDownloaded = true
    } else if (lastStatus === 'error') {
      setStatus(`Erreur: ${payload?.error || 'inconnue'}`)
      updateAvailable = false
      updateDownloaded = false
    }

    updateButtonState()
  })

  window.ba9alino.updater.onProgress((p) => {
    const pct = p?.percent || 0
    setStatus(`Téléchargement… ${pct.toFixed(1)}%`) 
    setProgress(pct)
  })

  btnUpdate.addEventListener('click', async () => {
    if (updateDownloaded) {
      // If update is downloaded, restart the app
      await window.ba9alino.updater.quitAndInstall()
    } else if (updateAvailable) {
      // If update is available, download it
      setStatus('Téléchargement…')
      const res = await window.ba9alino.updater.download()
      if (!res?.ok) {
        setStatus(`Erreur téléchargement: ${res?.error || 'inconnue'}`)
        updateButtonState()
      }
    } else {
      // Check for updates
      setStatus('Vérification…')
      const res = await window.ba9alino.updater.check()
      if (!res?.ok) {
        setStatus(`Erreur vérification: ${res?.error || 'inconnue'}`)
        updateButtonState()
      }
    }
  })

  // Initialize button state
  updateButtonState()
}

init()

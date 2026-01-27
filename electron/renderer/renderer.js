const meta = document.getElementById('meta')
const statusEl = document.getElementById('status')
const bar = document.getElementById('bar')

const btnCheck = document.getElementById('btnCheck')
const btnDownload = document.getElementById('btnDownload')
const btnRestart = document.getElementById('btnRestart')

let lastStatus = 'idle'

function setStatus(text) {
  statusEl.textContent = text
}

function setProgress(pct) {
  const v = Math.max(0, Math.min(100, pct || 0))
  bar.style.width = `${v}%`
}

async function init() {
  try {
    const version = await window.ba9alino.app.getVersion()
    const targetUrl = await window.ba9alino.app.getTargetUrl()
    meta.textContent = `v${version} • ${targetUrl}`
  } catch {
    meta.textContent = ''
  }

  window.ba9alino.updater.onStatus((payload) => {
    lastStatus = payload?.status || 'idle'

    if (lastStatus === 'checking') {
      setStatus('Vérification des mises à jour…')
      btnCheck.disabled = true
      btnDownload.disabled = true
      btnRestart.disabled = true
      setProgress(0)
      return
    }

    if (lastStatus === 'available') {
      setStatus('Mise à jour disponible. Cliquez sur Télécharger.')
      btnCheck.disabled = false
      btnDownload.disabled = false
      btnRestart.disabled = true
      return
    }

    if (lastStatus === 'not-available') {
      setStatus('Aucune mise à jour disponible.')
      btnCheck.disabled = false
      btnDownload.disabled = true
      btnRestart.disabled = true
      setProgress(0)
      return
    }

    if (lastStatus === 'downloaded') {
      setStatus('Mise à jour téléchargée. Cliquez sur Redémarrer.')
      btnCheck.disabled = false
      btnDownload.disabled = true
      btnRestart.disabled = false
      setProgress(100)
      return
    }

    if (lastStatus === 'error') {
      setStatus(`Erreur mise à jour: ${payload?.error || 'inconnue'}`)
      btnCheck.disabled = false
      btnDownload.disabled = true
      btnRestart.disabled = true
      return
    }
  })

  window.ba9alino.updater.onProgress((p) => {
    const pct = p?.percent || 0
    setStatus(`Téléchargement… ${pct.toFixed(1)}%`) 
    setProgress(pct)
  })

  btnCheck.addEventListener('click', async () => {
    setStatus('Vérification…')
    const res = await window.ba9alino.updater.check()
    if (!res?.ok) {
      setStatus(`Erreur: ${res?.error || 'inconnue'}`)
    }
  })

  btnDownload.addEventListener('click', async () => {
    setStatus('Téléchargement…')
    const res = await window.ba9alino.updater.download()
    if (!res?.ok) {
      setStatus(`Erreur: ${res?.error || 'inconnue'}`)
    }
  })

  btnRestart.addEventListener('click', async () => {
    await window.ba9alino.updater.quitAndInstall()
  })
}

init()

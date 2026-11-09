const resumeDialog = document.querySelector('#resume-dialog')
const zoomButton = document.querySelector('[data-resume-zoom]')
const documentScroll = document.querySelector('.resume-reader-scroll')
let resumeOpener

function setResumeZoom(zoomed) {
  documentScroll.classList.toggle('is-zoomed', zoomed)
  zoomButton.setAttribute('aria-pressed', String(zoomed))
  zoomButton.textContent = zoomed ? 'Fit page' : 'Zoom in'
  documentScroll.scrollTo(0, 0)
}

if (resumeDialog && typeof resumeDialog.showModal === 'function') {
  document.querySelectorAll('[data-resume-open]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      resumeOpener = link
      setResumeZoom(false)
      resumeDialog.showModal()
      document.documentElement.classList.add('resume-open')
    })
  })

  zoomButton.addEventListener('click', () => {
    setResumeZoom(zoomButton.getAttribute('aria-pressed') !== 'true')
  })

  resumeDialog.addEventListener('close', () => {
    document.documentElement.classList.remove('resume-open')
    resumeOpener?.focus({ preventScroll: true })
  })
}

const scenes = [...document.querySelectorAll('[data-scene]')]
const progress = document.querySelector('.reading-progress')
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
let scheduled = false

const clamp = value => Math.min(1, Math.max(0, value))

function renderScroll() {
  scheduled = false
  const viewport = window.innerHeight
  const reducedMotion = motionPreference.matches
  const scrollableHeight = document.documentElement.scrollHeight - viewport
  progress.style.transform = `scaleX(${scrollableHeight > 0 ? clamp(window.scrollY / scrollableHeight) : 0})`

  for (const scene of scenes) {
    const rect = scene.getBoundingClientRect()
    if (rect.bottom < 0 || rect.top > viewport) continue
    const amount = reducedMotion ? 0 : clamp(-rect.top / Math.max(1, rect.height - scene.firstElementChild.offsetHeight))
    scene.style.setProperty('--scroll', amount.toFixed(4))
  }

}

function requestRender() {
  if (scheduled) return
  scheduled = true
  window.requestAnimationFrame(renderScroll)
}

function updateMotion() {
  document.documentElement.classList.toggle('has-scroll-motion', !motionPreference.matches)
  scenes.forEach(scene => scene.style.setProperty('--scroll', 0))
  requestRender()
}

window.addEventListener('scroll', requestRender, { passive: true })
window.addEventListener('resize', requestRender, { passive: true })
window.addEventListener('pageshow', requestRender)
motionPreference.addEventListener('change', updateMotion)
updateMotion()

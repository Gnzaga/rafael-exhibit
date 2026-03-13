import { paintings, groups } from './paintings.js'
import { checkAuth, login, logout, getUser, isLoggedIn, needsProfile, onAuthChange } from './auth.js'
import { initProfileModal } from './profile.js'
import { renderComments } from './comments.js'

// ============================================================
// Render gallery sections
// ============================================================

const galleryEl = document.getElementById('gallery')

// Build flat index for lightbox navigation
const allPaintings = groups.flatMap((group) =>
  paintings.filter((p) => p.group === group.id)
)

groups.forEach((group) => {
  const groupPaintings = paintings.filter((p) => p.group === group.id)
  if (!groupPaintings.length) return

  const section = document.createElement('section')
  section.className = 'gallery-section'
  section.innerHTML = `
    <div class="gallery-section__header">
      <h2 class="section-heading">${group.title}</h2>
      <p class="gallery-section__description">${group.description}</p>
    </div>
    <div class="masonry"></div>
  `

  const masonry = section.querySelector('.masonry')

  groupPaintings.forEach((painting) => {
    const globalIndex = allPaintings.indexOf(painting)
    const card = document.createElement('div')
    card.className = 'painting-card'
    card.tabIndex = 0
    card.setAttribute('role', 'button')
    card.setAttribute('aria-label', `View ${painting.title}`)
    card.dataset.index = globalIndex

    card.innerHTML = `
      <picture>
        <source
          data-srcset="/images/thumb/${painting.file}.webp"
          type="image/webp"
        />
        <img
          class="painting-card__image"
          data-src="/images/thumb/${painting.file}.jpg"
          alt="${painting.title} by Rafael Gonzaga"
          loading="lazy"
        />
      </picture>
      <div class="painting-card__info">
        <div class="painting-card__title">${painting.title}</div>
        ${painting.year ? `<div class="painting-card__year">${painting.year}</div>` : ''}
      </div>
    `

    card.addEventListener('click', () => openLightbox(globalIndex))
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openLightbox(globalIndex)
      }
    })

    masonry.appendChild(card)
  })

  galleryEl.appendChild(section)
})

// ============================================================
// Lazy loading with IntersectionObserver
// ============================================================

const lazyObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      const card = entry.target
      const img = card.querySelector('img[data-src]')
      const source = card.querySelector('source[data-srcset]')

      if (source) {
        source.srcset = source.dataset.srcset
        source.removeAttribute('data-srcset')
      }
      if (img) {
        img.src = img.dataset.src
        img.removeAttribute('data-src')
      }

      card.classList.add('visible')
      lazyObserver.unobserve(card)
    })
  },
  {
    rootMargin: '200px 0px',
    threshold: 0.01,
  }
)

document.querySelectorAll('.painting-card').forEach((card) => {
  lazyObserver.observe(card)
})

// ============================================================
// Lightbox
// ============================================================

const lightbox = document.getElementById('lightbox')
const lightboxImg = document.getElementById('lightbox-img')
const lightboxSource = document.getElementById('lightbox-source')
const lightboxTitle = document.getElementById('lightbox-title')
const lightboxYear = document.getElementById('lightbox-year')
let currentIndex = 0
let touchStartX = 0
let touchEndX = 0

function openLightbox(index) {
  currentIndex = index
  updateLightbox()
  lightbox.hidden = false
  // Force reflow before adding class for transition
  lightbox.offsetHeight
  lightbox.classList.add('open')
  document.body.style.overflow = 'hidden'
  lightbox.querySelector('.lightbox__close').focus()
}

function closeLightbox() {
  lightbox.classList.remove('open')
  document.body.style.overflow = ''
  const commentsContainer = document.getElementById('lightbox-comments')
  if (commentsContainer) commentsContainer.innerHTML = ''
  setTimeout(() => {
    lightbox.hidden = true
  }, 300)
}

function updateLightbox() {
  const painting = allPaintings[currentIndex]
  if (!painting) return

  lightboxSource.srcset = `/images/full/${painting.file}.webp`
  lightboxImg.src = `/images/full/${painting.file}.jpg`
  lightboxImg.alt = `${painting.title} by Rafael Gonzaga`
  lightboxTitle.textContent = painting.title
  lightboxYear.textContent = painting.year ? `, ${painting.year}` : ''

  const commentsContainer = document.getElementById('lightbox-comments')
  if (commentsContainer) {
    renderComments(painting.file, commentsContainer)
  }
}

function prevPainting() {
  currentIndex = (currentIndex - 1 + allPaintings.length) % allPaintings.length
  updateLightbox()
}

function nextPainting() {
  currentIndex = (currentIndex + 1) % allPaintings.length
  updateLightbox()
}

// Close button
lightbox.querySelector('.lightbox__close').addEventListener('click', closeLightbox)
lightbox.querySelector('.lightbox__prev').addEventListener('click', prevPainting)
lightbox.querySelector('.lightbox__next').addEventListener('click', nextPainting)

// Click backdrop to close
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox || e.target.classList.contains('lightbox__content')) {
    closeLightbox()
  }
})

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('open')) return

  switch (e.key) {
    case 'Escape':
      closeLightbox()
      break
    case 'ArrowLeft':
      prevPainting()
      break
    case 'ArrowRight':
      nextPainting()
      break
  }
})

// Touch/swipe support
lightbox.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX
}, { passive: true })

lightbox.addEventListener('touchend', (e) => {
  touchEndX = e.changedTouches[0].screenX
  const diff = touchStartX - touchEndX
  if (Math.abs(diff) > 50) {
    if (diff > 0) nextPainting()
    else prevPainting()
  }
}, { passive: true })

// ============================================================
// Auth UI
// ============================================================

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function initAuth() {
  const profileModalRoot = document.getElementById('profile-modal-root')
  const profileModal = initProfileModal(profileModalRoot)

  const authBar = document.getElementById('auth-bar')

  function renderAuthBar() {
    const user = getUser()
    if (!user) {
      authBar.innerHTML = `<button class="auth-bar__login" id="auth-login-btn" aria-label="Family login">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        Family Login
      </button>`
      authBar.querySelector('#auth-login-btn').addEventListener('click', login)
    } else {
      authBar.innerHTML = `<span class="auth-bar__user">
        Signed in as <strong>${escapeHtml(user.display_name || user.email)}</strong>
        <button class="auth-bar__btn" id="auth-profile-btn">My Profile</button>
        <button class="auth-bar__btn" id="auth-logout-btn">Sign Out</button>
      </span>`
      authBar.querySelector('#auth-profile-btn').addEventListener('click', () => profileModal.open())
      authBar.querySelector('#auth-logout-btn').addEventListener('click', async () => {
        await logout()
      })
    }
  }

  onAuthChange(renderAuthBar)

  checkAuth().then(() => {
    if (needsProfile()) {
      profileModal.open()
    }
  })
}

initAuth()

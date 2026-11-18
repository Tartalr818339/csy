import { siteMeta, units } from '../src/data/units.js?v=20261118p';

const asset = (path) => path.replace(/^\.\//, '../');
const chapterAliases = { '装置艺术': '第五展区' };
const displayChapter = (chapter) => chapterAliases[chapter] || chapter;

const introUnit = units.find((unit) => unit.id === 'intro');
const contactUnit = units.find((unit) => unit.id === 'contact');
const workUnits = units.filter((unit) => !['intro', 'works', 'contact'].includes(unit.id));

const nav = document.querySelector('#chapter-nav');
const main = document.querySelector('#mobile-main');
const lightbox = document.querySelector('#lightbox');
const lightboxImage = document.querySelector('#lightbox-image');
const lightboxCaption = document.querySelector('#lightbox-caption');
const lightboxClose = document.querySelector('#lightbox-close');

function factList(facts = []) {
  return facts
    .map(
      (fact) => `
        <div class="fact-row">
          <dt>${fact.label}</dt>
          <dd>${fact.value}</dd>
        </div>`
    )
    .join('');
}

function renderIntro() {
  const image = asset(introUnit.hotspots[0].image);
  const paragraphs = introUnit.left.paragraphs
    .map((paragraph) => `<p class="lead">${paragraph}</p>`)
    .join('');

  return `
    <section class="intro-card" id="intro">
      <div class="intro-top">
        <img src="${image}" alt="${siteMeta.name}" />
        <div>
          <span class="intro-eyebrow">ABOUT / 序章</span>
          <h1>${introUnit.title}</h1>
        </div>
      </div>
      <p class="lead">${introUnit.left.lead}</p>
      ${paragraphs}
      <dl class="fact-list">${factList(introUnit.left.facts)}</dl>
    </section>`;
}

function renderWork(unit) {
  const chapter = displayChapter(unit.chapter);
  const gallery = unit.hotspots
    .map(
      (hotspot) => `
        <figure class="gallery-figure" data-caption="${hotspot.caption || hotspot.title}">
          <img src="${asset(hotspot.image)}" alt="${hotspot.title}" loading="lazy" />
          <figcaption>${hotspot.title}</figcaption>
        </figure>`
    )
    .join('');

  const paragraphs = [
    ...unit.left.paragraphs,
    ...unit.right.sections.map((section) => `${section.title}：${section.body}`),
    ...unit.hotspots.map((hotspot) => hotspot.description).filter(Boolean),
  ]
    .map((text) => `<p>${text}</p>`)
    .join('');

  return `
    <section class="work-section" id="work-${unit.id}" data-chapter="${chapter}">
      <div class="section-head">
        <span class="chapter-tag">${chapter}</span>
        <span class="kicker">${unit.kicker}</span>
      </div>
      <h2>${unit.title}</h2>
      <p class="lead">${unit.left.lead}</p>
      <div class="mobile-gallery">${gallery}</div>
      <details class="details">
        <summary>创作说明与档案</summary>
        <div class="detail-body">
          ${paragraphs}
          <dl class="fact-list">${factList(unit.left.facts)}</dl>
        </div>
      </details>
    </section>`;
}

function renderContact() {
  const qr = asset(contactUnit.hotspots[0].image);
  const facts = contactUnit.left.facts
    .map((fact) => `<p><strong>${fact.label}：</strong>${fact.value}</p>`)
    .join('');

  return `
    <section class="contact-card" id="contact">
      <span class="intro-eyebrow">CONTACT / 尾章</span>
      <h2>${contactUnit.title}</h2>
      <p class="lead">${contactUnit.left.lead}</p>
      <div class="contact-body">
        <img src="${qr}" alt="二维码" />
        <div>
          ${facts}
          <p><a href="mailto:${siteMeta.email}">${siteMeta.email}</a></p>
        </div>
      </div>
    </section>`;
}

function renderNav() {
  const chapters = [];
  workUnits.forEach((unit) => {
    const chapter = displayChapter(unit.chapter);
    if (!chapters.includes(chapter)) chapters.push(chapter);
  });

  nav.innerHTML = chapters
    .map(
      (chapter, index) => `
        <button class="chip ${index === 0 ? 'is-active' : ''}" type="button" data-chapter="${chapter}">
          ${chapter}
        </button>`
    )
    .join('');

  nav.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-chapter]');
    if (!chip) return;
    nav.querySelectorAll('.chip').forEach((item) => item.classList.toggle('is-active', item === chip));
    const target = document.querySelector(`.work-section[data-chapter="${chip.dataset.chapter}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function openLightbox(figure) {
  const image = figure.querySelector('img');
  lightboxImage.src = image.src;
  lightboxImage.alt = image.alt;
  lightboxCaption.textContent = figure.dataset.caption || image.alt;
  lightbox.hidden = false;
  document.body.classList.add('no-scroll');
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.classList.remove('no-scroll');
}

main.innerHTML = renderIntro() + workUnits.map(renderWork).join('') + renderContact();
renderNav();

main.addEventListener('click', (event) => {
  const figure = event.target.closest('.gallery-figure');
  if (figure) openLightbox(figure);
});

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox) closeLightbox();
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !lightbox.hidden) closeLightbox();
});

import { siteMeta } from './data/units.js?v=20261118p';

const pad = (value) => String(value).padStart(2, '0');

function factList(facts = []) {
  return `
    <dl class="fact-list">
      ${facts
        .map(
          (fact) => `
            <div class="fact-row">
              <dt>${fact.label}</dt>
              <dd>${fact.value}</dd>
            </div>`
        )
        .join('')}
    </dl>`;
}

function sectionList(sections = []) {
  return sections
    .map(
      (section) => `
        <section class="note-block">
          <h3>${section.title}</h3>
          <p>${section.body}</p>
        </section>`
    )
    .join('');
}

export class UI {
  constructor() {
    this.app = document.querySelector('#app');
    this.leftPage = document.querySelector('#left-page');
    this.rightPage = document.querySelector('#right-page');
    this.stageViewport = document.querySelector('#stage-viewport');
    this.coverPrompt = document.querySelector('#cover-prompt');
    this.chapterLabel = document.querySelector('#chapter-label');
    this.unitLabel = document.querySelector('#unit-label');
    this.directory = document.querySelector('#directory');
    this.directoryList = document.querySelector('#directory-list');
    this.modal = document.querySelector('#modal');
    this.modalImage = document.querySelector('#modal-image');
    this.modalTitle = document.querySelector('#modal-title');
    this.modalCaption = document.querySelector('#modal-caption');
    this.modalMeta = document.querySelector('#modal-meta');
    this.modalDescription = document.querySelector('#modal-description');
    this.loading = document.querySelector('#loading');
    this.loadingText = document.querySelector('#loading-text');
    this.audioButton = document.querySelector('#btn-audio');
    this.directoryButton = document.querySelector('#btn-directory');
    this.stageHint = document.querySelector('#stage-hint');
    this.hotspotTooltip = document.querySelector('#hotspot-tooltip');
    this.cursorDot = document.querySelector('#cursor-dot');
    this.cursorRing = document.querySelector('#cursor-ring');
    this.cursorLabel = document.querySelector('#cursor-label');
    this.canvas = document.querySelector('#scene-canvas');
    this.worksIndex = document.querySelector('#works-index');
    this.cursorTarget = { x: -100, y: -100 };
    this.cursorRingPosition = { x: -100, y: -100 };
    this.onHotspotSelect = null;
    this.onWorkSelect = null;

    this.rightPage?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-hotspot]');
      if (button && this.onHotspotSelect) this.onHotspotSelect(button.dataset.hotspot);
    });

    this.worksIndex?.addEventListener('click', (event) => {
      const card = event.target.closest('[data-work-id]');
      if (card && this.onWorkSelect) this.onWorkSelect(card.dataset.workId);
    });

    document.addEventListener('pointermove', (event) => {
      const card = event.target.closest?.('.gallery-item');
      if (!card) {
        if (this.tiltedCard) {
          this.tiltedCard.style.removeProperty('--tilt-x');
          this.tiltedCard.style.removeProperty('--tilt-y');
          this.tiltedCard = null;
        }
        return;
      }
      if (this.tiltedCard && this.tiltedCard !== card) {
        this.tiltedCard.style.removeProperty('--tilt-x');
        this.tiltedCard.style.removeProperty('--tilt-y');
      }
      this.tiltedCard = card;
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty('--tilt-x', `${(-py * 7).toFixed(2)}deg`);
      card.style.setProperty('--tilt-y', `${(px * 7).toFixed(2)}deg`);
    });

    this.initCustomCursor();
  }

  initCustomCursor() {
    if (!this.cursorDot || !this.cursorRing) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    document.body.classList.add('has-custom-cursor');

    const follow = () => {
      this.cursorDot.style.transform = `translate(${this.cursorTarget.x}px, ${this.cursorTarget.y}px) translate(-50%, -50%)`;
      this.cursorRingPosition.x += (this.cursorTarget.x - this.cursorRingPosition.x) * 0.18;
      this.cursorRingPosition.y += (this.cursorTarget.y - this.cursorRingPosition.y) * 0.18;
      this.cursorRing.style.transform = `translate(${this.cursorRingPosition.x}px, ${this.cursorRingPosition.y}px) translate(-50%, -50%)`;
      requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);

    document.addEventListener('pointermove', (event) => {
      this.cursorTarget.x = event.clientX;
      this.cursorTarget.y = event.clientY;
      this.cursorDot.classList.add('is-visible');
      this.cursorRing.classList.add('is-visible');

      const target = event.target;
      const isCanvas = target === this.canvas;
      let label = '';
      let mode = '';

      if (this.canvas?.classList.contains('is-dragging')) {
        label = '拖动中';
        mode = 'is-drag';
      } else if (isCanvas && this.canvas?.classList.contains('is-hover-hotspot')) {
        label = '查看';
        mode = 'is-hover';
      } else if (target.closest?.('button, .gallery-item, a, [data-hotspot]')) {
        label = '点击';
        mode = 'is-hover';
      } else if (isCanvas) {
        label = this.app?.classList.contains('is-open') ? '旋转' : '拖动';
        mode = 'is-drag';
      }

      this.cursorRing.classList.toggle('is-hover', mode === 'is-hover');
      this.cursorRing.classList.toggle('is-drag', mode === 'is-drag');
      this.cursorRing.classList.toggle('is-active', Boolean(label));
      if (this.cursorLabel) this.cursorLabel.textContent = label;
    });

    document.addEventListener('pointerdown', () => this.cursorRing.classList.add('is-pressed'));
    document.addEventListener('pointerup', () => this.cursorRing.classList.remove('is-pressed'));
    document.addEventListener('mouseleave', () => {
      this.cursorDot.classList.remove('is-visible');
      this.cursorRing.classList.remove('is-visible');
    });
    document.addEventListener('mouseenter', () => {
      this.cursorDot.classList.add('is-visible');
      this.cursorRing.classList.add('is-visible');
    });
  }

  setOpen(open) {
    this.app.classList.toggle('is-open', open);
    if (this.coverPrompt) this.coverPrompt.classList.toggle('is-hidden', open);
  }

  setTurning(active) {
    this.app.classList.toggle('is-turning', active);
  }

  setLoading(visible, message = '') {
    if (!this.loading) return;
    this.loading.classList.toggle('is-hidden', !visible);
    if (message && this.loadingText) this.loadingText.textContent = message;
  }

  setAudio(playing) {
    if (!this.audioButton) return;
    this.audioButton.classList.toggle('is-active', playing);
    this.audioButton.setAttribute('aria-pressed', String(playing));
    this.audioButton.querySelector('.control-label').textContent = playing ? '氛围音：开' : '氛围音：关';
  }

  setDirectory(open) {
    if (!this.directory) return;
    this.directory.classList.toggle('is-open', open);
    this.directory.setAttribute('aria-hidden', String(!open));
    this.directoryButton?.classList.toggle('is-active', open);
  }

  setChapter(unit, index, total) {
    if (this.chapterLabel) this.chapterLabel.textContent = `${unit.chapter} · ${pad(index + 1)}/${pad(total)}`;
    if (this.unitLabel) this.unitLabel.textContent = unit.nav;
  }

  setStageHint(text) {
    if (this.stageHint) this.stageHint.textContent = text;
  }

  showHotspotTooltip(text, x, y) {
    if (!this.hotspotTooltip || !text) return;
    this.hotspotTooltip.textContent = text;
    this.hotspotTooltip.style.transform = `translate(${x + 16}px, ${y - 12}px)`;
    this.hotspotTooltip.hidden = false;
    requestAnimationFrame(() => this.hotspotTooltip.classList.add('is-visible'));
  }

  hideHotspotTooltip() {
    if (!this.hotspotTooltip || this.hotspotTooltip.hidden) return;
    this.hotspotTooltip.classList.remove('is-visible');
    window.setTimeout(() => {
      this.hotspotTooltip.hidden = true;
    }, 160);
  }

  renderUnit(unit, index, total, activeNode = null, works = []) {
    if (this.leftPage) {
      this.leftPage.innerHTML = `
        <div class="page-head">
          <span>${unit.kicker}</span>
          <span>${pad(index + 1)} / ${pad(total)}</span>
        </div>
        <div class="page-inner">
          <span class="paper-tag">${unit.tag}</span>
          <h1 class="page-title">${unit.title}</h1>
          <p class="page-lead">${unit.left.lead}</p>
          <div class="body-copy">
            ${unit.left.paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('')}
          </div>
          ${factList(unit.left.facts)}
        </div>
        <div class="page-foot">
          <span>${siteMeta.englishName}</span>
          <span>${siteMeta.role}</span>
        </div>`;
    }

    if (this.rightPage) {
      const gallery = (unit.hotspots || [])
        .map(
          (hotspot, hotspotIndex) => `
            <button class="gallery-item ${hotspot.node === activeNode ? 'is-active' : ''}" data-hotspot="${hotspot.node}" type="button">
              <img src="${hotspot.image}" alt="${hotspot.title}" loading="lazy" />
              <span class="gallery-caption"><small>${pad(hotspotIndex + 1)}</small>${hotspot.title}</span>
            </button>`
        )
        .join('');
      const rightTitle = unit.right.title === undefined ? '展品注解' : unit.right.title;

      this.rightPage.innerHTML = `
        <div class="page-head">
          <span>${unit.chapter} / NOTES</span>
          <span>${pad(index + 1)} / ${pad(total)}</span>
        </div>
        <div class="page-inner right-inner">
          <div class="gallery" id="right-gallery" data-unit="${unit.id}">${gallery}</div>
          ${rightTitle ? `<h2 class="right-title">${rightTitle}</h2>` : ''}
          ${unit.right.intro ? `<p class="right-intro">${unit.right.intro}</p>` : ''}
          ${sectionList(unit.right.sections)}
          ${unit.right.note ? `<div class="margin-note">${unit.right.note}</div>` : ''}
        </div>
        <div class="page-foot">
          <span>PAPER BOOK ARCHIVE</span>
          <span>${unit.id.toUpperCase()}</span>
        </div>`;
    }

    this.renderWorksIndex(unit.layout === 'index' ? works : []);
  }

  renderWorksIndex(works) {
    if (!this.worksIndex) return;
    if (!works.length) {
      this.worksIndex.hidden = true;
      this.worksIndex.innerHTML = '';
      return;
    }

    this.worksIndex.hidden = false;
    this.worksIndex.innerHTML = `
      <div class="works-index-head">
        <span>WORKS INDEX</span>
        <strong>${works.length} 件作品 · 点击卡片进入展区</strong>
      </div>
      <div class="works-index-grid">
        ${works
          .map(
            (work) => `
              <button class="work-card" type="button" data-work-id="${work.id}">
                <img src="${work.image}" alt="${work.title}" loading="lazy" />
                <span class="work-card-body">
                  <small>${work.chapter} · ${work.nav}</small>
                  <strong>${work.title}</strong>
                </span>
              </button>`
          )
          .join('')}
      </div>`;
  }

  highlightHotspot(node) {
    this.rightPage?.querySelectorAll('.gallery-item').forEach((item) => {
      item.classList.toggle('is-active', item.dataset.hotspot === node);
    });
  }

  renderDirectory(units, activeIndex) {
    if (!this.directoryList) return;

    const chapterOrder = [
      '序章',
      '第一展区',
      '第二展区',
      '第三展区',
      '第四展区',
      '第五展区',
      '第六展区',
      '尾章',
    ];
    const chapterAliases = {
      '装置艺术': '第五展区',
    };
    const groups = new Map();

    units.forEach((unit, index) => {
      const chapter = chapterAliases[unit.chapter] || unit.chapter;
      if (!groups.has(chapter)) {
        groups.set(chapter, { chapter, index, count: 0 });
      }
      groups.get(chapter).count += 1;
    });

    const ordered = Array.from(groups.values()).sort((a, b) => {
      const ai = chapterOrder.indexOf(a.chapter);
      const bi = chapterOrder.indexOf(b.chapter);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });
    const activeChapter = chapterAliases[units[activeIndex]?.chapter] || units[activeIndex]?.chapter;

    this.directoryList.innerHTML = ordered
      .map(
        (group, index) => `
          <button class="directory-item ${group.chapter === activeChapter ? 'is-active' : ''}" data-index="${group.index}" type="button">
            <span class="directory-number">${pad(index + 1)}</span>
            <span class="directory-text">
              <strong>${group.chapter}</strong>
              <small>${group.count} 个页面</small>
            </span>
            <span class="directory-arrow">↗</span>
          </button>`
      )
      .join('');
  }

  showModal(hotspot) {
    if (!this.modal) return;
    this.modalImage.src = hotspot.image;
    this.modalImage.alt = hotspot.title;
    this.modalTitle.textContent = hotspot.title;
    this.modalCaption.textContent = hotspot.caption;
    this.modalDescription.textContent = hotspot.description;
    this.modalMeta.innerHTML = hotspot.meta.map((item) => `<span>${item}</span>`).join('');
    this.modal.classList.toggle('is-minimal', Boolean(hotspot.minimal));
    this.modal.hidden = false;
    requestAnimationFrame(() => this.modal.classList.add('is-visible'));
  }

  hideModal() {
    if (!this.modal || this.modal.hidden) return;
    this.modal.classList.remove('is-visible');
    window.setTimeout(() => {
      this.modal.hidden = true;
    }, 260);
  }

  getModalOpen() {
    return Boolean(this.modal && !this.modal.hidden);
  }
}

/* SMART v1.0 — 칸반보드 */

const Kanban = {
  COLUMNS: [
    { id: '아이디어', label: '아이디어', emoji: '💡' },
    { id: '예정',    label: '예정',    emoji: '📋' },
    { id: '진행중',  label: '진행중',  emoji: '🔥' },
    { id: '완료',    label: '완료',    emoji: '✅' }
  ],

  CATEGORIES: [
    { label: '수업 일정',  emoji: '🏫' },
    { label: '시험/테스트', emoji: '📝' },
    { label: '자료 제작',  emoji: '📚' },
    { label: '학생 상담',  emoji: '💬' },
    { label: '행정 업무',  emoji: '🗂️' }
  ],

  PRIORITIES: [
    { label: '최우선', color: '#EF4444' },
    { label: '높음',   color: '#F59E0B' },
    { label: '보통',   color: '#3B82F6' },
    { label: '낮음',   color: '#6B7280' }
  ],

  openFormColumn: null,
  selectedCategory: '행정 업무',
  selectedPriority: '보통',

  init() {
    const page = document.getElementById('page-kanban');
    if (!page) return;
    page.innerHTML = `
      <div class="page-header"><h2>프로젝트</h2></div>
      <div id="kanban-board" class="kanban-board"></div>`;
    this.render();
  },

  render() {
    const board = document.getElementById('kanban-board');
    if (!board) return;
    const cards = DB.getKanban();

    board.innerHTML = this.COLUMNS.map(col => {
      const colCards = cards.filter(c => c.status === col.id);
      const cardItems = colCards.map(c => this.renderCard(c)).join('');
      const isOpen = this.openFormColumn === col.id;

      return `
        <div class="kanban-col" data-col="${col.id}">
          <div class="kanban-col-header">
            <span>${col.emoji} ${col.label}</span>
            <span class="kanban-count">${colCards.length}</span>
          </div>
          <div class="kanban-cards">${cardItems}</div>
          ${isOpen ? this.renderAddForm(col.id) : ''}
          <button class="btn-kanban-add" data-col="${col.id}">+ 카드 추가</button>
        </div>`;
    }).join('');

    this.bindEvents();
  },

  renderCard(card) {
    const pri = this.PRIORITIES.find(p => p.label === card.priority) || this.PRIORITIES[2];
    const colIndex = this.COLUMNS.findIndex(c => c.id === card.status);
    const canLeft  = colIndex > 0;
    const canRight = colIndex < this.COLUMNS.length - 1;

    return `
      <div class="kanban-card" data-id="${card.id}">
        <div class="card-top">
          <span class="card-title">${card.title}</span>
          <button class="card-delete" data-id="${card.id}">✕</button>
        </div>
        ${card.desc ? `<p class="card-desc">${card.desc}</p>` : ''}
        <div class="card-bottom">
          <span class="tag tag-pri" style="color:${pri.color};border-color:${pri.color}">${card.priority}</span>
          <div class="card-move">
            ${canLeft  ? `<button class="card-move-btn" data-id="${card.id}" data-dir="left">◀</button>`  : '<span></span>'}
            ${canRight ? `<button class="card-move-btn" data-id="${card.id}" data-dir="right">▶</button>` : '<span></span>'}
          </div>
        </div>
      </div>`;
  },

  renderAddForm(colId) {
    const catOptions = this.CATEGORIES.map(c =>
      `<option value="${c.label}" ${c.label === this.selectedCategory ? 'selected' : ''}>${c.emoji} ${c.label}</option>`
    ).join('');
    const priOptions = this.PRIORITIES.map(p =>
      `<option value="${p.label}" ${p.label === this.selectedPriority ? 'selected' : ''}>${p.label}</option>`
    ).join('');

    return `
      <div class="add-form kanban-add-form">
        <input type="text" class="kanban-card-title" placeholder="카드 제목" maxlength="50">
        <textarea class="kanban-card-desc" placeholder="설명 (선택)" rows="2"></textarea>
        <select class="kanban-card-cat">${catOptions}</select>
        <select class="kanban-card-pri">${priOptions}</select>
        <div class="form-row">
          <button class="btn-secondary kanban-cancel" data-col="${colId}">취소</button>
          <button class="btn-primary kanban-submit" data-col="${colId}">추가</button>
        </div>
      </div>`;
  },

  bindEvents() {
    document.querySelectorAll('.btn-kanban-add').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openFormColumn = btn.dataset.col;
        this.render();
        const form = document.querySelector('.kanban-add-form');
        if (form) form.querySelector('input').focus();
      });
    });

    document.querySelectorAll('.kanban-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openFormColumn = null;
        this.render();
      });
    });

    document.querySelectorAll('.kanban-submit').forEach(btn => {
      btn.addEventListener('click', () => {
        const form  = btn.closest('.kanban-add-form');
        const title = form.querySelector('.kanban-card-title').value.trim();
        if (!title) { form.querySelector('.kanban-card-title').focus(); return; }
        const desc = form.querySelector('.kanban-card-desc').value.trim();
        const cat  = form.querySelector('.kanban-card-cat').value;
        const pri  = form.querySelector('.kanban-card-pri').value;
        DB.addCard(title, desc, cat, pri, btn.dataset.col);
        this.openFormColumn = null;
        this.render();
        App.updateDashboard();
      });
    });

    document.querySelectorAll('.card-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        DB.deleteCard(btn.dataset.id);
        this.render();
        App.updateDashboard();
      });
    });

    document.querySelectorAll('.card-move-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = DB.getKanban().find(c => c.id === btn.dataset.id);
        if (!card) return;
        const colIndex = this.COLUMNS.findIndex(c => c.id === card.status);
        const newIndex = btn.dataset.dir === 'left' ? colIndex - 1 : colIndex + 1;
        if (newIndex >= 0 && newIndex < this.COLUMNS.length) {
          DB.moveCard(btn.dataset.id, this.COLUMNS[newIndex].id);
          this.render();
          App.updateDashboard();
        }
      });
    });
  }
};

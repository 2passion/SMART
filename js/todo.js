/* SMART v1.0 — 오늘 할 일 */

const Todo = {
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

  selectedCategory: '행정 업무',
  selectedPriority: '보통',

  render() {
    const container = document.getElementById('todo-list');
    if (!container) return;

    const todos = DB.getTodos();
    const priorityOrder = ['최우선', '높음', '보통', '낮음'];
    const sorted = [...todos].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
    });

    if (sorted.length === 0) {
      container.innerHTML = `<div class="empty-state">할 일이 없습니다<br><span>아래 + 버튼으로 추가하세요</span></div>`;
      return;
    }

    container.innerHTML = sorted.map(todo => this.renderItem(todo)).join('');

    container.querySelectorAll('.todo-check').forEach(cb => {
      cb.addEventListener('change', (e) => {
        DB.toggleTodo(e.target.dataset.id);
        this.render();
        App.updateDashboard();
      });
    });
    container.querySelectorAll('.todo-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        DB.deleteTodo(e.target.closest('.todo-delete').dataset.id);
        this.render();
        App.updateDashboard();
      });
    });
  },

  renderItem(todo) {
    const cat = this.CATEGORIES.find(c => c.label === todo.category) || this.CATEGORIES[4];
    const pri = this.PRIORITIES.find(p => p.label === todo.priority) || this.PRIORITIES[2];
    return `
      <div class="todo-item ${todo.completed ? 'completed' : ''}">
        <label class="todo-check-wrap">
          <input type="checkbox" class="todo-check" data-id="${todo.id}" ${todo.completed ? 'checked' : ''}>
          <span class="checkmark"></span>
        </label>
        <div class="todo-body">
          <span class="todo-text">${todo.text}</span>
          <div class="todo-tags">
            <span class="tag tag-cat">${cat.emoji} ${todo.category}</span>
            <span class="tag tag-pri" style="color:${pri.color};border-color:${pri.color}">${todo.priority}</span>
          </div>
        </div>
        <button class="todo-delete" data-id="${todo.id}">✕</button>
      </div>`;
  },

  renderAddForm() {
    const catButtons = this.CATEGORIES.map(c => `
      <button class="cat-btn ${c.label === this.selectedCategory ? 'active' : ''}"
        data-cat="${c.label}">${c.emoji} ${c.label}</button>`).join('');
    const priButtons = this.PRIORITIES.map(p => `
      <button class="pri-btn ${p.label === this.selectedPriority ? 'active' : ''}"
        data-pri="${p.label}" style="${p.label === this.selectedPriority ? `background:${p.color};border-color:${p.color}` : `border-color:${p.color};color:${p.color}`}"
        >${p.label}</button>`).join('');

    return `
      <div class="add-form" id="todo-add-form">
        <input type="text" id="todo-input" placeholder="할 일을 입력하세요..." maxlength="100">
        <div class="form-label">카테고리</div>
        <div class="cat-group">${catButtons}</div>
        <div class="form-label">우선순위</div>
        <div class="pri-group">${priButtons}</div>
        <button class="btn-primary" id="todo-submit">추가하기</button>
      </div>`;
  },

  init() {
    const page = document.getElementById('page-todo');
    if (!page) return;

    page.innerHTML = `
      <div class="page-header"><h2>오늘 할 일</h2></div>
      <div id="todo-list" class="todo-list"></div>
      ${this.renderAddForm()}`;

    this.render();
    this.bindFormEvents();
  },

  bindFormEvents() {
    document.querySelectorAll('.cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedCategory = btn.dataset.cat;
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    document.querySelectorAll('.pri-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedPriority = btn.dataset.pri;
        const pri = this.PRIORITIES.find(p => p.label === btn.dataset.pri);
        document.querySelectorAll('.pri-btn').forEach(b => {
          const p = this.PRIORITIES.find(x => x.label === b.dataset.pri);
          b.style.background = '';
          b.style.color = p.color;
          b.style.borderColor = p.color;
          b.classList.remove('active');
        });
        btn.style.background = pri.color;
        btn.style.color = '#fff';
        btn.style.borderColor = pri.color;
        btn.classList.add('active');
      });
    });

    document.getElementById('todo-submit').addEventListener('click', () => {
      const input = document.getElementById('todo-input');
      const text = input.value.trim();
      if (!text) { input.focus(); return; }
      DB.addTodo(text, this.selectedCategory, this.selectedPriority);
      input.value = '';
      this.render();
      App.updateDashboard();
    });

    document.getElementById('todo-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('todo-submit').click();
    });
  }
};

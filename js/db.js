/* SMART v1.0 — 데이터베이스 관리 (LocalStorage) */

const DB = {
  // 키 상수
  KEYS: {
    TODOS: 'smart_todos',
    EVENTS: 'smart_events',
    KANBAN: 'smart_kanban'
  },

  // UUID 생성
  uuid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  // 오늘 날짜 문자열 (YYYY-MM-DD)
  today() {
    return new Date().toISOString().split('T')[0];
  },

  /* ── 할 일 ── */
  getTodos() {
    return JSON.parse(localStorage.getItem(this.KEYS.TODOS) || '[]');
  },
  saveTodos(todos) {
    localStorage.setItem(this.KEYS.TODOS, JSON.stringify(todos));
  },
  addTodo(text, category, priority) {
    const todos = this.getTodos();
    const todo = {
      id: this.uuid(),
      text,
      category: category || '행정 업무',
      priority: priority || '보통',
      completed: false,
      createdAt: this.today(),
      device: '화이트',
      ai: 'Claude'
    };
    todos.push(todo);
    this.saveTodos(todos);
    return todo;
  },
  toggleTodo(id) {
    const todos = this.getTodos();
    const todo = todos.find(t => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
      this.saveTodos(todos);
    }
    return todo;
  },
  deleteTodo(id) {
    const todos = this.getTodos().filter(t => t.id !== id);
    this.saveTodos(todos);
  },

  /* ── 일정 ── */
  getEvents() {
    return JSON.parse(localStorage.getItem(this.KEYS.EVENTS) || '[]');
  },
  saveEvents(events) {
    localStorage.setItem(this.KEYS.EVENTS, JSON.stringify(events));
  },
  addEvent(title, date, time, category, memo) {
    const events = this.getEvents();
    const event = {
      id: this.uuid(),
      title,
      date,
      time: time || '',
      category: category || '수업 일정',
      memo: memo || '',
      createdAt: this.today()
    };
    events.push(event);
    this.saveEvents(events);
    return event;
  },
  deleteEvent(id) {
    const events = this.getEvents().filter(e => e.id !== id);
    this.saveEvents(events);
  },
  getEventsByDate(date) {
    return this.getEvents().filter(e => e.date === date);
  },

  /* ── 칸반 ── */
  getKanban() {
    return JSON.parse(localStorage.getItem(this.KEYS.KANBAN) || '[]');
  },
  saveKanban(cards) {
    localStorage.setItem(this.KEYS.KANBAN, JSON.stringify(cards));
  },
  addCard(title, desc, category, priority, status) {
    const cards = this.getKanban();
    const card = {
      id: this.uuid(),
      title,
      desc: desc || '',
      category: category || '행정 업무',
      priority: priority || '보통',
      status: status || '아이디어',
      createdAt: this.today()
    };
    cards.push(card);
    this.saveKanban(cards);
    return card;
  },
  moveCard(id, newStatus) {
    const cards = this.getKanban();
    const card = cards.find(c => c.id === id);
    if (card) {
      card.status = newStatus;
      this.saveKanban(cards);
    }
  },
  deleteCard(id) {
    const cards = this.getKanban().filter(c => c.id !== id);
    this.saveKanban(cards);
  },

  /* ── 전체 초기화 ── */
  clearAll() {
    Object.values(this.KEYS).forEach(key => localStorage.removeItem(key));
  },

  /* ── 내보내기 ── */
  exportAll() {
    return {
      exportedAt: new Date().toISOString(),
      version: 'v1.0',
      todos: this.getTodos(),
      events: this.getEvents(),
      kanban: this.getKanban()
    };
  }
};

/* SMART v1.0 — 일정 캘린더 */

const Calendar = {
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(),

  CATEGORIES: [
    { label: '수업 일정',  emoji: '🏫', color: '#3B82F6' },
    { label: '시험/테스트', emoji: '📝', color: '#EF4444' },
    { label: '자료 제작',  emoji: '📚', color: '#8B5CF6' },
    { label: '학생 상담',  emoji: '💬', color: '#10B981' },
    { label: '행정 업무',  emoji: '🗂️', color: '#F59E0B' }
  ],

  init() {
    const page = document.getElementById('page-calendar');
    if (!page) return;
    page.innerHTML = `
      <div class="page-header"><h2>일정</h2></div>
      <div id="calendar-wrap"></div>
      <div id="event-list-wrap"></div>`;
    this.renderCalendar();
  },

  renderCalendar() {
    const wrap = document.getElementById('calendar-wrap');
    if (!wrap) return;

    const year  = this.currentYear;
    const month = this.currentMonth;
    const today  = DB.today();
    const events = DB.getEvents();

    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthNames  = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

    const eventMap = {};
    events.forEach(e => {
      if (!eventMap[e.date]) eventMap[e.date] = [];
      eventMap[e.date].push(e);
    });

    const weekDays  = ['일','월','화','수','목','금','토'];
    const dayHeaders = weekDays.map((d, i) =>
      `<div class="cal-day-header ${i===0?'sun':i===6?'sat':''}">${d}</div>`).join('');

    let cells = '';
    for (let i = 0; i < firstDay; i++) cells += `<div class="cal-cell empty"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday  = dateStr === today;
      const dayEvents = eventMap[dateStr] || [];
      const dots = dayEvents.slice(0, 3).map(e => {
        const cat = this.CATEGORIES.find(c => c.label === e.category);
        return `<span class="cal-dot" style="background:${cat ? cat.color : '#3B82F6'}"></span>`;
      }).join('');

      const dow = (firstDay + d - 1) % 7;
      cells += `
        <div class="cal-cell ${isToday ? 'today' : ''} ${dow===0?'sun':dow===6?'sat':''}"
          data-date="${dateStr}">
          <span class="cal-num">${d}</span>
          <div class="cal-dots">${dots}</div>
        </div>`;
    }

    wrap.innerHTML = `
      <div class="cal-nav">
        <button id="cal-prev">‹</button>
        <span class="cal-title">${year}년 ${monthNames[month]}</span>
        <button id="cal-next">›</button>
      </div>
      <div class="cal-grid">
        ${dayHeaders}
        ${cells}
      </div>`;

    document.getElementById('cal-prev').addEventListener('click', () => {
      if (this.currentMonth === 0) { this.currentYear--; this.currentMonth = 11; }
      else this.currentMonth--;
      this.renderCalendar();
      this.renderEventList(null);
    });
    document.getElementById('cal-next').addEventListener('click', () => {
      if (this.currentMonth === 11) { this.currentYear++; this.currentMonth = 0; }
      else this.currentMonth++;
      this.renderCalendar();
      this.renderEventList(null);
    });

    wrap.querySelectorAll('.cal-cell:not(.empty)').forEach(cell => {
      cell.addEventListener('click', () => {
        wrap.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
        this.renderEventList(cell.dataset.date);
      });
    });

    this.renderEventList(today);
  },

  renderEventList(date) {
    const wrap = document.getElementById('event-list-wrap');
    if (!wrap) return;

    if (!date) { wrap.innerHTML = ''; return; }

    const events = DB.getEventsByDate(date);
    const [y, m, d] = date.split('-');
    const dow = ['일','월','화','수','목','금','토'][new Date(date).getDay()];

    const catOptions = this.CATEGORIES.map(c =>
      `<option value="${c.label}">${c.emoji} ${c.label}</option>`).join('');

    const eventItems = events.length === 0
      ? `<div class="empty-state-sm">이 날 일정이 없습니다</div>`
      : events.map(e => this.renderEventItem(e)).join('');

    wrap.innerHTML = `
      <div class="event-section">
        <div class="event-date-title">${m}월 ${d}일 (${dow})</div>
        <div id="event-items">${eventItems}</div>
        <button class="btn-add-event" id="btn-add-event">+ 일정 추가</button>
        <div id="event-add-form" class="add-form hidden">
          <input type="text" id="event-title" placeholder="일정 제목" maxlength="50">
          <input type="time" id="event-time">
          <select id="event-cat">${catOptions}</select>
          <textarea id="event-memo" placeholder="메모 (선택)" rows="2"></textarea>
          <div class="form-row">
            <button class="btn-secondary" id="event-cancel">취소</button>
            <button class="btn-primary" id="event-submit">추가</button>
          </div>
        </div>
      </div>`;

    wrap.querySelectorAll('.event-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        DB.deleteEvent(btn.dataset.id);
        this.renderCalendar();
        this.renderEventList(date);
        App.updateDashboard();
      });
    });

    document.getElementById('btn-add-event').addEventListener('click', () => {
      document.getElementById('event-add-form').classList.remove('hidden');
      document.getElementById('btn-add-event').classList.add('hidden');
      document.getElementById('event-title').focus();
    });
    document.getElementById('event-cancel').addEventListener('click', () => {
      document.getElementById('event-add-form').classList.add('hidden');
      document.getElementById('btn-add-event').classList.remove('hidden');
    });
    document.getElementById('event-submit').addEventListener('click', () => {
      const title = document.getElementById('event-title').value.trim();
      if (!title) { document.getElementById('event-title').focus(); return; }
      const time = document.getElementById('event-time').value;
      const cat  = document.getElementById('event-cat').value;
      const memo = document.getElementById('event-memo').value.trim();
      DB.addEvent(title, date, time, cat, memo);
      this.renderCalendar();
      this.renderEventList(date);
      App.updateDashboard();
    });
  },

  renderEventItem(e) {
    const cat   = this.CATEGORIES.find(c => c.label === e.category);
    const color = cat ? cat.color : '#3B82F6';
    return `
      <div class="event-item" style="border-left-color:${color}">
        <div class="event-info">
          <span class="event-title">${e.title}</span>
          ${e.time ? `<span class="event-time">${e.time}</span>` : ''}
          <span class="event-cat" style="color:${color}">${cat ? cat.emoji : ''} ${e.category}</span>
          ${e.memo ? `<span class="event-memo">${e.memo}</span>` : ''}
        </div>
        <button class="event-delete" data-id="${e.id}">✕</button>
      </div>`;
  }
};

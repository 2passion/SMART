/* SMART v1.0 — 메인 앱 */

const App = {
  currentPage: 'home',

  pages: [
    { id: 'home',     label: '홈',     emoji: '🏠' },
    { id: 'todo',     label: '할 일',  emoji: '✓'  },
    { id: 'calendar', label: '일정',   emoji: '📅' },
    { id: 'kanban',   label: '프로젝트',emoji: '📋' },
    { id: 'settings', label: '설정',   emoji: '⚙️' }
  ],

  init() {
    this.renderNav();
    this.navigate('home');
    this.registerSW();
  },

  // 하단 네비게이션 렌더링
  renderNav() {
    const nav = document.getElementById('bottom-nav');
    nav.innerHTML = this.pages.map(p => `
      <button class="nav-btn ${p.id === this.currentPage ? 'active' : ''}"
        data-page="${p.id}">
        <span class="nav-icon">${p.emoji}</span>
        <span class="nav-label">${p.label}</span>
      </button>`).join('');

    nav.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.page));
    });
  },

  // 페이지 전환
  navigate(pageId) {
    this.currentPage = pageId;

    // 모든 페이지 숨기기
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${pageId}`);
    if (target) target.classList.add('active');

    // 네비 활성화
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === pageId);
    });

    // 페이지별 초기화
    if (pageId === 'home')     this.updateDashboard();
    if (pageId === 'todo')     Todo.init();
    if (pageId === 'calendar') Calendar.init();
    if (pageId === 'kanban')   Kanban.init();
    if (pageId === 'settings') this.initSettings();
  },

  // 대시보드 업데이트
  updateDashboard() {
    const todos = DB.getTodos();
    const events = DB.getEvents();
    const kanban = DB.getKanban();
    const today = DB.today();

    const todoTotal = todos.length;
    const todoDone = todos.filter(t => t.completed).length;
    const todayEvents = events.filter(e => e.date === today)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const inProgress = kanban.filter(c => c.status === '진행중').length;

    // 날짜 표시
    const now = new Date();
    const dowNames = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
    document.getElementById('dash-date').textContent =
      `${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일 ${dowNames[now.getDay()]}`;

    // 할 일 카드
    document.getElementById('dash-todo-count').textContent = `${todoDone} / ${todoTotal}`;
    document.getElementById('dash-todo-bar').style.width =
      todoTotal > 0 ? `${Math.round(todoDone/todoTotal*100)}%` : '0%';

    // 오늘 일정
    const evWrap = document.getElementById('dash-events');
    if (todayEvents.length === 0) {
      evWrap.innerHTML = `<div class="dash-empty">오늘 일정이 없습니다</div>`;
    } else {
      evWrap.innerHTML = todayEvents.slice(0, 3).map(e => {
        const cats = [
          {label:'수업 일정', color:'#3B82F6'},
          {label:'시험/테스트',color:'#EF4444'},
          {label:'자료 제작', color:'#8B5CF6'},
          {label:'학생 상담', color:'#10B981'},
          {label:'행정 업무', color:'#F59E0B'}
        ];
        const cat = cats.find(c => c.label === e.category);
        return `<div class="dash-event-item" style="border-left-color:${cat?cat.color:'#3B82F6'}">
          <span class="dash-event-title">${e.title}</span>
          ${e.time ? `<span class="dash-event-time">${e.time}</span>` : ''}
        </div>`;
      }).join('');
    }

    // 칸반 카드
    document.getElementById('dash-kanban-count').textContent = `${inProgress}개 진행중`;
  },

  // 설정 페이지
  initSettings() {
    const page = document.getElementById('page-settings');
    page.innerHTML = `
      <div class="page-header"><h2>설정</h2></div>
      <div class="settings-list">
        <div class="settings-card">
          <div class="settings-title">앱 정보</div>
          <div class="settings-row"><span>버전</span><span>SMART v1.0</span></div>
          <div class="settings-row"><span>개발</span><span>Claude (개발팀장)</span></div>
          <div class="settings-row"><span>목적</span><span>학원 운영 AI 통합 운영체계</span></div>
        </div>
        <div class="settings-card">
          <div class="settings-title">데이터</div>
          <button class="btn-settings" id="btn-export">📤 데이터 내보내기 (JSON)</button>
          <button class="btn-settings btn-danger" id="btn-clear">🗑️ 전체 데이터 초기화</button>
        </div>
        <div class="settings-card">
          <div class="settings-title">데이터 현황</div>
          <div class="settings-row"><span>할 일</span><span>${DB.getTodos().length}개</span></div>
          <div class="settings-row"><span>일정</span><span>${DB.getEvents().length}개</span></div>
          <div class="settings-row"><span>칸반 카드</span><span>${DB.getKanban().length}개</span></div>
        </div>
      </div>`;

    document.getElementById('btn-export').addEventListener('click', () => {
      const data = DB.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SMART_백업_${DB.today()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
      if (confirm('⚠️ 모든 데이터가 삭제됩니다.\n정말 초기화하시겠습니까?')) {
        DB.clearAll();
        alert('초기화 완료');
        this.initSettings();
        this.updateDashboard();
      }
    });
  },

  // 서비스 워커 등록
  registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js')
        .catch(err => console.log('SW 등록 실패:', err));
    }
  }
};

// 앱 시작
document.addEventListener('DOMContentLoaded', () => App.init());

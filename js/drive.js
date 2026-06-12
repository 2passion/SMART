/* SMART v1.1 — Google Drive 동기화 */

const Drive = {
  CLIENT_ID: '234579728452-o57vo4mlbu1khkhrc28ajnbo76bt6t68.apps.googleusercontent.com',
  SCOPE: 'https://www.googleapis.com/auth/drive.appdata',
  FILE_NAME: 'smart_data.json',

  tokenClient: null,
  accessToken: null,
  tokenExpiry: 0,
  fileId: null,
  debounceTimer: null,

  get isSignedIn() {
    return !!this.accessToken && Date.now() < this.tokenExpiry;
  },

  // GIS 라이브러리 로드 후 호출
  init() {
    if (typeof google === 'undefined' || !google.accounts) return;

    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.CLIENT_ID,
      scope: this.SCOPE,
      callback: (resp) => this._onToken(resp)
    });

    // 이전에 로그인한 경우 자동 재연결 시도
    if (localStorage.getItem('smart_drive_enabled') === 'true') {
      this.tokenClient.requestAccessToken({ prompt: '' });
    }

    this._renderStatus();
  },

  // 수동 로그인 (설정 페이지 버튼)
  signIn() {
    if (!this.tokenClient) {
      alert('Google 연동 라이브러리를 불러오는 중입니다.\n잠시 후 다시 시도하세요.');
      return;
    }
    this.tokenClient.requestAccessToken({ prompt: 'select_account' });
  },

  // 로그아웃
  signOut() {
    if (this.accessToken) {
      google.accounts.oauth2.revoke(this.accessToken, () => {});
    }
    this.accessToken = null;
    this.tokenExpiry = 0;
    this.fileId = null;
    clearTimeout(this.debounceTimer);
    localStorage.removeItem('smart_drive_enabled');
    localStorage.removeItem('smart_drive_last_sync');
    this._renderStatus();
    if (typeof App !== 'undefined' && App.currentPage === 'settings') App.initSettings();
  },

  // OAuth 토큰 수신 콜백
  _onToken(resp) {
    if (resp.error) {
      // 사용자가 명시적으로 거부한 경우만 플래그 제거
      if (resp.error === 'access_denied') {
        localStorage.removeItem('smart_drive_enabled');
      }
      // interaction_required: 자동 재연결 실패 → 수동 로그인 필요 (플래그 유지)
      this._renderStatus();
      if (typeof App !== 'undefined' && App.currentPage === 'settings') App.initSettings();
      return;
    }

    this.accessToken = resp.access_token;
    // expires_in(초) 기준에서 1분 여유
    this.tokenExpiry = Date.now() + (resp.expires_in - 60) * 1000;
    localStorage.setItem('smart_drive_enabled', 'true');

    this._renderStatus();
    if (typeof App !== 'undefined' && App.currentPage === 'settings') App.initSettings();

    // 로그인 성공 시 Drive 데이터 불러오기
    this.loadFromDrive();
  },

  // Drive → LocalStorage (앱 시작 또는 로그인 시)
  async loadFromDrive() {
    if (!this.isSignedIn) return;

    try {
      const fileId = await this._findFile();
      if (!fileId) return; // 첫 사용: 파일 없음, 최초 저장 시 생성

      this.fileId = fileId;
      const content = await this._downloadFile(fileId);
      const data = JSON.parse(content);

      if (data.todos !== undefined)  localStorage.setItem('smart_todos',  JSON.stringify(data.todos));
      if (data.events !== undefined) localStorage.setItem('smart_events', JSON.stringify(data.events));
      if (data.kanban !== undefined) localStorage.setItem('smart_kanban', JSON.stringify(data.kanban));

      // 현재 페이지 새로고침 (데이터 반영)
      if (typeof App !== 'undefined') App.navigate(App.currentPage);
      this._setSyncTime();
    } catch (e) {
      console.error('Drive 불러오기 실패:', e);
    }
  },

  // 데이터 변경 시 호출 — 3초 디바운스
  scheduleSave() {
    if (!this.isSignedIn) return;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this._saveNow(), 3000);
  },

  // LocalStorage → Drive 실제 저장
  async _saveNow() {
    if (!this.isSignedIn) return;

    const payload = JSON.stringify({
      savedAt: new Date().toISOString(),
      version: 'v1.1',
      todos:  JSON.parse(localStorage.getItem('smart_todos')  || '[]'),
      events: JSON.parse(localStorage.getItem('smart_events') || '[]'),
      kanban: JSON.parse(localStorage.getItem('smart_kanban') || '[]')
    });

    try {
      if (this.fileId) {
        await this._updateFile(this.fileId, payload);
      } else {
        // fileId 미확인 시 Drive에서 다시 검색
        const id = await this._findFile();
        if (id) {
          this.fileId = id;
          await this._updateFile(id, payload);
        } else {
          this.fileId = await this._createFile(payload);
        }
      }
      this._setSyncTime();
    } catch (e) {
      console.error('Drive 저장 실패:', e);
    }
  },

  // appDataFolder에서 파일 검색
  async _findFile() {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%22${this.FILE_NAME}%22&fields=files(id)`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  },

  // 파일 내용 다운로드
  async _downloadFile(fileId) {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    return res.text();
  },

  // 신규 파일 생성 (appDataFolder)
  async _createFile(content) {
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({
      name: this.FILE_NAME,
      parents: ['appDataFolder']
    })], { type: 'application/json' }));
    form.append('file', new Blob([content], { type: 'application/json' }));

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.accessToken}` },
        body: form
      }
    );
    const data = await res.json();
    return data.id;
  },

  // 기존 파일 업데이트
  async _updateFile(fileId, content) {
    await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: content
      }
    );
  },

  // 마지막 동기화 시간 저장 및 UI 갱신
  _setSyncTime() {
    const t = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    localStorage.setItem('smart_drive_last_sync', t);
    this._renderStatus();
    if (typeof App !== 'undefined' && App.currentPage === 'settings') App.initSettings();
  },

  // 홈 헤더 상태 배지 렌더링
  _renderStatus() {
    const el = document.getElementById('drive-status');
    if (!el) return;

    if (this.isSignedIn) {
      const t = localStorage.getItem('smart_drive_last_sync') || '';
      el.innerHTML = `<span class="drive-badge connected">☁ 연결됨${t ? ' · ' + t : ''}</span>`;
    } else {
      const wasEnabled = localStorage.getItem('smart_drive_enabled') === 'true';
      el.innerHTML = `<span class="drive-badge ${wasEnabled ? 'reconnecting' : 'disconnected'}">`
        + `☁ ${wasEnabled ? '재연결 중...' : '미연결'}</span>`;
    }
  }
};

// GIS 로드 완료 시 초기화
if (typeof google !== 'undefined' && google.accounts) {
  Drive.init();
} else {
  window.onGoogleLibraryLoad = () => Drive.init();
}

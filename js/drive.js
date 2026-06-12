/* SMART v1.1.1 — Google Drive 동기화 */

const Drive = {
  CLIENT_ID: '234579728452-o57vo4mlbu1khkhrc28ajnbo76bt6t68.apps.googleusercontent.com',
  SCOPE: 'https://www.googleapis.com/auth/drive.appdata',
  FILE_NAME: 'smart_data.json',

  tokenClient: null,
  accessToken: null,
  tokenExpiry: 0,
  fileId: null,
  debounceTimer: null,
  _silentRefresh: false, // 토큰 갱신 중 loadFromDrive 생략 플래그

  get isSignedIn() {
    return !!this.accessToken && Date.now() < this.tokenExpiry;
  },

  init() {
    if (typeof google === 'undefined' || !google.accounts) return;

    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.CLIENT_ID,
      scope: this.SCOPE,
      callback: (resp) => this._onToken(resp)
    });

    if (localStorage.getItem('smart_drive_enabled') === 'true') {
      this.tokenClient.requestAccessToken({ prompt: '' });
    }

    this._renderStatus();
  },

  signIn() {
    if (!this.tokenClient) {
      alert('Google 연동 라이브러리를 불러오는 중입니다.\n잠시 후 다시 시도하세요.');
      return;
    }
    this._silentRefresh = false;
    this.tokenClient.requestAccessToken({ prompt: 'select_account' });
  },

  signOut() {
    if (this.accessToken) {
      google.accounts.oauth2.revoke(this.accessToken, () => {});
    }
    this.accessToken = null;
    this.tokenExpiry = 0;
    this.fileId = null;
    this._silentRefresh = false;
    clearTimeout(this.debounceTimer);
    localStorage.removeItem('smart_drive_enabled');
    localStorage.removeItem('smart_drive_last_sync');
    this._renderStatus();
    if (typeof App !== 'undefined' && App.currentPage === 'settings') App.initSettings();
  },

  _onToken(resp) {
    if (resp.error) {
      this._silentRefresh = false;
      if (resp.error === 'access_denied') {
        localStorage.removeItem('smart_drive_enabled');
      }
      this._renderStatus();
      if (typeof App !== 'undefined' && App.currentPage === 'settings') App.initSettings();
      return;
    }

    this.accessToken = resp.access_token;
    this.tokenExpiry = Date.now() + (resp.expires_in - 60) * 1000;
    localStorage.setItem('smart_drive_enabled', 'true');

    this._renderStatus();
    if (typeof App !== 'undefined' && App.currentPage === 'settings') App.initSettings();

    if (this._silentRefresh) {
      // 토큰 만료 후 갱신 → 로컬 데이터 보존, 대기 저장만 실행
      this._silentRefresh = false;
      this.scheduleSave();
    } else {
      // 최초 로그인 → Drive 데이터 불러오기
      this.loadFromDrive();
    }
  },

  async loadFromDrive() {
    if (!this.isSignedIn) return;

    try {
      const fileId = await this._findFile();
      if (!fileId) return;

      this.fileId = fileId;
      const content = await this._downloadFile(fileId);
      const data = JSON.parse(content);

      if (data.todos !== undefined)  localStorage.setItem('smart_todos',  JSON.stringify(data.todos));
      if (data.events !== undefined) localStorage.setItem('smart_events', JSON.stringify(data.events));
      if (data.kanban !== undefined) localStorage.setItem('smart_kanban', JSON.stringify(data.kanban));

      if (typeof App !== 'undefined') App.navigate(App.currentPage);
      this._setSyncTime();
    } catch (e) {
      console.error('Drive 불러오기 실패:', e);
    }
  },

  // 데이터 변경 시 호출 — 토큰 만료 시 자동 갱신 후 저장
  scheduleSave() {
    if (!this.isSignedIn) {
      // 토큰 만료 + 이전 로그인 기록 있으면 조용히 재발급
      if (localStorage.getItem('smart_drive_enabled') === 'true' && this.tokenClient) {
        this._silentRefresh = true;
        this.tokenClient.requestAccessToken({ prompt: '' });
        // 재발급 성공 시 _onToken → scheduleSave() 재호출
      }
      return;
    }
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this._saveNow(), 3000);
  },

  async _saveNow() {
    if (!this.isSignedIn) return;

    const payload = JSON.stringify({
      savedAt: new Date().toISOString(),
      version: 'v1.1.1',
      todos:  JSON.parse(localStorage.getItem('smart_todos')  || '[]'),
      events: JSON.parse(localStorage.getItem('smart_events') || '[]'),
      kanban: JSON.parse(localStorage.getItem('smart_kanban') || '[]')
    });

    try {
      if (this.fileId) {
        await this._updateFile(this.fileId, payload);
      } else {
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

  async _findFile() {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%22${this.FILE_NAME}%22&fields=files(id)`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  },

  async _downloadFile(fileId) {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    if (!res.ok) throw new Error(`Drive 다운로드 실패: ${res.status}`);
    return res.text();
  },

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
    if (!res.ok) throw new Error(`Drive 파일 생성 실패: ${res.status}`);
    const data = await res.json();
    return data.id;
  },

  async _updateFile(fileId, content) {
    const res = await fetch(
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
    if (!res.ok) throw new Error(`Drive 업데이트 실패: ${res.status}`);
  },

  _setSyncTime() {
    const t = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    localStorage.setItem('smart_drive_last_sync', t);
    this._renderStatus();
    if (typeof App !== 'undefined' && App.currentPage === 'settings') App.initSettings();
  },

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

if (typeof google !== 'undefined' && google.accounts) {
  Drive.init();
} else {
  window.onGoogleLibraryLoad = () => Drive.init();
}

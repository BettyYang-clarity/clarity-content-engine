import { renderIdeaInbox } from './components/idea_inbox.js';
import { renderInterviewMaster } from './components/interview_master.js';
import { renderPodcastStudio } from './components/podcast_studio.js';
import { renderSocialMultiplier } from './components/social_multiplier.js';
import { renderSettings } from './components/settings.js';

class App {
  constructor() {
    this.state = {
      currentTab: 'inbox',
      ideas: [],
      selectedIdeaId: null,
      currentDetail: null,
      frameworks: [],
      brandConfig: null,
      settings: { has_gemini_key: false },
      trustedSources: [],
      isProcessing: false,
      // UI-only state used by components (edit mode, sub-tabs)
      ui: { editingMaster: false, podcastMode: 'talking', socialTab: 'ig' }
    };

    this.init();
  }

  async init() {
    this.bindEvents();
    await this.loadInitialData();
  }

  bindEvents() {
    // Nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        this.switchTab(targetTab);
      });
    });
  }

  switchTab(tabName) {
    this.state.currentTab = tabName;

    // Update nav buttons
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });

    const activePane = document.getElementById(`tab-${tabName}`);
    if (activePane) {
      activePane.classList.add('active');
      this.render();
    }
  }

  async loadInitialData() {
    try {
      // 1. Load Settings
      const settingsRes = await fetch('/api/settings').then(r => r.json());
      if (settingsRes.success) {
        this.state.settings = settingsRes.data;
        const statusLabel = document.getElementById('api-status-label');
        if (statusLabel) {
          statusLabel.textContent = this.state.settings.has_gemini_key ? 'Gemini 正常連線' : '未設定 API Key';
        }
      }

      // 2. Load Frameworks & Brand & Trusted Sources
      const fwRes = await fetch('/api/frameworks').then(r => r.json());
      if (fwRes.success) this.state.frameworks = fwRes.data;

      const brandRes = await fetch('/api/brand-config').then(r => r.json());
      if (brandRes.success) this.state.brandConfig = brandRes.data;
      
      const trustedRes = await fetch('/api/trusted-sources').then(r => r.json());
      if (trustedRes.success) this.state.trustedSources = trustedRes.data;

      // 3. Load Ideas
      await this.loadIdeas();

      // 4. Pull new phone captures (silently) if the Google Form inbox is configured
      if (this.state.settings.inbox_sheet_csv_url) this.syncInbox(true);

    } catch (err) {
      console.error('Initialization error:', err);
      this.showToast('連線失敗，請確認後端服務是否已啟動');
    }
  }

  async loadIdeas() {
    try {
      const res = await fetch('/api/ideas').then(r => r.json());
      if (res.success) {
        this.state.ideas = res.data;
        if (!this.state.selectedIdeaId && this.state.ideas.length > 0) {
          this.state.selectedIdeaId = this.state.ideas[0].id;
        }
        if (this.state.selectedIdeaId) {
          await this.loadIdeaDetail(this.state.selectedIdeaId);
        } else {
          this.render();
        }
      }
    } catch (err) {
      console.error('Failed to load ideas:', err);
    }
  }

  async loadIdeaDetail(id) {
    try {
      const res = await fetch(`/api/ideas/${id}`).then(r => r.json());
      if (res.success) {
        this.state.selectedIdeaId = id;
        this.state.currentDetail = res.data;
        this.render();
      }
    } catch (err) {
      console.error('Failed to load idea detail:', err);
    }
  }

  async selectIdea(id) {
    this.state.ui.editingMaster = false;
    await this.loadIdeaDetail(id);
  }

  async syncInbox(silent = false) {
    try {
      const res = await fetch('/api/inbox/sync', { method: 'POST' }).then(r => r.json());
      if (!res.success) {
        if (!silent) this.showToast(`同步失敗: ${res.error}`);
        return;
      }
      if (!res.data.configured) {
        if (!silent) this.showToast('尚未設定手機表單：請到「設定」貼上試算表 CSV 連結');
        return;
      }
      if (res.data.imported > 0) {
        this.showToast(`📱 已從手機匯入 ${res.data.imported} 則新靈感`);
        await this.loadIdeas();
      } else if (!silent) {
        this.showToast('沒有新的手機靈感');
      }
    } catch (err) {
      if (!silent) this.showToast(`同步失敗: ${err.message}`);
    }
  }

  async createIdea(payload) {
    try {
      this.state.isProcessing = true;
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.json());

      if (res.success) {
        this.showToast('靈感已記錄！');
        await this.loadIdeas();
        this.state.selectedIdeaId = res.data.id;
        await this.loadIdeaDetail(res.data.id);
      } else {
        this.showToast(res.error || '新增失敗');
      }
    } catch (err) {
      this.showToast(`錯誤: ${err.message}`);
    } finally {
      this.state.isProcessing = false;
      this.render();
    }
  }

  async runResearch(id) {
    try {
      this.state.isProcessing = true;
      this.render();
      this.showToast('Research Agent 正在檢索文獻與心理學架構...');

      const res = await fetch(`/api/research/${id}`, { method: 'POST' }).then(r => r.json());
      if (res.success) {
        this.showToast('✓ 學理研究包已生成！');
        await this.loadIdeaDetail(id);
        await this.loadIdeas();
      } else {
        this.showToast(`生成失敗: ${res.error}`);
      }
    } catch (err) {
      this.showToast(`研究失敗: ${err.message}`);
    } finally {
      this.state.isProcessing = false;
      this.render();
    }
  }

  async saveInterviewAndGenerateMaster(id, answers) {
    try {
      this.state.isProcessing = true;
      this.render();
      this.showToast('正在儲存洞見並啟動 Master Writer Agent...');

      // 1. Save interview answers
      await fetch(`/api/interview/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers })
      });

      // 2. Generate Master Article & CLEAR Review
      this.showToast('正在撰寫 12 步母文章並進行 CLEAR 門禁審查...');
      const res = await fetch(`/api/master/${id}`, { method: 'POST' }).then(r => r.json());

      if (res.success) {
        this.showToast('✓ 母文章與 CLEAR 審查完成！');
        await this.loadIdeaDetail(id);
        await this.loadIdeas();
      } else {
        this.showToast(`母文章生成失敗: ${res.error}`);
      }
    } catch (err) {
      this.showToast(`處理失敗: ${err.message}`);
    } finally {
      this.state.isProcessing = false;
      this.render();
    }
  }

  async approveMaster(id, isApproved) {
    try {
      const res = await fetch(`/api/master/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_approved: isApproved })
      }).then(r => r.json());

      if (res.success) {
        this.showToast(isApproved ? '✓ 母文章已核准 (APPROVED)！已解鎖播客與社群倍增' : '已取消核准狀態');
        await this.loadIdeaDetail(id);
        await this.loadIdeas();
      } else {
        this.showToast(`操作失敗: ${res.error}`);
      }
    } catch (err) {
      this.showToast(`操作失敗: ${err.message}`);
    }
  }

  async saveMasterEdit(id, content, versionNote) {
    try {
      this.state.isProcessing = true;
      this.render();
      const res = await fetch(`/api/master/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ master_article: content, note: versionNote })
      }).then(r => r.json());

      if (res.success) {
        this.state.ui.editingMaster = false;
        this.showToast(res.data?.unchanged ? '內容沒有變更' : '✓ 母文章已更新並儲存！建議按「重新審查」');
        await this.loadIdeaDetail(id);
        await this.loadIdeas();
      } else {
        this.showToast(`儲存失敗: ${res.error}`);
      }
    } catch (err) {
      this.showToast(`儲存失敗: ${err.message}`);
    } finally {
      this.state.isProcessing = false;
      this.render();
    }
  }

  async rerunClear(id) {
    try {
      this.state.isProcessing = true;
      this.render();
      this.showToast('重新執行 CLEAR 門禁審查中...');
      const res = await fetch(`/api/master/${id}/review`, { method: 'POST' }).then(r => r.json());
      if (res.success) {
        this.showToast('✓ CLEAR 審查完成！');
        await this.loadIdeaDetail(id);
      } else {
        this.showToast(`審查失敗: ${res.error}`);
      }
    } catch (err) {
      this.showToast(`審查失敗: ${err.message}`);
    } finally {
      this.state.isProcessing = false;
      this.render();
    }
  }

  async loadVersions(id) {
    try {
      const res = await fetch(`/api/master/${id}/versions`).then(r => r.json());
      return res.success ? res.data : [];
    } catch (err) {
      console.error('Failed to load versions', err);
      return [];
    }
  }

  async addTrustedSource(citation, note) {
    try {
      const res = await fetch('/api/trusted-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ citation, note })
      }).then(r => r.json());

      if (res.success) {
        this.showToast('✓ 已加入信任清單');
        const listRes = await fetch('/api/trusted-sources').then(r => r.json());
        if (listRes.success) this.state.trustedSources = listRes.data;
        this.render();
        return true;
      }
      this.showToast(`加入失敗: ${res.error}`);
      return false;
    } catch (err) {
      this.showToast(`加入失敗: ${err.message}`);
      return false;
    }
  }

  async deleteTrustedSource(id) {
    try {
      const res = await fetch(`/api/trusted-sources/${id}`, { method: 'DELETE' }).then(r => r.json());
      if (res.success) {
        this.showToast('✓ 已移除信任清單');
        const listRes = await fetch('/api/trusted-sources').then(r => r.json());
        if (listRes.success) this.state.trustedSources = listRes.data;
        this.render();
        return true;
      }
      this.showToast(`移除失敗: ${res.error}`);
      return false;
    } catch (err) {
      this.showToast(`移除失敗: ${err.message}`);
      return false;
    }
  }

  async generatePodcast(id) {
    try {
      this.state.isProcessing = true;
      this.render();
      this.showToast('Podcast Producer Agent 正在製作播客講稿與 Show Notes...');

      const res = await fetch(`/api/podcast/${id}`, { method: 'POST' }).then(r => r.json());
      if (res.success) {
        this.showToast('✓ 播客工具包已生成！');
        await this.loadIdeaDetail(id);
      } else {
        this.showToast(`播客生成失敗: ${res.error}`);
      }
    } catch (err) {
      this.showToast(`播客生成失敗: ${err.message}`);
    } finally {
      this.state.isProcessing = false;
      this.render();
    }
  }

  async generateMultiplier(id) {
    try {
      this.state.isProcessing = true;
      this.render();
      this.showToast('Social Multiplier Agent 正在為全社群平台調適矩陣...');

      const res = await fetch(`/api/multiplier/${id}`, { method: 'POST' }).then(r => r.json());
      if (res.success) {
        this.showToast('✓ IG、FB、Threads、Blog 矩陣全數生成完畢！');
        await this.loadIdeaDetail(id);
        await this.loadIdeas();
      } else {
        this.showToast(`倍增失敗: ${res.error}`);
      }
    } catch (err) {
      this.showToast(`倍增失敗: ${err.message}`);
    } finally {
      this.state.isProcessing = false;
      this.render();
    }
  }

  async saveSettings(payload) {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.json());

      if (res.success) {
        this.showToast('設定已成功儲存！');
        await this.loadInitialData();
      } else {
        this.showToast(`儲存失敗: ${res.error}`);
      }
    } catch (err) {
      this.showToast(`儲存失敗: ${err.message}`);
    }
  }

  showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 3200);
  }

  render() {
    const tab = this.state.currentTab;
    const container = document.getElementById(`tab-${tab}`);
    if (!container) return;

    if (tab === 'inbox') {
      renderIdeaInbox(container, this.state, this);
    } else if (tab === 'interview') {
      renderInterviewMaster(container, this.state, this);
    } else if (tab === 'podcast') {
      renderPodcastStudio(container, this.state, this);
    } else if (tab === 'social') {
      renderSocialMultiplier(container, this.state, this);
    } else if (tab === 'settings') {
      renderSettings(container, this.state, this);
    }
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.clarityApp = new App();
});

import { renderIdeaInbox } from './components/idea_inbox.js';
import { renderInterviewMaster } from './components/interview_master.js';
import { renderPodcastStudio } from './components/podcast_studio.js';
import { renderSocialMultiplier } from './components/social_multiplier.js';
import { renderSettings } from './components/settings.js';
import { api } from './utils.js';

class App {
  constructor() {
    this.state = {
      currentTab: 'inbox',
      ideas: [],
      selectedIdeaId: null,
      currentDetail: null,
      frameworks: [],
      brandConfig: null,
      settings: { has_gemini_key: false, export_dir: '' },
      trustedSources: [],
      learningLibrary: [],
      performanceLogs: [],
      allExports: [],
      isProcessing: false,
      activeProgress: null,
      ui: {
        editingIdea: false,
        editingResearch: false,
        editingMaster: false,
        editingPodcast: false,
        editingSocial: false,
        editingExportId: null,
        addingCustomExport: false,
        editingLibId: null,
        podcastMode: 'talking',
        socialTab: 'ig'
      }
    };

    this._progressPoller = null;
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
      // 1. Settings
      const settingsRes = await api('/api/settings');
      if (settingsRes.success) {
        this.state.settings = settingsRes.data;
        const statusLabel = document.getElementById('api-status-label');
        if (statusLabel) {
          statusLabel.textContent = this.state.settings.has_gemini_key ? 'Gemini 正常連線' : '未設定 API Key';
        }
      }

      // 2. Load Frameworks & Brand & Trusted Sources
      const fwRes = await api('/api/frameworks');
      if (fwRes.success) this.state.frameworks = fwRes.data;

      const brandRes = await api('/api/brand-config');
      if (brandRes.success) this.state.brandConfig = brandRes.data;

      const trustedRes = await api('/api/trusted-sources');
      if (trustedRes.success) this.state.trustedSources = trustedRes.data;

      // 3. Learning Library & Performance Logs
      await this.loadLearningData();

      // 4. Load Ideas
      await this.loadIdeas();

      // 5. Pull new phone captures (silently) if the Google Form inbox is configured
      if (this.state.settings.inbox_sheet_csv_url) this.syncInbox(true);

    } catch (err) {
      console.error('Initialization error:', err);
      this.showToast('連線失敗，請確認後端服務是否已啟動');
    }
  }

  async loadLearningData() {
    try {
      const [libRes, perfRes, expRes] = await Promise.all([
        api('/api/library').catch(() => ({ success: false })),
        api('/api/performance').catch(() => ({ success: false })),
        api('/api/exports').catch(() => ({ success: false }))
      ]);
      if (libRes.success) this.state.learningLibrary = libRes.data || [];
      if (perfRes.success) this.state.performanceLogs = perfRes.data || [];
      if (expRes.success) this.state.allExports = expRes.data || [];
    } catch (e) {
      console.warn('Failed to load learning/performance/export data:', e);
    }
  }

  async loadIdeas() {
    try {
      const res = await api('/api/ideas');
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
      const res = await api(`/api/ideas/${id}`);
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
    this.state.ui.editingIdea = false;
    this.state.ui.editingResearch = false;
    this.state.ui.editingMaster = false;
    this.state.ui.editingPodcast = false;
    this.state.ui.editingSocial = false;
    this.state.ui.interviewImages = null;
    await this.loadIdeaDetail(id);
  }

  // --- Real-time Progress Polling Hook ---
  startProgressPolling(ideaId, taskName) {
    this.state.isProcessing = true;
    this.state.activeProgress = { task: taskName, step: 0, total: 3, label: '啟動中...', elapsed_sec: 0 };
    this.renderProgressModal();

    if (this._progressPoller) clearInterval(this._progressPoller);
    this._progressPoller = setInterval(async () => {
      try {
        const res = await api(`/api/progress/${ideaId}`).catch(() => null);
        if (res && res.data) {
          this.state.activeProgress = res.data;
          this.renderProgressModal();
        }
      } catch (_) {}
    }, 1200);
  }

  stopProgressPolling() {
    if (this._progressPoller) {
      clearInterval(this._progressPoller);
      this._progressPoller = null;
    }
    this.state.isProcessing = false;
    this.state.activeProgress = null;
    this.renderProgressModal();
  }

  renderProgressModal() {
    const container = document.getElementById('progress-container');
    if (!container) return;

    if (!this.state.isProcessing || !this.state.activeProgress) {
      container.innerHTML = '';
      return;
    }

    const { task, step = 0, total = 3, label = '處理中...', elapsed_sec = 0 } = this.state.activeProgress;
    const pct = total > 0 ? Math.min(100, Math.round((step / total) * 100)) : 15;

    container.innerHTML = `
      <div class="progress-overlay">
        <div class="progress-modal">
          <div class="progress-header">
            <div class="progress-spinner"></div>
            <span class="progress-task-name">${task || 'Agent 正在運作'}</span>
          </div>
          <div class="progress-label">${label}</div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${pct}%"></div>
          </div>
          <div class="progress-footer">
            <span>進度：${step} / ${total}</span>
            <span>已耗時：${elapsed_sec}s</span>
          </div>
        </div>
      </div>
    `;
  }

  async syncInbox(silent = false) {
    try {
      const res = await api('/api/inbox/sync', { method: 'POST' });
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
      this.render();
      const res = await api('/api/ideas', { method: 'POST', body: payload });
      if (res.success) {
        this.showToast('✓ 靈感建立成功！');
        this.state.selectedIdeaId = res.data.id;
        await this.loadIdeas();
        await this.loadIdeaDetail(res.data.id);
        const form = document.getElementById('add-idea-form');
        if (form) form.style.display = 'none';
      }
    } catch (err) {
      this.showToast(`錯誤: ${err.message}`);
    } finally {
      this.state.isProcessing = false;
      this.render();
    }
  }

  async updateIdea(id, payload) {
    try {
      const res = await api(`/api/ideas/${id}`, { method: 'PUT', body: payload });
      if (res.success) {
        this.state.ui.editingIdea = false;
        this.showToast('✓ 已儲存靈感修改');
        await this.loadIdeas();
        await this.loadIdeaDetail(id);
      }
    } catch (err) {
      this.showToast(`修改失敗: ${err.message}`);
    }
  }

  async deleteIdea(id) {
    try {
      const res = await api(`/api/ideas/${id}`, { method: 'DELETE' });
      if (res.success) {
        this.showToast('🗑️ 已刪除此主題');
        this.state.selectedIdeaId = null;
        this.state.currentDetail = null;
        await this.loadIdeas();
        await this.loadLearningData();
      }
    } catch (err) {
      this.showToast(`刪除失敗: ${err.message}`);
    }
  }

  async runResearch(id) {
    try {
      this.startProgressPolling(id, 'Research Agent 跨領域佐證查證');
      const res = await api(`/api/research/${id}`, { method: 'POST' });
      if (res.success) {
        this.showToast('✓ 佐證研究包已生成！');
        await this.loadIdeaDetail(id);
        await this.loadIdeas();
      }
    } catch (err) {
      this.showToast(`研究失敗: ${err.message}`);
    } finally {
      this.stopProgressPolling();
      this.render();
    }
  }

  async updateResearchPack(id, researchPack) {
    try {
      const res = await api(`/api/research/${id}`, { method: 'PUT', body: { research_pack: researchPack } });
      if (res.success) {
        this.state.ui.editingResearch = false;
        this.showToast('✓ 已儲存研究重點');
        await this.loadIdeaDetail(id);
        await this.loadIdeas();
      }
    } catch (err) {
      this.showToast(`儲存研究包失敗: ${err.message}`);
    }
  }

  async deleteResearchPack(id) {
    try {
      const res = await api(`/api/research/${id}`, { method: 'DELETE' });
      if (res.success) {
        this.state.ui.editingResearch = false;
        this.showToast('🗑️ 已清除研究包');
        await this.loadIdeaDetail(id);
        await this.loadIdeas();
      }
    } catch (err) {
      this.showToast(`清除研究包失敗: ${err.message}`);
    }
  }

  async saveInterviewOnly(id, answers) {
    try {
      const res = await api(`/api/interview/${id}`, { method: 'POST', body: { answers } });
      if (res.success) {
        this.showToast('✓ 筆記已儲存！');
        await this.loadIdeaDetail(id);
        await this.loadIdeas();
      }
    } catch (err) {
      this.showToast(`儲存筆記失敗: ${err.message}`);
    }
  }

  async saveInterviewAndGenerateMaster(id, answers) {
    try {
      // 1. Save interview answers first
      await api(`/api/interview/${id}`, { method: 'POST', body: { answers } });

      // 2. Start polled Master Article & CLEAR Review
      this.startProgressPolling(id, 'Master Writer & CLEAR 審查');
      const res = await api(`/api/master/${id}`, { method: 'POST' });

      if (res.success) {
        this.showToast('✓ 母文章與 CLEAR 審查完成！');
        await this.loadIdeaDetail(id);
        await this.loadIdeas();
      }
    } catch (err) {
      this.showToast(`母文章生成失敗: ${err.message}`);
    } finally {
      this.stopProgressPolling();
      this.render();
    }
  }

  async approveMaster(id, isApproved) {
    try {
      const res = await api(`/api/master/${id}/approve`, {
        method: 'POST',
        body: { is_approved: isApproved }
      });
      if (res.success) {
        let msg = isApproved ? '✓ 母文章已核准 (APPROVED)！已解鎖播客與社群倍增' : '已取消核准狀態';
        if (res.voice_captured) {
          msg += '（已將你的修訂存入專屬語氣範本庫！）';
          await this.loadLearningData();
        }
        this.showToast(msg);
        await this.loadIdeaDetail(id);
        await this.loadIdeas();
      }
    } catch (err) {
      this.showToast(`操作失敗: ${err.message}`);
    }
  }

  async saveMasterEdit(id, content, versionNote) {
    try {
      this.state.isProcessing = true;
      this.render();
      const res = await api(`/api/master/${id}`, {
        method: 'PUT',
        body: { master_article: content, note: versionNote }
      });
      if (res.success) {
        this.state.ui.editingMaster = false;
        this.showToast(res.data?.unchanged ? '內容沒有變更' : '✓ 母文章已更新並儲存！建議按「重新審查」');
        await this.loadIdeaDetail(id);
        await this.loadIdeas();
      }
    } catch (err) {
      this.showToast(`儲存失敗: ${err.message}`);
    } finally {
      this.state.isProcessing = false;
      this.render();
    }
  }

  async deleteMasterArticle(id) {
    try {
      const res = await api(`/api/master/${id}`, { method: 'DELETE' });
      if (res.success) {
        this.state.ui.editingMaster = false;
        this.showToast('🗑️ 已清除母文章');
        await this.loadIdeaDetail(id);
        await this.loadIdeas();
      }
    } catch (err) {
      this.showToast(`刪除失敗: ${err.message}`);
    }
  }

  async deleteMasterVersion(ideaId, versionId) {
    try {
      const res = await api(`/api/master/${ideaId}/versions/${versionId}`, { method: 'DELETE' });
      if (res.success) {
        this.showToast('🗑️ 已刪除此版本紀錄');
        await this.loadIdeaDetail(ideaId);
      }
    } catch (err) {
      this.showToast(`刪除版本失敗: ${err.message}`);
    }
  }

  async rerunClear(id) {
    try {
      this.startProgressPolling(id, 'CLEAR 門禁審查');
      const res = await api(`/api/master/${id}/review`, { method: 'POST' });
      if (res.success) {
        this.showToast('✓ CLEAR 審查完成！');
        await this.loadIdeaDetail(id);
      }
    } catch (err) {
      this.showToast(`審查失敗: ${err.message}`);
    } finally {
      this.stopProgressPolling();
      this.render();
    }
  }

  async loadVersions(id) {
    try {
      const res = await api(`/api/master/${id}/versions`);
      return res.success ? res.data : [];
    } catch (err) {
      this.showToast(`無法讀取版本紀錄: ${err.message}`);
      return [];
    }
  }

  async addTrustedSource(citation, note) {
    try {
      const res = await api('/api/trusted-sources', {
        method: 'POST',
        body: { citation, note }
      });
      if (res.success) {
        this.showToast('✓ 已加入信任文獻清單');
        const trustedRes = await api('/api/trusted-sources');
        if (trustedRes.success) this.state.trustedSources = trustedRes.data;
        this.render();
        return true;
      }
    } catch (err) {
      this.showToast(`加入失敗: ${err.message}`);
      return false;
    }
  }

  async updateTrustedSource(id, citation, note) {
    try {
      const res = await api(`/api/trusted-sources/${id}`, {
        method: 'PUT',
        body: { citation, note }
      });
      if (res.success) {
        this.showToast('✓ 已更新信任文獻');
        const trustedRes = await api('/api/trusted-sources');
        if (trustedRes.success) this.state.trustedSources = trustedRes.data;
        this.render();
      }
    } catch (err) {
      this.showToast(`修改失敗: ${err.message}`);
    }
  }

  async deleteTrustedSource(id) {
    try {
      const res = await api(`/api/trusted-sources/${id}`, { method: 'DELETE' });
      if (res.success) {
        this.showToast('已從信任清單移除');
        const trustedRes = await api('/api/trusted-sources');
        if (trustedRes.success) this.state.trustedSources = trustedRes.data;
        this.render();
        return true;
      }
    } catch (err) {
      this.showToast(`移除失敗: ${err.message}`);
      return false;
    }
  }

  async generatePodcast(id) {
    try {
      this.startProgressPolling(id, 'Podcast Producer 製作播客');
      const res = await api(`/api/podcast/${id}`, { method: 'POST' });
      if (res.success) {
        this.showToast('✓ 播客工具包已生成！');
        await this.loadIdeaDetail(id);
      }
    } catch (err) {
      this.showToast(`播客生成失敗: ${err.message}`);
    } finally {
      this.stopProgressPolling();
      this.render();
    }
  }

  async savePodcastEdit(id, payload) {
    try {
      const res = await api(`/api/podcast/${id}`, { method: 'PUT', body: payload });
      if (res.success) {
        this.state.ui.editingPodcast = false;
        this.showToast('✓ 已儲存播客修改');
        await this.loadIdeaDetail(id);
      }
    } catch (err) {
      this.showToast(`儲存播客失敗: ${err.message}`);
    }
  }

  async deletePodcast(id) {
    try {
      const res = await api(`/api/podcast/${id}`, { method: 'DELETE' });
      if (res.success) {
        this.state.ui.editingPodcast = false;
        this.showToast('🗑️ 已刪除播客內容');
        await this.loadIdeaDetail(id);
      }
    } catch (err) {
      this.showToast(`刪除播客失敗: ${err.message}`);
    }
  }

  async generateMultiplier(id) {
    try {
      this.startProgressPolling(id, 'Social Multiplier 社群調適');
      const res = await api(`/api/multiplier/${id}`, { method: 'POST' });
      if (res.success) {
        this.showToast('✓ IG、FB、Threads、Blog 矩陣全數生成完畢！');
        await this.loadIdeaDetail(id);
        await this.loadIdeas();
      }
    } catch (err) {
      this.showToast(`倍增失敗: ${err.message}`);
    } finally {
      this.stopProgressPolling();
      this.render();
    }
  }

  async saveSocialPlatform(id, platform, contentPayload, keepEditing = false) {
    try {
      const res = await api(`/api/multiplier/${id}/${platform}`, {
        method: 'PUT',
        body: { content_payload: contentPayload }
      });
      if (res.success) {
        this.state.ui.editingSocial = keepEditing;
        this.showToast('✓ 已儲存社群內容修改');
        await this.loadIdeaDetail(id);
      }
    } catch (err) {
      this.showToast(`儲存社群內容失敗: ${err.message}`);
    }
  }

  async deleteSocialPlatform(id, platform) {
    try {
      const res = await api(`/api/multiplier/${id}/${platform}`, { method: 'DELETE' });
      if (res.success) {
        this.state.ui.editingSocial = false;
        this.showToast('🗑️ 已刪除平台內容');
        await this.loadIdeaDetail(id);
      }
    } catch (err) {
      this.showToast(`刪除失敗: ${err.message}`);
    }
  }

  // --- One-Click Studio Pipeline ---
  async runOneClickStudio(id) {
    if (!confirm('將為此靈感一鍵跑完「佐證研究 ➔ 母文章初稿 ➔ CLEAR 審查」！\n生成完畢後你可以隨時精雕修改。確定開始？')) return;
    try {
      // 1. Research
      this.startProgressPolling(id, '全自動工作室：1/2 佐證查證');
      await api(`/api/research/${id}`, { method: 'POST' });

      // 2. Master Draft (default empty interview for draft generation)
      this.startProgressPolling(id, '全自動工作室：2/2 母文起草與審查');
      await api(`/api/master/${id}`, { method: 'POST' });

      this.showToast('🎉 初稿已就緒！請切換至「洞見與母文」進行精雕與補充個人經驗');
      await this.loadIdeaDetail(id);
      await this.loadIdeas();
      this.switchTab('interview');
    } catch (err) {
      this.showToast(`全自動生成失敗: ${err.message}`);
    } finally {
      this.stopProgressPolling();
      this.render();
    }
  }

  // --- One-Click Export to Markdown & Archive Space ---
  async exportIdeaPackage(id, options = {}) {
    try {
      this.showToast('正在打包並建立 .md 存檔紀錄...');
      const res = await api(`/api/export/${id}`, {
        method: 'POST',
        body: options
      });
      if (res.success) {
        const { file_name, saved_path, markdown } = res.data;

        // Trigger browser automatic download of the unified Markdown file
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        let msg = `✓ 已存檔並下載 ${file_name}`;
        if (saved_path) {
          msg += `（已寫入：${saved_path}）`;
        }
        this.showToast(msg);
        await this.loadIdeaDetail(id);
        await this.loadLearningData();
      }
    } catch (err) {
      this.showToast(`匯出失敗: ${err.message}`);
    }
  }

  async updateExportArchive(exportId, payload) {
    try {
      const res = await api(`/api/exports/${exportId}`, { method: 'PUT', body: payload });
      if (res.success) {
        this.state.ui.editingExportId = null;
        this.showToast('✓ 已更新 .md 存檔紀錄');
        if (this.state.selectedIdeaId) await this.loadIdeaDetail(this.state.selectedIdeaId);
        await this.loadLearningData();
        this.render();
      }
    } catch (err) {
      this.showToast(`修改存檔失敗: ${err.message}`);
    }
  }

  async deleteExportArchive(exportId) {
    try {
      const res = await api(`/api/exports/${exportId}`, { method: 'DELETE' });
      if (res.success) {
        this.showToast('🗑️ 已刪除此筆 .md 存檔紀錄');
        if (this.state.selectedIdeaId) await this.loadIdeaDetail(this.state.selectedIdeaId);
        await this.loadLearningData();
        this.render();
      }
    } catch (err) {
      this.showToast(`刪除存檔失敗: ${err.message}`);
    }
  }

  // --- Learning Library & Performance Management ---
  async addLibraryRule(category, title, content) {
    try {
      const res = await api('/api/library', {
        method: 'POST',
        body: { category, title, content }
      });
      if (res.success) {
        this.showToast('✓ 已新增學習規則');
        await this.loadLearningData();
        this.render();
      }
    } catch (err) {
      this.showToast(`新增失敗: ${err.message}`);
    }
  }

  async updateLibraryItem(id, payload) {
    try {
      const res = await api(`/api/library/${id}`, {
        method: 'PUT',
        body: payload
      });
      if (res.success) {
        this.showToast('✓ 已更新學習庫規則');
        await this.loadLearningData();
        this.render();
      }
    } catch (err) {
      this.showToast(`更新失敗: ${err.message}`);
    }
  }

  async toggleLibraryItem(id, isActive) {
    try {
      const res = await api(`/api/library/${id}`, {
        method: 'PUT',
        body: { is_active: isActive }
      });
      if (res.success) {
        this.showToast(isActive ? '已啟用規則' : '已停用規則');
        await this.loadLearningData();
        this.render();
      }
    } catch (err) {
      this.showToast(`更新失敗: ${err.message}`);
    }
  }

  async deleteLibraryItem(id) {
    try {
      const res = await api(`/api/library/${id}`, { method: 'DELETE' });
      if (res.success) {
        this.showToast('已刪除項目');
        await this.loadLearningData();
        this.render();
      }
    } catch (err) {
      this.showToast(`刪除失敗: ${err.message}`);
    }
  }

  async logPerformance(ideaId, payload) {
    try {
      const res = await api(`/api/performance/${ideaId}`, {
        method: 'POST',
        body: payload
      });
      if (res.success) {
        this.showToast('✓ 已記錄發布成效數據！');
        await this.loadLearningData();
        await this.loadIdeaDetail(ideaId);
        this.render();
      }
    } catch (err) {
      this.showToast(`記錄失敗: ${err.message}`);
    }
  }

  async updatePerformanceLog(logId, payload) {
    try {
      const res = await api(`/api/performance/log/${logId}`, {
        method: 'PUT',
        body: payload
      });
      if (res.success) {
        this.showToast('✓ 已更新成效數據');
        await this.loadLearningData();
        if (this.state.selectedIdeaId) await this.loadIdeaDetail(this.state.selectedIdeaId);
        this.render();
      }
    } catch (err) {
      this.showToast(`修改失敗: ${err.message}`);
    }
  }

  async deletePerformanceLog(logId) {
    try {
      const res = await api(`/api/performance/log/${logId}`, { method: 'DELETE' });
      if (res.success) {
        this.showToast('🗑️ 已刪除成效紀錄');
        await this.loadLearningData();
        if (this.state.selectedIdeaId) await this.loadIdeaDetail(this.state.selectedIdeaId);
        this.render();
      }
    } catch (err) {
      this.showToast(`刪除失敗: ${err.message}`);
    }
  }

  async extractPerformanceLessons() {
    try {
      this.showToast('AI 正在深度複盤成效數據並萃取寫作法則...');
      const res = await api('/api/library/extract-lessons', { method: 'POST' });
      if (res.success) {
        const count = res.data.added;
        this.showToast(`🎉 成功萃取 ${count} 條專屬寫作法則！`);
        await this.loadLearningData();
        this.render();
      }
    } catch (err) {
      this.showToast(`萃取失敗: ${err.message}`);
    }
  }

  async saveSettings(payload) {
    try {
      const res = await api('/api/settings', {
        method: 'POST',
        body: payload
      });
      if (res.success) {
        this.showToast('設定已成功儲存！');
        await this.loadInitialData();
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
    }, 3600);
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

(() => {
  'use strict';
  const STORAGE_KEY = 'taptalk_mobile_cards';
  const LEGACY_STORAGE_KEY = 'taptalk_pixel_v1';
  const categories = [
    { id: 'work', name: '作業・指示', cards: [['✅', '確認をお願いします。'], ['⏱️', 'あと何分作業したほうがいいですか？'], ['🧹', '掃除場所はどこですか？'], ['🪑', '椅子に座って作業していいですか？'], ['❓', 'わからないことがあるので来ていただけますか？'], ['🔄', 'もう一度説明をお願いできますか？'], ['📄', '次のスケジュールは何ですか？']] },
    { id: 'morning', name: '朝礼・挨拶', cards: [['🌅', 'みなさんおはようございます！'], ['🤝', 'よろしくお願いいたします。'], ['🙋‍♂️', 'はい、出席しています。'], ['🚪', 'お先に失礼します。お疲れ様でした！'], ['👋', '御用は何でしょうか？']] },
    { id: 'health', name: '体調・移動', cards: [['🚻', 'トイレに行っていいですか？'], ['☕', '5分休憩してもいいですか？'], ['🤒', '少し体調がすぐれません。'], ['🙆‍♂️', '大丈夫です！問題ありません。']] },
    { id: 'chat', name: '雑談・返答', cards: [['😊', 'ありがとうございます！'], ['👉', '今、お時間いいですか？'], ['👏', 'そうなんですね！'], ['🎮', '趣味やお話しをしませんか？'], ['🍱', '一緒にお昼どうですか？']] },
    { id: 'leave', name: '📅 お休み・遅刻', cards: [] }
  ];
  const state = { cards: [], categoryId: 'work', managing: false, editingId: null, listening: false, recognition: null, recognitionRunning: false, recognitionStarting: false, shouldListen: false, recognitionRestartTimer: null, cardTapLocked: false, audioContext: null, storageAvailable: true };
  const $ = (id) => document.getElementById(id);
  const defaultCards = () => categories.flatMap((category) => category.cards.map(([emoji, text], index) => ({ id: `${category.id}-${index + 1}`, category: category.id, emoji, text, isCustom: false, createdAt: null })));

  function normalizeCard(card) {
    if (!card || typeof card.text !== 'string') return null;
    return { id: String(card.id || `card_${Date.now()}_${Math.random().toString(36).slice(2)}`), category: categories.some((c) => c.id === card.category) ? card.category : 'work', emoji: String(card.emoji || card.icon || '💬').slice(0, 16), text: card.text.trim().slice(0, 200), isCustom: Boolean(card.isCustom), createdAt: card.createdAt || new Date().toISOString() };
  }
  function migrateLegacy(value) {
    if (!Array.isArray(value)) return [];
    if (value.length && Array.isArray(value[0]?.cards)) return value.flatMap((category) => (category.cards || []).map((card) => normalizeCard({ ...card, category: category.id, isCustom: !/^[wmhc]\d+$/.test(card.id || '') })));
    return value.map(normalizeCard).filter(Boolean);
  }
  const Storage = {
    load() {
      try {
        const current = localStorage.getItem(STORAGE_KEY);
        const legacy = current ? null : localStorage.getItem(LEGACY_STORAGE_KEY);
        const saved = current || legacy;
        if (!saved) return defaultCards();
        const parsed = JSON.parse(saved);
        const cards = migrateLegacy(Array.isArray(parsed) ? parsed : parsed.cards).filter(Boolean);
        return cards.length ? cards : defaultCards();
      } catch (error) { state.storageAvailable = false; return defaultCards(); }
    },
    save() {
      if (!state.storageAvailable) return;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cards)); }
      catch (error) { state.storageAvailable = false; showToast('端末に保存できないため、この画面の間だけ保持します'); }
    }
  };
  function showToast(message) { const toast = $('toastMsg'); toast.textContent = message; toast.classList.add('show'); window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2400); }
  function updateDisplay(text) { $('speechPlaceholder').hidden = true; const display = $('speechText'); display.hidden = false; display.textContent = text; }
  function feedback() { if (navigator.vibrate) navigator.vibrate(50); playChime(); }
  function playChime() {
    try { const AudioContext = window.AudioContext || window.webkitAudioContext; if (!AudioContext) return; state.audioContext ||= new AudioContext(); if (state.audioContext.state === 'suspended') state.audioContext.resume(); const now = state.audioContext.currentTime; const oscillator = state.audioContext.createOscillator(); const gain = state.audioContext.createGain(); oscillator.frequency.setValueAtTime(587.33, now); oscillator.frequency.exponentialRampToValueAtTime(880, now + .1); gain.gain.setValueAtTime(.08, now); gain.gain.exponentialRampToValueAtTime(.0001, now + .12); oscillator.connect(gain).connect(state.audioContext.destination); oscillator.start(now); oscillator.stop(now + .12); } catch (error) { /* audio is optional */ }
  }
  function stopSpeaking() { if (window.speechSynthesis) window.speechSynthesis.cancel(); }
  function speak(text) { updateDisplay(text); speakText(text); }
  function speakText(text) { if (!window.speechSynthesis || !text.trim()) return; stopSpeaking(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'ja-JP'; utterance.rate = 1; utterance.pitch = 1; window.speechSynthesis.speak(utterance); }
  function speakCustomInput() { const input = $('customTextInput'); const text = input.value.trim(); if (!text) return; feedback(); speakText(text); input.value = ''; }
  function currentCards() { return state.cards.filter((card) => card.category === state.categoryId); }
  function render() { renderTabs(); renderCards(); $('calendarSection').hidden = state.categoryId !== 'leave'; }
  function renderTabs() {
    const tabs = $('categoryTabs'); tabs.replaceChildren();
    categories.forEach((category) => { const button = document.createElement('button'); button.type = 'button'; button.className = `tab-btn${category.id === state.categoryId ? ' active' : ''}`; button.textContent = category.name; button.setAttribute('aria-selected', String(category.id === state.categoryId)); button.addEventListener('click', () => { feedback(); state.categoryId = category.id; render(); }); tabs.append(button); });
  }
  function renderCards() {
    const grid = $('cardsGrid'); grid.replaceChildren(); const cards = currentCards();
    if (!cards.length) { const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = state.categoryId === 'leave' ? 'まだ連絡カードがありません。上の種別を選んで作成できます。' : 'カードがありません。'; grid.append(empty); return; }
    cards.forEach((card) => {
      const element = document.createElement('article'); element.className = `card${state.managing ? ' is-manageable' : ''}`; element.setAttribute('role', 'button'); element.tabIndex = 0; element.setAttribute('aria-label', `${card.text}を発話`); const icon = document.createElement('span'); icon.className = 'card-icon'; icon.textContent = card.emoji; const text = document.createElement('span'); text.className = 'card-text'; text.textContent = card.text; element.append(icon, text); const activate = () => { if (state.managing || state.cardTapLocked) return; state.cardTapLocked = true; window.setTimeout(() => { state.cardTapLocked = false; }, 450); feedback(); speak(card.text); }; element.addEventListener('click', activate); element.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } });
      const actions = document.createElement('span'); actions.className = 'card-edit-actions'; const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'edit-card-btn'; edit.textContent = '✎'; edit.setAttribute('aria-label', 'カードを編集'); edit.addEventListener('click', (event) => { event.stopPropagation(); feedback(); openModal(card); }); const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete-card-btn'; remove.textContent = '×'; remove.setAttribute('aria-label', 'カードを削除'); remove.addEventListener('click', (event) => { event.stopPropagation(); feedback(); deleteCard(card.id); }); actions.append(edit, remove); element.append(actions); grid.append(element);
    });
  }
  function openModal(card = null) { state.editingId = card?.id || null; $('modalTitle').textContent = card ? 'カードを編集' : '新しいカードを追加'; $('modalCategory').value = card?.category || state.categoryId; $('modalIcon').value = card?.emoji || '💬'; $('modalText').value = card?.text || ''; $('cardModal').hidden = false; $('modalText').focus(); }
  function closeModal() { $('cardModal').hidden = true; state.editingId = null; }
  function saveCard(event) { event.preventDefault(); const text = $('modalText').value.trim(); if (!text) { showToast('話す言葉を入力してください'); return; } const category = $('modalCategory').value; const emoji = $('modalIcon').value.trim() || '💬'; if (state.editingId) { const card = state.cards.find((item) => item.id === state.editingId); if (card) Object.assign(card, { category, emoji, text, isCustom: true }); showToast('カードを更新しました'); } else { state.cards.push({ id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, category, emoji, text, isCustom: true, createdAt: new Date().toISOString() }); showToast('カードを追加しました'); } state.categoryId = category; Storage.save(); closeModal(); render(); }
  function deleteCard(id) { const card = state.cards.find((item) => item.id === id); if (!card) return; if (!window.confirm(`「${card.text}」を削除しますか？`)) return; state.cards = state.cards.filter((item) => item.id !== id); Storage.save(); renderCards(); showToast('カードを削除しました'); }
  function setQuickDate(days) { feedback(); const date = new Date(); date.setDate(date.getDate() + days); $('leaveDateInput').value = localDateValue(date); }
  function localDateValue(date) { const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 10); }
  function formatDate(value) { const [year, month, day] = value.split('-').map(Number); const date = new Date(year, month - 1, day); return `${month}月${day}日（${['日', '月', '火', '水', '木', '金', '土'][date.getDay()]}）`; }
  function formatTime(value) { if (!value) return ''; const [hours, minutes] = value.split(':').map(Number); return minutes ? `${hours}時${minutes}分` : `${hours}時`; }
  function createLeaveCard(type) { feedback(); const date = $('leaveDateInput').value; const time = formatTime($('leaveTimeInput').value); if (!date) { showToast('日付を選んでください'); return; } const dateText = formatDate(date); const templates = { full: ['📅', `${dateText} は終日お休みします。`], late: ['⏱️', `${dateText}${time ? ` ${time}頃に到着予定です（遅刻）。` : ' は遅刻します。'}`], early: ['🏃', `${dateText}${time ? ` ${time}頃に早退します。` : ' は早退します。'}`], am: ['🌅', `${dateText} は午前中お休みします。`], pm: ['🌇', `${dateText} は午後からお休みします。`], hospital: ['🏥', `${dateText}${time ? ` ${time}頃、通院のため遅れます。` : ' は通院のため遅れます。'}`] }; const [emoji, text] = templates[type]; state.cards.push({ id: `leave_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, category: 'leave', emoji, text, isCustom: true, createdAt: new Date().toISOString() }); Storage.save(); renderCards(); speak(text); }
  function setListening(active) { state.listening = active; $('micBtn').classList.toggle('listening', active); $('micBtn').textContent = active ? '🛑 聞き取り中…' : '🎤 音声入力'; $('micBtn').setAttribute('aria-pressed', String(active)); }
  function syncRecognitionText(text) { updateDisplay(text); }
  function clearRecognitionRestart() { window.clearTimeout(state.recognitionRestartTimer); state.recognitionRestartTimer = null; }
  function startRecognition() { if (!state.recognition || state.recognitionRunning || state.recognitionStarting || !state.shouldListen) return; try { state.recognitionStarting = true; state.recognition.start(); } catch (error) { state.recognitionStarting = false; if (error.name !== 'InvalidStateError') { state.shouldListen = false; setListening(false); showToast('音声入力を開始できませんでした'); } } }
  function scheduleRecognitionRestart() { clearRecognitionRestart(); if (!state.shouldListen) return; state.recognitionRestartTimer = window.setTimeout(startRecognition, 250); }
  function stopRecognition() { state.shouldListen = false; clearRecognitionRestart(); if (state.recognitionRunning || state.recognitionStarting) { try { state.recognition.stop(); } catch (error) { /* recognition has already ended */ } } setListening(false); }
  function initRecognition() { const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition; if (!Recognition) { $('micBtn').disabled = true; $('micBtn').textContent = '🎤 音声入力（非対応）'; return; } const recognition = state.recognition = new Recognition(); recognition.lang = 'ja-JP'; recognition.continuous = true; recognition.interimResults = true; recognition.onstart = () => { state.recognitionStarting = false; state.recognitionRunning = true; setListening(true); }; recognition.onresult = (event) => { let finalText = ''; let interimText = ''; for (let i = 0; i < event.results.length; i += 1) { const result = event.results[i]; if (result.isFinal) finalText += result[0].transcript; else interimText += result[0].transcript; } syncRecognitionText(`${finalText}${interimText}`.trim()); }; recognition.onend = () => { state.recognitionStarting = false; state.recognitionRunning = false; if (state.shouldListen) scheduleRecognitionRestart(); else setListening(false); }; recognition.onerror = (event) => { if (event.error === 'aborted') return; if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(event.error)) { state.shouldListen = false; setListening(false); showToast('マイクを利用できません。ブラウザの権限を確認してください'); return; } if (event.error !== 'no-speech') showToast('音声入力が一時停止しました。再開します'); }; }
  function toggleRecognition() { feedback(); if (!state.recognition) { showToast('お使いのブラウザは音声入力に対応していません'); return; } if (state.shouldListen) { stopRecognition(); return; } state.shouldListen = true; startRecognition(); }
  function toggleManage() { feedback(); state.managing = !state.managing; document.body.classList.toggle('manage-mode', state.managing); $('manageBtn').classList.toggle('is-active', state.managing); $('manageBtn').setAttribute('aria-pressed', String(state.managing)); $('manageBtn').textContent = state.managing ? '✅ 完了' : '⚙️ 編集'; renderCards(); }
  function init() { state.cards = Storage.load(); $('leaveDateInput').value = localDateValue(new Date()); const select = $('modalCategory'); categories.forEach((category) => { const option = document.createElement('option'); option.value = category.id; option.textContent = category.name; select.append(option); }); $('micBtn').addEventListener('click', toggleRecognition); $('stopSpeechBtn').addEventListener('click', () => { feedback(); stopSpeaking(); }); $('customSpeakBtn').addEventListener('click', speakCustomInput); $('customTextInput').addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); speakCustomInput(); } }); $('addBtn').addEventListener('click', () => { feedback(); openModal(); }); $('manageBtn').addEventListener('click', toggleManage); $('cancelModalBtn').addEventListener('click', closeModal); $('cardForm').addEventListener('submit', saveCard); $('cardModal').addEventListener('click', (event) => { if (event.target === $('cardModal')) closeModal(); }); document.querySelectorAll('[data-quick-date]').forEach((button) => button.addEventListener('click', () => setQuickDate(Number(button.dataset.quickDate)))); document.querySelectorAll('[data-leave-type]').forEach((button) => button.addEventListener('click', () => createLeaveCard(button.dataset.leaveType))); initRecognition(); render(); }
  document.addEventListener('DOMContentLoaded', init);
})();

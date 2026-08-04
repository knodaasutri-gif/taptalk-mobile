const defaultCategories = [
    {
        id: "work",
        name: "作業・指示",
        cards: [
            { id: "w1", icon: "✅", text: "確認をお願いします。" },
            { id: "w2", icon: "⏱️", text: "あと何分作業したほうがいいですか？" },
            { id: "w3", icon: "🧹", text: "掃除場所はどこですか？" },
            { id: "w4", icon: "🪑", text: "椅子に座って作業していいですか？" },
            { id: "w5", icon: "❓", text: "わからないことがあるので来ていただけますか？" },
            { id: "w6", icon: "🔄", text: "もう一度説明をお願いできますか？" },
            { id: "w7", icon: "📄", text: "次のスケジュールは何ですか？" }
        ]
    },
    {
        id: "morning",
        name: "朝礼・挨拶",
        cards: [
            { id: "m1", icon: "🌅", text: "みなさんおはようございます！" },
            { id: "m2", icon: "🤝", text: "よろしくお願いいたします。" },
            { id: "m3", icon: "🙋‍♂️", text: "はい、出席しています。" },
            { id: "m4", icon: "🚪", text: "お先に失礼します。お疲れ様でした！" },
            { id: "m5", icon: "👋", text: "御用は何でしょうか？" }
        ]
    },
    {
        id: "health",
        name: "体調・移動",
        cards: [
            { id: "h1", icon: "🚻", text: "トイレに行っていいですか？" },
            { id: "h2", icon: "☕", text: "5分休憩してもいいですか？" },
            { id: "h3", icon: "🤒", text: "少し体調がすぐれません。" },
            { id: "h4", icon: "🙆‍♂️", text: "大丈夫です！問題ありません。" }
        ]
    },
    {
        id: "chat",
        name: "雑談・返答",
        cards: [
            { id: "c1", icon: "😊", text: "ありがとうございます！" },
            { id: "c2", icon: "👉", text: "今、お時間いいですか？" },
            { id: "c3", icon: "👏", text: "そうなんですね！" },
            { id: "c4", icon: "🎮", text: "趣味やお話しをしませんか？" },
            { id: "c5", icon: "🍱", text: "一緒にお昼どうですか？" }
        ]
    },
    {
        id: "leave",
        name: "📅 お休み・遅刻",
        cards: []
    }
];

let appData = [];
let currentCategoryId = "work";
let isManageMode = false;
let isListening = false;
let recognition = null;

const synth = window.speechSynthesis;
let audioCtx = null;

function triggerHaptic() {
    if (navigator.vibrate) navigator.vibrate(30);
}

function playTapChime() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0.0001, now + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.11);
    } catch (e) { }
}

function showToast(msg) {
    const toast = document.getElementById("toastMsg");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2000);
}

function initApp() {
    loadData();
    const leaveDateInput = document.getElementById("leaveDateInput");
    if (leaveDateInput) {
        const today = new Date().toISOString().split('T')[0];
        leaveDateInput.value = today;
    }
    renderCategoryTabs();
    renderCards();
    populateModalCategories();
    initSpeechRecognition();
}

function loadData() {
    const savedData = localStorage.getItem("taptalk_pixel_v1");
    if (savedData) {
        try { appData = JSON.parse(savedData); } catch (e) { appData = defaultCategories; }
    } else {
        appData = defaultCategories;
    }
}

function saveData() {
    localStorage.setItem("taptalk_pixel_v1", JSON.stringify(appData));
}

function renderCategoryTabs() {
    const tabsContainer = document.getElementById("categoryTabs");
    if (!tabsContainer) return;
    tabsContainer.innerHTML = "";

    appData.forEach(cat => {
        const btn = document.createElement("button");
        btn.className = `tab-btn ${cat.id === currentCategoryId ? 'active' : ''}`;
        btn.textContent = cat.name;
        btn.onclick = () => {
            triggerHaptic();
            currentCategoryId = cat.id;
            renderCategoryTabs();
            renderCards();
        };
        tabsContainer.appendChild(btn);
    });
}

function renderCards() {
    const grid = document.getElementById("cardsGrid");
    const calSection = document.getElementById("calendarSection");
    if (!grid) return;
    grid.innerHTML = "";

    if (calSection) {
        calSection.style.display = (currentCategoryId === "leave") ? "block" : "none";
    }

    const currentCat = appData.find(c => c.id === currentCategoryId);
    if (!currentCat || currentCat.cards.length === 0) {
        if (currentCategoryId !== "leave") {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 30px 0;">カードがありません</div>`;
        }
        return;
    }

    currentCat.cards.forEach(card => {
        const cardEl = document.createElement("div");
        cardEl.className = "card";
        cardEl.innerHTML = `
            <button class="delete-card-btn" onclick="deleteCard(event, '${card.id}')">✕</button>
            <div class="card-icon">${card.icon}</div>
            <div class="card-text">${card.text}</div>
        `;
        cardEl.onclick = () => {
            if (isManageMode) return;
            triggerHaptic();
            speakText(card.text);
        };
        grid.appendChild(cardEl);
    });
}

function speakText(text) {
    const placeholder = document.getElementById("speechPlaceholder");
    const speechText = document.getElementById("speechText");
    if (placeholder) placeholder.style.display = "none";
    if (speechText) {
        speechText.style.display = "block";
        speechText.textContent = text;
    }

    playTapChime();

    if (synth) {
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "ja-JP";
        synth.speak(utterance);
    }
}

/* 音声文字起こし (SpeechRecognition) */
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        const micBtn = document.getElementById("micBtn");
        if (micBtn) micBtn.style.display = "none";
        return;
    }
    recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        const placeholder = document.getElementById("speechPlaceholder");
        const speechText = document.getElementById("speechText");
        if (placeholder) placeholder.style.display = "none";
        if (speechText) {
            speechText.style.display = "block";
            speechText.textContent = transcript;
        }
    };

    recognition.onend = () => {
        isListening = false;
        const micBtn = document.getElementById("micBtn");
        if (micBtn) {
            micBtn.classList.remove("listening");
            micBtn.textContent = "🎤 音声入力";
        }
    };
}

function toggleSpeechRecognition() {
    if (!recognition) {
        showToast("お使いのブラウザは音声入力非対応です");
        return;
    }
    triggerHaptic();
    const micBtn = document.getElementById("micBtn");
    if (isListening) {
        recognition.stop();
    } else {
        try {
            recognition.start();
            isListening = true;
            if (micBtn) {
                micBtn.classList.add("listening");
                micBtn.textContent = "🛑 聞き取り中…";
            }
        } catch (e) { }
    }
}

/* 編集・追加・削除機能 */
function toggleManageMode() {
    triggerHaptic();
    isManageMode = !isManageMode;
    document.body.classList.toggle("manage-mode", isManageMode);
    const manageBtn = document.getElementById("manageBtn");
    if (manageBtn) {
        manageBtn.textContent = isManageMode ? "✅ 完了" : "⚙️ 編集";
        manageBtn.style.background = isManageMode ? "#10b981" : "#e2e8f0";
        manageBtn.style.color = isManageMode ? "white" : "var(--text)";
    }
}

function deleteCard(event, cardId) {
    event.stopPropagation();
    triggerHaptic();
    const currentCat = appData.find(c => c.id === currentCategoryId);
    if (currentCat) {
        currentCat.cards = currentCat.cards.filter(c => c.id !== cardId);
        saveData();
        renderCards();
        showToast("カードを削除しました");
    }
}

function openAddModal() {
    triggerHaptic();
    populateModalCategories();
    document.getElementById("addModal").style.display = "flex";
}

function closeAddModal() {
    document.getElementById("addModal").style.display = "none";
}

function populateModalCategories() {
    const select = document.getElementById("modalCategory");
    if (!select) return;
    select.innerHTML = "";
    appData.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat.id;
        opt.textContent = cat.name;
        select.appendChild(opt);
    });
    select.value = currentCategoryId;
}

function saveNewCard() {
    const catId = document.getElementById("modalCategory").value;
    const icon = document.getElementById("modalIcon").value.trim() || "💬";
    const text = document.getElementById("modalText").value.trim();

    if (!text) {
        showToast("言葉を入力してください");
        return;
    }

    const cat = appData.find(c => c.id === catId);
    if (cat) {
        cat.cards.push({
            id: "custom_" + Date.now(),
            icon: icon,
            text: text
        });
        saveData();
        closeAddModal();
        document.getElementById("modalText").value = "";
        currentCategoryId = catId;
        renderCategoryTabs();
        renderCards();
        showToast("カードを追加しました");
    }
}

/* 予定・お休み・時間連絡機能 */
function setQuickDate(addDays) {
    triggerHaptic();
    const d = new Date();
    d.setDate(d.getDate() + addDays);
    const leaveDateInput = document.getElementById("leaveDateInput");
    if (leaveDateInput) {
        leaveDateInput.value = d.toISOString().split('T')[0];
    }
}

function formatTimeText(timeVal) {
    if (!timeVal) return "";
    const parts = timeVal.split(":");
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    return minutes === 0 ? `${hours}時` : `${hours}時${minutes}分`;
}

function generateLeaveCard(typeText, icon, includeTime) {
    triggerHaptic();
    const dateInput = document.getElementById("leaveDateInput");
    const timeInput = document.getElementById("leaveTimeInput");
    if (!dateInput || !dateInput.value) return;

    const dateObj = new Date(dateInput.value);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const dateStr = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日（${days[dateObj.getDay()]}）`;

    let timeStr = "";
    if (includeTime && timeInput && timeInput.value) {
        timeStr = formatTimeText(timeInput.value) + " ";
    }

    const fullText = `${dateStr} ${timeStr}${typeText}`;

    const leaveCat = appData.find(c => c.id === "leave");
    if (leaveCat) {
        leaveCat.cards.push({
            id: "leave_" + Date.now(),
            icon: icon || "📅",
            text: fullText
        });
        saveData();
        renderCards();
    }
    speakText(fullText);
}

window.onload = initApp;

(() => {
  "use strict";

  const SAVE_KEY = "tips-thiessen-clicker-v2";
  const GAME_VERSION = 2;
  const FINAL_GOAL = 1e17;
  const OFFLINE_CAP_SECONDS = 8 * 60 * 60;
  const OFFLINE_RATE = 0.5;

  const PRODUCERS = [
    { name: "Pocket Change", icon: "🪙", desc: "Loose coins from the couch", cost: 25, income: 0.5, unlock: 0 },
    { name: "Lemonade Stand", icon: "🥤", desc: "Refreshingly profitable", cost: 350, income: 6, unlock: 150 },
    { name: "Viral Camera", icon: "📹", desc: "Turn moments into money", cost: 6e3, income: 85, unlock: 2.5e3 },
    { name: "Creator Studio", icon: "🎬", desc: "A tiny content machine", cost: 1.2e5, income: 1.25e3, unlock: 5e4 },
    { name: "Merch Warehouse", icon: "📦", desc: "Ship the hype worldwide", cost: 3e6, income: 2.1e4, unlock: 1.2e6 },
    { name: "Brand Agency", icon: "🏢", desc: "Deals while you sleep", cost: 9e7, income: 3.5e5, unlock: 3.5e7 },
    { name: "Media Network", icon: "📡", desc: "Every screen, all at once", cost: 3.2e9, income: 5.8e6, unlock: 1.2e9 },
    { name: "Streaming City", icon: "🌆", desc: "An entire city of creators", cost: 1.4e11, income: 9.5e7, unlock: 5e10 },
    { name: "Orbital Billboard", icon: "🛰️", desc: "Ads visible from space", cost: 8e12, income: 1.6e9, unlock: 3e12 },
    { name: "Internet Empire", icon: "👑", desc: "The final media machine", cost: 6e14, income: 2.8e10, unlock: 2e14 }
  ];

  const CLICK_UPGRADES = [
    { name: "Double Tap", icon: "👆", desc: "Clicks are twice as valuable", cost: 75, mult: 2, unlock: 0 },
    { name: "Golden Thumb", icon: "👍", desc: "Clicks are twice as valuable", cost: 1.5e3, mult: 2, unlock: 500 },
    { name: "Hype Training", icon: "⚡", desc: "Triple your click power", cost: 3e4, mult: 3, unlock: 1e4 },
    { name: "Meme Reflexes", icon: "🐸", desc: "Triple your click power", cost: 8e5, mult: 3, unlock: 2.5e5 },
    { name: "Trend Surfer", icon: "🏄", desc: "Clicks hit five times harder", cost: 2.5e7, mult: 5, unlock: 8e6 },
    { name: "Crowd Energy", icon: "🔥", desc: "Clicks hit five times harder", cost: 9e8, mult: 5, unlock: 3e8 },
    { name: "Viral Instinct", icon: "🧬", desc: "Clicks hit ten times harder", cost: 4e10, mult: 10, unlock: 1.2e10 },
    { name: "Fame Magnet", icon: "🧲", desc: "Clicks hit ten times harder", cost: 2.2e12, mult: 10, unlock: 7e11 },
    { name: "Global Applause", icon: "👏", desc: "Clicks hit twenty times harder", cost: 1.6e14, mult: 20, unlock: 5e13 },
    { name: "Infinite Charisma", icon: "♾️", desc: "Clicks hit twenty-five times harder", cost: 1.5e16, mult: 25, unlock: 4e15 }
  ];

  const MILESTONES = [
    { at: 1e3, name: "First Thousand" },
    { at: 1e5, name: "Six Figures" },
    { at: 1e7, name: "Millionaire Energy" },
    { at: 1e9, name: "The Billion Club" },
    { at: 1e11, name: "Media Royalty" },
    { at: 1e13, name: "Orbit Achieved" },
    { at: 1e15, name: "Attention Monopoly" },
    { at: FINAL_GOAL, name: "The Internet Crown" }
  ];

  const DEFAULT_STATE = {
    money: 0,
    totalEarned: 0,
    totalClicks: 0,
    activeSeconds: 0,
    level: 1,
    xp: 0,
    producers: PRODUCERS.map(() => 0),
    upgrades: CLICK_UPGRADES.map(() => false),
    milestones: MILESTONES.map(() => false),
    bulk: 1,
    tab: "producers",
    musicVolume: 0.28,
    sfxVolume: 0.55,
    musicMuted: false,
    sfxMuted: false,
    completed: false,
    createdAt: Date.now(),
    lastSave: Date.now()
  };

  let state = loadState();
  let lastFrame = performance.now();
  let uiAccumulator = 0;
  let saveAccumulator = 0;
  let clickSoundIndex = 0;
  let audioStarted = false;

  const $ = (selector) => document.querySelector(selector);
  const dom = {
    money: $("#money"),
    income: $("#income"),
    clickPower: $("#clickPower"),
    level: $("#level"),
    rank: $("#rank"),
    xpText: $("#xpText"),
    xpFill: $("#xpFill"),
    goalText: $("#goalText"),
    goalFill: $("#goalFill"),
    elapsed: $("#elapsed"),
    clicks: $("#clicks"),
    lifetime: $("#lifetime"),
    buildings: $("#buildings"),
    milestones: $("#milestones"),
    shopList: $("#shopList"),
    face: $("#faceButton"),
    settings: $("#settings"),
    settingsPanel: $("#settingsPanel"),
    musicToggle: $("#musicToggle"),
    sfxToggle: $("#sfxToggle"),
    musicVolume: $("#musicVolume"),
    sfxVolume: $("#sfxVolume"),
    musicValue: $("#musicValue"),
    sfxValue: $("#sfxValue"),
    bgMusic: $("#bgMusic"),
    toastStack: $("#toastStack"),
    completeModal: $("#completeModal"),
    finalTime: $("#finalTime")
  };

  const clickSounds = Array.from({ length: 6 }, () => {
    const audio = new Audio("click.mp3");
    audio.preload = "auto";
    return audio;
  });

  function loadState() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return structuredClone(DEFAULT_STATE);
      const saved = JSON.parse(raw);
      const merged = {
        ...structuredClone(DEFAULT_STATE),
        ...saved,
        producers: PRODUCERS.map((_, index) => Math.max(0, Math.floor(saved.producers?.[index] || 0))),
        upgrades: CLICK_UPGRADES.map((_, index) => Boolean(saved.upgrades?.[index])),
        milestones: MILESTONES.map((_, index) => Boolean(saved.milestones?.[index]))
      };
      if (![1, 10, "max"].includes(merged.bulk)) merged.bulk = 1;
      if (!["producers", "upgrades"].includes(merged.tab)) merged.tab = "producers";
      return merged;
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  function saveGame(showMessage = false) {
    state.lastSave = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, version: GAME_VERSION }));
      if (showMessage) toast("Game saved", "Your empire is safe on this device.");
    } catch {
      toast("Save failed", "Your browser blocked local storage.");
    }
  }

  function getMilestoneMultiplier() {
    const claimed = state.milestones.filter(Boolean).length;
    return Math.pow(1.5, claimed);
  }

  function getIncome() {
    const base = PRODUCERS.reduce((sum, item, index) => sum + item.income * state.producers[index], 0);
    return base * getMilestoneMultiplier();
  }

  function getClickPower() {
    const upgradeMult = CLICK_UPGRADES.reduce(
      (value, item, index) => value * (state.upgrades[index] ? item.mult : 1),
      1
    );
    return upgradeMult + getIncome() * 0.015;
  }

  function xpNeeded() {
    return Math.floor(70 * Math.pow(state.level, 1.42));
  }

  function addXp(amount) {
    state.xp += amount;
    let needed = xpNeeded();
    while (state.xp >= needed) {
      state.xp -= needed;
      state.level += 1;
      needed = xpNeeded();
      toast("Level up!", `You reached level ${state.level}.`);
    }
  }

  function addMoney(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    state.money += amount;
    state.totalEarned += amount;
    checkMilestones();
  }

  function checkMilestones() {
    MILESTONES.forEach((milestone, index) => {
      if (!state.milestones[index] && state.totalEarned >= milestone.at) {
        state.milestones[index] = true;
        toast(milestone.name, index === MILESTONES.length - 1 ? "You conquered the internet!" : "All income permanently boosted by 50%.");
      }
    });

    if (!state.completed && state.totalEarned >= FINAL_GOAL) {
      state.completed = true;
      dom.finalTime.textContent = formatTime(state.activeSeconds);
      dom.completeModal.hidden = false;
      saveGame();
    }
  }

  function producerCost(index, amount) {
    const owned = state.producers[index];
    const base = PRODUCERS[index].cost;
    if (amount === "max") amount = maxAffordable(index);
    if (amount <= 0) return 0;
    return base * Math.pow(1.15, owned) * ((Math.pow(1.15, amount) - 1) / 0.15);
  }

  function maxAffordable(index) {
    const owned = state.producers[index];
    const firstCost = PRODUCERS[index].cost * Math.pow(1.15, owned);
    if (state.money < firstCost) return 0;
    return Math.max(0, Math.floor(Math.log(1 + (state.money * 0.15) / firstCost) / Math.log(1.15)));
  }

  function buyProducer(index) {
    if (state.totalEarned < PRODUCERS[index].unlock) return;
    const amount = state.bulk === "max" ? maxAffordable(index) : state.bulk;
    const cost = producerCost(index, amount);
    if (!amount || state.money + cost * 1e-10 < cost) return;
    state.money -= cost;
    state.producers[index] += amount;
    addXp(Math.max(3, Math.floor(Math.log10(cost + 1) * amount)));
    renderShop();
    updateUI();
  }

  function buyUpgrade(index) {
    const upgrade = CLICK_UPGRADES[index];
    if (state.upgrades[index] || state.totalEarned < upgrade.unlock || state.money < upgrade.cost) return;
    state.money -= upgrade.cost;
    state.upgrades[index] = true;
    addXp(Math.max(10, Math.floor(Math.log10(upgrade.cost + 1) * 4)));
    toast(upgrade.name, `Click power multiplied by ${upgrade.mult}.`);
    renderShop();
    updateUI();
  }

  function handleClick(event) {
    startAudio();
    const power = getClickPower();
    addMoney(power);
    state.totalClicks += 1;
    addXp(1);
    playClickSound();

    const rect = dom.face.getBoundingClientRect();
    const clientX = event.clientX || rect.left + rect.width / 2;
    const clientY = event.clientY || rect.top + rect.height / 2;
    createClickPop(clientX, clientY, power);
    dom.face.classList.remove("pressed");
    void dom.face.offsetWidth;
    dom.face.classList.add("pressed");
    setTimeout(() => dom.face.classList.remove("pressed"), 110);
    updateUI();
  }

  function createClickPop(x, y, amount) {
    const pop = document.createElement("span");
    pop.className = "click-pop";
    pop.textContent = `+$${formatNumber(amount)}`;
    pop.style.left = `${x}px`;
    pop.style.top = `${y}px`;
    document.body.appendChild(pop);
    setTimeout(() => pop.remove(), 900);
  }

  function startAudio() {
    if (audioStarted) return;
    audioStarted = true;
    applyAudioSettings();
    if (!state.musicMuted) dom.bgMusic.play().catch(() => {});
  }

  function playClickSound() {
    if (state.sfxMuted || state.sfxVolume <= 0) return;
    const sound = clickSounds[clickSoundIndex];
    clickSoundIndex = (clickSoundIndex + 1) % clickSounds.length;
    sound.pause();
    sound.currentTime = 0;
    sound.volume = state.sfxVolume;
    sound.playbackRate = 1.7;
    sound.play().catch(() => {});
  }

  function applyAudioSettings() {
    dom.bgMusic.volume = state.musicMuted ? 0 : state.musicVolume;
    dom.musicToggle.textContent = state.musicMuted ? "🔇" : "♫";
    dom.musicToggle.setAttribute("aria-label", state.musicMuted ? "Unmute music" : "Mute music");
    dom.sfxToggle.textContent = state.sfxMuted ? "🔇" : "♪";
    dom.sfxToggle.setAttribute("aria-label", state.sfxMuted ? "Unmute sound effects" : "Mute sound effects");
    dom.musicVolume.value = Math.round(state.musicVolume * 100);
    dom.sfxVolume.value = Math.round(state.sfxVolume * 100);
    dom.musicValue.textContent = `${Math.round(state.musicVolume * 100)}%`;
    dom.sfxValue.textContent = `${Math.round(state.sfxVolume * 100)}%`;
  }

  function getRank() {
    const ranks = ["New Face", "Local Legend", "Rising Creator", "Viral Star", "Media Mogul", "Global Icon", "Internet Royalty"];
    return ranks[Math.min(ranks.length - 1, Math.floor(Math.log10(state.totalEarned + 1) / 4))];
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return "∞";
    if (value < 1000) {
      if (value < 10 && value % 1 !== 0) return value.toFixed(1);
      return Math.floor(value).toLocaleString("en-US");
    }
    const units = [
      [1e24, "Sx"], [1e21, "Sp"], [1e18, "Qi"], [1e15, "Qa"],
      [1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]
    ];
    const [divisor, suffix] = units.find(([size]) => value >= size) || [1, ""];
    const scaled = value / divisor;
    const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    return `${scaled.toFixed(digits).replace(/\.0+$|(\.\d*[1-9])0+$/, "$1")}${suffix}`;
  }

  function formatTime(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m ${seconds % 60}s`;
  }

  function updateUI() {
    const income = getIncome();
    const clickPower = getClickPower();
    const needed = xpNeeded();
    const totalBuildings = state.producers.reduce((sum, count) => sum + count, 0);
    const progress = Math.max(0, Math.min(1, Math.log10(state.totalEarned + 1) / Math.log10(FINAL_GOAL + 1)));

    dom.money.textContent = `$${formatNumber(state.money)}`;
    dom.income.textContent = `+$${formatNumber(income)} per second`;
    dom.clickPower.textContent = `+$${formatNumber(clickPower)} per click`;
    dom.level.textContent = state.level;
    dom.rank.textContent = getRank();
    dom.xpText.textContent = `${formatNumber(state.xp)} / ${formatNumber(needed)} XP`;
    dom.xpFill.style.width = `${Math.min(100, (state.xp / needed) * 100)}%`;
    dom.goalText.textContent = `${(progress * 100).toFixed(progress < 0.1 ? 1 : 0)}%`;
    dom.goalFill.style.width = `${progress * 100}%`;
    dom.elapsed.textContent = formatTime(state.activeSeconds);
    dom.clicks.textContent = formatNumber(state.totalClicks);
    dom.lifetime.textContent = `$${formatNumber(state.totalEarned)}`;
    dom.buildings.textContent = formatNumber(totalBuildings);
  }

  function renderMilestones() {
    const recent = MILESTONES.map((milestone, index) => ({ ...milestone, index }))
      .filter((item, index) => state.milestones[item.index] || index === state.milestones.findIndex((done) => !done))
      .slice(-4);

    dom.milestones.innerHTML = recent.map((item) => `
      <li class="milestone ${state.milestones[item.index] ? "done" : ""}">
        <span class="milestone-icon" aria-hidden="true">${state.milestones[item.index] ? "✓" : "◇"}</span>
        <span><strong>${item.name}</strong><br>$${formatNumber(item.at)} lifetime</span>
      </li>
    `).join("");
  }

  function renderShop() {
    document.querySelectorAll(".tab").forEach((tab) => {
      const active = tab.dataset.tab === state.tab;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    document.querySelectorAll(".bulk-button").forEach((button) => {
      button.classList.toggle("active", String(button.dataset.bulk) === String(state.bulk));
    });

    if (state.tab === "producers") {
      dom.shopList.innerHTML = PRODUCERS.map((item, index) => {
        const locked = state.totalEarned < item.unlock;
        const amount = state.bulk === "max" ? maxAffordable(index) : state.bulk;
        const cost = producerCost(index, amount || 1);
        const disabled = locked || amount === 0 || state.money < cost;
        const income = item.income * getMilestoneMultiplier();
        return `
          <button class="shop-card ${locked ? "locked" : ""}" data-producer="${index}" ${disabled ? "disabled" : ""}>
            <span class="shop-icon" aria-hidden="true">${locked ? "🔒" : item.icon}</span>
            <span class="shop-copy">
              <span class="shop-name">${locked ? `Unlock at $${formatNumber(item.unlock)}` : item.name}</span>
              <span class="shop-desc">${locked ? "Keep building your lifetime earnings" : `+$${formatNumber(income)}/sec each`}</span>
              <span class="owned-badge">OWNED ${state.producers[index]}</span>
            </span>
            <span class="shop-price">${locked ? "" : `${amount || 1}× $${formatNumber(cost)}`}</span>
          </button>
        `;
      }).join("");
    } else {
      dom.shopList.innerHTML = CLICK_UPGRADES.map((item, index) => {
        const locked = state.totalEarned < item.unlock;
        const owned = state.upgrades[index];
        const disabled = locked || owned || state.money < item.cost;
        return `
          <button class="shop-card ${locked ? "locked" : ""}" data-upgrade="${index}" ${disabled ? "disabled" : ""}>
            <span class="shop-icon" aria-hidden="true">${locked ? "🔒" : item.icon}</span>
            <span class="shop-copy">
              <span class="shop-name">${locked ? `Unlock at $${formatNumber(item.unlock)}` : item.name}</span>
              <span class="shop-desc">${owned ? "Upgrade installed" : item.desc}</span>
              ${owned ? '<span class="owned-badge">OWNED</span>' : ""}
            </span>
            <span class="shop-price">${owned || locked ? "" : `$${formatNumber(item.cost)}`}</span>
          </button>
        `;
      }).join("");
    }
    renderMilestones();
  }

  function toast(title, message) {
    const element = document.createElement("div");
    element.className = "toast";
    element.innerHTML = `<strong>${escapeHtml(title)}</strong><br>${escapeHtml(message)}`;
    dom.toastStack.appendChild(element);
    setTimeout(() => {
      element.style.opacity = "0";
      element.style.transform = "translateY(8px)";
      setTimeout(() => element.remove(), 250);
    }, 3600);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[character]);
  }

  function grantOfflineProgress() {
    const now = Date.now();
    const secondsAway = Math.min(OFFLINE_CAP_SECONDS, Math.max(0, (now - Number(state.lastSave || now)) / 1000));
    const income = getIncome();
    if (secondsAway >= 60 && income > 0) {
      const earnings = income * secondsAway * OFFLINE_RATE;
      addMoney(earnings);
      setTimeout(() => toast("Welcome back!", `You earned $${formatNumber(earnings)} while away (${formatTime(secondsAway)} at 50%).`), 400);
    }
    state.lastSave = now;
  }

  function exportSave() {
    saveGame();
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(encoded)
        .then(() => toast("Save copied", "Keep the code somewhere safe."))
        .catch(() => window.prompt("Copy your save code:", encoded));
    } else {
      window.prompt("Copy your save code:", encoded);
    }
  }

  function importSave() {
    const encoded = window.prompt("Paste your save code:");
    if (!encoded) return;
    try {
      const parsed = JSON.parse(decodeURIComponent(escape(atob(encoded.trim()))));
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.producers)) throw new Error("Invalid save");
      localStorage.setItem(SAVE_KEY, JSON.stringify(parsed));
      window.location.reload();
    } catch {
      toast("Import failed", "That save code is not valid.");
    }
  }

  function resetGame() {
    if (!window.confirm("Reset all progress? This cannot be undone unless you exported your save.")) return;
    localStorage.removeItem(SAVE_KEY);
    window.location.reload();
  }

  function bindEvents() {
    dom.face.addEventListener("click", handleClick);

    dom.settings.addEventListener("click", () => {
      dom.settingsPanel.hidden = !dom.settingsPanel.hidden;
    });

    document.addEventListener("pointerdown", (event) => {
      startAudio();
      if (!dom.settingsPanel.hidden && !dom.settingsPanel.contains(event.target) && event.target !== dom.settings) {
        dom.settingsPanel.hidden = true;
      }
    }, { once: false });

    dom.musicToggle.addEventListener("click", () => {
      state.musicMuted = !state.musicMuted;
      applyAudioSettings();
      if (!state.musicMuted) dom.bgMusic.play().catch(() => {});
    });

    dom.sfxToggle.addEventListener("click", () => {
      state.sfxMuted = !state.sfxMuted;
      applyAudioSettings();
    });

    dom.musicVolume.addEventListener("input", (event) => {
      state.musicVolume = Number(event.target.value) / 100;
      state.musicMuted = false;
      applyAudioSettings();
      dom.bgMusic.play().catch(() => {});
    });

    dom.sfxVolume.addEventListener("input", (event) => {
      state.sfxVolume = Number(event.target.value) / 100;
      state.sfxMuted = false;
      applyAudioSettings();
    });

    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        state.tab = tab.dataset.tab;
        renderShop();
      });
    });

    document.querySelectorAll(".bulk-button").forEach((button) => {
      button.addEventListener("click", () => {
        state.bulk = button.dataset.bulk === "max" ? "max" : Number(button.dataset.bulk);
        renderShop();
      });
    });

    dom.shopList.addEventListener("click", (event) => {
      const card = event.target.closest(".shop-card");
      if (!card) return;
      if (card.dataset.producer !== undefined) buyProducer(Number(card.dataset.producer));
      if (card.dataset.upgrade !== undefined) buyUpgrade(Number(card.dataset.upgrade));
    });

    $("#saveButton").addEventListener("click", () => saveGame(true));
    $("#exportButton").addEventListener("click", exportSave);
    $("#importButton").addEventListener("click", importSave);
    $("#resetButton").addEventListener("click", resetGame);
    $("#continueButton").addEventListener("click", () => {
      dom.completeModal.hidden = true;
    });

    window.addEventListener("beforeunload", () => saveGame());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) saveGame();
      lastFrame = performance.now();
    });
  }

  function gameLoop(now) {
    const delta = Math.min(1, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    addMoney(getIncome() * delta);
    state.activeSeconds += delta;
    uiAccumulator += delta;
    saveAccumulator += delta;

    if (uiAccumulator >= 0.1) {
      updateUI();
      uiAccumulator = 0;
    }
    if (saveAccumulator >= 5) {
      saveGame();
      renderShop();
      saveAccumulator = 0;
    }
    requestAnimationFrame(gameLoop);
  }

  grantOfflineProgress();
  bindEvents();
  applyAudioSettings();
  renderShop();
  updateUI();
  if (state.completed) {
    dom.finalTime.textContent = formatTime(state.activeSeconds);
  }
  requestAnimationFrame(gameLoop);
})();

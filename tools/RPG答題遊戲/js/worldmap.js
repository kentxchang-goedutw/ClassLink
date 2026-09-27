/**
 * 《智者覺醒：真理之戰》- 艾瑟爾加德世界大地圖與探索走動系統
 * 支援鍵盤 WASD/方向鍵走動、滑鼠點擊移動、關卡觸碰判定與資訊彈窗
 */

const WorldMapSystem = (function () {
  // 5 大關卡節點定義（配合鳥山明手繪台灣大地圖地貌座標 %）
  const STAGES = [
    {
      id: 1,
      name: "第一章：茂林幽谷",
      enemyName: "貪睡巨角仙",
      enemyHp: 100,
      enemyAtk: 15,
      sprite: "assets/images/slime_sprite.png",
      x: 22,
      y: 76,
      desc: "茂林南國的溫暖幽谷中，貪睡巨角仙擋在啟程的隘口，以斑蝶基礎生態向你發起考驗！",
      unlocked: true,
      cleared: false
    },
    {
      id: 2,
      name: "第二章：月世界惡地",
      enemyName: "狂風沙蜥怪",
      enemyHp: 160,
      enemyAtk: 20,
      sprite: "assets/images/mirage_sprite.png",
      x: 31,
      y: 55,
      desc: "灰白乾裂的泥岩荒丘，狂風沙蜥怪捲起滾滾塵暴，唯有掌握蜜源植物與耐力知識才能突破！",
      unlocked: false,
      cleared: false
    },
    {
      id: 3,
      name: "第三章：濁水溪河谷",
      enemyName: "雷雲怪鳥",
      enemyHp: 220,
      enemyAtk: 26,
      sprite: "assets/images/demon_sprite.png",
      x: 46,
      y: 46,
      desc: "滾滾河床狂風怒號，雷雲怪鳥以電光與亂流封鎖航道，考驗氣象與地磁導航智慧！",
      unlocked: false,
      cleared: false
    },
    {
      id: 4,
      name: "第四章：國道生態廊道",
      enemyName: "渦輪機械獸",
      enemyHp: 290,
      enemyAtk: 32,
      sprite: "assets/images/frost_sprite.png",
      x: 58,
      y: 32,
      desc: "車流奔馳的公路險境，巨大渦輪機械獸咆哮推進，唯有理解生態防護網與保育工法方能化解危機！",
      unlocked: false,
      cleared: false
    },
    {
      id: 5,
      name: "第五章：繁衍聖林",
      enemyName: "環境異變巨神",
      enemyHp: 380,
      enemyAtk: 40,
      sprite: "assets/images/boss_sprite.png",
      x: 74,
      y: 16,
      desc: "抵達北部繁衍聖地的古老林野，環境異變巨神佇立在生命之泉前，展開決定群蝶未來的終極生態試煉！",
      unlocked: false,
      cleared: false
    }
  ];

  // 玩家在大地圖上的座標（百分比，初始於茂林起點旁）
  let playerPos = { x: 18, y: 78 };
  let targetPos = null; // 滑鼠點擊目標位置
  let moveSpeed = 0.6; // 鍵盤移動速度 (%)
  let isMoving = false;
  let activeKeys = {};
  let animationFrameId = null;
  let selectedStage = null;

  // 初始化大地圖
  function init() {
    renderNodes();
    renderHeroSwitcher();
    bindControls();
    updatePlayerAvatarPosition();
  }

  // 渲染地圖節點
  function renderNodes() {
    const container = document.getElementById("map-nodes-container");
    if (!container) return;
    container.innerHTML = "";

    STAGES.forEach((stage) => {
      const nodeEl = document.createElement("div");
      nodeEl.className = `map-stage-node ${stage.unlocked ? "unlocked" : "locked"} ${stage.cleared ? "cleared" : ""}`;
      nodeEl.style.left = `${stage.x}%`;
      nodeEl.style.top = `${stage.y}%`;
      nodeEl.dataset.stageId = stage.id;

      nodeEl.innerHTML = `
        <div class="node-marker-glow"></div>
        <div class="node-icon">${stage.cleared ? "⭐" : stage.unlocked ? "⚔️" : "🔒"}</div>
        <div class="node-label">${stage.name.split("：")[1] || stage.name}</div>
      `;

      // 點擊節點直接前往並打開資訊
      nodeEl.addEventListener("click", (e) => {
        e.stopPropagation();
        SoundFX.playClick();
        movePlayerTo(stage.x, stage.y, () => {
          openStagePrompt(stage);
        });
      });

      container.appendChild(nodeEl);
    });
  }

  // 綁定鍵盤與滑鼠點擊控制
  function bindControls() {
    // 鍵盤按下
    window.addEventListener("keydown", (e) => {
      const screen = document.getElementById("worldmap-screen");
      if (!screen || screen.classList.contains("hidden")) return;

      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        activeKeys[k] = true;
        targetPos = null; // 鍵盤操作優先取消滑鼠目標
        if (!isMoving) {
          startMovementLoop();
        }
      }
    });

    // 鍵盤放開
    window.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      if (activeKeys[k]) {
        delete activeKeys[k];
      }
      if (Object.keys(activeKeys).length === 0 && !targetPos) {
        isMoving = false;
        setPlayerWalkingClass(false);
      }
    });

    // 大地圖點擊行走
    const mapArea = document.getElementById("worldmap-container");
    if (mapArea) {
      mapArea.addEventListener("click", (e) => {
        const rect = mapArea.getBoundingClientRect();
        const clickX = ((e.clientX - rect.left) / rect.width) * 100;
        const clickY = ((e.clientY - rect.top) / rect.height) * 100;

        // 邊界防護 5% ~ 95%
        const clampedX = Math.max(5, Math.min(95, clickX));
        const clampedY = Math.max(8, Math.min(92, clickY));

        movePlayerTo(clampedX, clampedY);
      });
    }

    // 關卡彈窗按鈕事件
    document.getElementById("btn-stage-enter")?.addEventListener("click", () => {
      if (selectedStage && selectedStage.unlocked) {
        const stageId = selectedStage.id;
        closeStagePrompt();
        startStageBattle(stageId);
      }
    });

    document.getElementById("btn-stage-cancel")?.addEventListener("click", () => {
      closeStagePrompt();
    });
  }

  // 滑鼠點擊移動目標
  function movePlayerTo(targetX, targetY, callback) {
    targetPos = { x: targetX, y: targetY, onArrival: callback };
    if (!isMoving) {
      startMovementLoop();
    }
  }

  // 主移動迴圈
  function startMovementLoop() {
    isMoving = true;
    setPlayerWalkingClass(true);

    function step() {
      if (!isMoving) return;

      let dx = 0;
      let dy = 0;

      // 處理鍵盤輸入
      if (activeKeys["w"] || activeKeys["arrowup"]) dy -= moveSpeed;
      if (activeKeys["s"] || activeKeys["arrowdown"]) dy += moveSpeed;
      if (activeKeys["a"] || activeKeys["arrowleft"]) dx -= moveSpeed;
      if (activeKeys["d"] || activeKeys["arrowright"]) dx += moveSpeed;

      // 處理滑鼠目標移動
      if (targetPos) {
        const diffX = targetPos.x - playerPos.x;
        const diffY = targetPos.y - playerPos.y;
        const dist = Math.hypot(diffX, diffY);

        if (dist < 1.0) {
          playerPos.x = targetPos.x;
          playerPos.y = targetPos.y;
          const callback = targetPos.onArrival;
          targetPos = null;
          isMoving = false;
          setPlayerWalkingClass(false);
          updatePlayerAvatarPosition();
          if (callback) callback();
          return;
        } else {
          dx = (diffX / dist) * moveSpeed * 1.5;
          dy = (diffY / dist) * moveSpeed * 1.5;
        }
      }

      // 邊界防護 (5% ~ 95%)
      playerPos.x = Math.max(5, Math.min(95, playerPos.x + dx));
      playerPos.y = Math.max(8, Math.min(92, playerPos.y + dy));

      updatePlayerAvatarPosition();
      checkStageProximity();

      if (Object.keys(activeKeys).length > 0 || targetPos) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        isMoving = false;
        setPlayerWalkingClass(false);
      }
    }

    animationFrameId = requestAnimationFrame(step);
  }

  // 更新角色在大地圖上的樣式位置
  function updatePlayerAvatarPosition() {
    const avatar = document.getElementById("map-player-sprite");
    if (!avatar) return;
    avatar.style.left = `${playerPos.x}%`;
    avatar.style.top = `${playerPos.y}%`;
  }

  function setPlayerWalkingClass(walking) {
    const avatar = document.getElementById("map-player-sprite");
    if (avatar) {
      if (walking) avatar.classList.add("walking");
      else avatar.classList.remove("walking");
    }
  }

  // 接近節點判定
  function checkStageProximity() {
    STAGES.forEach((stage) => {
      const dist = Math.hypot(stage.x - playerPos.x, stage.y - playerPos.y);
      if (dist < 3.5 && !targetPos && !selectedStage) {
        openStagePrompt(stage);
      }
    });
  }

  // 打開關卡資訊確認視窗
  function openStagePrompt(stage) {
    selectedStage = stage;
    const modal = document.getElementById("stage-info-modal");
    if (!modal) return;

    // 優先讀取 config 中的自訂關主數值
    let customChapter = null;
    if (typeof DataManager !== "undefined" && DataManager.getConfig) {
      const cfg = DataManager.getConfig();
      if (cfg && Array.isArray(cfg.chapters) && cfg.chapters[stage.id - 1]) {
        customChapter = cfg.chapters[stage.id - 1];
      }
    }

    const stageName = (customChapter && customChapter.name) ? customChapter.name : stage.name;
    const enemyName = (customChapter && customChapter.enemyName) ? customChapter.enemyName : stage.enemyName;
    const enemyHp = (customChapter && (customChapter.enemyHp !== undefined || customChapter.hp !== undefined))
      ? Number(customChapter.enemyHp !== undefined ? customChapter.enemyHp : customChapter.hp)
      : stage.enemyHp;
    const enemyAtk = (customChapter && (customChapter.enemyAttack !== undefined || customChapter.atk !== undefined))
      ? Number(customChapter.enemyAttack !== undefined ? customChapter.enemyAttack : customChapter.atk)
      : stage.enemyAtk;
    const introDesc = (customChapter && (customChapter.description || customChapter.intro))
      ? (customChapter.description || customChapter.intro)
      : stage.desc;

    document.getElementById("stage-info-title").textContent = stageName;
    document.getElementById("stage-info-desc").textContent = introDesc;
    document.getElementById("stage-info-enemy-name").textContent = enemyName;
    document.getElementById("stage-info-enemy-hp").textContent = `HP: ${enemyHp} | 攻擊力: ${enemyAtk}`;
    document.getElementById("stage-info-enemy-sprite").src = stage.sprite;

    const enterBtn = document.getElementById("btn-stage-enter");
    if (stage.unlocked) {
      enterBtn.disabled = false;
      enterBtn.textContent = stage.cleared ? "⚔️ 再次挑戰" : "⚔️ 進入挑戰";
      enterBtn.style.opacity = "1";
    } else {
      enterBtn.disabled = true;
      enterBtn.textContent = "🔒 關卡未解鎖";
      enterBtn.style.opacity = "0.6";
    }

    modal.classList.remove("hidden");
  }

  function closeStagePrompt() {
    selectedStage = null;
    const modal = document.getElementById("stage-info-modal");
    if (modal) modal.classList.add("hidden");
  }

  // 啟動關卡戰鬥
  function startStageBattle(stageId) {
    SoundFX.playSelect();
    // 切換至戰鬥畫面
    document.getElementById("worldmap-screen").classList.add("hidden");
    document.getElementById("battle-screen").classList.remove("hidden");

    // 依關卡編號啟動戰鬥
    BattleEngine.startChapter(stageId - 1);
  }

  // 大地圖右下角：渲染四大勇者切換控制列
  function renderHeroSwitcher() {
    const container = document.getElementById("map-hero-switcher-list");
    if (!container || typeof DataManager === "undefined" || !DataManager.getHeroes) return;

    const heroes = DataManager.getHeroes();
    const currentHeroId = DataManager.getCurrentHeroId();
    container.innerHTML = "";

    // 阻止大地圖點擊行走的冒泡
    const switcherBox = document.getElementById("map-hero-switcher");
    if (switcherBox && !switcherBox._boundStop) {
      switcherBox.addEventListener("click", (e) => e.stopPropagation());
      switcherBox._boundStop = true;
    }

    heroes.forEach((hero) => {
      const btn = document.createElement("div");
      btn.className = `switcher-btn ${hero.id === currentHeroId ? "active" : ""}`;
      btn.dataset.heroId = hero.id;
      btn.title = `點擊切換為【${hero.title} ${hero.name}】出戰 (${hero.element})`;

      let roleTag = "少年";
      if (hero.id === "hero_round") roleTag = "壯士";
      else if (hero.id === "hero_syl") roleTag = "動物";
      else if (hero.id === "hero_mul") roleTag = "女刺客";

      btn.innerHTML = `
        <div class="switcher-avatar-circle">
          <img src="${hero.avatar}" alt="${hero.name}">
        </div>
        <span class="switcher-btn-name">${hero.name}</span>
        <span class="switcher-btn-role">${roleTag}</span>
      `;

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (DataManager.getCurrentHeroId() === hero.id) return;

        DataManager.setCurrentHeroId(hero.id);
        SoundFX.playSelect();

        // 更新大地圖中央移動小人的頭像與名稱
        const studentName = DataManager.getStudentName() || "紫蝶勇者";
        const mapAvatarImg = document.getElementById("map-player-avatar-img");
        if (mapAvatarImg) {
          mapAvatarImg.src = hero.avatar;
        }
        const nameTag = document.getElementById("map-player-name-tag");
        if (nameTag) {
          nameTag.textContent = `${hero.name}：${studentName}`;
        }

        // 更新按鈕高亮狀態
        container.querySelectorAll(".switcher-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        // 彈出換角提示 Toast
        showSwitchToast(`✨ 已切換為【${hero.title} ${hero.name}】出戰！`);

        // 若主畫面存在，同步主畫面選取
        if (typeof renderHeroSelectionGrid === "function") {
          renderHeroSelectionGrid();
        }
      });

      container.appendChild(btn);
    });
  }

  // 大地圖浮動通知 Toast
  function showSwitchToast(text) {
    const existing = document.querySelector(".map-switch-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "map-switch-toast";
    toast.textContent = text;

    const mapArea = document.getElementById("worldmap-container");
    if (mapArea) {
      mapArea.appendChild(toast);
      setTimeout(() => {
        toast.style.transition = "opacity 0.4s ease";
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 400);
      }, 1600);
    }
  }

  return {
    init: init,

    // 顯示大地圖
    show: function () {
      if (typeof SoundFX !== "undefined" && SoundFX.stopBGM) {
        SoundFX.stopBGM();
      }
      document.getElementById("start-screen").classList.add("hidden");
      document.getElementById("battle-screen").classList.add("hidden");
      document.getElementById("worldmap-screen").classList.remove("hidden");
      updatePlayerAvatarPosition();
      renderNodes();
      renderHeroSwitcher();
    },

    // 標記關卡通關並解鎖下一關
    onStageCleared: function (chapterIndex) {
      if (STAGES[chapterIndex]) {
        STAGES[chapterIndex].cleared = true;
      }
      if (STAGES[chapterIndex + 1]) {
        STAGES[chapterIndex + 1].unlocked = true;
      }
      renderNodes();
    },

    getStages: function () {
      return STAGES;
    },

    // 完全重置 5 個關卡進度（供重新開始挑戰使用）
    resetAllStages: function () {
      STAGES.forEach((s, idx) => {
        s.cleared = false;
        s.unlocked = (idx === 0);
      });
      playerPos = { x: 18, y: 78 };
      targetPos = null;
      renderNodes();
      updatePlayerAvatarPosition();
    }
  };
})();

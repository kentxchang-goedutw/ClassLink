/**
 * 《智者覺醒：真理之戰》- 戰鬥與答題核心系統
 * 實現 JRPG 回合制戰鬥、四選一答題、技能施放、道具使用與關卡推進
 */

const BattleEngine = (function () {
  // 戰鬥狀態定義
  const STATE = {
    IDLE: "IDLE", // 等待玩家選擇主指令
    QUESTION: "QUESTION", // 答題中
    ANIMATING: "ANIMATING", // 攻擊/結算動畫進行中
    VICTORY: "VICTORY", // 單關獲勝
    GAME_OVER: "GAME_OVER", // 失敗
    GAME_CLEAR: "GAME_CLEAR" // 全部通關
  };

  let currentState = STATE.IDLE;
  let currentChapterIndex = 0; // 0: 第一章, 1: 第二章, 2: 第三章
  let selectedCategory = "全部";

  // 依據當前選定的紫斑蝶勇者動態初始化數值與技能
  function getSelectedHeroConfig() {
    return (typeof DataManager !== "undefined" && DataManager.getCurrentHero)
      ? DataManager.getCurrentHero()
      : {
          id: "hero_purple",
          name: "小紫",
          title: "幻紫遊俠",
          butterfly: "小紫斑蝶",
          element: "風 / 幻光",
          hp: 100,
          maxHp: 100,
          mp: 50,
          maxMp: 50,
          atk: 35,
          critRate: 0.15,
          critMultiplier: 2.2,
          damageReduction: 0.0,
          sprite: "assets/images/hero_sprite.png",
          avatar: "assets/images/avatar_purple.png",
          attackMoveName: "【極光幻紫斬】",
          skills: [
            { id: "SKILL_CRIT", name: "✨ 幻紫鱗光", desc: "答對造成 2.2 倍暴擊傷害", cost: 15, type: "crit" },
            { id: "SKILL_HEAL", name: "🌿 甘露沐浴", desc: "答對回復 45 HP 並反震", cost: 10, type: "heal" },
            { id: "SKILL_FIFTY", name: "👁️ 複眼透視", desc: "自動排除 2 個錯誤選項", cost: 20, type: "fifty" }
          ]
        };
  }

  function createPlayerFromHero() {
    const hero = getSelectedHeroConfig();
    return {
      id: hero.id,
      name: hero.name,
      title: hero.title,
      butterfly: hero.butterfly,
      element: hero.element,
      hp: hero.hp,
      maxHp: hero.maxHp,
      mp: hero.mp,
      maxMp: hero.maxMp,
      atk: hero.atk,
      critRate: hero.critRate,
      critMultiplier: hero.critMultiplier,
      damageReduction: hero.damageReduction || 0,
      sprite: hero.sprite,
      avatar: hero.avatar,
      skills: JSON.parse(JSON.stringify(hero.skills || [])),
      attackMoveName: hero.attackMoveName,
      level: 1,
      exp: 0,
      score: 0,
      potions: {
        heal: 2,
        mana: 2
      }
    };
  }

  // 玩家當前數值 (預設加載選定勇者)
  let player = createPlayerFromHero();

  // 敵方當前數值
  let enemy = {
    name: "貪睡巨角仙",
    hp: 100,
    maxHp: 100,
    atk: 15,
    sprite: "assets/images/slime_sprite.png",
    bg: "assets/images/forest_bg.jpg",
    description: ""
  };

  // 當前題目與當前行動模式（含隨機選項洗牌狀態）
  let currentQuestion = null;
  let currentShuffledOptions = [];
  let currentCorrectOptionIndex = 0;
  let currentActionMode = "ATTACK"; // "ATTACK", "SKILL_CRIT", "SKILL_HEAL", "SKILL_FIFTY"
  let usedQuestionIds = [];
  let answerTimer = null;
  let timeLeft = 30;

  // 學生答題歷程累積紀錄
  let studentAnswerHistory = [];

  // 魔王定時攻擊計時器、攻擊動畫鎖定與橫條倒數即時狀態
  let bossPeriodicTimer = null;
  let bossAttackInterval = 5.0; // 本關卡攻擊週期上限 (秒)
  let bossAttackTimeLeft = 5.0; // 當前剩餘秒數
  let isBossAttacking = false;

  // 5 大章節紫斑蝶遷徙路徑資料
  const chapterData = [
    {
      chapter: 1,
      title: "第一章：茂林幽谷",
      enemyName: "貪睡巨角仙",
      hp: 100,
      atk: 15,
      attackInterval: 5.0,
      bg: "assets/images/forest_bg.jpg",
      sprite: "assets/images/slime_sprite.png",
      intro: "南台灣茂林越冬幽谷的起點！貪睡巨角仙正守在隘口，以斑蝶基礎生態考驗小紫！"
    },
    {
      chapter: 2,
      title: "第二章：月世界惡地",
      enemyName: "狂風沙蜥怪",
      hp: 160,
      atk: 20,
      attackInterval: 4.5,
      bg: "assets/images/desert_bg.jpg",
      sprite: "assets/images/mirage_sprite.png",
      intro: "乾涸貧瘠的白堊土泥岩荒丘！狡黠的狂風沙蜥怪揮舞仙人掌，考驗蜜源與食草生存知識！"
    },
    {
      chapter: 3,
      title: "第三章：濁水溪河谷",
      enemyName: "雷雲怪鳥",
      hp: 220,
      atk: 26,
      attackInterval: 4.0,
      bg: "assets/images/river_bg.jpg",
      sprite: "assets/images/demon_sprite.png",
      intro: "廣闊石灘上空狂風驟起、雷光閃爍！雷雲怪鳥以高空氣流封鎖航道，考驗氣候與飛行導航！"
    },
    {
      chapter: 4,
      title: "第四章：國道生態廊道",
      enemyName: "渦輪機械獸",
      hp: 290,
      atk: 32,
      attackInterval: 3.5,
      bg: "assets/images/highway_bg.jpg",
      sprite: "assets/images/frost_sprite.png",
      intro: "車速狂飆的國道三號林內段！巨大渦輪機械獸攜帶狂暴風壓襲來，考驗生態防護網與保育工法！"
    },
    {
      chapter: 5,
      title: "第五章：繁衍聖林",
      enemyName: "環境異變巨神",
      hp: 380,
      atk: 40,
      attackInterval: 3.0,
      bg: "assets/images/sacred_bg.jpg",
      sprite: "assets/images/boss_sprite.png",
      intro: "北部海線繁衍聖地古木前！環境異變巨神展開終極試煉，唯有具備完整生態永續智慧才能迎來新生！"
    }
  ];

  // 日誌記錄器
  function addLog(message, type = "normal") {
    const logBox = document.getElementById("battle-log-content");
    if (!logBox) return;

    const entry = document.createElement("div");
    entry.className = `log-line log-${type}`;
    const timeStr = new Date().toLocaleTimeString("zh-TW", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    entry.innerHTML = `<span class="log-time">[${timeStr}]</span> ${message}`;
    logBox.appendChild(entry);
    logBox.scrollTop = logBox.scrollHeight;
  }

  // 更新介面 UI 狀態
  function updateUI() {
    const studentName = DataManager.getStudentName() || "紫蝶勇者小紫";

    // 玩家狀態 (下方狀態欄)
    document.getElementById("player-hp-text").textContent = `${Math.max(0, player.hp)} / ${player.maxHp}`;
    document.getElementById("player-hp-bar").style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
    document.getElementById("player-mp-text").textContent = `${Math.max(0, player.mp)} / ${player.maxMp}`;
    document.getElementById("player-mp-bar").style.width = `${Math.max(0, (player.mp / player.maxMp) * 100)}%`;
    document.getElementById("player-level").textContent = `Lv. ${player.level}`;
    document.getElementById("player-score").textContent = player.score;
    document.getElementById("potion-heal-count").textContent = player.potions.heal;
    document.getElementById("potion-mana-count").textContent = player.potions.mana;

    // 同步更新道具選單按鈕上的剩餘次數標示
    const btnHeal = document.getElementById("btn-item-heal");
    if (btnHeal && player.potions) {
      btnHeal.innerHTML = `<span>🧪 蜜源精華露 (立即恢復 50 HP) [剩餘 ${player.potions.heal} 次]</span>`;
      btnHeal.disabled = (player.potions.heal <= 0);
      btnHeal.style.opacity = (player.potions.heal <= 0) ? "0.5" : "1";
    }
    const btnMana = document.getElementById("btn-item-mana");
    if (btnMana && player.potions) {
      btnMana.innerHTML = `<span>💧 朝露活力滴劑 (立即恢復 40 MP) [剩餘 ${player.potions.mana} 次]</span>`;
      btnMana.disabled = (player.potions.mana <= 0);
      btnMana.style.opacity = (player.potions.mana <= 0) ? "0.5" : "1";
    }

    // 玩家狀態 (頂部對抗欄)
    const topHeroNameEl = document.getElementById("top-hero-name");
    if (topHeroNameEl) topHeroNameEl.textContent = `🦋 ${player.name} [${player.element}]`;
    const topHeroLvlEl = document.getElementById("top-hero-level");
    if (topHeroLvlEl) topHeroLvlEl.textContent = `Lv. ${player.level}`;
    const topHeroHpBar = document.getElementById("top-hero-hp-bar");
    if (topHeroHpBar) topHeroHpBar.style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
    const topHeroHpText = document.getElementById("top-hero-hp-text");
    if (topHeroHpText) topHeroHpText.textContent = `${Math.max(0, player.hp)} / ${player.maxHp}`;

    // 玩家立繪與頭像更新 (支援四大勇者動態切換與自訂圖片即時套用)
    const playerImg = document.getElementById("player-battle-sprite-img");
    if (playerImg && player.sprite) {
      if (playerImg.getAttribute("src") !== player.sprite) {
        playerImg.src = player.sprite;
      }
    }
    const playerAvatar = document.getElementById("player-hud-avatar-img");
    if (playerAvatar && player.avatar) {
      if (playerAvatar.getAttribute("src") !== player.avatar) {
        playerAvatar.src = player.avatar;
      }
    }
    const hudName = document.getElementById("player-hud-name");
    if (hudName) {
      hudName.textContent = `${player.name} (${player.title})`;
    }

    // 動態更新技能按鈕文字與消耗
    if (player.skills) {
      const btnCrit = document.getElementById("btn-skill-crit");
      if (btnCrit && player.skills[0]) {
        btnCrit.innerHTML = `<span>${player.skills[0].name} (${player.skills[0].desc})</span><span class="cost-tag">${player.skills[0].cost} MP</span>`;
      }
      const btnHeal = document.getElementById("btn-skill-heal");
      if (btnHeal && player.skills[1]) {
        btnHeal.innerHTML = `<span>${player.skills[1].name} (${player.skills[1].desc})</span><span class="cost-tag">${player.skills[1].cost} MP</span>`;
      }
      const btnFifty = document.getElementById("btn-skill-fifty");
      if (btnFifty && player.skills[2]) {
        btnFifty.innerHTML = `<span>${player.skills[2].name} (${player.skills[2].desc})</span><span class="cost-tag">${player.skills[2].cost} MP</span>`;
      }
    }

    // 敵人狀態 (頂部對抗欄)
    document.getElementById("enemy-name").textContent = enemy.name;
    document.getElementById("enemy-hp-text").textContent = `${Math.max(0, enemy.hp)} / ${enemy.maxHp}`;
    document.getElementById("enemy-hp-bar").style.width = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;
    // 取得當前關卡章節標題 (優先讀取 config 自訂)
    let currentChapterTitle = chapterData[currentChapterIndex].title;
    if (typeof DataManager !== "undefined" && DataManager.getConfig) {
      const cfg = DataManager.getConfig();
      if (cfg && Array.isArray(cfg.chapters) && cfg.chapters[currentChapterIndex]) {
        const c = cfg.chapters[currentChapterIndex];
        currentChapterTitle = c.name || c.title || currentChapterTitle;
      }
    }
    document.getElementById("chapter-indicator").textContent = currentChapterTitle;

    // 背景與立繪更新
    const bgContainer = document.getElementById("battle-visual-container");
    if (bgContainer) {
      bgContainer.style.backgroundImage = `url('${enemy.bg}')`;
    }
    const enemyImg = document.getElementById("enemy-sprite-img");
    if (enemyImg && enemyImg.src !== enemy.sprite) {
      enemyImg.src = enemy.sprite;
    }
  }

  // 切換為全畫面電影戰鬥模式（答對時展開上方場景區至全畫面）
  function enterCinematicFullscreen() {
    const battleScreen = document.getElementById("battle-screen");
    if (battleScreen) {
      battleScreen.classList.add("cinematic-mode");
    }
  }

  // 退出全畫面模式，平滑還原原雙層答題與操作介面
  function exitCinematicFullscreen() {
    const battleScreen = document.getElementById("battle-screen");
    if (battleScreen) {
      battleScreen.classList.remove("cinematic-mode");
    }
  }

  // 即時更新所有關主突襲倒數橫條與時間文本
  function updateBossAttackTimerUI() {
    const pct = bossAttackInterval > 0 ? Math.max(0, Math.min(100, (bossAttackTimeLeft / bossAttackInterval) * 100)) : 0;
    const isUrgent = bossAttackTimeLeft <= 1.5 && bossAttackTimeLeft > 0;
    const isStriking = bossAttackTimeLeft <= 0 || isBossAttacking;

    const timeText = isStriking ? "突襲中!" : `${bossAttackTimeLeft.toFixed(1)}s`;

    // 1. 頂部敵人狀態欄橫條與文字
    const timerSecEl = document.getElementById("boss-timer-sec");
    const timerBarEl = document.getElementById("boss-timer-bar-fill");
    if (timerSecEl) {
      timerSecEl.textContent = timeText;
      timerSecEl.classList.toggle("timer-urgent", isUrgent || isStriking);
    }
    if (timerBarEl) {
      timerBarEl.style.width = `${pct}%`;
      timerBarEl.classList.toggle("timer-urgent", isUrgent || isStriking);
    }

    // 2. 魔王立繪頂部懸浮橫條與文字
    const floatTextEl = document.getElementById("boss-floating-timer-text");
    const floatBarEl = document.getElementById("boss-floating-timer-fill");
    if (floatTextEl) floatTextEl.textContent = timeText;
    if (floatBarEl) floatBarEl.style.width = `${pct}%`;

    // 3. 答題面板中同步橫條與文字
    const quizSecEl = document.getElementById("quiz-boss-timer-sec");
    const quizBarEl = document.getElementById("quiz-boss-timer-bar");
    if (quizSecEl) {
      quizSecEl.textContent = timeText;
      quizSecEl.classList.toggle("timer-urgent", isUrgent || isStriking);
    }
    if (quizBarEl) {
      quizBarEl.style.width = `${pct}%`;
      quizBarEl.classList.toggle("timer-urgent", isUrgent || isStriking);
    }
  }

  // 啟動魔王固定時間發動攻擊與即時橫條倒數動畫（依據關卡設定或後台自訂之 attackInterval 秒數）
  function startBossPeriodicAttack() {
    stopBossPeriodicAttack();
    const intervalSec = (enemy && enemy.attackInterval) ? enemy.attackInterval : 5.0;
    bossAttackInterval = Math.max(1.0, Number(intervalSec));

    if (bossAttackTimeLeft <= 0 || bossAttackTimeLeft > bossAttackInterval) {
      bossAttackTimeLeft = bossAttackInterval;
    }

    updateBossAttackTimerUI();

    const TICK_INTERVAL_MS = 50;
    const TICK_STEP = TICK_INTERVAL_MS / 1000; // 每 50ms 推進 0.05 秒

    bossPeriodicTimer = setInterval(() => {
      // 狀態防呆：非戰鬥中或介面隱藏時停止攻擊
      const battleScreen = document.getElementById("battle-screen");
      if (!battleScreen || battleScreen.classList.contains("hidden")) {
        stopBossPeriodicAttack();
        return;
      }
      if (currentState === STATE.GAME_OVER || currentState === STATE.GAME_CLEAR || currentState === STATE.VICTORY) {
        stopBossPeriodicAttack();
        return;
      }
      if (enemy.hp <= 0 || player.hp <= 0) {
        stopBossPeriodicAttack();
        return;
      }

      // 避免與主角大絕全螢幕電影模式衝突：全螢幕爆發期間凍結倒數，待主角退回正常視圖後繼續倒數
      if (battleScreen.classList.contains("cinematic-mode")) {
        return;
      }

      // 若魔王當前正在執行突擊衝刺動畫中，凍結倒數推進
      if (isBossAttacking) {
        return;
      }

      // 時間正常倒數（無論在主選單發呆或正在答題，倒數皆持續進行，讓玩家明確掌握關主發動攻擊時機）
      bossAttackTimeLeft = Math.max(0, bossAttackTimeLeft - TICK_STEP);
      updateBossAttackTimerUI();

      // 倒數橫條到 0 時，關主立即對勇者發動攻擊！
      if (bossAttackTimeLeft <= 0) {
        executeBossAttackOnPlayer();
      }
    }, TICK_INTERVAL_MS);
  }

  // 停止魔王定時攻擊
  function stopBossPeriodicAttack() {
    if (bossPeriodicTimer) {
      clearInterval(bossPeriodicTimer);
      bossPeriodicTimer = null;
    }
  }

  // 執行魔王向主角的主動突進攻擊（不放大全畫面，維持原有戰鬥與答題介面）
  function executeBossAttackOnPlayer() {
    if (isBossAttacking) return;
    isBossAttacking = true;

    const enemySprite = document.getElementById("enemy-sprite-container");
    const playerSprite = document.getElementById("player-battle-sprite-container");
    const playerAnchor = document.getElementById("player-fx-anchor") || playerSprite;
    const visualStage = document.getElementById("battle-visual-container");

    if (!enemySprite || !playerSprite) {
      isBossAttacking = false;
      return;
    }

    // 1. 動態計算魔王向左突擊身位 (向左為負位移，停在主角右側約 130px)
    let dashDist = -350;
    const eRect = enemySprite.getBoundingClientRect();
    const pRect = playerSprite.getBoundingClientRect();
    if (eRect && pRect && eRect.left > pRect.left) {
      dashDist = -Math.max(140, Math.round(eRect.left - pRect.left - 130));
    }

    // 2. 計算魔王傷害與主角減傷
    let enemyDmg = enemy.atk + Math.floor(Math.random() * 6);
    if (player.damageReduction && player.damageReduction > 0) {
      const reduced = Math.max(1, Math.round(enemyDmg * (1 - player.damageReduction)));
      addLog(`🛡️【${player.name}】被動防禦減免了衝擊！(減免 ${Math.round(player.damageReduction * 100)}% 傷害)`, "info");
      enemyDmg = reduced;
    }

    // 3. 魔王突進前衝動畫 (380ms，不觸發全螢幕電影模式)
    enemySprite.classList.remove("anim-float");
    void enemySprite.offsetWidth;

    const bossDashAnimation = enemySprite.animate([
      { transform: "translate(0, 0) scale(1)", filter: "drop-shadow(0 0 10px rgba(255, 71, 87, 0.4))", offset: 0 },
      { transform: "translate(20px, 4px) scale(0.96)", filter: "brightness(1.5) drop-shadow(0 0 25px #ff4757)", offset: 0.2 },
      { transform: `translate(${dashDist}px, -10px) scale(1.18)`, filter: "brightness(1.8) drop-shadow(-15px 0 30px #ff3838)", offset: 0.8 },
      { transform: `translate(${dashDist}px, -8px) scale(1.15)`, filter: "brightness(1.6) drop-shadow(0 0 25px #ff6b6b)", offset: 1 }
    ], {
      duration: 380,
      easing: "cubic-bezier(0.12, 0.88, 0.25, 1)",
      fill: "forwards"
    });

    bossDashAnimation.onfinish = () => {
      // 4. 到達主角身前：播放打擊音效、撕裂爪痕特效、受傷紅字、主角劇烈受擊與震屏
      if (typeof SoundFX !== "undefined" && SoundFX.playAttackHit) {
        SoundFX.playAttackHit();
      }

      // 產生爪痕撕裂特效
      const clawFx = document.createElement("div");
      clawFx.className = "fx-boss-claw-hit";
      clawFx.innerHTML = `
        <div class="fx-boss-slash-line"></div>
        <div class="fx-boss-slash-line"></div>
        <div class="fx-boss-slash-line"></div>
      `;
      playerAnchor.appendChild(clawFx);

      // 主角立繪震撼受擊紅光
      playerSprite.classList.add("anim-player-hurt");

      // 彈出傷害浮動紅字
      const dmgPop = document.createElement("div");
      dmgPop.className = "player-damage-pop";
      dmgPop.textContent = `-${enemyDmg}`;
      playerAnchor.appendChild(dmgPop);

      // 戰鬥舞台輕微震動
      if (visualStage) {
        visualStage.classList.remove("anim-screen-shake");
        void visualStage.offsetWidth;
        visualStage.classList.add("anim-screen-shake");
        setTimeout(() => visualStage.classList.remove("anim-screen-shake"), 350);
      }

      // 扣除主角生命並更新 UI 與日誌
      player.hp = Math.max(0, player.hp - enemyDmg);
      updateUI();
      addLog(`⚡【${enemy.name}】發動定時猛攻！對【${player.name}】造成了 ${enemyDmg} 點傷害！`, "danger");

      // 5. 在主角身前打擊停頓 480ms，隨後平滑後撤歸位
      setTimeout(() => {
        const bossReturnAnimation = enemySprite.animate([
          { transform: `translate(${dashDist}px, -8px) scale(1.15)`, filter: "brightness(1.3)", offset: 0 },
          { transform: "translate(0, 0) scale(1)", filter: "brightness(1)", offset: 1 }
        ], {
          duration: 350,
          easing: "cubic-bezier(0.25, 0.8, 0.25, 1)",
          fill: "forwards"
        });

        bossReturnAnimation.onfinish = () => {
          bossDashAnimation.cancel();
          bossReturnAnimation.cancel();
          enemySprite.style.transform = "";
          enemySprite.className = "enemy-sprite-wrapper anim-float";
          playerSprite.classList.remove("anim-player-hurt");
          clawFx.remove();
          dmgPop.remove();
          isBossAttacking = false;

          // 判斷主角是否陣亡
          if (player.hp <= 0) {
            stopBossPeriodicAttack();
            if (answerTimer) {
              clearInterval(answerTimer);
              answerTimer = null;
            }
            setTimeout(handleGameOver, 400);
            return;
          }

          // 突擊完畢，關主安然歸位，重設突襲倒數時間，立即開始下一輪蓄力！
          if (enemy.hp > 0 && currentState !== STATE.GAME_OVER && currentState !== STATE.GAME_CLEAR && currentState !== STATE.VICTORY) {
            bossAttackTimeLeft = bossAttackInterval;
            updateBossAttackTimerUI();
          }
        };
      }, 480);
    };
  }

  // 載入章節
  function loadChapter(index) {
    exitCinematicFullscreen();
    stopBossPeriodicAttack();
    currentChapterIndex = index;
    const baseInfo = chapterData[index];

    // 動態讀取教師後台調整之關卡魔王關主自訂數值
    let customChapter = null;
    if (typeof DataManager !== "undefined" && DataManager.getConfig) {
      const cfg = DataManager.getConfig();
      if (cfg && Array.isArray(cfg.chapters) && cfg.chapters[index]) {
        customChapter = cfg.chapters[index];
      }
    }

    const enemyName = (customChapter && customChapter.enemyName) ? customChapter.enemyName : baseInfo.enemyName;
    const enemyHp = (customChapter && (customChapter.enemyHp !== undefined || customChapter.hp !== undefined))
      ? Number(customChapter.enemyHp !== undefined ? customChapter.enemyHp : customChapter.hp)
      : baseInfo.hp;
    const enemyAtk = (customChapter && (customChapter.enemyAttack !== undefined || customChapter.atk !== undefined))
      ? Number(customChapter.enemyAttack !== undefined ? customChapter.enemyAttack : customChapter.atk)
      : baseInfo.atk;
    const attackInterval = (customChapter && (customChapter.attackInterval !== undefined))
      ? Math.max(1.0, Number(customChapter.attackInterval))
      : (baseInfo.attackInterval || 5.0);
    const chapterTitle = (customChapter && (customChapter.name || customChapter.title))
      ? (customChapter.name || customChapter.title)
      : baseInfo.title;
    const introDesc = (customChapter && (customChapter.description || customChapter.intro))
      ? (customChapter.description || customChapter.intro)
      : baseInfo.intro;

    // 動態讀取教師後台自訂魔王立繪與戰鬥背景圖片
    const bossFileMapping = ["slime_sprite.png", "mirage_sprite.png", "demon_sprite.png", "frost_sprite.png", "boss_sprite.png"];
    const bgFileMapping = ["forest_bg.jpg", "desert_bg.jpg", "river_bg.jpg", "highway_bg.jpg", "sacred_bg.jpg"];
    let enemySpriteUrl = (customChapter && customChapter.spriteImage) ? customChapter.spriteImage : baseInfo.sprite;
    let stageBg = (customChapter && customChapter.bgImage) ? customChapter.bgImage : baseInfo.bg;
    if (typeof DataManager !== "undefined" && DataManager.getConfig) {
      const cfg = DataManager.getConfig();
      const customImgs = (cfg && cfg.customImages) || {};
      const bFile = bossFileMapping[index];
      const bgFile = bgFileMapping[index];
      if (bFile && customImgs[bFile]) enemySpriteUrl = customImgs[bFile];
      if (bgFile && customImgs[bgFile]) stageBg = customImgs[bgFile];
    }

    enemy = {
      name: enemyName,
      hp: enemyHp,
      maxHp: enemyHp,
      atk: enemyAtk,
      attackInterval: attackInterval,
      sprite: enemySpriteUrl,
      bg: stageBg,
      description: introDesc
    };

    // 進入每一關：勇者血量與魔力自動完全補滿，且各項補給物資均重置為 2 次
    player.hp = player.maxHp;
    player.mp = player.maxMp;
    if (!player.potions) {
      player.potions = { heal: 2, mana: 2 };
    } else {
      player.potions.heal = 2;
      player.potions.mana = 2;
    }

    // 重設舞台立繪待機狀態與清理殘留特效
    const playerSprite = document.getElementById("player-battle-sprite-container");
    if (playerSprite) {
      playerSprite.className = "player-battle-sprite-wrapper anim-player-idle";
    }
    const enemySprite = document.getElementById("enemy-sprite-container");
    if (enemySprite) {
      enemySprite.className = "enemy-sprite-wrapper anim-float";
    }
    const fxLayer = document.getElementById("battle-fx-overlay");
    if (fxLayer) {
      fxLayer.innerHTML = "";
    }

    updateUI();
    showCommandMenu();
    addLog(`=== ${chapterTitle} 展開戰鬥 ===`, "highlight");
    addLog(introDesc, "info");
    addLog(`💖 航段啟程！【${player.name}】體力完全恢復滿血 (${player.hp}/${player.maxHp})，補給物資已重置整備 (蜜露: 2次 / 朝露: 2次)！`, "success");

    // 播放本關卡專屬 BGM 音樂 (Stage 1 ~ 5)
    if (typeof SoundFX !== "undefined" && SoundFX.playStageBGM) {
      SoundFX.playStageBGM(index + 1);
    }

    // 啟動魔王定時主動攻擊與即時橫條倒數
    bossAttackInterval = attackInterval;
    bossAttackTimeLeft = attackInterval;
    updateBossAttackTimerUI();
    startBossPeriodicAttack();
  }

  // 顯示指令主選單，隱藏次選單
  function showCommandMenu() {
    currentState = STATE.IDLE;
    document.getElementById("action-main-menu").classList.remove("hidden");
    document.getElementById("action-skill-menu").classList.add("hidden");
    document.getElementById("action-item-menu").classList.add("hidden");
    document.getElementById("quiz-panel").classList.add("hidden");
    // 確保魔王定時攻擊與橫條倒數持續運作
    if (!bossPeriodicTimer) {
      startBossPeriodicAttack();
    }
  }

  // 抽題並顯示答題卡片
  function presentQuestion(actionMode = "ATTACK") {
    currentActionMode = actionMode;
    currentState = STATE.QUESTION;

    const chapterNum = currentChapterIndex + 1;
    currentQuestion = DataManager.getRandomQuestion(chapterNum, selectedCategory, usedQuestionIds);

    // 若題庫題目剛好跑滿一輪重新循環，重置已出題目清單，確保新一輪隨機抽取不重複
    if (currentQuestion && currentQuestion._isNewCycle) {
      usedQuestionIds = [];
    }

    if (currentQuestion && currentQuestion.id) {
      usedQuestionIds.push(currentQuestion.id);
    }

    if (!currentQuestion) {
      addLog("題庫已告罄，真理之光庇護你直接通過！", "highlight");
      applyPlayerAttack(true);
      return;
    }

    // 隱藏指令選單，開啟題目面板
    document.getElementById("action-main-menu").classList.add("hidden");
    document.getElementById("action-skill-menu").classList.add("hidden");
    document.getElementById("action-item-menu").classList.add("hidden");
    document.getElementById("quiz-panel").classList.remove("hidden");

    // 填入題目
    document.getElementById("quiz-category-tag").textContent = currentQuestion.category || "生態考驗";
    document.getElementById("quiz-question-text").textContent = currentQuestion.question;

    // 將題目選項隨機打亂 (Fisher-Yates Shuffle)，使正確答案隨機出現在 A、B、C、D 各個按鈕位置
    const rawOptions = (currentQuestion.options || []).slice(0, 4);
    const correctOriginalIdx = currentQuestion.answerIndex !== undefined ? currentQuestion.answerIndex : 0;

    const optionItems = rawOptions.map((text, origIdx) => ({
      text: text,
      isCorrect: origIdx === correctOriginalIdx
    }));

    for (let i = optionItems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [optionItems[i], optionItems[j]] = [optionItems[j], optionItems[i]];
    }

    currentShuffledOptions = optionItems;
    currentCorrectOptionIndex = optionItems.findIndex((item) => item.isCorrect);
    window.__dbg_correct = currentCorrectOptionIndex;

    const optionLetters = ["A", "B", "C", "D"];
    const optionButtons = document.querySelectorAll(".quiz-opt-btn");

    optionButtons.forEach((btn, idx) => {
      btn.classList.remove("hidden", "correct", "wrong", "disabled");
      btn.disabled = false;
      const textSpan = btn.querySelector(".opt-text");
      if (textSpan) {
        textSpan.textContent = (optionItems[idx] && optionItems[idx].text) || "";
      }
    });

    // 若使用的是排除錯誤選項特技，隨機排除錯誤選項
    if (actionMode === "SKILL_FIFTY") {
      const sFifty = (player.skills && player.skills[2]) || {};
      const removeCount = Math.max(1, Math.min(3, sFifty.removeCount !== undefined ? sFifty.removeCount : 2));
      const sName = sFifty.name || "複眼透視";
      const wrongIndices = [];
      optionButtons.forEach((btn, idx) => {
        if (idx !== currentCorrectOptionIndex) {
          wrongIndices.push(idx);
        }
      });
      // 隨機打亂錯誤索引後剔除指定數量
      for (let i = wrongIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [wrongIndices[i], wrongIndices[j]] = [wrongIndices[j], wrongIndices[i]];
      }
      wrongIndices.slice(0, removeCount).forEach((wrongIdx) => {
        optionButtons[wrongIdx].classList.add("disabled");
        optionButtons[wrongIdx].disabled = true;
      });
      addLog(`【${sName}】發動！靈敏洞察排除干擾，排除了 ${removeCount} 個錯誤選項！`, "skill");
    }

    SoundFX.playSelect();
  }

  // 顯示戰鬥頂部大橫幅公告（提示答對、發動突進與絕技名稱）
  function showAnnouncementBanner(text, duration = 1400) {
    const banner = document.getElementById("battle-announcement-banner");
    if (!banner) return;
    banner.textContent = text;
    banner.classList.remove("hidden", "anim-banner-pop");
    void banner.offsetWidth; // 強制重繪
    banner.classList.add("anim-banner-pop");
    setTimeout(() => {
      banner.classList.add("hidden");
      banner.classList.remove("anim-banner-pop");
    }, duration);
  }

  // 處理玩家選擇答案
  function handleAnswer(selectedIndex) {
    if (currentState !== STATE.QUESTION) return;
    currentState = STATE.ANIMATING;

    const isCorrect = selectedIndex === currentCorrectOptionIndex;
    const optionButtons = document.querySelectorAll(".quiz-opt-btn");
    const optionLetters = ["A", "B", "C", "D"];

    // 標示選項色彩
    optionButtons.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === currentCorrectOptionIndex) {
        btn.classList.add("correct");
      } else if (idx === selectedIndex) {
        btn.classList.add("wrong");
      }
    });

    const chosenLetter = optionLetters[selectedIndex] || "A";
    const correctLetter = optionLetters[currentCorrectOptionIndex] || "A";
    const chosenText = currentShuffledOptions[selectedIndex] ? currentShuffledOptions[selectedIndex].text : "";
    const correctText = currentShuffledOptions[currentCorrectOptionIndex] ? currentShuffledOptions[currentCorrectOptionIndex].text : "";

    // 紀錄此題學生答題詳情
    if (currentQuestion) {
      studentAnswerHistory.push({
        questionId: currentQuestion.id,
        question: currentQuestion.question,
        options: currentShuffledOptions.map((o) => o.text),
        studentAnswer: chosenText,
        correctAnswer: correctText,
        isCorrect: isCorrect,
        explanation: currentQuestion.explanation || "",
        chapter: currentChapterIndex + 1,
        category: currentQuestion.category || "生態考驗"
      });
    }

    if (isCorrect) {
      SoundFX.playCorrectAttack();
      addLog(`【答對】生態智慧爆發！選項 (${chosenLetter}) 正確！`, "success");
      if (currentQuestion.explanation) {
        addLog(`💡 生態筆記：${currentQuestion.explanation}`, "info");
      }

      // 立即在畫面上方升起金光大橫幅，吸引目光看向上半部對決舞台
      showAnnouncementBanner(`🎯 回答正確！${player.name}發動${player.attackMoveName || "撲翼突進"}！`, 1600);

      // 亮綠燈 320ms 後收起題目面板，將上方場景區平滑切換成全畫面
      setTimeout(() => {
        document.getElementById("quiz-panel")?.classList.add("hidden");
        enterCinematicFullscreen();

        // 等候全畫面展開過渡（約 200ms），精準計算全螢幕身位並執行主角衝刺攻擊動畫
        setTimeout(() => {
          applyPlayerAttack(true);
        }, 200);
      }, 320);
    } else {
      SoundFX.playWrongHit();
      addLog(`【答錯】回答失誤！正解為 (${correctLetter}) ${correctText}`, "danger");
      if (currentQuestion.explanation) {
        addLog(`💡 生態筆記：${currentQuestion.explanation}`, "info");
      }
      setTimeout(() => {
        document.getElementById("quiz-panel")?.classList.add("hidden");
        applyPlayerAttack(false);
      }, 650);
    }
  }

  // 同步提交學生作答紀錄
  function saveStudentSessionRecord(clearedCount) {
    if (studentAnswerHistory.length === 0) return;

    const correctCount = studentAnswerHistory.filter((d) => d.isCorrect).length;
    const wrongCount = studentAnswerHistory.length - correctCount;

    DataManager.submitStudentRecord({
      score: player.score,
      level: player.level,
      clearedStages: clearedCount,
      totalAnswered: studentAnswerHistory.length,
      correctCount: correctCount,
      wrongCount: wrongCount,
      details: studentAnswerHistory
    });
  }

  // 生成 4 種隨機攻擊特效之一，並彈出傷害跳字（精準錨定魔王身軀）
  function playRandomAttackFX(targetDamage, isCrit) {
    // 優先使用魔王容器內的居中錨點
    let targetAnchor = document.getElementById("enemy-fx-anchor");
    if (!targetAnchor) {
      targetAnchor = document.getElementById("enemy-sprite-container") || document.getElementById("battle-fx-overlay");
    }
    if (!targetAnchor) return;

    // 清理舊殘留特效
    targetAnchor.innerHTML = "";

    // 隨機選擇 1~4 種特效 (支援測試指定)
    const fxType = (typeof window !== "undefined" && window.__override_fx)
      ? window.__override_fx
      : (Math.floor(Math.random() * 4) + 1);
    const fxContainer = document.createElement("div");
    fxContainer.style.position = "absolute";
    fxContainer.style.top = "50%";
    fxContainer.style.left = "50%";
    fxContainer.style.transform = "translate(-50%, -50%)";
    fxContainer.style.pointerEvents = "none";
    fxContainer.style.zIndex = "100";

    let bannerText = "";
    if (fxType === 1) {
      bannerText = "⚔️【極光幻紫斬】！";
      fxContainer.className = "fx-slash-container";
      fxContainer.innerHTML = `
        <div class="fx-slash-blade-1"></div>
        <div class="fx-slash-blade-2"></div>
        <div class="fx-slash-sparks"></div>
      `;
      addLog(`⚔️ 絕技爆發：【極光幻紫斬】！紫蝶十字光刃破空破防！`, "skill");
    } else if (fxType === 2) {
      bannerText = "🌪️【蝶羽旋風暴】！";
      fxContainer.className = "fx-tornado-container";
      fxContainer.innerHTML = `
        <div class="fx-tornado-body"></div>
        <div class="fx-butterfly-leaf" style="top:20%; left:30%;"></div>
        <div class="fx-butterfly-leaf" style="top:50%; left:60%; animation-delay:0.1s;"></div>
        <div class="fx-butterfly-leaf" style="top:70%; left:20%; animation-delay:0.2s;"></div>
      `;
      addLog(`🌪️ 絕技爆發：【蝶羽旋風暴】！青金雙色自然颶風狂暴席捲！`, "skill");
    } else if (fxType === 3) {
      bannerText = "💥【龍拳連環烈彈】！";
      fxContainer.className = "fx-kiblast-container";
      fxContainer.innerHTML = `
        <div class="fx-shockwave-ring"></div>
        <div class="fx-ki-ball" style="top:25px; left:30px; animation-delay:0s;"></div>
        <div class="fx-ki-ball" style="top:85px; left:110px; animation-delay:0.08s;"></div>
        <div class="fx-ki-ball" style="top:130px; left:45px; animation-delay:0.16s;"></div>
        <div class="fx-ki-ball" style="top:60px; left:150px; animation-delay:0.24s;"></div>
      `;
      addLog(`💥 絕技爆發：【龍拳連環烈彈】！鳥山明風金色能量彈連環爆轟！`, "skill");
    } else {
      bannerText = "⚡【天降紫極神雷】！";
      fxContainer.className = "fx-lightning-container";
      fxContainer.innerHTML = `
        <div class="fx-lightning-bolt"></div>
        <div class="fx-lightning-ground"></div>
      `;
      addLog(`⚡ 絕技爆發：【天降紫極神雷】！萬鈞金紫神雷自天頂霹靂貫穿！`, "skill");
    }

    // 橫幅更新為當前爆發招式
    showAnnouncementBanner(bannerText, 1200);

    targetAnchor.appendChild(fxContainer);

    // 彈出傷害數字 (位於魔王上方，超大醒目字體)
    const dmgPop = document.createElement("div");
    dmgPop.className = `damage-number-pop ${isCrit ? "crit" : ""}`;
    dmgPop.textContent = `-${targetDamage}${isCrit ? " 暴擊!" : ""}`;
    dmgPop.style.position = "absolute";
    dmgPop.style.top = "-70px";
    dmgPop.style.left = "0px";
    targetAnchor.appendChild(dmgPop);

    // 戰鬥舞台震撼震屏
    const visualStage = document.getElementById("battle-visual-container");
    if (visualStage) {
      visualStage.classList.remove("anim-screen-shake");
      void visualStage.offsetWidth;
      visualStage.classList.add("anim-screen-shake");
      setTimeout(() => visualStage.classList.remove("anim-screen-shake"), 400);
    }

    // 特效結束後自動清除
    setTimeout(() => {
      fxContainer.remove();
      dmgPop.remove();
    }, 900);
  }

  // 結算玩家攻擊或受到敵方反擊
  function applyPlayerAttack(isCorrect) {
    const playerSprite = document.getElementById("player-battle-sprite-container");
    const enemySprite = document.getElementById("enemy-sprite-container");
    const playerPanel = document.getElementById("player-status-panel");

    if (isCorrect) {
      // 1. 計算傷害數值 (支援各勇者被動暴擊率與專屬特技)
      let baseDmg = player.atk + Math.floor(Math.random() * 8);
      let isCrit = false;

      if (currentActionMode === "SKILL_CRIT") {
        const sCrit = (player.skills && player.skills[0]) || {};
        const mult = sCrit.multiplier !== undefined ? sCrit.multiplier : (player.critMultiplier || 2.2);
        baseDmg = Math.floor(baseDmg * mult);
        isCrit = true;
        const sName = sCrit.name || "暴擊特技";
        addLog(`【${sName}】威能爆發！傷害大幅躍升 ${mult} 倍！`, "highlight");
      } else if (Math.random() < (player.critRate || 0.15)) {
        baseDmg = Math.floor(baseDmg * 1.5);
        isCrit = true;
        addLog(`💥 致命弱點洞察！【${player.name}】觸發暴擊！造成 1.5 倍傷害！`, "highlight");
      } else if (currentActionMode === "SKILL_HEAL") {
        const sHeal = (player.skills && player.skills[1]) || {};
        const healAmt = sHeal.healAmount !== undefined ? sHeal.healAmount : (player.id === "hero_round" ? 55 : (player.id === "hero_syl" ? 35 : 45));
        const manaRec = sHeal.manaRecovery !== undefined ? sHeal.manaRecovery : (player.id === "hero_syl" ? 25 : 0);
        const sName = sHeal.name || "滋養特技";

        player.hp = Math.min(player.maxHp, player.hp + healAmt);
        if (manaRec > 0) {
          player.mp = Math.min(player.maxMp, player.mp + manaRec);
          addLog(`💧【${sName}】發動！回復了 ${healAmt} 點 HP 並回充了 ${manaRec} 點 MP！`, "skill");
        } else {
          addLog(`🌿【${sName}】發動！生命獲得滋養，回復了 ${healAmt} 點 HP！`, "skill");
        }
      }

      // 2. 精準動態計算突進身位：停在魔王左側 130px，形成完美格鬥身位，主角魔王雙方皆完全可見
      let targetDist = 380;
      if (playerSprite && enemySprite) {
        const pRect = playerSprite.getBoundingClientRect();
        const eRect = enemySprite.getBoundingClientRect();
        if (pRect && eRect && eRect.left > pRect.left) {
          targetDist = Math.max(140, Math.round(eRect.left - pRect.left - 130));
        }
      }

      // 3. 原生 Web Animations API 突進驅動（420ms，100% 絕對執行動畫，相容任何快取或樣式環境）
      playerSprite.classList.remove("anim-player-idle", "anim-player-dash-attack", "anim-player-dash-return");
      void playerSprite.offsetWidth;

      const dashAnimation = playerSprite.animate([
        { transform: "translate(0, 0) scale(1)", filter: "drop-shadow(0 0 10px rgba(116, 185, 255, 0.4))", offset: 0 },
        { transform: "translate(-25px, 6px) scale(0.96)", filter: "brightness(1.6) drop-shadow(0 0 25px #a29bfe)", offset: 0.22 },
        { transform: `translate(${targetDist}px, -12px) scale(1.18)`, filter: "brightness(2) drop-shadow(-15px 0 30px #9b59b6)", offset: 0.8 },
        { transform: `translate(${targetDist}px, -10px) scale(1.15)`, filter: "brightness(1.8) drop-shadow(0 0 25px #ffe066)", offset: 1 }
      ], {
        duration: 420,
        easing: "cubic-bezier(0.12, 0.88, 0.25, 1)",
        fill: "forwards"
      });

      dashAnimation.onfinish = () => {
        // 4. 到達魔王身前！爆發打擊音效、四大隨機招式特效之一、震屏與傷害跳字
        if (typeof SoundFX !== "undefined" && SoundFX.playAttackHit) {
          SoundFX.playAttackHit();
        }
        playRandomAttackFX(baseDmg, isCrit);

        // 魔王受擊劇烈晃動與鮮明受擊紅光（650ms，原生動畫絕對執行，細節清晰不白曝）
        enemySprite.classList.remove("anim-float");
        void enemySprite.offsetWidth;
        const hurtAnimation = enemySprite.animate([
          { transform: "translate(0, 0) scale(1)", filter: "brightness(1)", offset: 0 },
          { transform: "translate(24px, -12px) scale(0.92)", filter: "brightness(1.5) drop-shadow(0 0 35px #ff0000) contrast(130%)", offset: 0.12 },
          { transform: "translate(-24px, 14px) scale(1.08)", filter: "brightness(1.6) drop-shadow(0 0 45px #ff2a2a) contrast(140%)", offset: 0.28 },
          { transform: "translate(18px, -8px) scale(0.95)", filter: "brightness(1.4) drop-shadow(0 0 25px #ff4757)", offset: 0.44 },
          { transform: "translate(-14px, 6px) scale(1.04)", filter: "brightness(1.3) drop-shadow(0 0 15px #e74c3c)", offset: 0.6 },
          { transform: "translate(10px, -4px) scale(0.98)", filter: "brightness(1.2)", offset: 0.76 },
          { transform: "translate(-5px, 2px) scale(1.01)", filter: "brightness(1.1)", offset: 0.88 },
          { transform: "translate(0, 0) scale(1)", filter: "brightness(1)", offset: 1 }
        ], {
          duration: 650,
          easing: "ease-out"
        });

        // 扣除魔王血量並更新狀態
        enemy.hp = Math.max(0, enemy.hp - baseDmg);
        player.score += isCrit ? 200 : 100;
        player.exp += 30;

        // 升級檢查：屬性增強與上限擴展，增加上限與成長量，不粗暴將未過關時的殘血瞬間回滿
        if (player.exp >= player.level * 60) {
          player.level++;
          player.maxHp += 15;
          player.hp = Math.min(player.maxHp, player.hp + 15);
          player.maxMp += 10;
          player.mp = Math.min(player.maxMp, player.mp + 10);
          player.atk += 6;
          addLog(`★ 飛行階級提升！${player.name}升到了 Lv. ${player.level}！體能與戰鬥屬性大幅增強！`, "highlight");
        }

        updateUI();

        // 5. 在魔王身前停留打擊 680ms，給玩家充分欣賞招式特效與受擊反饋的時間！
        setTimeout(() => {
          // 主角後撤歸位（380ms 平滑退回左側）
          const returnAnimation = playerSprite.animate([
            { transform: `translate(${targetDist}px, -10px) scale(1.15)`, filter: "brightness(1.3)", offset: 0 },
            { transform: "translate(0, 0) scale(1)", filter: "brightness(1)", offset: 1 }
          ], {
            duration: 380,
            easing: "cubic-bezier(0.25, 0.8, 0.25, 1)",
            fill: "forwards"
          });

          returnAnimation.onfinish = () => {
            // 清理動畫實例，恢復待機懸浮
            dashAnimation.cancel();
            returnAnimation.cancel();
            playerSprite.style.transform = "";
            playerSprite.className = "player-battle-sprite-wrapper anim-player-idle";
            enemySprite.className = "enemy-sprite-wrapper anim-float";

            // 完成攻擊動畫後，平滑退出全畫面模式，切換回原答題/指令介面
            exitCinematicFullscreen();

            // 判斷魔王是否陣亡
            if (enemy.hp <= 0) {
              setTimeout(handleEnemyDefeated, 450);
              return;
            }

            // 回合平穩結束，平滑過渡回原操作選單
            setTimeout(() => {
              showCommandMenu();
            }, 380);
          };
        }, 680);
      };

    } else {
      // 答錯遭怪反擊 (計算勇者被動減傷)
      let enemyDmg = enemy.atk + Math.floor(Math.random() * 8);
      if (player.damageReduction && player.damageReduction > 0) {
        const reduced = Math.max(1, Math.round(enemyDmg * (1 - player.damageReduction)));
        addLog(`🛡️【${player.name}】被動護盾化解了部分衝擊！(減免 ${Math.round(player.damageReduction * 100)}% 傷害)`, "info");
        enemyDmg = reduced;
      }
      player.hp = Math.max(0, player.hp - enemyDmg);
      addLog(`${enemy.name} 發動環境阻礙反擊！對你造成了 ${enemyDmg} 點亂流衝擊傷害！`, "danger");

      // 玩家受擊特效
      if (playerPanel) {
        playerPanel.classList.add("anim-shake");
        setTimeout(() => playerPanel.classList.remove("anim-shake"), 600);
      }

      updateUI();

      // 判斷玩家是否死亡
      if (player.hp <= 0) {
        setTimeout(handleGameOver, 800);
        return;
      }

      // 回合結束，返回主選單
      setTimeout(() => {
        showCommandMenu();
      }, 600);
    }
  }

  // 擊敗當前敵人
  function handleEnemyDefeated() {
    stopBossPeriodicAttack();
    SoundFX.playVictory();
    addLog(`★★★ 突破！成功克服了 ${enemy.name} 的阻礙！順利開闢遷徙路徑！ ★★★`, "highlight");

    // 每一關過關後，勇者的血量自動完全補滿！
    player.hp = player.maxHp;
    updateUI();
    addLog(`💖 航段突破休憩！【${player.name}】的生命值已完全恢復滿血 (${player.maxHp}/${player.maxHp})！`, "success");

    // 保存當前作答紀錄進度
    saveStudentSessionRecord(currentChapterIndex + 1);

    // 通知大地圖系統解鎖
    if (typeof WorldMapSystem !== "undefined") {
      WorldMapSystem.onStageCleared(currentChapterIndex);
    }

    if (currentChapterIndex < chapterData.length - 1) {
      // 通關單一章節
      const nextTitle = chapterData[currentChapterIndex + 1].title;
      showModal(
        "關卡航段突破成功！",
        `紫蝶勇者【${player.name}】成功戰勝【${enemy.name}】的考驗！\n全隊獲得充分休憩，勇者體力已完全恢復滿血 (${player.maxHp}/${player.maxHp})！\n群蝶乘著春風繼續向北，大地圖上已解鎖下一航段：${nextTitle}。\n\n獲得冒險獎勵：生態積分 +500，經驗值 +100！`,
        "🗺️ 返回台灣大地圖",
        () => {
          if (typeof SoundFX !== "undefined" && SoundFX.stopBGM) SoundFX.stopBGM();
          document.getElementById("battle-screen").classList.add("hidden");
          WorldMapSystem.show();
        }
      );
    } else {
      // 全部通關！抵達繁衍聖林
      currentState = STATE.GAME_CLEAR;
      showClearScreen();
    }
  }

  // 遊戲結束
  function handleGameOver() {
    stopBossPeriodicAttack();
    if (typeof SoundFX !== "undefined" && SoundFX.stopBGM) SoundFX.stopBGM();
    SoundFX.playGameOver();
    currentState = STATE.GAME_OVER;
    addLog("小紫體力不支收起羽翼... 暫時於林間枝椏避風休息。", "danger");

    // 保存作答失敗時的紀錄
    saveStudentSessionRecord(currentChapterIndex);

    showModal("飛行中斷 (Game Over)", `狂風吹散了前行的路標...\n您的最終生態得分為：${player.score} 分。\n補充蜜露後再次展翅，春天必將指引北返的道路！`, "重新出發", () => {
      resetGame();
    });
  }

  // 顯示自訂彈出通知
  function showModal(title, bodyText, btnText, callback) {
    const modal = document.getElementById("game-alert-modal");
    document.getElementById("modal-alert-title").textContent = title;
    document.getElementById("modal-alert-body").textContent = bodyText;
    const okBtn = document.getElementById("modal-alert-ok-btn");
    okBtn.textContent = btnText;

    const clickHandler = () => {
      modal.classList.add("hidden");
      okBtn.removeEventListener("click", clickHandler);
      if (callback) callback();
    };
    okBtn.addEventListener("click", clickHandler);
    modal.classList.remove("hidden");
  }

  // 輔助函式：HTML 字元轉義
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // 完全通關紙花粒子特效控制器 (Ending Confetti System)
  let confettiAnimId = null;
  function startEndingConfetti() {
    const canvas = document.getElementById("ending-confetti-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#fde047", "#f59e0b", "#ec4899", "#38bdf8", "#10b981", "#a855f7", "#ffffff"];
    const particles = [];
    const particleCount = 110;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 9 + 5,
        h: Math.random() * 6 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: Math.random() * 3 - 1.5,
        vy: Math.random() * 2.5 + 2.2,
        rot: Math.random() * 360,
        rotSpeed: Math.random() * 4 - 2
      });
    }

    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotSpeed;

        if (p.y > canvas.height) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      confettiAnimId = requestAnimationFrame(render);
    }
    render();
  }

  function stopEndingConfetti() {
    if (confettiAnimId) {
      cancelAnimationFrame(confettiAnimId);
      confettiAnimId = null;
    }
    const canvas = document.getElementById("ending-confetti-canvas");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // 顯示五關完全通關大動畫與錯題複習看板 (Grand Ending Cutscene & Mistakes Review)
  let endingAutoSwitchTimer = null;
  function showClearScreen() {
    if (typeof SoundFX !== "undefined") {
      if (SoundFX.stopBGM) SoundFX.stopBGM();
      if (SoundFX.playGrandEndingFanfare) {
        SoundFX.playGrandEndingFanfare();
      } else if (SoundFX.playVictory) {
        SoundFX.playVictory();
      }
    }

    const clearModal = document.getElementById("game-clear-modal");
    const cutsceneView = document.getElementById("ending-cutscene-view");
    const reviewView = document.getElementById("ending-review-view");
    if (!clearModal) return;

    // 0. 動態套用四大紫斑蝶守護勇者最新自訂圖像至通關卡片
    if (typeof DataManager !== "undefined" && DataManager.updateEndingHeroesAvatars) {
      DataManager.updateEndingHeroesAvatars();
    }

    // 1. 先展示第一階段：四位勇者全體同框登場動畫層
    if (cutsceneView) cutsceneView.classList.remove("hidden");
    if (reviewView) reviewView.classList.add("hidden");

    // 重置勇者卡片動畫類別以觸發入場 Q 彈動效
    const heroCards = document.querySelectorAll(".ending-hero-card");
    heroCards.forEach((card, idx) => {
      card.style.animation = "none";
      void card.offsetWidth; // 強制重繪
      card.style.animation = "";
    });

    // 啟動彩帶紙花特效
    startEndingConfetti();
    clearModal.classList.remove("hidden");

    // 2. 切換至第二階段（結算與錯題複習）的函式
    function switchToReviewView() {
      if (endingAutoSwitchTimer) {
        clearTimeout(endingAutoSwitchTimer);
        endingAutoSwitchTimer = null;
      }
      if (cutsceneView) cutsceneView.classList.add("hidden");
      if (reviewView) reviewView.classList.remove("hidden");

      renderEndingReviewData();
    }

    // 綁定「略過動畫」與「查看結算」按鈕（手動點擊跳轉）
    const btnSkip = document.getElementById("btn-ending-skip");
    if (btnSkip) {
      btnSkip.onclick = () => {
        if (typeof SoundFX !== "undefined" && SoundFX.playClick) SoundFX.playClick();
        switchToReviewView();
      };
    }
    const btnContinue = document.getElementById("btn-ending-continue");
    if (btnContinue) {
      btnContinue.onclick = () => {
        if (typeof SoundFX !== "undefined" && SoundFX.playClick) SoundFX.playClick();
        switchToReviewView();
      };
    }

    // 取消自動定時跳轉：動畫播完後停留在畫面，由使用者手動點擊跳轉
    if (endingAutoSwitchTimer) {
      clearTimeout(endingAutoSwitchTimer);
      endingAutoSwitchTimer = null;
    }

    // 動畫入場完畢（約 1.5 秒後），更新底部提示引導玩家點擊
    const footerTextEl = document.getElementById("ending-footer-text");
    setTimeout(() => {
      if (footerTextEl && !reviewView.classList.contains("hidden")) {
        // 若已手動切換則不更新
        return;
      }
      if (footerTextEl) {
        footerTextEl.innerHTML = '<span class="pulse-sparkle">✨</span> 勇者凱旋大團圓！請點擊右方按鈕查看成果報告書 ➔';
      }
    }, 1600);

    // 3. 渲染結算數據與全歷程錯題清單
    function renderEndingReviewData() {
      // 學生姓名
      const stName = (typeof DataManager !== "undefined" && DataManager.getStudentName)
        ? DataManager.getStudentName()
        : "紫蝶小勇士";
      const studentNameEl = document.getElementById("ending-student-name");
      if (studentNameEl) studentNameEl.textContent = stName;

      // 分數與等級
      const scoreEl = document.getElementById("final-score-val");
      if (scoreEl) scoreEl.textContent = player.score;
      const levelEl = document.getElementById("final-level-val");
      if (levelEl) levelEl.textContent = `Lv. ${player.level}`;

      // 作答題數與正確率
      const totalQ = studentAnswerHistory.length;
      const correctQ = studentAnswerHistory.filter((d) => d.isCorrect).length;
      const wrongList = studentAnswerHistory.filter((d) => !d.isCorrect);
      const wrongQ = wrongList.length;
      const accuracy = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 100;

      const totalQEl = document.getElementById("ending-total-q-count");
      if (totalQEl) totalQEl.textContent = totalQ;
      const correctQEl = document.getElementById("ending-correct-q-count");
      if (correctQEl) correctQEl.textContent = correctQ;
      const wrongQEl = document.getElementById("ending-wrong-q-count");
      if (wrongQEl) wrongQEl.textContent = wrongQ;
      const accEl = document.getElementById("ending-accuracy-val");
      if (accEl) accEl.textContent = `${accuracy}%`;

      const progressFill = document.getElementById("ending-progress-bar-fill");
      if (progressFill) progressFill.style.width = `${accuracy}%`;

      // 錯題清單徽章
      const mistakesBadge = document.getElementById("ending-mistakes-badge");
      if (mistakesBadge) mistakesBadge.textContent = `共 ${wrongQ} 題`;

      // 渲染錯題清單容器
      const mistakesListEl = document.getElementById("ending-mistakes-list");
      if (mistakesListEl) {
        if (wrongQ === 0) {
          // 完美大滿貫！全對通關
          mistakesListEl.innerHTML = `
            <div class="ending-perfect-card">
              <div style="font-size: 42px;">👑🌟🎉</div>
              <div class="ending-perfect-title">🌟 完美大滿貫！大遷徙全對通關無錯題！</div>
              <div class="ending-perfect-desc">
                太不可思議了！你以百分之百的生態智慧突破五大航段的所有考驗！<br>
                所有題目全部答對，你是當之無愧的【紫斑蝶特級生態守護神】！
              </div>
            </div>
          `;
        } else {
          // 逐題渲染錯題卡片
          let html = "";
          wrongList.forEach((item, idx) => {
            html += `
              <div class="ending-mistake-item-card">
                <div class="ending-mistake-q-top">
                  <span class="ending-mistake-chapter-tag">第 ${item.chapter || 1} 關｜${escapeHtml(item.category || "生態考驗")}</span>
                  <span style="font-size: 11.5px; color: #fb7185; font-weight: bold;">錯題 #${idx + 1}</span>
                </div>
                <div class="ending-mistake-q-text">❓ ${escapeHtml(item.question)}</div>
                <div class="ending-mistake-answers-row">
                  <div class="ending-ans-chip ans-chip-wrong">❌ 你的作答：${escapeHtml(item.studentAnswer || "未作答/逾時")}</div>
                  <div class="ending-ans-chip ans-chip-correct">✅ 正確答案：${escapeHtml(item.correctAnswer)}</div>
                </div>
                ${
                  item.explanation
                    ? `<div class="ending-mistake-exp-box">💡 生態解析：${escapeHtml(item.explanation)}</div>`
                    : `<div class="ending-mistake-exp-box">💡 生態筆記：仔細記住正確答案，下次一定能答對！</div>`
                }
              </div>
            `;
          });
          mistakesListEl.innerHTML = html;
        }
      }

      // 4. 綁定通關操作三大按鈕
      // (1) 重新開始挑戰 (重置關卡)
      const btnRestart = document.getElementById("btn-ending-restart");
      if (btnRestart) {
        btnRestart.onclick = () => {
          if (typeof SoundFX !== "undefined" && SoundFX.playClick) SoundFX.playClick();
          const confirmed = confirm("確定要重新開始挑戰嗎？\n這將重置所有 5 個關卡，讓您重新從第一關【茂林幽谷】開始出發！");
          if (!confirmed) return;

          stopEndingConfetti();
          clearModal.classList.add("hidden");
          document.getElementById("battle-screen")?.classList.add("hidden");

          // 重置關卡與數值
          if (typeof WorldMapSystem !== "undefined" && WorldMapSystem.resetAllStages) {
            WorldMapSystem.resetAllStages();
          }
          studentAnswerHistory = [];
          usedQuestionIds = [];
          player = createPlayerFromHero();

          // 返回大地圖
          if (typeof WorldMapSystem !== "undefined") {
            WorldMapSystem.show();
          }
          if (typeof addLog === "function") {
            addLog("=== 冒險進度已完全重置，請自第一章重新啟程！ ===", "highlight");
          }
        };
      }

      // (2) 返回台灣大地圖 (保留通關狀態自由重玩)
      const btnToMap = document.getElementById("btn-ending-tomap");
      if (btnToMap) {
        btnToMap.onclick = () => {
          if (typeof SoundFX !== "undefined" && SoundFX.playClick) SoundFX.playClick();
          stopEndingConfetti();
          clearModal.classList.add("hidden");
          document.getElementById("battle-screen")?.classList.add("hidden");
          if (typeof WorldMapSystem !== "undefined") {
            WorldMapSystem.show();
          }
        };
      }

      // (3) 返回遊戲主選單
      const btnToHome = document.getElementById("btn-ending-tohome");
      if (btnToHome) {
        btnToHome.onclick = () => {
          if (typeof SoundFX !== "undefined" && SoundFX.playClick) SoundFX.playClick();
          stopEndingConfetti();
          clearModal.classList.add("hidden");
          document.getElementById("battle-screen")?.classList.add("hidden");
          document.getElementById("worldmap-screen")?.classList.add("hidden");
          document.getElementById("start-screen")?.classList.remove("hidden");
          const portalView = document.getElementById("start-portal-view");
          const setupView = document.getElementById("start-setup-view");
          if (portalView) portalView.classList.remove("hidden");
          if (setupView) setupView.classList.add("hidden");
        };
      }
    }
  }

  // 重置遊戲
  function resetGame() {
    player = createPlayerFromHero();
    usedQuestionIds = [];
    document.getElementById("game-clear-modal").classList.add("hidden");
    document.getElementById("game-alert-modal").classList.add("hidden");
    loadChapter(0);
  }

  return {
    // 啟動指定章節戰鬥（供大地圖呼叫）
    startChapter: function (chapterIndex, category = "全部") {
      selectedCategory = category;
      const curHeroId = (typeof DataManager !== "undefined" && DataManager.getCurrentHeroId) ? DataManager.getCurrentHeroId() : "hero_purple";
      const heroCfg = getSelectedHeroConfig();
      if (!player.id || player.id !== curHeroId || player.level === 1) {
        player = createPlayerFromHero();
      }
      // 強制同步最新勇者外觀（立繪、頭像）與技能設定
      if (heroCfg) {
        player.id = heroCfg.id;
        player.name = heroCfg.name;
        player.title = heroCfg.title;
        player.butterfly = heroCfg.butterfly;
        player.element = heroCfg.element;
        player.sprite = heroCfg.sprite;
        player.avatar = heroCfg.avatar;
        player.attackMoveName = heroCfg.attackMoveName;
        if (heroCfg.skills) {
          player.skills = JSON.parse(JSON.stringify(heroCfg.skills));
        }
      }

      // 無論先前戰況或殘血狀態如何，進入每一關生命值與魔力強制 100% 補滿，補給重置為各 2 次
      player.hp = player.maxHp;
      player.mp = player.maxMp;
      player.potions = { heal: 2, mana: 2 };
      document.getElementById("game-clear-modal").classList.add("hidden");
      document.getElementById("game-alert-modal").classList.add("hidden");
      loadChapter(chapterIndex);
    },

    // 啟動戰鬥（預設從第一章開始）
    start: function (category = "全部") {
      selectedCategory = category;
      resetGame();
    },

    // 選擇指令：攻擊
    cmdAttack: function () {
      SoundFX.playClick();
      presentQuestion("ATTACK");
    },

    // 選擇指令：技能選單
    cmdOpenSkillMenu: function () {
      SoundFX.playClick();
      document.getElementById("action-main-menu").classList.add("hidden");
      document.getElementById("action-skill-menu").classList.remove("hidden");
    },

    // 施放技能 (支援四大勇者專屬特技)
    castSkill: function (skillType) {
      SoundFX.playClick();
      const sCrit = (player.skills && player.skills[0]) || { name: "✨ 幻紫鱗光", cost: 15 };
      const sHeal = (player.skills && player.skills[1]) || { name: "🌿 甘露沐浴", cost: 10 };
      const sFifty = (player.skills && player.skills[2]) || { name: "👁️ 複眼透視", cost: 20 };

      if (skillType === "CRIT") {
        if (player.mp < sCrit.cost) {
          addLog(`MP 不足！無法施放【${sCrit.name}】(需 ${sCrit.cost} MP)`, "warning");
          return;
        }
        player.mp -= sCrit.cost;
        updateUI();
        SoundFX.playSkillCast();
        presentQuestion("SKILL_CRIT");
      } else if (skillType === "HEAL") {
        if (player.mp < sHeal.cost) {
          addLog(`MP 不足！無法施放【${sHeal.name}】(需 ${sHeal.cost} MP)`, "warning");
          return;
        }
        player.mp -= sHeal.cost;
        updateUI();
        SoundFX.playSkillCast();
        presentQuestion("SKILL_HEAL");
      } else if (skillType === "FIFTY") {
        if (player.mp < sFifty.cost) {
          addLog(`MP 不足！無法施放【${sFifty.name}】(需 ${sFifty.cost} MP)`, "warning");
          return;
        }
        player.mp -= sFifty.cost;
        updateUI();
        SoundFX.playSkillCast();
        presentQuestion("SKILL_FIFTY");
      }
    },

    // 選擇指令：道具選單
    cmdOpenItemMenu: function () {
      SoundFX.playClick();
      const btnHeal = document.getElementById("btn-item-heal");
      if (btnHeal && player.potions) {
        btnHeal.innerHTML = `<span>🧪 蜜源精華露 (立即恢復 50 HP) [剩餘 ${player.potions.heal} 次]</span>`;
        btnHeal.disabled = (player.potions.heal <= 0);
        btnHeal.style.opacity = (player.potions.heal <= 0) ? "0.5" : "1";
      }
      const btnMana = document.getElementById("btn-item-mana");
      if (btnMana && player.potions) {
        btnMana.innerHTML = `<span>💧 朝露活力滴劑 (立即恢復 40 MP) [剩餘 ${player.potions.mana} 次]</span>`;
        btnMana.disabled = (player.potions.mana <= 0);
        btnMana.style.opacity = (player.potions.mana <= 0) ? "0.5" : "1";
      }
      document.getElementById("action-main-menu").classList.add("hidden");
      document.getElementById("action-item-menu").classList.remove("hidden");
    },

    // 使用道具
    useItem: function (itemType) {
      if (itemType === "HEAL") {
        if (player.potions.heal <= 0) {
          addLog("蜜源精華露已經用完了！", "warning");
          return;
        }
        player.potions.heal--;
        const amt = 50;
        player.hp = Math.min(player.maxHp, player.hp + amt);
        SoundFX.playPotion();
        addLog(`使用了蜜源精華露，恢復了 ${amt} 點生命值！`, "success");
        updateUI();
        showCommandMenu();
      } else if (itemType === "MANA") {
        if (player.potions.mana <= 0) {
          addLog("朝露活力滴劑已經用完了！", "warning");
          return;
        }
        player.potions.mana--;
        const amt = 40;
        player.mp = Math.min(player.maxMp, player.mp + amt);
        SoundFX.playPotion();
        addLog(`使用了朝露活力滴劑，恢復了 ${amt} 點魔力值！`, "skill");
        updateUI();
        showCommandMenu();
      }
    },

    // 回到主指令選單
    backToMainMenu: function () {
      SoundFX.playClick();
      showCommandMenu();
    },

    // 逃跑至大地圖
    cmdEscape: function () {
      SoundFX.playClick();
      if (confirm("確定要暫時撤退回到艾瑟爾加德大地圖嗎？")) {
        stopBossPeriodicAttack();
        if (typeof SoundFX !== "undefined" && SoundFX.stopBGM) SoundFX.stopBGM();
        document.getElementById("battle-screen").classList.add("hidden");
        WorldMapSystem.show();
      }
    },

    // 點擊答案選項
    selectOption: function (index) {
      handleAnswer(index);
    },

    // 觸發完全通關畫面 (供通關展示與測試)
    showClearScreen: function () {
      stopBossPeriodicAttack();
      showClearScreen();
    },

    // 即時刷新戰鬥中出戰主角立繪與頭像 (供自訂圖片即時套用)
    refreshPlayerVisuals: function () {
      const heroCfg = getSelectedHeroConfig();
      if (heroCfg) {
        player.id = heroCfg.id;
        player.name = heroCfg.name;
        player.title = heroCfg.title;
        player.butterfly = heroCfg.butterfly;
        player.element = heroCfg.element;
        player.sprite = heroCfg.sprite;
        player.avatar = heroCfg.avatar;
      }
      const playerImg = document.getElementById("player-battle-sprite-img");
      if (playerImg && player.sprite) {
        playerImg.src = player.sprite;
      }
      const playerAvatar = document.getElementById("player-hud-avatar-img");
      if (playerAvatar && player.avatar) {
        playerAvatar.src = player.avatar;
      }
      const hudName = document.getElementById("player-hud-name");
      if (hudName) {
        hudName.textContent = `${player.name} (${player.title})`;
      }
    },

    // 設定作答歷程 (供測試或歷史重載)
    setAnswerHistory: function (history) {
      studentAnswerHistory = history;
    },

    // 魔王定時攻擊手動控制與狀態查詢 (供自動化測試與外部串接)
    startBossPeriodicAttack: startBossPeriodicAttack,
    stopBossPeriodicAttack: stopBossPeriodicAttack,
    executeBossAttackOnPlayer: executeBossAttackOnPlayer,
    isBossPeriodicActive: function () {
      return !!bossPeriodicTimer;
    },
    getBossAttackTimeLeft: function () {
      return bossAttackTimeLeft;
    },
    getBossAttackInterval: function () {
      return bossAttackInterval;
    },
    // 觸發當前關卡勝利突破 (供測試與通關結算調用)
    triggerStageVictory: function () {
      enemy.hp = 0;
      handleEnemyDefeated();
    }
  };
})();

// 掛載至全域變數，確保兼顧各種呼叫相容性
window.BattleEngine = BattleEngine;
window.BattleSystem = BattleEngine;


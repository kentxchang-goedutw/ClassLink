/**
 * 《紫斑之翼：奇幻大遷徙》- 主程式流程與事件控制中心
 * 支援學生姓名輸入、主題測驗遊戲選擇、多組題庫主題分類派送、學生作答詳情與錯題自動打包
 */

document.addEventListener("DOMContentLoaded", async function () {
  console.log("《紫斑之翼：奇幻大遷徙》遊戲系統初始化中...");

  // 1. 初始化題庫資料、主題測驗與作答紀錄
  await DataManager.init();

  // 2. 初始化世界大地圖系統
  if (typeof WorldMapSystem !== "undefined") {
    WorldMapSystem.init();
  }

  // 3. 渲染主畫面四大紫斑蝶生態勇者選擇卡片
  renderHeroSelectionGrid();

  // 4. 填充主畫面主題測驗下拉選單
  populateExamSelect();

  // 5. 綁定按鈕與互動事件
  bindUIEvents();
});

// 渲染主畫面四大紫斑蝶生態勇者選擇卡片
function renderHeroSelectionGrid() {
  const container = document.getElementById("hero-selection-grid");
  if (!container || !DataManager.getHeroes) return;

  const heroes = DataManager.getHeroes();
  const currentHeroId = DataManager.getCurrentHeroId();
  container.innerHTML = "";

  heroes.forEach((hero) => {
    const card = document.createElement("div");
    card.className = `hero-card ${hero.id === currentHeroId ? "selected" : ""}`;
    card.dataset.heroId = hero.id;

    card.innerHTML = `
      <div class="hero-card-avatar">
        <img src="${hero.avatar}" alt="${hero.name}">
      </div>
      <div class="hero-card-name">${hero.name}</div>
      <div class="hero-card-title">${hero.title}</div>
      <div class="hero-card-elem" style="background-color: ${hero.badgeColor || '#6c5ce7'}">${hero.element}</div>
      <div class="hero-card-rhyme">${hero.rhyme}</div>
      <div class="hero-card-stats">
        <span>HP <strong>${hero.hp}</strong></span>
        <span>MP <strong>${hero.mp}</strong></span>
        <span>攻 <strong>${hero.atk}</strong></span>
      </div>
    `;

    card.addEventListener("click", () => {
      DataManager.setCurrentHeroId(hero.id);
      document.querySelectorAll(".hero-card").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      SoundFX.playSelect();

      // 更新口訣標籤與詳情面板
      const rhymeEl = document.getElementById("selected-hero-rhyme");
      if (rhymeEl) rhymeEl.textContent = `口訣：${hero.rhyme}`;
      updateHeroDetailSummary(hero);
    });

    container.appendChild(card);
  });

  const selectedHero = DataManager.getCurrentHero();
  const rhymeEl = document.getElementById("selected-hero-rhyme");
  if (rhymeEl && selectedHero) rhymeEl.textContent = `口訣：${selectedHero.rhyme}`;
  updateHeroDetailSummary(selectedHero);

  // 同步更新通關動畫區四大勇者卡片之自訂圖像
  if (typeof DataManager !== "undefined" && DataManager.updateEndingHeroesAvatars) {
    DataManager.updateEndingHeroesAvatars();
  }

  // 同步更新對戰畫面中勇者立繪與頭像
  if (typeof BattleSystem !== "undefined" && BattleSystem.refreshPlayerVisuals) {
    BattleSystem.refreshPlayerVisuals();
  }
}

// 更新當前選中勇者之詳細屬性與特技面板（精煉緊湊版）
function updateHeroDetailSummary(hero) {
  const detailContainer = document.getElementById("hero-detail-summary");
  if (!detailContainer || !hero) return;

  const critPercent = Math.round(hero.critRate * 100);
  const defPercent = Math.round((hero.damageReduction || 0) * 100);
  const traitText = critPercent > 15 
    ? `🎯 暴擊率 ${critPercent}%（${hero.critMultiplier}倍傷）` 
    : defPercent > 0 
      ? `🛡️ 磐石被動減傷 ${defPercent}%` 
      : `✨ 敏捷平衡（暴擊 ${critPercent}%）`;

  let skillsHtml = "";
  if (hero.skills && hero.skills.length > 0) {
    skillsHtml = hero.skills
      .map(
        (s) => `
        <div class="detail-skill-pill">
          <div class="skill-pill-top">
            <span class="skill-pill-name">${s.name}</span>
            <span class="skill-pill-cost">${s.cost} MP</span>
          </div>
          <div class="skill-pill-desc">${s.desc}</div>
        </div>`
      )
      .join("");
  }

  detailContainer.innerHTML = `
    <div class="detail-row-compact">
      <span class="detail-hero-title">🌟 <strong>${hero.title} ${hero.name}</strong>（${hero.butterfly}）</span>
      <span class="detail-hero-trait" style="color: ${hero.elementColor || '#ffe066'}">${traitText}</span>
    </div>
    <div class="detail-skills-grid">
      ${skillsHtml}
    </div>
  `;
}

// 填充主畫面主題測驗下拉選單（嚴格過濾：僅列出啟用中 active !== false 的主題）
function populateExamSelect() {
  const examSelect = document.getElementById("exam-select");
  const examInfoHint = document.getElementById("exam-info-hint");
  if (!examSelect) return;

  const allExams = DataManager.getExams();
  // 嚴格過濾：僅保留啟用中的主題測驗
  const activeExams = allExams.filter((e) => e.active !== false);

  examSelect.innerHTML = "";

  if (activeExams.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = allExams.length > 0
      ? "（⚠️ 所有主題測驗皆已被教師停用，不可選用）"
      : "（暫無主題測驗，請教師至後台派送）";
    examSelect.appendChild(opt);
    DataManager.setCurrentExamId("");
    if (examInfoHint) {
      examInfoHint.innerHTML = allExams.length > 0
        ? `<span style="color: #ff6b81; font-weight: bold;">⚠️ 教師已將所有主題測驗設定為停用！學生暫無法開始挑戰，請通知老師至後台開啟啟用。</span>`
        : "請點擊下方「⚙️ 教師 / 管理者題庫後台」勾選題庫並發布測驗。";
    }
    return;
  }

  activeExams.forEach((exam) => {
    const opt = document.createElement("option");
    opt.value = exam.id;
    opt.textContent = `🎯 【${exam.category || "主題"}】${exam.title} (${exam.questionCount || 0} 題)`;
    examSelect.appendChild(opt);
  });

  // 設定當前選中之測驗（確保所選測驗一定是啟用中的）
  const currentExamId = DataManager.getCurrentExamId();
  if (currentExamId && activeExams.some((e) => e.id === currentExamId)) {
    examSelect.value = currentExamId;
  } else {
    // 原選取測驗若被停用或不存在，自動切換至第一筆啟用之測驗
    examSelect.value = activeExams[0].id;
    DataManager.setCurrentExamId(activeExams[0].id);
  }

  updateExamHint();

  // 監聽切換事件
  examSelect.onchange = function () {
    DataManager.setCurrentExamId(this.value);
    updateExamHint();
    SoundFX.playClick();
  };
}

// 更新主畫面當前選中測驗之說明標籤
function updateExamHint() {
  const examSelect = document.getElementById("exam-select");
  const examInfoHint = document.getElementById("exam-info-hint");
  if (!examSelect || !examInfoHint) return;

  const examId = examSelect.value;
  if (!examId) return;

  const exam = DataManager.getExamById(examId);

  if (exam && exam.active !== false) {
    examInfoHint.innerHTML = `📌 <strong>分類：</strong>${escapeHtml(exam.category || "綜合生態")} ｜ <strong>涵蓋：</strong>${exam.bankIds ? exam.bankIds.length : 0} 組題庫 (共 ${exam.questionCount || 0} 題)<br>📝 <strong>說明：</strong>${escapeHtml(exam.description || "全島大遷徙生態挑戰")}`;
  } else {
    examInfoHint.textContent = "";
  }
}

// 填充題庫分類下拉選單
function populateCategorySelect() {
  const categorySelect = document.getElementById("category-select");
  if (!categorySelect) return;

  const categories = DataManager.getCategories();
  categorySelect.innerHTML = '<option value="全部">全部領域 (綜合挑戰)</option>';

  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = `${cat} 題庫`;
    categorySelect.appendChild(opt);
  });
}

// 綁定所有使用者介面操作
function bindUIEvents() {
  // 點擊解鎖音訊
  document.addEventListener("click", () => SoundFX.unlock(), { once: true });

  // 靜音切換按鈕
  const muteBtn = document.getElementById("btn-toggle-sound");
  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      const isMuted = SoundFX.toggleMute();
      muteBtn.textContent = isMuted ? "🔇 靜音中" : "🔊 音效開啟";
      muteBtn.classList.toggle("active", isMuted);
    });
  }

  // --- 主畫面按鈕 ---
  // 開始遊戲 -> 驗證學生身分後進入台灣大地圖
  const startBtn = document.getElementById("btn-start-game");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      const nameInput = document.getElementById("student-name-input");
      const studentName = nameInput ? nameInput.value.trim() : "";

      if (!studentName) {
        SoundFX.playWrongHit();
        alert("請先輸入學生姓名或座號，才能開始遊戲哦！");
        if (nameInput) nameInput.focus();
        return;
      }

      const examSelect = document.getElementById("exam-select");
      const selectedExamId = examSelect ? examSelect.value : null;

      if (!selectedExamId) {
        SoundFX.playWrongHit();
        alert("目前尚無可遊玩的主題測驗，請教師先至後台派送測驗！");
        return;
      }

      // 儲存學生資訊與測驗選擇
      DataManager.setStudentName(studentName);
      DataManager.setCurrentExamId(selectedExamId);

      // 取得選定勇者並更新大地圖上的勇者頭像與標籤
      const currentHero = DataManager.getCurrentHero();
      const mapAvatarImg = document.getElementById("map-player-avatar-img");
      if (mapAvatarImg && currentHero) {
        mapAvatarImg.src = currentHero.avatar;
      }
      const nameTag = document.querySelector(".map-player-name-tag");
      if (nameTag && currentHero) {
        nameTag.textContent = `${currentHero.name}：${studentName}`;
      }

      SoundFX.playSelect();
      WorldMapSystem.show();
    });
  }

  // --- 主畫面門戶雙按鈕與角色整備主題選擇切換 ---
  const startPortalView = document.getElementById("start-portal-view");
  const startSetupView = document.getElementById("start-setup-view");
  const btnPortalEnterGame = document.getElementById("btn-portal-enter-game");
  const btnPortalOpenAdmin = document.getElementById("btn-portal-open-admin");
  const btnSetupBackToPortal = document.getElementById("btn-setup-back-to-portal");

  // 點擊「進入遊戲」：展開角色整備與主題選擇畫面
  btnPortalEnterGame?.addEventListener("click", () => {
    SoundFX.playSelect();
    if (startPortalView && startSetupView) {
      startPortalView.classList.add("hidden");
      startSetupView.classList.remove("hidden");
      populateExamSelect();
      const nameInput = document.getElementById("student-name-input");
      if (nameInput) {
        setTimeout(() => nameInput.focus(), 150);
      }
    }
  });

  // 點擊「返回主選單」：從角色整備退回二按鈕門戶畫面
  btnSetupBackToPortal?.addEventListener("click", () => {
    SoundFX.playClick();
    if (startPortalView && startSetupView) {
      startSetupView.classList.add("hidden");
      startPortalView.classList.remove("hidden");
    }
  });

  // 大地圖工具列：返回主選單 (確保回到二按鈕門戶狀態)
  document.getElementById("btn-map-to-title")?.addEventListener("click", () => {
    SoundFX.playClick();
    document.getElementById("worldmap-screen").classList.add("hidden");
    document.getElementById("start-screen").classList.remove("hidden");
    if (startPortalView && startSetupView) {
      startPortalView.classList.remove("hidden");
      startSetupView.classList.add("hidden");
    }
    populateExamSelect();
  });

  // 大地圖工具列：快速開啟題庫後台
  document.getElementById("btn-map-admin")?.addEventListener("click", () => {
    SoundFX.playClick();
    document.getElementById("admin-modal").classList.remove("hidden");
    refreshAdminUI();
  });

  // 管理者後台入口按鈕 (主畫面門戶與歷史按鈕相容)
  const adminOpenBtn = document.getElementById("btn-open-admin");
  const adminModal = document.getElementById("admin-modal");
  const adminCloseBtn = document.getElementById("btn-close-admin");

  btnPortalOpenAdmin?.addEventListener("click", () => {
    SoundFX.playClick();
    adminModal?.classList.remove("hidden");
    refreshAdminUI();
  });

  if (adminOpenBtn && adminModal) {
    adminOpenBtn.addEventListener("click", () => {
      SoundFX.playClick();
      adminModal.classList.remove("hidden");
      refreshAdminUI();
    });
  }

  if (adminCloseBtn && adminModal) {
    adminCloseBtn.addEventListener("click", () => {
      SoundFX.playClick();
      adminModal.classList.add("hidden");
      populateExamSelect();
    });
  }

  // --- 後台 Tab 切換 ---
  const tabBtnBanks = document.getElementById("tab-btn-banks");
  const tabBtnExams = document.getElementById("tab-btn-exams");
  const tabBtnRecords = document.getElementById("tab-btn-records");
  const tabBtnStorage = document.getElementById("tab-btn-storage");
  const tabBtnHeroes = document.getElementById("tab-btn-heroes");
  const tabBtnImages = document.getElementById("tab-btn-images");

  const tabPanelBanks = document.getElementById("tab-panel-banks");
  const tabPanelExams = document.getElementById("tab-panel-exams");
  const tabPanelRecords = document.getElementById("tab-panel-records");
  const tabPanelStorage = document.getElementById("tab-panel-storage");
  const tabPanelHeroes = document.getElementById("tab-panel-heroes");
  const tabPanelImages = document.getElementById("tab-panel-images");

  function switchTab(target) {
    SoundFX.playClick();
    [tabBtnBanks, tabBtnExams, tabBtnRecords, tabBtnStorage, tabBtnHeroes, tabBtnImages].forEach((btn) => btn?.classList.remove("active"));
    [tabPanelBanks, tabPanelExams, tabPanelRecords, tabPanelStorage, tabPanelHeroes, tabPanelImages].forEach((panel) => panel?.classList.add("hidden"));

    if (target === "banks") {
      tabBtnBanks?.classList.add("active");
      tabPanelBanks?.classList.remove("hidden");
      renderCategoryChips();
      renderBankList();
    } else if (target === "exams") {
      tabBtnExams?.classList.add("active");
      tabPanelExams?.classList.remove("hidden");
      renderExamList();
    } else if (target === "records") {
      tabBtnRecords?.classList.add("active");
      tabPanelRecords?.classList.remove("hidden");
      renderRecordsUI();
    } else if (target === "storage") {
      tabBtnStorage?.classList.add("active");
      tabPanelStorage?.classList.remove("hidden");
      renderStorageGuideUI();
    } else if (target === "heroes") {
      tabBtnHeroes?.classList.add("active");
      tabPanelHeroes?.classList.remove("hidden");
      renderHeroAndBossConfigUI();
    } else if (target === "images") {
      tabBtnImages?.classList.add("active");
      tabPanelImages?.classList.remove("hidden");
      renderImagesManagementUI();
    }
  }

  tabBtnBanks?.addEventListener("click", () => switchTab("banks"));
  tabBtnExams?.addEventListener("click", () => switchTab("exams"));
  tabBtnRecords?.addEventListener("click", () => switchTab("records"));
  tabBtnStorage?.addEventListener("click", () => switchTab("storage"));
  tabBtnHeroes?.addEventListener("click", () => switchTab("heroes"));
  tabBtnImages?.addEventListener("click", () => switchTab("images"));

  // --- Tab 3 內部雙檢視切換 (學生作答列表 vs 錯題深度分析) ---
  const viewBtnStudents = document.getElementById("view-btn-students");
  const viewBtnMistakes = document.getElementById("view-btn-mistakes");
  const cardStatMistakes = document.getElementById("card-stat-mistakes");

  viewBtnStudents?.addEventListener("click", () => {
    SoundFX.playClick();
    switchRecordsSubView("students");
  });

  viewBtnMistakes?.addEventListener("click", () => {
    SoundFX.playClick();
    switchRecordsSubView("mistakes");
  });

  cardStatMistakes?.addEventListener("click", () => {
    SoundFX.playClick();
    switchRecordsSubView("mistakes");
  });

  document.getElementById("btn-refresh-storage")?.addEventListener("click", () => {
    SoundFX.playClick();
    renderStorageGuideUI();
  });

  // 派送折疊面板按鈕
  const btnShowDispatch = document.getElementById("btn-show-dispatch-modal");
  const dispatchPanel = document.getElementById("dispatch-exam-panel");
  const btnCancelDispatch = document.getElementById("btn-cancel-dispatch");
  const btnConfirmDispatch = document.getElementById("btn-confirm-dispatch");

  if (btnShowDispatch && dispatchPanel) {
    btnShowDispatch.addEventListener("click", () => {
      SoundFX.playClick();
      dispatchPanel.classList.toggle("hidden");
      if (!dispatchPanel.classList.contains("hidden")) {
        const titleInput = document.getElementById("dispatch-exam-title");
        if (titleInput && !titleInput.value) {
          titleInput.value = `紫斑蝶生態主題測驗 (${new Date().toLocaleDateString("zh-TW")})`;
        }
      }
    });
  }

  if (btnCancelDispatch && dispatchPanel) {
    btnCancelDispatch.addEventListener("click", () => {
      SoundFX.playClick();
      dispatchPanel.classList.add("hidden");
    });
  }

  // 確認發布主題測驗
  if (btnConfirmDispatch) {
    btnConfirmDispatch.addEventListener("click", async () => {
      const titleInput = document.getElementById("dispatch-exam-title");
      const catInput = document.getElementById("dispatch-exam-category");
      const descInput = document.getElementById("dispatch-exam-desc");

      const title = titleInput.value.trim();
      const category = catInput.value.trim() || "綜合生態";
      const desc = descInput.value.trim();

      // 取得當前勾選的題庫 ID
      const checkedBankBoxes = document.querySelectorAll(".bank-checkbox:checked");
      const selectedBankIds = Array.from(checkedBankBoxes).map((cb) => cb.dataset.bankId);

      if (selectedBankIds.length === 0) {
        alert("請先在下方題庫列表中勾選至少一組題庫！");
        return;
      }

      try {
        const newExam = await AdminSystem.dispatchNewExam(title, category, desc, selectedBankIds);
        SoundFX.playSelect();
        alert(`🎉 成功派送主題測驗【${newExam.title}】！學生現在可以在主畫面選取挑戰。`);
        dispatchPanel.classList.add("hidden");
        titleInput.value = "";
        descInput.value = "";
        populateExamSelect();
        switchTab("exams");
      } catch (err) {
        alert("派送測驗失敗：" + err.message);
      }
    });
  }

  // --- 戰鬥主指令按鈕 ---
  document.getElementById("btn-cmd-attack")?.addEventListener("click", () => BattleEngine.cmdAttack());
  document.getElementById("btn-cmd-skill")?.addEventListener("click", () => BattleEngine.cmdOpenSkillMenu());
  document.getElementById("btn-cmd-item")?.addEventListener("click", () => BattleEngine.cmdOpenItemMenu());
  document.getElementById("btn-cmd-run")?.addEventListener("click", () => BattleEngine.cmdEscape());

  // 技能選單按鈕
  document.getElementById("btn-skill-crit")?.addEventListener("click", () => BattleEngine.castSkill("CRIT"));
  document.getElementById("btn-skill-heal")?.addEventListener("click", () => BattleEngine.castSkill("HEAL"));
  document.getElementById("btn-skill-fifty")?.addEventListener("click", () => BattleEngine.castSkill("FIFTY"));
  document.getElementById("btn-skill-back")?.addEventListener("click", () => BattleEngine.backToMainMenu());

  // 道具選單按鈕
  document.getElementById("btn-item-heal")?.addEventListener("click", () => BattleEngine.useItem("HEAL"));
  document.getElementById("btn-item-mana")?.addEventListener("click", () => BattleEngine.useItem("MANA"));
  document.getElementById("btn-item-back")?.addEventListener("click", () => BattleEngine.backToMainMenu());

  // 四選一題目選項按鈕
  document.querySelectorAll(".quiz-opt-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const optIdx = parseInt(this.dataset.index, 10);
      BattleEngine.selectOption(optIdx);
    });
  });

  // 通關重啟返回大地圖
  document.getElementById("btn-clear-restart")?.addEventListener("click", () => {
    SoundFX.playClick();
    document.getElementById("game-clear-modal").classList.add("hidden");
    document.getElementById("battle-screen").classList.add("hidden");
    WorldMapSystem.show();
  });

  // 學生答題詳情 Modal 關閉
  document.getElementById("btn-close-student-detail")?.addEventListener("click", () => {
    SoundFX.playClick();
    document.getElementById("student-detail-modal").classList.add("hidden");
  });

  // --- 管理者後台操作事件 ---
  // 密碼登入
  const adminLoginBtn = document.getElementById("btn-admin-login");
  if (adminLoginBtn) {
    adminLoginBtn.addEventListener("click", () => {
      const pwdInput = document.getElementById("admin-password-input");
      if (AdminSystem.verifyPassword(pwdInput.value)) {
        SoundFX.playSelect();
        pwdInput.value = "";
        refreshAdminUI();
      } else {
        SoundFX.playWrongHit();
        alert("密碼不正確！請重新輸入。（預設密碼為：admin）");
      }
    });
  }

  // 一鍵複製 Gemini AI 出題 Prompt
  const copyPromptBtn = document.getElementById("btn-copy-ai-prompt");
  if (copyPromptBtn) {
    copyPromptBtn.addEventListener("click", async () => {
      const promptTextEl = document.getElementById("ai-prompt-template-text");
      if (!promptTextEl) return;
      const textToCopy = promptTextEl.innerText || promptTextEl.textContent;

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(textToCopy);
        } else {
          // 降級處理
          const tempTa = document.createElement("textarea");
          tempTa.value = textToCopy;
          tempTa.style.position = "fixed";
          tempTa.style.left = "-9999px";
          document.body.appendChild(tempTa);
          tempTa.select();
          document.execCommand("copy");
          document.body.removeChild(tempTa);
        }

        SoundFX.playSelect();
        const originalText = copyPromptBtn.innerHTML;
        copyPromptBtn.classList.add("copied");
        copyPromptBtn.innerHTML = "✅ 已複製出題 Prompt！請至 Gemini 貼上";
        setTimeout(() => {
          copyPromptBtn.classList.remove("copied");
          copyPromptBtn.innerHTML = originalText;
        }, 2200);
      } catch (err) {
        console.error("複製失敗:", err);
        alert("複製失敗，請手動框選複製上方提示詞文字。");
      }
    });
  }

  // 匯入新題庫組按鈕 (支援分類)
  const importBtn = document.getElementById("btn-create-bank");
  if (importBtn) {
    importBtn.addEventListener("click", async () => {
      const bankName = document.getElementById("admin-bank-name").value;
      const bankCat = document.getElementById("admin-bank-category")?.value || "綜合生態";
      const bankDesc = document.getElementById("admin-bank-desc").value;
      const csvText = document.getElementById("admin-csv-textarea").value;

      if (!csvText.trim()) {
        alert("請輸入或貼上 CSV 題庫內容！");
        return;
      }

      const res = await AdminSystem.importAsNewBank(bankName, bankCat, bankDesc, csvText);
      alert(res.message);
      if (res.success) {
        document.getElementById("admin-bank-name").value = "";
        if (document.getElementById("admin-bank-category")) {
          document.getElementById("admin-bank-category").value = "";
        }
        document.getElementById("admin-bank-desc").value = "";
        document.getElementById("admin-csv-textarea").value = "";
        refreshAdminUI();
        populateExamSelect();
      }
    });
  }

  // 載入示範 CSV 題目
  const loadSampleBtn = document.getElementById("btn-load-sample-csv");
  if (loadSampleBtn) {
    loadSampleBtn.addEventListener("click", async () => {
      try {
        const resp = await fetch("/api/sample-csv");
        if (resp.ok) {
          const sampleText = await resp.text();
          document.getElementById("admin-csv-textarea").value = sampleText;
          if (!document.getElementById("admin-bank-name").value) {
            document.getElementById("admin-bank-name").value = "紫斑蝶生態大遷徙題庫";
          }
          if (document.getElementById("admin-bank-category") && !document.getElementById("admin-bank-category").value) {
            document.getElementById("admin-bank-category").value = "生態環境篇";
          }
        }
        SoundFX.playSelect();
      } catch (err) {
        document.getElementById("admin-csv-textarea").value =
          "台灣哪一個地區以世界級數十萬隻紫斑蝶越冬聚集而聞名?,1,高雄茂林,花蓮太魯閣,南投清境,新北陽明山\n" +
          "斯氏紫斑蝶幼蟲的主要寄主食草是哪種植物?,1,羊角藤,桑樹,咸豐草,馬櫻丹\n" +
          "國道三號林內段架設多少公尺高的防護網保護紫斑蝶?,1,4公尺高防護網,1公尺矮木樁,10公尺水泥防風牆,未架設設施";
      }
    });
  }

  // 錯題打包按鈕 (Tab 3)
  const packMistakesBtn = document.getElementById("btn-pack-mistakes");
  if (packMistakesBtn) {
    packMistakesBtn.addEventListener("click", async () => {
      const examFilter = document.getElementById("record-exam-filter")?.value || "ALL";
      const exam = (examFilter !== "ALL") ? DataManager.getExamById(examFilter) : null;
      const examTitle = exam ? exam.title : "全主題測驗綜合";

      const defaultName = exam ? `${examTitle} - 學生錯題重溫本` : `全測驗學生錯題總複習本`;
      const customName = prompt(`即將將【${examTitle}】的所有學生答錯題目打包為新題庫。\n請確認或修改新題庫名稱：`, defaultName);
      if (!customName) return;

      try {
        const result = await AdminSystem.packMistakesToNewBank(examFilter, customName);
        const newBank = (result && result.bank) ? result.bank : result;
        const bankName = (newBank && newBank.name) ? newBank.name : (result && result.name ? result.name : customName);
        const questionCount = (newBank && Array.isArray(newBank.questions))
          ? newBank.questions.length
          : ((result && result.questionCount) || (result && Array.isArray(result.questions) ? result.questions.length : 0));

        SoundFX.playSelect();
        alert(`🎉 打包成功！已建立新題庫【${bankName}】（共收錄 ${questionCount} 道錯題）。\n系統已切換至「題庫管理」，您可以將此題庫重新勾選派送給學生強化複習！`);
        switchTab("banks");
      } catch (err) {
        alert("錯題打包失敗：" + (err.message || err));
      }
    });
  }

  // 清空學生作答紀錄按鈕 (Tab 3)
  const clearRecordsBtn = document.getElementById("btn-clear-records");
  if (clearRecordsBtn) {
    clearRecordsBtn.addEventListener("click", async () => {
      const examFilter = document.getElementById("record-exam-filter")?.value || "ALL";
      const filterDesc = examFilter === "ALL"
        ? "【全部主題測驗】的所有學生作答紀錄"
        : `【${(DataManager.getExamById(examFilter) || {}).title || "指定測驗"}】的所有學生紀錄`;

      const confirmMsg = `⚠️ 警告：確定要清空${filterDesc}嗎？\n\n此動作將直接刪除本地 Game-data/student_records.json 檔案中的對應作答數據，且無法復原！`;
      if (confirm(confirmMsg)) {
        SoundFX.playClick();
        await AdminSystem.clearRecords(examFilter);
        alert(`✅ 已成功清空${filterDesc}！`);
        refreshRecordsCurrentView();
      }
    });
  }

  // --- 題庫題目編輯器 Modal 事件 ---
  document.getElementById("btn-close-bank-editor")?.addEventListener("click", () => {
    SoundFX.playClick();
    closeBankQuestionsEditor();
  });

  document.getElementById("btn-cancel-bank-editor")?.addEventListener("click", () => {
    SoundFX.playClick();
    closeBankQuestionsEditor();
  });

  document.getElementById("btn-editor-add-question")?.addEventListener("click", () => {
    SoundFX.playClick();
    syncFormToEditingQuestions();
    editingBankQuestions.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      chapter: 1,
      category: "生態知識",
      question: "",
      options: ["", "", "", ""],
      answerIndex: 0,
      explanation: ""
    });
    renderEditingQuestionsList();
    const modalBody = document.querySelector("#bank-questions-editor-modal .modal-body");
    if (modalBody) modalBody.scrollTop = modalBody.scrollHeight;
  });

  document.getElementById("btn-save-bank-editor")?.addEventListener("click", async () => {
    SoundFX.playClick();
    syncFormToEditingQuestions();

    const emptyQ = editingBankQuestions.filter(q => !q.question || !q.question.trim());
    if (emptyQ.length > 0) {
      if (!confirm(`題庫中有 ${emptyQ.length} 道題目的內容為空白，是否確定儲存？`)) {
        return;
      }
    }

    try {
      await AdminSystem.updateBankQuestions(currentEditingBankId, editingBankQuestions);
      SoundFX.playSelect();
      alert(`🎉 題庫題目修改成功！共收錄 ${editingBankQuestions.length} 道題目，已同步寫入本地檔案。`);
      closeBankQuestionsEditor();
      renderBankList();
    } catch (err) {
      alert("儲存題目失敗：" + (err.message || err));
    }
  });

  // --- 課堂討論簡報模式事件 ---
  if (typeof PresentationSystem !== "undefined" && PresentationSystem.initEvents) {
    PresentationSystem.initEvents();
  }
}

// 更新管理者後台介面狀態
function refreshAdminUI() {
  const isLogged = AdminSystem.isLoggedIn();
  const authSection = document.getElementById("admin-auth-section");
  const manageSection = document.getElementById("admin-manage-section");

  if (isLogged) {
    authSection?.classList.add("hidden");
    manageSection?.classList.remove("hidden");
    renderCategoryChips();
    renderBankList();
  } else {
    authSection?.classList.remove("hidden");
    manageSection?.classList.add("hidden");
  }
}

// 渲染主題分類 Chips (Tab 1)
function renderCategoryChips() {
  const chipsContainer = document.getElementById("bank-category-chips");
  if (!chipsContainer) return;

  chipsContainer.innerHTML = "";
  const categories = ["ALL", ...DataManager.getCategories()];
  const currentFilter = AdminSystem.getCategoryFilter();

  categories.forEach((cat) => {
    const chip = document.createElement("button");
    const isActive = currentFilter === cat;
    chip.className = `category-chip ${isActive ? "active" : ""}`;
    chip.textContent = cat === "ALL" ? "全部主題" : cat;
    chip.addEventListener("click", () => {
      SoundFX.playClick();
      AdminSystem.setCategoryFilter(cat);
      renderCategoryChips();
      renderBankList();
    });
    chipsContainer.appendChild(chip);
  });
}

// 渲染多組題庫列表 (Tab 1)
function renderBankList() {
  const container = document.getElementById("admin-bank-list-container");
  const summaryEl = document.getElementById("admin-banks-summary");
  if (!container) return;

  const currentCategory = AdminSystem.getCategoryFilter();
  const allBanks = DataManager.getQuestionBanks();
  const filteredBanks = currentCategory === "ALL"
    ? allBanks
    : allBanks.filter((b) => (b.category || "綜合生態") === currentCategory);

  const activeCount = allBanks.filter((b) => b.active).length;
  const activeQuestions = DataManager.getActiveQuestions().length;

  if (summaryEl) {
    summaryEl.innerHTML = `已勾選啟用 <strong>${activeCount}</strong> / ${allBanks.length} 組題庫（目前可抽考題共 <strong>${activeQuestions}</strong> 題）`;
  }

  container.innerHTML = "";

  if (filteredBanks.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: #a4b0be; padding: 20px; font-size: 13px;">此分類下尚無題庫組，歡迎在下方新增匯入！</div>`;
    return;
  }

  filteredBanks.forEach((bank) => {
    const card = document.createElement("div");
    card.className = `bank-card ${bank.active ? "active-bank" : ""}`;

    const count = Array.isArray(bank.questions) ? bank.questions.length : 0;
    const cat = bank.category || "綜合生態";

    card.innerHTML = `
      <div class="bank-card-main">
        <label class="bank-checkbox-label">
          <input type="checkbox" class="bank-checkbox" data-bank-id="${bank.id}" ${bank.active ? "checked" : ""}>
          <span class="bank-title-text">${escapeHtml(bank.name)}</span>
        </label>
        <div class="bank-meta-text">
          <span class="badge-cat" style="background: rgba(116, 185, 255, 0.2); border: 1px solid #74b9ff; color: #74b9ff; padding: 1px 6px; border-radius: 4px; font-size: 11px;">🏷️ ${escapeHtml(cat)}</span>
          <span class="badge-cat">${count} 題</span>
          <span style="color: #a4b0be; font-size: 12px;">${escapeHtml(bank.description || "")}</span>
        </div>
      </div>
      <div class="bank-card-actions">
        <button class="btn-bank-edit-questions jrpg-btn" data-bank-id="${bank.id}" style="background: #0284c7; color: #fff; font-weight: bold;" title="編輯題庫內的題目">✏️ 編輯題目</button>
        <button class="btn-bank-export jrpg-btn" data-bank-id="${bank.id}" title="匯出為 CSV">📤 匯出</button>
        <button class="btn-bank-delete jrpg-btn" data-bank-id="${bank.id}" title="刪除整組題庫">🗑️ 刪除</button>
      </div>
    `;

    // 勾選切換
    const chk = card.querySelector(".bank-checkbox");
    chk.addEventListener("change", async function () {
      SoundFX.playClick();
      await AdminSystem.toggleBank(bank.id, this.checked);
      renderBankList();
      populateExamSelect();
    });

    // 編輯題目按鈕
    card.querySelector(".btn-bank-edit-questions")?.addEventListener("click", () => {
      SoundFX.playClick();
      openBankQuestionsEditor(bank.id);
    });

    // 匯出按鈕
    card.querySelector(".btn-bank-export").addEventListener("click", () => {
      const csvData = AdminSystem.exportBankToCSV(bank.id);
      if (!csvData) {
        alert("此題庫無題目可匯出！");
        return;
      }
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${bank.name}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });

    // 刪除按鈕
    card.querySelector(".btn-bank-delete").addEventListener("click", async () => {
      if (confirm(`確定要刪除題庫【${bank.name}】嗎？此操作無法還原。`)) {
        await AdminSystem.deleteBank(bank.id);
        refreshAdminUI();
        populateExamSelect();
      }
    });

    container.appendChild(card);
  });
}

// --- 題庫題目編輯器狀態與邏輯 ---
let currentEditingBankId = null;
let editingBankQuestions = [];

function openBankQuestionsEditor(bankId) {
  const allBanks = DataManager.getQuestionBanks();
  const bank = allBanks.find((b) => b.id === bankId);
  if (!bank) {
    alert("找不到該題庫！");
    return;
  }

  currentEditingBankId = bankId;
  editingBankQuestions = Array.isArray(bank.questions) ? JSON.parse(JSON.stringify(bank.questions)) : [];

  const modal = document.getElementById("bank-questions-editor-modal");
  const modalTitle = document.getElementById("bank-editor-modal-title");
  const bankNameEl = document.getElementById("bank-editor-name");
  const countBadge = document.getElementById("bank-editor-count-badge");

  if (modalTitle) modalTitle.textContent = `✏️ 編輯題庫題目【${bank.name}】`;
  if (bankNameEl) bankNameEl.textContent = bank.name;
  if (countBadge) countBadge.textContent = `${editingBankQuestions.length} 題`;

  renderEditingQuestionsList();
  modal?.classList.remove("hidden");
}

function closeBankQuestionsEditor() {
  document.getElementById("bank-questions-editor-modal")?.classList.add("hidden");
  currentEditingBankId = null;
  editingBankQuestions = [];
}

function renderEditingQuestionsList() {
  const container = document.getElementById("bank-editor-questions-list");
  const countBadge = document.getElementById("bank-editor-count-badge");
  if (!container) return;

  if (countBadge) countBadge.textContent = `${editingBankQuestions.length} 題`;

  if (editingBankQuestions.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: #a4b0be; padding: 30px; font-size: 13px; background: rgba(15, 23, 42, 0.4); border-radius: 8px;">
        目前該題庫尚未有任何題目，請點擊上方「➕ 新增一道題目」開始編寫！
      </div>
    `;
    return;
  }

  let html = "";
  editingBankQuestions.forEach((q, qIdx) => {
    const opts = Array.isArray(q.options) ? [...q.options] : ["", "", "", ""];
    while (opts.length < 4) opts.push("");

    html += `
      <div class="bank-edit-q-card" data-q-index="${qIdx}">
        <div class="edit-q-header">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span class="edit-q-badge">第 ${qIdx + 1} 題</span>
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="font-size: 11.5px; color: #94a3b8;">關卡：</span>
              <select class="jrpg-select edit-q-chapter" style="padding: 2px 6px; font-size: 11.5px; height: 26px;">
                <option value="1" ${q.chapter == 1 ? "selected" : ""}>第 1 關 (茂林幽谷)</option>
                <option value="2" ${q.chapter == 2 ? "selected" : ""}>第 2 關 (月世界)</option>
                <option value="3" ${q.chapter == 3 ? "selected" : ""}>第 3 關 (濁水溪)</option>
                <option value="4" ${q.chapter == 4 ? "selected" : ""}>第 4 關 (國道廊道)</option>
                <option value="5" ${q.chapter == 5 ? "selected" : ""}>第 5 關 (繁衍聖林)</option>
              </select>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="font-size: 11.5px; color: #94a3b8;">知識分類：</span>
              <input type="text" class="jrpg-input edit-q-category" value="${escapeHtml(q.category || "生態知識")}" placeholder="分類" style="padding: 2px 8px; font-size: 11.5px; width: 110px; height: 26px;">
            </div>
          </div>
          <div>
            <button class="jrpg-btn btn-delete-edit-q" data-q-index="${qIdx}" style="background: #c0392b; color: #fff; font-size: 11px; padding: 3px 8px;" title="刪除此題">
              🗑️ 刪除此題
            </button>
          </div>
        </div>

        <div style="margin: 8px 0 6px 0;">
          <label style="font-size: 12px; color: var(--gold-text); font-weight: bold; display: block; margin-bottom: 3px;">題目內容：</label>
          <textarea class="jrpg-input edit-q-text" rows="2" style="width: 100%; box-sizing: border-box; font-size: 13px; resize: vertical;" placeholder="請輸入題目內容">${escapeHtml(q.question || "")}</textarea>
        </div>

        <div style="margin-top: 8px;">
          <label style="font-size: 12px; color: #38bdf8; font-weight: bold; display: block; margin-bottom: 4px;">
            選項與正解（請點選單選圓鈕標記正確答案）：
          </label>
          <div class="edit-options-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            ${opts.map((opt, oIdx) => {
              const letter = String.fromCharCode(65 + oIdx);
              const isChecked = (q.answerIndex === oIdx);
              return `
                <div class="edit-opt-item ${isChecked ? "is-correct-row" : ""}" style="display: flex; align-items: center; gap: 6px; background: rgba(15, 23, 42, 0.6); padding: 5px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);">
                  <label style="display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: bold; cursor: pointer; color: ${isChecked ? "#2ed573" : "#cbd5e1"};">
                    <input type="radio" name="correct_ans_q_${qIdx}" class="edit-q-correct-radio" data-opt-index="${oIdx}" ${isChecked ? "checked" : ""}>
                    <span>${letter}</span>
                  </label>
                  <input type="text" class="jrpg-input edit-opt-input" data-opt-index="${oIdx}" value="${escapeHtml(opt)}" placeholder="選項 ${letter}" style="flex: 1; padding: 3px 6px; font-size: 12px; height: 26px;">
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <div style="margin-top: 8px;">
          <label style="font-size: 12px; color: #a4b0be; font-weight: bold; display: block; margin-bottom: 3px;">💡 教學引導與詳解解析（選填）：</label>
          <textarea class="jrpg-input edit-q-explanation" rows="1" style="width: 100%; box-sizing: border-box; font-size: 12px; resize: vertical;" placeholder="作答後呈現給學生的詳解引導">${escapeHtml(q.explanation || "")}</textarea>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // 綁定各題刪除按鈕
  container.querySelectorAll(".btn-delete-edit-q").forEach((btn) => {
    btn.addEventListener("click", function () {
      syncFormToEditingQuestions();
      const idx = parseInt(this.dataset.qIndex, 10);
      if (confirm(`確定要刪除第 ${idx + 1} 題嗎？`)) {
        SoundFX.playClick();
        editingBankQuestions.splice(idx, 1);
        renderEditingQuestionsList();
      }
    });
  });

  // 綁定單選正確答案變更
  container.querySelectorAll(".edit-q-correct-radio").forEach((radio) => {
    radio.addEventListener("change", function () {
      const card = this.closest(".bank-edit-q-card");
      const qIdx = parseInt(card.dataset.qIndex, 10);
      const oIdx = parseInt(this.dataset.optIndex, 10);
      editingBankQuestions[qIdx].answerIndex = oIdx;
      // 更新樣式高亮
      card.querySelectorAll(".edit-opt-item").forEach((row, rowIdx) => {
        if (rowIdx === oIdx) {
          row.classList.add("is-correct-row");
          row.querySelector("label").style.color = "#2ed573";
        } else {
          row.classList.remove("is-correct-row");
          row.querySelector("label").style.color = "#cbd5e1";
        }
      });
    });
  });
}

function syncFormToEditingQuestions() {
  const container = document.getElementById("bank-editor-questions-list");
  if (!container) return;

  const cards = container.querySelectorAll(".bank-edit-q-card");
  cards.forEach((card, idx) => {
    if (!editingBankQuestions[idx]) return;

    const chapterEl = card.querySelector(".edit-q-chapter");
    const categoryEl = card.querySelector(".edit-q-category");
    const questionEl = card.querySelector(".edit-q-text");
    const explanationEl = card.querySelector(".edit-q-explanation");

    if (chapterEl) editingBankQuestions[idx].chapter = parseInt(chapterEl.value, 10) || 1;
    if (categoryEl) editingBankQuestions[idx].category = categoryEl.value.trim() || "生態知識";
    if (questionEl) editingBankQuestions[idx].question = questionEl.value.trim();
    if (explanationEl) editingBankQuestions[idx].explanation = explanationEl.value.trim();

    const optInputs = card.querySelectorAll(".edit-opt-input");
    const opts = [];
    optInputs.forEach((inp) => {
      opts.push(inp.value.trim());
    });
    editingBankQuestions[idx].options = opts;

    const checkedRadio = card.querySelector(".edit-q-correct-radio:checked");
    if (checkedRadio) {
      editingBankQuestions[idx].answerIndex = parseInt(checkedRadio.dataset.optIndex, 10);
    }
  });
}

// 渲染主題測驗列表 (Tab 2)
function renderExamList() {
  const container = document.getElementById("admin-exams-list-container");
  if (!container) return;

  const exams = DataManager.getExams();
  const banks = DataManager.getQuestionBanks();
  container.innerHTML = "";

  if (exams.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: #a4b0be; padding: 30px; font-size: 14px;">
        目前尚無派送的主題測驗！<br>
        請切換至「📚 題庫管理與派送」分頁，勾選題庫後點擊「🚀 勾選題庫派送為主題測驗」即可發布。
      </div>
    `;
    return;
  }

  exams.forEach((exam) => {
    const card = document.createElement("div");
    card.className = `exam-card ${exam.active ? "active-exam" : "inactive-exam"}`;

    // 取得涵蓋題庫名稱清單
    const coveredBanks = (exam.bankIds || [])
      .map((id) => {
        const b = banks.find((bank) => bank.id === id);
        return b ? b.name : "未知題庫";
      })
      .join("、");

    const createdDate = exam.createdAt ? new Date(exam.createdAt).toLocaleDateString("zh-TW") : "";

    card.innerHTML = `
      <div class="exam-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
        <div>
          <span style="font-size: 16px; font-weight: bold; color: var(--gold-text); margin-right: 8px;">🎯 ${escapeHtml(exam.title)}</span>
          <span class="badge-cat" style="background: rgba(46, 213, 115, 0.2); border: 1px solid #2ed573; color: #2ed573; padding: 2px 6px; border-radius: 4px; font-size: 11px;">
            ${escapeHtml(exam.category || "主題測驗")}
          </span>
          <span style="margin-left: 8px; font-size: 12px; color: ${exam.active ? "#2ed573" : "#a4b0be"}; font-weight: bold;">
            ${exam.active ? "🟢 派送中" : "⚪ 已停用"}
          </span>
        </div>
        <div class="exam-card-actions" style="display: flex; gap: 6px;">
          <button class="btn-toggle-exam jrpg-btn" style="padding: 3px 10px; font-size: 12px;" data-exam-id="${exam.id}">
            ${exam.active ? "⏸️ 暫停測驗" : "▶️ 恢復派送"}
          </button>
          <button class="btn-delete-exam jrpg-btn" style="padding: 3px 10px; font-size: 12px; background: #c0392b;" data-exam-id="${exam.id}">
            🗑️ 刪除
          </button>
        </div>
      </div>
      <div style="font-size: 13px; color: #ccd7e6; margin-bottom: 4px;">
        ${escapeHtml(exam.description || "全島大遷徙生態挑戰任務")}
      </div>
      <div style="font-size: 11px; color: #a4b0be; display: flex; flex-wrap: wrap; gap: 12px;">
        <span>📚 涵蓋題庫：${escapeHtml(coveredBanks || "無")}</span>
        <span>📝 總題數：<strong>${exam.questionCount || 0}</strong> 題</span>
        <span>🕒 發布時間：${createdDate}</span>
      </div>
    `;

    // 切換開關
    card.querySelector(".btn-toggle-exam").addEventListener("click", async () => {
      SoundFX.playClick();
      await AdminSystem.toggleExam(exam.id, !exam.active);
      renderExamList();
      populateExamSelect();
    });

    // 刪除按鈕
    card.querySelector(".btn-delete-exam").addEventListener("click", async () => {
      if (confirm(`確定要刪除主題測驗【${exam.title}】嗎？`)) {
        SoundFX.playClick();
        await AdminSystem.deleteExam(exam.id);
        renderExamList();
        populateExamSelect();
      }
    });

    container.appendChild(card);
  });
}

// Tab 3 作答紀錄子檢視狀態 ("students" 學生列表 | "mistakes" 錯題分析)
let currentRecordsSubView = "students";

// 切換 Tab 3 內部子檢視
function switchRecordsSubView(targetView) {
  currentRecordsSubView = targetView;
  const viewBtnStudents = document.getElementById("view-btn-students");
  const viewBtnMistakes = document.getElementById("view-btn-mistakes");
  const containerStudents = document.getElementById("student-records-container");
  const containerMistakes = document.getElementById("mistake-analysis-container");

  if (targetView === "students") {
    viewBtnStudents?.classList.add("active");
    viewBtnMistakes?.classList.remove("active");
    containerStudents?.classList.remove("hidden");
    containerMistakes?.classList.add("hidden");
    renderRecordsTable();
  } else {
    viewBtnMistakes?.classList.add("active");
    viewBtnStudents?.classList.remove("active");
    containerMistakes?.classList.remove("hidden");
    containerStudents?.classList.add("hidden");
    renderMistakeAnalysisUI();
  }
}

// 刷新目前選定之子檢視
function refreshRecordsCurrentView() {
  renderDashboardStats();
  if (currentRecordsSubView === "students") {
    renderRecordsTable();
  } else {
    renderMistakeAnalysisUI();
  }
}

// 渲染學生作答分析與錯題本 (Tab 3)
function renderRecordsUI() {
  const selectEl = document.getElementById("record-exam-filter");
  if (!selectEl) return;

  const exams = DataManager.getExams();
  const currentFilter = AdminSystem.getExamFilter();

  selectEl.innerHTML = '<option value="ALL">全部主題測驗紀錄</option>';
  exams.forEach((ex) => {
    const opt = document.createElement("option");
    opt.value = ex.id;
    opt.textContent = `🎯 ${ex.title}`;
    selectEl.appendChild(opt);
  });

  selectEl.value = currentFilter;

  selectEl.onchange = function () {
    SoundFX.playClick();
    AdminSystem.setExamFilter(this.value);
    refreshRecordsCurrentView();
  };

  refreshRecordsCurrentView();
}

// 更新數據看板 (Tab 3)
function renderDashboardStats() {
  const currentFilter = AdminSystem.getExamFilter();
  const records = DataManager.getStudentRecords(currentFilter);

  const totalStudentsEl = document.getElementById("stat-total-students");
  const avgAccuracyEl = document.getElementById("stat-avg-accuracy");
  const avgScoreEl = document.getElementById("stat-avg-score");
  const totalMistakesEl = document.getElementById("stat-total-mistakes");

  const totalCount = records.length;
  let sumAccuracy = 0;
  let sumScore = 0;
  const uniqueMistakes = new Set();

  records.forEach((r) => {
    sumAccuracy += r.accuracy || 0;
    sumScore += r.score || 0;
    if (Array.isArray(r.details)) {
      r.details.forEach((d) => {
        if (d.isCorrect === false) {
          uniqueMistakes.add(d.questionId || d.question);
        }
      });
    }
  });

  const avgAcc = totalCount > 0 ? Math.round(sumAccuracy / totalCount) : 0;
  const avgScore = totalCount > 0 ? Math.round(sumScore / totalCount) : 0;

  if (totalStudentsEl) totalStudentsEl.textContent = `${totalCount} 人次`;
  if (avgAccuracyEl) avgAccuracyEl.textContent = `${avgAcc}%`;
  if (avgScoreEl) avgScoreEl.textContent = `${avgScore} 分`;
  if (totalMistakesEl) totalMistakesEl.textContent = `${uniqueMistakes.size} 題`;
}

// 渲染學生作答紀錄表格 (Tab 3 檢視 1)
function renderRecordsTable() {
  const container = document.getElementById("student-records-container");
  if (!container) return;

  const currentFilter = AdminSystem.getExamFilter();
  const records = DataManager.getStudentRecords(currentFilter);

  if (records.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: #a4b0be; padding: 25px; font-size: 13px;">
        目前尚無學生在該測驗中的作答紀錄。當學生在大地圖闖關答題時，系統將即時分析並記錄！
      </div>
    `;
    return;
  }

  let tableHtml = `
    <table class="student-records-table">
      <thead>
        <tr>
          <th>作答時間</th>
          <th>學生姓名</th>
          <th>主題測驗名稱</th>
          <th>答對 / 答題數</th>
          <th>答對率</th>
          <th>獲得積分</th>
          <th>操作詳情</th>
        </tr>
      </thead>
      <tbody>
  `;

  records.forEach((rec, idx) => {
    const timeStr = rec.completedAt ? new Date(rec.completedAt).toLocaleString("zh-TW") : "剛才";
    const accClass = rec.accuracy >= 80 ? "acc-high" : rec.accuracy >= 60 ? "acc-mid" : "acc-low";

    tableHtml += `
      <tr>
        <td style="color: #a4b0be; font-size: 12px;">${timeStr}</td>
        <td><strong style="color: #74b9ff;">${escapeHtml(rec.studentName)}</strong></td>
        <td>${escapeHtml(rec.examTitle || "未指定測驗")}</td>
        <td><span style="color: #2ed573;">${rec.correctCount || 0}</span> / ${rec.totalAnswered || 0}</td>
        <td><span class="${accClass}" style="font-weight: bold;">${rec.accuracy || 0}%</span></td>
        <td style="color: #ffe066; font-weight: bold;">${rec.score || 0} 分 (Lv. ${rec.level || 1})</td>
        <td>
          <button class="btn-view-detail jrpg-btn" data-record-index="${idx}" style="padding: 3px 8px; font-size: 11px;">
            👁️ 答題詳情
          </button>
          <button class="btn-delete-record jrpg-btn" data-record-id="${rec.id || rec.completedAt}" data-student-name="${escapeHtml(rec.studentName)}" style="padding: 3px 8px; font-size: 11px; background: #c0392b; margin-left: 4px;">
            🗑️ 刪除
          </button>
        </td>
      </tr>
    `;
  });

  tableHtml += `
      </tbody>
    </table>
  `;

  container.innerHTML = tableHtml;

  // 綁定「查看答題詳情」按鈕事件
  container.querySelectorAll(".btn-view-detail").forEach((btn) => {
    btn.addEventListener("click", function () {
      SoundFX.playClick();
      const recIdx = parseInt(this.dataset.recordIndex, 10);
      const targetRecord = records[recIdx];
      if (targetRecord) {
        showStudentDetailModal(targetRecord);
      }
    });
  });

  // 綁定「刪除單筆紀錄」按鈕事件
  container.querySelectorAll(".btn-delete-record").forEach((btn) => {
    btn.addEventListener("click", async function () {
      const recId = this.dataset.recordId;
      const sName = this.dataset.studentName;
      if (confirm(`確定要刪除學生「${sName}」的這筆作答紀錄嗎？\n此動作將同步從本地 Game-data/student_records.json 檔案中永久刪除。`)) {
        SoundFX.playClick();
        await AdminSystem.deleteRecord(recId);
        refreshRecordsCurrentView();
      }
    });
  });
}

// 渲染題目維度錯題深度分析排行榜 (Tab 3 檢視 2 - 按最多人錯順序列出)
function renderMistakeAnalysisUI() {
  const container = document.getElementById("mistake-analysis-container");
  if (!container) return;

  const currentFilter = AdminSystem.getExamFilter();
  const analysis = AdminSystem.getMistakeAnalysis(currentFilter);
  const mistakes = analysis.mistakes || [];

  if (mistakes.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: #a4b0be; padding: 40px 20px; font-size: 14px; background: rgba(15, 23, 42, 0.45); border-radius: 8px; border: 1.5px dashed rgba(255,255,255,0.15);">
        <div style="font-size: 40px; margin-bottom: 10px;">🎉</div>
        <strong style="color: #2ed573; font-size: 16px;">太棒了！當前範圍無任何錯題紀錄！</strong><br>
        <span style="color: #94a3b8; font-size: 13px; margin-top: 6px; display: inline-block;">
          所有作答學生皆全數答對，或當前所選的主題測驗尚未有作答歷程紀錄。
        </span>
      </div>
    `;
    return;
  }

  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; background: rgba(30, 41, 59, 0.65); padding: 10px 14px; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.25);">
      <div style="font-size: 13px; color: #e2e8f0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
        <span>🔥 共診斷出 <strong style="color: #ff4757; font-size: 15px;">${mistakes.length}</strong> 道常錯題目（已依<strong>「答錯人數由多到少」</strong>排序列出）</span>
        <span style="font-size: 12px; color: #94a3b8;">（分析範圍：${analysis.totalRecords} 份作答考卷）</span>
      </div>
      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
        <button id="btn-open-presentation-mode" class="jrpg-btn" style="background: linear-gradient(135deg, #8b5cf6, #d946ef); color: #fff; font-size: 12px; padding: 5px 14px; font-weight: bold; border-color: #d946ef; box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4);" title="開啟大螢幕全畫面簡報模式進行課堂檢討與迷思探討">
          📽️ 課堂討論簡報模式
        </button>
        <button id="btn-pack-from-analysis" class="jrpg-btn" style="background: #e67e22; color: #fff; font-size: 12px; padding: 5px 12px; font-weight: bold;">
          📦 一鍵打包為強化題庫
        </button>
      </div>
    </div>
    <div class="mistake-cards-list" style="display: flex; flex-direction: column; gap: 14px;">
  `;

  mistakes.forEach((item, idx) => {
    // 排行榜名次徽章
    let rankBadge = "";
    if (idx === 0) {
      rankBadge = `<span class="mistake-rank-badge rank-gold">🥇 第一常錯題</span>`;
    } else if (idx === 1) {
      rankBadge = `<span class="mistake-rank-badge rank-silver">🥈 第二常錯題</span>`;
    } else if (idx === 2) {
      rankBadge = `<span class="mistake-rank-badge rank-bronze">🥉 第三常錯題</span>`;
    } else {
      rankBadge = `<span class="mistake-rank-badge rank-normal">第 ${idx + 1} 常錯題</span>`;
    }

    // 答對率視覺色彩
    const accClass = item.accuracy >= 70 ? "acc-high" : item.accuracy >= 40 ? "acc-mid" : "acc-low";
    const wrongPercent = 100 - item.accuracy;

    // 答錯學生名單標籤生成
    const wrongStudentsHtml = item.wrongStudents.map((st) => {
      const timeStr = st.completedAt ? new Date(st.completedAt).toLocaleTimeString("zh-TW", { hour: '2-digit', minute: '2-digit' }) : '';
      return `
        <span class="wrong-student-tag" title="作答時間：${st.completedAt ? new Date(st.completedAt).toLocaleString('zh-TW') : '無'}">
          <span class="wrong-st-name">👤 <strong>${escapeHtml(st.studentName)}</strong></span>
          <span class="wrong-st-choice">選答：${escapeHtml(st.wrongAnswer)}</span>
          ${timeStr ? `<span class="wrong-st-time">${timeStr}</span>` : ''}
        </span>
      `;
    }).join("");

    // 選項列表（呈現正解與選項被選次數分析）
    let optionsHtml = "";
    if (Array.isArray(item.options) && item.options.length > 0) {
      optionsHtml = `
        <div class="mistake-options-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 8px; margin: 10px 0;">
          ${item.options.map((opt, oIdx) => {
            const isCorrectOpt = (opt === item.correctAnswer);
            const chosenCount = item.optionDistribution[opt] || 0;
            const letter = String.fromCharCode(65 + oIdx);
            return `
              <div class="mistake-opt-box ${isCorrectOpt ? 'opt-box-correct' : (chosenCount > 0 ? 'opt-box-chosen-wrong' : '')}">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                  <span class="opt-label">${isCorrectOpt ? '✅ 正解' : letter}</span>
                  ${chosenCount > 0 ? `<span class="opt-count-tag">${chosenCount} 位學生選</span>` : ''}
                </div>
                <div class="opt-text-val">${escapeHtml(opt)}</div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }

    html += `
      <div class="mistake-card-box">
        <!-- 頂部標頭與數據指標 -->
        <div class="mistake-card-topbar">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            ${rankBadge}
            <span class="mistake-tag tag-category">🏷️ ${escapeHtml(item.category || "主題考題")}</span>
            <span class="mistake-tag tag-chapter">第 ${item.chapter || 1} 關</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <div class="mistake-metric-badges">
              <span class="metric-pill pill-wrong">❌ <strong>${item.wrongCount}</strong> 人答錯</span>
              <span class="metric-pill pill-correct">✅ <strong>${item.correctCount}</strong> / ${item.totalAttempts} 人答對</span>
              <span class="metric-pill pill-accuracy ${accClass}">📊 答對率 <strong>${item.accuracy}%</strong></span>
            </div>
            <button class="btn-present-single-q jrpg-btn" data-q-index="${idx}" style="background: rgba(139, 92, 246, 0.25); border: 1.5px solid #a855f7; color: #d8b4fe; font-size: 11.5px; padding: 3px 10px; font-weight: bold;" title="以全畫面簡報模式投影此題進行課堂討論">
              📽️ 簡報此題
            </button>
          </div>
        </div>

        <!-- 答對率雙色視覺條 -->
        <div class="mistake-ratio-container" title="答對率 ${item.accuracy}% / 答錯率 ${wrongPercent}%">
          <div class="ratio-segment ratio-correct" style="width: ${item.accuracy}%;"></div>
          <div class="ratio-segment ratio-wrong" style="width: ${wrongPercent}%;"></div>
        </div>

        <!-- 題目內容 -->
        <div class="mistake-q-title">
          <span style="color: var(--gold-text); font-weight: bold; margin-right: 4px;">Q：</span>
          ${escapeHtml(item.question)}
        </div>

        <!-- 選項與分佈 -->
        ${optionsHtml}

        <!-- 教學解析引導 -->
        ${item.explanation ? `
          <div class="mistake-exp-box">
            💡 <strong>教學引導與觀念詳解：</strong>${escapeHtml(item.explanation)}
          </div>
        ` : ""}

        <!-- 答錯學生清單區塊 -->
        <div class="mistake-students-drawer">
          <div class="students-drawer-header">
            <span>👥 <strong>答錯學生清單</strong>（共 <strong style="color: #ff4757;">${item.wrongStudents.length}</strong> 位學生答錯）：</span>
            <span style="font-size: 11px; color: #94a3b8;">可直接掌握每位學生所選的錯誤選項與盲點</span>
          </div>
          <div class="students-chip-flex">
            ${wrongStudentsHtml}
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;

  // 綁定頂部簡報模式按鈕
  const btnOpenPres = container.querySelector("#btn-open-presentation-mode");
  if (btnOpenPres) {
    btnOpenPres.addEventListener("click", () => {
      SoundFX.playSelect();
      PresentationSystem.open(0);
    });
  }

  // 綁定單題簡報按鈕
  container.querySelectorAll(".btn-present-single-q").forEach((btn) => {
    btn.addEventListener("click", function () {
      SoundFX.playSelect();
      const qIdx = parseInt(this.dataset.qIndex, 10) || 0;
      PresentationSystem.open(qIdx);
    });
  });

  const btnPackFromAnalysis = container.querySelector("#btn-pack-from-analysis");
  if (btnPackFromAnalysis) {
    btnPackFromAnalysis.addEventListener("click", () => {
      document.getElementById("btn-pack-mistakes")?.click();
    });
  }
}

// ==============================================
// 課堂討論全畫面簡報模式系統 (Presentation Mode)
// ==============================================
const PresentationSystem = (function () {
  let presMistakes = [];
  let currentIndex = 0;
  let showAnswerDetails = true; // 是否揭曉答案與學生分佈（支援教師先讓學生思考再揭曉）
  let isKeydownBound = false;

  // 鍵盤操作監聽
  function handleKeyDown(e) {
    // 若焦點在輸入框內則不攔截
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;

    if (e.key === "ArrowRight" || e.key === "PageDown" || e.code === "Space") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      prev();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      toggleFullscreen();
    } else if (e.key === "a" || e.key === "A") {
      e.preventDefault();
      toggleAnswer();
    }
  }

  function bindKeys() {
    if (!isKeydownBound) {
      document.addEventListener("keydown", handleKeyDown);
      isKeydownBound = true;
    }
  }

  function unbindKeys() {
    if (isKeydownBound) {
      document.removeEventListener("keydown", handleKeyDown);
      isKeydownBound = false;
    }
  }

  // 開啟簡報模式
  function open(startIndex = 0) {
    const currentFilter = AdminSystem.getExamFilter();
    const analysis = AdminSystem.getMistakeAnalysis(currentFilter);
    presMistakes = analysis.mistakes || [];

    if (presMistakes.length === 0) {
      alert("目前沒有任何錯題可進行課堂簡報！");
      return;
    }

    currentIndex = Math.max(0, Math.min(startIndex, presMistakes.length - 1));
    showAnswerDetails = true;

    const modal = document.getElementById("presentation-modal");
    if (modal) {
      modal.classList.remove("hidden");
    }

    bindKeys();
    renderSlide(currentIndex);
  }

  // 關閉簡報模式
  function close() {
    const modal = document.getElementById("presentation-modal");
    if (modal) {
      modal.classList.add("hidden");
    }
    unbindKeys();

    // 若處於原生全螢幕模式則退出
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    SoundFX.playClick();
  }

  // 切換下一題
  function next() {
    if (currentIndex < presMistakes.length - 1) {
      currentIndex++;
      SoundFX.playClick();
      renderSlide(currentIndex);
    }
  }

  // 切換上一題
  function prev() {
    if (currentIndex > 0) {
      currentIndex--;
      SoundFX.playClick();
      renderSlide(currentIndex);
    }
  }

  // 跳轉至特定題目
  function goTo(index) {
    if (index >= 0 && index < presMistakes.length) {
      currentIndex = index;
      SoundFX.playClick();
      renderSlide(currentIndex);
    }
  }

  // 切換答案顯示狀態 (讓全班先思考再揭曉)
  function toggleAnswer() {
    showAnswerDetails = !showAnswerDetails;
    SoundFX.playClick();
    renderSlide(currentIndex);
  }

  // 切換瀏覽器全螢幕
  function toggleFullscreen() {
    const modal = document.getElementById("presentation-modal");
    if (!document.fullscreenElement) {
      if (modal && modal.requestFullscreen) {
        modal.requestFullscreen().catch(() => {});
      } else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  // 渲染當前題號之大字投影幻燈片
  function renderSlide(idx) {
    const item = presMistakes[idx];
    if (!item) return;

    // 1. 頂部資訊與名次徽章
    const rankEl = document.getElementById("pres-rank-badge");
    if (rankEl) {
      let rankText = `第 ${idx + 1} 常錯題`;
      let rankClass = "rank-normal";
      if (idx === 0) {
        rankText = "🥇 第一常錯題";
        rankClass = "rank-gold";
      } else if (idx === 1) {
        rankText = "🥈 第二常錯題";
        rankClass = "rank-silver";
      } else if (idx === 2) {
        rankText = "🥉 第三常錯題";
        rankClass = "rank-bronze";
      }
      rankEl.textContent = rankText;
      rankEl.className = `mistake-rank-badge ${rankClass}`;
    }

    const catEl = document.getElementById("pres-tag-category");
    if (catEl) catEl.textContent = `🏷️ ${item.category || "主題考題"}`;

    const chpEl = document.getElementById("pres-tag-chapter");
    if (chpEl) chpEl.textContent = `第 ${item.chapter || 1} 關`;

    // 2. 題號指示器與進度條
    const indicatorEl = document.getElementById("pres-page-indicator");
    if (indicatorEl) indicatorEl.textContent = `第 ${idx + 1} / ${presMistakes.length} 題`;

    const miniFillEl = document.getElementById("pres-mini-progress-fill");
    if (miniFillEl) {
      const pct = Math.round(((idx + 1) / presMistakes.length) * 100);
      miniFillEl.style.width = `${pct}%`;
    }

    // 3. 指標統計列
    const wrongCountEl = document.getElementById("pres-wrong-count");
    if (wrongCountEl) wrongCountEl.textContent = item.wrongCount;

    const correctCountEl = document.getElementById("pres-correct-count");
    if (correctCountEl) correctCountEl.textContent = item.correctCount;

    const totalCountEl = document.getElementById("pres-total-count");
    if (totalCountEl) totalCountEl.textContent = item.totalAttempts;

    const accuracyValEl = document.getElementById("pres-accuracy-val");
    if (accuracyValEl) accuracyValEl.textContent = `${item.accuracy}%`;

    const ratioCorrectEl = document.getElementById("pres-ratio-correct");
    const ratioWrongEl = document.getElementById("pres-ratio-wrong");
    const wrongPercent = 100 - item.accuracy;
    if (ratioCorrectEl) ratioCorrectEl.style.width = `${item.accuracy}%`;
    if (ratioWrongEl) ratioWrongEl.style.width = `${wrongPercent}%`;

    // 4. 題目內容大字
    const qTextEl = document.getElementById("pres-question-text");
    if (qTextEl) qTextEl.textContent = item.question;

    // 5. 答案開關按鈕狀態
    const toggleAnsBtn = document.getElementById("btn-pres-toggle-answer");
    if (toggleAnsBtn) {
      toggleAnsBtn.textContent = showAnswerDetails ? "👁️ 隱藏答案" : "👁️ 揭曉答案";
      toggleAnsBtn.classList.toggle("active", showAnswerDetails);
    }

    // 6. 選項四宮格卡片
    const optContainer = document.getElementById("pres-options-container");
    if (optContainer) {
      if (Array.isArray(item.options) && item.options.length > 0) {
        optContainer.innerHTML = item.options.map((opt, oIdx) => {
          const letter = String.fromCharCode(65 + oIdx);
          const isCorrect = (opt === item.correctAnswer);
          const chosenCount = item.optionDistribution[opt] || 0;

          let cardClass = "pres-opt-card";
          let badgeHtml = "";

          if (showAnswerDetails) {
            if (isCorrect) {
              cardClass += " pres-opt-correct";
              badgeHtml = `<span class="pres-opt-badge-tag">✅ 正確答案</span>`;
            } else if (chosenCount > 0) {
              cardClass += " pres-opt-wrong";
              badgeHtml = `<span class="pres-opt-badge-tag">❌ ${chosenCount} 位同學誤選</span>`;
            }
          }

          return `
            <div class="${cardClass}">
              <div class="pres-opt-card-top">
                <div class="pres-opt-letter">${letter}</div>
                ${badgeHtml}
              </div>
              <div class="pres-opt-text">${escapeHtml(opt)}</div>
            </div>
          `;
        }).join("");
      } else {
        optContainer.innerHTML = "";
      }
    }

    // 7. 教學引導與詳解
    const expBox = document.getElementById("pres-explanation-box");
    const expText = document.getElementById("pres-explanation-text");
    if (expBox && expText) {
      if (showAnswerDetails && item.explanation) {
        expText.textContent = item.explanation;
        expBox.style.display = "block";
      } else {
        expBox.style.display = "none";
      }
    }

    // 8. 答錯學生名單抽屜
    const studentsBox = document.getElementById("pres-students-box");
    const studentsCount = document.getElementById("pres-wrong-students-count");
    const studentsList = document.getElementById("pres-students-list");
    if (studentsBox && studentsList) {
      if (showAnswerDetails && item.wrongStudents && item.wrongStudents.length > 0) {
        if (studentsCount) studentsCount.textContent = item.wrongStudents.length;
        studentsList.innerHTML = item.wrongStudents.map((st) => `
          <div class="pres-student-tag">
            <span class="pres-st-name">👤 ${escapeHtml(st.studentName)}</span>
            <span class="pres-st-choice">選答：${escapeHtml(st.wrongAnswer)}</span>
          </div>
        `).join("");
        studentsBox.style.display = "block";
      } else {
        studentsBox.style.display = "none";
      }
    }

    // 9. 導覽按鈕狀態 (上一題 / 下一題)
    const prevBtn = document.getElementById("btn-pres-prev");
    const nextBtn = document.getElementById("btn-pres-next");
    if (prevBtn) prevBtn.disabled = (idx === 0);
    if (nextBtn) nextBtn.disabled = (idx === presMistakes.length - 1);

    // 10. 題號快捷圓點導覽列
    const dotsContainer = document.getElementById("pres-dots-container");
    if (dotsContainer) {
      dotsContainer.innerHTML = presMistakes.map((_, dIdx) => `
        <button class="pres-dot-btn ${dIdx === idx ? "active" : ""}" data-idx="${dIdx}" title="跳轉至第 ${dIdx + 1} 題">
          ${dIdx + 1}
        </button>
      `).join("");

      dotsContainer.querySelectorAll(".pres-dot-btn").forEach((dot) => {
        dot.addEventListener("click", function () {
          const target = parseInt(this.dataset.idx, 10);
          goTo(target);
        });
      });
    }

    // 滾動主內容回頂部
    const presBody = document.querySelector("#presentation-modal .pres-body");
    if (presBody) presBody.scrollTop = 0;
  }

  // 初始化按鈕事件
  function initEvents() {
    document.getElementById("btn-close-presentation")?.addEventListener("click", close);
    document.getElementById("btn-pres-prev")?.addEventListener("click", prev);
    document.getElementById("btn-pres-next")?.addEventListener("click", next);
    document.getElementById("btn-pres-toggle-answer")?.addEventListener("click", toggleAnswer);
    document.getElementById("btn-pres-fullscreen")?.addEventListener("click", toggleFullscreen);
  }

  return {
    initEvents,
    open,
    close,
    next,
    prev,
    goTo,
    toggleAnswer,
    toggleFullscreen
  };
})();

// 渲染本地檔案儲存說明 (Tab 4)
async function renderStorageGuideUI() {
  const container = document.getElementById("storage-files-grid");
  const pathCode = document.getElementById("storage-root-path");
  if (!container) return;

  container.innerHTML = '<div style="text-align: center; color: #a4b0be; padding: 25px;">⏳ 正在即時讀取本機 Game-data 資料夾檔案狀態...</div>';

  try {
    const info = await AdminSystem.getStorageInfo();
    if (pathCode && info.dataDir) {
      pathCode.textContent = info.dataDir;
    }

    const files = info.files || [];
    if (files.length === 0) {
      container.innerHTML = '<div style="text-align: center; color: #a4b0be; padding: 25px;">未取得檔案資訊。</div>';
      return;
    }

    let cardsHtml = "";
    files.forEach((f) => {
      const existsBadge = f.exists
        ? '<span style="background: rgba(46, 213, 115, 0.2); border: 1px solid #2ed573; color: #2ed573; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">🟢 檔案正常</span>'
        : '<span style="background: rgba(255, 71, 87, 0.2); border: 1px solid #ff4757; color: #ff4757; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">⚪ 尚未產生</span>';

      const countText = (f.recordCount !== null && f.recordCount !== undefined)
        ? `<span style="color: #ffd700; font-weight: bold;">${f.recordCount}</span> 筆資料`
        : "純文字設定 / 樣版";

      cardsHtml += `
        <div class="storage-file-card" style="background: rgba(18, 28, 56, 0.9); border: 1.5px solid rgba(212, 175, 55, 0.35); border-radius: 8px; padding: 12px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">📄</span>
              <span style="font-weight: bold; color: var(--gold-text); font-size: 15px;">${escapeHtml(f.title)}</span>
              <span style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; padding: 1px 6px; border-radius: 4px; font-size: 11px;">${escapeHtml(f.category)}</span>
              ${existsBadge}
            </div>
            <div>
              <button class="btn-copy-filepath jrpg-btn" data-filepath="${escapeHtml(f.relativePath)}" style="padding: 3px 10px; font-size: 11px; background: rgba(255, 255, 255, 0.1);">
                📋 複製相對路徑
              </button>
            </div>
          </div>

          <div style="font-size: 13px; color: #cbd5e1; line-height: 1.45;">
            ${escapeHtml(f.description)}
          </div>

          <div style="display: flex; flex-wrap: wrap; gap: 16px; font-size: 11.5px; color: #94a3b8; background: rgba(0, 0, 0, 0.25); padding: 7px 12px; border-radius: 6px; margin-top: 2px;">
            <div>📁 實體路徑：<code style="color: #38bdf8; font-family: Consolas, monospace; font-weight: bold;">${escapeHtml(f.relativePath)}</code></div>
            <div>📦 檔案格式：<span style="color: #e2e8f0;">${escapeHtml(f.format)}</span></div>
            <div>📊 內容規模：<span style="color: #e2e8f0;">${countText}</span></div>
            <div>💾 檔案大小：<span style="color: #2ed573; font-weight: bold;">${f.sizeFormatted}</span></div>
            <div>🕒 最後修改：<span style="color: #e2e8f0;">${f.lastModified}</span></div>
          </div>
        </div>
      `;
    });

    container.innerHTML = cardsHtml;

    // 複製相對路徑按鈕
    container.querySelectorAll(".btn-copy-filepath").forEach((btn) => {
      btn.addEventListener("click", function () {
        const p = this.dataset.filepath;
        navigator.clipboard.writeText(p).then(() => {
          const orig = this.textContent;
          this.textContent = "✅ 已複製！";
          setTimeout(() => { this.textContent = orig; }, 1500);
        });
      });
    });
  } catch (err) {
    container.innerHTML = `<div style="color: #ff4757; padding: 20px;">載入本地儲存說明失敗：${err.message}</div>`;
  }
}

// 彈出學生答題詳情 Modal
function showStudentDetailModal(record) {
  const modal = document.getElementById("student-detail-modal");
  const summaryEl = document.getElementById("student-detail-summary");
  const listEl = document.getElementById("student-detail-questions-list");
  if (!modal || !summaryEl || !listEl) return;

  const timeStr = record.completedAt ? new Date(record.completedAt).toLocaleString("zh-TW") : "剛才";
  summaryEl.innerHTML = `
    <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 10px; border-left: 4px solid #74b9ff;">
      👤 <strong>學生：</strong><span style="color: #74b9ff; font-size: 15px;">${escapeHtml(record.studentName)}</span> ｜ 
      🎯 <strong>測驗：</strong>${escapeHtml(record.examTitle)} ｜ 
      🕒 <strong>完成時間：</strong>${timeStr}<br>
      📊 <strong>成績：</strong>${record.score} 分 (Lv. ${record.level || 1}) ｜ 
      🎯 <strong>答對率：</strong><span style="color: #2ed573; font-weight: bold;">${record.accuracy}%</span> (${record.correctCount} 正確 / ${record.wrongCount} 錯誤)
    </div>
  `;

  listEl.innerHTML = "";
  const details = record.details || [];

  if (details.length === 0) {
    listEl.innerHTML = `<div style="text-align: center; color: #a4b0be; padding: 20px;">無逐題作答資料。</div>`;
  } else {
    details.forEach((d, i) => {
      const qCard = document.createElement("div");
      qCard.className = `question-detail-card ${d.isCorrect ? "q-correct" : "q-wrong"}`;

      qCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-weight: bold; color: var(--gold-text); font-size: 14px;">第 ${i + 1} 題</span>
          <span class="q-result-badge ${d.isCorrect ? "badge-correct" : "badge-wrong"}">
            ${d.isCorrect ? "✅ 答對" : "❌ 答錯"}
          </span>
        </div>
        <div style="font-size: 14px; margin-bottom: 8px; color: #fff;">
          ${escapeHtml(d.question)}
        </div>
        <div style="font-size: 12px; display: flex; flex-direction: column; gap: 3px; background: rgba(0,0,0,0.25); padding: 8px; border-radius: 4px;">
          <div>👤 <strong>學生作答：</strong><span style="color: ${d.isCorrect ? "#2ed573" : "#ff4757"};">${escapeHtml(d.studentAnswer || d.selectedText || "未作答")}</span></div>
          <div>💡 <strong>正確解答：</strong><span style="color: #2ed573;">${escapeHtml(d.correctAnswer || d.correctText || "無")}</span></div>
          ${d.explanation ? `<div style="color: #ccd7e6; margin-top: 4px;">📖 <strong>試題解析：</strong>${escapeHtml(d.explanation)}</div>` : ""}
        </div>
      `;

      listEl.appendChild(qCard);
    });
  }

  modal.classList.remove("hidden");
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==============================================
// 勇者與關卡關主數值圖形化自訂管理系統 (Tab 5)
// ==============================================

// 官方預設數值設定與繁體中文詳細備註
const DEFAULT_HERO_AND_BOSS_CONFIG = {
  adminPassword: "admin",
  gameTitle: "紫斑之翼：奇幻大遷徙",
  playerInitial: {
    _說明: "舊版通訊相容設定",
    name: "紫蝶勇者小紫",
    maxHp: 100,
    maxMp: 50,
    attackPower: 35,
    level: 1,
    exp: 0,
    potions: { heal: 3, mana: 2 }
  },
  heroes: {
    _全域說明: "四大紫斑蝶生態守護勇者數值與專屬特技設定檔。使用者可在此手動調整各勇者的基礎生命值、魔力值、攻擊力、暴擊率、被動減傷率，以及三項專屬特技的消耗、威力、回復量與排除選項數。",
    hero_purple: {
      _勇者介紹: "小紫（小紫斑蝶）- 敏捷平衡型 (少年遊俠)，攻守兼備，擅長乘著春風穿梭林間",
      name: "小紫",
      title: "幻紫遊俠",
      butterfly: "小紫斑蝶",
      rhyme: "小紫點一邊",
      element: "風 / 幻光",
      typeDesc: "敏捷平衡型 (少年遊俠)",
      desc: "熱血敏捷的紫蝶少年遊俠，攻守兼備，擅長乘著春風穿梭林間。",
      attackMoveName: "【極光幻紫斬】",
      hp: 100,
      maxHp: 100,
      _hp說明: "基礎生命值上限 (數值越高生存能力越強)",
      mp: 50,
      maxMp: 50,
      _mp說明: "基礎魔力值上限 (用於施放各項專屬特技)",
      atk: 35,
      _atk說明: "基礎普通攻擊力 (答對時造成 atk + 0~7 浮動傷害)",
      critRate: 0.15,
      _critRate說明: "普攻基礎暴擊機率 (0.15 代表 15% 機率觸發 1.5 倍致命暴擊)",
      critMultiplier: 2.2,
      _critMultiplier說明: "暴擊特技的傷害倍率 (2.2 代表造成 2.2 倍重擊傷害)",
      damageReduction: 0.0,
      _damageReduction說明: "被動傷害減免率 (0.0 代表 0%，0.20 代表減免 20% 敵方反擊傷害)",
      skills: [
        {
          id: "SKILL_CRIT",
          name: "✨ 幻紫鱗光",
          type: "crit",
          cost: 15,
          _cost說明: "特技施放消耗 MP",
          multiplier: 2.2,
          _multiplier說明: "特技命中時的傷害倍率 (攻擊力 * multiplier)",
          desc: "答對造成 2.2 倍暴擊傷害",
          _desc說明: "顯示於戰鬥技能選單上的中文簡介"
        },
        {
          id: "SKILL_HEAL",
          name: "🌿 甘露沐浴",
          type: "heal",
          cost: 10,
          _cost說明: "特技施放消耗 MP",
          healAmount: 45,
          _healAmount說明: "答對回復的生命值 (HP)",
          manaRecovery: 0,
          _manaRecovery說明: "答對額外回充的魔力值 (MP)",
          desc: "答對回復 45 HP 並滋養體能",
          _desc說明: "顯示於戰鬥技能選單上的中文簡介"
        },
        {
          id: "SKILL_FIFTY",
          name: "👁️ 複眼透視",
          type: "fifty",
          cost: 20,
          _cost說明: "特技施放消耗 MP",
          removeCount: 2,
          _removeCount說明: "發動特技時自動排除的錯誤選項數量 (預設為 2 個)",
          desc: "自動排除 2 個錯誤選項",
          _desc說明: "顯示於戰鬥技能選單上的中文簡介"
        }
      ]
    },
    hero_round: {
      _勇者介紹: "阿圓（圓翅紫斑蝶）- 高血高防重裝型 (壯士勇者)，身軀雄健如金剛磐石，擁有天生被動減傷",
      name: "阿圓",
      title: "圓翅巨盾戰士",
      butterfly: "圓翅紫斑蝶",
      rhyme: "圓翅兩邊點",
      element: "土 / 磐石",
      typeDesc: "高血高防重裝型 (壯士勇者)",
      desc: "魁梧豪邁的黃金重裝壯士，身軀雄健如金剛磐石，能以厚重雙翅抵擋強勁逆風。",
      attackMoveName: "【裂地重嶽轟】",
      hp: 150,
      maxHp: 150,
      _hp說明: "基礎生命值上限 (擁有四大勇者中最高的生命力)",
      mp: 35,
      maxMp: 35,
      _mp說明: "基礎魔力值上限",
      atk: 30,
      _atk說明: "基礎普通攻擊力",
      critRate: 0.10,
      _critRate說明: "普攻基礎暴擊機率 (10%)",
      critMultiplier: 1.8,
      _critMultiplier說明: "暴擊特技的傷害倍率",
      damageReduction: 0.20,
      _damageReduction說明: "被動傷害減免率 (天生擁有 20% 敵方反擊減傷，極度耐打)",
      skills: [
        {
          id: "SKILL_CRIT",
          name: "🛡️ 金剛破陣擊",
          type: "crit",
          cost: 14,
          _cost說明: "特技施放消耗 MP",
          multiplier: 1.8,
          _multiplier說明: "特技命中時的傷害倍率",
          desc: "厚盾轟擊，造成 1.8 倍傷害",
          _desc說明: "顯示於戰鬥技能選單上的中文簡介"
        },
        {
          id: "SKILL_HEAL",
          name: "🏰 鐵壁自癒",
          type: "heal",
          cost: 12,
          _cost說明: "特技施放消耗 MP",
          healAmount: 60,
          _healAmount說明: "答對回復的生命值 (HP)",
          manaRecovery: 0,
          _manaRecovery說明: "答對額外回充的魔力值 (MP)",
          desc: "啟動磐石護盾並回復 60 HP",
          _desc說明: "顯示於戰鬥技能選單上的中文簡介"
        },
        {
          id: "SKILL_FIFTY",
          name: "🧭 沉著識破",
          type: "fifty",
          cost: 18,
          _cost說明: "特技施放消耗 MP",
          removeCount: 2,
          _removeCount說明: "發動特技時自動排除的錯誤選項數量",
          desc: "冷靜觀察排除 2 個錯誤選項",
          _desc說明: "顯示於戰鬥技能選單上的中文簡介"
        }
      ]
    },
    hero_syl: {
      _勇者介紹: "阿斯（斯氏紫斑蝶）- 高魔智力輔助型 (靈智貓仙)，仙風道骨、智謀超群，擁有充沛法力槽",
      name: "阿斯",
      title: "斯氏靈智賢者",
      butterfly: "斯氏紫斑蝶",
      rhyme: "斯氏有三點",
      element: "水 / 靈泉",
      typeDesc: "高魔智力輔助型 (靈智貓仙)",
      desc: "仙風道骨的靈智智者，身懷三顆神祕黑褐色斑點，智謀超群，善於操控靈泉水息。",
      attackMoveName: "【靈泉天水波】",
      hp: 90,
      maxHp: 90,
      _hp說明: "基礎生命值上限",
      mp: 80,
      maxMp: 80,
      _mp說明: "基礎魔力值上限 (四大勇者中擁有最高法力槽，特技施展頻率最高)",
      atk: 32,
      _atk說明: "基礎普通攻擊力",
      critRate: 0.12,
      _critRate說明: "普攻基礎暴擊機率 (12%)",
      critMultiplier: 2.0,
      _critMultiplier說明: "暴擊特技的傷害倍率",
      damageReduction: 0.05,
      _damageReduction說明: "被動傷害減免率 (5% 靈水護體減傷)",
      skills: [
        {
          id: "SKILL_CRIT",
          name: "🌊 靈波奔騰",
          type: "crit",
          cost: 15,
          _cost說明: "特技施放消耗 MP",
          multiplier: 2.0,
          _multiplier說明: "特技命中時的傷害倍率",
          desc: "喚起碧泉轟擊，造成 2.0 倍傷害",
          _desc說明: "顯示於戰鬥技能選單上的中文簡介"
        },
        {
          id: "SKILL_HEAL",
          name: "💧 靈泉湧現",
          type: "heal",
          cost: 15,
          _cost說明: "特技施放消耗 MP",
          healAmount: 50,
          _healAmount說明: "答對回復的生命值 (HP)",
          manaRecovery: 15,
          _manaRecovery說明: "答對額外回充的魔力值 (MP)",
          desc: "回復 50 HP 並回充 15 MP",
          _desc說明: "顯示於戰鬥技能選單上的中文簡介"
        },
        {
          id: "SKILL_FIFTY",
          name: "🔮 神思慧眼",
          type: "fifty",
          cost: 15,
          _cost說明: "特技施放消耗 MP",
          removeCount: 2,
          _removeCount說明: "發動特技時自動排除的錯誤選項數量",
          desc: "慧眼洞察天機，排除 2 個干擾選項",
          _desc說明: "顯示於戰鬥技能選單上的中文簡介"
        }
      ]
    },
    hero_mul: {
      _勇者介紹: "端端（端紫斑蝶）- 高暴擊爆發型 (暗影刺客)，性情冷酷孤傲、迅捷凌厲，暴擊倍率冠絕群雄",
      name: "端端",
      title: "端紫暗影刺客",
      butterfly: "端紫斑蝶",
      rhyme: "端紫亂亂點",
      element: "火 / 幽冥",
      typeDesc: "高暴擊爆發型 (暗影刺客)",
      desc: "性情冷酷孤傲的暗影刺客，前翅白斑如星辰散落，行動迅捷凌厲，暴擊倍率冠絕群雄。",
      attackMoveName: "【幽炎亂刃滅】",
      hp: 95,
      maxHp: 95,
      _hp說明: "基礎生命值上限",
      mp: 55,
      maxMp: 55,
      _mp說明: "基礎魔力值上限",
      atk: 40,
      _atk說明: "基礎普通攻擊力 (四大勇者中普攻最高)",
      critRate: 0.25,
      _critRate說明: "普攻基礎暴擊機率 (高達 25% 天生致命暴擊率)",
      critMultiplier: 2.6,
      _critMultiplier說明: "暴擊特技的傷害倍率 (造成高達 2.6 倍毀滅性爆發傷害)",
      damageReduction: 0.0,
      _damageReduction說明: "被動傷害減免率",
      skills: [
        {
          id: "SKILL_CRIT",
          name: "🗡️ 亂點千刃斬",
          type: "crit",
          cost: 16,
          _cost說明: "特技施放消耗 MP",
          multiplier: 2.6,
          _multiplier說明: "特技命中時的傷害倍率 (2.6 倍狂暴致命傷害)",
          desc: "答對釋放狂暴連刺，造成 2.6 倍致命傷害",
          _desc說明: "顯示於戰鬥技能選單上的中文簡介"
        },
        {
          id: "SKILL_HEAL",
          name: "🔥 紫焰迷蹤",
          type: "heal",
          cost: 12,
          _cost說明: "特技施放消耗 MP",
          healAmount: 40,
          _healAmount說明: "答對回復的生命值 (HP)",
          manaRecovery: 0,
          _manaRecovery說明: "答對額外回充的魔力值 (MP)",
          desc: "答對造成烈焰衝擊並回復 40 HP",
          _desc說明: "顯示於戰鬥技能選單上的中文簡介"
        },
        {
          id: "SKILL_FIFTY",
          name: "👤 幻影分身",
          type: "fifty",
          cost: 20,
          _cost說明: "特技施放消耗 MP",
          removeCount: 2,
          _removeCount說明: "發動特技時自動排除的錯誤選項數量",
          desc: "暗影殘像迷惑視聽，排除 2 個錯誤選項",
          _desc說明: "顯示於戰鬥技能選單上的中文簡介"
        }
      ]
    }
  },
  chapters: [
    {
      _關主說明: "第 1 關關卡守護魔王各項參數與情境試煉設定",
      chapter: 1,
      name: "第一章：茂林幽谷",
      enemyName: "貪睡巨角仙",
      enemyHp: 100,
      enemyAttack: 15,
      attackInterval: 5.0,
      _attackInterval說明: "關主每隔多少秒主動向主角發動一次突襲攻擊 (預設 5.0 秒)",
      bgImage: "assets/images/forest_bg.jpg",
      spriteImage: "assets/images/slime_sprite.png",
      description: "茂林南國的溫暖幽谷中，貪睡巨角仙擋在啟程的隘口，以斑蝶基礎生態向你發起考驗！"
    },
    {
      _關主說明: "第 2 關關卡守護魔王各項參數與情境試煉設定",
      chapter: 2,
      name: "第二章：月世界惡地",
      enemyName: "狂風沙蜥怪",
      enemyHp: 160,
      enemyAttack: 20,
      attackInterval: 4.5,
      _attackInterval說明: "關主每隔多少秒主動向主角發動一次突襲攻擊 (預設 4.5 秒)",
      bgImage: "assets/images/desert_bg.jpg",
      spriteImage: "assets/images/mirage_sprite.png",
      description: "灰白乾裂的泥岩荒丘，狂風沙蜥怪捲起滾滾塵暴，唯有掌握蜜源植物與耐力知識才能突破！"
    },
    {
      _關主說明: "第 3 關關卡守護魔王各項參數與情境試煉設定",
      chapter: 3,
      name: "第三章：濁水溪河谷",
      enemyName: "雷雲怪鳥",
      enemyHp: 220,
      enemyAttack: 26,
      attackInterval: 4.0,
      _attackInterval說明: "關主每隔多少秒主動向主角發動一次突襲攻擊 (預設 4.0 秒)",
      bgImage: "assets/images/river_bg.jpg",
      spriteImage: "assets/images/demon_sprite.png",
      description: "滾滾河床狂風怒號，雷雲怪鳥以電光與亂流封鎖航道，考驗氣象與地磁導航智慧！"
    },
    {
      _關主說明: "第 4 關關卡守護魔王各項參數與情境試煉設定",
      chapter: 4,
      name: "第四章：國道生態廊道",
      enemyName: "渦輪機械獸",
      enemyHp: 290,
      enemyAttack: 32,
      attackInterval: 3.5,
      _attackInterval說明: "關主每隔多少秒主動向主角發動一次突襲攻擊 (預設 3.5 秒)",
      bgImage: "assets/images/highway_bg.jpg",
      spriteImage: "assets/images/frost_sprite.png",
      description: "車流奔馳的公路險境，巨大渦輪機械獸咆哮推進，唯有理解生態防護網與保育工法方能化解危機！"
    },
    {
      _關主說明: "第 5 關關卡守護魔王各項參數與情境試煉設定",
      chapter: 5,
      name: "第五章：繁衍聖林",
      enemyName: "環境異變巨神",
      enemyHp: 380,
      enemyAttack: 40,
      attackInterval: 3.0,
      _attackInterval說明: "關主每隔多少秒主動向主角發動一次突襲攻擊 (預設 3.0 秒)",
      bgImage: "assets/images/sacred_bg.jpg",
      spriteImage: "assets/images/boss_sprite.png",
      description: "抵達北部繁衍聖地的古老林野，環境異變巨神佇立在生命之泉前，展開決定群蝶未來的終極生態試煉！"
    }
  ]
};

// 內部暫存編輯中的草稿設定
let adminHeroConfigDraft = null;
let currentEditingHeroKey = "hero_purple";
let currentEditingChapterIdx = 0;
let isHeroConfigInitialized = false;

// 確保注入完整的繁體中文註解
function injectChineseAnnotations(cfg) {
  if (!cfg) return cfg;
  const def = DEFAULT_HERO_AND_BOSS_CONFIG;

  if (!cfg.adminPassword) cfg.adminPassword = def.adminPassword;
  if (!cfg.gameTitle) cfg.gameTitle = def.gameTitle;
  if (!cfg.playerInitial) cfg.playerInitial = JSON.parse(JSON.stringify(def.playerInitial));

  if (!cfg.heroes) cfg.heroes = JSON.parse(JSON.stringify(def.heroes));
  cfg.heroes._全域說明 = def.heroes._全域說明;

  const heroKeys = ["hero_purple", "hero_round", "hero_syl", "hero_mul"];
  heroKeys.forEach((k) => {
    if (!cfg.heroes[k]) {
      cfg.heroes[k] = JSON.parse(JSON.stringify(def.heroes[k]));
    } else {
      const hDef = def.heroes[k];
      const hCur = cfg.heroes[k];
      hCur._勇者介紹 = hDef._勇者介紹;
      hCur._hp說明 = hDef._hp說明;
      hCur._mp說明 = hDef._mp說明;
      hCur._atk說明 = hDef._atk說明;
      hCur._critRate說明 = hDef._critRate說明;
      hCur._critMultiplier說明 = hDef._critMultiplier說明;
      hCur._damageReduction說明 = hDef._damageReduction說明;

      if (Array.isArray(hCur.skills) && Array.isArray(hDef.skills)) {
        hCur.skills.forEach((s, idx) => {
          const sDef = hDef.skills[idx];
          if (sDef) {
            s._cost說明 = sDef._cost說明;
            if (sDef._multiplier說明) s._multiplier說明 = sDef._multiplier說明;
            if (sDef._healAmount說明) s._healAmount說明 = sDef._healAmount說明;
            if (sDef._manaRecovery說明) s._manaRecovery說明 = sDef._manaRecovery說明;
            if (sDef._removeCount說明) s._removeCount說明 = sDef._removeCount說明;
            s._desc說明 = sDef._desc說明;
          }
        });
      }
    }
  });

  if (!Array.isArray(cfg.chapters) || cfg.chapters.length < 5) {
    cfg.chapters = JSON.parse(JSON.stringify(def.chapters));
  } else {
    cfg.chapters.forEach((ch, idx) => {
      const chDef = def.chapters[idx];
      if (chDef) {
        ch._關主說明 = chDef._關主說明;
        if (chDef._attackInterval說明) {
          ch._attackInterval說明 = chDef._attackInterval說明;
        }
      }
    });
  }

  return cfg;
}

// 將當前表單數值提取並寫入 Draft 中的勇者資料
function saveCurrentHeroFormToDraft() {
  if (!adminHeroConfigDraft || !adminHeroConfigDraft.heroes || !adminHeroConfigDraft.heroes[currentEditingHeroKey]) return;
  const hero = adminHeroConfigDraft.heroes[currentEditingHeroKey];

  const valName = document.getElementById("cfg-hero-name")?.value.trim();
  const valTitle = document.getElementById("cfg-hero-title")?.value.trim();
  const valAtkName = document.getElementById("cfg-hero-attack-name")?.value.trim();
  const valRhyme = document.getElementById("cfg-hero-rhyme")?.value.trim();
  const valDesc = document.getElementById("cfg-hero-desc")?.value.trim();

  const valHp = parseInt(document.getElementById("cfg-hero-hp")?.value, 10);
  const valMp = parseInt(document.getElementById("cfg-hero-mp")?.value, 10);
  const valAtk = parseInt(document.getElementById("cfg-hero-atk")?.value, 10);
  const valCritRate = parseFloat(document.getElementById("cfg-hero-crit-rate")?.value);
  const valCritMult = parseFloat(document.getElementById("cfg-hero-crit-mult")?.value);
  const valDmgRed = parseFloat(document.getElementById("cfg-hero-dmg-red")?.value);

  if (valName) hero.name = valName;
  if (valTitle) hero.title = valTitle;
  if (valAtkName) hero.attackMoveName = valAtkName;
  if (valRhyme) hero.rhyme = valRhyme;
  if (valDesc) hero.desc = valDesc;

  if (!isNaN(valHp)) { hero.hp = valHp; hero.maxHp = valHp; }
  if (!isNaN(valMp)) { hero.mp = valMp; hero.maxMp = valMp; }
  if (!isNaN(valAtk)) hero.atk = valAtk;
  if (!isNaN(valCritRate)) hero.critRate = Math.round(valCritRate) / 100;
  if (!isNaN(valCritMult)) hero.critMultiplier = Math.round(valCritMult * 10) / 10;
  if (!isNaN(valDmgRed)) hero.damageReduction = Math.round(valDmgRed) / 100;

  if (!Array.isArray(hero.skills)) hero.skills = [];

  // 特技一
  if (!hero.skills[0]) hero.skills[0] = { id: "SKILL_CRIT", type: "crit" };
  const s1Name = document.getElementById("cfg-s1-name")?.value.trim();
  const s1Cost = parseInt(document.getElementById("cfg-s1-cost")?.value, 10);
  const s1Mult = parseFloat(document.getElementById("cfg-s1-mult")?.value);
  const s1Desc = document.getElementById("cfg-s1-desc")?.value.trim();
  if (s1Name) hero.skills[0].name = s1Name;
  if (!isNaN(s1Cost)) hero.skills[0].cost = s1Cost;
  if (!isNaN(s1Mult)) hero.skills[0].multiplier = Math.round(s1Mult * 10) / 10;
  if (s1Desc) hero.skills[0].desc = s1Desc;

  // 特技二
  if (!hero.skills[1]) hero.skills[1] = { id: "SKILL_HEAL", type: "heal" };
  const s2Name = document.getElementById("cfg-s2-name")?.value.trim();
  const s2Cost = parseInt(document.getElementById("cfg-s2-cost")?.value, 10);
  const s2Heal = parseInt(document.getElementById("cfg-s2-heal")?.value, 10);
  const s2Mana = parseInt(document.getElementById("cfg-s2-mana")?.value, 10);
  const s2Desc = document.getElementById("cfg-s2-desc")?.value.trim();
  if (s2Name) hero.skills[1].name = s2Name;
  if (!isNaN(s2Cost)) hero.skills[1].cost = s2Cost;
  if (!isNaN(s2Heal)) hero.skills[1].healAmount = s2Heal;
  if (!isNaN(s2Mana)) hero.skills[1].manaRecovery = s2Mana;
  if (s2Desc) hero.skills[1].desc = s2Desc;

  // 特技三
  if (!hero.skills[2]) hero.skills[2] = { id: "SKILL_FIFTY", type: "fifty" };
  const s3Name = document.getElementById("cfg-s3-name")?.value.trim();
  const s3Cost = parseInt(document.getElementById("cfg-s3-cost")?.value, 10);
  const s3Remove = parseInt(document.getElementById("cfg-s3-remove")?.value, 10);
  const s3Desc = document.getElementById("cfg-s3-desc")?.value.trim();
  if (s3Name) hero.skills[2].name = s3Name;
  if (!isNaN(s3Cost)) hero.skills[2].cost = s3Cost;
  if (!isNaN(s3Remove)) hero.skills[2].removeCount = s3Remove;
  if (s3Desc) hero.skills[2].desc = s3Desc;
}

// 將 Draft 中的勇者資料填入表單
function loadHeroDraftToForm(heroKey) {
  if (!adminHeroConfigDraft || !adminHeroConfigDraft.heroes) return;
  const hero = adminHeroConfigDraft.heroes[heroKey];
  if (!hero) return;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = (val !== undefined && val !== null) ? val : "";
  };

  setVal("cfg-hero-name", hero.name);
  setVal("cfg-hero-title", hero.title);
  setVal("cfg-hero-attack-name", hero.attackMoveName || "【斑蝶瞬影擊】");
  setVal("cfg-hero-rhyme", hero.rhyme);
  setVal("cfg-hero-desc", hero.desc);

  setVal("cfg-hero-hp", hero.hp);
  setVal("cfg-hero-mp", hero.mp);
  setVal("cfg-hero-atk", hero.atk);
  setVal("cfg-hero-crit-rate", Math.round((hero.critRate || 0) * 100));
  setVal("cfg-hero-crit-mult", hero.critMultiplier || 2.0);
  setVal("cfg-hero-dmg-red", Math.round((hero.damageReduction || 0) * 100));

  const skills = hero.skills || [];
  const s1 = skills[0] || {};
  setVal("cfg-s1-name", s1.name);
  setVal("cfg-s1-cost", s1.cost);
  setVal("cfg-s1-mult", s1.multiplier || 2.2);
  setVal("cfg-s1-desc", s1.desc);

  const s2 = skills[1] || {};
  setVal("cfg-s2-name", s2.name);
  setVal("cfg-s2-cost", s2.cost);
  setVal("cfg-s2-heal", s2.healAmount || 45);
  setVal("cfg-s2-mana", s2.manaRecovery || 0);
  setVal("cfg-s2-desc", s2.desc);

  const s3 = skills[2] || {};
  setVal("cfg-s3-name", s3.name);
  setVal("cfg-s3-cost", s3.cost);
  setVal("cfg-s3-remove", s3.removeCount || 2);
  setVal("cfg-s3-desc", s3.desc);
}

// 將當前表單數值提取並寫入 Draft 中的關主資料
function saveCurrentBossFormToDraft() {
  if (!adminHeroConfigDraft || !Array.isArray(adminHeroConfigDraft.chapters)) return;
  const chapter = adminHeroConfigDraft.chapters[currentEditingChapterIdx];
  if (!chapter) return;

  const valTitle = document.getElementById("cfg-boss-chapter-title")?.value.trim();
  const valEnemyName = document.getElementById("cfg-boss-enemy-name")?.value.trim();
  const valHp = parseInt(document.getElementById("cfg-boss-hp")?.value, 10);
  const valAtk = parseInt(document.getElementById("cfg-boss-atk")?.value, 10);
  const valInterval = parseFloat(document.getElementById("cfg-boss-attack-interval")?.value);
  const valDesc = document.getElementById("cfg-boss-desc")?.value.trim();

  if (valTitle) chapter.name = valTitle;
  if (valEnemyName) chapter.enemyName = valEnemyName;
  if (!isNaN(valHp)) { chapter.enemyHp = valHp; chapter.hp = valHp; }
  if (!isNaN(valAtk)) { chapter.enemyAttack = valAtk; chapter.atk = valAtk; }
  if (!isNaN(valInterval) && valInterval > 0) {
    chapter.attackInterval = Math.round(valInterval * 10) / 10;
  }
  if (valDesc) { chapter.description = valDesc; chapter.intro = valDesc; }
}

// 將 Draft 中的關主資料填入表單
function loadBossDraftToForm(chapterIdx) {
  if (!adminHeroConfigDraft || !Array.isArray(adminHeroConfigDraft.chapters)) return;
  const chapter = adminHeroConfigDraft.chapters[chapterIdx];
  if (!chapter) return;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = (val !== undefined && val !== null) ? val : "";
  };

  setVal("cfg-boss-chapter-title", chapter.name || chapter.title || `第 ${chapterIdx + 1} 章`);
  setVal("cfg-boss-enemy-name", chapter.enemyName || "守護魔王");
  setVal("cfg-boss-hp", chapter.enemyHp !== undefined ? chapter.enemyHp : chapter.hp);
  setVal("cfg-boss-atk", chapter.enemyAttack !== undefined ? chapter.enemyAttack : chapter.atk);

  // 預設關卡間隔：第 1 關 5s、第 2 關 4.5s、第 3 關 4s、第 4 關 3.5s、第 5 關 3s
  const defaultIntervals = [5.0, 4.5, 4.0, 3.5, 3.0];
  const currentInterval = chapter.attackInterval !== undefined ? chapter.attackInterval : (defaultIntervals[chapterIdx] || 5.0);
  setVal("cfg-boss-attack-interval", currentInterval);

  setVal("cfg-boss-desc", chapter.description || chapter.intro || "");
}

// 刷新關主切換膠囊按鈕標題文字
function updateBossPillLabels() {
  if (!adminHeroConfigDraft || !Array.isArray(adminHeroConfigDraft.chapters)) return;
  const pills = document.querySelectorAll("#admin-boss-pills-row .admin-pill-btn");
  pills.forEach((p) => {
    const idx = parseInt(p.dataset.chapterIdx, 10);
    const ch = adminHeroConfigDraft.chapters[idx];
    if (ch) {
      p.textContent = `第 ${idx + 1} 關：${ch.enemyName || '魔王'}`;
    }
  });
}

// 初始化勇者與關主設定面板的所有事件與初次載入
function initHeroAndBossConfigEvents() {
  if (isHeroConfigInitialized) return;
  isHeroConfigInitialized = true;

  // 1. 子分頁切換 (四大勇者 vs 五大關主)
  const subtabBtnHeroes = document.getElementById("subtab-btn-heroes");
  const subtabBtnBosses = document.getElementById("subtab-btn-bosses");
  const subpanelHeroes = document.getElementById("subpanel-heroes-config");
  const subpanelBosses = document.getElementById("subpanel-bosses-config");

  subtabBtnHeroes?.addEventListener("click", () => {
    SoundFX.playClick();
    saveCurrentBossFormToDraft();
    subtabBtnHeroes.classList.add("active");
    subtabBtnBosses?.classList.remove("active");
    subpanelHeroes?.classList.remove("hidden");
    subpanelBosses?.classList.add("hidden");
    loadHeroDraftToForm(currentEditingHeroKey);
  });

  subtabBtnBosses?.addEventListener("click", () => {
    SoundFX.playClick();
    saveCurrentHeroFormToDraft();
    subtabBtnBosses.classList.add("active");
    subtabBtnHeroes?.classList.remove("active");
    subpanelBosses?.classList.remove("hidden");
    subpanelHeroes?.classList.add("hidden");
    loadBossDraftToForm(currentEditingChapterIdx);
  });

  // 2. 勇者切換膠囊按鈕
  const heroPills = document.querySelectorAll("#admin-hero-pills-row .admin-pill-btn");
  heroPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      SoundFX.playSelect();
      saveCurrentHeroFormToDraft();
      heroPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentEditingHeroKey = pill.dataset.heroKey;
      loadHeroDraftToForm(currentEditingHeroKey);
    });
  });

  // 3. 關卡切換膠囊按鈕
  const bossPills = document.querySelectorAll("#admin-boss-pills-row .admin-pill-btn");
  bossPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      SoundFX.playSelect();
      saveCurrentBossFormToDraft();
      bossPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentEditingChapterIdx = parseInt(pill.dataset.chapterIdx, 10) || 0;
      loadBossDraftToForm(currentEditingChapterIdx);
    });
  });

  // 4. 儲存按鈕
  const btnSave = document.getElementById("btn-save-hero-config");
  btnSave?.addEventListener("click", async () => {
    SoundFX.playSelect();
    saveCurrentHeroFormToDraft();
    saveCurrentBossFormToDraft();

    // 注入繁體中文說明備註
    injectChineseAnnotations(adminHeroConfigDraft);

    btnSave.disabled = true;
    btnSave.textContent = "⏳ 儲存中...";

    try {
      const res = await DataManager.updateConfig(adminHeroConfigDraft);
      if (res && res.success) {
        alert("🎉 " + (res.message || "四大勇者與五大關主數值已成功儲存至 config.json，並自動保留完整中文備註！"));
      } else {
        alert("⚠️ 儲存回傳：" + (res?.message || "未知狀態"));
      }

      // 重新渲染主畫面勇者卡片
      renderHeroSelectionGrid();
      updateBossPillLabels();
    } catch (err) {
      alert("儲存設定失敗：" + err.message);
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = "💾 儲存勇者與關主設定至 config.json";
    }
  });

  // 5. 還原官方預設數值按鈕
  const btnReset = document.getElementById("btn-reset-hero-config");
  btnReset?.addEventListener("click", async () => {
    SoundFX.playClick();
    const confirmed = confirm("確定要將四大勇者數值與五大關卡魔王設定還原為官方預設數值嗎？\n（您所做的自訂修改將被覆蓋）");
    if (!confirmed) return;

    adminHeroConfigDraft = JSON.parse(JSON.stringify(DEFAULT_HERO_AND_BOSS_CONFIG));
    loadHeroDraftToForm(currentEditingHeroKey);
    loadBossDraftToForm(currentEditingChapterIdx);
    updateBossPillLabels();

    try {
      await DataManager.updateConfig(adminHeroConfigDraft);
      renderHeroSelectionGrid();
      alert("🔄 已成功還原為官方預設數值並寫入 config.json！");
    } catch (err) {
      alert("還原失敗：" + err.message);
    }
  });
}

// 每次進入 Tab 5 時執行渲染與草稿同步
function renderHeroAndBossConfigUI() {
  initHeroAndBossConfigEvents();

  // 從 DataManager 取得當前設定，若無則使用預設官方設定
  const currentConfig = DataManager.getConfig();
  if (currentConfig && currentConfig.heroes) {
    adminHeroConfigDraft = JSON.parse(JSON.stringify(currentConfig));
  } else {
    adminHeroConfigDraft = JSON.parse(JSON.stringify(DEFAULT_HERO_AND_BOSS_CONFIG));
  }

  // 確保結構齊全
  injectChineseAnnotations(adminHeroConfigDraft);

  // 載入當前勇者與關主表單
  loadHeroDraftToForm(currentEditingHeroKey);
  loadBossDraftToForm(currentEditingChapterIdx);
  updateBossPillLabels();
}

// =========================================================================
// 後台 Tab 6：自訂圖片取代、AI 生圖 Prompt 與壓縮檔批次處理
// =========================================================================

let cachedImagesData = null;
let currentImagesCategory = "all";
let isImagesEventsInitialized = false;

// 複製純文字至剪貼簿（相容現代瀏覽器與傳統環境）
async function copyTextToClipboard(text, btnElement) {
  let success = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      success = true;
    }
  } catch (e) {
    // 若 Clipboard API 權限受限，自動平滑切換至 DOM 降級方案
  }

  if (!success) {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-999999px";
      textarea.style.top = "-999999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      success = document.execCommand("copy");
      textarea.remove();
    } catch (e) {
      console.error("降級複製失敗：", e);
    }
  }

  if (success) {
    SoundFX.playClick();
    if (btnElement) {
      const originalText = btnElement.innerHTML;
      btnElement.innerHTML = "✅ 已複製！";
      btnElement.classList.add("btn-copied-success");
      setTimeout(() => {
        btnElement.innerHTML = originalText;
        btnElement.classList.remove("btn-copied-success");
      }, 1800);
    }
  } else {
    alert("複製失敗，請手動選取文字進行複製。");
  }
}


// ===================================================
// 固定 20 張圖片風格主題生圖 Prompt 模板清單 (AI Agent 一鍵生成專用)
// ===================================================
const PROMPT_TEMPLATES_20 = [
  // --- 四大勇者系列 (8 張) ---
  {
    filename: "hero_sprite.png",
    category: "heroes",
    categoryName: "四大紫斑蝶勇者",
    name: "主角勇者立繪",
    spec: "PNG (透明背景) ｜ 建議 800×1000",
    role: "敏捷平衡型 (少年遊俠)",
    desc: "戰鬥舞台主角全身戰鬥姿態立繪",
    getPrompt: (style, theme) => `尺寸規格：800×1000，PNG 透明背景。風格為【${style}】。世界觀主題為【${theme}】。主角少年遊俠全身戰鬥姿態立繪，身手敏捷，目光充滿勇氣與冒險熱情，身著輕裝冒險者皮甲與飄逸紅圍巾，右手持握閃耀微光的短刃，背負半透明且具備【${theme}】特徵的奇幻蝶翼，熱血自信的笑容，全身站姿，線條俐落分明，乾淨透明背景。`
  },
  {
    filename: "avatar_purple.png",
    category: "heroes",
    categoryName: "四大紫斑蝶勇者",
    name: "主角勇者頭像",
    spec: "PNG (透明背景) ｜ 建議 400×400",
    role: "主角頭像",
    desc: "主畫面、對話框與對抗狀態頭像",
    getPrompt: (style, theme) => `尺寸規格：400×400，PNG 透明背景，正方形大頭貼。風格為【${style}】。主題為【${theme}】。主角少年遊俠臉部特寫，燦爛熱血的微笑，明亮堅毅的雙眼，俐落髮型佩戴護目鏡與【${theme}】特徵頭飾，紅圍巾領口，RPG 對話框角色頭像，乾淨透明背景。`
  },
  {
    filename: "hero_sprite_round.png",
    category: "heroes",
    categoryName: "四大紫斑蝶勇者",
    name: "重裝巨盾戰士立繪",
    spec: "PNG (透明背景) ｜ 建議 800×1000",
    role: "高血高防重裝型 (壯士勇者)",
    desc: "戰鬥舞台阿圓全身防禦戰鬥姿態立繪",
    getPrompt: (style, theme) => `尺寸規格：800×1000，PNG 透明背景。風格為【${style}】。世界觀主題為【${theme}】。重裝巨盾戰士全身立繪，魁梧雄健的身軀，身披厚重黃金重金屬板甲，手持刻有【${theme}】圖騰的巨大磐石重盾，豪邁大笑，粗獷自信，大地色光暈護體，厚重戰靴踏地，堅固防禦戰鬥姿態，全身立繪，乾淨透明背景。`
  },
  {
    filename: "avatar_round.png",
    category: "heroes",
    categoryName: "四大紫斑蝶勇者",
    name: "重裝巨盾戰士頭像",
    spec: "PNG (透明背景) ｜ 建議 400×400",
    role: "重裝戰士頭像",
    desc: "阿圓主畫面選角與對話框頭像",
    getPrompt: (style, theme) => `尺寸規格：400×400，PNG 透明背景，正方形頭像。風格為【${style}】。主題為【${theme}】。重裝戰士臉部特寫，豪邁大笑神情，金屬戰士頭盔，厚實下巴與堅毅笑容，黃金大地色調，RPG 對話框角色頭像，乾淨透明背景。`
  },
  {
    filename: "hero_sprite_syl.png",
    category: "heroes",
    categoryName: "四大紫斑蝶勇者",
    name: "靈智貓仙賢者立繪",
    spec: "PNG (透明背景) ｜ 建議 800×1000",
    role: "極限法攻魔導型 (擬人動物)",
    desc: "戰鬥舞台阿斯賢者懸浮施法姿態立繪",
    getPrompt: (style, theme) => `尺寸規格：800×1000，PNG 透明背景。風格為【${style}】。世界觀主題為【${theme}】。可愛擬人白貓大賢者全身立繪，圓臉可愛貓咪，左眼戴著復古金色單片眼鏡，身穿繡有星象星座與【${theme}】圖騰的魔導學者長袍，雙手握持頂端鑲嵌閃電水晶的古木法杖，背後有半透明靈翼，輕柔浮空施法姿態，乾淨透明背景。`
  },
  {
    filename: "avatar_syl.png",
    category: "heroes",
    categoryName: "四大紫斑蝶勇者",
    name: "靈智貓仙賢者頭像",
    spec: "PNG (透明背景) ｜ 建議 400×400",
    role: "貓仙賢者頭像",
    desc: "阿斯主畫面選角與對話框頭像",
    getPrompt: (style, theme) => `尺寸規格：400×400，PNG 透明背景，正方形頭像。風格為【${style}】。主題為【${theme}】。貓咪大賢者頭像特寫，金色單片眼鏡，眼神聰穎睿智，藍色學者帽與袍領，可愛毛茸茸臉龐，RPG 對話框角色頭像，乾淨透明背景。`
  },
  {
    filename: "hero_sprite_mul.png",
    category: "heroes",
    categoryName: "四大紫斑蝶勇者",
    name: "暗影英氣刺客立繪",
    spec: "PNG (透明背景) ｜ 建議 800×1000",
    role: "極限暴擊連擊型 (女刺客)",
    desc: "戰鬥舞台端端女刺客突進戰鬥立繪",
    getPrompt: (style, theme) => `尺寸規格：800×1000，PNG 透明背景。風格為【${style}】。世界觀主題為【${theme}】。英氣俐落的女忍者刺客全身立繪，俐落暗紫色短髮，修長靈動矯健身形，身著暗夜隱密夜行裝，雙手反握雙羽刃短刀，眼神冷酷專注，周身微泛紫炎流光粒子，疾走突進戰鬥架式，全身立繪，乾淨透明背景。`
  },
  {
    filename: "avatar_mul.png",
    category: "heroes",
    categoryName: "四大紫斑蝶勇者",
    name: "暗影英氣刺客頭像",
    spec: "PNG (透明背景) ｜ 建議 400×400",
    role: "暗影刺客頭像",
    desc: "端端主畫面選角與對話框頭像",
    getPrompt: (style, theme) => `尺寸規格：400×400，PNG 透明背景，正方形頭像。風格為【${style}】。主題為【${theme}】。英氣女刺客頭像特寫，暗紫短髮，銳利冷酷眼眸，輕微自信冷笑神情，高領忍裝，RPG 對話框角色頭像，乾淨透明背景。`
  },

  // --- 五大關卡試煉魔王 (5 張) ---
  {
    filename: "slime_sprite.png",
    category: "bosses",
    categoryName: "五大關卡試煉魔王",
    name: "第 1 關關主魔王立繪",
    spec: "PNG (透明背景) ｜ 建議 800×900",
    role: "第 1 關關主 (貪睡巨角仙定位)",
    desc: "第一章守護魔王戰鬥立繪",
    getPrompt: (style, theme) => `尺寸規格：800×900，PNG 透明背景。風格為【${style}】。主題為【${theme}】。第 1 關守護魔王，圓滾滾肥嘟嘟的巨型獨角仙昆蟲怪獸，巨大犄角上戴著條紋睡帽，鼻孔吹著可愛半透明睡泡泡，雙手抱著符合【${theme}】特徵的植物當抱枕，油亮甲殼，滑稽逗趣的生動表情，2D RPG BOSS 戰鬥立繪，乾淨透明背景。`
  },
  {
    filename: "mirage_sprite.png",
    category: "bosses",
    categoryName: "五大關卡試煉魔王",
    name: "第 2 關關主魔王立繪",
    spec: "PNG (透明背景) ｜ 建議 800×900",
    role: "第 2 關關主 (狂風沙蜥怪定位)",
    desc: "第二章惡地守護魔王戰鬥立繪",
    getPrompt: (style, theme) => `尺寸規格：800×900，PNG 透明背景。風格為【${style}】。主題為【${theme}】。第 2 關惡地守護魔王，蜥蜴人部落風格沙漠爬蟲戰士，土黃色鱗片肌膚，頭戴防風目鏡與破舊防沙披風，手持帶刺的粗獷狼牙棒，狡黠尖牙笑容，腳邊揚起旋風沙塵，戰鬥待機姿態，2D RPG 關主立繪，乾淨透明背景。`
  },
  {
    filename: "demon_sprite.png",
    category: "bosses",
    categoryName: "五大關卡試煉魔王",
    name: "第 3 關關主魔王立繪",
    spec: "PNG (透明背景) ｜ 建議 800×900",
    role: "第 3 關關主 (雷雲怪鳥定位)",
    desc: "第三章河谷守護魔王戰鬥立繪",
    getPrompt: (style, theme) => `尺寸規格：800×900，PNG 透明背景。風格為【${style}】。主題為【${theme}】。第 3 關峽谷風暴魔王，巨型雷雲猛禽怪鳥，身軀覆蓋著烏雲般的深灰藍羽毛，眼眸發出刺眼金黃電光，翼尖與銳利巨爪劈啪跳躍著藍白色閃電電弧，巨喙張開怒吼咆哮，霸氣展翅俯衝姿態，2D RPG 關主立繪，乾淨透明背景。`
  },
  {
    filename: "frost_sprite.png",
    category: "bosses",
    categoryName: "五大關卡試煉魔王",
    name: "第 4 關關主魔王立繪",
    spec: "PNG (透明背景) ｜ 建議 800×900",
    role: "第 4 關關主 (渦輪機械獸定位)",
    desc: "第四章國道廊道守護魔王立繪",
    getPrompt: (style, theme) => `尺寸規格：800×900，PNG 透明背景。風格為【${style}】。主題為【${theme}】。第 4 關守護巨獸，鋼鐵鉚釘裝甲重裝機械犀牛怪獸，背上架著旋轉渦輪發動機與高溫燒紅排氣管，噴射出滾滾白煙，雙眼車燈紅光怒視，狂暴向前衝撞姿態，2D RPG 關主立繪，乾淨透明背景。`
  },
  {
    filename: "boss_sprite.png",
    category: "bosses",
    categoryName: "五大關卡試煉魔王",
    name: "第 5 關終極守護巨神立繪",
    spec: "PNG (透明背景) ｜ 建議 900×1000",
    role: "第 5 關終極關主 (環境異變巨神定位)",
    desc: "第五章繁衍聖地終極守護魔王立繪",
    getPrompt: (style, theme) => `尺寸規格：900×1000，PNG 透明背景。風格為【${style}】。主題為【${theme}】。第 5 關終極巨神，巍峨古老的生機守護者，左半身為千年古樹巨木生機盎然繁花盛開，右半身則異變成晶瑩剔透的紫水晶鎧甲與能量核心，周身環繞著神聖與浩瀚神性光暈，莊嚴威儀，2D RPG 終極最終魔王立繪，乾淨透明背景。`
  },

  // --- 五大關卡戰鬥背景 (5 張) ---
  {
    filename: "forest_bg.jpg",
    category: "backgrounds",
    categoryName: "五大關卡戰鬥背景",
    name: "第 1 關戰鬥背景",
    spec: "JPG (16:9 寬螢幕) ｜ 建議 1920×1080",
    role: "第 1 關背景 (茂林越冬幽谷定位)",
    desc: "第一章幽谷戰鬥場景",
    getPrompt: (style, theme) => `尺寸規格：1920×1080，16:9 寬螢幕橫幅。風格為【${style}】。主題為【${theme}】。第 1 關起點秘境幽谷場景，溫暖金色晨光穿透繁茂的林冠，清澈蜿蜒的溪流與長滿青苔的卵石，成千上萬與【${theme}】相關的靈性生物在空中漫天飛舞，寧靜祥和而充滿生機，日系 2D RPG 戰鬥舞台背景。`
  },
  {
    filename: "desert_bg.jpg",
    category: "backgrounds",
    categoryName: "五大關卡戰鬥背景",
    name: "第 2 關戰鬥背景",
    spec: "JPG (16:9 寬螢幕) ｜ 建議 1920×1080",
    role: "第 2 關背景 (月世界泥岩惡地定位)",
    desc: "第二章荒丘戰鬥場景",
    getPrompt: (style, theme) => `尺寸規格：1920×1080，16:9 寬螢幕橫幅。風格為【${style}】。主題為【${theme}】。第 2 關荒原惡地荒丘場景，灰白色尖銳鋸齒狀侵蝕山脊與乾涸龜裂的地表，零星耐旱灌木，正午烈日下沙塵微捲，蒼茫壯闊的荒野峽谷全景，日系 2D RPG 戰鬥舞台背景。`
  },
  {
    filename: "river_bg.jpg",
    category: "backgrounds",
    categoryName: "五大關卡戰鬥背景",
    name: "第 3 關戰鬥背景",
    spec: "JPG (16:9 寬螢幕) ｜ 建議 1920×1080",
    role: "第 3 關背景 (濁水溪壯闊河谷定位)",
    desc: "第三章河床戰鬥場景",
    getPrompt: (style, theme) => `尺寸規格：1920×1080，16:9 寬螢幕橫幅。風格為【${style}】。主題為【${theme}】。第 3 關廣袤礫石河床戰鬥場景，寬廣河道與無盡鵝卵石灘，遠方中央山脈層巒疊嶂，天際聚集厚重翻騰的暴風雷雨雲層，閃電掠過天際，狂風呼嘯，大氣磅礡壯烈，日系 2D RPG 戰鬥舞台背景。`
  },
  {
    filename: "highway_bg.jpg",
    category: "backgrounds",
    categoryName: "五大關卡戰鬥背景",
    name: "第 4 關戰鬥背景",
    spec: "JPG (16:9 寬螢幕) ｜ 建議 1920×1080",
    role: "第 4 關背景 (國道生態廊道定位)",
    desc: "第四章生態廊道戰鬥場景",
    getPrompt: (style, theme) => `尺寸規格：1920×1080，16:9 寬螢幕橫幅。風格為【${style}】。主題為【${theme}】。第 4 關人工與自然和諧走廊戰鬥背景，路旁立著高大保護防護網引導生態群前進，一旁為現代柏油道路，背景為連綿青山與晴朗藍天，成群生靈飛躍，人與自然和諧共存，日系 2D RPG 戰鬥舞台背景。`
  },
  {
    filename: "sacred_bg.jpg",
    category: "backgrounds",
    categoryName: "五大關卡戰鬥背景",
    name: "第 5 關戰鬥背景",
    spec: "JPG (16:9 寬螢幕) ｜ 建議 1920×1080",
    role: "第 5 關背景 (竹南繁衍聖地古林定位)",
    desc: "第五章繁衍聖地終極戰鬥背景",
    getPrompt: (style, theme) => `尺寸規格：1920×1080，16:9 寬螢幕橫幅。風格為【${style}】。主題為【${theme}】。第 5 關繁衍傳承聖地古林場景，高聳參天的巨木神樹與古藤交織，林下開滿奇異繁花，夢幻般純淨的晨曦金光如聖光灑落林間薄霧，生機蓬勃的生命天堂，日系 2D RPG 終極戰鬥舞台背景。`
  },

  // --- 遊戲全域場景 (2 張) ---
  {
    filename: "title_bg.jpg",
    category: "system",
    categoryName: "遊戲全域場景",
    name: "冒險啟程主畫面背景",
    spec: "JPG (16:9 寬螢幕) ｜ 建議 1920×1080",
    role: "主選單/選角全螢幕背景",
    desc: "主登入與選角畫面全螢幕背景",
    getPrompt: (style, theme) => `尺寸規格：1920×1080，16:9 寬螢幕橫幅。風格為【${style}】。主題為【${theme}】。遊戲主登入與選角畫面全螢幕背景，鳥瞰壯麗山海全景，成群【${theme}】的奇幻生靈浩浩蕩蕩迎向朝陽展翅遠航，充滿希望與史詩冒險感的壯闊序幕，日系 2D RPG 開場主視覺。`
  },
  {
    filename: "world_map.jpg",
    category: "system",
    categoryName: "遊戲全域場景",
    name: "世界冒險探索大地圖",
    spec: "JPG (16:9 寬螢幕) ｜ 建議 1920×1080",
    role: "世界地圖探索場景",
    desc: "世界大地圖探索與關卡導航地圖底圖",
    getPrompt: (style, theme) => `尺寸規格：1920×1080，16:9 寬螢幕橫幅。風格為【${style}】。主題為【${theme}】。復古羊皮紙手繪奇幻冒險探索世界大地圖，標繪五大關卡地標圖釘與【${theme}】的冒險前進航線，細膩繪製高山、森林、河川與荒原，經典 RPG 世界地圖手繪風格。`
  }
];

// 組裝交付給外部 AI Agent 的全套 20 張生圖任務文字
function buildAgentTaskInstruction(style, theme) {
  let text = `# 🎨 2D RPG 遊戲全套 20 張美術素材批次生成任務指令\n\n`;
  text += `請扮演專業遊戲主美與 AI 圖像生成工程師。\n`;
  text += `我們正在製作一款 2D RPG 題庫答題冒險遊戲，視覺美術風格設定為【${style}】，世界觀主題為【${theme}】。\n\n`;
  text += `【任務目標】\n`;
  text += `請為以下 20 個固定檔案名稱產出符合風格與主題的繁體中文高畫質生圖提示詞（可直接供 Midjourney / DALL-E 3 / Stable Diffusion / Recraft 生成圖片）。\n`;
  text += `生成完成後，使用者會將圖片以對應「固定檔名」儲存，並壓縮成 ZIP 檔直接匯入遊戲系統。\n\n`;
  text += `【核心規範】\n`;
  text += `1. 檔名嚴格對應：產出的圖檔檔名必須 100% 符合下列 20 個指定英文檔名（包含副檔名與大小寫）。\n`;
  text += `2. 尺寸比例規範：立繪與頭像必須符合透明背景 PNG 要求；戰鬥與場景背景必須為 16:9 寬螢幕比例。\n`;
  text += `3. 風格連貫性：4 位勇者、5 位關主魔王與 5 大背景之色彩與筆觸需保持連貫一致的【${style}】。\n\n`;
  text += `===============================================\n`;
  text += `📋 全套 20 張圖片固定檔名、規格與參考生圖 Prompt 清單：\n`;
  text += `===============================================\n\n`;

  PROMPT_TEMPLATES_20.forEach((item, idx) => {
    const promptContent = item.getPrompt(style, theme);
    text += `### [${idx + 1}/20] 檔名：${item.filename}\n`;
    text += `- 分類定位：${item.categoryName} ｜ ${item.name} (${item.role})\n`;
    text += `- 規格格式：${item.spec}\n`;
    text += `- 生圖提示詞（繁體中文）：\n`;
    text += `  ${promptContent}\n\n`;
  });

  text += `===============================================\n`;
  text += `💡 交付格式說明：請逐項或批次生成上述 20 張符合指定檔名之精美遊戲美術圖檔。\n`;

  return text;
}

// 初始化風格主題 Prompt 產生器事件
let isPromptGenInitialized = false;
function initPromptGeneratorEvents() {
  if (isPromptGenInitialized) return;
  isPromptGenInitialized = true;

  const styleInput = document.getElementById("input-prompt-style");
  const themeInput = document.getElementById("input-prompt-theme");
  const taskTextarea = document.getElementById("agent-task-prompt-textarea");
  const btnGenAll = document.getElementById("btn-generate-all-prompts");
  const btnCopyAgent = document.getElementById("btn-copy-agent-full-task");
  const btnCopyPreview = document.getElementById("btn-copy-preview-text");
  const btnApplyCards = document.getElementById("btn-apply-prompts-to-cards");
  const btnReset = document.getElementById("btn-reset-prompt-theme");
  const btnToggleView = document.getElementById("btn-toggle-prompt-gen-view");
  const boxWrapper = document.getElementById("admin-prompt-generator-box");

  // 1. 更新 Textarea 內容的共用函式
  function updateGeneratorOutput() {
    const style = (styleInput?.value || "鳥山明七龍珠熱血冒險風格").trim();
    const theme = (themeInput?.value || "台灣紫斑蝶生態大遷徙").trim();
    const taskText = buildAgentTaskInstruction(style, theme);
    if (taskTextarea) {
      taskTextarea.value = taskText;
    }
    return { style, theme, taskText };
  }

  // 初始生成一次
  updateGeneratorOutput();

  // 2. 點選快速風格標籤
  const styleChips = document.querySelectorAll("#quick-style-tags .quick-chip-btn");
  styleChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      SoundFX.playClick();
      styleChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      if (styleInput) {
        styleInput.value = chip.getAttribute("data-val") || chip.textContent.trim();
      }
      updateGeneratorOutput();
    });
  });

  // 3. 點選快速主題標籤
  const themeChips = document.querySelectorAll("#quick-theme-tags .quick-chip-btn");
  themeChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      SoundFX.playClick();
      themeChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      if (themeInput) {
        themeInput.value = chip.getAttribute("data-val") || chip.textContent.trim();
      }
      updateGeneratorOutput();
    });
  });

  // 輸入框即時監聽
  styleInput?.addEventListener("input", () => {
    styleChips.forEach((c) => c.classList.remove("active"));
    updateGeneratorOutput();
  });
  themeInput?.addEventListener("input", () => {
    themeChips.forEach((c) => c.classList.remove("active"));
    updateGeneratorOutput();
  });

  // 4. 點擊「⚡ 產出 20 張全套生圖 Prompt 模板清單」
  btnGenAll?.addEventListener("click", () => {
    SoundFX.playSkillCast();
    const { style, theme } = updateGeneratorOutput();
    alert(`🎉 已成功組裝【${style}】×【${theme}】全套 20 張生圖 Prompt 模板！\n\n可直接點擊「一鍵複製」按鈕將整段任務發送給 AI Agent。`);
  });

  // 5. 點擊「📋 一鍵複製全套 20 張指令（交給 AI Agent）」
  btnCopyAgent?.addEventListener("click", () => {
    const { taskText } = updateGeneratorOutput();
    copyTextToClipboard(taskText, btnCopyAgent);
  });

  btnCopyPreview?.addEventListener("click", () => {
    const { taskText } = updateGeneratorOutput();
    copyTextToClipboard(taskText, btnCopyPreview);
  });

  // 6. 點擊「🔄 同步更新下方圖片卡片 Prompt」
  btnApplyCards?.addEventListener("click", () => {
    SoundFX.playSelect();
    const style = (styleInput?.value || "鳥山明七龍珠熱血冒險風格").trim();
    const theme = (themeInput?.value || "台灣紫斑蝶生態大遷徙").trim();

    if (cachedImagesData && Array.isArray(cachedImagesData.images)) {
      cachedImagesData.images.forEach((img) => {
        const tmpl = PROMPT_TEMPLATES_20.find((t) => t.filename.toLowerCase() === img.filename.toLowerCase());
        if (tmpl) {
          img.promptZh = tmpl.getPrompt(style, theme);
        }
      });
      renderImagesGrid();
      alert(`✨ 下方 20 張圖片卡片已全面同步更新為【${style}】×【${theme}】的新 Prompt！\n\n每張卡片皆可單獨一鍵複製最新中文生圖提示詞。`);
    }
  });

  // 7. 點擊「↺ 重設為原版」
  btnReset?.addEventListener("click", () => {
    SoundFX.playClick();
    if (styleInput) styleInput.value = "鳥山明七龍珠熱血冒險風格";
    if (themeInput) themeInput.value = "台灣紫斑蝶生態大遷徙";
    styleChips.forEach((c, idx) => c.classList.toggle("active", idx === 0));
    themeChips.forEach((c, idx) => c.classList.toggle("active", idx === 0));
    updateGeneratorOutput();
    // 重新載入原版
    renderImagesManagementUI();
  });

  // 8. 收合 / 展開面板
  btnToggleView?.addEventListener("click", () => {
    SoundFX.playClick();
    boxWrapper?.classList.toggle("is-collapsed");
    const isCollapsed = boxWrapper?.classList.contains("is-collapsed");
    btnToggleView.textContent = isCollapsed ? "👁️ 展開面板" : "👁️ 收合面板";
  });
}


// 初始化 Tab 6 全域事件（只綁定一次）
function initImagesManagementEvents() {
  if (isImagesEventsInitialized) return;
  isImagesEventsInitialized = true;

  // 啟動風格主題 20 張 Prompt 模板產生器
  initPromptGeneratorEvents();

  // 1. 分類篩選按鈕點選
  const catButtons = document.querySelectorAll(".img-cat-tab-btn");
  catButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      SoundFX.playClick();
      catButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentImagesCategory = btn.getAttribute("data-cat") || "all";
      renderImagesGrid();
    });
  });

  // 2. ZIP 壓縮檔批次上傳觸發
  const btnZipTrigger = document.getElementById("btn-upload-zip") || document.getElementById("btn-zip-upload-trigger");
  const fileInputZip = document.getElementById("input-zip-batch-upload") || document.getElementById("file-input-zip");

  btnZipTrigger?.addEventListener("click", () => {
    SoundFX.playClick();
    fileInputZip?.click();
  });

  fileInputZip?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".zip")) {
      alert("請選擇有效的 .zip 壓縮檔！");
      fileInputZip.value = "";
      return;
    }

    const confirmUpload = confirm(
      `確定要上傳壓縮檔【${file.name}】進行批次圖片取代嗎？\n\n系統將自動比對壓縮檔內符合 20 張系統圖片檔名的圖檔並進行取代，其餘非系統圖片將自動略過。`
    );
    if (!confirmUpload) {
      fileInputZip.value = "";
      return;
    }

    try {
      btnZipTrigger.disabled = true;
      btnZipTrigger.innerHTML = "⏳ 正在解壓縮與更新圖片中...";

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result;
          const result = await DataManager.uploadZipImages(base64Data);

          if (result && result.success) {
            let msg = `🎉 ${result.message}\n\n`;
            if (result.updatedFiles && result.updatedFiles.length > 0) {
              msg += "【成功取代的圖片】\n" + result.updatedFiles.map((f) => `  ✓ ${f.filename}`).join("\n") + "\n\n";
            }
            if (result.skippedFiles && result.skippedFiles.length > 0) {
              msg += "【略過的檔案】\n" + result.skippedFiles.map((f) => `  - ${f}`).join("\n");
            }
            alert(msg);

            // 重新載入設定檔與刷新介面
            await DataManager.reloadConfig();
            if (typeof renderHeroSelectionGrid === "function") {
              renderHeroSelectionGrid();
            }
            await renderImagesManagementUI();
          } else {
            alert("❌ 批次上傳失敗：" + (result?.error || "未知錯誤"));
          }
        } catch (err) {
          alert("處理壓縮檔發生錯誤：" + err.message);
        } finally {
          btnZipTrigger.disabled = false;
          btnZipTrigger.innerHTML = "<span>📦 壓縮檔批次上傳 (.zip)</span>";
          fileInputZip.value = "";
        }
      };

      reader.onerror = () => {
        alert("讀取壓縮檔失敗！");
        btnZipTrigger.disabled = false;
        btnZipTrigger.innerHTML = "<span>📦 壓縮檔批次上傳 (.zip)</span>";
        fileInputZip.value = "";
      };

      reader.readAsDataURL(file);
    } catch (err) {
      alert("檔案讀取發生例外：" + err.message);
      btnZipTrigger.disabled = false;
      btnZipTrigger.innerHTML = "<span>📦 壓縮檔批次上傳 (.zip)</span>";
      fileInputZip.value = "";
    }
  });

  // 3. 全部圖片改回官方預設
  const btnResetAll = document.getElementById("btn-reset-all-images");
  btnResetAll?.addEventListener("click", async () => {
    SoundFX.playClick();
    const confirmed = confirm(
      "⚠️ 確定要將全系統 20 張圖片全數恢復為【官方預設原版圖片】嗎？\n\n這將會清除您所有的自訂圖片並立即生效。"
    );
    if (!confirmed) return;

    try {
      btnResetAll.disabled = true;
      btnResetAll.innerHTML = "⏳ 正在還原中...";

      const result = await DataManager.resetCustomImage(null, true);
      if (result && result.success) {
        alert("🔄 " + result.message);
        await DataManager.reloadConfig();
        if (typeof renderHeroSelectionGrid === "function") {
          renderHeroSelectionGrid();
        }
        await renderImagesManagementUI();
      } else {
        alert("還原失敗：" + (result?.error || "未知錯誤"));
      }
    } catch (err) {
      alert("還原發生錯誤：" + err.message);
    } finally {
      btnResetAll.disabled = false;
      btnResetAll.innerHTML = "<span>🔄 全部圖片恢復預設</span>";
    }
  });
}

// 每次進入圖片管理 Tab 取得圖片狀態並渲染 (具備 100% 成功保證與離線降級容錯)
async function renderImagesManagementUI() {
  initImagesManagementEvents();

  const gridContainer = document.getElementById("admin-images-grid-container") || document.getElementById("images-grid");
  if (!gridContainer) return;

  gridContainer.innerHTML = `
    <div class="images-loading-placeholder" style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #a29bfe; font-size: 1.1rem;">
      <div class="spinner" style="display:inline-block; width:36px; height:36px; border:4px solid rgba(162,155,254,0.3); border-top-color:#a29bfe; border-radius:50%; animation: spin 0.8s linear infinite; margin-bottom:12px;"></div>
      <div>正在載入 20 張遊戲核心圖片資訊與規格...</div>
    </div>
  `;

  try {
    const res = await DataManager.getImagesStatus();
    if (res && res.success && Array.isArray(res.images)) {
      cachedImagesData = res;
      // 更新統計數據
      const customCountEl = document.getElementById("img-custom-count");
      const defaultCountEl = document.getElementById("img-default-count");
      if (customCountEl) customCountEl.textContent = res.customCount || 0;
      if (defaultCountEl) defaultCountEl.textContent = (res.total || 20) - (res.customCount || 0);

      const badgeCounter = document.getElementById("img-custom-badge-counter");
      if (badgeCounter) {
        badgeCounter.textContent = `自訂 ${res.customCount || 0} / ${res.total || 20} 張`;
      }

      renderImagesGrid();
    } else {
      // 容錯防護：即使伺服器異常，前端仍強制列出圖片
      console.warn("API 回傳非標準結構，啟動前端強制渲染保證：", res);
      renderImagesGrid();
    }
  } catch (err) {
    console.warn("取得圖片狀態例外，使用內建資訊渲染：", err);
    renderImagesGrid();
  }
}

// 依據篩選條件繪製 20 張圖片卡片 (突顯建議尺寸、鳥山明繁中 Prompt 與單圖即時替代)
function renderImagesGrid() {
  const gridContainer = document.getElementById("admin-images-grid-container") || document.getElementById("images-grid");
  if (!gridContainer || !cachedImagesData || !cachedImagesData.images) return;

  let items = cachedImagesData.images;
  if (currentImagesCategory !== "all") {
    items = items.filter((img) => img.category === currentImagesCategory);
  }

  if (items.length === 0) {
    gridContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #b2bec3;">
        🔍 目前分類無符合的圖片。
      </div>
    `;
    return;
  }

  let html = "";
  items.forEach((img) => {
    const isCustom = !!img.isCustom;
    const badgeClass = isCustom ? "badge-custom-img" : "badge-default-img";
    const badgeText = isCustom ? "✨ 已套用自訂" : "📦 官方預設";
    const currentImgUrl = img.currentUrl || img.defaultPath;

    html += `
      <div class="img-manage-card image-mgmt-card ${isCustom ? "is-custom-applied is-customized" : ""}" data-filename="${img.filename}">
        <!-- 1. 卡片頂部資訊列 (分類、名稱與自訂狀態) -->
        <div class="img-card-header">
          <div class="img-card-title-group">
            <span class="img-card-category-tag">${img.categoryName || "遊戲核心圖片"}</span>
            <div class="img-card-title">${img.name}</div>
          </div>
          <span class="img-card-status-badge ${badgeClass} status-pill-${img.filename.replace(/[^a-zA-Z0-9]/g, '_')}">${badgeText}</span>
        </div>

        <!-- 2. 卡片主體 (左側 100x100 棋盤格縮圖 + 右側檔名、尺寸規格與操作按鈕) -->
        <div class="img-card-body">
          <div class="img-thumb-container image-preview-wrapper" title="點擊放大預覽這張圖片" data-src="${currentImgUrl}" data-title="${img.name}">
            <img src="${currentImgUrl}" alt="${img.name}" class="img-thumb-img image-preview-thumb" id="thumb-${img.filename.replace(/[^a-zA-Z0-9]/g, '_')}" onerror="this.src='${img.defaultPath}';">
          </div>
          <div class="img-card-meta">
            <div class="img-meta-filename">${img.filename}</div>
            <div class="img-meta-spec-badge" title="AI 生圖建議遵循的尺寸與格式">
              <span>📐 規格：</span><strong>${img.spec}</strong>
            </div>
            <div class="img-meta-desc">${img.desc}</div>
            
            <!-- 單張卡片操作按鈕列 (提供單圖上傳即時替代呈現與改回預設) -->
            <div class="img-card-actions">
              <label class="btn-img-upload" title="上傳你以 AI 或手繪生成的單張圖片來替換">
                <span>📤 上傳替換圖片</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" class="input-single-image" data-filename="${img.filename}" style="display:none;">
              </label>
              <button class="btn-img-reset" data-filename="${img.filename}" ${isCustom ? "" : "disabled"} title="${isCustom ? "改回官方原版預設圖片" : "目前已是官方預設圖片"}">
                🔄 改回預設
              </button>
            </div>
          </div>
        </div>

        <!-- 3. 鳥山明風格 AI 生圖建議 Prompt 專區 (繁體中文為主，符合建議尺寸) -->
        <div class="img-prompt-section">
          <div class="img-prompt-header">
            <div class="img-prompt-title">
              <span>🎨 鳥山明風格繁中生圖 Prompt</span>
              <span class="prompt-spec-hint">（尺寸：${img.spec}）</span>
            </div>
            <div class="prompt-action-btns">
              <button class="btn-copy-prompt-main btn-copy-prompt" data-copy-type="zh" title="一鍵複製符合該圖片尺寸規格的繁體中文生圖提示詞">
                📋 複製中文 Prompt
              </button>
              <button class="btn-copy-prompt-sub btn-copy-prompt" data-copy-type="en" title="複製英文生圖 Prompt (適用 Midjourney / DALL-E 3)">
                📋 複製英文
              </button>
            </div>
          </div>

          <!-- 繁體中文生圖 Prompt 主要展示區 (清晰大字首要位置) -->
          <div class="prompt-zh-primary-box">
            <div class="prompt-zh-content prompt-zh-text">${escapeHtml(img.promptZh)}</div>
          </div>

          <!-- 英文 Prompt 輔助收合區 -->
          <details class="prompt-en-details">
            <summary class="prompt-en-summary">🌐 檢視英文 Midjourney / DALL-E 3 提示詞（點擊展開）</summary>
            <div class="prompt-en-box prompt-en-text">${escapeHtml(img.promptEn)}</div>
          </details>
        </div>
      </div>
    `;
  });

  gridContainer.innerHTML = html;

  // 綁定卡片內部單圖上傳、恢復預設與一鍵複製事件
  bindImageCardEvents(gridContainer);
}

// 綁定卡片內單張上傳、恢復預設與複製 Prompt 事件 (支援即時呈現與畫面同步)
function bindImageCardEvents(container) {
  // 1. 單張檔案上傳 (即時預覽、套用與通知)
  const singleInputs = container.querySelectorAll(".input-single-image");
  singleInputs.forEach((input) => {
    input.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      const filename = input.getAttribute("data-filename");
      if (!file || !filename) return;

      const card = input.closest(".img-manage-card");
      const thumbImg = card ? card.querySelector(".img-thumb-img") : null;
      const statusBadge = card ? card.querySelector(".img-card-status-badge") : null;
      const resetBtn = card ? card.querySelector(".btn-img-reset") : null;
      const uploadLabel = input.closest(".btn-img-upload");

      try {
        if (uploadLabel) uploadLabel.style.opacity = "0.6";

        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64Data = reader.result;

            // A. 即時呈現：立即更換當前卡片縮圖與自訂徽章
            if (thumbImg) {
              thumbImg.src = base64Data;
            }
            if (card) {
              card.classList.add("is-custom-applied", "is-customized");
            }
            if (statusBadge) {
              statusBadge.className = "img-card-status-badge badge-custom-img";
              statusBadge.textContent = "✨ 已套用自訂";
            }
            if (resetBtn) {
              resetBtn.disabled = false;
              resetBtn.title = "改回官方原版預設圖片";
            }

            // B. 呼叫 DataManager 儲存與套用
            const res = await DataManager.uploadCustomImage(filename, base64Data);

            // C. 播放成功音效與提示
            if (typeof SoundFX !== "undefined" && SoundFX.playSkillCast) {
              SoundFX.playSkillCast();
            }

            // D. 刷新選角畫面或大地圖中可能受影響的立繪與頭像
            if (typeof renderHeroSelectionGrid === "function") {
              renderHeroSelectionGrid();
            }

            // E. 更新頂部計數徽章
            updateImageCountersUI();

            alert(`🎉 圖片【${filename}】已成功替換並即時呈現！\n\n遊戲戰鬥立繪、角色頭像與背景已同步套用。`);
          } catch (err) {
            alert("更換圖片發生例外：" + err.message);
          } finally {
            if (uploadLabel) uploadLabel.style.opacity = "1";
            input.value = "";
          }
        };

        reader.onerror = () => {
          alert("讀取圖片檔案失敗！");
          if (uploadLabel) uploadLabel.style.opacity = "1";
          input.value = "";
        };

        reader.readAsDataURL(file);
      } catch (err) {
        alert("處理檔案發生錯誤：" + err.message);
        if (uploadLabel) uploadLabel.style.opacity = "1";
        input.value = "";
      }
    });
  });

  // 2. 單張改回官方預設圖片
  const resetBtns = container.querySelectorAll(".btn-img-reset");
  resetBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const filename = btn.getAttribute("data-filename");
      if (!filename) return;

      SoundFX.playClick();
      const confirmReset = confirm(`確定要將【${filename}】恢復為官方原版預設圖片嗎？`);
      if (!confirmReset) return;

      const card = btn.closest(".img-manage-card");
      const thumbImg = card ? card.querySelector(".img-thumb-img") : null;
      const statusBadge = card ? card.querySelector(".img-card-status-badge") : null;

      try {
        btn.disabled = true;
        btn.textContent = "⏳ 還原中...";

        const res = await DataManager.resetCustomImage(filename, false);

        // A. 即時呈現：復原縮圖為預設圖片
        if (thumbImg) {
          thumbImg.src = `assets/images/${filename}`;
        }
        if (card) {
          card.classList.remove("is-custom-applied", "is-customized");
        }
        if (statusBadge) {
          statusBadge.className = "img-card-status-badge badge-default-img";
          statusBadge.textContent = "📦 官方預設";
        }
        btn.textContent = "🔄 改回預設";
        btn.disabled = true;

        // B. 播放音效並更新畫面
        if (typeof SoundFX !== "undefined" && SoundFX.playSelect) {
          SoundFX.playSelect();
        }
        if (typeof renderHeroSelectionGrid === "function") {
          renderHeroSelectionGrid();
        }

        updateImageCountersUI();
        alert(`🔄 圖片【${filename}】已成功恢復為官方原版預設！`);
      } catch (err) {
        alert("還原發生例外：" + err.message);
        btn.disabled = false;
        btn.textContent = "🔄 改回預設";
      }
    });
  });

  // 3. 一鍵複製 Prompt (繁體中文 / 英文雙按鈕)
  const copyBtns = container.querySelectorAll(".btn-copy-prompt");
  copyBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const type = btn.getAttribute("data-copy-type");
      const card = btn.closest(".img-manage-card") || btn.closest(".image-mgmt-card");
      if (!card) return;

      const textbox = type === "en" ? card.querySelector(".prompt-en-text") : card.querySelector(".prompt-zh-text");
      if (textbox) {
        const textToCopy = textbox.textContent.trim();
        copyTextToClipboard(textToCopy, btn);
      }
    });
  });

  // 4. 點擊縮圖彈出大圖預覽
  const previewThumbs = container.querySelectorAll(".image-preview-wrapper");
  previewThumbs.forEach((thumb) => {
    thumb.addEventListener("click", () => {
      const src = thumb.getAttribute("data-src") || thumb.querySelector("img")?.src;
      const title = thumb.getAttribute("data-title") || "圖片預覽";
      if (!src) return;
      showImagePreviewModal(src, title);
    });
  });
}

// 動態更新頂部自訂張數計數器
function updateImageCountersUI() {
  const cards = document.querySelectorAll(".img-manage-card");
  const customCards = document.querySelectorAll(".img-manage-card.is-custom-applied");
  const total = cards.length || 20;
  const customCount = customCards.length;

  const customCountEl = document.getElementById("img-custom-count");
  const defaultCountEl = document.getElementById("img-default-count");
  if (customCountEl) customCountEl.textContent = customCount;
  if (defaultCountEl) defaultCountEl.textContent = total - customCount;

  const badgeCounter = document.getElementById("img-custom-badge-counter");
  if (badgeCounter) {
    badgeCounter.textContent = `自訂 ${customCount} / ${total} 張`;
  }
}

// 彈出大圖預覽 Modal
function showImagePreviewModal(src, title) {
  let modal = document.getElementById("admin-img-lightbox-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "admin-img-lightbox-modal";
    modal.className = "modal-backdrop";
    modal.style.zIndex = "1100";
    modal.innerHTML = `
      <div class="modal-window" style="max-width: 720px; text-align: center; padding: 20px; background: rgba(15, 23, 42, 0.95); border: 2px solid #38bdf8; border-radius: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 id="lightbox-modal-title" style="margin: 0; color: #f8fafc; font-size: 16px;">圖片大圖預覽</h3>
          <button id="btn-close-lightbox" class="modal-close-btn" style="background:none; border:none; color:#f87171; font-size:24px; cursor:pointer;">&times;</button>
        </div>
        <div style="width: 100%; max-height: 70vh; overflow: auto; background: #0f172a; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: center; background-image: linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%); background-size: 20px 20px;">
          <img id="lightbox-modal-img" src="" alt="" style="max-width: 100%; max-height: 60vh; object-fit: contain; border-radius: 6px; box-shadow: 0 4px 20px rgba(0,0,0,0.8);">
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector("#btn-close-lightbox")?.addEventListener("click", () => {
      modal.classList.add("hidden");
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  }

  const titleEl = modal.querySelector("#lightbox-modal-title");
  const imgEl = modal.querySelector("#lightbox-modal-img");
  if (titleEl) titleEl.textContent = `🔍 ${title} - 原尺寸預覽`;
  if (imgEl) imgEl.src = src;

  modal.classList.remove("hidden");
}

// HTML 特殊字元轉義輔助
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


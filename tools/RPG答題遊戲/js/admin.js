/**
 * 《紫斑之翼：奇幻大遷徙》- 教師 / 管理者題庫與測驗派送系統
 * 支援多組題庫主題分類、派送主題測驗遊戲、學生答題詳情分析與錯題自動打包新題庫
 */

const AdminSystem = (function () {
  let isUnlocked = false;
  let adminPassword = "admin";
  let currentCategoryFilter = "ALL"; // 當前題庫主題分類篩選
  let currentExamFilter = "ALL"; // 當前學生紀錄測驗篩選

  // 將答案字串歸一化為索引 (0, 1, 2, 3)
  function normalizeAnswer(ans) {
    if (ans === undefined || ans === null) return -1;
    const s = String(ans).trim().toLowerCase();

    if (s === "1" || s === "a" || s === "0") return 0;
    if (s === "2" || s === "b") return 1;
    if (s === "3" || s === "c") return 2;
    if (s === "4" || s === "d") return 3;

    return -1;
  }

  // 解析 CSV / 純文字內容為題目物件陣列
  function parseCSVText(rawText, defaultCategory = "生態考驗") {
    if (!rawText || !rawText.trim()) {
      return { success: false, error: "匯入內容不可為空！", items: [] };
    }

    const lines = rawText.split(/\r?\n/);
    const parsedItems = [];
    const errors = [];

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }

      const parts = trimmed.split(",").map((p) => p.trim());

      // 格式：題目, 正確答案, 選項1, 選項2, 選項3, 選項4
      if (parts.length < 6) {
        errors.push(`第 ${lineNum} 行欄位不足 6 項（格式：題目,正確答案,選項1,選項2,選項3,選項4）: "${line}"`);
        return;
      }

      const questionText = parts[0];
      const rawAns = parts[1];
      const opt1 = parts[2];
      const opt2 = parts[3];
      const opt3 = parts[4];
      const opt4 = parts[5];

      const answerIndex = normalizeAnswer(rawAns);
      if (answerIndex < 0 || answerIndex > 3) {
        errors.push(`第 ${lineNum} 行答案格式錯誤（應為 1~4 或 A~D）: "${rawAns}"`);
        return;
      }

      parsedItems.push({
        id: Date.now() + Math.floor(Math.random() * 10000) + idx,
        chapter: 1,
        category: defaultCategory || "生態考驗",
        question: questionText,
        options: [opt1, opt2, opt3, opt4],
        answerIndex: answerIndex,
        explanation: `正確答案為：${[opt1, opt2, opt3, opt4][answerIndex]}`
      });
    });

    return {
      success: errors.length === 0,
      errors: errors,
      items: parsedItems
    };
  }

  return {
    // 密碼驗證
    verifyPassword: function (inputPwd) {
      const cfg = DataManager.getConfig();
      if (cfg && cfg.adminPassword) {
        adminPassword = cfg.adminPassword;
      }
      if (inputPwd === adminPassword) {
        isUnlocked = true;
        return true;
      }
      return false;
    },

    isLoggedIn: function () {
      return isUnlocked;
    },

    logout: function () {
      isUnlocked = false;
    },

    // 取得與設定主題分類篩選
    setCategoryFilter: function (cat) {
      currentCategoryFilter = cat;
    },

    getCategoryFilter: function () {
      return currentCategoryFilter;
    },

    setExamFilter: function (examId) {
      currentExamFilter = examId;
    },

    getExamFilter: function () {
      return currentExamFilter;
    },

    // 匯入為新的一組題庫（支援主題分類）
    importAsNewBank: async function (bankName, bankCategory, bankDesc, csvText) {
      const category = bankCategory.trim() || "綜合生態";
      const result = parseCSVText(csvText, category);

      if (result.items.length === 0) {
        return {
          success: false,
          message: "未解析出任何有效題目！\n" + (result.errors.join("\n") || "請確認格式正確")
        };
      }

      const name = bankName.trim() || `自訂題庫 ${new Date().toLocaleDateString("zh-TW")}`;
      const desc = bankDesc.trim() || `包含 ${result.items.length} 道題目`;

      const newBank = await DataManager.addQuestionBank(name, desc, result.items, category);

      return {
        success: true,
        bank: newBank,
        count: result.items.length,
        errors: result.errors,
        message: `成功建立新題庫【${newBank.name}】（分類：${category}），共匯入 ${result.items.length} 題！` +
          (result.errors.length > 0 ? `\n（略過 ${result.errors.length} 行異常）` : "")
      };
    },

    // 切換題庫勾選啟用狀態
    toggleBank: async function (bankId, isActive) {
      await DataManager.toggleBankActive(bankId, isActive);
    },

    // 刪除整組題庫
    deleteBank: async function (bankId) {
      await DataManager.deleteQuestionBank(bankId);
    },

    // 更新題庫內的題目清單
    updateBankQuestions: async function (bankId, questions) {
      return await DataManager.updateBankQuestions(bankId, questions);
    },

    // 派送建立新主題測驗
    dispatchNewExam: async function (title, category, desc, bankIds) {
      const exam = await DataManager.createExam(title, category, desc, bankIds);
      return exam;
    },

    // 切換主題測驗啟用狀態
    toggleExam: async function (examId, isActive) {
      await DataManager.toggleExamActive(examId, isActive);
    },

    // 刪除主題測驗
    deleteExam: async function (examId) {
      await DataManager.deleteExam(examId);
    },

    // 主題測驗「學生錯題重新打包成新題庫」
    packMistakesToNewBank: async function (examId, customName = null) {
      const res = await DataManager.createBankFromMistakes(examId, customName);
      if (res && res.bank) {
        return res.bank;
      }
      return res;
    },

    // 匯出特定題庫組為 CSV
    exportBankToCSV: function (bankId) {
      const banks = DataManager.getQuestionBanks();
      const targetBank = banks.find((b) => b.id === bankId);
      if (!targetBank || !targetBank.questions) return "";

      const ansLetters = ["A", "B", "C", "D"];
      const lines = targetBank.questions.map((q) => {
        const letter = ansLetters[q.answerIndex] || "A";
        const o1 = q.options[0] || "";
        const o2 = q.options[1] || "";
        const o3 = q.options[2] || "";
        const o4 = q.options[3] || "";
        return `"${q.question.replace(/"/g, '""')}",${letter},"${o1.replace(/"/g, '""')}","${o2.replace(/"/g, '""')}","${o3.replace(/"/g, '""')}","${o4.replace(/"/g, '""')}"`;
      });
      return lines.join("\n");
    },

    // 刪除單筆學生作答紀錄
    deleteRecord: async function (recordId) {
      return await DataManager.deleteStudentRecord(recordId);
    },

    // 清空學生作答紀錄
    clearRecords: async function (examId = "ALL") {
      return await DataManager.clearStudentRecords(examId);
    },

    // 取得本地資料檔案儲存資訊
    getStorageInfo: async function () {
      return await DataManager.getStorageInfo();
    },

    // 錯題深度分析：按最多人錯的順序列出所有錯題、每題列出答錯學生清單及答對率
    getMistakeAnalysis: function (examId = "ALL") {
      const records = DataManager.getStudentRecords(examId);
      const questionMap = new Map();

      records.forEach((rec) => {
        if (!Array.isArray(rec.details)) return;

        rec.details.forEach((d) => {
          if (!d || !d.question) return;
          const qKey = (d.questionId != null && d.questionId !== "") ? String(d.questionId) : d.question.trim();

          if (!questionMap.has(qKey)) {
            questionMap.set(qKey, {
              id: d.questionId || qKey,
              question: d.question,
              options: Array.isArray(d.options) ? [...d.options] : [],
              correctAnswer: d.correctAnswer || "",
              explanation: d.explanation || "",
              chapter: d.chapter || 1,
              category: d.category || "未分類",
              totalAttempts: 0,
              correctCount: 0,
              wrongCount: 0,
              accuracy: 0,
              wrongStudents: [],
              optionDistribution: {}
            });
          }

          const qItem = questionMap.get(qKey);
          qItem.totalAttempts += 1;

          if (qItem.options.length === 0 && Array.isArray(d.options)) {
            qItem.options = [...d.options];
          }
          if (!qItem.correctAnswer && d.correctAnswer) {
            qItem.correctAnswer = d.correctAnswer;
          }
          if (!qItem.explanation && d.explanation) {
            qItem.explanation = d.explanation;
          }

          const studentAns = d.studentAnswer || d.selectedText || "(未作答)";
          qItem.optionDistribution[studentAns] = (qItem.optionDistribution[studentAns] || 0) + 1;

          if (d.isCorrect === true) {
            qItem.correctCount += 1;
          } else {
            qItem.wrongCount += 1;
            qItem.wrongStudents.push({
              studentName: rec.studentName || "匿名冒險者",
              wrongAnswer: studentAns,
              completedAt: rec.completedAt || null,
              examTitle: rec.examTitle || ""
            });
          }
        });
      });

      // 提取有答錯的題目清單並計算各題答對率
      const mistakeList = [];
      questionMap.forEach((qItem) => {
        qItem.accuracy = qItem.totalAttempts > 0 
          ? Math.round((qItem.correctCount / qItem.totalAttempts) * 100) 
          : 0;

        if (qItem.wrongCount > 0) {
          mistakeList.push(qItem);
        }
      });

      // 嚴格按「答錯人數由多到少（最多人錯優先）」排序；若答錯人數相同，答對率低者排前面
      mistakeList.sort((a, b) => {
        if (b.wrongCount !== a.wrongCount) {
          return b.wrongCount - a.wrongCount;
        }
        if (a.accuracy !== b.accuracy) {
          return a.accuracy - b.accuracy;
        }
        return b.totalAttempts - a.totalAttempts;
      });

      return {
        examId: examId,
        totalRecords: records.length,
        totalMistakeQuestions: mistakeList.length,
        mistakes: mistakeList
      };
    }
  };
})();


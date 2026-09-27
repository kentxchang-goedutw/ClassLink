/**
 * 《智者覺醒：真理之戰》- 復古 8-bit / 16-bit Web Audio API 晶片音效與五大關卡專屬 BGM 合成器
 * 原生晶片音樂合成，零外部依賴、秒開無破音延遲，支援全瀏覽器
 */

const SoundFX = (function () {
  let ctx = null;
  let isMuted = false;
  let currentStageBGM = 0;
  let bgmTimer = null;
  let bgmStepIndex = 0;
  let bgmMasterGain = null;

  // 音符頻率常數表 (Hz)
  const NOTE = {
    "REST": 0,
    "C3": 130.81, "C#3": 138.59, "D3": 146.83, "Eb3": 155.56, "E3": 164.81, "F3": 174.61, "F#3": 185.00, "G3": 196.00, "Ab3": 207.65, "A3": 220.00, "Bb3": 233.08, "B3": 246.94,
    "C4": 261.63, "C#4": 277.18, "D4": 293.66, "Eb4": 311.13, "E4": 329.63, "F4": 349.23, "F#4": 369.99, "G4": 392.00, "Ab4": 415.30, "A4": 440.00, "Bb4": 466.16, "B4": 493.88,
    "C5": 523.25, "C#5": 554.37, "D5": 587.33, "Eb5": 622.25, "E5": 659.25, "F5": 698.46, "F#5": 739.99, "G5": 783.99, "Ab5": 830.61, "A5": 880.00, "Bb5": 932.33, "B5": 987.77,
    "C6": 1046.50, "D6": 1174.66, "E6": 1318.51
  };

  // 五大關卡專屬 BGM 音樂曲目樂譜 (JRPG 晶片雙聲部編制)
  const BGM_TRACKS = {
    // 第 1 關：茂林幽谷【自然啟程・春日晨曦】(C Major / 溫暖清新琶音)
    1: {
      name: "第一章：茂林春曉",
      bpm: 120,
      leadWave: "triangle",
      bassWave: "triangle",
      leadGain: 0.09,
      bassGain: 0.08,
      leadNotes: [
        "C5", "E5", "G5", "C6", "B5", "G5", "E5", "G5",
        "A4", "C5", "E5", "A5", "G5", "E5", "C5", "E5",
        "F4", "A4", "C5", "F5", "E5", "C5", "A4", "C5",
        "G4", "B4", "D5", "G5", "F5", "D5", "B4", "D5"
      ],
      bassNotes: [
        "C3", "G3", "C4", "G3",
        "A2", "E3", "A3", "E3",
        "F2", "C3", "F3", "C3",
        "G2", "D3", "G3", "D3"
      ]
    },

    // 第 2 關：月世界惡地【荒丘沙暴・神祕綠洲】(D Dorian / 神祕異域風格)
    2: {
      name: "第二章：月界狂沙",
      bpm: 108,
      leadWave: "sawtooth",
      bassWave: "triangle",
      leadGain: 0.06,
      bassGain: 0.09,
      leadNotes: [
        "D4", "F4", "A4", "Bb4", "A4", "F4", "E4", "D4",
        "D4", "G4", "A4", "C#5", "D5", "A4", "F4", "E4",
        "Bb3", "D4", "F4", "A4", "G4", "F4", "E4", "D4",
        "A3", "C#4", "E4", "G4", "F4", "E4", "D4", "C#4"
      ],
      bassNotes: [
        "D3", "A3", "D3", "A3",
        "D3", "G3", "D3", "A3",
        "Bb2", "F3", "Bb2", "F3",
        "A2", "E3", "A2", "C#3"
      ]
    },

    // 第 3 關：濁水溪河谷【雷雲怒濤・疾風奔流】(A Minor / 激昂緊湊急流)
    3: {
      name: "第三章：濁水奔雷",
      bpm: 136,
      leadWave: "square",
      bassWave: "sawtooth",
      leadGain: 0.07,
      bassGain: 0.07,
      leadNotes: [
        "A4", "C5", "E5", "A5", "G5", "E5", "C5", "D5",
        "F5", "E5", "D5", "C5", "B4", "C5", "D5", "E5",
        "A4", "C5", "E5", "G5", "F#5", "D5", "B4", "G4",
        "E5", "D5", "C5", "B4", "A4", "B4", "C5", "B4"
      ],
      bassNotes: [
        "A2", "A3", "E3", "A3",
        "F2", "F3", "C3", "F3",
        "D2", "D3", "A2", "D3",
        "E2", "E3", "B2", "E3"
      ]
    },

    // 第 4 關：國道生態廊道【公路疾馳・科技飛越】(E Minor / 現代電子奔馳感)
    4: {
      name: "第四章：國道飛馳",
      bpm: 142,
      leadWave: "square",
      bassWave: "sawtooth",
      leadGain: 0.065,
      bassGain: 0.075,
      leadNotes: [
        "E4", "B4", "E5", "G5", "F#5", "D5", "B4", "A4",
        "G4", "D5", "G5", "B5", "A5", "F#5", "D5", "F#5",
        "C4", "G4", "C5", "E5", "D5", "B4", "G4", "E4",
        "D4", "A4", "D5", "F#5", "E5", "D5", "B4", "D5"
      ],
      bassNotes: [
        "E2", "E3", "E2", "B2",
        "G2", "G3", "G2", "D3",
        "C2", "C3", "C2", "G2",
        "D2", "D3", "D2", "A2"
      ]
    },

    // 第 5 關：繁衍聖林【終極試煉・神聖之泉決戰】(C Minor - Eb Major / 史詩Boss戰)
    5: {
      name: "第五章：神聖繁衍",
      bpm: 126,
      leadWave: "sawtooth",
      bassWave: "triangle",
      leadGain: 0.075,
      bassGain: 0.10,
      leadNotes: [
        "C4", "Eb4", "G4", "C5", "B4", "G4", "Eb4", "F4",
        "Ab4", "C5", "Eb5", "G5", "F5", "Eb5", "D5", "C5",
        "Eb4", "G4", "Bb4", "Eb5", "D5", "Bb4", "G4", "Ab4",
        "G4", "B4", "D5", "F5", "Eb5", "D5", "C5", "B4"
      ],
      bassNotes: [
        "C2", "G2", "C3", "Eb3",
        "Ab2", "Eb3", "Ab3", "C3",
        "Eb2", "Bb2", "Eb3", "G3",
        "G2", "D3", "G3", "B2"
      ]
    }
  };

  // 初始化音訊上下文（在使用者第一次點擊時解鎖）
  function initContext() {
    if (!ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        ctx = new AudioContextClass();
        bgmMasterGain = ctx.createGain();
        bgmMasterGain.gain.setValueAtTime(isMuted ? 0 : 0.85, ctx.currentTime);
        bgmMasterGain.connect(ctx.destination);
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
  }

  // 播放單一短音調 (供技能或攻擊音效使用)
  function playTone(freq, type, duration, startTime = 0, gainVal = 0.1) {
    if (isMuted) return;
    initContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

      gain.gain.setValueAtTime(gainVal, ctx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    } catch (e) {
      console.warn('音效播放失敗:', e);
    }
  }

  // --- 背景音樂排程器核心 ---
  function scheduleNextBgmBeat() {
    if (!ctx || isMuted || currentStageBGM <= 0) return;

    const track = BGM_TRACKS[currentStageBGM];
    if (!track) return;

    const secondsPerBeat = 60 / track.bpm;
    const stepDuration = secondsPerBeat / 2; // 8 分音符步進

    const leadNoteName = track.leadNotes[bgmStepIndex % track.leadNotes.length];
    const leadFreq = NOTE[leadNoteName] || 0;

    // 低音聲部每 2 個 step 變換一次
    const bassIdx = Math.floor((bgmStepIndex / 2) % track.bassNotes.length);
    const bassNoteName = track.bassNotes[bassIdx];
    const bassFreq = (bgmStepIndex % 2 === 0) ? (NOTE[bassNoteName] || 0) : 0;

    const now = ctx.currentTime;

    // 播放主旋律音符
    if (leadFreq > 0) {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = track.leadWave;
        osc.frequency.setValueAtTime(leadFreq, now);

        gain.gain.setValueAtTime(track.leadGain, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + stepDuration * 0.9);

        osc.connect(gain);
        gain.connect(bgmMasterGain);

        osc.start(now);
        osc.stop(now + stepDuration * 0.9);
      } catch (err) {}
    }

    // 播放低音伴奏
    if (bassFreq > 0) {
      try {
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = track.bassWave;
        bassOsc.frequency.setValueAtTime(bassFreq, now);

        bassGain.gain.setValueAtTime(track.bassGain, now);
        bassGain.gain.exponentialRampToValueAtTime(0.0001, now + stepDuration * 1.8);

        bassOsc.connect(bassGain);
        bassGain.connect(bgmMasterGain);

        bassOsc.start(now);
        bassOsc.stop(now + stepDuration * 1.8);
      } catch (err) {}
    }

    bgmStepIndex++;

    // 排定下一個拍子
    const intervalMs = stepDuration * 1000;
    bgmTimer = setTimeout(scheduleNextBgmBeat, intervalMs);
  }

  function startBgmEngine() {
    clearTimeout(bgmTimer);
    bgmTimer = null;
    bgmStepIndex = 0;
    initContext();
    if (bgmMasterGain && ctx) {
      bgmMasterGain.gain.setValueAtTime(isMuted ? 0 : 0.85, ctx.currentTime);
    }
    if (!isMuted && currentStageBGM > 0) {
      scheduleNextBgmBeat();
    }
  }

  return {
    // 解鎖音訊
    unlock: function () {
      initContext();
    },

    // 切換靜音
    toggleMute: function () {
      isMuted = !isMuted;
      initContext();
      if (bgmMasterGain && ctx) {
        bgmMasterGain.gain.setValueAtTime(isMuted ? 0 : 0.85, ctx.currentTime);
      }
      if (isMuted) {
        clearTimeout(bgmTimer);
        bgmTimer = null;
      } else {
        if (currentStageBGM > 0 && !bgmTimer) {
          scheduleNextBgmBeat();
        }
      }
      return isMuted;
    },

    isMuted: function () {
      return isMuted;
    },

    // ==============================================
    // 專屬關卡 BGM 控制 API (Stage 1 ~ 5)
    // ==============================================

    // 播放指定關卡專屬 BGM (1 ~ 5)
    playStageBGM: function (stageId) {
      const sId = parseInt(stageId, 10);
      if (!BGM_TRACKS[sId]) {
        console.warn("未定義的關卡 BGM:", sId);
        return;
      }

      // 若已經在播放同關卡則不打斷
      if (currentStageBGM === sId && bgmTimer) {
        return;
      }

      currentStageBGM = sId;
      startBgmEngine();
    },

    // 停止背景音樂 (例如返回地圖或戰鬥結束)
    stopBGM: function () {
      currentStageBGM = 0;
      clearTimeout(bgmTimer);
      bgmTimer = null;
      bgmStepIndex = 0;
    },

    // 暫停 BGM (例如播放勝利音樂或全螢幕大絕招動畫時)
    pauseBGM: function () {
      clearTimeout(bgmTimer);
      bgmTimer = null;
    },

    // 恢復 BGM
    resumeBGM: function () {
      if (!isMuted && currentStageBGM > 0 && !bgmTimer) {
        scheduleNextBgmBeat();
      }
    },

    // 取得當前播放中的關卡 BGM ID (若未播放則返回 null)
    getCurrentBGMStage: function () {
      return currentStageBGM > 0 ? currentStageBGM : null;
    },

    // ==============================================
    // 戰鬥與選單音效
    // ==============================================

    // 1. 選單點擊音
    playClick: function () {
      playTone(600, 'square', 0.08, 0, 0.08);
    },

    // 2. 選擇確認音
    playSelect: function () {
      playTone(440, 'triangle', 0.06, 0, 0.1);
      playTone(880, 'triangle', 0.12, 0.06, 0.1);
    },

    // 3. 答對攻擊打擊音（清脆上升音階）
    playCorrectAttack: function () {
      playTone(523.25, 'triangle', 0.08, 0, 0.12); // C5
      playTone(659.25, 'triangle', 0.08, 0.07, 0.12); // E5
      playTone(783.99, 'triangle', 0.08, 0.14, 0.12); // G5
      playTone(1046.5, 'square', 0.25, 0.21, 0.15); // C6
    },

    // 4. 答錯受擊音（低沉噪音震盪）
    playWrongHit: function () {
      if (isMuted) return;
      initContext();
      if (!ctx) return;

      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.35);

        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } catch (e) {
        console.warn(e);
      }
    },

    // 5. 技能詠唱/法術爆發音
    playSkillCast: function () {
      const freqs = [350, 440, 554, 659, 880, 1108];
      freqs.forEach((f, idx) => {
        playTone(f, 'sine', 0.15, idx * 0.05, 0.12);
      });
    },

    // 6. 喝藥水音效
    playPotion: function () {
      playTone(300, 'triangle', 0.1, 0, 0.1);
      playTone(450, 'triangle', 0.12, 0.09, 0.1);
      playTone(600, 'triangle', 0.2, 0.18, 0.1);
    },

    // 7. 關卡通關/勝利號角
    playVictory: function () {
      this.pauseBGM();
      const notes = [
        { f: 523.25, d: 0.15, t: 0.0 },
        { f: 523.25, d: 0.15, t: 0.16 },
        { f: 523.25, d: 0.15, t: 0.32 },
        { f: 659.25, d: 0.4, t: 0.48 },
        { f: 587.33, d: 0.2, t: 0.88 },
        { f: 659.25, d: 0.2, t: 1.08 },
        { f: 783.99, d: 0.6, t: 1.28 }
      ];
      notes.forEach(n => {
        playTone(n.f, 'square', n.d, n.t, 0.15);
      });
    },

    // 8. 遊戲結束/失敗哀鳴
    playGameOver: function () {
      this.pauseBGM();
      const notes = [
        { f: 392.0, d: 0.25, t: 0.0 },
        { f: 349.23, d: 0.25, t: 0.25 },
        { f: 311.13, d: 0.3, t: 0.5 },
        { f: 261.63, d: 0.6, t: 0.8 }
      ];
      notes.forEach(n => {
        playTone(n.f, 'sawtooth', n.d, n.t, 0.15);
      });
    },

    // 9. 近身重擊爆破音（低頻重擊+高頻撕裂）
    playAttackHit: function () {
      if (isMuted) return;
      initContext();
      if (!ctx) return;
      try {
        playTone(180, 'square', 0.15, 0, 0.22);
        playTone(90, 'triangle', 0.25, 0.04, 0.28);
        playTone(480, 'sawtooth', 0.12, 0.02, 0.18);
      } catch (e) {
        console.warn(e);
      }
    },

    // 10. 五關完全通關大勝利進行曲號角 (Grand Ending Fanfare & Anthem)
    playGrandEndingFanfare: function () {
      this.pauseBGM();
      if (isMuted) return;
      initContext();
      if (!ctx) return;

      // 主旋律高亢勝利號角 (C Major -> G Major -> High C6 凱旋大和弦)
      const fanfareLead = [
        // 序奏三連音引領
        { f: 523.25, d: 0.14, t: 0.0, w: 'triangle', g: 0.16 }, // C5
        { f: 523.25, d: 0.14, t: 0.15, w: 'triangle', g: 0.16 },
        { f: 523.25, d: 0.14, t: 0.30, w: 'triangle', g: 0.18 },
        { f: 659.25, d: 0.45, t: 0.45, w: 'square', g: 0.20 },   // E5
        { f: 783.99, d: 0.45, t: 0.90, w: 'square', g: 0.22 },   // G5
        { f: 659.25, d: 0.20, t: 1.35, w: 'triangle', g: 0.16 }, // E5
        { f: 783.99, d: 0.65, t: 1.55, w: 'square', g: 0.22 },   // G5

        // 第二樂段：向上奮進
        { f: 698.46, d: 0.16, t: 2.25, w: 'triangle', g: 0.16 }, // F5
        { f: 783.99, d: 0.16, t: 2.42, w: 'triangle', g: 0.18 }, // G5
        { f: 880.00, d: 0.38, t: 2.60, w: 'square', g: 0.22 },   // A5
        { f: 987.77, d: 0.38, t: 3.00, w: 'square', g: 0.24 },   // B5
        
        // 終曲凱旋長鳴：高音 C6 雙疊長音
        { f: 1046.50, d: 1.40, t: 3.40, w: 'square', g: 0.25 },  // C6
        { f: 1318.51, d: 1.35, t: 3.45, w: 'triangle', g: 0.16 } // E6 和聲
      ];

      // 伴奏低音部 (提供莊嚴厚重的雄壯進行曲底蘊)
      const fanfareBass = [
        { f: 130.81, d: 0.42, t: 0.0, w: 'triangle', g: 0.12 }, // C3
        { f: 164.81, d: 0.42, t: 0.45, w: 'triangle', g: 0.12 }, // E3
        { f: 196.00, d: 0.62, t: 0.90, w: 'triangle', g: 0.14 }, // G3
        { f: 130.81, d: 0.65, t: 1.55, w: 'triangle', g: 0.15 }, // C3
        { f: 174.61, d: 0.35, t: 2.25, w: 'triangle', g: 0.12 }, // F3
        { f: 220.00, d: 0.38, t: 2.60, w: 'triangle', g: 0.14 }, // A3
        { f: 246.94, d: 0.38, t: 3.00, w: 'triangle', g: 0.15 }, // B3
        { f: 261.63, d: 1.40, t: 3.40, w: 'triangle', g: 0.18 }  // C4
      ];

      fanfareLead.forEach(n => playTone(n.f, n.w, n.d, n.t, n.g));
      fanfareBass.forEach(n => playTone(n.f, n.w, n.d, n.t, n.g));
    }
  };
})();

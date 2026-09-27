// -----------------------------
// Canvas 初始化與繪圖處理
function initCanvas() {
  bgCanvas = document.getElementById("bgCanvas");
  drawCanvas = document.getElementById("drawCanvas");
  canvasStage = document.getElementById("canvasStage");
  let w = window.innerWidth;
  let h = window.innerHeight - 64;
  bgCanvas.width = drawCanvas.width = w;
  bgCanvas.height = drawCanvas.height = h;
  bgCtx = bgCanvas.getContext("2d");
  drawCtx = drawCanvas.getContext("2d");
  drawCtx.lineCap = "round";
  drawCtx.lineJoin = "round";
  renderBackground();
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  canvasHistory = [];
  isEraserMode = false;
  isTextInsertMode = false;
  updateToolButtonsState();
  // 監聽繪圖與雙擊事件（建立文字框）
  drawCanvas.addEventListener("pointerdown", startDraw);
  drawCanvas.addEventListener("pointermove", draw);
  drawCanvas.addEventListener("pointerup", endDraw);
  drawCanvas.addEventListener("pointercancel", endDraw);
  drawCanvas.addEventListener("pointerout", endDraw);
}

function renderBackground() {
  if (uploadedBackgroundBase64) {
    const img = new Image();
    img.onload = function() {
      let canvasAspect = bgCanvas.width / bgCanvas.height;
      let imgAspect = img.width / img.height;
      let drawWidth, drawHeight, offsetX, offsetY;
      if (imgAspect > canvasAspect) {
        drawWidth = bgCanvas.width;
        drawHeight = bgCanvas.width / imgAspect;
        offsetX = 0;
        offsetY = (bgCanvas.height - drawHeight) / 2;
      } else {
        drawHeight = bgCanvas.height;
        drawWidth = bgCanvas.height * imgAspect;
        offsetX = (bgCanvas.width - drawWidth) / 2;
        offsetY = 0;
      }
      bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
      bgCtx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      // 移除 CSS 背景圖
      bgCanvas.style.backgroundImage = "none";
    };
    img.src = "data:image/png;base64," + uploadedBackgroundBase64;
  } else {
    bgCtx.fillStyle = "#ffffff";
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
  }
}

let lastTapTime = 0;
const doubleTapDelay = 300; // ms
function startDraw(e) {
  // 插入文字模式：點擊畫布上的一點即插入文字框；模式會持續，直到使用者手動切回畫筆或橡皮擦
  if (isTextInsertMode) {
    const rect = canvasStage.getBoundingClientRect();
    createTextBox(e.clientX - rect.left, e.clientY - rect.top);
    e.preventDefault();
    return;
  }

  const currentTime = Date.now();
  if (currentTime - lastTapTime < doubleTapDelay) {
    const rect = canvasStage.getBoundingClientRect();
    createTextBox(e.clientX - rect.left, e.clientY - rect.top);
    e.preventDefault();
    return;
  }
  lastTapTime = currentTime;
  isDrawing = true;
  // 記錄畫筆動作前的畫布快照，供「復原」使用
  pushDrawSnapshot();
  drawCtx.beginPath();
  drawCtx.moveTo(e.offsetX, e.offsetY);
}

function draw(e) {
  if (!isDrawing) return;
  e.preventDefault();
  drawCtx.lineWidth = currentSize;
  if (isEraserMode) {
    drawCtx.globalCompositeOperation = "destination-out";
    drawCtx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    drawCtx.globalCompositeOperation = "source-over";
    drawCtx.strokeStyle = currentColor;
  }
  drawCtx.lineTo(e.offsetX, e.offsetY);
  drawCtx.stroke();
}

function endDraw(e) {
  isDrawing = false;
  drawCtx.closePath();
}

// -----------------------------
// 工具切換（畫筆／橡皮擦／插入文字，三者互斥）
function usePen() {
  isEraserMode = false;
  isTextInsertMode = false;
  updateToolButtonsState();
}

function useEraser() {
  isEraserMode = true;
  isTextInsertMode = false;
  updateToolButtonsState();
}

function useTextInsertMode() {
  isEraserMode = false;
  isTextInsertMode = true;
  updateToolButtonsState();
}

function updateToolButtonsState() {
  const btnPen = document.getElementById("btnPen");
  const btnEraser = document.getElementById("btnEraser");
  const btnInsertText = document.getElementById("btnInsertText");
  if (btnPen) btnPen.classList.toggle("active", !isEraserMode && !isTextInsertMode);
  if (btnEraser) btnEraser.classList.toggle("active", isEraserMode);
  if (btnInsertText) btnInsertText.classList.toggle("active", isTextInsertMode);
  if (drawCanvas) {
    drawCanvas.style.cursor = isTextInsertMode ? "text" : "crosshair";
  }
}

function clearCanvas() {
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  canvasHistory = [];
}

// -----------------------------
// 復原（回上一步）：可還原上一次畫筆動作，或移除上一個新增的文字框
function pushDrawSnapshot() {
  canvasHistory.push({
    type: "draw",
    snapshot: drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height)
  });
}

function pushTextSnapshot(textBoxElement) {
  canvasHistory.push({ type: "text", element: textBoxElement });
}

function undoLastAction() {
  if (canvasHistory.length === 0) return;
  const last = canvasHistory.pop();
  if (last.type === "draw") {
    drawCtx.putImageData(last.snapshot, 0, 0);
  } else if (last.type === "text") {
    if (activeTextBox === last.element) {
      activeTextBox = null;
      closeTextEditModal();
    }
    if (last.element && last.element.parentNode) {
      last.element.remove();
    }
  }
}

function exitCanvas() {
  fullCanvasMode.style.display = "none";
  uploadModal.style.display = "block";
  chosenMode = null;
  canvasImageBase64 = null;
  uploadedBackgroundBase64 = null;
  btnCanvas.innerText = "使用即時畫布";
  btnUpload.innerHTML = '上傳圖片';
  document.body.style.overflow = "auto";
  canvasHistory = [];
  isEraserMode = false;
  isTextInsertMode = false;
  updateToolButtonsState();
}

// -----------------------------
// 修改 submitCanvas：
// 只擷取畫布區域（canvasStage，不含上方工具列）；擷取前隱藏所有文字框的邊框、陰影
// 與右下的圓形 (resize-handle)，只保留文字本身，擷取後再還原
function submitCanvas() {
  const textBoxes = canvasStage.querySelectorAll('.text-box');
  const originalBorders = [];
  const originalShadows = [];
  const originalHandleDisplays = [];
  textBoxes.forEach((box, idx) => {
    originalBorders[idx] = box.style.border;
    originalShadows[idx] = box.style.boxShadow;
    box.style.border = "none";
    box.style.boxShadow = "none";
    const handle = box.querySelector('.resize-handle');
    if (handle) {
      originalHandleDisplays[idx] = handle.style.display;
      handle.style.display = "none";
    }
  });

  html2canvas(canvasStage, { allowTaint: true, useCORS: true }).then(function(canvas) {
    // 還原文字框邊框、陰影與 resize-handle
    textBoxes.forEach((box, idx) => {
      box.style.border = originalBorders[idx];
      box.style.boxShadow = originalShadows[idx];
      const handle = box.querySelector('.resize-handle');
      if (handle) {
        handle.style.display = originalHandleDisplays[idx];
      }
    });

    const dataURL = canvas.toDataURL("image/png");
    canvasImageBase64 = dataURL.split(",")[1];
    fullCanvasMode.style.display = "none";
    uploadModal.style.display = "block";
    let nameInput = document.getElementById("name");
    let discussionInput = document.getElementById("discussion");
    let baseName = nameInput.value.trim() || "canvas";
    let discussionText = discussionInput.value.trim();
    let canvasName = baseName + (discussionText ? "+" + discussionText : "");
    if (!canvasName.toLowerCase().endsWith(".png")) {
      canvasName += ".png";
    }
    nameInput.value = canvasName;
    canvasFileNameDisplay.innerText = "檔案名稱：" + canvasName;
    btnCanvas.innerText = "使用即時畫布 (已有畫布)";
    btnUpload.innerHTML = '上傳圖片 <span style="color:red;">(已使用即時畫布，不可上傳圖片)</span>';
  }).catch(function(error) {
    // 錯誤時也還原
    textBoxes.forEach((box, idx) => {
      box.style.border = originalBorders[idx];
      box.style.boxShadow = originalShadows[idx];
      const handle = box.querySelector('.resize-handle');
      if (handle) {
        handle.style.display = originalHandleDisplays[idx];
      }
    });
    console.error("html2canvas error:", error);
  });
}

window.addEventListener("resize", function() {
  if (fullCanvasMode.style.display === "block") {
    let oldBg = bgCtx.getImageData(0, 0, bgCanvas.width, bgCanvas.height);
    let oldDraw = drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
    let w = window.innerWidth;
    let h = window.innerHeight - 64;
    bgCanvas.width = drawCanvas.width = w;
    bgCanvas.height = drawCanvas.height = h;
    bgCtx.putImageData(oldBg, 0, 0);
    drawCtx.putImageData(oldDraw, 0, 0);
    // 畫布尺寸改變後，先前的復原快照已不適用
    canvasHistory = [];
  }
});

document.getElementById("brushColor").addEventListener("change", function(e) {
  currentColor = e.target.value;
  usePen();
});
document.getElementById("brushSize").addEventListener("change", function(e) {
  currentSize = parseInt(e.target.value, 10);
  usePen();
});

function uploadBackgroundImage() {
  backgroundImageInput.click();
}

backgroundImageInput.addEventListener("change", function(){
  const file = this.files[0];
  if(file) {
    let reader = new FileReader();
    reader.onload = function(e) {
      uploadedBackgroundBase64 = e.target.result.split(",")[1];
      renderBackground();
    };
    reader.readAsDataURL(file);
  }
});

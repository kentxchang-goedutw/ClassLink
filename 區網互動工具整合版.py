# -*- coding: utf-8 -*-
"""
區網互動工具整合版 - 教師端啟動中心
LAN_TOOLS_LAUNCHER_MARKER（啟動程式.bat 以此字串尋找本檔，請勿刪除）

整合三個區網互動教學工具，由教師在同一個視窗中選擇要啟動哪一個：
  1. 紫斑之翼 RPG 答題遊戲          tools/RPG答題遊戲/web_exe2.py
  2. WEB 區網互動工具箱（剛好系列）  tools/WEB區網互動工具(剛好系列)/web_exe2.py
  3. 螢幕畫筆 · 截圖互動             tools/螢幕畫筆截圖互動/區網版螢幕畫筆_區網互動版.py

每個工具都以「獨立程序」執行，各自保有原本完整的功能、資料夾與設定，
彼此不會互相干擾；關閉工具視窗後可回到本啟動中心再選擇其他工具。

用法：
  python 區網互動工具整合版.py              開啟選擇視窗
  python 區網互動工具整合版.py game|web|pen 直接啟動指定工具（可做成桌面捷徑）
"""
import os
import sys
import socket
import subprocess
import traceback

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TOOLS_DIR = os.path.join(BASE_DIR, "tools")

# port 為預設連接埠；若已被占用，啟動器會自動往後找可用的連接埠再傳給工具
TOOLS = [
    {
        "key": "game",
        "emoji": "🦋",
        "title": "紫斑之翼 RPG 答題遊戲",
        "desc": "台灣紫斑蝶生態 JRPG 闖關答題：自訂題庫派送、\n倒數答題、錯題分析與成果報告。",
        "folder": "RPG答題遊戲",
        "script": "web_exe2.py",
        "port": 8080,
        "color": "#C4B5FD",
    },
    {
        "key": "web",
        "emoji": "🧩",
        "title": "WEB 區網互動工具箱（剛好系列）",
        "desc": "剛好學／白板／簡報／測、作業繳交與展示牆、\n心智圖、你畫我猜、配對遊戲等課堂互動。",
        "folder": "WEB區網互動工具(剛好系列)",
        "script": "web_exe2.py",
        "port": 8000,
        "color": "#FBCFE8",
    },
    {
        "key": "pen",
        "emoji": "🖍️",
        "title": "螢幕畫筆 · 截圖互動",
        "desc": "觸控大屏畫記、框選螢幕截圖出題（塗鴉／選擇／\n簡答／計算），學生 iPad 即時作答與儀表板。",
        "folder": "螢幕畫筆截圖互動",
        "script": "區網版螢幕畫筆_區網互動版.py",
        "port": 8000,
        "color": "#A7F3D0",
    },
]


def _log(msg):
    try:
        import time
        with open(os.path.join(BASE_DIR, "launcher_debug.log"), "a", encoding="utf-8") as f:
            f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")
    except Exception:
        pass


def tool_path(tool):
    return os.path.join(TOOLS_DIR, tool["folder"], tool["script"])


def port_is_free(port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("0.0.0.0", port))
        return True
    except OSError:
        return False
    finally:
        s.close()


def find_free_port(start, attempts=20, reserved=()):
    for p in range(start, start + attempts):
        if p not in reserved and port_is_free(p):
            return p
    return start


def gui_python():
    """優先使用 pythonw.exe 啟動工具，避免多出黑色命令列視窗。"""
    exe = sys.executable
    folder, name = os.path.split(exe)
    if name.lower() == "python.exe":
        pyw = os.path.join(folder, "pythonw.exe")
        if os.path.isfile(pyw):
            return pyw
    return exe


def launch_tool(tool, reserved=()):
    """以獨立程序啟動工具，回傳 (Popen, port)。
    reserved：其他執行中工具已分配的連接埠（工具剛啟動時可能還沒真正占用，需事先避開）"""
    script = tool_path(tool)
    if not os.path.isfile(script):
        raise FileNotFoundError(f"找不到工具主程式：\n{script}")
    args = [gui_python(), script]
    port = None
    if tool["port"]:
        port = find_free_port(tool["port"], reserved=reserved)
        args.append(str(port))
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if os.name == "nt" else 0
    proc = subprocess.Popen(args, cwd=os.path.dirname(script), creationflags=flags)
    _log(f"Launched {tool['key']} pid={proc.pid} port={port} args={args}")
    return proc, port


# ------------------------------------------------------
# 直接啟動模式（命令列指定工具，不開選擇視窗）
# ------------------------------------------------------
if len(sys.argv) > 1 and sys.argv[1].lower() in {t["key"] for t in TOOLS}:
    _tool = next(t for t in TOOLS if t["key"] == sys.argv[1].lower())
    launch_tool(_tool)
    sys.exit(0)


from PyQt5.QtCore import Qt, QTimer, QUrl
from PyQt5.QtGui import QFont, QIcon, QDesktopServices
from PyQt5.QtWidgets import (QApplication, QWidget, QLabel, QPushButton, QVBoxLayout,
                             QHBoxLayout, QFrame, QMessageBox, QGraphicsDropShadowEffect)
from PyQt5.QtGui import QColor

try:
    import ctypes
    ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("teacher.lan.tools.launcher.v1")
except Exception:
    pass


STYLE = """
QWidget#root { background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #FFF7ED, stop:1 #EEF2FF); }
QLabel#title { font-size: 26px; font-weight: 800; color: #4C1D95; }
QLabel#subtitle { font-size: 14px; color: #6B7280; }
QFrame#card { background: rgba(255,255,255,0.92); border-radius: 22px; border: 2px solid transparent; }
QLabel#cardEmoji { font-size: 44px; }
QLabel#cardTitle { font-size: 19px; font-weight: 800; color: #1F2937; }
QLabel#cardDesc { font-size: 13px; color: #4B5563; }
QLabel#status { font-size: 13px; font-weight: 700; border-radius: 11px; padding: 4px 12px; }
QPushButton { border-radius: 16px; padding: 10px 18px; font-size: 15px; font-weight: 700; }
QPushButton#start { background: #8B5CF6; color: white; }
QPushButton#start:hover { background: #7C3AED; }
QPushButton#start:disabled { background: #D1D5DB; color: #6B7280; }
QPushButton#minor { background: #F3F4F6; color: #374151; font-size: 13px; padding: 8px 14px; }
QPushButton#minor:hover { background: #E5E7EB; }
QPushButton#stop { background: #FEE2E2; color: #B91C1C; font-size: 13px; padding: 8px 14px; }
QPushButton#stop:hover { background: #FECACA; }
QLabel#footer { font-size: 12px; color: #9CA3AF; }
"""


class ToolCard(QFrame):
    def __init__(self, tool, launcher):
        super().__init__()
        self.tool = tool
        self.launcher = launcher
        self.proc = None
        self.port = None
        self.setObjectName("card")
        self.setStyleSheet(f"QFrame#card {{ border-left: 10px solid {tool['color']}; }}")
        shadow = QGraphicsDropShadowEffect(self)
        shadow.setBlurRadius(24)
        shadow.setOffset(0, 6)
        shadow.setColor(QColor(76, 29, 149, 40))
        self.setGraphicsEffect(shadow)

        emoji = QLabel(tool["emoji"])
        emoji.setObjectName("cardEmoji")
        emoji.setFixedWidth(72)
        emoji.setAlignment(Qt.AlignCenter)

        title = QLabel(tool["title"])
        title.setObjectName("cardTitle")
        desc = QLabel(tool["desc"])
        desc.setObjectName("cardDesc")
        desc.setWordWrap(True)
        self.status = QLabel()
        self.status.setObjectName("status")

        text_box = QVBoxLayout()
        text_box.setSpacing(4)
        head = QHBoxLayout()
        head.addWidget(title)
        head.addStretch()
        head.addWidget(self.status)
        text_box.addLayout(head)
        text_box.addWidget(desc)

        self.btn_start = QPushButton("▶ 啟動")
        self.btn_start.setObjectName("start")
        self.btn_start.setCursor(Qt.PointingHandCursor)
        self.btn_start.setMinimumWidth(130)
        self.btn_start.clicked.connect(self.start)

        self.btn_stop = QPushButton("■ 強制結束")
        self.btn_stop.setObjectName("stop")
        self.btn_stop.setCursor(Qt.PointingHandCursor)
        self.btn_stop.clicked.connect(self.stop)

        btn_folder = QPushButton("📂 資料夾")
        btn_folder.setObjectName("minor")
        btn_folder.setCursor(Qt.PointingHandCursor)
        btn_folder.clicked.connect(self.open_folder)

        btns = QVBoxLayout()
        btns.setSpacing(6)
        btns.addWidget(self.btn_start)
        row = QHBoxLayout()
        row.addWidget(btn_folder)
        row.addWidget(self.btn_stop)
        btns.addLayout(row)

        lay = QHBoxLayout(self)
        lay.setContentsMargins(18, 16, 18, 16)
        lay.setSpacing(14)
        lay.addWidget(emoji)
        lay.addLayout(text_box, 1)
        lay.addLayout(btns)

        if not os.path.isfile(tool_path(tool)):
            self.btn_start.setEnabled(False)
            self.btn_start.setText("找不到程式")
        self.refresh()

    @property
    def running(self):
        return self.proc is not None and self.proc.poll() is None

    def refresh(self):
        if self.running:
            port_text = f"（port {self.port}）" if self.port else ""
            self.status.setText(f"● 執行中{port_text}")
            self.status.setStyleSheet("color:#047857; background:#D1FAE5;")
            self.btn_start.setEnabled(False)
            self.btn_start.setText("執行中…")
            self.btn_stop.setVisible(True)
        else:
            if self.proc is not None:
                _log(f"{self.tool['key']} exited code={self.proc.returncode}")
                self.proc = None
                self.port = None
            self.status.setText("○ 未啟動")
            self.status.setStyleSheet("color:#6B7280; background:#F3F4F6;")
            if os.path.isfile(tool_path(self.tool)):
                self.btn_start.setEnabled(True)
                self.btn_start.setText("▶ 啟動")
            self.btn_stop.setVisible(False)

    def start(self):
        others = [c for c in self.launcher.cards if c is not self and c.running]
        if others:
            names = "、".join(c.tool["title"] for c in others)
            reply = QMessageBox.question(
                self, "同時啟動多個工具",
                f"目前「{names}」仍在執行中。\n\n"
                "多個工具可以同時執行（會自動使用不同的連接埠），\n"
                "但學生要連到正確的網址／QR Code。\n\n確定要再啟動「" + self.tool["title"] + "」嗎？",
                QMessageBox.Yes | QMessageBox.No, QMessageBox.Yes)
            if reply != QMessageBox.Yes:
                return
        try:
            reserved = {c.port for c in self.launcher.cards if c.running and c.port}
            self.proc, self.port = launch_tool(self.tool, reserved)
        except Exception as e:
            _log(traceback.format_exc())
            QMessageBox.critical(self, "啟動失敗", f"無法啟動「{self.tool['title']}」：\n\n{e}")
            return
        self.refresh()
        self.launcher.showMinimized()

    def stop(self):
        if not self.running:
            return
        reply = QMessageBox.warning(
            self, "強制結束",
            f"建議直接關閉「{self.tool['title']}」的視窗來結束程式。\n\n"
            "強制結束可能會遺失尚未儲存的資料，確定要強制結束嗎？",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
        if reply == QMessageBox.Yes:
            try:
                self.proc.terminate()
                self.proc.wait(timeout=5)
            except Exception:
                pass
            self.refresh()

    def open_folder(self):
        QDesktopServices.openUrl(QUrl.fromLocalFile(os.path.join(TOOLS_DIR, self.tool["folder"])))


class Launcher(QWidget):
    def __init__(self):
        super().__init__()
        self.setObjectName("root")
        self.setAttribute(Qt.WA_StyledBackground, True)
        self.setWindowTitle("區網互動工具整合版 - 教師啟動中心")
        self.setStyleSheet(STYLE)
        icon = os.path.join(TOOLS_DIR, "WEB區網互動工具(剛好系列)", "app_icon.ico")
        if os.path.isfile(icon):
            self.setWindowIcon(QIcon(icon))

        title = QLabel("🏫 區網互動工具整合版")
        title.setObjectName("title")
        subtitle = QLabel("請選擇這堂課要和學生互動的工具。學生與老師電腦需連在同一個區域網路／Wi-Fi。")
        subtitle.setObjectName("subtitle")
        subtitle.setWordWrap(True)

        lay = QVBoxLayout(self)
        lay.setContentsMargins(28, 24, 28, 18)
        lay.setSpacing(14)
        lay.addWidget(title)
        lay.addWidget(subtitle)

        self.cards = [ToolCard(t, self) for t in TOOLS]
        for c in self.cards:
            lay.addWidget(c)

        footer = QLabel("💡 第一次啟動時 Windows 防火牆可能詢問是否允許存取，請勾選「私人網路」並允許，學生才能連線。\n"
                        "💡 關閉工具視窗後會回到這裡，可再選擇其他工具。")
        footer.setObjectName("footer")
        footer.setWordWrap(True)
        lay.addStretch()
        lay.addWidget(footer)

        self.resize(860, 640)
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.poll)
        self.timer.start(1000)

    def poll(self):
        was_running = any(c.proc is not None for c in self.cards)
        for c in self.cards:
            c.refresh()
        # 所有工具都已關閉時，自動把啟動中心叫回前景
        if was_running and not any(c.running for c in self.cards):
            self.showNormal()
            self.raise_()
            self.activateWindow()

    def closeEvent(self, event):
        running = [c for c in self.cards if c.running]
        if running:
            names = "\n".join("  • " + c.tool["title"] for c in running)
            reply = QMessageBox.question(
                self, "關閉啟動中心",
                f"下列工具仍在執行中：\n{names}\n\n"
                "關閉啟動中心不會影響這些工具，它們會繼續執行。\n確定要關閉啟動中心嗎？",
                QMessageBox.Yes | QMessageBox.No, QMessageBox.Yes)
            if reply != QMessageBox.Yes:
                event.ignore()
                return
        event.accept()


def main():
    if hasattr(Qt, "AA_EnableHighDpiScaling"):
        QApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    if hasattr(Qt, "AA_UseHighDpiPixmaps"):
        QApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)
    app = QApplication(sys.argv)
    app.setFont(QFont("Microsoft JhengHei UI", 10))
    win = Launcher()
    win.show()
    sys.exit(app.exec_())


if __name__ == "__main__":
    try:
        main()
    except Exception:
        _log("CRASH: " + traceback.format_exc())
        try:
            app = QApplication.instance() or QApplication(sys.argv)
            QMessageBox.critical(None, "啟動中心發生錯誤", traceback.format_exc())
        except Exception:
            pass

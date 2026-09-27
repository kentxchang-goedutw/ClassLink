#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
《紫斑之翼：奇幻大遷徙》- 區網多人互動教學工具箱與圖形介面啟動器
整合 PyQt5 桌面圖形介面、Threaded HTTP Server、區網 IP 自動偵測、學生連線 QR Code 與本地 Game-data 資料儲存
"""

import os
import re
import sys
import time
import json
import socket
import urllib.parse
import mimetypes
import webbrowser
import threading
import traceback
import importlib.util
import subprocess
import io
import base64
import zipfile
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn

# ------------------------------------------------------
# 記錄啟動日誌與安全輸出物件 (防 PyInstaller --windowed 崩潰)
# ------------------------------------------------------
def _early_log(msg):
    try:
        p = os.path.join(os.path.dirname(sys.executable if getattr(sys, 'frozen', False) else os.path.abspath(__file__)), "startup_debug.log")
        with open(p, "a", encoding="utf-8") as f:
            f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")
    except Exception:
        pass

class _NullWriter:
    def write(self, *args, **kwargs):
        pass
    def flush(self):
        pass
    def isatty(self):
        return False

if sys.stdout is None:
    sys.stdout = _NullWriter()
if sys.stderr is None:
    sys.stderr = _NullWriter()

# ------------------------------------------------------
# 自動檢查必要相依套件
# ------------------------------------------------------
REQUIRED_PACKAGES = {
    "PyQt5": "PyQt5",
    "PyQt5.QtWebEngineWidgets": "PyQtWebEngine",
    "qrcode": "qrcode",
    "PIL": "Pillow",
}

def _ask_yes_no(title, message):
    try:
        import tkinter as tk
        from tkinter import messagebox
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        answer = messagebox.askyesno(title, message)
        root.destroy()
        return answer
    except Exception:
        return True

def _show_message(title, message, error=False):
    try:
        import tkinter as tk
        from tkinter import messagebox
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        if error:
            messagebox.showerror(title, message)
        else:
            messagebox.showinfo(title, message)
        root.destroy()
    except Exception:
        pass

def ensure_dependencies():
    if getattr(sys, "frozen", False):
        return

    missing_specs = []
    seen_pip = set()
    for module_name, pip_name in REQUIRED_PACKAGES.items():
        if importlib.util.find_spec(module_name) is None and pip_name not in seen_pip:
            missing_specs.append(pip_name)
            seen_pip.add(pip_name)

    if not missing_specs:
        return

    pkg_list = "\n".join(f"  • {p}" for p in missing_specs)
    should_install = _ask_yes_no(
        "缺少必要套件",
        "偵測到本程式執行需要以下 Python 套件，但目前系統尚未安裝：\n\n"
        f"{pkg_list}\n\n"
        "是否要立即自動安裝這些套件？（需要網路連線）\n"
        "安裝完成後程式將自動重新啟動。"
    )
    if not should_install:
        _show_message("已取消安裝", "未安裝必要套件，程式即將結束。", error=True)
        sys.exit(1)

    for pkg in missing_specs:
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", pkg])
        except Exception as e:
            _show_message("安裝失敗", f"安裝套件 {pkg} 時發生錯誤：\n{e}\n\n請以命令提示字元手動執行：\npip install {pkg}", error=True)
            sys.exit(1)

    _show_message("安裝完成", "必要套件已安裝完成，程式即將重新啟動。")
    os.execv(sys.executable, [sys.executable] + sys.argv)

ensure_dependencies()

# ------------------------------------------------------
# 匯入 GUI 與繪圖相關模組
# ------------------------------------------------------
import qrcode
from PIL import Image

from PyQt5.QtCore import QThread, pyqtSignal, QUrl, Qt, QRect, QRectF
from PyQt5.QtGui import (QIcon, QPixmap, QImage, QPainter, QColor,
                         QLinearGradient, QPen, QBrush, QCursor)
from PyQt5.QtWidgets import (QApplication, QMainWindow, QLabel, QVBoxLayout,
                             QWidget, QLineEdit, QComboBox, QPushButton, QHBoxLayout,
                             QFrame, QToolTip, QMessageBox, QDialog, QFileDialog)
from PyQt5.QtWebEngineWidgets import QWebEngineView

# 安全顯示 ToolTip 輔助函式 (相容 QRect 整數型別，防各版本 PyQt5 多載型別例外)
def show_app_tooltip(text, widget=None, msec=1500):
    try:
        QToolTip.showText(QCursor.pos(), text, widget, QRect(), msec)
    except Exception:
        try:
            QToolTip.showText(QCursor.pos(), text, widget)
        except Exception:
            pass

# 設定 Windows 工作列識別碼
try:
    import ctypes
    myappid = 'teacher.butterfly.rpg.interactive.launcher.v1'
    ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)
except Exception:
    pass

def get_base_path():
    if getattr(sys, 'frozen', False):
        return os.environ.get("WEBCLASS_ORIGINAL_BASE") or os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

BASE_DIR = get_base_path()
DATA_DIR = os.path.join(BASE_DIR, "Game-data")
IMAGES_DIR = os.path.join(BASE_DIR, "assets", "images")
CUSTOM_IMG_DIR = os.path.join(IMAGES_DIR, "custom")

if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR, exist_ok=True)
if not os.path.exists(CUSTOM_IMG_DIR):
    os.makedirs(CUSTOM_IMG_DIR, exist_ok=True)

# 補充常見 MIME 類型
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("image/jpeg", ".jpg")
mimetypes.add_type("image/png", ".png")
mimetypes.add_type("image/webp", ".webp")

# 系統 20 張核心遊戲圖片清單與鳥山明風格 AI 生圖建議 Prompt
GAME_IMAGES_META = [
    # --- 四大紫斑蝶勇者 ---
    {
        "filename": "hero_sprite.png",
        "category": "heroes",
        "categoryName": "四大紫斑蝶勇者",
        "name": "小紫（幻紫遊俠）立繪",
        "desc": "戰鬥舞台主角全身戰鬥姿態立繪",
        "spec": "PNG (透明背景) ｜ 建議 800×1000",
        "defaultPath": "assets/images/hero_sprite.png",
        "promptEn": "Full-body anime character sprite, young agile butterfly hero ranger named Xiao-Zi, Akira Toriyama 1990s anime style, Dragon Ball aesthetic, spiky black hair with cute butterfly antennae headband, aviator goggles around forehead, courageous cheerful smile, red adventurer scarf, leather light armor tunic, holding glowing purple blade, translucent magical purple butterfly wings with violet structural color luminescence, dynamic battle ready stance, clean isolated transparent background, vector style outlines, high quality 2D game asset --ar 3:4",
        "promptZh": "鳥山明七龍珠熱血冒險風格，黑髮戴護目鏡與觸角頭帶的紫斑蝶少年遊俠，身穿皮甲圍紅圍巾，持紫光之刃，背負半透明紫彩蝶翼，透明背景。"
    },
    {
        "filename": "avatar_purple.png",
        "category": "heroes",
        "categoryName": "四大紫斑蝶勇者",
        "name": "小紫（幻紫遊俠）頭像",
        "desc": "主畫面、對話框與對抗狀態頭像",
        "spec": "PNG (透明背景) ｜ 建議 400×400",
        "defaultPath": "assets/images/avatar_purple.png",
        "promptEn": "Square profile avatar icon, close-up face portrait of young butterfly hero boy Xiao-Zi, Akira Toriyama style, energetic smile, bright eyes, spiky hair with butterfly antennae headband and pilot goggles, red scarf collar, vibrant colors, clean sharp line art, transparent background, RPG dialogue face icon --ar 1:1",
        "promptZh": "小紫少年遊俠頭像特寫，熱血開朗微笑，頭戴護目鏡與蝴蝶觸角頭帶，透明背景。"
    },
    {
        "filename": "hero_sprite_round.png",
        "category": "heroes",
        "categoryName": "四大紫斑蝶勇者",
        "name": "阿圓（圓翅巨盾戰士）立繪",
        "desc": "戰鬥舞台阿圓全身防禦戰鬥姿態立繪",
        "spec": "PNG (透明背景) ｜ 建議 800×1000",
        "defaultPath": "assets/images/hero_sprite_round.png",
        "promptEn": "Full-body anime character sprite, muscular burly hero warrior named A-Yuan, Akira Toriyama style, bulky golden plate armor, holding a giant circular stone-edged shield with butterfly round-wing markings, confident hearty grin, spiky brown hair, golden earth aura, thick armored boots, dynamic defensive stance, clean isolated transparent background, 2D RPG game asset --ar 3:4",
        "promptZh": "鳥山明風格魁梧壯士戰士阿圓，身著厚重黃金金屬板甲，持圓翅斑紋巨型磐石重盾，豪爽自信，透明背景。"
    },
    {
        "filename": "avatar_round.png",
        "category": "heroes",
        "categoryName": "四大紫斑蝶勇者",
        "name": "阿圓（圓翅巨盾戰士）頭像",
        "desc": "阿圓主畫面選角與對話框頭像",
        "spec": "PNG (透明背景) ｜ 建議 400×400",
        "defaultPath": "assets/images/avatar_round.png",
        "promptEn": "Square profile avatar icon, close-up face portrait of burly muscular armored warrior A-Yuan, Akira Toriyama style, hearty laughing expression, golden warrior helmet, thick jawline, courageous earth warrior, transparent background, RPG dialogue icon --ar 1:1",
        "promptZh": "圓翅戰士阿圓頭像特寫，豪邁大笑，戴黃金戰士頭盔，透明背景。"
    },
    {
        "filename": "hero_sprite_syl.png",
        "category": "heroes",
        "categoryName": "四大紫斑蝶勇者",
        "name": "阿斯（斯氏靈智賢者）立繪",
        "desc": "戰鬥舞台阿斯賢者懸浮施法姿態立繪",
        "spec": "PNG (透明背景) ｜ 建議 800×1000",
        "defaultPath": "assets/images/hero_sprite_syl.png",
        "promptEn": "Full-body anime character sprite, cute anthropomorphic sage cat mage named A-Si, Akira Toriyama style like Korin and Chrono Trigger, fluffy whiskers, wearing blue scholar robes with celestial constellations, wearing a golden monocle, holding a glowing lightning crystal staff, three distinct white dots on translucent butterfly wings, floating softly, clean transparent background, 2D game asset --ar 3:4",
        "promptZh": "鳥山明奇幻風格可愛擬人貓咪賢者阿斯，戴單片眼鏡，身穿星象法袍持天雷法杖，翅膀具斯氏三點斑紋，透明背景。"
    },
    {
        "filename": "avatar_syl.png",
        "category": "heroes",
        "categoryName": "四大紫斑蝶勇者",
        "name": "阿斯（斯氏靈智賢者）頭像",
        "desc": "阿斯主畫面選角與對話框頭像",
        "spec": "PNG (透明背景) ｜ 建議 400×400",
        "defaultPath": "assets/images/avatar_syl.png",
        "promptEn": "Square profile avatar icon, close-up head portrait of adorable wise feline mage cat A-Si, Akira Toriyama style, golden monocle over left eye, clever intelligent expression, wizard hat, blue robe collar, transparent background, 2D RPG icon --ar 1:1",
        "promptZh": "斯氏靈智賢者貓咪頭像特寫，戴金色單片鏡，眼神睿智，透明背景。"
    },
    {
        "filename": "hero_sprite_mul.png",
        "category": "heroes",
        "categoryName": "四大紫斑蝶勇者",
        "name": "端端（端紫暗影刺客）立繪",
        "desc": "戰鬥舞台端端女刺客突進戰鬥立繪",
        "spec": "PNG (透明背景) ｜ 建議 800×1000",
        "defaultPath": "assets/images/hero_sprite_mul.png",
        "promptEn": "Full-body anime character sprite, cool female ninja assassin named Duan-Duan, Akira Toriyama style, athletic agile figure, short stylish dark purple hair, ninja stealth shinobi outfit with violet flame accents, reverse-grip twin wing feather daggers, determined fierce gaze, scattering purple scale particles, clean isolated transparent background, 2D RPG game sprite --ar 3:4",
        "promptZh": "鳥山明風格英氣女刺客端端，紫黑俐落短髮，身著暗影忍裝手持雙羽刃，冷酷專注，紫焰流光，透明背景。"
    },
    {
        "filename": "avatar_mul.png",
        "category": "heroes",
        "categoryName": "四大紫斑蝶勇者",
        "name": "端端（端紫暗影刺客）頭像",
        "desc": "端端主畫面選角與對話框頭像",
        "spec": "PNG (透明背景) ｜ 建議 400×400",
        "defaultPath": "assets/images/avatar_mul.png",
        "promptEn": "Square profile avatar icon, close-up portrait of cool fierce female assassin Duan-Duan, Akira Toriyama style, short purple hair, intense focused eyes, slight smirk, high-collar shinobi vest, transparent background, 2D RPG portrait --ar 1:1",
        "promptZh": "端紫刺客端端頭像特寫，冷酷自信側臉，紫髮英氣眼眸，透明背景。"
    },

    # --- 五大關卡試煉魔王 ---
    {
        "filename": "slime_sprite.png",
        "category": "bosses",
        "categoryName": "五大關卡試煉魔王",
        "name": "第 1 關關主「貪睡巨角仙」立繪",
        "desc": "第一章茂林幽谷守護魔王戰鬥立繪",
        "spec": "PNG (透明背景) ｜ 建議 800×900",
        "defaultPath": "assets/images/slime_sprite.png",
        "promptEn": "Chubby comical giant rhinoceros beetle boss monster named Sleepy Horn Beetle, Akira Toriyama monster style like Dragon Quest, wearing a blue and white striped sleeping nightcap on its big horn, blowing a cute snot sleeping bubble from nose, clutching a sugarcane stalk like a pillow, glossy brown shell, cartoon expressive face, clean isolated transparent background, 2D RPG boss sprite --ar 1:1",
        "promptZh": "鳥山明勇者鬥惡龍風格肥嘟嘟獨角仙怪獸，頭戴藍白條紋睡帽，吹著鼻涕泡抱著甘蔗，滑稽逗趣，透明背景。"
    },
    {
        "filename": "mirage_sprite.png",
        "category": "bosses",
        "categoryName": "五大關卡試煉魔王",
        "name": "第 2 關關主「狂風沙蜥怪」立繪",
        "desc": "第二章月世界惡地守護魔王戰鬥立繪",
        "spec": "PNG (透明背景) ｜ 建議 800×900",
        "defaultPath": "assets/images/mirage_sprite.png",
        "promptEn": "Desert lizard warrior boss monster named Gale Sand Lizard, Akira Toriyama dinosaur and reptile tribe style, scaly yellow-ochre skin, wearing goggles and tattered desert sand cloak, wielding a spiked cactus club, cunning toothy grin, sand dust swirling around feet, battle stance, clean isolated transparent background, 2D RPG boss sprite --ar 1:1",
        "promptZh": "鳥山明蜥蜴人風格沙漠戰士，土黃鱗片披防風斗篷戴護目鏡，揮舞仙人掌狼牙棒，揚起風沙，透明背景。"
    },
    {
        "filename": "demon_sprite.png",
        "category": "bosses",
        "categoryName": "五大關卡試煉魔王",
        "name": "第 3 關關主「雷雲怪鳥」立繪",
        "desc": "第三章濁水溪河谷守護魔王戰鬥立繪",
        "spec": "PNG (透明背景) ｜ 建議 800×900",
        "defaultPath": "assets/images/demon_sprite.png",
        "promptEn": "Thunderbird harpy boss monster named Storm Cloud Bird, Akira Toriyama style creature, magnificent giant eagle raptor with storm cloud plumage, glowing electric yellow eyes, sparks of lightning crackling across wingtips and sharp talons, fierce screeching beak, aggressive aerial combat pose, clean transparent background, 2D RPG boss sprite --ar 1:1",
        "promptZh": "鳥山明怪獸風格雷雲巨鷹鳥人，羽翼翻騰雷光與電弧，金黃眼眸與銳利巨爪，威嚴咆哮，透明背景。"
    },
    {
        "filename": "frost_sprite.png",
        "category": "bosses",
        "categoryName": "五大關卡試煉魔王",
        "name": "第 4 關關主「渦輪機械獸」立繪",
        "desc": "第四章國道生態廊道守護魔王戰鬥立繪",
        "spec": "PNG (透明背景) ｜ 建議 800×900",
        "defaultPath": "assets/images/frost_sprite.png",
        "promptEn": "Steampunk armored mecha beast boss monster named Turbo Mechabeast, Akira Toriyama mechanical vehicle design style like Dr. Slump and Dragon Ball Red Ribbon mechs, heavy steel plated rhinoceros-bull hybrid, massive roaring exhaust pipes, spinning turbo turbine engines glowing red hot on back, aggressive charging forward, clean isolated transparent background, 2D RPG boss sprite --ar 1:1",
        "promptZh": "鳥山明日系蒸氣龐克機械怪獸，厚重鋼鐵裝甲犀牛，背上帶有旋轉渦輪與高溫排氣管，狂奔衝撞姿態，透明背景。"
    },
    {
        "filename": "boss_sprite.png",
        "category": "bosses",
        "categoryName": "五大關卡試煉魔王",
        "name": "第 5 關終極關主「環境異變巨神」立繪",
        "desc": "第五章繁衍聖地終極守護魔王立繪",
        "spec": "PNG (透明背景) ｜ 建議 900×1000",
        "defaultPath": "assets/images/boss_sprite.png",
        "promptEn": "Colossal final boss deity named Deity of Ecological Mutation, Akira Toriyama grand villain design, imposing biomechanical forest titan, left half composed of ancient mossy sacred tree roots with blooming flora, right half mutated into crystalline purple armor with industrial mechanical cores, glowing omnipotent aura, towering majestic posture, clean isolated transparent background, 2D RPG final boss sprite --ar 1:1",
        "promptZh": "鳥山明風格終極神祇，半身古老森林神木、半身紫晶金屬異變的生態巨神，浩瀚神聖威壓，透明背景。"
    },

    # --- 五大關卡戰鬥背景 ---
    {
        "filename": "forest_bg.jpg",
        "category": "backgrounds",
        "categoryName": "五大關卡戰鬥背景",
        "name": "第 1 關背景：茂林越冬幽谷",
        "desc": "第一章茂林南國幽谷戰鬥背景場景",
        "spec": "JPG (16:9 寬螢幕) ｜ 建議 1920×1080",
        "defaultPath": "assets/images/forest_bg.jpg",
        "promptEn": "Scenic JRPG battle stage background, lush subtropical canyon forest of Maolin Taiwan, warm golden morning sunbeams filtering through dense tree canopy, thousands of purple butterflies fluttering in background, crystal clear winding stream with mossy pebbles, Akira Toriyama anime landscape style, vibrant green and warm lighting, 16:9 landscape wallpaper --ar 16:9",
        "promptZh": "南台灣茂林越冬幽谷，金色晨光灑過繁茂樹冠，萬千紫斑蝶漫天飛舞，清澈溪流與苔石，16:9 鳥山明自然風景。"
    },
    {
        "filename": "desert_bg.jpg",
        "category": "backgrounds",
        "categoryName": "五大關卡戰鬥背景",
        "name": "第 2 關背景：月世界泥岩惡地",
        "desc": "第二章月世界荒丘戰鬥背景場景",
        "spec": "JPG (16:9 寬螢幕) ｜ 建議 1920×1080",
        "defaultPath": "assets/images/desert_bg.jpg",
        "promptEn": "Scenic JRPG battle stage background, barren badlands mudstone terrain of Moon World Taiwan, pale white-grey sharp eroded ridges, dry cracked earth ground, thorny acacia bushes, swirling light dust devils under bright midday sun, Akira Toriyama desert adventure landscape, dramatic canyon vista, 16:9 --ar 16:9",
        "promptZh": "台灣月世界泥岩惡地，灰白尖銳侵蝕山脊與乾裂地表，熱烈蒼茫荒野，16:9。"
    },
    {
        "filename": "river_bg.jpg",
        "category": "backgrounds",
        "categoryName": "五大關卡戰鬥背景",
        "name": "第 3 關背景：濁水溪壯闊河谷",
        "desc": "第三章濁水溪河床戰鬥背景場景",
        "spec": "JPG (16:9 寬螢幕) ｜ 建議 1920×1080",
        "defaultPath": "assets/images/river_bg.jpg",
        "promptEn": "Scenic JRPG battle stage background, vast braided river valley of Zhuoshui River Taiwan, wide gravel and pebble riverbed, sweeping misty mountain ranges on horizon, dramatic brewing thunderstorm clouds with distant lightning flashes, epic windy atmosphere, Akira Toriyama landscape, 16:9 --ar 16:9",
        "promptZh": "台灣濁水溪廣袤礫石河谷，遠處雄偉山脈與翻滾雷雨雲層，狂風呼嘯，16:9。"
    },
    {
        "filename": "highway_bg.jpg",
        "category": "backgrounds",
        "categoryName": "五大關卡戰鬥背景",
        "name": "第 4 關背景：國道生態廊道",
        "desc": "第四章國道三號林內段防蝶生態廊道背景",
        "spec": "JPG (16:9 寬螢幕) ｜ 建議 1920×1080",
        "defaultPath": "assets/images/highway_bg.jpg",
        "promptEn": "Scenic JRPG battle stage background, freeway ecological protection corridor along National Highway 3 in Taiwan, four-meter-tall green butterfly barrier net running along roadside, highway vehicles passing by, green forested foothills in background, sunny bright sky with soaring butterflies, human-nature harmony, Akira Toriyama anime style, 16:9 --ar 16:9",
        "promptZh": "國道三號林內段讓蝶生態廊道，4公尺綠色防護網與奔馳公路，藍天青山與飛舞蝶群，16:9。"
    },
    {
        "filename": "sacred_bg.jpg",
        "category": "backgrounds",
        "categoryName": "五大關卡戰鬥背景",
        "name": "第 5 關背景：竹南繁衍聖地古林",
        "desc": "第五章竹南海岸古防風林戰鬥背景場景",
        "spec": "JPG (16:9 寬螢幕) ｜ 建議 1920×1080",
        "defaultPath": "assets/images/sacred_bg.jpg",
        "promptEn": "Scenic JRPG battle stage background, sacred coastal breeding grove in Zhunan Taiwan, towering ancient windbreak trees with sprawling vines, blooming nectar flowers and milkweed, ethereal mystical golden light beams, dreamlike peaceful paradise of life, Akira Toriyama magical forest style, 16:9 --ar 16:9",
        "promptZh": "竹南繁衍聖地海岸古林，巨大海防林巨木與藤蔓，繁花盛開與金光晨霧，生命傳承聖境，16:9。"
    },

    # --- 遊戲全域場景 ---
    {
        "filename": "title_bg.jpg",
        "category": "system",
        "categoryName": "遊戲全域場景",
        "name": "冒險啟程主畫面背景",
        "desc": "遊戲主登入、學生簽到與選角畫面全螢幕背景",
        "spec": "JPG (16:9 寬螢幕) ｜ 建議 1920×1080",
        "defaultPath": "assets/images/title_bg.jpg",
        "promptEn": "Anime JRPG title screen background art, panoramic bird's-eye view of beautiful Taiwan island mountains coast and green valleys, swarms of iridescent purple butterflies migrating north across the blue sky toward golden sunrise, Akira Toriyama Dragon Ball Z opening cinematic style, hopeful adventure atmosphere, high resolution 16:9 --ar 16:9",
        "promptZh": "遊戲主畫面背景，鳥瞰台灣壯闊山海，迎向朝陽北返的大群紫斑蝶，充滿希望與冒險感的日系 JRPG 序幕，16:9。"
    },
    {
        "filename": "world_map.jpg",
        "category": "system",
        "categoryName": "遊戲全域場景",
        "name": "台灣紫斑蝶遷徙大冒險世界地圖",
        "desc": "世界大地圖探索與關卡導航地圖底圖",
        "spec": "JPG (16:9 寬螢幕) ｜ 建議 1920×1080",
        "defaultPath": "assets/images/world_map.jpg",
        "promptEn": "Vintage illustrated fantasy RPG world map of Taiwan, antique parchment textured map showing high mountains, winding rivers, dense forests and migrating butterfly flight paths, Dragon Quest classic overworld map aesthetic, hand-drawn charming cartography details, warm sepia and earthy tones, 16:9 --ar 16:9",
        "promptZh": "復古奇幻羊皮紙風格之台灣世界大地圖，標繪山脈、河流、林谷與蝴蝶遷徙航線，勇者鬥惡龍世界大地圖風格，16:9。"
    }
]

VALID_FILENAMES = {item["filename"].lower(): item["filename"] for item in GAME_IMAGES_META}

# 確保應用程式圖示
def ensure_app_icon():
    ico_path = os.path.join(BASE_DIR, "app_icon.ico")
    if os.path.exists(ico_path):
        return ico_path
    png_path = os.path.join(BASE_DIR, "app_icon.png")
    if not os.path.exists(png_path):
        try:
            size = 256
            img = QImage(size, size, QImage.Format_ARGB32)
            img.fill(Qt.transparent)
            painter = QPainter(img)
            painter.setRenderHint(QPainter.Antialiasing)

            # 紫金色漸層圓角底圖
            grad = QLinearGradient(0, 0, size, size)
            grad.setColorAt(0.0, QColor('#6c5ce7'))
            grad.setColorAt(0.5, QColor('#a29bfe'))
            grad.setColorAt(1.0, QColor('#ffd700'))

            painter.setPen(Qt.NoPen)
            painter.setBrush(QBrush(grad))
            painter.drawRoundedRect(QRectF(16, 16, 224, 224), 54, 54)

            # 蝴蝶翅膀簡約線條
            painter.setPen(QPen(QColor(255, 255, 255, 230), 8, Qt.SolidLine, Qt.RoundCap, Qt.RoundJoin))
            painter.setBrush(QBrush(QColor(255, 255, 255, 40)))
            painter.drawEllipse(QRectF(60, 60, 64, 80))
            painter.drawEllipse(QRectF(132, 60, 64, 80))
            painter.drawEllipse(QRectF(72, 130, 52, 60))
            painter.drawEllipse(QRectF(132, 130, 52, 60))

            painter.end()
            img.save(png_path)
        except Exception:
            pass
    return png_path

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

def load_json_permissive(filepath):
    """寬容讀取 JSON 檔案，支援過濾註解及多餘逗號"""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pattern = r'("(?:\\.|[^"\\])*")|(/\*[\s\S]*?\*/|//[^\r\n]*)'
        cleaned = re.sub(pattern, lambda m: m.group(1) if m.group(1) else "", content)
        cleaned = re.sub(r',\s*([\]\}])', r'\1', cleaned)
        return json.loads(cleaned)

# ------------------------------------------------------
# 核心 HTTP 請求處理器 (提供靜態託管與 Game-data API)
# ------------------------------------------------------
class RPGGameRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def _set_headers(self, status_code=HTTPStatus.OK, content_type="application/json; charset=utf-8"):
        self.send_response(status_code)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(HTTPStatus.NO_CONTENT)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 預設首頁
        if path == "/":
            self.path = "/index.html"
            return super().do_GET()

        # API: 題庫資料
        if path == "/api/questions":
            fpath = os.path.join(DATA_DIR, "questions.json")
            if os.path.exists(fpath):
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self._set_headers(HTTPStatus.OK)
                    self.wfile.write(json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8"))
                except Exception as e:
                    self._set_headers(HTTPStatus.INTERNAL_SERVER_ERROR)
                    self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            else:
                self._set_headers(HTTPStatus.OK)
                self.wfile.write(json.dumps([]).encode("utf-8"))
            return

        # API: 設定檔
        if path == "/api/config":
            fpath = os.path.join(DATA_DIR, "config.json")
            if os.path.exists(fpath):
                try:
                    data = load_json_permissive(fpath)
                    self._set_headers(HTTPStatus.OK)
                    self.wfile.write(json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8"))
                except Exception as e:
                    self._set_headers(HTTPStatus.INTERNAL_SERVER_ERROR)
                    self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            else:
                self._set_headers(HTTPStatus.NOT_FOUND)
                self.wfile.write(json.dumps({"error": "找不到設定檔"}).encode("utf-8"))
            return

        # API: 範例 CSV
        if path == "/api/sample-csv":
            fpath = os.path.join(DATA_DIR, "sample_import.csv")
            if os.path.exists(fpath):
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        content = f.read()
                    self._set_headers(HTTPStatus.OK, "text/plain; charset=utf-8")
                    self.wfile.write(content.encode("utf-8"))
                except Exception as e:
                    self._set_headers(HTTPStatus.INTERNAL_SERVER_ERROR)
                    self.wfile.write(f"讀取範例失敗: {str(e)}".encode("utf-8"))
            else:
                self._set_headers(HTTPStatus.NOT_FOUND, "text/plain; charset=utf-8")
                self.wfile.write("找不到範例檔案".encode("utf-8"))
            return

        # API: 存檔
        if path == "/api/save-game":
            fpath = os.path.join(DATA_DIR, "saves.json")
            if os.path.exists(fpath):
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self._set_headers(HTTPStatus.OK)
                    self.wfile.write(json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8"))
                except Exception as e:
                    self._set_headers(HTTPStatus.INTERNAL_SERVER_ERROR)
                    self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            else:
                self._set_headers(HTTPStatus.OK)
                self.wfile.write(json.dumps({}).encode("utf-8"))
            return

        # API: 題庫組列表
        if path == "/api/question-banks":
            fpath = os.path.join(DATA_DIR, "question_banks.json")
            if os.path.exists(fpath):
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self._set_headers(HTTPStatus.OK)
                    self.wfile.write(json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8"))
                except Exception as e:
                    self._set_headers(HTTPStatus.INTERNAL_SERVER_ERROR)
                    self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            else:
                self._set_headers(HTTPStatus.OK)
                self.wfile.write(json.dumps([]).encode("utf-8"))
            return

        # API: 主題測驗列表
        if path == "/api/exams":
            fpath = os.path.join(DATA_DIR, "exams.json")
            if os.path.exists(fpath):
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self._set_headers(HTTPStatus.OK)
                    self.wfile.write(json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8"))
                except Exception as e:
                    self._set_headers(HTTPStatus.INTERNAL_SERVER_ERROR)
                    self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            else:
                self._set_headers(HTTPStatus.OK)
                self.wfile.write(json.dumps([]).encode("utf-8"))
            return

        # API: 學生作答紀錄
        if path == "/api/student-records":
            fpath = os.path.join(DATA_DIR, "student_records.json")
            if os.path.exists(fpath):
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self._set_headers(HTTPStatus.OK)
                    self.wfile.write(json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8"))
                except Exception as e:
                    self._set_headers(HTTPStatus.INTERNAL_SERVER_ERROR)
                    self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            else:
                self._set_headers(HTTPStatus.OK)
                self.wfile.write(json.dumps([]).encode("utf-8"))
            return

        # API: 本地檔案儲存資訊說明 (Storage Info)
        if path == "/api/storage-info":
            storage_files = [
                {
                    "filename": "student_records.json",
                    "relativePath": "Game-data/student_records.json",
                    "title": "學生作答歷程與錯題明細",
                    "description": "記錄所有學生姓名、所選主題測驗、總分、答對率、闖關章節、每題作答詳情（所選選項、正解與時間戳記）。",
                    "category": "學生數據",
                    "format": "JSON Array (物件陣列)"
                },
                {
                    "filename": "question_banks.json",
                    "relativePath": "Game-data/question_banks.json",
                    "title": "多組主題題庫與自訂題目",
                    "description": "存放教師建立或匯入的多組分類題庫（題目內容、四個選項、正確答案索引、詳解說明與啟用狀態）。",
                    "category": "題庫設定",
                    "format": "JSON Array (題庫組物件陣列)"
                },
                {
                    "filename": "exams.json",
                    "relativePath": "Game-data/exams.json",
                    "title": "派送主題測驗發布設定",
                    "description": "存放教師派送建立的主題測驗（名稱、分類、任務說明、關聯題庫組別清單與派送啟用狀態）。",
                    "category": "測驗派送",
                    "format": "JSON Array (測驗設定陣列)"
                },
                {
                    "filename": "questions.json",
                    "relativePath": "Game-data/questions.json",
                    "title": "基礎單一題庫 (舊版相容)",
                    "description": "系統預設或舊版相容的單一題庫題目資料檔案。",
                    "category": "題庫設定",
                    "format": "JSON Array (題目陣列)"
                },
                {
                    "filename": "config.json",
                    "relativePath": "Game-data/config.json",
                    "title": "遊戲全域系統與管理者設定",
                    "description": "存放後台管理密碼（預設 admin）、音效預設開關、章節題目配比等全域參數。",
                    "category": "系統配置",
                    "format": "JSON Object (鍵值配置)"
                },
                {
                    "filename": "saves.json",
                    "relativePath": "Game-data/saves.json",
                    "title": "玩家角色與闖關進度存檔",
                    "description": "記錄本機玩家的關卡解鎖進度、金幣、體力、等級與當前選定勇者。",
                    "category": "遊戲存檔",
                    "format": "JSON Object (玩家進度)"
                },
                {
                    "filename": "sample_import.csv",
                    "relativePath": "Game-data/sample_import.csv",
                    "title": "示範題庫 CSV 匯入樣版",
                    "description": "提供教師出題參考與一鍵測試匯入的標準 CSV 格式檔案（題目,答案編號,選項1~4）。",
                    "category": "範例資料",
                    "format": "CSV 純文字"
                }
            ]

            result = []
            for item in storage_files:
                fpath = os.path.join(DATA_DIR, item["filename"])
                exists = os.path.exists(fpath)
                size_bytes = os.path.getsize(fpath) if exists else 0
                mtime = os.path.getmtime(fpath) if exists else None
                record_count = None

                if exists and item["filename"].endswith(".json"):
                    try:
                        with open(fpath, "r", encoding="utf-8") as f:
                            jdata = json.load(f)
                            if isinstance(jdata, list):
                                record_count = len(jdata)
                            elif isinstance(jdata, dict):
                                record_count = len(jdata.keys())
                    except Exception:
                        pass

                result.append({
                    **item,
                    "exists": exists,
                    "sizeBytes": size_bytes,
                    "sizeFormatted": f"{size_bytes / 1024:.2f} KB" if size_bytes >= 1024 else f"{size_bytes} B",
                    "lastModified": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(mtime)) if mtime else "尚無檔案",
                    "recordCount": record_count
                })

            self._set_headers(HTTPStatus.OK)
            self.wfile.write(json.dumps({
                "dataDir": DATA_DIR,
                "files": result
            }, ensure_ascii=False, indent=2).encode("utf-8"))
            return

        # API: 查詢系統所有 20 張核心圖片之自訂狀態與預覽路徑
        if path == "/api/images-status":
            try:
                config_file = os.path.join(DATA_DIR, "config.json")
                cfg = {}
                if os.path.exists(config_file):
                    try:
                        cfg = load_json_permissive(config_file)
                    except Exception:
                        cfg = {}

                custom_images = cfg.get("customImages", {}) if isinstance(cfg, dict) else {}

                images_list = []
                for meta in GAME_IMAGES_META:
                    fname = meta["filename"]
                    custom_path = os.path.join(CUSTOM_IMG_DIR, fname)
                    is_custom = os.path.exists(custom_path)

                    if is_custom:
                        mtime = os.path.getmtime(custom_path)
                        size_bytes = os.path.getsize(custom_path)
                        current_url = f"assets/images/custom/{fname}?t={int(mtime)}"
                        time_str = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(mtime))
                    else:
                        default_sys_path = os.path.join(BASE_DIR, meta["defaultPath"])
                        mtime = os.path.getmtime(default_sys_path) if os.path.exists(default_sys_path) else None
                        size_bytes = os.path.getsize(default_sys_path) if os.path.exists(default_sys_path) else 0
                        current_url = meta["defaultPath"]
                        time_str = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(mtime)) if mtime else "預設資源"

                    images_list.append({
                        **meta,
                        "isCustom": is_custom,
                        "currentUrl": current_url,
                        "sizeBytes": size_bytes,
                        "sizeFormatted": f"{size_bytes / 1024:.1f} KB" if size_bytes >= 1024 else f"{size_bytes} B",
                        "lastModified": time_str
                    })

                self._set_headers(HTTPStatus.OK)
                self.wfile.write(json.dumps({
                    "success": True,
                    "total": len(images_list),
                    "customCount": sum(1 for img in images_list if img["isCustom"]),
                    "images": images_list
                }, ensure_ascii=False, indent=2).encode("utf-8"))
            except Exception as e:
                self._set_headers(HTTPStatus.INTERNAL_SERVER_ERROR)
                self.wfile.write(json.dumps({"success": False, "error": f"取得圖片狀態失敗: {str(e)}"}).encode("utf-8"))
            return

        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        content_length = int(self.headers.get("Content-Length", 0))
        post_body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"

        # API: 單張自訂圖片上傳取代
        if path == "/api/upload-image":
            try:
                data = json.loads(post_body)
                raw_filename = data.get("filename", "").strip()
                base64_data = data.get("data", "").strip()

                lower_fname = raw_filename.lower()
                if lower_fname not in VALID_FILENAMES:
                    self._set_headers(HTTPStatus.BAD_REQUEST)
                    self.wfile.write(json.dumps({
                        "success": False,
                        "error": f"不支援的圖片檔名: {raw_filename}。僅支援 20 張系統核心圖片！"
                    }).encode("utf-8"))
                    return

                matched_filename = VALID_FILENAMES[lower_fname]

                if "," in base64_data:
                    base64_data = base64_data.split(",", 1)[1]

                img_bytes = base64.b64decode(base64_data)
                os.makedirs(CUSTOM_IMG_DIR, exist_ok=True)
                target_path = os.path.join(CUSTOM_IMG_DIR, matched_filename)
                os.makedirs(os.path.dirname(target_path), exist_ok=True)

                with open(target_path, "wb") as f:
                    f.write(img_bytes)

                # 同步更新 config.json
                config_file = os.path.join(DATA_DIR, "config.json")
                cfg = {}
                if os.path.exists(config_file):
                    try:
                        cfg = load_json_permissive(config_file)
                    except Exception:
                        cfg = {}

                if not isinstance(cfg, dict):
                    cfg = {}
                if "customImages" not in cfg or not isinstance(cfg["customImages"], dict):
                    cfg["customImages"] = {}

                timestamp = int(time.time())
                custom_url = f"assets/images/custom/{matched_filename}?t={timestamp}"
                cfg["customImages"][matched_filename] = custom_url

                with open(config_file, "w", encoding="utf-8") as f:
                    json.dump(cfg, f, ensure_ascii=False, indent=2)

                self._set_headers(HTTPStatus.OK)
                self.wfile.write(json.dumps({
                    "success": True,
                    "filename": matched_filename,
                    "url": custom_url,
                    "sizeBytes": len(img_bytes),
                    "message": f"成功上傳並替換【{matched_filename}】！"
                }, ensure_ascii=False).encode("utf-8"))
            except Exception as e:
                self._set_headers(HTTPStatus.INTERNAL_SERVER_ERROR)
                self.wfile.write(json.dumps({"success": False, "error": f"圖片上傳失敗: {str(e)}"}).encode("utf-8"))
            return

        # API: ZIP 壓縮檔批次上傳所有圖片 (按檔名比對，只處理符合檔名的圖片)
        if path == "/api/upload-zip-images":
            try:
                data = json.loads(post_body)
                base64_zip = data.get("zipData", "").strip()
                if not base64_zip:
                    self._set_headers(HTTPStatus.BAD_REQUEST)
                    self.wfile.write(json.dumps({"success": False, "error": "請提供有效的 ZIP 壓縮檔內容"}).encode("utf-8"))
                    return

                if "," in base64_zip:
                    base64_zip = base64_zip.split(",", 1)[1]

                zip_bytes = base64.b64decode(base64_zip)
                zip_file = zipfile.ZipFile(io.BytesIO(zip_bytes))

                updated_files = []
                skipped_files = []
                timestamp = int(time.time())

                config_file = os.path.join(DATA_DIR, "config.json")
                cfg = {}
                if os.path.exists(config_file):
                    try:
                        cfg = load_json_permissive(config_file)
                    except Exception:
                        cfg = {}
                if not isinstance(cfg, dict):
                    cfg = {}
                if "customImages" not in cfg or not isinstance(cfg["customImages"], dict):
                    cfg["customImages"] = {}

                for zinfo in zip_file.infolist():
                    if zinfo.is_dir():
                        continue
                    fname = os.path.basename(zinfo.filename)
                    if not fname or fname.startswith(".") or fname.startswith("__MACOSX"):
                        continue

                    lower_name = fname.lower()
                    if lower_name in VALID_FILENAMES:
                        matched = VALID_FILENAMES[lower_name]
                        extracted_bytes = zip_file.read(zinfo)
                        os.makedirs(CUSTOM_IMG_DIR, exist_ok=True)
                        target_path = os.path.join(CUSTOM_IMG_DIR, matched)
                        os.makedirs(os.path.dirname(target_path), exist_ok=True)
                        with open(target_path, "wb") as f:
                            f.write(extracted_bytes)

                        custom_url = f"assets/images/custom/{matched}?t={timestamp}"
                        cfg["customImages"][matched] = custom_url
                        updated_files.append({
                            "filename": matched,
                            "url": custom_url,
                            "sizeBytes": len(extracted_bytes)
                        })
                    else:
                        skipped_files.append(fname)

                if updated_files:
                    with open(config_file, "w", encoding="utf-8") as f:
                        json.dump(cfg, f, ensure_ascii=False, indent=2)

                self._set_headers(HTTPStatus.OK)
                self.wfile.write(json.dumps({
                    "success": True,
                    "updatedCount": len(updated_files),
                    "updatedFiles": updated_files,
                    "skippedCount": len(skipped_files),
                    "skippedFiles": skipped_files,
                    "message": f"壓縮檔批次處理完成：成功替換 {len(updated_files)} 張符合檔名的圖片！" +
                               (f"（略過 {len(skipped_files)} 個非系統圖片）" if skipped_files else "")
                }, ensure_ascii=False).encode("utf-8"))
            except Exception as e:
                self._set_headers(HTTPStatus.INTERNAL_SERVER_ERROR)
                self.wfile.write(json.dumps({"success": False, "error": f"解壓縮與批次處理失敗: {str(e)}"}).encode("utf-8"))
            return

        # API: 單張或全部圖片改回預設圖片
        if path == "/api/reset-image":
            try:
                data = json.loads(post_body)
                raw_filename = data.get("filename", "").strip()
                reset_all = data.get("all", False)

                config_file = os.path.join(DATA_DIR, "config.json")
                cfg = {}
                if os.path.exists(config_file):
                    try:
                        cfg = load_json_permissive(config_file)
                    except Exception:
                        cfg = {}
                if not isinstance(cfg, dict):
                    cfg = {}
                if "customImages" not in cfg or not isinstance(cfg["customImages"], dict):
                    cfg["customImages"] = {}

                if reset_all:
                    if os.path.exists(CUSTOM_IMG_DIR):
                        for f in os.listdir(CUSTOM_IMG_DIR):
                            fpath = os.path.join(CUSTOM_IMG_DIR, f)
                            if os.path.isfile(fpath):
                                try:
                                    os.remove(fpath)
                                except Exception:
                                    pass
                    cfg["customImages"] = {}
                    with open(config_file, "w", encoding="utf-8") as f:
                        json.dump(cfg, f, ensure_ascii=False, indent=2)

                    self._set_headers(HTTPStatus.OK)
                    self.wfile.write(json.dumps({
                        "success": True,
                        "message": "已成功將系統所有圖片恢復為原始預設圖片！"
                    }, ensure_ascii=False).encode("utf-8"))
                    return

                lower_fname = raw_filename.lower()
                if lower_fname not in VALID_FILENAMES:
                    self._set_headers(HTTPStatus.BAD_REQUEST)
                    self.wfile.write(json.dumps({"success": False, "error": f"未知的圖片檔名: {raw_filename}"}).encode("utf-8"))
                    return

                matched = VALID_FILENAMES[lower_fname]
                custom_path = os.path.join(CUSTOM_IMG_DIR, matched)
                if os.path.exists(custom_path):
                    try:
                        os.remove(custom_path)
                    except Exception:
                        pass

                if matched in cfg["customImages"]:
                    del cfg["customImages"][matched]
                    with open(config_file, "w", encoding="utf-8") as f:
                        json.dump(cfg, f, ensure_ascii=False, indent=2)

                self._set_headers(HTTPStatus.OK)
                self.wfile.write(json.dumps({
                    "success": True,
                    "filename": matched,
                    "message": f"已成功將【{matched}】改回官方預設圖片！"
                }, ensure_ascii=False).encode("utf-8"))
            except Exception as e:
                self._set_headers(HTTPStatus.INTERNAL_SERVER_ERROR)
                self.wfile.write(json.dumps({"success": False, "error": f"還原預設失敗: {str(e)}"}).encode("utf-8"))
            return

        # API: 儲存多組題庫列表
        if path == "/api/question-banks":
            try:
                data = json.loads(post_body)
                with open(os.path.join(DATA_DIR, "question_banks.json"), "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self._set_headers(HTTPStatus.OK)
                self.wfile.write(json.dumps({"success": True, "count": len(data)}).encode("utf-8"))
            except Exception as e:
                self._set_headers(HTTPStatus.BAD_REQUEST)
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
            return

        # API: 儲存主題測驗
        if path == "/api/exams":
            try:
                data = json.loads(post_body)
                with open(os.path.join(DATA_DIR, "exams.json"), "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self._set_headers(HTTPStatus.OK)
                self.wfile.write(json.dumps({"success": True, "count": len(data)}).encode("utf-8"))
            except Exception as e:
                self._set_headers(HTTPStatus.BAD_REQUEST)
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
            return

        # API: 追加學生作答紀錄
        if path == "/api/student-records":
            try:
                new_data = json.loads(post_body)
                rfile = os.path.join(DATA_DIR, "student_records.json")
                existing = []
                if os.path.exists(rfile):
                    try:
                        with open(rfile, "r", encoding="utf-8") as f:
                            existing = json.load(f)
                            if not isinstance(existing, list):
                                existing = []
                    except Exception:
                        existing = []
                if isinstance(new_data, list):
                    existing.extend(new_data)
                elif isinstance(new_data, dict):
                    existing.append(new_data)

                with open(rfile, "w", encoding="utf-8") as f:
                    json.dump(existing, f, ensure_ascii=False, indent=2)

                self._set_headers(HTTPStatus.OK)
                self.wfile.write(json.dumps({"success": True, "count": len(existing)}).encode("utf-8"))
            except Exception as e:
                self._set_headers(HTTPStatus.BAD_REQUEST)
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
            return

        # API: 儲存或更新遊戲設定與勇者/關主數值
        if path == "/api/config":
            try:
                data = json.loads(post_body)
                with open(os.path.join(DATA_DIR, "config.json"), "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self._set_headers(HTTPStatus.OK)
                self.wfile.write(json.dumps({"success": True, "message": "遊戲設定已成功儲存至 Game-data/config.json"}).encode("utf-8"))
            except Exception as e:
                self._set_headers(HTTPStatus.BAD_REQUEST)
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
            return

        # API: 刪除學生作答紀錄 (POST 備用)
        if path == "/api/student-records/delete":
            try:
                data = json.loads(post_body) if post_body else {}
                record_id = data.get("id")
                exam_id = data.get("examId")
                delete_all = data.get("all", False)

                rfile = os.path.join(DATA_DIR, "student_records.json")
                records = []
                if os.path.exists(rfile):
                    try:
                        with open(rfile, "r", encoding="utf-8") as f:
                            records = json.load(f)
                            if not isinstance(records, list):
                                records = []
                    except Exception:
                        records = []

                init_len = len(records)
                if delete_all:
                    records = []
                elif record_id:
                    records = [r for r in records if str(r.get("id")) != str(record_id) and str(r.get("completedAt")) != str(record_id)]
                elif exam_id and exam_id != "ALL":
                    records = [r for r in records if r.get("examId") != exam_id]

                with open(rfile, "w", encoding="utf-8") as f:
                    json.dump(records, f, ensure_ascii=False, indent=2)

                self._set_headers(HTTPStatus.OK)
                self.wfile.write(json.dumps({"success": True, "deleted": init_len - len(records), "remaining": len(records)}).encode("utf-8"))
            except Exception as e:
                self._set_headers(HTTPStatus.BAD_REQUEST)
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
            return

        # API: 儲存單一題庫
        if path == "/api/questions":
            try:
                data = json.loads(post_body)
                with open(os.path.join(DATA_DIR, "questions.json"), "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self._set_headers(HTTPStatus.OK)
                self.wfile.write(json.dumps({"success": True, "count": len(data)}).encode("utf-8"))
            except Exception as e:
                self._set_headers(HTTPStatus.BAD_REQUEST)
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
            return

        # API: 遊戲存檔
        if path == "/api/save-game":
            try:
                data = json.loads(post_body)
                with open(os.path.join(DATA_DIR, "saves.json"), "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self._set_headers(HTTPStatus.OK)
                self.wfile.write(json.dumps({"success": True}).encode("utf-8"))
            except Exception as e:
                self._set_headers(HTTPStatus.BAD_REQUEST)
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
            return

        self._set_headers(HTTPStatus.NOT_FOUND)
        self.wfile.write(json.dumps({"error": "找不到此 API 端點"}).encode("utf-8"))

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/api/student-records":
            record_id = query.get("id", [None])[0]
            exam_id = query.get("examId", [None])[0]
            delete_all = query.get("all", ["false"])[0].lower() in ("true", "1")

            rfile = os.path.join(DATA_DIR, "student_records.json")
            records = []
            if os.path.exists(rfile):
                try:
                    with open(rfile, "r", encoding="utf-8") as f:
                        records = json.load(f)
                        if not isinstance(records, list):
                            records = []
                except Exception:
                    records = []

            init_len = len(records)
            if delete_all:
                records = []
            elif record_id:
                records = [r for r in records if str(r.get("id")) != str(record_id) and str(r.get("completedAt")) != str(record_id)]
            elif exam_id and exam_id != "ALL":
                records = [r for r in records if r.get("examId") != exam_id]

            with open(rfile, "w", encoding="utf-8") as f:
                json.dump(records, f, ensure_ascii=False, indent=2)

            self._set_headers(HTTPStatus.OK)
            self.wfile.write(json.dumps({"success": True, "deleted": init_len - len(records), "remaining": len(records)}).encode("utf-8"))
            return

        self._set_headers(HTTPStatus.NOT_FOUND)
        self.wfile.write(json.dumps({"error": "找不到此 API 端點"}).encode("utf-8"))

# ------------------------------------------------------
# 多執行緒 HTTP 伺服器 (支援端口重用與平滑關閉)
# ------------------------------------------------------
class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def server_bind(self):
        try:
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        except Exception:
            pass
        super().server_bind()

class HTTPServerThread(QThread):
    server_started = pyqtSignal(str, str) # lan_url, local_url
    server_error = pyqtSignal(str)

    def __init__(self, port, parent=None):
        super().__init__(parent)
        self.port = port
        self.httpd = None

    def run(self):
        try:
            self.httpd = ThreadedHTTPServer(("", self.port), RPGGameRequestHandler)
        except OSError as e:
            self.server_error.emit(str(e))
            return

        ip = get_local_ip()
        lan_url = f"http://{ip}:{self.port}"
        local_url = f"http://127.0.0.1:{self.port}"
        self.server_started.emit(lan_url, local_url)
        try:
            self.httpd.serve_forever()
        except Exception:
            pass

    def stop(self):
        if self.httpd:
            # 1. 關閉 socket，立即中斷 accept 阻塞並釋放端口
            try:
                if hasattr(self.httpd, "socket") and self.httpd.socket:
                    self.httpd.socket.close()
            except Exception:
                pass

            # 2. 在背景執行緒發送 shutdown 信號，避免阻塞主 GUI 執行緒
            try:
                t = threading.Thread(target=self.httpd.shutdown, daemon=True)
                t.start()
            except Exception:
                pass

            # 3. 確保 server 關閉
            try:
                self.httpd.server_close()
            except Exception:
                pass

# ------------------------------------------------------
# 學生連線 QR Code 彈出對話框
# ------------------------------------------------------
class QRCodeDialog(QDialog):
    def __init__(self, url, parent=None):
        super().__init__(parent)
        self.url = url
        self.pixmap = None
        self.setWindowTitle("📱 學生掃描 QR Code 連線")
        self.setFixedSize(460, 560)
        self.setWindowFlags(self.windowFlags() & ~Qt.WindowContextHelpButtonHint)
        self.initUI()

    def initUI(self):
        self.setStyleSheet("""
            QDialog {
                background: #0F172A;
                font-family: "Segoe UI", "Microsoft JhengHei", sans-serif;
            }
            QLabel#qrTitle {
                color: #F8FAFC;
                font-size: 18px;
                font-weight: bold;
            }
            QLabel#qrSubtitle {
                color: #94A3B8;
                font-size: 13px;
            }
            QLabel#qrImageLabel {
                background: #FFFFFF;
                border: 3px solid #38BDF8;
                border-radius: 16px;
                padding: 12px;
            }
            QLabel#urlDisplay {
                color: #38BDF8;
                font-size: 15px;
                font-weight: bold;
                background: rgba(56, 189, 248, 0.12);
                border: 1px solid rgba(56, 189, 248, 0.3);
                border-radius: 8px;
                padding: 6px 12px;
            }
            QPushButton#btnCopy {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #0284C7, stop:1 #38BDF8);
                color: white;
                font-weight: bold;
                font-size: 13px;
                border: none;
                border-radius: 8px;
                padding: 8px 16px;
            }
            QPushButton#btnCopy:hover {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #0369A1, stop:1 #0284C7);
            }
            QPushButton#btnSave {
                background: rgba(255, 255, 255, 0.12);
                color: #F1F5F9;
                font-weight: 500;
                font-size: 13px;
                border: 1px solid rgba(255, 255, 255, 0.25);
                border-radius: 8px;
                padding: 8px 16px;
            }
            QPushButton#btnSave:hover {
                background: rgba(255, 255, 255, 0.22);
            }
            QPushButton#btnClose {
                background: rgba(255, 255, 255, 0.08);
                color: #94A3B8;
                font-size: 13px;
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 8px;
                padding: 8px 16px;
            }
            QPushButton#btnClose:hover {
                background: rgba(255, 255, 255, 0.15);
                color: white;
            }
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(28, 24, 28, 24)
        layout.setSpacing(14)
        layout.setAlignment(Qt.AlignCenter)

        titleLabel = QLabel("📱 學生掃描 QR Code 連線")
        titleLabel.setObjectName("qrTitle")
        titleLabel.setAlignment(Qt.AlignCenter)
        layout.addWidget(titleLabel)

        subLabel = QLabel("請學生開啟平板或手機相機，掃描下方 QR Code 即可連入遊戲闖關：")
        subLabel.setObjectName("qrSubtitle")
        subLabel.setAlignment(Qt.AlignCenter)
        subLabel.setWordWrap(True)
        layout.addWidget(subLabel)

        self.qrLabel = QLabel()
        self.qrLabel.setObjectName("qrImageLabel")
        self.qrLabel.setAlignment(Qt.AlignCenter)
        self.qrLabel.setFixedSize(290, 290)
        self.generateQRCode()
        layout.addWidget(self.qrLabel, 0, Qt.AlignCenter)

        self.urlLabel = QLabel(self.url)
        self.urlLabel.setObjectName("urlDisplay")
        self.urlLabel.setAlignment(Qt.AlignCenter)
        self.urlLabel.setCursor(QCursor(Qt.PointingHandCursor))
        self.urlLabel.setToolTip("點擊複製網址")
        self.urlLabel.mousePressEvent = self.copyUrl
        layout.addWidget(self.urlLabel)

        btnLayout = QHBoxLayout()
        btnLayout.setSpacing(10)

        copyBtn = QPushButton("📋 複製網址")
        copyBtn.setObjectName("btnCopy")
        copyBtn.setCursor(QCursor(Qt.PointingHandCursor))
        copyBtn.clicked.connect(self.copyUrl)
        btnLayout.addWidget(copyBtn)

        saveBtn = QPushButton("💾 儲存圖片")
        saveBtn.setObjectName("btnSave")
        saveBtn.setCursor(QCursor(Qt.PointingHandCursor))
        saveBtn.clicked.connect(self.saveQRImage)
        btnLayout.addWidget(saveBtn)

        closeBtn = QPushButton("✕ 關閉")
        closeBtn.setObjectName("btnClose")
        closeBtn.setCursor(QCursor(Qt.PointingHandCursor))
        closeBtn.clicked.connect(self.accept)
        btnLayout.addWidget(closeBtn)

        layout.addLayout(btnLayout)

    def generateQRCode(self):
        try:
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_M,
                box_size=10,
                border=2,
            )
            qr.add_data(self.url)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")

            buffer = io.BytesIO()
            img.save(buffer, format="PNG")

            qimg = QImage()
            qimg.loadFromData(buffer.getvalue())
            self.pixmap = QPixmap.fromImage(qimg).scaled(260, 260, Qt.KeepAspectRatio, Qt.SmoothTransformation)
            self.qrLabel.setPixmap(self.pixmap)
        except Exception as e:
            self.qrLabel.setText(f"QR Code 生成失敗\n{e}")

    def copyUrl(self, event=None):
        QApplication.clipboard().setText(self.url)
        show_app_tooltip("✅ 網址已複製到剪貼簿！", self, 1500)

    def saveQRImage(self):
        if not self.pixmap:
            return
        filePath, _ = QFileDialog.getSaveFileName(
            self, "儲存 QR Code 圖片", "butterfly_game_qrcode.png", "PNG 圖片 (*.png);;所有檔案 (*.*)"
        )
        if filePath:
            try:
                self.pixmap.save(filePath, "PNG")
                QMessageBox.information(self, "儲存成功", f"🎉 QR Code 已成功儲存至：\n{filePath}")
            except Exception as e:
                QMessageBox.critical(self, "儲存失敗", f"儲存時發生錯誤：\n{e}")

# ------------------------------------------------------
# 主視窗 (MainWindow)
# ------------------------------------------------------
class MainWindow(QMainWindow):
    def __init__(self, server_thread, port):
        super().__init__()
        self.server_thread = None
        self.port = port
        self.current_lan_url = f"http://127.0.0.1:{port}"
        self.current_local_url = f"http://127.0.0.1:{port}"

        self.setWindowTitle("紫斑之翼：奇幻大遷徙 - 本機與區網互動教學工具箱")
        self.resize(1200, 800)

        icon_path = ensure_app_icon()
        if os.path.exists(icon_path):
            self.setWindowIcon(QIcon(icon_path))

        self.initUI()
        self._wireServerThread(server_thread)

    def _wireServerThread(self, server_thread):
        self.server_thread = server_thread
        self.server_thread.server_started.connect(self.onServerStarted)
        self.server_thread.server_error.connect(self.onServerError)

    def onServerStarted(self, lan_url, local_url):
        self.current_lan_url = lan_url
        self.current_local_url = local_url
        self.urlTextLabel.setText(lan_url)
        self.statusBadge.setText("🟢 區網伺服器運行中")
        self.statusBadge.setStyleSheet("")
        self.restartBtn.setEnabled(True)
        self.restartBtn.setText("⚡ 重啟伺服器")
        self.webview.load(QUrl(local_url))
        show_app_tooltip(f"✅ 伺服器已成功運行於 Port {self.port}！", self, 2000)

    def onServerError(self, message):
        self.statusBadge.setText("🔴 伺服器啟動失敗")
        self.statusBadge.setStyleSheet("color: #F87171; background: rgba(248, 113, 113, 0.15); border: 1px solid rgba(248, 113, 113, 0.3);")
        self.restartBtn.setEnabled(True)
        self.restartBtn.setText("⚡ 重試重啟")
        QMessageBox.critical(
            self, "伺服器啟動失敗",
            f"無法在 Port {self.port} 啟動伺服器：\n{message}\n\n"
            "這通常表示該連接埠已被其他程式佔用。\n"
            "請從「Port 下拉選單」選擇其他常用的連接埠（例如 8000、8888、5000、3000）後，\n"
            "再點擊「⚡ 重啟伺服器」即可！"
        )

    def initUI(self):
        centralWidget = QWidget()
        centralWidget.setObjectName("centralWidget")
        mainLayout = QVBoxLayout(centralWidget)
        mainLayout.setContentsMargins(0, 0, 0, 0)
        mainLayout.setSpacing(0)

        # 頂部控制列 (48px)
        topBar = QFrame()
        topBar.setObjectName("topBar")
        topBar.setFixedHeight(48)
        topBarLayout = QHBoxLayout(topBar)
        topBarLayout.setContentsMargins(14, 6, 14, 6)
        topBarLayout.setSpacing(10)

        self.statusBadge = QLabel("🟢 區網伺服器運行中")
        self.statusBadge.setObjectName("statusBadge")
        self.statusBadge.setFixedHeight(28)
        topBarLayout.addWidget(self.statusBadge)

        sep1 = QFrame()
        sep1.setFrameShape(QFrame.VLine)
        sep1.setObjectName("separator")
        sep1.setFixedHeight(20)
        topBarLayout.addWidget(sep1)

        self.urlTitleLabel = QLabel("學生連線網址：")
        self.urlTitleLabel.setObjectName("urlTitleLabel")
        self.urlTitleLabel.setFixedHeight(28)
        topBarLayout.addWidget(self.urlTitleLabel)

        self.urlTextLabel = QLabel(self.current_lan_url)
        self.urlTextLabel.setObjectName("urlTextLabel")
        self.urlTextLabel.setFixedHeight(28)
        self.urlTextLabel.setCursor(QCursor(Qt.PointingHandCursor))
        self.urlTextLabel.setToolTip("點擊複製網址")
        self.urlTextLabel.mousePressEvent = self.copyUrlToClipboard
        topBarLayout.addWidget(self.urlTextLabel)

        self.copyBtn = QPushButton("📋 複製")
        self.copyBtn.setObjectName("actionBtn")
        self.copyBtn.setFixedHeight(28)
        self.copyBtn.setToolTip("複製連線網址給學生")
        self.copyBtn.clicked.connect(self.copyUrlToClipboard)
        topBarLayout.addWidget(self.copyBtn)

        self.qrCodeBtn = QPushButton("📱 QR Code")
        self.qrCodeBtn.setObjectName("actionBtn")
        self.qrCodeBtn.setFixedHeight(28)
        self.qrCodeBtn.setToolTip("開啟大尺寸 QR Code 供學生平板/手機掃描連線")
        self.qrCodeBtn.clicked.connect(self.showQRCodeDialog)
        topBarLayout.addWidget(self.qrCodeBtn)

        self.openBrowserBtn = QPushButton("🌐 瀏覽器開啟")
        self.openBrowserBtn.setObjectName("actionBtn")
        self.openBrowserBtn.setFixedHeight(28)
        self.openBrowserBtn.setToolTip("在預設瀏覽器中開啟遊戲")
        self.openBrowserBtn.clicked.connect(self.openInExternalBrowser)
        topBarLayout.addWidget(self.openBrowserBtn)

        self.refreshBtn = QPushButton("🔄 重新整理")
        self.refreshBtn.setObjectName("actionBtn")
        self.refreshBtn.setFixedHeight(28)
        self.refreshBtn.setToolTip("重新載入內嵌遊戲畫面")
        self.refreshBtn.clicked.connect(self.refreshWebView)
        topBarLayout.addWidget(self.refreshBtn)

        sep2 = QFrame()
        sep2.setFrameShape(QFrame.VLine)
        sep2.setObjectName("separator")
        sep2.setFixedHeight(20)
        topBarLayout.addWidget(sep2)

        portLabel = QLabel("Port：")
        portLabel.setObjectName("portLabel")
        portLabel.setFixedHeight(28)
        topBarLayout.addWidget(portLabel)

        # 預選 Port 下拉選單 (僅限預選連接埠供使用者選用)
        self.portComboBox = QComboBox()
        self.portComboBox.setObjectName("portComboBox")
        self.portComboBox.setFixedHeight(28)
        self.portComboBox.setFixedWidth(135)
        self.portComboBox.setEditable(False)
        self.portComboBox.setToolTip("請由預選清單中選擇要運行的連接埠 (Port)")

        # 預選連接埠清單
        self.preset_ports = [
            ("8080 (預設)", 8080),
            ("8000", 8000),
            ("8888", 8888),
            ("5000", 5000),
            ("3000", 3000),
            ("8088", 8088),
        ]

        # 若外部傳入的 port 不在預選中，動態加入以利顯示
        existing_ports = [p for _, p in self.preset_ports]
        if self.port not in existing_ports:
            self.preset_ports.insert(0, (f"{self.port}", self.port))

        selected_idx = 0
        for idx, (label, p) in enumerate(self.preset_ports):
            self.portComboBox.addItem(label, p)
            if p == self.port:
                selected_idx = idx

        self.portComboBox.setCurrentIndex(selected_idx)
        topBarLayout.addWidget(self.portComboBox)

        self.restartBtn = QPushButton("⚡ 重啟伺服器")
        self.restartBtn.setObjectName("restartBtn")
        self.restartBtn.setFixedHeight(28)
        self.restartBtn.setToolTip("切換 Port 後點擊重新啟動伺服器")
        self.restartBtn.clicked.connect(self.restartServer)
        topBarLayout.addWidget(self.restartBtn)

        topBarLayout.addStretch()

        # 右側作者與 CC 授權
        self.authorLabel = QLabel(
            '<span style="color:#CBD5E1; font-size:12px;">Made by </span>'
            '<a href="https://kentxchang.blogspot.tw" style="color:#A78BFA; text-decoration:none; font-weight:bold; font-size:12px;">阿剛老師</a>'
            '<span style="color:#94A3B8; font-size:11px;"> ｜ CC BY-NC-SA 4.0 授權</span>'
        )
        self.authorLabel.setObjectName("authorLabel")
        self.authorLabel.setTextFormat(Qt.RichText)
        self.authorLabel.setTextInteractionFlags(Qt.TextBrowserInteraction)
        self.authorLabel.setOpenExternalLinks(True)
        self.authorLabel.setFixedHeight(28)
        topBarLayout.addWidget(self.authorLabel)

        mainLayout.addWidget(topBar, 0)

        # 內嵌 QWebEngineView
        self.webview = QWebEngineView()
        self.webview.setObjectName("webview")
        self.webview.setHtml(
            "<html><body style='display:flex;align-items:center;justify-content:center;"
            "height:100vh;margin:0;font-family:Segoe UI,Microsoft JhengHei,sans-serif;"
            "background:#0F172A;color:#94A3B8;'>"
            "<div>🦋 紫斑之翼 RPG 伺服器啟動中，請稍候...</div></body></html>"
        )
        mainLayout.addWidget(self.webview, 1)

        self.setCentralWidget(centralWidget)
        self.applyModernStyle()

    def applyModernStyle(self):
        qss = """
        QWidget#centralWidget {
            background-color: #0F172A;
            font-family: "Segoe UI", "Microsoft JhengHei", "PingFang TC", sans-serif;
        }

        QFrame#topBar {
            background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #1E293B, stop:1 #334155);
            border-bottom: 2px solid #475569;
        }

        QLabel#statusBadge {
            color: #4ADE80;
            font-weight: bold;
            font-size: 13px;
            background: rgba(74, 222, 128, 0.15);
            border: 1px solid rgba(74, 222, 128, 0.3);
            border-radius: 6px;
            padding: 2px 8px;
        }

        QFrame#separator {
            color: #475569;
            background: #475569;
            width: 1px;
        }

        QLabel#urlTitleLabel {
            color: #94A3B8;
            font-size: 13px;
            font-weight: 500;
        }

        QLabel#urlTextLabel {
            color: #38BDF8;
            font-size: 14px;
            font-weight: bold;
            background: rgba(56, 189, 248, 0.12);
            border: 1px solid rgba(56, 189, 248, 0.25);
            border-radius: 6px;
            padding: 2px 8px;
        }
        QLabel#urlTextLabel:hover {
            color: #7DD3FC;
            background: rgba(56, 189, 248, 0.22);
        }

        QPushButton#actionBtn {
            background: rgba(255, 255, 255, 0.1);
            color: #F1F5F9;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            padding: 3px 10px;
            font-size: 13px;
            font-weight: 500;
        }
        QPushButton#actionBtn:hover {
            background: rgba(255, 255, 255, 0.2);
            border-color: rgba(255, 255, 255, 0.4);
        }
        QPushButton#actionBtn:pressed {
            background: rgba(255, 255, 255, 0.05);
        }

        QLabel#portLabel {
            color: #CBD5E1;
            font-size: 13px;
            font-weight: bold;
        }

        QComboBox#portComboBox {
            background: #0F172A;
            color: #38BDF8;
            border: 1.5px solid #475569;
            border-radius: 6px;
            padding: 2px 22px 2px 8px;
            font-size: 12px;
            font-weight: bold;
        }
        QComboBox#portComboBox:hover {
            border-color: #38BDF8;
            background: #1E293B;
        }
        QComboBox#portComboBox::drop-down {
            subcontrol-origin: padding;
            subcontrol-position: top right;
            width: 20px;
            border-left: 1px solid #334155;
            border-top-right-radius: 6px;
            border-bottom-right-radius: 6px;
        }
        QComboBox#portComboBox::down-arrow {
            width: 0;
            height: 0;
            border-left: 4px solid transparent;
            border-right: 4px solid transparent;
            border-top: 5px solid #38BDF8;
            margin: 0 auto;
        }
        QComboBox#portComboBox QAbstractItemView {
            background: #0F172A;
            color: #F1F5F9;
            selection-background-color: #0284C7;
            selection-color: #FFFFFF;
            border: 1.5px solid #38BDF8;
            border-radius: 6px;
            padding: 4px;
            outline: none;
            font-size: 12px;
            font-weight: bold;
        }

        QPushButton#restartBtn {
            background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #0284C7, stop:1 #38BDF8);
            color: #FFFFFF;
            border: none;
            border-radius: 6px;
            padding: 4px 12px;
            font-size: 13px;
            font-weight: bold;
        }
        QPushButton#restartBtn:hover {
            background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #0369A1, stop:1 #0284C7);
        }
        QPushButton#restartBtn:pressed {
            background: #075985;
        }

        QLabel#authorLabel {
            background: rgba(255, 255, 255, 0.06);
            border-radius: 6px;
            padding: 2px 10px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        QToolTip {
            background-color: #1E293B;
            color: #FFFFFF;
            border: 1px solid #475569;
            border-radius: 6px;
            padding: 5px;
            font-size: 12px;
        }
        """
        self.setStyleSheet(qss)

    def copyUrlToClipboard(self, event=None):
        clipboard = QApplication.clipboard()
        clipboard.setText(self.current_lan_url)
        show_app_tooltip("✅ 區網連線網址已複製到剪貼簿！", self, 1500)

    def openInExternalBrowser(self):
        webbrowser.open(self.current_lan_url)

    def showQRCodeDialog(self):
        dialog = QRCodeDialog(self.current_lan_url, self)
        dialog.exec_()

    def refreshWebView(self):
        self.webview.reload()
        show_app_tooltip("🔄 已重新整理畫面", self, 1000)

    def restartServer(self):
        # 1. 取得使用者選擇的預選 Port
        new_port = self.portComboBox.currentData()
        if not new_port:
            raw_text = self.portComboBox.currentText().strip()
            import re
            match = re.search(r'\b\d+\b', raw_text)
            if match:
                new_port = int(match.group(0))
            else:
                new_port = 8080

        if new_port < 1 or new_port > 65535:
            QMessageBox.warning(self, "連接埠錯誤", "請選擇有效的預選 Port！")
            return

        # 2. 介面進入重啟中狀態與防連點保護
        self.restartBtn.setEnabled(False)
        self.restartBtn.setText("⏳ 正在重啟...")
        self.statusBadge.setText("🟡 重啟中...")
        self.statusBadge.setStyleSheet("color: #FBBF24; background: rgba(251, 191, 36, 0.15); border: 1px solid rgba(251, 191, 36, 0.3);")
        QApplication.processEvents()

        # 3. 安全停止舊伺服器執行緒
        if self.server_thread:
            try:
                self.server_thread.server_started.disconnect()
                self.server_thread.server_error.disconnect()
            except Exception:
                pass

            self.server_thread.stop()
            # 最多等待 1.5 秒讓舊執行緒退出
            if not self.server_thread.wait(1500):
                try:
                    self.server_thread.terminate()
                    self.server_thread.wait(500)
                except Exception:
                    pass

        # 短暫休眠確保作業系統完全釋放通訊端
        time.sleep(0.3)

        # 4. 啟動新連接埠的伺服器執行緒
        self.port = new_port
        new_thread = HTTPServerThread(new_port)
        self._wireServerThread(new_thread)
        new_thread.start()

        show_app_tooltip(f"🚀 正在連接埠 {new_port} 重啟伺服器...", self, 2000)

def main():
    port = 8080
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass

    app = QApplication(sys.argv)
    icon_path = ensure_app_icon()
    if os.path.exists(icon_path):
        app.setWindowIcon(QIcon(icon_path))

    server_thread = HTTPServerThread(port)
    window = MainWindow(server_thread, port)
    server_thread.start()
    window.show()

    exit_code = app.exec_()
    server_thread.stop()
    server_thread.wait()
    sys.exit(exit_code)

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        _early_log(f"CRASH: {traceback.format_exc()}")
        try:
            from PyQt5.QtWidgets import QApplication, QMessageBox
            app = QApplication.instance() or QApplication(sys.argv)
            QMessageBox.critical(None, "程式啟動失敗", f"發生嚴重錯誤：\n\n{traceback.format_exc()}")
        except Exception:
            pass

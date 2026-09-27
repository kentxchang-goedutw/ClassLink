/**
 * 《紫斑之翼：奇幻大遷徙》- 題庫、主題測驗與學生作答紀錄管理器
 * 支援多組題庫主題分類、教師派送主題測驗、學生作答歷程紀錄與錯題自動打包
 */

const DataManager = (function () {
  const BANKS_STORAGE_KEY = "rpg_game_question_banks_v3";
  const EXAMS_STORAGE_KEY = "rpg_game_exams_v1";
  const RECORDS_STORAGE_KEY = "rpg_game_student_records_v1";
  const HEROES_STORAGE_KEY = "rpg_game_selected_hero_v1";
  const CONFIG_STORAGE_KEY = "rpg_game_config_v1";
  const CUSTOM_IMAGES_STORAGE_KEY = "rpg_game_custom_images_v1";

  // 本機自訂圖片讀寫輔助
  function getLocalCustomImages() {
    try {
      const raw = localStorage.getItem(CUSTOM_IMAGES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function setLocalCustomImages(map) {
    try {
      localStorage.setItem(CUSTOM_IMAGES_STORAGE_KEY, JSON.stringify(map || {}));
    } catch (e) {}
  }

// 系統內建 20 張核心遊戲圖片清單與鳥山明繁中 AI 生圖 Prompt (支援離線降級)
  const DEFAULT_GAME_IMAGES_META = [
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
];


  // 四大紫斑蝶生態勇者設定
  const HEROES_CONFIG = {
    hero_purple: {
      id: "hero_purple",
      name: "小紫",
      title: "幻紫遊俠",
      butterfly: "小紫斑蝶",
      rhyme: "小紫點一邊",
      element: "風 / 幻光",
      elementColor: "#a29bfe",
      badgeColor: "#6c5ce7",
      typeDesc: "敏捷平衡型 (少年遊俠)",
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
      desc: "熱血敏捷的紫蝶少年遊俠，攻守兼備，擅長乘著春風穿梭林間。",
      skills: [
        { id: "SKILL_CRIT", name: "✨ 幻紫鱗光", desc: "答對造成 2.2 倍暴擊傷害", cost: 15, type: "crit" },
        { id: "SKILL_HEAL", name: "🌿 甘露沐浴", desc: "答對回復 45 HP 並反震", cost: 10, type: "heal" },
        { id: "SKILL_FIFTY", name: "👁️ 複眼透視", desc: "自動排除 2 個錯誤選項", cost: 20, type: "fifty" }
      ],
      attackMoveName: "【極光幻紫斬】"
    },
    hero_round: {
      id: "hero_round",
      name: "阿圓",
      title: "圓翅巨盾戰士",
      butterfly: "圓翅紫斑蝶",
      rhyme: "圓翅兩邊點",
      element: "土 / 磐石",
      elementColor: "#ffeaa7",
      badgeColor: "#d35400",
      typeDesc: "高血高防重裝型 (壯士勇者)",
      hp: 150,
      maxHp: 150,
      mp: 35,
      maxMp: 35,
      atk: 30,
      critRate: 0.10,
      critMultiplier: 1.9,
      damageReduction: 0.20, // 20% 被動傷害減免
      sprite: "assets/images/hero_sprite_round.png",
      avatar: "assets/images/avatar_round.png",
      desc: "魁梧豪邁的黃金重裝壯士，身軀雄健如金剛磐石，能以厚重雙翅抵擋強勁逆風。",
      skills: [
        { id: "SKILL_CRIT", name: "🪨 裂地金剛撞", desc: "答對造成 1.9 倍破防重擊並震懾魔王", cost: 12, type: "crit" },
        { id: "SKILL_HEAL", name: "🛡️ 磐石巨鱗甲", desc: "答對大幅回復 55 HP 並強化防禦", cost: 10, type: "heal" },
        { id: "SKILL_FIFTY", name: "🧱 圓翅壁壘", desc: "排除 2 個干擾選項並獲得護盾", cost: 15, type: "fifty" }
      ],
      attackMoveName: "【裂地重嶽轟】"
    },
    hero_syl: {
      id: "hero_syl",
      name: "阿斯",
      title: "斯氏靈智賢者",
      butterfly: "斯氏紫斑蝶",
      rhyme: "斯氏有三點",
      element: "雷 / 靈智",
      elementColor: "#74b9ff",
      badgeColor: "#0984e3",
      typeDesc: "極限法攻魔導型 (擬人動物)",
      hp: 85,
      maxHp: 85,
      mp: 80,
      maxMp: 80,
      atk: 44,
      critRate: 0.20,
      critMultiplier: 2.5,
      damageReduction: 0.0,
      sprite: "assets/images/hero_sprite_syl.png",
      avatar: "assets/images/avatar_syl.png",
      desc: "通曉自然氣象與星象導航的可愛貓咪魔導士，單片透鏡洞悉萬物，法力充沛威能驚人。",
      skills: [
        { id: "SKILL_CRIT", name: "⚡ 三點天雷破", desc: "答對召喚天雷，造成 2.5 倍極限轟擊", cost: 18, type: "crit" },
        { id: "SKILL_HEAL", name: "💧 朝露靈泉", desc: "答對回復 35 HP 並回充 25 MP", cost: 8, type: "heal" },
        { id: "SKILL_FIFTY", name: "🔮 天眼全知", desc: "以靈智洞察真相，排除 2 個錯誤選項", cost: 20, type: "fifty" }
      ],
      attackMoveName: "【三曜神雷破】"
    },
    hero_mul: {
      id: "hero_mul",
      name: "端端",
      title: "端紫幻影刺客",
      butterfly: "端紫斑蝶",
      rhyme: "端紫亂亂點",
      element: "幽炎 / 暗影",
      elementColor: "#ff7675",
      badgeColor: "#d63031",
      typeDesc: "極限暴擊連擊型 (女刺客)",
      hp: 90,
      maxHp: 90,
      mp: 45,
      maxMp: 45,
      atk: 38,
      critRate: 0.30,
      critMultiplier: 2.6,
      damageReduction: 0.05,
      sprite: "assets/images/hero_sprite_mul.png",
      avatar: "assets/images/avatar_mul.png",
      desc: "身法詭譎俐落的紫髮英氣女刺客，雙手反握羽刃，擅長於千鈞一髮之際發動致命連環刺殺。",
      skills: [
        { id: "SKILL_CRIT", name: "🗡️ 亂點千刃斬", desc: "答對釋放狂暴連刺，造成 2.6 倍致命傷害", cost: 16, type: "crit" },
        { id: "SKILL_HEAL", name: "🔥 紫焰迷蹤", desc: "答對造成烈焰衝擊並回復 40 HP", cost: 12, type: "heal" },
        { id: "SKILL_FIFTY", name: "👤 幻影分身", desc: "暗影殘像迷惑視聽，排除 2 個錯誤選項", cost: 20, type: "fifty" }
      ],
      attackMoveName: "【幽炎亂刃滅】"
    }
  };

  // 依據 config.json 中的 heroes 設定，動態更新四大紫斑蝶勇者與特技數值
  function applyHeroesConfig(customHeroes) {
    if (!customHeroes || typeof customHeroes !== "object") return;
    for (const heroKey of Object.keys(customHeroes)) {
      if (heroKey.startsWith("_")) continue; // 略過說明欄位
      const custom = customHeroes[heroKey];
      const target = HEROES_CONFIG[heroKey];
      if (!custom || !target) continue;

      // 更新基礎屬性與文案
      if (custom.name) target.name = custom.name;
      if (custom.title) target.title = custom.title;
      if (custom.butterfly) target.butterfly = custom.butterfly;
      if (custom.rhyme) target.rhyme = custom.rhyme;
      if (custom.element) target.element = custom.element;
      if (custom.typeDesc) target.typeDesc = custom.typeDesc;
      if (custom.desc) target.desc = custom.desc;
      if (custom.attackMoveName) target.attackMoveName = custom.attackMoveName;

      // 更新數值屬性
      if (custom.hp !== undefined) {
        target.hp = Number(custom.hp);
        target.maxHp = Number(custom.maxHp !== undefined ? custom.maxHp : custom.hp);
      }
      if (custom.mp !== undefined) {
        target.mp = Number(custom.mp);
        target.maxMp = Number(custom.maxMp !== undefined ? custom.maxMp : custom.mp);
      }
      if (custom.atk !== undefined) target.atk = Number(custom.atk);
      if (custom.critRate !== undefined) target.critRate = Number(custom.critRate);
      if (custom.critMultiplier !== undefined) target.critMultiplier = Number(custom.critMultiplier);
      if (custom.damageReduction !== undefined) target.damageReduction = Number(custom.damageReduction);

      // 更新三項特技設定
      if (Array.isArray(custom.skills)) {
        custom.skills.forEach((cSkill, idx) => {
          if (!target.skills[idx]) {
            target.skills[idx] = { ...cSkill };
          } else {
            if (cSkill.id) target.skills[idx].id = cSkill.id;
            if (cSkill.name) target.skills[idx].name = cSkill.name;
            if (cSkill.desc) target.skills[idx].desc = cSkill.desc;
            if (cSkill.type) target.skills[idx].type = cSkill.type;
            if (cSkill.cost !== undefined) target.skills[idx].cost = Number(cSkill.cost);
            if (cSkill.multiplier !== undefined) target.skills[idx].multiplier = Number(cSkill.multiplier);
            if (cSkill.healAmount !== undefined) target.skills[idx].healAmount = Number(cSkill.healAmount);
            if (cSkill.manaRecovery !== undefined) target.skills[idx].manaRecovery = Number(cSkill.manaRecovery);
            if (cSkill.removeCount !== undefined) target.skills[idx].removeCount = Number(cSkill.removeCount);
          }
        });
      }
    }
  }

  // 依據 config.json 或 localStorage 中的 customImages，動態更新四大勇者、關主魔王、關卡背景與全域背景
  function applyCustomImagesConfig(customImages) {
    if (!customImages || typeof customImages !== "object") customImages = {};

    // 融合本地自訂圖
    const localCustom = getLocalCustomImages();
    const merged = { ...localCustom, ...customImages };

    // 1. 更新四大勇者立繪與頭像 (具備雙向智慧回退機制，確保選角、戰鬥與通關全域套用)
    const heroMapping = {
      hero_purple: { sprite: "hero_sprite.png", avatar: "avatar_purple.png" },
      hero_round: { sprite: "hero_sprite_round.png", avatar: "avatar_round.png" },
      hero_syl: { sprite: "hero_sprite_syl.png", avatar: "avatar_syl.png" },
      hero_mul: { sprite: "hero_sprite_mul.png", avatar: "avatar_mul.png" }
    };

    for (const [heroId, maps] of Object.entries(heroMapping)) {
      const hero = HEROES_CONFIG[heroId];
      if (hero) {
        const customSprite = merged[maps.sprite] || null;
        const customAvatar = merged[maps.avatar] || null;

        // 若立繪有自訂則優先使用，若立繪無自訂但頭像有自訂則智慧回退使用自訂頭像
        if (customSprite) {
          hero.sprite = customSprite;
        } else if (customAvatar) {
          hero.sprite = customAvatar;
        } else {
          hero.sprite = `assets/images/${maps.sprite}`;
        }

        // 若頭像有自訂則優先使用，若頭像無自訂但立繪有自訂則智慧回退使用自訂立繪
        if (customAvatar) {
          hero.avatar = customAvatar;
        } else if (customSprite) {
          hero.avatar = customSprite;
        } else {
          hero.avatar = `assets/images/${maps.avatar}`;
        }
      }
    }

    // 2. 更新主畫面背景與大地圖 (若 DOM 已載入)
    const titleBg = merged["title_bg.jpg"];
    const startScreen = document.getElementById("start-screen");
    if (startScreen && titleBg) {
      startScreen.style.backgroundImage = `url('${titleBg}')`;
    }

    const worldMapBg = merged["world_map.jpg"];
    const mapContainer = document.getElementById("worldmap-container");
    if (mapContainer && worldMapBg) {
      mapContainer.style.backgroundImage = `url('${worldMapBg}')`;
    }

    // 3. 更新大地圖玩家頭像 (若正在大地圖中)
    const mapPlayerImg = document.getElementById("map-player-avatar-img");
    if (mapPlayerImg) {
      const curHero = HEROES_CONFIG[currentSelectedHeroId] || HEROES_CONFIG.hero_purple;
      if (curHero && curHero.avatar) {
        mapPlayerImg.src = curHero.avatar;
      }
    }

    // 4. 更新通關動畫區四大紫斑蝶守護勇者之自訂圖像
    updateEndingHeroesAvatars();

    // 5. 若戰鬥系統已初始化，即時刷新戰鬥中出戰主角立繪與頭像
    if (typeof BattleSystem !== "undefined" && BattleSystem.refreshPlayerVisuals) {
      BattleSystem.refreshPlayerVisuals();
    }

    // 6. 即時更新角色整備選取畫面中四大勇者卡片頭像
    for (const [heroId, maps] of Object.entries(heroMapping)) {
      const heroCardImg = document.querySelector(`.hero-card[data-hero-id="${heroId}"] .hero-card-avatar img`);
      if (heroCardImg) {
        const hero = HEROES_CONFIG[heroId];
        if (hero && hero.avatar) {
          heroCardImg.src = hero.avatar;
        }
      }
    }
    if (typeof renderHeroSelectionGrid === "function") {
      renderHeroSelectionGrid();
    }
  }

  // 動態套用四大紫斑蝶守護勇者自訂圖像至通關動畫卡片
  function updateEndingHeroesAvatars() {
    const heroIds = ["hero_purple", "hero_round", "hero_syl", "hero_mul"];
    heroIds.forEach((heroId) => {
      const heroImgEl = document.getElementById(`ending-hero-img-${heroId}`) ||
                        document.querySelector(`.ending-hero-card[data-hero-id="${heroId}"] img`);
      if (heroImgEl) {
        const hero = HEROES_CONFIG[heroId];
        if (hero) {
          const targetSrc = hero.avatar || hero.sprite;
          if (targetSrc) {
            heroImgEl.src = targetSrc;
          }
        }
      }
    });
  }

  // 內部狀態
  let questionBanks = [];
  let exams = [];
  let studentRecords = [];
  let config = null;

  let currentSelectedExamId = null; // 當前學生挑戰的主題測驗 ID
  let currentStudentName = ""; // 當前學生姓名
  let currentSelectedHeroId = "hero_purple"; // 當前選定勇者 ID

  return {
    // 初始化題庫組、主題測驗、學生紀錄與設定
    init: async function () {
      // 1. 載入多組題庫
      try {
        const resp = await fetch("/api/question-banks");
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data) && data.length > 0) {
            questionBanks = data;
            localStorage.setItem(BANKS_STORAGE_KEY, JSON.stringify(questionBanks));
          }
        }
      } catch (err) {
        console.warn("無法連接 /api/question-banks，改由 localStorage 載入:", err);
      }
      if (questionBanks.length === 0) {
        const localBanks = localStorage.getItem(BANKS_STORAGE_KEY);
        if (localBanks) {
          try { questionBanks = JSON.parse(localBanks); } catch (e) {}
        }
      }

      // 2. 載入主題測驗 (Exams)
      try {
        const resp = await fetch("/api/exams");
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data)) {
            exams = data;
            localStorage.setItem(EXAMS_STORAGE_KEY, JSON.stringify(exams));
          }
        }
      } catch (err) {
        console.warn("無法連接 /api/exams，改由 localStorage 載入:", err);
      }
      if (exams.length === 0) {
        const localExams = localStorage.getItem(EXAMS_STORAGE_KEY);
        if (localExams) {
          try { exams = JSON.parse(localExams); } catch (e) {}
        }
      }

      // 3. 載入學生作答紀錄 (Student Records)
      try {
        const resp = await fetch("/api/student-records");
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data)) {
            studentRecords = data;
            localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(studentRecords));
          }
        }
      } catch (err) {
        console.warn("無法連接 /api/student-records，改由 localStorage 載入:", err);
      }
      if (studentRecords.length === 0) {
        const localRecs = localStorage.getItem(RECORDS_STORAGE_KEY);
        if (localRecs) {
          try { studentRecords = JSON.parse(localRecs); } catch (e) {}
        }
      }

      // 4. 載入遊戲設定與勇者數值及自訂圖片
      try {
        const configResp = await fetch("/api/config");
        if (configResp.ok) {
          config = await configResp.json();
          localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
          if (config && config.heroes) {
            applyHeroesConfig(config.heroes);
          }
          if (config && config.customImages) {
            applyCustomImagesConfig(config.customImages);
          }
        }
      } catch (err) {
        console.warn("使用本地/預設遊戲設定");
        const cachedCfg = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (cachedCfg) {
          try {
            config = JSON.parse(cachedCfg);
            if (config && config.heroes) applyHeroesConfig(config.heroes);
            if (config && config.customImages) applyCustomImagesConfig(config.customImages);
          } catch (e) {}
        }
      }

      // 6. 確保本機自訂圖片完全套用
      const localCustomImgs = getLocalCustomImages();
      if (Object.keys(localCustomImgs).length > 0) {
        if (!config) config = {};
        if (!config.customImages) config.customImages = {};
        config.customImages = { ...config.customImages, ...localCustomImgs };
        applyCustomImagesConfig(config.customImages);
      }

      // 5. 載入儲存的勇者選擇
      const savedHero = localStorage.getItem(HEROES_STORAGE_KEY);
      if (savedHero && HEROES_CONFIG[savedHero]) {
        currentSelectedHeroId = savedHero;
      }

      return { questionBanks, exams, studentRecords };
    },

    // --- 題庫管理 ---
    getQuestionBanks: function () {
      return questionBanks;
    },

    // 取得所有題庫現有的主題分類標籤
    getBankCategories: function () {
      const cats = new Set();
      questionBanks.forEach((b) => {
        if (b.category && b.category.trim()) {
          cats.add(b.category.trim());
        }
      });
      return Array.from(cats);
    },

    // 切換指定題庫組的啟用勾選狀態
    toggleBankActive: async function (bankId, isActive) {
      const bank = questionBanks.find((b) => b.id === bankId);
      if (bank) {
        bank.active = isActive;
        await this.saveQuestionBanks(questionBanks);
      }
      return questionBanks;
    },

    // 新增一組題庫（支援指定主題分類）
    addQuestionBank: async function (name, description, questions, category = "綜合生態") {
      const newBank = {
        id: "bank_" + Date.now(),
        name: name.trim() || `自訂題庫 ${questionBanks.length + 1}`,
        description: description || "自訂題庫",
        category: category || "綜合生態",
        active: true,
        createdAt: Date.now(),
        questions: questions
      };
      questionBanks.push(newBank);
      await this.saveQuestionBanks(questionBanks);
      return newBank;
    },

    // 刪除整組題庫
    deleteQuestionBank: async function (bankId) {
      questionBanks = questionBanks.filter((b) => b.id !== bankId);
      await this.saveQuestionBanks(questionBanks);
      return questionBanks;
    },

    // 更新特定題庫內的題目清單
    updateBankQuestions: async function (bankId, questions) {
      const bank = questionBanks.find((b) => b.id === bankId);
      if (!bank) {
        throw new Error("找不到指定的題庫組別！");
      }
      bank.questions = Array.isArray(questions) ? questions : [];
      await this.saveQuestionBanks(questionBanks);
      return bank;
    },

    // 儲存所有題庫組
    saveQuestionBanks: async function (banks) {
      questionBanks = banks;
      localStorage.setItem(BANKS_STORAGE_KEY, JSON.stringify(questionBanks));

      let serverSaved = false;
      let serverMessage = "";

      try {
        const resp = await fetch("/api/question-banks", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify(questionBanks)
        });
        if (resp.ok) {
          const res = await resp.json();
          serverSaved = true;
          serverMessage = res.message;
        }
      } catch (err) {
        serverMessage = "資料已暫存於本地 localStorage";
      }

      return { success: true, serverSaved, message: serverMessage };
    },

    // --- 主題測驗管理 (Exams) ---
    getExams: function () {
      return exams;
    },

    getActiveExams: function () {
      return exams.filter((e) => e.active !== false);
    },

    getExamById: function (examId) {
      return exams.find((e) => e.id === examId) || null;
    },

    // 教師派送建立新主題測驗
    createExam: async function (title, category, description, bankIds) {
      if (!Array.isArray(bankIds) || bankIds.length === 0) {
        throw new Error("派送主題測驗時，必須至少勾選一組題庫！");
      }

      // 計算總題數
      let totalQ = 0;
      questionBanks.forEach((b) => {
        if (bankIds.includes(b.id) && Array.isArray(b.questions)) {
          totalQ += b.questions.length;
        }
      });

      const newExam = {
        id: "exam_" + Date.now(),
        title: title.trim() || `生態主題測驗 ${exams.length + 1}`,
        category: category.trim() || "綜合生態",
        description: description.trim() || `包含 ${bankIds.length} 組題庫，共 ${totalQ} 題`,
        bankIds: bankIds,
        questionCount: totalQ,
        createdAt: Date.now(),
        active: true
      };

      exams.unshift(newExam);
      await this.saveExams(exams);
      return newExam;
    },

    // 開關主題測驗啟用狀態
    toggleExamActive: async function (examId, isActive) {
      const ex = exams.find((e) => e.id === examId);
      if (ex) {
        ex.active = isActive;
        await this.saveExams(exams);
      }
      return exams;
    },

    // 刪除主題測驗
    deleteExam: async function (examId) {
      exams = exams.filter((e) => e.id !== examId);
      await this.saveExams(exams);
      return exams;
    },

    // 儲存主題測驗列表
    saveExams: async function (examsList) {
      exams = examsList;
      localStorage.setItem(EXAMS_STORAGE_KEY, JSON.stringify(exams));

      try {
        await fetch("/api/exams", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify(exams)
        });
      } catch (err) {
        console.warn("主題測驗已暫存於本地");
      }
      return exams;
    },

    // --- 當前學生與測驗會話設定 ---
    setCurrentExamId: function (examId) {
      currentSelectedExamId = examId;
    },

    getCurrentExamId: function () {
      return currentSelectedExamId;
    },

    getCurrentExam: function () {
      if (!currentSelectedExamId) return null;
      return this.getExamById(currentSelectedExamId);
    },

    setStudentName: function (name) {
      currentStudentName = (name || "").trim();
    },

    getStudentName: function () {
      return currentStudentName || "紫蝶小勇士";
    },

    // --- 學生作答紀錄管理 (Student Records) ---
    getStudentRecords: function (examId = null) {
      if (!examId || examId === "ALL") {
        return studentRecords;
      }
      return studentRecords.filter((r) => r.examId === examId);
    },

    // 學生作答結算上傳
    submitStudentRecord: async function (record) {
      const completeRecord = {
        id: "rec_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        studentName: record.studentName || this.getStudentName(),
        examId: record.examId || currentSelectedExamId || "default_exam",
        examTitle: record.examTitle || (this.getCurrentExam() ? this.getCurrentExam().title : "紫斑蝶全島大遷徙"),
        score: record.score || 0,
        level: record.level || 1,
        clearedStages: record.clearedStages || 0,
        totalAnswered: record.totalAnswered || (record.details ? record.details.length : 0),
        correctCount: record.correctCount || 0,
        wrongCount: record.wrongCount || 0,
        accuracy: record.totalAnswered > 0 ? Math.round((record.correctCount / record.totalAnswered) * 100) : 0,
        completedAt: Date.now(),
        details: record.details || [] // 每題作答詳細清單
      };

      studentRecords.unshift(completeRecord);
      localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(studentRecords));

      try {
        await fetch("/api/student-records", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify(completeRecord)
        });
        console.log("學生作答紀錄已成功同步至伺服器！");
      } catch (err) {
        console.warn("作答紀錄已暫存於本地 localStorage");
      }

      return completeRecord;
    },

    // 刪除單筆學生作答紀錄
    deleteStudentRecord: async function (recordId) {
      const targetIdx = studentRecords.findIndex(
        (r) => String(r.id) === String(recordId) || String(r.completedAt) === String(recordId)
      );
      if (targetIdx !== -1) {
        studentRecords.splice(targetIdx, 1);
        localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(studentRecords));
      }

      // 發送伺服器刪除請求 (優先使用 DELETE，失敗則退回 POST /delete)
      try {
        const resp = await fetch(`/api/student-records?id=${encodeURIComponent(recordId)}`, {
          method: "DELETE"
        });
        if (!resp.ok) {
          throw new Error("DELETE 失敗，嘗試 POST 備用端點");
        }
      } catch (err) {
        try {
          await fetch("/api/student-records/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify({ id: recordId })
          });
        } catch (postErr) {
          console.warn("無法連接伺服器刪除，已於本地 localStorage 刪除:", postErr);
        }
      }
      return true;
    },

    // 清空學生作答紀錄 (可指定全部或單一測驗)
    clearStudentRecords: async function (examId = "ALL") {
      if (examId === "ALL") {
        studentRecords = [];
      } else {
        studentRecords = studentRecords.filter((r) => r.examId !== examId);
      }
      localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(studentRecords));

      // 發送伺服器清除請求
      const isAll = (examId === "ALL");
      const url = isAll ? "/api/student-records?all=true" : `/api/student-records?examId=${encodeURIComponent(examId)}`;

      try {
        const resp = await fetch(url, { method: "DELETE" });
        if (!resp.ok) throw new Error("DELETE 失敗，嘗試 POST 備用端點");
      } catch (err) {
        try {
          await fetch("/api/student-records/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify(isAll ? { all: true } : { examId: examId })
          });
        } catch (postErr) {
          console.warn("無法連接伺服器清空，已於本地 localStorage 清除:", postErr);
        }
      }
      return true;
    },

    // 取得本地資料儲存檔案說明與即時檔案狀態
    getStorageInfo: async function () {
      try {
        const resp = await fetch("/api/storage-info");
        if (resp.ok) {
          return await resp.json();
        }
      } catch (err) {
        console.warn("無法連接 /api/storage-info，使用內建說明資料:", err);
      }

      return {
        dataDir: "Game-data",
        files: [
          {
            filename: "student_records.json",
            relativePath: "Game-data/student_records.json",
            title: "學生作答歷程與錯題明細",
            description: "記錄所有學生姓名、所選主題測驗、總分、答對率、闖關章節、每題作答詳情（所選選項、正解與時間戳記）。",
            category: "學生數據",
            format: "JSON Array (物件陣列)",
            exists: true,
            sizeFormatted: "本地端管理中",
            lastModified: "即時連動",
            recordCount: studentRecords.length
          },
          {
            filename: "question_banks.json",
            relativePath: "Game-data/question_banks.json",
            title: "多組主題題庫與自訂題目",
            description: "存放教師建立或匯入的多組分類題庫（題目內容、四個選項、正確答案索引、詳解說明與啟用狀態）。",
            category: "題庫設定",
            format: "JSON Array (題庫組物件陣列)",
            exists: true,
            sizeFormatted: "本地端管理中",
            lastModified: "即時連動",
            recordCount: questionBanks.length
          },
          {
            filename: "exams.json",
            relativePath: "Game-data/exams.json",
            title: "派送主題測驗發布設定",
            description: "存放教師派送建立的主題測驗（名稱、分類、任務說明、關聯題庫組別清單與派送啟用狀態）。",
            category: "測驗派送",
            format: "JSON Array (測驗設定陣列)",
            exists: true,
            sizeFormatted: "本地端管理中",
            lastModified: "即時連動",
            recordCount: exams.length
          },
          {
            filename: "questions.json",
            relativePath: "Game-data/questions.json",
            title: "基礎單一題庫 (舊版相容)",
            description: "系統預設或舊版相容的單一題庫題目資料檔案。",
            category: "題庫設定",
            format: "JSON Array (題目陣列)",
            exists: true,
            sizeFormatted: "本地端管理中",
            lastModified: "即時連動",
            recordCount: defaultQuestions.length
          },
          {
            filename: "config.json",
            relativePath: "Game-data/config.json",
            title: "遊戲全域系統與管理者設定",
            description: "存放後台管理密碼（預設 admin）、音效預設開關、章節題目配比等全域參數。",
            category: "系統配置",
            format: "JSON Object (鍵值配置)",
            exists: true,
            sizeFormatted: "本地端管理中",
            lastModified: "即時連動",
            recordCount: 1
          },
          {
            filename: "saves.json",
            relativePath: "Game-data/saves.json",
            title: "玩家角色與闖關進度存檔",
            description: "記錄本機玩家的關卡解鎖進度、金幣、體力、等級與當前選定勇者。",
            category: "遊戲存檔",
            format: "JSON Object (玩家進度)",
            exists: true,
            sizeFormatted: "本地端管理中",
            lastModified: "即時連動",
            recordCount: 1
          },
          {
            filename: "sample_import.csv",
            relativePath: "Game-data/sample_import.csv",
            title: "示範題庫 CSV 匯入樣版",
            description: "提供教師出題參考與一鍵測試匯入的標準 CSV 格式檔案（題目,答案編號,選項1~4）。",
            category: "範例資料",
            format: "CSV 純文字",
            exists: true,
            sizeFormatted: "本地端管理中",
            lastModified: "即時連動",
            recordCount: null
          }
        ]
      };
    },

    // --- 錯題重新打包成新題庫 (Mistake Packager) ---
    createBankFromMistakes: async function (examId, customBankName = null) {
      const records = this.getStudentRecords(examId);
      if (!records || records.length === 0) {
        throw new Error("此主題測驗目前尚無學生作答紀錄！");
      }

      // 收集所有被答錯的題目資訊（依 question 文字與 id 去重複）
      const mistakeMap = new Map();
      records.forEach((rec) => {
        if (Array.isArray(rec.details)) {
          rec.details.forEach((d) => {
            if (d.isCorrect === false) {
              const key = d.questionId || d.question;
              if (!mistakeMap.has(key)) {
                mistakeMap.set(key, d);
              }
            }
          });
        }
      });

      if (mistakeMap.size === 0) {
        throw new Error("太厲害了！此主題測驗中學生全部答對，目前沒有任何錯題可打包！");
      }

      // 從現有全部題庫中提取完整題目結構（包含 chapter, options, answerIndex, explanation）
      const allQ = this.getAllQuestions();
      const packedQuestions = [];

      mistakeMap.forEach((mistakeInfo, key) => {
        const found = allQ.find((q) => q.id === mistakeInfo.questionId || q.question === mistakeInfo.question);
        if (found) {
          packedQuestions.push(JSON.parse(JSON.stringify(found)));
        } else {
          // 若原題不在題庫，使用紀錄中的詳細資料補齊
          packedQuestions.push({
            id: Date.now() + Math.floor(Math.random() * 10000),
            chapter: mistakeInfo.chapter || 1,
            category: mistakeInfo.category || "錯題複習",
            question: mistakeInfo.question,
            options: mistakeInfo.options || [],
            answerIndex: mistakeInfo.answerIndex || 0,
            explanation: mistakeInfo.explanation || `正解為：${mistakeInfo.correctAnswer || ""}`
          });
        }
      });

      const exam = (examId && examId !== "ALL") ? this.getExamById(examId) : null;
      const examTitle = exam ? exam.title : "全主題測驗綜合";
      const bankName = customBankName && customBankName.trim()
        ? customBankName.trim()
        : `[錯題強化] ${examTitle} (共${packedQuestions.length}題)`;
      const bankDesc = `由【${examTitle}】學生作答之 ${mistakeMap.size} 道錯題自動彙整打包而成，供進行第二輪補救強化。`;

      const newBank = await this.addQuestionBank(bankName, bankDesc, packedQuestions, "錯題重練");
      return {
        success: true,
        bank: newBank,
        questionCount: packedQuestions.length,
        name: newBank.name,
        questions: newBank.questions
      };
    },

    // --- 題庫出題池運算 ---
    // 依據當前選取的主題測驗 (Exam) 取得有效題目總池
    getActiveQuestions: function () {
      // 若當前有選定主題測驗，嚴格從該主題測驗包含的題庫抽取
      if (currentSelectedExamId) {
        const exam = this.getExamById(currentSelectedExamId);
        if (exam && Array.isArray(exam.bankIds) && exam.bankIds.length > 0) {
          let pool = [];
          questionBanks.forEach((b) => {
            if (exam.bankIds.includes(b.id) && Array.isArray(b.questions)) {
              pool = pool.concat(b.questions);
            }
          });
          if (pool.length > 0) return pool;
        }
      }

      // 否則取用所有勾選為 active 的題庫
      const activeBanks = questionBanks.filter((b) => b.active);
      let pool = [];
      activeBanks.forEach((bank) => {
        if (Array.isArray(bank.questions)) {
          pool = pool.concat(bank.questions);
        }
      });
      return pool;
    },

    getAllQuestions: function () {
      let pool = [];
      questionBanks.forEach((bank) => {
        if (Array.isArray(bank.questions)) {
          pool = pool.concat(bank.questions);
        }
      });
      return pool;
    },

    getCategories: function () {
      const pool = this.getActiveQuestions();
      const cats = new Set();
      pool.forEach((q) => {
        if (q.category) cats.add(q.category);
      });
      return Array.from(cats);
    },

    // 核心抽題邏輯：徹底隨機打亂出題，絕不按題庫或章節順序出題
    getRandomQuestion: function (chapterNumber, selectedCategory = "全部", usedIds = []) {
      let activePool = this.getActiveQuestions();

      if (activePool.length === 0) {
        activePool = this.getAllQuestions();
      }

      if (activePool.length === 0) return null;

      // 依分類領域過濾（若選擇全部則包含所有題目；不按章節關卡強加順序限制，使所有關卡均能隨機抽中各題庫的題目）
      let pool = activePool.filter((q) => {
        return selectedCategory === "全部" || q.category === selectedCategory;
      });

      // 若該分類無題目，回退至全部可用題目
      if (pool.length === 0) {
        pool = activePool;
      }

      // 健全性防護：確保每道題目都有唯一的標識符 (防止無 id 或重覆)
      pool.forEach((q, idx) => {
        if (q.id === undefined || q.id === null || q.id === "") {
          q.id = "q_" + idx + "_" + (q.question ? q.question.substring(0, 10) : String(idx));
        }
      });

      // 使用 Set 進行寬鬆比對 (將所有 ID 轉為字串避免型別不一致導致重複出題或漏判)
      const usedSet = new Set((usedIds || []).map((id) => String(id)));
      let unusedPool = pool.filter((q) => !usedSet.has(String(q.id)));

      // 若所有題目皆已出過一輪，自動循環使用全題庫，確保答題不中斷
      const isNewCycle = unusedPool.length === 0;
      const candidatePool = isNewCycle ? pool.slice() : unusedPool.slice();

      // 使用 Fisher-Yates (Knuth) 洗牌演算法將候選題目陣列徹底打亂，打破原有任何排版順序
      for (let i = candidatePool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidatePool[i], candidatePool[j]] = [candidatePool[j], candidatePool[i]];
      }

      // 隨機選中洗牌後的第一筆題目
      const chosen = candidatePool[0];
      if (!chosen) return null;

      const result = JSON.parse(JSON.stringify(chosen));
      if (isNewCycle) {
        result._isNewCycle = true;
      }
      return result;
    },

    getConfig: function () {
      return config;
    },

    // 更新並持久化遊戲設定 (包含勇者與五大關主數值)
    updateConfig: async function (newConfig) {
      if (!newConfig) return { success: false, message: "設定資料無效" };
      config = newConfig;
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));

      if (config.heroes) {
        applyHeroesConfig(config.heroes);
      }

      try {
        const resp = await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify(config)
        });
        if (resp.ok) {
          const res = await resp.json();
          return { success: true, message: res.message || "設定已成功儲存至 Game-data/config.json" };
        } else {
          return { success: false, message: `伺服器回應錯誤 (${resp.status})` };
        }
      } catch (err) {
        console.warn("無法透過 API 儲存至本機檔案，僅儲存於瀏覽器快取：", err);
        return { success: true, message: "已儲存於瀏覽器快取（離線模式）" };
      }
    },

    // --- 四大紫斑蝶生態勇者介面 ---
    getHeroes: function () {
      return Object.values(HEROES_CONFIG);
    },

    getHeroById: function (heroId) {
      return HEROES_CONFIG[heroId] || HEROES_CONFIG.hero_purple;
    },

    getCurrentHeroId: function () {
      return currentSelectedHeroId;
    },

    setCurrentHeroId: function (heroId) {
      if (HEROES_CONFIG[heroId]) {
        currentSelectedHeroId = heroId;
        localStorage.setItem(HEROES_STORAGE_KEY, heroId);
      }
    },

    getCurrentHero: function () {
      return HEROES_CONFIG[currentSelectedHeroId] || HEROES_CONFIG.hero_purple;
    },

    // --- 遊戲圖片自訂與 AI 生圖管理介面 (具備 100% 前端無縫降級保證) ---
    // 查詢所有 20 張圖片之自訂狀態與 AI Prompt
    getImagesStatus: async function () {
      const localCustom = getLocalCustomImages();
      let serverImages = null;

      try {
        const resp = await fetch("/api/images-status");
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.success && Array.isArray(data.images)) {
            serverImages = data.images;
          }
        }
      } catch (err) {
        console.warn("後端 API 未連線，啟動前端內建 20 張圖片完全降級模式：", err);
      }

      // 若伺服器成功回傳，融合本地自訂快顯與伺服器自訂圖
      if (serverImages && serverImages.length > 0) {
        serverImages.forEach((img) => {
          if (!img.isCustom && localCustom[img.filename]) {
            img.isCustom = true;
            img.currentUrl = localCustom[img.filename];
            img.sizeFormatted = "本地自訂圖片";
            img.lastModified = "本機已套用";
          }
        });
        const customCount = serverImages.filter((item) => item.isCustom).length;
        return {
          success: true,
          total: serverImages.length,
          customCount: customCount,
          images: serverImages
        };
      }

      // 前端離線/純靜態降級模式：使用內建 DEFAULT_GAME_IMAGES_META，100% 成功列出 20 張圖片
      const processed = DEFAULT_GAME_IMAGES_META.map((meta) => {
        const isCustom = !!localCustom[meta.filename];
        const currentUrl = isCustom ? localCustom[meta.filename] : meta.defaultPath;
        return {
          ...meta,
          isCustom: isCustom,
          currentUrl: currentUrl,
          customPath: isCustom ? currentUrl : null,
          sizeFormatted: isCustom ? "本地已替換" : "官方預設圖",
          lastModified: isCustom ? "本機自訂儲存" : "官方原版"
        };
      });

      const customCount = processed.filter((item) => item.isCustom).length;
      return {
        success: true,
        isLocalFallback: true,
        total: processed.length,
        customCount: customCount,
        images: processed
      };
    },

    // 單張圖片自訂取代上傳 (即時預覽與套用 + 背景同步後端)
    uploadCustomImage: async function (filename, base64Data) {
      if (!filename || !base64Data) {
        return { success: false, error: "缺少檔名或圖片內容" };
      }

      // 1. 本機 localStorage 立即保存並套用
      const localCustom = getLocalCustomImages();
      localCustom[filename] = base64Data;
      setLocalCustomImages(localCustom);

      if (!config) config = {};
      if (!config.customImages) config.customImages = {};
      config.customImages[filename] = base64Data;
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
      applyCustomImagesConfig(config.customImages);

      // 2. 嘗試非同步同步至後端實體伺服器 (若後端運行中)
      try {
        const resp = await fetch("/api/upload-image", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ filename, data: base64Data })
        });
        if (resp.ok) {
          const result = await resp.json();
          await this.reloadConfig();
          return result;
        }
      } catch (err) {
        console.warn("後端 API 未連線，已於瀏覽器本機儲存並即刻生效：", err);
      }

      return {
        success: true,
        message: `圖片【${filename}】已成功替換並即時呈現！`,
        filename: filename
      };
    },

    // 壓縮檔 ZIP 批次上傳取代 (按檔名比對)
    uploadZipImages: async function (base64Zip) {
      try {
        const resp = await fetch("/api/upload-zip-images", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ zipData: base64Zip })
        });
        const result = await resp.json();
        if (result.success) {
          await this.reloadConfig();
        }
        return result;
      } catch (err) {
        return { success: false, error: err.message || "壓縮檔上傳連線失敗" };
      }
    },

    // 單張或全部圖片恢復預設 (本機立即生效 + 同步後端)
    resetCustomImage: async function (filename, isAll = false) {
      // 1. 本機 localStorage 立即清除
      const localCustom = getLocalCustomImages();
      if (isAll) {
        setLocalCustomImages({});
        if (config && config.customImages) config.customImages = {};
      } else if (filename) {
        delete localCustom[filename];
        setLocalCustomImages(localCustom);
        if (config && config.customImages) delete config.customImages[filename];
      }
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config || {}));
      applyCustomImagesConfig((config && config.customImages) || {});

      // 2. 嘗試非同步通知後端還原實體檔案
      try {
        const resp = await fetch("/api/reset-image", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify(isAll ? { all: true } : { filename })
        });
        if (resp.ok) {
          const result = await resp.json();
          await this.reloadConfig();
          return result;
        }
      } catch (err) {
        console.warn("後端 API 未連線，已於瀏覽器本機恢復為官方預設：", err);
      }

      return {
        success: true,
        message: isAll ? "全系統 20 張圖片已全數恢復為官方原版預設！" : `圖片【${filename}】已恢復為官方原版預設！`
      };
    },

    // 重新載入並套用最新 config
    reloadConfig: async function () {
      try {
        const resp = await fetch("/api/config");
        if (resp.ok) {
          config = await resp.json();
          localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
          if (config && config.heroes) applyHeroesConfig(config.heroes);
          if (config && config.customImages) applyCustomImagesConfig(config.customImages);
        }
      } catch (e) {
        console.warn("重載設定失敗：", e);
      }
    },

    applyCustomImagesConfig: applyCustomImagesConfig,
    updateEndingHeroesAvatars: updateEndingHeroesAvatars
  };
})();


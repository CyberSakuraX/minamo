---
version: 1
name: minamo-design
description: "和紙の生成りに墨の明朝、朱の印がひとつ灯る、静けさのためのデザインシステム。黙走会 / minamo.run(誰も運営しないランニングコミュニティ)の一枚ページ用。装飾の主役は余白。常時動くのは光の点の明滅だけ。OSがダークのときはページ全体が墨側に倒れる(未明の紙)。他人と比べられる数字・煽り・シェアボタンはこのシステムに存在しない。出典は docs/01〜03 と docs/07、考え方は CLAUDE.md。この形式は VoltAgent/awesome-design-md の DESIGN.md 慣行に倣った(AIエージェントがこのファイルを読み、複製・改修時にも佇まいを保てるように)。"
---

colors:
  # 暁(ライト・既定)
  light:
    bg: "#f7efe2"            # ページ背景(和紙・生成り)
    paper: "#fdf8ee"          # カード地
    ink: "#38302a"            # 本文の墨
    sub: "#9a8b78"            # 補助文字
    line: "rgba(90,66,42,.15)"
    accent: "#c8703c"         # 朱(印・強調。乱発しない)
    accent-ink: "#a5552a"
    accent-soft: "rgba(200,112,60,.4)"
    btn-shadow: "0 9px 20px rgba(180,110,60,.3)"        # 判の落ち影(押すと締まる)
    btn-shadow-press: "0 3px 7px rgba(180,110,60,.35)"
    card-shadow: "0 2px 10px rgba(90,66,42,.1)"          # 台紙の淡い影
    night: "#2a2637"          # 会釈カードの夜空(ライト時も夜)
    night-ink: "#d9d0c4"
    night-sub: "#948b85"
    glow: "rgba(240,170,110,.6)"   # 朝焼け・会釈の灯
    glow-ink: "#eab88a"
    field: "rgba(255,255,255,.55)" # 入力欄の地
  # 未明の紙(prefers-color-scheme: dark。朱と灯は変えない)
  dark:
    bg: "#211e23"
    paper: "#29252b"
    ink: "#e6ddcd"
    sub: "#998c7c"
    line: "rgba(230,221,205,.14)"
    accent: "#c8703c"          # 夜でも印は朱
    accent-ink: "#d98a55"
    accent-soft: "rgba(221,132,73,.45)"
    btn-shadow: "0 7px 16px rgba(12,6,3,.5)"             # 真っ黒の大きな影は使わない(足元が汚れる)
    btn-shadow-press: "0 3px 6px rgba(12,6,3,.55)"
    card-shadow: "0 2px 10px rgba(0,0,0,.3)"
    night: "#18161d"
    glow: "rgba(240,170,110,.6)"   # 灯も変えない
    glow-ink: "#eab88a"
    field: "rgba(255,255,255,.06)"

typography:
  body:
    fontFamily: "'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', serif"
    note: "本文も見出しも明朝。ゴシックの見出しでスポーティにしない"
  display:
    fontFamily: "'Zen Old Mincho', serif"
    usage: "ロゴ・スタンプ絵柄の「走」のみ"
  hand:
    fontFamily: "'Klee One', cursive"   # ペン字。手書きの温度(2026-07-10 オーナー選定)
    usage: "ロゴ(題字)・押印ボタンのラベル・「一日一回まで」のみ。本文に使わない"
    treatment: "ボタンは palt + scale(.9,1.09)の縦長 + rotate(-2.5deg)の右肩上がり。ロゴは水平のまま(看板は傾けない)"
  scale:
    logo: { fontFamily: "'Klee One'", fontSize: 34px, fontWeight: 600, letterSpacing: .24em }
    lead: { fontSize: 12.5px, letterSpacing: .26em }
    stamp-label: { fontSize: 32px, fontWeight: 600, letterSpacing: .05em, note: "横二行「走った印/を押す」。円を文字で満たす(縁まで約4px)" }
    card-title: { fontSize: 14px, letterSpacing: .14em }
    big-number: { fontSize: 38px, fontWeight: 500, lineHeight: 1 }
    input: { fontSize: 17px }
    footnote: { fontSize: 10.5px, letterSpacing: .08em, lineHeight: 1.9 }
  rule: "字間を空けた中央揃えは letter-spacing と同値の padding-left で光学センターを取る"

rounded:
  card: 8px
  input: 6px
  seal: 50%   # 印・ボタン・点はすべて円

spacing:
  container: { maxWidth: 460px, designWidth: 402px }
  card: { padding: "20px 22px", marginX: 20px }
  editor: { padding: "18px 20px", marginX: 24px, gap: 12px }
  tapTarget: "実効44px以上(入力・ボタンはpadding 13px、光の点は不可視の44×44)"

components:
  stamp-button:
    shape: "168px 円・朱のベタ塗り(グラデ・光沢なし。ゴム印の澄んだ朱)"
    label: "走った印を押す(Klee One 横二行・32px・縦長・右肩上がり)/ 一日一回まで"
    behavior: "押せるのは1日1回。押した後は静かに役目を終える(連打・取消の概念なし)"
    press: "所作の三拍 = 押し込む(:active 沈み+影が締まる)→ 判が持ち上がる(mkPressLift)→ カードにぽん(mkPon)"
  stamp-card:
    what: "夏の朝のスタンプカード(2026-07-10 オーナー承認・旧「印影」を置き換え)"
    shape: "316px 台紙・角丸10px・紐穴・10マス(5×2)。押印前から見えている"
    stamps: "絵柄4種(走の印・花丸・朝日・水面=一粒の月と波紋)が日替わりで混在。手の揺れは角度と位置だけ(かすれ・グランジ加工はしない)"
    determinism: "n日目の印はシード minamo-stamp/n で固定 = 一度押された印は翌日以降も同じ姿(粒と同じ「動かない過去」)"
    accumulation: "満了したカードは下に重なり厚みになる(最大10段+「下に n 枚」)。日付マスを持たない = 休んだ日が空白として残らない(原則5)"
  flash:
    what: "押印の瞬間だけ夜明け色が差す約1秒の明転。高揚はこの一拍のみ"
    dark-mode: "暗所では減光(α .9 → .55)"
  bow-field:
    what: "夜の水面。名前のない光の点(3〜6.5px)が今日の参加者"
    rule: "点に個人情報・記録・リンクを持たせない。速い人も歩いた人も同じ一粒"
    guide: "ガイド行(光の上)が「いま何ができるか」を先に言う。4状態(未押印/触れられる/光なし/会釈済み)で言葉を出し分ける(2026-07-10)"
    affordance: "触れられる光にだけ淡い輪(26px円・1px)。:active で点がふわっと応える。どの光に触れても実在するだれかに届く(巡回割り当て)"
  landscape:
    what: "累計日数だけから決定的に描画される風景(粒→稜線30日→月90日→水面240日→夜明け365日)"
    rule: "決して後退しない。休んでも減らない"

motion:
  keyframes: "mkFlash / mkPulse / mkAppear / mkTwinkle / mkPressLift / mkPon / mkDip の7つだけ(後3つは押印の所作・一度きり)"
  rule: "常時動く装飾は点の明滅のみ。ループアニメーションを追加しない。押印の所作は押したセッションだけ動き、リロードでは再生しない。prefers-reduced-motion で全停止"

principles:
  - "装飾の主役は余白。迷ったら削る"
  - "朱を使ってよいのは、押せるもの(ボタン・リンク)と、印と、今日の灯(共に走った人の数)だけ。個人の数字・カード番号は墨/砂色"
  - "影は判(ボタン)とカード(台紙)の下だけ。装飾の影を増やさない"
  - "利用時間帯を想定したコピーを書かない(「あしたの朝に」等)。走る時刻は各自のもの(2026-07-10)"
  - "操作物は必要になるまで見せない(添え書きは押印後にだけ現れる)"
  - "キーボード操作時にだけフォーカスの輪(accent-soft)が現れる。タッチ・マウスには出ない"
  - "他人と比べられる数字を置かない(フォロワー・いいね・ランキング・他人の距離やペース)"
  - "連続日数・ストリーク・途切れの表現を作らない。累計のみ"
  - "シェアボタン・SNSアイコンを置かない"
  - "エラーは静かに畳む。ダイアログ・トースト・スピナーを出さない"
  - "煽り色・ビビッドカラー・STARTモチーフを使わない。朱はアクセントであり主役の背景ではない"
  - "コピーの声は誰のものでもない(運営の声・応援の声にしない。例:「お待ちしています」は書かない)"

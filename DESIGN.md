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
    accent-hi: "#dd8449"
    accent-ink: "#a5552a"
    accent-soft: "rgba(200,112,60,.4)"
    accent-shadow: "rgba(180,110,60,.3)"
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
    accent-hi: "#dd8449"
    accent-ink: "#d98a55"
    accent-soft: "rgba(221,132,73,.45)"
    accent-shadow: "rgba(0,0,0,.45)"
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
    usage: "ロゴ・印影(黙走)のみ"
  scale:
    logo: { fontSize: 32px, fontWeight: 700, letterSpacing: .3em }
    lead: { fontSize: 12.5px, letterSpacing: .26em }
    seal-moku: { fontSize: 46px, fontWeight: 700, letterSpacing: .28em, writingMode: vertical-rl }
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
    shape: "180px 円・rotate(-2deg)・朱のradial"
    label: "走った印を押す(縦書き)/ 一日一回まで"
    behavior: "押せるのは1日1回。押した後は静かに役目を終える(連打・取消の概念なし)"
  seal:
    shape: "180px 円・rotate(-3.5deg)・朱の輪+内リング"
    content: "黙走(縦書き)+落款(漢数字の年月日)"
    daily-waver: "日付シードで回転・内リング・濃さが揺らぐ。濃さ下限0.94(印の薄れに見せない)"
  flash:
    what: "押印の瞬間だけ夜明け色が差す約1秒の明転。高揚はこの一拍のみ"
    dark-mode: "暗所では減光(α .9 → .55)"
  bow-field:
    what: "夜の水面。名前のない光の点(3〜6.5px)が今日の参加者"
    rule: "点に個人情報・記録・リンクを持たせない。速い人も歩いた人も同じ一粒"
  landscape:
    what: "累計日数だけから決定的に描画される風景(粒→稜線30日→月90日→水面240日→夜明け365日)"
    rule: "決して後退しない。休んでも減らない"

motion:
  keyframes: "mkFlash / mkPulse / mkAppear / mkTwinkle の4つだけ"
  rule: "常時動く装飾は点の明滅のみ。ループアニメーションを追加しない。prefers-reduced-motion で全停止"

principles:
  - "装飾の主役は余白。迷ったら削る"
  - "朱を使ってよいのは、押せるもの(ボタン・リンク)と、印と、今日の灯(共に走った人の数)だけ。個人の数字・カード番号は墨/砂色"
  - "影は印(ボタン)の下にひとつだけ。装飾の影を増やさない"
  - "操作物は必要になるまで見せない(添え書きは押印後にだけ現れる)"
  - "キーボード操作時にだけフォーカスの輪(accent-soft)が現れる。タッチ・マウスには出ない"
  - "他人と比べられる数字を置かない(フォロワー・いいね・ランキング・他人の距離やペース)"
  - "連続日数・ストリーク・途切れの表現を作らない。累計のみ"
  - "シェアボタン・SNSアイコンを置かない"
  - "エラーは静かに畳む。ダイアログ・トースト・スピナーを出さない"
  - "煽り色・ビビッドカラー・STARTモチーフを使わない。朱はアクセントであり主役の背景ではない"
  - "コピーの声は誰のものでもない(運営の声・応援の声にしない。例:「お待ちしています」は書かない)"

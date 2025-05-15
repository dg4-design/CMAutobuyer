# Cookie Monster Autobuyer 🍪 🏬

Cookie Clicker 用の Cookie Monster 拡張機能向け自動購入スクリプトです。建物とアップグレードを最適な効率で自動的に購入します。

## 機能

### 建物自動購入 (BuildingAutobuyer.js)

- Payback Period（投資回収期間）が最短の建物を自動的に購入
- 購入数量を選択可能（最適な量、1 個ずつ、10 個ずつ、100 個ずつ）
- Cookie Monster 設定画面からワンクリックで有効化/無効化

### アップグレード自動購入 (UpgradeAutobuyer.js)

- Payback Period（投資回収期間）が最短のアップグレードを自動的に購入
- 特定のアップグレードタイプを除外可能
  - スイッチ系（Golden Switch/Shimmering Veil など）
  - 研究アップグレード（負の効果を持つ可能性あり）
  - 契約系（Elder Covenant など）
- Cookie Monster 設定画面から各種設定が可能

## 前提条件

- [Cookie Clicker](https://orteil.dashnet.org/cookieclicker/)
- [Cookie Monster](https://github.com/CookieMonsterTeam/CookieMonster)

<!-- ## インストール方法

### 方法

1. Cookie Clicker に Cookie Monster を導入しておく
2. ブラウザの開発者ツールを開く
3. 「コンソール」タブを開く
4. 各スクリプトの内容をコピーしてコンソールに貼り付け、Enter キーを押す

#### 建物自動購入

```javascript
Game.LoadMod("https://dg4-design.github.io/CMAutobuyer/BuildingAutobuyer.js");
```

#### アップグレード自動購入

```javascript
Game.LoadMod("https://dg4-design.github.io/CMAutobuyer/UpgradeAutobuyer.js");
```

### 方法 2: スクリプトタグによる読み込み

```javascript
function(){
  var s = document.createElement('script');
  s.setAttribute("src", "https://dg4-design.github.io/CMAutobuyer/BuildingAutobuyer.js");
  document.head.appendChild(s);
}();
``` -->

## 使い方

### 設定

Cookie Monster のオプション画面（画面左上の CM アイコン → オプション）から以下の設定が可能です：

- **BuildingAutobuyer**: 建物自動購入のオン/オフ
- **購入数量**: 自動購入する建物の数量（最適な量/1 個ずつ/10 個ずつ/100 個ずつ）
- **UpgradeAutobuyer**: アップグレード自動購入のオン/オフ
- **スイッチ除外**: スイッチ系アップグレード除外のオン/オフ
- **研究除外**: 研究アップグレード除外のオン/オフ
- **契約除外**: 契約系アップグレード除外のオン/オフ

### コマンド

#### 建物自動購入

- 開始: `CMBuildingAutobuyer.start()`
- 停止: `CMBuildingAutobuyer.stop()`
- 切替: `CMBuildingAutobuyer.toggle()`

#### アップグレード自動購入

- 開始: `CMUpgradeAutobuyer.start()`
- 停止: `CMUpgradeAutobuyer.stop()`
- 切替: `CMUpgradeAutobuyer.toggle()`
- 診断: `CMUpgradeAutobuyer.listAllUpgrades()`

### 設定の保存

このスクリプトの設定は Cookie Monster の設定システムに統合されているため、Cookie Monster の設定と一緒に自動的に保存・読み込みされます。ゲームをセーブすると次回ロード時にも設定が維持されます。

## 仕組み

Cookie Monster が計算する Payback Period（PP）という指標を使用しています。PP は投資（購入コスト）がクッキー生産量の増加によって回収されるまでの時間を表します。PP 値が小さいほど効率的な購入となります。

このスクリプトは定期的に最も PP 値の小さい建物やアップグレードを探して自動購入します。

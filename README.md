# Cookie Monster Autobuyer 🍪 🏬

Cookie Clicker 用の Cookie Monster Mod 向け自動購入 Mod です。施設とアップグレードを最適な効率で自動的に購入します。

## 機能

### 施設自動購入 (BuildingAutobuyer.js)

- Payback Period（投資回収期間）が最短の施設を自動的に購入
- 購入数量を選択可能（最適な量、1 個ずつ、10 個ずつ、100 個ずつ）
- ゲーム内オプション画面から設定

### アップグレード自動購入 (UpgradeAutobuyer.js)

- Payback Period（投資回収期間）が最短のアップグレードを自動的に購入
- 特定のアップグレードタイプを除外可能
  - スイッチ系（Golden Switch/Shimmering Veil など）
  - 研究アップグレード（グランマポカリプス関連）
  - 契約系（Elder Covenant など）
- ゲーム内オプション画面から設定

## 前提条件

- [Cookie Clicker](https://orteil.dashnet.org/cookieclicker/)
- [Cookie Monster](https://github.com/CookieMonsterTeam/CookieMonster)

## インストール方法

### 方法

1. Cookie Clicker に Cookie Monster を導入しておく
2. ブラウザの開発者ツールを開く
3. 「コンソール」タブを開く
4. 各スクリプトの内容をコピーしてコンソールに貼り付け、Enter キーを押す

#### 施設自動購入

```javascript
Game.LoadMod("https://dg4-design.github.io/CMAutobuyer/BuildingAutobuyer.js");
```

#### アップグレード自動購入

```javascript
Game.LoadMod("https://dg4-design.github.io/CMAutobuyer/UpgradeAutobuyer.js");
```

#### 両方

```javascript
Game.LoadMod("https://dg4-design.github.io/CMAutobuyer/BuildingAutobuyer.js");
Game.LoadMod("https://dg4-design.github.io/CMAutobuyer/UpgradeAutobuyer.js");
```

<details>

<summary><h3>Cookie Monster と同時に読み込む</h3></summary>

#### 施設自動購入

```javascript
Game.LoadMod("https://cookiemonsterteam.github.io/CookieMonster/dist/CookieMonster.js");
Game.LoadMod("https://dg4-design.github.io/CMAutobuyer/BuildingAutobuyer.js");
```

#### アップグレード自動購入

```javascript
Game.LoadMod("https://cookiemonsterteam.github.io/CookieMonster/dist/CookieMonster.js");
Game.LoadMod("https://dg4-design.github.io/CMAutobuyer/UpgradeAutobuyer.js");
```

#### 両方

```javascript
Game.LoadMod("https://cookiemonsterteam.github.io/CookieMonster/dist/CookieMonster.js");
Game.LoadMod("https://dg4-design.github.io/CMAutobuyer/BuildingAutobuyer.js");
Game.LoadMod("https://dg4-design.github.io/CMAutobuyer/UpgradeAutobuyer.js");
```

</details>

## 使い方

### 設定メニュー

ゲーム内設定メニュー（Options）から以下を設定：

#### 施設自動購入設定

- **自動購入**: 施設自動購入のオン/オフ
- **購入数量**: 自動購入する施設の数量（最適な量/1 個ずつ/10 個ずつ/100 個ずつ）

#### アップグレード自動購入設定

- **自動購入**: アップグレード自動購入のオン/オフ
- **スイッチ系除外**: Golden Switch や Shimmering Veil などのスイッチ系アップグレードを自動購入から除外
- **研究除外**: グランマポカリプス関連の研究アップグレードを自動購入から除外
- **契約系除外**: Elder Covenant などの契約系アップグレードを自動購入から除外

### コマンド

#### 施設自動購入

- 開始: `CMBuildingAutobuyer.start()`
- 停止: `CMBuildingAutobuyer.stop()`
- 切替: `CMBuildingAutobuyer.toggle()`
- 購入数量設定: `CMBuildingAutobuyer.setBuyAmount(amount)` (0:最適な量, 1:単一, 2:10 個, 3:100 個)
- 現在の設定確認: `CMBuildingAutobuyer.getBuyAmount()`

#### アップグレード自動購入

- 開始: `CMUpgradeAutobuyer.start()`
- 停止: `CMUpgradeAutobuyer.stop()`
- 切替: `CMUpgradeAutobuyer.toggle()`

### 設定の保存

このスクリプトの設定は Cookie Monster のフレームワークに統合されているため、ゲームをセーブすると次回ロード時にも設定が維持されます。

## 仕組み

Cookie Monster が計算する Payback Period（PP）という指標を使用しています。PP は投資（購入コスト）がクッキー生産量の増加によって回収されるまでの時間を表します。PP 値が小さいほど効率的な購入となります。

このスクリプトは定期的に最も PP 値の小さい施設やアップグレードを探して自動購入します。

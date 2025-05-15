// 初期化の問題を修正
// 最初にオブジェクトを定義して、そのあとで拡張する
var CMUpgradeAutobuyer = {};

//===========================================================================
// UpgradeAutobuyer.js
// Cookie Monster アップグレード自動購入スクリプト
// 使用方法: CMUpgradeAutobuyer.start() で開始、CMUpgradeAutobuyer.stop() で停止
//===========================================================================

(function (UpgradeAutobuyer) {
  // 設定
  UpgradeAutobuyer.isRunning = false;
  UpgradeAutobuyer.interval = 100; // 0.1秒ごとにチェック
  UpgradeAutobuyer.timerId = null;
  UpgradeAutobuyer.debug = false;
  UpgradeAutobuyer.settingName = "cmUpgradeAutobuyer"; // 設定名
  UpgradeAutobuyer.excludeSettingPrefix = "cmUpgradeExclude"; // 除外設定のプレフィックス

  // 除外設定
  UpgradeAutobuyer.excludeSwitches = true; // Golden/Shimmering Switch など
  UpgradeAutobuyer.excludeResearch = false; // 研究アップグレード（任意）
  UpgradeAutobuyer.excludeCovenants = true; // Elder Covenant など

  // デバッグログ
  UpgradeAutobuyer.log = function (message) {
    if (UpgradeAutobuyer.debug) {
      console.log(`[CM-UA] ${message}`);
    }
  };

  // アップグレードを除外すべきかチェック
  UpgradeAutobuyer.shouldExclude = function (upgrade) {
    if (!upgrade) return true;
    if (this.excludeSwitches && (upgrade.name.includes("switch") || upgrade.name.includes("Switch") || upgrade.name.includes("veil") || upgrade.name.includes("Veil"))) return true;
    if (this.excludeCovenants && upgrade.name.includes("Covenant")) return true;
    if (this.excludeResearch && upgrade.pool === "tech") return true;
    return false;
  };

  // 最適なアップグレードを探す
  UpgradeAutobuyer.findBestUpgrade = function () {
    try {
      if (!window.CookieMonsterData?.Upgrades || !Game?.UpgradesInStore) {
        return null;
      }

      let bestUpgrade = null;
      let bestPP = Infinity;

      for (let i = 0; i < Game.UpgradesInStore.length; i++) {
        const upgrade = Game.UpgradesInStore[i];

        if (!upgrade || upgrade.bought || upgrade.locked) continue;
        if (this.shouldExclude(upgrade)) continue;

        const cmData = window.CookieMonsterData.Upgrades[upgrade.name];
        if (!cmData || typeof cmData.pp !== "number" || isNaN(cmData.pp)) continue;

        if (cmData.pp < bestPP) {
          const price = typeof upgrade.getPrice === "function" ? upgrade.getPrice() : upgrade.price;
          bestUpgrade = { id: i, name: upgrade.name, pp: cmData.pp, price: price, originalObject: upgrade };
          bestPP = cmData.pp;
        }
      }
      return bestUpgrade;
    } catch (error) {
      this.log(`検索エラー: ${error}`);
      return null;
    }
  };

  // アップグレードを直接購入
  UpgradeAutobuyer.directBuyUpgrade = function (upgradeToBuy) {
    try {
      if (!upgradeToBuy || !upgradeToBuy.originalObject) return false;
      const upgrade = upgradeToBuy.originalObject;

      if (upgrade.bought) return false;
      if (Game.cookies < upgradeToBuy.price) return false;

      let boughtSuccessfully = false;
      if (typeof upgrade.buy === "function") {
        upgrade.buy(1);
        boughtSuccessfully = upgrade.bought;
      } else if (document.getElementById(`upgrade${upgradeToBuy.id}`)) {
        if (typeof Game.UpgradeClick === "function") {
          Game.UpgradeClick(upgrade);
          boughtSuccessfully = upgrade.bought;
        } else {
          document.getElementById(`upgrade${upgradeToBuy.id}`).click();
          boughtSuccessfully = upgrade.bought;
        }
      } else if (typeof Game.UpgradeClick === "function") {
        Game.UpgradeClick(upgrade);
        boughtSuccessfully = upgrade.bought;
      }

      if (boughtSuccessfully) {
        this.log(`購入: ${upgradeToBuy.name} (PP: ${upgradeToBuy.pp.toFixed(2)}, 価格: ${upgradeToBuy.price.toLocaleString()})`);
        Game.Notify(`アップグレード購入`, `${upgradeToBuy.name} を購入しました`, upgrade.icon || [0, 0], 1);
        return true;
      }
      return false;
    } catch (error) {
      this.log(`購入エラー: ${error}`);
      return false;
    }
  };

  // 購入処理
  UpgradeAutobuyer.tryPurchase = function () {
    const best = this.findBestUpgrade();
    if (!best) return false;

    if (Game.cookies >= best.price) {
      return this.directBuyUpgrade(best);
    } else {
      // this.log(`待機中: ${best.name} (必要: ${best.price.toLocaleString()}, 現在: ${Game.cookies.toLocaleString()})`);
      return false;
    }
  };

  // アップグレード一覧表示（診断用）
  UpgradeAutobuyer.listAllUpgrades = function () {
    if (!Game?.UpgradesInStore) {
      console.log("[CM-UA] アップグレードストアが利用できません。");
      return;
    }

    let count = 0;
    console.log("----- 購入可能なアップグレード一覧 -----");

    for (let i = 0; i < Game.UpgradesInStore.length; i++) {
      const upgrade = Game.UpgradesInStore[i];
      if (!upgrade || upgrade.bought || upgrade.locked) continue;

      const price = typeof upgrade.getPrice === "function" ? upgrade.getPrice() : upgrade.price;
      const affordable = Game.cookies >= price ? "購入可能" : "購入不可";
      const excluded = this.shouldExclude(upgrade) ? "除外" : "対象";

      let ppValue = "N/A";
      if (window.CookieMonsterData?.Upgrades?.[upgrade.name]) {
        const pp = window.CookieMonsterData.Upgrades[upgrade.name].pp;
        ppValue = typeof pp === "number" && !isNaN(pp) ? pp.toFixed(2) : "無効";
      }

      console.log(`${i}. ${upgrade.name} - ${affordable} - ${excluded} - PP: ${ppValue} - 価格: ${price.toLocaleString()}`);
      count++;
    }

    console.log(`合計: ${count}個のアップグレードが利用可能です`);
    console.log("-------------------------------------");
  };

  // メインループ
  UpgradeAutobuyer.check = function () {
    if (!UpgradeAutobuyer.isRunning) return;
    if (!Game || Game.OnAscend || Game.AscendTimer > 0 || Game.specialTab === "milkSelection" || Game.promptOn) {
      return;
    }
    UpgradeAutobuyer.tryPurchase();
  };

  // 自動購入を開始
  UpgradeAutobuyer.start = function () {
    if (UpgradeAutobuyer.isRunning) {
      this.log("アップグレード自動購入は既に実行中です。");
      return;
    }
    UpgradeAutobuyer.isRunning = true;
    UpgradeAutobuyer.timerId = setInterval(UpgradeAutobuyer.check, UpgradeAutobuyer.interval);
    Game.Notify("アップグレード自動購入", "PP最短のアップグレードを自動的に購入します", [16, 5], 1);
    this.log("アップグレード自動購入を開始しました。");
    setTimeout(UpgradeAutobuyer.check, UpgradeAutobuyer.interval);
  };

  // 自動購入を停止
  UpgradeAutobuyer.stop = function () {
    if (!UpgradeAutobuyer.isRunning) {
      this.log("アップグレード自動購入は実行されていません。");
      return;
    }
    UpgradeAutobuyer.isRunning = false;
    if (UpgradeAutobuyer.timerId) {
      clearInterval(UpgradeAutobuyer.timerId);
      UpgradeAutobuyer.timerId = null;
    }
    Game.Notify("アップグレード自動購入", "自動購入を停止しました", [17, 5], 1);
    this.log("アップグレード自動購入を停止しました。");
  };

  // 自動購入の状態を切り替え
  UpgradeAutobuyer.toggle = function () {
    UpgradeAutobuyer.isRunning ? UpgradeAutobuyer.stop() : UpgradeAutobuyer.start();
  };

  // Cookie Monster設定に統合する
  UpgradeAutobuyer.injectSettings = function () {
    if (!CM || !CM.Disp || !CM.Disp.UpdateSettings) {
      console.log("[CM-UA] Cookie Monsterが見つかりません。設定を統合できません。");
      return;
    }

    // メイン設定オブジェクトを作成
    CM.ConfigData[this.settingName] = {
      label: "UpgradeAutobuyer",
      desc: "アップグレードの自動購入を有効化（PP最短を自動購入）",
      settings: ["オフ", "オン"],
      toggle: true,
      default: 0,
    };

    // 除外設定を追加
    CM.ConfigData[this.excludeSettingPrefix + "Switches"] = {
      label: "   スイッチ除外",
      desc: "Golden/Shimmering Switch などのスイッチ系アップグレードを自動購入から除外",
      settings: ["オフ", "オン"],
      toggle: true,
      default: 1,
    };

    CM.ConfigData[this.excludeSettingPrefix + "Research"] = {
      label: "   研究除外",
      desc: "研究アップグレード（負の効果を持つ可能性あり）を自動購入から除外",
      settings: ["オフ", "オン"],
      toggle: true,
      default: 0,
    };

    CM.ConfigData[this.excludeSettingPrefix + "Covenants"] = {
      label: "   契約除外",
      desc: "Elder Covenant などの契約系アップグレードを自動購入から除外",
      settings: ["オフ", "オン"],
      toggle: true,
      default: 1,
    };

    // デフォルト値を設定
    if (CM.Config[this.settingName] === undefined) {
      CM.Config[this.settingName] = 0;
    }
    if (CM.Config[this.excludeSettingPrefix + "Switches"] === undefined) {
      CM.Config[this.excludeSettingPrefix + "Switches"] = 1;
    }
    if (CM.Config[this.excludeSettingPrefix + "Research"] === undefined) {
      CM.Config[this.excludeSettingPrefix + "Research"] = 0;
    }
    if (CM.Config[this.excludeSettingPrefix + "Covenants"] === undefined) {
      CM.Config[this.excludeSettingPrefix + "Covenants"] = 1;
    }

    // 設定変更時のイベントハンドラを追加
    CM.Callback[this.settingName] = function () {
      if (CM.Config[UpgradeAutobuyer.settingName] === 1) {
        UpgradeAutobuyer.start();
      } else {
        UpgradeAutobuyer.stop();
      }
    };

    // 除外設定の変更時のイベントハンドラ
    CM.Callback[this.excludeSettingPrefix + "Switches"] = function () {
      UpgradeAutobuyer.excludeSwitches = CM.Config[UpgradeAutobuyer.excludeSettingPrefix + "Switches"] === 1;
    };
    CM.Callback[this.excludeSettingPrefix + "Research"] = function () {
      UpgradeAutobuyer.excludeResearch = CM.Config[UpgradeAutobuyer.excludeSettingPrefix + "Research"] === 1;
    };
    CM.Callback[this.excludeSettingPrefix + "Covenants"] = function () {
      UpgradeAutobuyer.excludeCovenants = CM.Config[UpgradeAutobuyer.excludeSettingPrefix + "Covenants"] === 1;
    };

    // 設定画面を更新するため
    if (typeof CM.Disp.AddMenuPref === "function") {
      CM.Disp.AddMenuPref("自動購入", this.settingName);
      CM.Disp.AddMenuPref("自動購入", this.excludeSettingPrefix + "Switches");
      CM.Disp.AddMenuPref("自動購入", this.excludeSettingPrefix + "Research");
      CM.Disp.AddMenuPref("自動購入", this.excludeSettingPrefix + "Covenants");
    }

    // 現在の設定を適用
    UpgradeAutobuyer.excludeSwitches = CM.Config[UpgradeAutobuyer.excludeSettingPrefix + "Switches"] === 1;
    UpgradeAutobuyer.excludeResearch = CM.Config[UpgradeAutobuyer.excludeSettingPrefix + "Research"] === 1;
    UpgradeAutobuyer.excludeCovenants = CM.Config[UpgradeAutobuyer.excludeSettingPrefix + "Covenants"] === 1;

    console.log("[CM-UA] Cookie Monster設定に統合しました");
  };

  // Cookie Monsterがロード済みか確認して設定を統合
  UpgradeAutobuyer.init = function () {
    if (typeof CM !== "undefined" && CM.Loaded) {
      this.injectSettings();
    } else {
      // Cookie Monsterがロードされるのを待つ
      const checkCMLoaded = setInterval(function () {
        if (typeof CM !== "undefined" && CM.Loaded) {
          clearInterval(checkCMLoaded);
          UpgradeAutobuyer.injectSettings();
        }
      }, 1000);
    }
  };

  // 初期化時のメッセージ
  console.log("Cookie Monster - アップグレード自動購入 (CM-UpgradeAutobuyer) が読み込まれました。");
  console.log("使用方法: CMUpgradeAutobuyer.start() で開始、CMUpgradeAutobuyer.stop() で停止");
  Game.Notify("CM-UpgradeAutobuyer", "アップグレード自動購入スクリプトが読み込まれました", [4, 6], 5);

  // 初期化を実行
  setTimeout(UpgradeAutobuyer.init, 1000);

  // スクリプトの最後に追加
  if (typeof Game !== "undefined" && Game.ready) {
    // ゲームが読み込まれている場合は直接初期化
    CMUpgradeAutobuyer.init();
  } else {
    // ゲームのロードを待つ
    const loadHook = setInterval(function () {
      if (typeof Game !== "undefined" && Game.ready) {
        clearInterval(loadHook);
        CMUpgradeAutobuyer.init();
      }
    }, 1000);
  }

  // モッドAPIのフック追加
  if (typeof Game !== "undefined") {
    Game.registerMod("CMUpgradeAutobuyer", {
      init: function () {
        CMUpgradeAutobuyer.init();
        return true;
      },
    });
  }
})(CMUpgradeAutobuyer);

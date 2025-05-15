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

  // ゲーム設定メニューの追加
  UpgradeAutobuyer.getSettingsOptions = function () {
    return {
      AutoBuyerEnabled: {
        label: ["オフ", "オン"],
        desc: "アップグレード自動購入の有効/無効設定",
        type: "bool",
        toggle: true,
        func: function () {
          if (Game.mods.cookieMonsterFramework.saveData.cmUpgradeAutobuyer.settings.AutoBuyerEnabled === 1) {
            UpgradeAutobuyer.start();
          } else {
            UpgradeAutobuyer.stop();
          }
        },
      },
      ExcludeSwitches: {
        label: ["オフ", "オン"],
        desc: "スイッチ系アップグレードを除外（Golden Switch, Shimmering Veil など）",
        type: "bool",
        toggle: true,
        func: function () {
          UpgradeAutobuyer.excludeSwitches = Game.mods.cookieMonsterFramework.saveData.cmUpgradeAutobuyer.settings.ExcludeSwitches === 1;
          Game.Notify("アップグレード自動購入", `スイッチ系除外を${UpgradeAutobuyer.excludeSwitches ? "オン" : "オフ"}にしました`, [16, 5], 3);
        },
      },
      ExcludeResearch: {
        label: ["オフ", "オン"],
        desc: "研究アップグレードを除外（グランマポカリプス関連）",
        type: "bool",
        toggle: true,
        func: function () {
          UpgradeAutobuyer.excludeResearch = Game.mods.cookieMonsterFramework.saveData.cmUpgradeAutobuyer.settings.ExcludeResearch === 1;
          Game.Notify("アップグレード自動購入", `研究除外を${UpgradeAutobuyer.excludeResearch ? "オン" : "オフ"}にしました`, [16, 5], 3);
        },
      },
      ExcludeCovenants: {
        label: ["オフ", "オン"],
        desc: "契約系アップグレードを除外（Elder Covenant, Revoke Elder Covenant など）",
        type: "bool",
        toggle: true,
        func: function () {
          UpgradeAutobuyer.excludeCovenants = Game.mods.cookieMonsterFramework.saveData.cmUpgradeAutobuyer.settings.ExcludeCovenants === 1;
          Game.Notify("アップグレード自動購入", `契約系除外を${UpgradeAutobuyer.excludeCovenants ? "オン" : "オフ"}にしました`, [16, 5], 3);
        },
      },
    };
  };

  // 設定ヘッダーの作成
  UpgradeAutobuyer.setupMenu = function () {
    // CookieMonsterフレームワークがロードされているか確認
    if (!Game.mods.cookieMonsterFramework) return;

    // アップグレード自動購入のセクションを作成
    if (!Game.mods.cookieMonsterFramework.saveData.cmUpgradeAutobuyer) {
      Game.mods.cookieMonsterFramework.saveData.cmUpgradeAutobuyer = {
        headers: { UpgradeAutobuyer: 1 },
        settings: {
          AutoBuyerEnabled: UpgradeAutobuyer.isRunning ? 1 : 0,
          ExcludeSwitches: UpgradeAutobuyer.excludeSwitches ? 1 : 0,
          ExcludeResearch: UpgradeAutobuyer.excludeResearch ? 1 : 0,
          ExcludeCovenants: UpgradeAutobuyer.excludeCovenants ? 1 : 0,
        },
      };
    }

    // メニューリスナーに登録
    if (Game.mods.cookieMonsterFramework.listeners.optionsMenu) {
      for (let i = 0; i < Game.mods.cookieMonsterFramework.listeners.optionsMenu.length; i++) {
        if (Game.mods.cookieMonsterFramework.listeners.optionsMenu[i].sectionId === "cmUpgradeAutobuyer") return;
      }

      Game.mods.cookieMonsterFramework.listeners.optionsMenu.push({
        sectionId: "cmUpgradeAutobuyer",
        header: "アップグレード自動購入",
        subHeader: { UpgradeAutobuyer: "アップグレード自動購入設定" },
        options: UpgradeAutobuyer.getSettingsOptions(),
      });
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

    // 設定に反映
    if (Game.mods.cookieMonsterFramework?.saveData?.cmUpgradeAutobuyer?.settings) {
      Game.mods.cookieMonsterFramework.saveData.cmUpgradeAutobuyer.settings.AutoBuyerEnabled = 1;
    }

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

    // 設定に反映
    if (Game.mods.cookieMonsterFramework?.saveData?.cmUpgradeAutobuyer?.settings) {
      Game.mods.cookieMonsterFramework.saveData.cmUpgradeAutobuyer.settings.AutoBuyerEnabled = 0;
    }

    Game.Notify("アップグレード自動購入", "自動購入を停止しました", [17, 5], 1);
    this.log("アップグレード自動購入を停止しました。");
  };

  // 自動購入の状態を切り替え
  UpgradeAutobuyer.toggle = function () {
    UpgradeAutobuyer.isRunning ? UpgradeAutobuyer.stop() : UpgradeAutobuyer.start();
  };

  // 初期化処理
  UpgradeAutobuyer.init = function () {
    // 設定をCookieClickerメニューに追加
    if (Game && Game.ready) {
      this.setupMenu();
    } else {
      const checkGameLoaded = setInterval(function () {
        if (Game && Game.ready) {
          clearInterval(checkGameLoaded);
          UpgradeAutobuyer.setupMenu();
        }
      }, 1000);
    }

    // CookieMonsterフレームワークが後でロードされる場合に備えて監視
    const checkCMFramework = setInterval(function () {
      if (Game?.mods?.cookieMonsterFramework) {
        clearInterval(checkCMFramework);
        UpgradeAutobuyer.setupMenu();

        // 設定から初期状態を読み込む
        if (Game.mods.cookieMonsterFramework.saveData?.cmUpgradeAutobuyer?.settings) {
          const settings = Game.mods.cookieMonsterFramework.saveData.cmUpgradeAutobuyer.settings;

          if (settings.AutoBuyerEnabled === 1 && !UpgradeAutobuyer.isRunning) {
            UpgradeAutobuyer.start();
          }

          if (settings.ExcludeSwitches !== undefined) {
            UpgradeAutobuyer.excludeSwitches = settings.ExcludeSwitches === 1;
          }

          if (settings.ExcludeResearch !== undefined) {
            UpgradeAutobuyer.excludeResearch = settings.ExcludeResearch === 1;
          }

          if (settings.ExcludeCovenants !== undefined) {
            UpgradeAutobuyer.excludeCovenants = settings.ExcludeCovenants === 1;
          }
        }
      }
    }, 1000);
  };

  // 初期化時のメッセージ
  console.log("Cookie Monster - アップグレード自動購入 (CM-UpgradeAutobuyer) が読み込まれました。");
  console.log("使用方法: CMUpgradeAutobuyer.start() で開始、CMUpgradeAutobuyer.stop() で停止");
  console.log("オプションメニューから設定できます");
  Game.Notify("CM-UpgradeAutobuyer", "アップグレード自動購入スクリプトが読み込まれました", [4, 6], 5);

  // 初期化を実行
  setTimeout(UpgradeAutobuyer.init, 1000);

  // モッドAPIのフック追加
  if (typeof Game !== "undefined") {
    Game.registerMod("CMUpgradeAutobuyer", {
      init: function () {
        UpgradeAutobuyer.init();
        return true;
      },
    });
  }
})(CMUpgradeAutobuyer);

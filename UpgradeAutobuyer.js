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

  // Game.prefsにデフォルト設定を追加
  UpgradeAutobuyer.setupPrefs = function () {
    // すでに設定があれば何もしない
    if (Game.prefs.UpgradeAutobuyer !== undefined) return;

    // デフォルト設定を追加
    Game.prefs.UpgradeAutobuyer = 0;
    Game.prefs.UpgradeExcludeSwitches = 1;
    Game.prefs.UpgradeExcludeResearch = 0;
    Game.prefs.UpgradeExcludeCovenants = 1;
  };

  // 設定メニューにオプションを追加
  UpgradeAutobuyer.addOptionsMenu = function () {
    // メニュー追加は BuildingAutobuyer.js で一括して行うため、
    // このモジュールでは何もしない（UpgradeAutobuyerの設定も一緒に追加される）
    // 単独で動作する場合のみ、BuildingAutobuyerのメニュー関数を使用
    if (!window.CMBuildingAutobuyer) {
      // 元のGame.Drawメソッドをバックアップ
      if (!Game.Backup_DrawMenu) {
        Game.Backup_DrawMenu = Game.DrawMenu;
      }

      // メニュー描画関数をオーバーライド
      Game.DrawMenu = function () {
        // 元の描画関数を呼び出す
        Game.Backup_DrawMenu();

        // 設定画面のときのみ
        if (Game.onMenu === "prefs") {
          const menu = l("menu");
          let prefsSection = menu.querySelector(".section");

          // もし元の設定セクションが見つからなければ、何もしない
          if (!prefsSection) return;

          // 既存のセクションを探す
          let cmSection = menu.querySelector(".section-cmAutobuyer");

          // まだCM Autobuyerセクションがなければ作成
          if (!cmSection) {
            cmSection = document.createElement("div");
            cmSection.className = "section section-cmAutobuyer";

            // タイトルを追加
            const title = document.createElement("div");
            title.className = "title";
            title.textContent = "Cookie Monster Autobuyer";
            cmSection.appendChild(title);

            // アップグレード自動購入設定
            const listing1 = document.createElement("div");
            listing1.className = "listing";

            const upgradeAutoLabel = document.createElement("a");
            upgradeAutoLabel.className = "option" + (Game.prefs.UpgradeAutobuyer ? "" : " off");
            upgradeAutoLabel.textContent = Game.prefs.UpgradeAutobuyer ? "オン" : "オフ";
            upgradeAutoLabel.onclick = function () {
              Game.Toggle("UpgradeAutobuyer", "upgradeAutoLabel", ["オフ", "オン"], function () {
                if (Game.prefs.UpgradeAutobuyer) {
                  UpgradeAutobuyer.start();
                } else {
                  UpgradeAutobuyer.stop();
                }
              });
            };

            listing1.appendChild(upgradeAutoLabel);
            listing1.appendChild(document.createTextNode(" アップグレード自動購入：PP最短のアップグレードを自動的に購入"));
            cmSection.appendChild(listing1);

            // スイッチ系除外設定
            const listing2 = document.createElement("div");
            listing2.className = "listing";

            const switchesLabel = document.createElement("a");
            switchesLabel.className = "option" + (Game.prefs.UpgradeExcludeSwitches ? "" : " off");
            switchesLabel.textContent = Game.prefs.UpgradeExcludeSwitches ? "オン" : "オフ";
            switchesLabel.onclick = function () {
              Game.Toggle("UpgradeExcludeSwitches", "switchesLabel", ["オフ", "オン"], function () {
                UpgradeAutobuyer.excludeSwitches = Game.prefs.UpgradeExcludeSwitches;
              });
            };

            listing2.appendChild(switchesLabel);
            listing2.appendChild(document.createTextNode(" スイッチ系除外：Golden Switch/Shimmering Veil などを除外"));
            cmSection.appendChild(listing2);

            // 研究除外設定
            const listing3 = document.createElement("div");
            listing3.className = "listing";

            const researchLabel = document.createElement("a");
            researchLabel.className = "option" + (Game.prefs.UpgradeExcludeResearch ? "" : " off");
            researchLabel.textContent = Game.prefs.UpgradeExcludeResearch ? "オン" : "オフ";
            researchLabel.onclick = function () {
              Game.Toggle("UpgradeExcludeResearch", "researchLabel", ["オフ", "オン"], function () {
                UpgradeAutobuyer.excludeResearch = Game.prefs.UpgradeExcludeResearch;
              });
            };

            listing3.appendChild(researchLabel);
            listing3.appendChild(document.createTextNode(" 研究除外：負の効果を持つ可能性のある研究アップグレードを除外"));
            cmSection.appendChild(listing3);

            // 契約系除外設定
            const listing4 = document.createElement("div");
            listing4.className = "listing";

            const covenantsLabel = document.createElement("a");
            covenantsLabel.className = "option" + (Game.prefs.UpgradeExcludeCovenants ? "" : " off");
            covenantsLabel.textContent = Game.prefs.UpgradeExcludeCovenants ? "オン" : "オフ";
            covenantsLabel.onclick = function () {
              Game.Toggle("UpgradeExcludeCovenants", "covenantsLabel", ["オフ", "オン"], function () {
                UpgradeAutobuyer.excludeCovenants = Game.prefs.UpgradeExcludeCovenants;
              });
            };

            listing4.appendChild(covenantsLabel);
            listing4.appendChild(document.createTextNode(" 契約系除外：Elder Covenantなどの契約系アップグレードを除外"));
            cmSection.appendChild(listing4);

            // メニューに追加
            prefsSection.parentNode.insertBefore(cmSection, prefsSection.nextSibling);
          }
        }
      };
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
    // Game.prefsに設定
    Game.prefs.UpgradeAutobuyer = 1;
    UpgradeAutobuyer.timerId = setInterval(UpgradeAutobuyer.check, UpgradeAutobuyer.interval);
    Game.Notify("アップグレード自動購入", "PP最短のアップグレードを自動的に購入します", [16, 5], 1);
    this.log("アップグレード自動購入を開始しました。");
    setTimeout(UpgradeAutobuyer.check, UpgradeAutobuyer.interval);

    // 現在オプション画面を表示中なら更新
    if (Game.onMenu === "prefs") {
      Game.UpdateMenu();
    }
  };

  // 自動購入を停止
  UpgradeAutobuyer.stop = function () {
    if (!UpgradeAutobuyer.isRunning) {
      this.log("アップグレード自動購入は実行されていません。");
      return;
    }
    UpgradeAutobuyer.isRunning = false;
    // Game.prefsに設定
    Game.prefs.UpgradeAutobuyer = 0;
    if (UpgradeAutobuyer.timerId) {
      clearInterval(UpgradeAutobuyer.timerId);
      UpgradeAutobuyer.timerId = null;
    }
    Game.Notify("アップグレード自動購入", "自動購入を停止しました", [17, 5], 1);
    this.log("アップグレード自動購入を停止しました。");

    // 現在オプション画面を表示中なら更新
    if (Game.onMenu === "prefs") {
      Game.UpdateMenu();
    }
  };

  // 自動購入の状態を切り替え
  UpgradeAutobuyer.toggle = function () {
    UpgradeAutobuyer.isRunning ? UpgradeAutobuyer.stop() : UpgradeAutobuyer.start();
  };

  // 初期化処理
  UpgradeAutobuyer.init = function () {
    // Game.prefsに設定を追加
    UpgradeAutobuyer.setupPrefs();

    // オプションメニューに設定を追加
    UpgradeAutobuyer.addOptionsMenu();

    // 既存の設定から状態を復元
    if (Game.prefs.UpgradeAutobuyer) {
      UpgradeAutobuyer.start();
    }

    // 除外設定を復元
    UpgradeAutobuyer.excludeSwitches = !!Game.prefs.UpgradeExcludeSwitches;
    UpgradeAutobuyer.excludeResearch = !!Game.prefs.UpgradeExcludeResearch;
    UpgradeAutobuyer.excludeCovenants = !!Game.prefs.UpgradeExcludeCovenants;

    // メニューを更新
    Game.UpdateMenu();
  };

  // 初期化時のメッセージ
  console.log("Cookie Monster - アップグレード自動購入 (CM-UpgradeAutobuyer) が読み込まれました。");
  console.log("使用方法: CMUpgradeAutobuyer.start() で開始、CMUpgradeAutobuyer.stop() で停止");
  console.log("設定はCookie Clickerのオプション画面から変更できます");
  Game.Notify("CM-UpgradeAutobuyer", "アップグレード自動購入スクリプトが読み込まれました", [4, 6], 5);

  // 初期化を実行（Game.ready後に行う）
  if (Game && Game.ready) {
    UpgradeAutobuyer.init();
  } else {
    const checkGameLoaded = setInterval(function () {
      if (Game && Game.ready) {
        clearInterval(checkGameLoaded);
        UpgradeAutobuyer.init();
      }
    }, 1000);
  }

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

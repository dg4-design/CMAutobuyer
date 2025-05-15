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

  // CookieClickerのゲーム設定に直接追加
  UpgradeAutobuyer.injectIntoOptions = function () {
    // 既に追加済みかチェック
    if (Game.customOptionsMenu && Game.customOptionsMenu.indexOf("CMUpgradeAutobuyer") !== -1) return;

    // 現在のオプションメニュー関数をバックアップ
    if (!Game.customOptionsMenu) {
      Game.customOptionsMenu = [];
      UpgradeAutobuyer.originalUpdateMenu = Game.UpdateMenu;

      // Game.UpdateMenu関数をオーバーライド
      Game.UpdateMenu = function () {
        // 元のメニュー更新関数を実行
        UpgradeAutobuyer.originalUpdateMenu();

        // 現在のメニューがオプションメニューであれば、カスタムオプションを追加
        if (Game.onMenu === "prefs") {
          // すべてのカスタムオプションメニュー処理を実行
          Game.customOptionsMenu.forEach(function (customMenuCallback) {
            if (typeof window[customMenuCallback] === "function") {
              window[customMenuCallback]();
            }
          });
        }
      };
    }

    // カスタムメニューに登録
    if (Game.customOptionsMenu.indexOf("CMUpgradeAutobuyer.addOptionsMenu") === -1) {
      Game.customOptionsMenu.push("CMUpgradeAutobuyer.addOptionsMenu");
    }
  };

  // オプションメニューに設定項目を追加
  UpgradeAutobuyer.addOptionsMenu = function () {
    console.log("[UpgradeAutobuyer] addOptionsMenu called");

    const optionsMenu = l("menu");
    console.log("[UpgradeAutobuyer] optionsMenu:", optionsMenu);

    if (!optionsMenu) {
      console.error("[UpgradeAutobuyer] メニュー要素が見つかりません");
      return;
    }

    // CookieClickerの設定セクションを特定
    let subMenu = l("preferenceTableBodies");

    // 通常の要素が見つからない場合、セクション要素を探す
    if (!subMenu) {
      console.log("[UpgradeAutobuyer] preferenceTableBodies not found, looking for .section");
      const sections = optionsMenu.querySelectorAll(".section");
      if (sections && sections.length > 0) {
        subMenu = sections[0];
        console.log("[UpgradeAutobuyer] Using first .section element instead");
      }
    }

    if (!subMenu) {
      console.error("[UpgradeAutobuyer] 設定を追加する要素が見つかりませんでした");
      return;
    }

    console.log("[UpgradeAutobuyer] Menu elements found");

    // 既に追加済みセクションがあれば削除
    const existingSection = l("CMUpgradeAutobuyerOptions");
    if (existingSection) {
      console.log("[UpgradeAutobuyer] Removing existing section");
      existingSection.remove();
    }

    // 新しいセクションを作成
    const newSection = document.createElement("div");
    newSection.id = "CMUpgradeAutobuyerOptions";
    newSection.className = "subsection";
    newSection.style.padding = "0px";
    newSection.style.margin = "8px 4px";

    // セクションのタイトル
    const sectionTitle = document.createElement("div");
    sectionTitle.className = "title";
    sectionTitle.textContent = "アップグレード自動購入";
    newSection.appendChild(sectionTitle);

    // オプションテーブル
    const optionsTable = document.createElement("div");
    optionsTable.className = "listing";

    // 自動購入のオン/オフ設定
    const enabledRow = UpgradeAutobuyer.createPreferenceRow("自動購入", "CMUpgradeAutobuyerEnabled", UpgradeAutobuyer.isRunning ? "ON" : "OFF", "アップグレードの自動購入を有効/無効にします");

    enabledRow.querySelector("a.option").onclick = function () {
      UpgradeAutobuyer.toggle();
      this.textContent = UpgradeAutobuyer.isRunning ? "ON" : "OFF";
      this.className = "option" + (UpgradeAutobuyer.isRunning ? "" : " off");
      return false;
    };
    optionsTable.appendChild(enabledRow);

    // スイッチ系除外設定
    const switchesRow = UpgradeAutobuyer.createPreferenceRow(
      "スイッチ系除外",
      "CMUpgradeAutobuyerSwitches",
      UpgradeAutobuyer.excludeSwitches ? "ON" : "OFF",
      "Golden Switch や Shimmering Veil などのスイッチ系アップグレードを自動購入から除外します"
    );

    switchesRow.querySelector("a.option").onclick = function () {
      UpgradeAutobuyer.excludeSwitches = !UpgradeAutobuyer.excludeSwitches;
      this.textContent = UpgradeAutobuyer.excludeSwitches ? "ON" : "OFF";
      this.className = "option" + (UpgradeAutobuyer.excludeSwitches ? "" : " off");

      // 設定に反映
      if (Game.mods.cookieMonsterFramework?.saveData?.cmUpgradeAutobuyer?.settings) {
        Game.mods.cookieMonsterFramework.saveData.cmUpgradeAutobuyer.settings.ExcludeSwitches = UpgradeAutobuyer.excludeSwitches ? 1 : 0;
      }

      Game.Notify("アップグレード自動購入", `スイッチ系除外を${UpgradeAutobuyer.excludeSwitches ? "オン" : "オフ"}にしました`, [16, 5], 3);
      return false;
    };
    optionsTable.appendChild(switchesRow);

    // 研究除外設定
    const researchRow = UpgradeAutobuyer.createPreferenceRow(
      "研究除外",
      "CMUpgradeAutobuyerResearch",
      UpgradeAutobuyer.excludeResearch ? "ON" : "OFF",
      "グランマポカリプス関連の研究アップグレードを自動購入から除外します"
    );

    researchRow.querySelector("a.option").onclick = function () {
      UpgradeAutobuyer.excludeResearch = !UpgradeAutobuyer.excludeResearch;
      this.textContent = UpgradeAutobuyer.excludeResearch ? "ON" : "OFF";
      this.className = "option" + (UpgradeAutobuyer.excludeResearch ? "" : " off");

      // 設定に反映
      if (Game.mods.cookieMonsterFramework?.saveData?.cmUpgradeAutobuyer?.settings) {
        Game.mods.cookieMonsterFramework.saveData.cmUpgradeAutobuyer.settings.ExcludeResearch = UpgradeAutobuyer.excludeResearch ? 1 : 0;
      }

      Game.Notify("アップグレード自動購入", `研究除外を${UpgradeAutobuyer.excludeResearch ? "オン" : "オフ"}にしました`, [16, 5], 3);
      return false;
    };
    optionsTable.appendChild(researchRow);

    // 契約系除外設定
    const covenantsRow = UpgradeAutobuyer.createPreferenceRow(
      "契約系除外",
      "CMUpgradeAutobuyerCovenants",
      UpgradeAutobuyer.excludeCovenants ? "ON" : "OFF",
      "Elder Covenant などの契約系アップグレードを自動購入から除外します"
    );

    covenantsRow.querySelector("a.option").onclick = function () {
      UpgradeAutobuyer.excludeCovenants = !UpgradeAutobuyer.excludeCovenants;
      this.textContent = UpgradeAutobuyer.excludeCovenants ? "ON" : "OFF";
      this.className = "option" + (UpgradeAutobuyer.excludeCovenants ? "" : " off");

      // 設定に反映
      if (Game.mods.cookieMonsterFramework?.saveData?.cmUpgradeAutobuyer?.settings) {
        Game.mods.cookieMonsterFramework.saveData.cmUpgradeAutobuyer.settings.ExcludeCovenants = UpgradeAutobuyer.excludeCovenants ? 1 : 0;
      }

      Game.Notify("アップグレード自動購入", `契約系除外を${UpgradeAutobuyer.excludeCovenants ? "オン" : "オフ"}にしました`, [16, 5], 3);
      return false;
    };
    optionsTable.appendChild(covenantsRow);

    newSection.appendChild(optionsTable);

    // オプションメニューに追加
    console.log("[UpgradeAutobuyer] Appending new section to menu");
    subMenu.appendChild(newSection);
    console.log("[UpgradeAutobuyer] Section added successfully");
  };

  // 設定行を作成するヘルパー関数
  UpgradeAutobuyer.createPreferenceRow = function (name, id, value, description) {
    const row = document.createElement("div");
    row.className = "listing";

    // オプション名
    const nameSpan = document.createElement("span");
    nameSpan.className = "name";
    nameSpan.textContent = name;
    row.appendChild(nameSpan);

    // オプション値
    const valueLink = document.createElement("a");
    valueLink.id = id;
    valueLink.className = "option" + (value === "OFF" ? " off" : "");
    valueLink.textContent = value;
    row.appendChild(valueLink);

    // 説明
    if (description) {
      const descDiv = document.createElement("div");
      descDiv.className = "description";
      descDiv.textContent = description;
      row.appendChild(descDiv);
    }

    return row;
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
          if (Game.mods.cookieMonsterFramework?.saveData?.cmUpgradeAutobuyer?.settings?.AutoBuyerEnabled === 1) {
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
          UpgradeAutobuyer.excludeSwitches = Game.mods.cookieMonsterFramework?.saveData?.cmUpgradeAutobuyer?.settings?.ExcludeSwitches === 1;
          Game.Notify("アップグレード自動購入", `スイッチ系除外を${UpgradeAutobuyer.excludeSwitches ? "オン" : "オフ"}にしました`, [16, 5], 3);
        },
      },
      ExcludeResearch: {
        label: ["オフ", "オン"],
        desc: "研究アップグレードを除外（グランマポカリプス関連）",
        type: "bool",
        toggle: true,
        func: function () {
          UpgradeAutobuyer.excludeResearch = Game.mods.cookieMonsterFramework?.saveData?.cmUpgradeAutobuyer?.settings?.ExcludeResearch === 1;
          Game.Notify("アップグレード自動購入", `研究除外を${UpgradeAutobuyer.excludeResearch ? "オン" : "オフ"}にしました`, [16, 5], 3);
        },
      },
      ExcludeCovenants: {
        label: ["オフ", "オン"],
        desc: "契約系アップグレードを除外（Elder Covenant, Revoke Elder Covenant など）",
        type: "bool",
        toggle: true,
        func: function () {
          UpgradeAutobuyer.excludeCovenants = Game.mods.cookieMonsterFramework?.saveData?.cmUpgradeAutobuyer?.settings?.ExcludeCovenants === 1;
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

    // 設定UIを更新
    const enableButton = l("CMUpgradeAutobuyerEnabled");
    if (enableButton) {
      enableButton.textContent = "ON";
      enableButton.className = "option";
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

    // 設定UIを更新
    const enableButton = l("CMUpgradeAutobuyerEnabled");
    if (enableButton) {
      enableButton.textContent = "OFF";
      enableButton.className = "option off";
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
    console.log("[UpgradeAutobuyer] init called");

    // CookieClickerが存在するか確認
    if (typeof Game === "undefined") {
      console.error("[UpgradeAutobuyer] Game is not defined, CookieClicker might not be loaded");
      return;
    }

    // l関数が存在するか確認
    if (typeof l !== "function") {
      console.error("[UpgradeAutobuyer] l function is not defined, CookieClicker DOM utilities might not be loaded");
      console.log("[UpgradeAutobuyer] Attempting to define l function");
      window.l = function (id) {
        return document.getElementById(id);
      };
    } else {
      console.log("[UpgradeAutobuyer] l function exists");
    }

    // 重複初期化チェック
    if (Game.customOptionsMenu && Game.customOptionsMenu.indexOf("UpgradeAutobuyer.addOptionsMenu") !== -1) {
      console.log("[UpgradeAutobuyer] Already initialized, skipping");
      return;
    }

    // 現在のオプションメニュー関数をバックアップ
    if (!Game.customOptionsMenu) {
      console.log("[UpgradeAutobuyer] Initializing Game.customOptionsMenu");
      Game.customOptionsMenu = [];
      UpgradeAutobuyer.originalUpdateMenu = Game.UpdateMenu;

      // Game.UpdateMenu関数をオーバーライド
      Game.UpdateMenu = function () {
        console.log("[UpgradeAutobuyer] Custom UpdateMenu called");

        // 元のメニュー更新関数を実行
        UpgradeAutobuyer.originalUpdateMenu();

        console.log("[UpgradeAutobuyer] Current menu:", Game.onMenu);
        console.log("[UpgradeAutobuyer] customOptionsMenu:", Game.customOptionsMenu);

        // 現在のメニューがオプションメニューであれば、カスタムオプションを追加
        if (Game.onMenu === "prefs") {
          console.log("[UpgradeAutobuyer] On prefs menu, adding custom options");
          // すべてのカスタムオプションメニュー処理を実行
          Game.customOptionsMenu.forEach(function (customMenuCallback) {
            console.log(`[UpgradeAutobuyer] Executing custom menu callback: ${customMenuCallback}`);

            // 文字列からオブジェクトと関数を取得
            const parts = customMenuCallback.split(".");
            let obj = window;
            let funcName = customMenuCallback;

            if (parts.length > 1) {
              obj = window[parts[0]];
              funcName = parts[1];
            }

            console.log(`[UpgradeAutobuyer] Resolving callback: object=${parts[0]}, function=${funcName}`, obj);

            if (obj && typeof obj[funcName] === "function") {
              try {
                obj[funcName]();
              } catch (e) {
                console.error(`Error in custom menu callback ${customMenuCallback}:`, e);
              }
            } else {
              console.warn(`[UpgradeAutobuyer] Warning: ${customMenuCallback} is not a properly resolved function`);
              console.log(
                "Available window functions:",
                Object.keys(window)
                  .filter((key) => typeof window[key] === "function")
                  .slice(0, 20)
              );

              if (parts[0] === "UpgradeAutobuyer") {
                console.log("UpgradeAutobuyer properties:", Object.keys(UpgradeAutobuyer));
                console.log("addOptionsMenu exists on UpgradeAutobuyer:", typeof UpgradeAutobuyer.addOptionsMenu === "function");
              }
            }
          });
        } else {
          console.log(`[UpgradeAutobuyer] Current menu is not prefs but: ${Game.onMenu}`);
        }
      };
    } else {
      console.log("[UpgradeAutobuyer] Game.customOptionsMenu already exists:", Game.customOptionsMenu);
    }

    // カスタムメニューに登録
    const callbackName = "UpgradeAutobuyer.addOptionsMenu";
    if (Game.customOptionsMenu.indexOf(callbackName) === -1) {
      console.log(`[UpgradeAutobuyer] Registering ${callbackName}`);
      Game.customOptionsMenu.push(callbackName);
    } else {
      console.log(`[UpgradeAutobuyer] ${callbackName} already registered`);
    }

    // メニュー更新の手動トリガー
    console.log(`[UpgradeAutobuyer] Current menu state: ${Game.onMenu}`);
    if (Game.onMenu === "prefs") {
      console.log("[UpgradeAutobuyer] Currently on prefs menu, calling addOptionsMenu directly");
      UpgradeAutobuyer.addOptionsMenu();
    } else {
      console.log("[UpgradeAutobuyer] Not on prefs menu, trying to open Options menu");
      try {
        // ゲームのOption APIが利用可能ならそれを使う
        if (typeof Game.ShowMenu === "function") {
          Game.ShowMenu("prefs");
          console.log("[UpgradeAutobuyer] Opened prefs menu via Game.ShowMenu");
        }
      } catch (e) {
        console.error("[UpgradeAutobuyer] Error opening menu:", e);
      }
    }

    // グローバルWindowオブジェクトに関数を追加
    if (typeof window.UpgradeAutobuyer === "undefined") {
      console.log("[UpgradeAutobuyer] Adding UpgradeAutobuyer to window object");
      window.UpgradeAutobuyer = UpgradeAutobuyer;
    }

    // メニュー要素を定期的にチェック
    setTimeout(function () {
      console.log("[UpgradeAutobuyer] Delayed check for menu elements");
      console.log("menu element:", document.getElementById("menu"));
      console.log("preferenceTableBodies:", document.getElementById("preferenceTableBodies"));

      if (document.getElementById("menu") && !document.getElementById("preferenceTableBodies")) {
        console.log("[UpgradeAutobuyer] Menu exists but preferenceTableBodies not found, investigating structure");
        const menuElement = document.getElementById("menu");
        console.log(
          "Menu children:",
          Array.from(menuElement.children).map((el) => el.id || el.className || el.tagName)
        );

        // セクションの構造を確認
        const sections = menuElement.querySelectorAll(".section");
        console.log("Section count:", sections.length);
        sections.forEach((section, i) => {
          console.log(`Section ${i}:`, section.id || section.className);
          console.log(
            `Section ${i} children:`,
            Array.from(section.children).map((el) => el.id || el.className || el.tagName)
          );
        });

        // 既存の設定要素の構造を調査
        const subsections = menuElement.querySelectorAll(".subsection");
        console.log("Subsection count:", subsections.length);
        if (subsections.length > 0) {
          console.log("First subsection:", subsections[0].id || subsections[0].className);
          console.log(
            "First subsection children:",
            Array.from(subsections[0].children).map((el) => el.id || el.className || el.tagName)
          );

          // 実際の設定が追加されている場所を特定
          if (subsections[0].querySelector(".listing")) {
            console.log("Found .listing element, this might be where settings should go");
            const listingParent = subsections[0].querySelector(".listing").parentNode;
            console.log("Listing parent:", listingParent.id || listingParent.className || listingParent.tagName);

            // セクションが追加されるべき場所を検出
            UpgradeAutobuyer.targetMenuElement = listingParent;
            console.log("Set targetMenuElement for future use");
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

        // メニュー更新が確実に行われるように、Game.ShowMenuをオーバーライド
        // (BuildingAutobuyerですでに設定されている場合は上書きしない)
        if (!window.BuildingAutobuyer?.originalShowMenu && !UpgradeAutobuyer.originalShowMenu && Game.ShowMenu) {
          UpgradeAutobuyer.originalShowMenu = Game.ShowMenu;

          Game.ShowMenu = function (what) {
            // 元の関数を呼び出す
            UpgradeAutobuyer.originalShowMenu(what);

            // オプションメニューが開かれた場合、設定を表示
            if (what === "prefs") {
              console.log("[UpgradeAutobuyer] Options menu opened, triggering addOptionsMenu");
              // 一定の遅延を設けてメニュー要素が確実に存在するようにする
              setTimeout(function () {
                if (typeof UpgradeAutobuyer.addOptionsMenu === "function") {
                  UpgradeAutobuyer.addOptionsMenu();
                }

                // BuildingAutobuyerも同時に更新
                if (window.BuildingAutobuyer && typeof window.BuildingAutobuyer.addOptionsMenu === "function") {
                  window.BuildingAutobuyer.addOptionsMenu();
                }
              }, 100);
            }
          };
        }

        return true;
      },
    });
  }
})(CMUpgradeAutobuyer);

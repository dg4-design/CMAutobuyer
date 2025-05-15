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

  // CookieMonsterメニュー設定連携用
  UpgradeAutobuyer.config = {};
  UpgradeAutobuyer.configPrefix = "UA";
  UpgradeAutobuyer.configs = {
    AutobuyerEnabled: {
      type: "bool",
      label: ["アップグレード自動購入オフ", "アップグレード自動購入オン"],
      desc: "PP最短のアップグレードを自動的に購入します",
      toggle: true,
      func: function () {
        if (Game.Objects["Upgrade Autobuyer"] && Game.Objects["Upgrade Autobuyer"].config) {
          if (Game.Objects["Upgrade Autobuyer"].config.AutobuyerEnabled === 1) {
            UpgradeAutobuyer.start();
          } else {
            UpgradeAutobuyer.stop();
          }
        }
      },
    },
    ExcludeSwitches: {
      type: "bool",
      label: ["スイッチ系除外オフ", "スイッチ系除外オン"],
      desc: "Golden/Shimmering Switchなどの状態トグルアップグレードを除外します",
      toggle: true,
      func: function () {
        if (Game.Objects["Upgrade Autobuyer"] && Game.Objects["Upgrade Autobuyer"].config) {
          UpgradeAutobuyer.excludeSwitches = Game.Objects["Upgrade Autobuyer"].config.ExcludeSwitches === 1;
        }
      },
    },
    ExcludeResearch: {
      type: "bool",
      label: ["研究除外オフ", "研究除外オン"],
      desc: "研究系（負の効果を持つことがある）アップグレードを除外します",
      toggle: true,
      func: function () {
        if (Game.Objects["Upgrade Autobuyer"] && Game.Objects["Upgrade Autobuyer"].config) {
          UpgradeAutobuyer.excludeResearch = Game.Objects["Upgrade Autobuyer"].config.ExcludeResearch === 1;
        }
      },
    },
    ExcludeCovenants: {
      type: "bool",
      label: ["契約系除外オフ", "契約系除外オン"],
      desc: "Elder Covenantなど契約系アップグレードを除外します",
      toggle: true,
      func: function () {
        if (Game.Objects["Upgrade Autobuyer"] && Game.Objects["Upgrade Autobuyer"].config) {
          UpgradeAutobuyer.excludeCovenants = Game.Objects["Upgrade Autobuyer"].config.ExcludeCovenants === 1;
        }
      },
    },
  };

  // デバッグログ
  UpgradeAutobuyer.log = function (message) {
    if (UpgradeAutobuyer.debug) {
      console.log(`[CM-UA] ${message}`);
    }
  };

  // 設定UIを作成して表示
  UpgradeAutobuyer.showSettingsUI = function () {
    // 既存の設定メニューがあれば削除
    const oldMenu = document.getElementById("CMUASettingsMenu");
    if (oldMenu) oldMenu.remove();

    // 設定メニューを作成
    const menu = document.createElement("div");
    menu.id = "CMUASettingsMenu";
    menu.style.position = "fixed";
    menu.style.left = "50%";
    menu.style.top = "50%";
    menu.style.transform = "translate(-50%, -50%)";
    menu.style.backgroundColor = "rgba(0, 0, 0, 0.9)";
    menu.style.color = "white";
    menu.style.padding = "20px";
    menu.style.borderRadius = "15px";
    menu.style.zIndex = "10000000000";
    menu.style.minWidth = "300px";
    menu.style.textAlign = "center";
    menu.style.boxShadow = "0 0 15px rgba(255, 255, 255, 0.3)";
    menu.style.border = "1px solid rgba(255, 255, 255, 0.2)";

    // タイトル
    const title = document.createElement("h2");
    title.textContent = "アップグレード自動購入設定";
    title.style.borderBottom = "1px solid rgba(255, 255, 255, 0.3)";
    title.style.paddingBottom = "10px";
    title.style.marginBottom = "15px";
    menu.appendChild(title);

    // 有効/無効設定
    const enableDiv = document.createElement("div");
    enableDiv.style.marginBottom = "15px";
    enableDiv.style.textAlign = "left";

    const enableLabel = document.createElement("span");
    enableLabel.textContent = "自動購入: ";
    enableLabel.style.marginRight = "10px";
    enableDiv.appendChild(enableLabel);

    const enableButton = document.createElement("a");
    enableButton.className = "option" + (UpgradeAutobuyer.isRunning ? "" : " off");
    enableButton.textContent = UpgradeAutobuyer.isRunning ? "オン" : "オフ";
    enableButton.style.cursor = "pointer";
    enableButton.onclick = function () {
      if (UpgradeAutobuyer.isRunning) {
        UpgradeAutobuyer.stop();
        enableButton.textContent = "オフ";
        enableButton.className = "option off";
        // 設定値も更新
        if (Game.Objects["Upgrade Autobuyer"] && Game.Objects["Upgrade Autobuyer"].config) {
          Game.Objects["Upgrade Autobuyer"].config.AutobuyerEnabled = 0;
        }
      } else {
        UpgradeAutobuyer.start();
        enableButton.textContent = "オン";
        enableButton.className = "option";
        // 設定値も更新
        if (Game.Objects["Upgrade Autobuyer"] && Game.Objects["Upgrade Autobuyer"].config) {
          Game.Objects["Upgrade Autobuyer"].config.AutobuyerEnabled = 1;
        }
      }
    };
    enableDiv.appendChild(enableButton);
    menu.appendChild(enableDiv);

    // スイッチ除外設定
    const switchesDiv = document.createElement("div");
    switchesDiv.style.marginBottom = "15px";
    switchesDiv.style.textAlign = "left";

    const switchesLabel = document.createElement("span");
    switchesLabel.textContent = "スイッチ系除外: ";
    switchesLabel.style.marginRight = "10px";
    switchesDiv.appendChild(switchesLabel);

    const switchesButton = document.createElement("a");
    switchesButton.className = "option" + (UpgradeAutobuyer.excludeSwitches ? "" : " off");
    switchesButton.textContent = UpgradeAutobuyer.excludeSwitches ? "オン" : "オフ";
    switchesButton.style.cursor = "pointer";
    switchesButton.onclick = function () {
      UpgradeAutobuyer.excludeSwitches = !UpgradeAutobuyer.excludeSwitches;
      switchesButton.textContent = UpgradeAutobuyer.excludeSwitches ? "オン" : "オフ";
      switchesButton.className = "option" + (UpgradeAutobuyer.excludeSwitches ? "" : " off");
      Game.Notify("アップグレード自動購入", `スイッチ系除外を${UpgradeAutobuyer.excludeSwitches ? "オン" : "オフ"}にしました`, [16, 5], 3);
      // 設定値も更新
      if (Game.Objects["Upgrade Autobuyer"] && Game.Objects["Upgrade Autobuyer"].config) {
        Game.Objects["Upgrade Autobuyer"].config.ExcludeSwitches = UpgradeAutobuyer.excludeSwitches ? 1 : 0;
      }
    };
    switchesDiv.appendChild(switchesButton);
    menu.appendChild(switchesDiv);

    // 研究除外設定
    const researchDiv = document.createElement("div");
    researchDiv.style.marginBottom = "15px";
    researchDiv.style.textAlign = "left";

    const researchLabel = document.createElement("span");
    researchLabel.textContent = "研究除外: ";
    researchLabel.style.marginRight = "10px";
    researchDiv.appendChild(researchLabel);

    const researchButton = document.createElement("a");
    researchButton.className = "option" + (UpgradeAutobuyer.excludeResearch ? "" : " off");
    researchButton.textContent = UpgradeAutobuyer.excludeResearch ? "オン" : "オフ";
    researchButton.style.cursor = "pointer";
    researchButton.onclick = function () {
      UpgradeAutobuyer.excludeResearch = !UpgradeAutobuyer.excludeResearch;
      researchButton.textContent = UpgradeAutobuyer.excludeResearch ? "オン" : "オフ";
      researchButton.className = "option" + (UpgradeAutobuyer.excludeResearch ? "" : " off");
      Game.Notify("アップグレード自動購入", `研究除外を${UpgradeAutobuyer.excludeResearch ? "オン" : "オフ"}にしました`, [16, 5], 3);
      // 設定値も更新
      if (Game.Objects["Upgrade Autobuyer"] && Game.Objects["Upgrade Autobuyer"].config) {
        Game.Objects["Upgrade Autobuyer"].config.ExcludeResearch = UpgradeAutobuyer.excludeResearch ? 1 : 0;
      }
    };
    researchDiv.appendChild(researchButton);
    menu.appendChild(researchDiv);

    // 契約除外設定
    const covenantsDiv = document.createElement("div");
    covenantsDiv.style.marginBottom = "15px";
    covenantsDiv.style.textAlign = "left";

    const covenantsLabel = document.createElement("span");
    covenantsLabel.textContent = "契約系除外: ";
    covenantsLabel.style.marginRight = "10px";
    covenantsDiv.appendChild(covenantsLabel);

    const covenantsButton = document.createElement("a");
    covenantsButton.className = "option" + (UpgradeAutobuyer.excludeCovenants ? "" : " off");
    covenantsButton.textContent = UpgradeAutobuyer.excludeCovenants ? "オン" : "オフ";
    covenantsButton.style.cursor = "pointer";
    covenantsButton.onclick = function () {
      UpgradeAutobuyer.excludeCovenants = !UpgradeAutobuyer.excludeCovenants;
      covenantsButton.textContent = UpgradeAutobuyer.excludeCovenants ? "オン" : "オフ";
      covenantsButton.className = "option" + (UpgradeAutobuyer.excludeCovenants ? "" : " off");
      Game.Notify("アップグレード自動購入", `契約系除外を${UpgradeAutobuyer.excludeCovenants ? "オン" : "オフ"}にしました`, [16, 5], 3);
      // 設定値も更新
      if (Game.Objects["Upgrade Autobuyer"] && Game.Objects["Upgrade Autobuyer"].config) {
        Game.Objects["Upgrade Autobuyer"].config.ExcludeCovenants = UpgradeAutobuyer.excludeCovenants ? 1 : 0;
      }
    };
    covenantsDiv.appendChild(covenantsButton);
    menu.appendChild(covenantsDiv);

    // 閉じるボタン
    const closeButton = document.createElement("a");
    closeButton.className = "option";
    closeButton.textContent = "閉じる";
    closeButton.style.marginTop = "15px";
    closeButton.style.display = "inline-block";
    closeButton.style.cursor = "pointer";
    closeButton.onclick = function () {
      menu.remove();
    };
    menu.appendChild(closeButton);

    // メニューを表示
    document.body.appendChild(menu);
  };

  // 設定ボタンをゲームに追加
  UpgradeAutobuyer.addSettingsButton = function () {
    if (document.getElementById("CMUASettingsButton")) return;

    const button = document.createElement("div");
    button.id = "CMUASettingsButton";
    button.className = "prefButton";
    button.style.position = "fixed";
    button.style.bottom = "50px";
    button.style.right = "80px";
    button.style.background = "url(img/storeTile.jpg)";
    button.style.backgroundPosition = "0px 5px";
    button.style.width = "48px";
    button.style.height = "48px";
    button.style.borderRadius = "24px";
    button.style.overflow = "hidden";
    button.style.cursor = "pointer";
    button.style.textAlign = "center";
    button.style.zIndex = "100000";
    button.style.transition = "transform 0.15s";
    button.onmouseover = function () {
      button.style.transform = "scale(1.1)";
    };
    button.onmouseout = function () {
      button.style.transform = "scale(1)";
    };

    const icon = document.createElement("div");
    icon.style.backgroundImage = "url(img/upgradePic.png)";
    icon.style.backgroundPosition = "0px 0px";
    icon.style.width = "48px";
    icon.style.height = "48px";
    icon.style.transform = "scale(0.8)";
    icon.style.position = "absolute";
    icon.style.left = "0";
    icon.style.top = "0";
    button.appendChild(icon);

    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    tooltip.style.width = "200px";
    tooltip.style.left = "-75px";
    tooltip.textContent = "アップグレード自動購入設定";
    tooltip.style.visibility = "hidden";
    tooltip.style.opacity = "0";
    button.onmouseover = function () {
      button.style.transform = "scale(1.1)";
      tooltip.style.visibility = "visible";
      tooltip.style.opacity = "1";
    };
    button.onmouseout = function () {
      button.style.transform = "scale(1)";
      tooltip.style.visibility = "hidden";
      tooltip.style.opacity = "0";
    };
    button.appendChild(tooltip);

    button.onclick = UpgradeAutobuyer.showSettingsUI;
    document.body.appendChild(button);
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

    // 設定値を更新
    if (Game.Objects["Upgrade Autobuyer"] && Game.Objects["Upgrade Autobuyer"].config) {
      Game.Objects["Upgrade Autobuyer"].config.AutobuyerEnabled = 1;
    }
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

    // 設定値を更新
    if (Game.Objects["Upgrade Autobuyer"] && Game.Objects["Upgrade Autobuyer"].config) {
      Game.Objects["Upgrade Autobuyer"].config.AutobuyerEnabled = 0;
    }
  };

  // 自動購入の状態を切り替え
  UpgradeAutobuyer.toggle = function () {
    UpgradeAutobuyer.isRunning ? UpgradeAutobuyer.stop() : UpgradeAutobuyer.start();
  };

  // Cookie Clickerの設定パネルに設定を表示
  UpgradeAutobuyer.setupOptions = function () {
    // ダミー建物をGame.Objectsに追加してメニューを表示
    if (!Game.Objects["Upgrade Autobuyer"]) {
      // 設定オブジェクトを作成
      Game.Objects["Upgrade Autobuyer"] = {
        name: "Upgrade Autobuyer",
        config: {
          AutobuyerEnabled: UpgradeAutobuyer.isRunning ? 1 : 0,
          ExcludeSwitches: UpgradeAutobuyer.excludeSwitches ? 1 : 0,
          ExcludeResearch: UpgradeAutobuyer.excludeResearch ? 1 : 0,
          ExcludeCovenants: UpgradeAutobuyer.excludeCovenants ? 1 : 0,
        },

        // Cookie Clicker設定メニューに表示
        buildOptionFragments: function () {
          const frag = document.createDocumentFragment();

          const title = document.createElement("div");
          title.className = "title";
          title.textContent = "アップグレード自動購入";
          frag.appendChild(title);

          // 有効/無効設定
          const enableDiv = document.createElement("div");
          enableDiv.className = "listing";

          const enableButton = document.createElement("a");
          enableButton.className = "option" + (UpgradeAutobuyer.isRunning ? "" : " off");
          enableButton.textContent = UpgradeAutobuyer.isRunning ? "アップグレード自動購入オン" : "アップグレード自動購入オフ";
          enableButton.onclick = function () {
            if (UpgradeAutobuyer.isRunning) {
              UpgradeAutobuyer.stop();
              enableButton.textContent = "アップグレード自動購入オフ";
              enableButton.className = "option off";
            } else {
              UpgradeAutobuyer.start();
              enableButton.textContent = "アップグレード自動購入オン";
              enableButton.className = "option";
            }
          };

          enableDiv.appendChild(enableButton);
          const enableDesc = document.createElement("label");
          enableDesc.textContent = "PP最短のアップグレードを自動的に購入します";
          enableDesc.style.marginLeft = "10px";
          enableDiv.appendChild(enableDesc);

          frag.appendChild(enableDiv);

          // スイッチ系除外設定
          const switchesDiv = document.createElement("div");
          switchesDiv.className = "listing";

          const switchesButton = document.createElement("a");
          switchesButton.className = "option" + (UpgradeAutobuyer.excludeSwitches ? "" : " off");
          switchesButton.textContent = UpgradeAutobuyer.excludeSwitches ? "スイッチ系除外オン" : "スイッチ系除外オフ";
          switchesButton.onclick = function () {
            UpgradeAutobuyer.excludeSwitches = !UpgradeAutobuyer.excludeSwitches;
            switchesButton.textContent = UpgradeAutobuyer.excludeSwitches ? "スイッチ系除外オン" : "スイッチ系除外オフ";
            switchesButton.className = "option" + (UpgradeAutobuyer.excludeSwitches ? "" : " off");
            Game.Objects["Upgrade Autobuyer"].config.ExcludeSwitches = UpgradeAutobuyer.excludeSwitches ? 1 : 0;
          };

          switchesDiv.appendChild(switchesButton);
          const switchesDesc = document.createElement("label");
          switchesDesc.textContent = "Golden/Shimmering Switchなどの状態トグルアップグレードを除外します";
          switchesDesc.style.marginLeft = "10px";
          switchesDiv.appendChild(switchesDesc);

          frag.appendChild(switchesDiv);

          // 研究系除外設定
          const researchDiv = document.createElement("div");
          researchDiv.className = "listing";

          const researchButton = document.createElement("a");
          researchButton.className = "option" + (UpgradeAutobuyer.excludeResearch ? "" : " off");
          researchButton.textContent = UpgradeAutobuyer.excludeResearch ? "研究除外オン" : "研究除外オフ";
          researchButton.onclick = function () {
            UpgradeAutobuyer.excludeResearch = !UpgradeAutobuyer.excludeResearch;
            researchButton.textContent = UpgradeAutobuyer.excludeResearch ? "研究除外オン" : "研究除外オフ";
            researchButton.className = "option" + (UpgradeAutobuyer.excludeResearch ? "" : " off");
            Game.Objects["Upgrade Autobuyer"].config.ExcludeResearch = UpgradeAutobuyer.excludeResearch ? 1 : 0;
          };

          researchDiv.appendChild(researchButton);
          const researchDesc = document.createElement("label");
          researchDesc.textContent = "研究系（負の効果を持つことがある）アップグレードを除外します";
          researchDesc.style.marginLeft = "10px";
          researchDiv.appendChild(researchDesc);

          frag.appendChild(researchDiv);

          // 契約系除外設定
          const covenantsDiv = document.createElement("div");
          covenantsDiv.className = "listing";

          const covenantsButton = document.createElement("a");
          covenantsButton.className = "option" + (UpgradeAutobuyer.excludeCovenants ? "" : " off");
          covenantsButton.textContent = UpgradeAutobuyer.excludeCovenants ? "契約系除外オン" : "契約系除外オフ";
          covenantsButton.onclick = function () {
            UpgradeAutobuyer.excludeCovenants = !UpgradeAutobuyer.excludeCovenants;
            covenantsButton.textContent = UpgradeAutobuyer.excludeCovenants ? "契約系除外オン" : "契約系除外オフ";
            covenantsButton.className = "option" + (UpgradeAutobuyer.excludeCovenants ? "" : " off");
            Game.Objects["Upgrade Autobuyer"].config.ExcludeCovenants = UpgradeAutobuyer.excludeCovenants ? 1 : 0;
          };

          covenantsDiv.appendChild(covenantsButton);
          const covenantsDesc = document.createElement("label");
          covenantsDesc.textContent = "Elder Covenantなど契約系アップグレードを除外します";
          covenantsDesc.style.marginLeft = "10px";
          covenantsDiv.appendChild(covenantsDesc);

          frag.appendChild(covenantsDiv);

          return frag;
        },
      };

      // オプションメニューに追加
      Game.customOptions = Game.customOptions || [];
      Game.customOptions.push(function () {
        return Game.Objects["Upgrade Autobuyer"].buildOptionFragments();
      });
    }
  };

  // 設定の保存
  UpgradeAutobuyer.save = function () {
    if (Game.Objects["Upgrade Autobuyer"] && Game.Objects["Upgrade Autobuyer"].config) {
      return JSON.stringify({
        enabled: UpgradeAutobuyer.isRunning,
        excludeSwitches: UpgradeAutobuyer.excludeSwitches,
        excludeResearch: UpgradeAutobuyer.excludeResearch,
        excludeCovenants: UpgradeAutobuyer.excludeCovenants,
      });
    }
    return null;
  };

  // 設定の読み込み
  UpgradeAutobuyer.load = function (str) {
    if (!str) return;
    try {
      const config = JSON.parse(str);
      UpgradeAutobuyer.excludeSwitches = config.excludeSwitches;
      UpgradeAutobuyer.excludeResearch = config.excludeResearch;
      UpgradeAutobuyer.excludeCovenants = config.excludeCovenants;

      if (config.enabled) {
        UpgradeAutobuyer.start();
      } else {
        UpgradeAutobuyer.stop();
      }

      // Game.Objects設定も更新
      if (Game.Objects["Upgrade Autobuyer"] && Game.Objects["Upgrade Autobuyer"].config) {
        Game.Objects["Upgrade Autobuyer"].config = {
          AutobuyerEnabled: config.enabled ? 1 : 0,
          ExcludeSwitches: config.excludeSwitches ? 1 : 0,
          ExcludeResearch: config.excludeResearch ? 1 : 0,
          ExcludeCovenants: config.excludeCovenants ? 1 : 0,
        };
      }
    } catch (e) {
      console.error("アップグレード自動購入の設定読み込みに失敗しました:", e);
    }
  };

  // 初期化処理
  UpgradeAutobuyer.init = function () {
    // 設定ボタンをゲームに追加
    if (Game && Game.ready) {
      this.addSettingsButton();
      // Cookie Clicker設定に統合
      this.setupOptions();

      // モッドとして登録
      if (!Game.mods.cmUpgradeAutobuyer) {
        Game.registerMod("cmUpgradeAutobuyer", {
          init: function () {
            return true;
          },
          save: UpgradeAutobuyer.save,
          load: UpgradeAutobuyer.load,
        });
      }
    } else {
      const checkGameLoaded = setInterval(function () {
        if (Game && Game.ready) {
          clearInterval(checkGameLoaded);
          UpgradeAutobuyer.addSettingsButton();
          // Cookie Clicker設定に統合
          UpgradeAutobuyer.setupOptions();

          // モッドとして登録
          if (!Game.mods.cmUpgradeAutobuyer) {
            Game.registerMod("cmUpgradeAutobuyer", {
              init: function () {
                return true;
              },
              save: UpgradeAutobuyer.save,
              load: UpgradeAutobuyer.load,
            });
          }
        }
      }, 1000);
    }
  };

  // 初期化時のメッセージ
  console.log("Cookie Monster - アップグレード自動購入 (CM-UpgradeAutobuyer) が読み込まれました。");
  console.log("使用方法: CMUpgradeAutobuyer.start() で開始、CMUpgradeAutobuyer.stop() で停止");
  console.log("画面右下の設定ボタンからも設定できます");
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

// 初期化の問題を修正
// 最初にオブジェクトを定義して、そのあとで拡張する
var CMBuildingAutobuyer = {};

//===========================================================================
// BuildingAutobuyer.js
// Cookie Monster 建物自動購入スクリプト
// 使用方法: CMBuildingAutobuyer.start() で開始、CMBuildingAutobuyer.stop() で停止
//===========================================================================

(function (BuildingAutobuyer) {
  // 設定
  BuildingAutobuyer.isRunning = false;
  BuildingAutobuyer.interval = 100; // 0.1秒ごとにチェック
  BuildingAutobuyer.timerId = null;
  BuildingAutobuyer.debug = false;
  BuildingAutobuyer.settingName = "cmBuildingAutobuyer"; // 設定名
  BuildingAutobuyer.amountSettingName = "cmBuildingAutobuyerAmount"; // 購入数量設定名
  BuildingAutobuyer.buyAmount = 0; // 0: 最適な量, 1: 単一, 2: 10個, 3: 100個
  BuildingAutobuyer.settings = {
    enabled: false, // 自動購入が有効か
    buyAmount: 0, // 購入数量 (0:最適, 1:単一, 2:10個, 3:100個)
  };
  BuildingAutobuyer.targetBuilding = null; // 購入待ちの建物を保存

  // デバッグログ
  BuildingAutobuyer.log = function (message) {
    if (BuildingAutobuyer.debug) {
      console.log(`[CM-BA] ${message}`);
    }
  };

  // 設定UIを作成して表示
  BuildingAutobuyer.showSettingsUI = function () {
    // 既存の設定メニューがあれば削除
    const oldMenu = document.getElementById("CMBASettingsMenu");
    if (oldMenu) oldMenu.remove();

    // 設定メニューを作成
    const menu = document.createElement("div");
    menu.id = "CMBASettingsMenu";
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
    title.textContent = "建物自動購入設定";
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
    enableButton.className = "option" + (BuildingAutobuyer.isRunning ? "" : " off");
    enableButton.textContent = BuildingAutobuyer.isRunning ? "オン" : "オフ";
    enableButton.style.cursor = "pointer";
    enableButton.onclick = function () {
      if (BuildingAutobuyer.isRunning) {
        BuildingAutobuyer.stop();
        enableButton.textContent = "オフ";
        enableButton.className = "option off";
      } else {
        BuildingAutobuyer.start();
        enableButton.textContent = "オン";
        enableButton.className = "option";
      }
    };
    enableDiv.appendChild(enableButton);
    menu.appendChild(enableDiv);

    // 購入数量設定
    const amountDiv = document.createElement("div");
    amountDiv.style.marginBottom = "15px";
    amountDiv.style.textAlign = "left";

    const amountLabel = document.createElement("span");
    amountLabel.textContent = "購入数量: ";
    amountLabel.style.marginRight = "10px";
    amountDiv.appendChild(amountLabel);

    const amountTexts = ["最適な量", "1個ずつ", "10個ずつ", "100個ずつ"];

    const amountButton = document.createElement("a");
    amountButton.className = "option";
    amountButton.textContent = amountTexts[BuildingAutobuyer.buyAmount];
    amountButton.style.cursor = "pointer";
    amountButton.onclick = function () {
      BuildingAutobuyer.buyAmount = (BuildingAutobuyer.buyAmount + 1) % 4;
      amountButton.textContent = amountTexts[BuildingAutobuyer.buyAmount];

      Game.Notify("建物自動購入", `購入数量を「${amountTexts[BuildingAutobuyer.buyAmount]}」に設定しました`, [16, 5], 3);
    };
    amountDiv.appendChild(amountButton);
    menu.appendChild(amountDiv);

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
  BuildingAutobuyer.addSettingsButton = function () {
    if (document.getElementById("CMBASettingsButton")) return;

    const button = document.createElement("div");
    button.id = "CMBASettingsButton";
    button.className = "prefButton";
    button.style.position = "fixed";
    button.style.bottom = "50px";
    button.style.right = "20px";
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
    icon.style.backgroundImage = "url(img/buildings.png)";
    icon.style.backgroundPosition = "-336px -384px";
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
    tooltip.textContent = "建物自動購入設定";
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

    button.onclick = BuildingAutobuyer.showSettingsUI;
    document.body.appendChild(button);
  };

  // 購入数量を設定するメソッド
  BuildingAutobuyer.setBuyAmount = function (amount) {
    // 有効な値かチェック
    if (typeof amount !== "number" || amount < 0 || amount > 3 || !Number.isInteger(amount)) {
      Game.Notify("建物自動購入", "無効な購入数量です。0:最適な量, 1:単一, 2:10個, 3:100個から選択してください", [16, 5], 5);
      return false;
    }

    // 購入数量を設定
    BuildingAutobuyer.buyAmount = amount;
    // 新しい購入モードでは、以前のターゲット建物をクリア
    BuildingAutobuyer.targetBuilding = null;

    const amountTexts = ["最適な量", "単一購入", "10個購入", "100個購入"];
    Game.Notify("建物自動購入", `購入数量を「${amountTexts[amount]}」に設定しました`, [16, 5], 3);
    BuildingAutobuyer.log(`購入数量を変更しました: ${amountTexts[amount]}`);
    return true;
  };

  // 現在の購入数量を取得するメソッド
  BuildingAutobuyer.getBuyAmount = function () {
    const amountTexts = ["最適な量", "単一購入", "10個購入", "100個購入"];
    const currentAmount = BuildingAutobuyer.buyAmount;
    Game.Notify("建物自動購入", `現在の購入数量: 「${amountTexts[currentAmount]}」`, [16, 5], 3);
    return currentAmount;
  };

  // 最適な購入を探す
  BuildingAutobuyer.findBestPurchase = function () {
    if (!window.CookieMonsterData || !Game) {
      return null;
    }

    // 購入モードの設定
    let sources = [];

    if (BuildingAutobuyer.buyAmount === 0) {
      // 最適な量モード（現状の動作を維持）
      sources = [
        { data: window.CookieMonsterData.Objects1, amount: 1 },
        { data: window.CookieMonsterData.Objects10, amount: 10 },
        { data: window.CookieMonsterData.Objects100, amount: 100 },
      ];
    } else if (BuildingAutobuyer.buyAmount === 1) {
      // 単一購入モード
      sources = [{ data: window.CookieMonsterData.Objects1, amount: 1 }];
    } else if (BuildingAutobuyer.buyAmount === 2) {
      // 10個購入モード
      sources = [{ data: window.CookieMonsterData.Objects10, amount: 10 }];
    } else if (BuildingAutobuyer.buyAmount === 3) {
      // 100個購入モード
      sources = [{ data: window.CookieMonsterData.Objects100, amount: 100 }];
    }

    let bestOption = null;
    let bestPP = Infinity;

    for (const source of sources) {
      const buildingsData = source.data;
      const bulkAmount = source.amount;

      if (!buildingsData) continue;

      for (const buildingName in buildingsData) {
        const buildingInfo = buildingsData[buildingName];
        if (buildingInfo && typeof buildingInfo.pp === "number" && !isNaN(buildingInfo.pp) && buildingInfo.pp < bestPP) {
          bestOption = {
            name: buildingName,
            pp: buildingInfo.pp,
            bulkAmount: bulkAmount,
          };
          bestPP = buildingInfo.pp;
        }
      }
    }
    return bestOption;
  };

  // 購入を試みる
  BuildingAutobuyer.tryPurchase = function () {
    // 保存済みのターゲット建物があるか確認
    if (BuildingAutobuyer.targetBuilding) {
      const building = Game.Objects[BuildingAutobuyer.targetBuilding.name];
      if (!building) {
        this.log(`保存された建物 "${BuildingAutobuyer.targetBuilding.name}" が見つかりません。`);
        BuildingAutobuyer.targetBuilding = null;
        return false;
      }

      const oldBuyMode = Game.buyMode;
      const oldBuyBulk = Game.buyBulk;

      Game.buyMode = 1;
      Game.buyBulk = BuildingAutobuyer.targetBuilding.bulkAmount;
      Game.CalculateGains(); // bulkPriceが更新されるようにする

      if (Game.cookies >= building.bulkPrice) {
        building.buy(); // Game.buyBulk に基づいて購入される
        this.log(
          `購入: ${BuildingAutobuyer.targetBuilding.name} x${BuildingAutobuyer.targetBuilding.bulkAmount} (PP: ${BuildingAutobuyer.targetBuilding.pp.toFixed(
            2
          )}, 価格: ${building.bulkPrice.toLocaleString()})`
        );

        Game.buyMode = oldBuyMode;
        Game.buyBulk = oldBuyBulk;
        Game.CalculateGains();

        // 購入が成功したらターゲットをクリア
        BuildingAutobuyer.targetBuilding = null;
        return true;
      }

      // まだ購入できないので待機
      Game.buyMode = oldBuyMode;
      Game.buyBulk = oldBuyBulk;
      Game.CalculateGains();
      this.log(
        `待機中: ${BuildingAutobuyer.targetBuilding.name} x${BuildingAutobuyer.targetBuilding.bulkAmount} (必要: ${building.bulkPrice.toLocaleString()}, 現在: ${Game.cookies.toLocaleString()})`
      );
      return false;
    }

    // 新しいベスト購入を見つける
    const best = this.findBestPurchase();
    if (!best) return false;

    const building = Game.Objects[best.name];
    if (!building) {
      this.log(`建物 "${best.name}" が見つかりません。`);
      return false;
    }

    const oldBuyMode = Game.buyMode;
    const oldBuyBulk = Game.buyBulk;

    Game.buyMode = 1;
    Game.buyBulk = best.bulkAmount;
    Game.CalculateGains(); // bulkPriceが更新されるようにする

    if (Game.cookies >= building.bulkPrice) {
      building.buy(); // Game.buyBulk に基づいて購入される
      this.log(`購入: ${best.name} x${best.bulkAmount} (PP: ${best.pp.toFixed(2)}, 価格: ${building.bulkPrice.toLocaleString()})`);

      Game.buyMode = oldBuyMode;
      Game.buyBulk = oldBuyBulk;
      Game.CalculateGains();
      return true;
    }

    // 購入できない場合は、このターゲットを保存して次回も試す
    BuildingAutobuyer.targetBuilding = best;

    Game.buyMode = oldBuyMode;
    Game.buyBulk = oldBuyBulk;
    Game.CalculateGains();
    this.log(`待機対象を設定: ${best.name} x${best.bulkAmount} (必要: ${building.bulkPrice.toLocaleString()}, 現在: ${Game.cookies.toLocaleString()})`);
    return false;
  };

  // 自動購入のメインループ
  BuildingAutobuyer.check = function () {
    if (!BuildingAutobuyer.isRunning) return;
    if (!Game || Game.OnAscend || Game.AscendTimer > 0 || Game.specialTab === "milkSelection" || Game.promptOn) {
      return;
    }
    BuildingAutobuyer.tryPurchase();
  };

  // 自動購入を開始
  BuildingAutobuyer.start = function () {
    if (BuildingAutobuyer.isRunning) {
      this.log("建物自動購入は既に実行中です。");
      return;
    }
    BuildingAutobuyer.isRunning = true;
    BuildingAutobuyer.timerId = setInterval(BuildingAutobuyer.check, BuildingAutobuyer.interval);
    Game.Notify("建物自動購入", "PP最短の建物を自動的に購入します", [16, 5], 1);
    this.log("建物自動購入を開始しました。");
    setTimeout(BuildingAutobuyer.check, BuildingAutobuyer.interval);
  };

  // 自動購入を停止
  BuildingAutobuyer.stop = function () {
    if (!BuildingAutobuyer.isRunning) {
      this.log("建物自動購入は実行されていません。");
      return;
    }
    BuildingAutobuyer.isRunning = false;
    if (BuildingAutobuyer.timerId) {
      clearInterval(BuildingAutobuyer.timerId);
      BuildingAutobuyer.timerId = null;
    }
    // ターゲット建物をクリア
    BuildingAutobuyer.targetBuilding = null;
    Game.Notify("建物自動購入", "自動購入を停止しました", [17, 5], 1);
    this.log("建物自動購入を停止しました。");
  };

  // 自動購入の状態を切り替え
  BuildingAutobuyer.toggle = function () {
    BuildingAutobuyer.isRunning ? BuildingAutobuyer.stop() : BuildingAutobuyer.start();
  };

  // 初期化処理
  BuildingAutobuyer.init = function () {
    // 設定ボタンをゲームに追加
    if (Game && Game.ready) {
      this.addSettingsButton();
    } else {
      const checkGameLoaded = setInterval(function () {
        if (Game && Game.ready) {
          clearInterval(checkGameLoaded);
          BuildingAutobuyer.addSettingsButton();
        }
      }, 1000);
    }
  };

  // 初期化時のメッセージ
  console.log("Cookie Monster - 建物自動購入 (CM-BuildingAutobuyer) が読み込まれました。");
  console.log("使用方法: CMBuildingAutobuyer.start() で開始、CMBuildingAutobuyer.stop() で停止");
  console.log("購入数量設定: CMBuildingAutobuyer.setBuyAmount(数量) で変更（0:最適な量, 1:単一, 2:10個, 3:100個）");
  console.log("購入数量確認: CMBuildingAutobuyer.getBuyAmount() で現在の設定を確認できます");
  console.log("画面右下の設定ボタンからも設定できます");
  Game.Notify("CM-BuildingAutobuyer", "建物自動購入スクリプトが読み込まれました", [4, 6], 5);

  // 初期化を実行
  setTimeout(BuildingAutobuyer.init, 1000);

  // モッドAPIのフック追加
  if (typeof Game !== "undefined") {
    Game.registerMod("CMBuildingAutobuyer", {
      init: function () {
        BuildingAutobuyer.init();
        return true;
      },
    });
  }
})(CMBuildingAutobuyer);

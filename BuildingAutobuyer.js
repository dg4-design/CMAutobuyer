//===========================================================================
// BuildingAutobuyer.js
// Cookie Monster 建物自動購入スクリプト
// 使用方法: CMBuildingAutobuyer.start() で開始、CMBuildingAutobuyer.stop() で停止
//===========================================================================

const CMBuildingAutobuyer = CMBuildingAutobuyer || {};

(function (BuildingAutobuyer) {
  // 設定
  BuildingAutobuyer.isRunning = false;
  BuildingAutobuyer.interval = 100; // 0.1秒ごとにチェック
  BuildingAutobuyer.timerId = null;
  BuildingAutobuyer.debug = false;
  BuildingAutobuyer.settingName = "cmBuildingAutobuyer"; // 設定名
  BuildingAutobuyer.amountSettingName = "cmBuildingAutobuyerAmount"; // 購入数量設定名
  BuildingAutobuyer.buyAmount = 0; // 0: 最適な量, 1: 単一, 2: 10個, 3: 100個

  // デバッグログ
  BuildingAutobuyer.log = function (message) {
    if (BuildingAutobuyer.debug) {
      console.log(`[CM-BA] ${message}`);
    }
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

    Game.buyMode = oldBuyMode;
    Game.buyBulk = oldBuyBulk;
    Game.CalculateGains(); // 購入しなかった場合も元に戻す
    // this.log(`待機中: ${best.name} x${best.bulkAmount} (必要: ${building.bulkPrice.toLocaleString()}, 現在: ${Game.cookies.toLocaleString()})`);
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
    Game.Notify("建物自動購入", "自動購入を停止しました", [17, 5], 1);
    this.log("建物自動購入を停止しました。");
  };

  // 自動購入の状態を切り替え
  BuildingAutobuyer.toggle = function () {
    BuildingAutobuyer.isRunning ? BuildingAutobuyer.stop() : BuildingAutobuyer.start();
  };

  // Cookie Monster設定に統合する
  BuildingAutobuyer.injectSettings = function () {
    if (!CM || !CM.Disp || !CM.Disp.UpdateSettings) {
      console.log("[CM-BA] Cookie Monsterが見つかりません。設定を統合できません。");
      return;
    }

    // 設定オブジェクトを作成
    CM.ConfigData[this.settingName] = {
      label: "BuildingAutobuyer",
      desc: "建物の自動購入を有効化（PP最短を自動購入）",
      settings: ["オフ", "オン"],
      toggle: true,
      default: 0,
    };

    // 購入数量の設定を追加
    CM.ConfigData[this.amountSettingName] = {
      label: "購入数量",
      desc: "自動購入する際の購入数量を設定",
      settings: ["最適な量", "1個ずつ", "10個ずつ", "100個ずつ"],
      toggle: false,
      default: 0,
    };

    // デフォルト値を設定
    if (!CM.Config[this.settingName]) {
      CM.Config[this.settingName] = 0;
    }

    if (!CM.Config[this.amountSettingName]) {
      CM.Config[this.amountSettingName] = 0;
    }

    // 設定変更時のイベントハンドラを追加
    CM.Callback[this.settingName] = function () {
      if (CM.Config[BuildingAutobuyer.settingName] === 1) {
        BuildingAutobuyer.start();
      } else {
        BuildingAutobuyer.stop();
      }
    };

    // 購入数量変更時のイベントハンドラ
    CM.Callback[this.amountSettingName] = function () {
      BuildingAutobuyer.buyAmount = CM.Config[BuildingAutobuyer.amountSettingName];
      BuildingAutobuyer.log(`購入数量を変更しました: ${CM.ConfigData[BuildingAutobuyer.amountSettingName].settings[BuildingAutobuyer.buyAmount]}`);
    };

    // 設定画面を更新するため
    if (typeof CM.Disp.AddMenuPref === "function") {
      CM.Disp.AddMenuPref("自動購入", this.settingName);
      CM.Disp.AddMenuPref("自動購入", this.amountSettingName);
    }

    // 初期設定を反映
    BuildingAutobuyer.buyAmount = CM.Config[BuildingAutobuyer.amountSettingName];

    console.log("[CM-BA] Cookie Monster設定に統合しました");
  };

  // Cookie Monsterがロード済みか確認して設定を統合
  BuildingAutobuyer.init = function () {
    if (typeof CM !== "undefined" && CM.Loaded) {
      this.injectSettings();
    } else {
      // Cookie Monsterがロードされるのを待つ
      const checkCMLoaded = setInterval(function () {
        if (typeof CM !== "undefined" && CM.Loaded) {
          clearInterval(checkCMLoaded);
          BuildingAutobuyer.injectSettings();
        }
      }, 1000);
    }
  };

  // 初期化時のメッセージ
  console.log("Cookie Monster - 建物自動購入 (CM-BuildingAutobuyer) が読み込まれました。");
  console.log("使用方法: CMBuildingAutobuyer.start() で開始、CMBuildingAutobuyer.stop() で停止");
  Game.Notify("CM-BuildingAutobuyer", "建物自動購入スクリプトが読み込まれました", [4, 6], 5);

  // 初期化を実行
  setTimeout(BuildingAutobuyer.init, 1000);

  // スクリプトの最後に追加
  if (typeof Game !== "undefined" && Game.ready) {
    // ゲームが読み込まれている場合は直接初期化
    CMBuildingAutobuyer.init();
  } else {
    // ゲームのロードを待つ
    const loadHook = setInterval(function () {
      if (typeof Game !== "undefined" && Game.ready) {
        clearInterval(loadHook);
        CMBuildingAutobuyer.init();
      }
    }, 1000);
  }

  // モッドAPIのフック追加
  if (typeof Game !== "undefined") {
    Game.registerMod("CMBuildingAutobuyer", {
      init: function () {
        CMBuildingAutobuyer.init();
        return true;
      },
    });
  }
})(CMBuildingAutobuyer);

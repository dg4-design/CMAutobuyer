// 初期化の問題を修正
// 最初にオブジェクトを定義して、そのあとで拡張する
var CMBuildingAutobuyer = {};

//===========================================================================
// BuildingAutobuyer.js
// Cookie Monster 施設自動購入スクリプト
// 使用方法: CMBuildingAutobuyer.start() で開始、CMBuildingAutobuyer.stop() で停止
//===========================================================================

(function (BuildingAutobuyer) {
  // 設定
  BuildingAutobuyer.isRunning = false;
  BuildingAutobuyer.interval = 100; // 0.1秒ごとにチェック
  BuildingAutobuyer.timerId = null;
  BuildingAutobuyer.debug = false; // デバッグモード無効化
  BuildingAutobuyer.settingName = "cmBuildingAutobuyer"; // 設定名
  BuildingAutobuyer.amountSettingName = "cmBuildingAutobuyerAmount"; // 購入数量設定名
  BuildingAutobuyer.buyAmount = 0; // 0: 最適な量, 1: 単一, 2: 10個, 3: 100個
  BuildingAutobuyer.settings = {
    enabled: false, // 自動購入が有効か
    buyAmount: 0, // 購入数量 (0:最適, 1:単一, 2:10個, 3:100個)
  };
  BuildingAutobuyer.targetBuilding = null; // 購入待ちの施設を保存

  // デバッグログ
  BuildingAutobuyer.log = function (message) {
    // デバッグログ機能は無効化
  };

  // CookieClickerのゲーム設定に直接追加
  BuildingAutobuyer.injectIntoOptions = function () {
    // 既に追加済みかチェック
    if (Game.customOptionsMenu && Game.customOptionsMenu.indexOf("CMBuildingAutobuyer.addOptionsMenu") !== -1) {
      return;
    }

    // 現在のオプションメニュー関数をバックアップ
    if (!Game.customOptionsMenu) {
      Game.customOptionsMenu = [];
      BuildingAutobuyer.originalUpdateMenu = Game.UpdateMenu;

      // Game.UpdateMenu関数をオーバーライド
      Game.UpdateMenu = function () {
        // 元のメニュー更新関数を実行
        BuildingAutobuyer.originalUpdateMenu();

        // 現在のメニューがオプションメニューであれば、カスタムオプションを追加
        if (Game.onMenu === "prefs") {
          // すべてのカスタムオプションメニュー処理を実行
          Game.customOptionsMenu.forEach(function (customMenuCallback) {
            if (typeof window[customMenuCallback] === "function") {
              try {
                window[customMenuCallback]();
              } catch (e) {}
            }
          });
        }
      };
    }

    // カスタムメニューに登録
    if (Game.customOptionsMenu.indexOf("CMBuildingAutobuyer.addOptionsMenu") === -1) {
      Game.customOptionsMenu.push("CMBuildingAutobuyer.addOptionsMenu");
    }

    // 現在のメニュー状態をチェック
    if (Game.onMenu === "prefs") {
      BuildingAutobuyer.addOptionsMenu();
    }
  };

  // オプションメニューに設定項目を追加
  BuildingAutobuyer.addOptionsMenu = function () {
    const optionsMenu = l("menu");

    if (!optionsMenu) {
      return;
    }

    // CookieClickerの設定セクションを特定
    let subMenu = null;

    // 方法1: Cookie Monster専用セクションを探す（すでに存在している場合）
    const cmSection = l("cookieMonsterModMenuSection");
    if (cmSection) {
      subMenu = cmSection;
    }
    // 方法2: preferenceTableBodiesを探す（通常のCookieClicker構造）
    else if (l("preferenceTableBodies")) {
      subMenu = l("preferenceTableBodies");
    }
    // 方法3: 既存のセクションを探す
    else {
      const sections = optionsMenu.querySelectorAll(".section");
      if (sections && sections.length > 0) {
        subMenu = sections[0];
      }
    }

    if (!subMenu) {
      subMenu = optionsMenu;
    }

    // 既に追加済みセクションがあれば削除
    const existingSection = l("CMBuildingAutobuyerOptions");
    if (existingSection) {
      existingSection.remove();
    }

    // 新しいセクションを作成
    const newSection = document.createElement("div");
    newSection.id = "CMBuildingAutobuyerOptions";
    newSection.className = "subsection";
    newSection.style.padding = "0px";
    newSection.style.margin = "8px 4px";

    // セクションのタイトル
    const sectionTitle = document.createElement("div");
    sectionTitle.className = "title";
    sectionTitle.textContent = "施設自動購入";
    newSection.appendChild(sectionTitle);

    // オプションテーブル
    const optionsTable = document.createElement("div");
    optionsTable.className = "listing";

    // 自動購入のオン/オフ設定
    const enabledRow = BuildingAutobuyer.createPreferenceRow("自動購入", "CMBuildingAutobuyerEnabled", BuildingAutobuyer.isRunning ? "ON" : "OFF", "施設の自動購入を有効/無効にします");

    enabledRow.querySelector("a.option").onclick = function () {
      BuildingAutobuyer.toggle();
      this.textContent = BuildingAutobuyer.isRunning ? "ON" : "OFF";
      this.className = "option" + (BuildingAutobuyer.isRunning ? "" : " off");
      return false;
    };
    optionsTable.appendChild(enabledRow);

    // 購入数量設定
    const amountTexts = ["最適な量", "1個ずつ", "10個ずつ", "100個ずつ"];
    const amountRow = BuildingAutobuyer.createPreferenceRow(
      "購入数量",
      "CMBuildingAutobuyerAmount",
      amountTexts[BuildingAutobuyer.buyAmount],
      "購入する施設の数量を設定します。最適な量は1個・10個・100個の中から一番PP値のよいものを選びます"
    );

    amountRow.querySelector("a.option").onclick = function () {
      BuildingAutobuyer.buyAmount = (BuildingAutobuyer.buyAmount + 1) % 4;
      this.textContent = amountTexts[BuildingAutobuyer.buyAmount];
      Game.Notify("施設自動購入", `購入数量を「${amountTexts[BuildingAutobuyer.buyAmount]}」に設定しました`, [16, 5], 3);
      return false;
    };
    optionsTable.appendChild(amountRow);

    newSection.appendChild(optionsTable);

    // オプションメニューに追加
    subMenu.appendChild(newSection);
  };

  // 設定行を作成するヘルパー関数
  BuildingAutobuyer.createPreferenceRow = function (name, id, value, description) {
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
  BuildingAutobuyer.getSettingsOptions = function () {
    return {
      AutoBuyerEnabled: {
        label: ["オフ", "オン"],
        desc: "施設自動購入の有効/無効設定",
        type: "bool",
        toggle: true,
        func: function () {
          if (Game.mods.cookieMonsterFramework?.saveData?.cmBuildingAutobuyer?.settings?.AutoBuyerEnabled === 1) {
            BuildingAutobuyer.start();
          } else {
            BuildingAutobuyer.stop();
          }
        },
      },
      BuyAmount: {
        label: ["最適な量", "1個ずつ", "10個ずつ", "100個ずつ"],
        desc: "購入数量の設定",
        type: "bool",
        toggle: false,
        func: function () {
          BuildingAutobuyer.buyAmount = Game.mods.cookieMonsterFramework?.saveData?.cmBuildingAutobuyer?.settings?.BuyAmount || 0;
          const amountTexts = ["最適な量", "1個ずつ", "10個ずつ", "100個ずつ"];
          Game.Notify("施設自動購入", `購入数量を「${amountTexts[BuildingAutobuyer.buyAmount]}」に設定しました`, [16, 5], 3);
        },
      },
    };
  };

  // 設定ヘッダーの作成
  BuildingAutobuyer.setupMenu = function () {
    // CookieMonsterフレームワークがロードされているか確認
    if (!Game.mods.cookieMonsterFramework) {
      return;
    }

    // 施設自動購入のセクションを作成
    if (!Game.mods.cookieMonsterFramework.saveData.cmBuildingAutobuyer) {
      Game.mods.cookieMonsterFramework.saveData.cmBuildingAutobuyer = {
        headers: { BuildingAutobuyer: 1 },
        settings: {
          AutoBuyerEnabled: BuildingAutobuyer.isRunning ? 1 : 0,
          BuyAmount: BuildingAutobuyer.buyAmount,
        },
      };
    }

    // メニューリスナーに登録
    if (Game.mods.cookieMonsterFramework.listeners.optionsMenu) {
      for (let i = 0; i < Game.mods.cookieMonsterFramework.listeners.optionsMenu.length; i++) {
        if (Game.mods.cookieMonsterFramework.listeners.optionsMenu[i].sectionId === "cmBuildingAutobuyer") {
          return;
        }
      }

      Game.mods.cookieMonsterFramework.listeners.optionsMenu.push({
        sectionId: "cmBuildingAutobuyer",
        header: "ビルディング自動購入",
        subHeader: { BuildingAutobuyer: "施設自動購入設定" },
        options: BuildingAutobuyer.getSettingsOptions(),
      });
    }
  };

  // 購入数量を設定するメソッド
  BuildingAutobuyer.setBuyAmount = function (amount) {
    // 有効な値かチェック
    if (typeof amount !== "number" || amount < 0 || amount > 3 || !Number.isInteger(amount)) {
      Game.Notify("施設自動購入", "無効な購入数量です。0:最適な量, 1:単一, 2:10個, 3:100個から選択してください", [16, 5], 5);
      return false;
    }

    // 購入数量を設定
    BuildingAutobuyer.buyAmount = amount;
    // 新しい購入モードでは、以前のターゲット施設をクリア
    BuildingAutobuyer.targetBuilding = null;

    // 設定に反映
    if (Game.mods.cookieMonsterFramework?.saveData?.cmBuildingAutobuyer?.settings) {
      Game.mods.cookieMonsterFramework.saveData.cmBuildingAutobuyer.settings.BuyAmount = amount;
    }

    // オプションメニューのUIを更新
    const amountButton = l("CMBuildingAutobuyerAmount");
    if (amountButton) {
      const amountTexts = ["最適な量", "1個ずつ", "10個ずつ", "100個ずつ"];
      amountButton.textContent = amountTexts[amount];
    }

    const amountTexts = ["最適な量", "単一購入", "10個購入", "100個購入"];
    Game.Notify("施設自動購入", `購入数量を「${amountTexts[amount]}」に設定しました`, [16, 5], 3);
    return true;
  };

  // 現在の購入数量を取得するメソッド
  BuildingAutobuyer.getBuyAmount = function () {
    const amountTexts = ["最適な量", "単一購入", "10個購入", "100個購入"];
    const currentAmount = BuildingAutobuyer.buyAmount;
    Game.Notify("施設自動購入", `現在の購入数量: 「${amountTexts[currentAmount]}」`, [16, 5], 3);
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
    // 保存済みのターゲット施設があるか確認
    if (BuildingAutobuyer.targetBuilding) {
      const building = Game.Objects[BuildingAutobuyer.targetBuilding.name];
      if (!building) {
        BuildingAutobuyer.targetBuilding = null;
        return false;
      }

      // 現在選択されている施設とモードが正しく反映されるよう設定
      const oldBuyMode = Game.buyMode;
      const oldBuyBulk = Game.buyBulk;

      // 購入モードを設定（1=施設購入モード）
      Game.buyMode = 1;
      // 一括購入数を設定
      Game.buyBulk = BuildingAutobuyer.targetBuilding.bulkAmount;
      // 設定を反映させる
      Game.CalculateGains();

      // 正確な購入価格を取得
      const bulkPrice = building.getSumPrice(Game.buyBulk);

      // 現在の購入モードに必要な数量を確保するまで購入しない
      if (Game.cookies >= bulkPrice) {
        // 購入前にもう一度モードを確認
        Game.buyMode = 1;
        Game.buyBulk = BuildingAutobuyer.targetBuilding.bulkAmount;

        // 購入実行
        building.buy();

        // 購入後に元の設定に戻す
        Game.buyMode = oldBuyMode;
        Game.buyBulk = oldBuyBulk;
        Game.CalculateGains();

        // 購入が成功したらターゲットをクリア
        BuildingAutobuyer.targetBuilding = null;
        return true;
      }

      // まだ購入できないので待機（設定を元に戻す）
      Game.buyMode = oldBuyMode;
      Game.buyBulk = oldBuyBulk;
      Game.CalculateGains();
      return false;
    }

    // 新しいベスト購入を見つける
    const best = BuildingAutobuyer.findBestPurchase();
    if (!best) return false;

    const building = Game.Objects[best.name];
    if (!building) {
      return false;
    }

    // 現在選択されている施設とモードが正しく反映されるよう設定
    const oldBuyMode = Game.buyMode;
    const oldBuyBulk = Game.buyBulk;

    // 購入モードを設定（1=施設購入モード）
    Game.buyMode = 1;
    // 一括購入数を設定
    Game.buyBulk = best.bulkAmount;
    // 設定を反映させる
    Game.CalculateGains();

    // 正確な購入価格を取得
    const bulkPrice = building.getSumPrice(Game.buyBulk);

    // 現在選択されている購入量で購入できるかチェック
    if (Game.cookies >= bulkPrice) {
      // 購入前にもう一度モードを確認
      Game.buyMode = 1;
      Game.buyBulk = best.bulkAmount;

      // 購入実行
      building.buy();

      // 購入後に元の設定に戻す
      Game.buyMode = oldBuyMode;
      Game.buyBulk = oldBuyBulk;
      Game.CalculateGains();
      return true;
    }

    // 購入できない場合は、このターゲットを保存して次回も試す
    BuildingAutobuyer.targetBuilding = best;

    // 設定を元に戻す
    Game.buyMode = oldBuyMode;
    Game.buyBulk = oldBuyBulk;
    Game.CalculateGains();
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
      return;
    }
    BuildingAutobuyer.isRunning = true;
    BuildingAutobuyer.timerId = setInterval(BuildingAutobuyer.check, BuildingAutobuyer.interval);

    // 設定に反映
    if (Game.mods.cookieMonsterFramework?.saveData?.cmBuildingAutobuyer?.settings) {
      Game.mods.cookieMonsterFramework.saveData.cmBuildingAutobuyer.settings.AutoBuyerEnabled = 1;
    }

    // 設定UIを更新
    const enableButton = l("CMBuildingAutobuyerEnabled");
    if (enableButton) {
      enableButton.textContent = "ON";
      enableButton.className = "option";
    }

    Game.Notify("施設自動購入", "PP最短の施設を自動的に購入します", [16, 5], 1);
    setTimeout(BuildingAutobuyer.check, BuildingAutobuyer.interval);
  };

  // 自動購入を停止
  BuildingAutobuyer.stop = function () {
    if (!BuildingAutobuyer.isRunning) {
      return;
    }
    BuildingAutobuyer.isRunning = false;
    if (BuildingAutobuyer.timerId) {
      clearInterval(BuildingAutobuyer.timerId);
      BuildingAutobuyer.timerId = null;
    }

    // 設定に反映
    if (Game.mods.cookieMonsterFramework?.saveData?.cmBuildingAutobuyer?.settings) {
      Game.mods.cookieMonsterFramework.saveData.cmBuildingAutobuyer.settings.AutoBuyerEnabled = 0;
    }

    // 設定UIを更新
    const enableButton = l("CMBuildingAutobuyerEnabled");
    if (enableButton) {
      enableButton.textContent = "OFF";
      enableButton.className = "option off";
    }

    // ターゲット施設をクリア
    BuildingAutobuyer.targetBuilding = null;
    Game.Notify("施設自動購入", "自動購入を停止しました", [17, 5], 1);
  };

  // 自動購入の状態を切り替え
  BuildingAutobuyer.toggle = function () {
    BuildingAutobuyer.isRunning ? BuildingAutobuyer.stop() : BuildingAutobuyer.start();
  };

  // 初期化処理
  BuildingAutobuyer.init = function () {
    // CookieClickerが存在するか確認
    if (typeof Game === "undefined") {
      return;
    }

    // l関数が存在するか確認
    if (typeof l !== "function") {
      window.l = function (id) {
        return document.getElementById(id);
      };
    }

    // Game.customOptionsMenuを初期化
    if (!Game.customOptionsMenu) {
      Game.customOptionsMenu = [];
      BuildingAutobuyer.originalUpdateMenu = Game.UpdateMenu;

      // Game.UpdateMenu関数をオーバーライド
      Game.UpdateMenu = function () {
        // 元のメニュー更新関数を実行
        BuildingAutobuyer.originalUpdateMenu();

        // 現在のメニューがオプションメニューであれば、カスタムオプションを追加
        if (Game.onMenu === "prefs") {
          // すべてのカスタムオプションメニュー処理を実行
          Game.customOptionsMenu.forEach(function (customMenuCallback) {
            // 文字列からオブジェクトと関数を取得
            const parts = customMenuCallback.split(".");
            let obj = window;
            let funcName = customMenuCallback;

            if (parts.length > 1) {
              obj = window[parts[0]];
              funcName = parts[1];
            }

            if (obj && typeof obj[funcName] === "function") {
              try {
                obj[funcName]();
              } catch (e) {}
            }
          });
        }
      };
    }

    // カスタムメニューに登録
    const callbackName = "BuildingAutobuyer.addOptionsMenu";
    if (Game.customOptionsMenu.indexOf(callbackName) === -1) {
      Game.customOptionsMenu.push(callbackName);
    }

    // 現在のメニュー状態をチェック
    if (Game.onMenu === "prefs") {
      BuildingAutobuyer.addOptionsMenu();
    } else {
      try {
        // ゲームのOption APIが利用可能ならそれを使う
        if (typeof Game.ShowMenu === "function") {
          Game.ShowMenu("prefs");
        }
      } catch (e) {}
    }

    // グローバルWindowオブジェクトに関数を追加
    if (typeof window.BuildingAutobuyer === "undefined") {
      window.BuildingAutobuyer = BuildingAutobuyer;
    }
  };

  // 初期化を実行
  setTimeout(BuildingAutobuyer.init, 1000);

  // モッドAPIのフック追加
  if (typeof Game !== "undefined") {
    Game.registerMod("CMBuildingAutobuyer", {
      init: function () {
        BuildingAutobuyer.init();

        // メニュー更新が確実に行われるように、Game.ShowMenuをオーバーライド
        if (!BuildingAutobuyer.originalShowMenu && Game.ShowMenu) {
          BuildingAutobuyer.originalShowMenu = Game.ShowMenu;

          Game.ShowMenu = function (what) {
            // 元の関数を呼び出す
            BuildingAutobuyer.originalShowMenu(what);

            // オプションメニューが開かれた場合、設定を表示
            if (what === "prefs") {
              // 一定の遅延を設けてメニュー要素が確実に存在するようにする
              setTimeout(function () {
                if (typeof BuildingAutobuyer.addOptionsMenu === "function") {
                  BuildingAutobuyer.addOptionsMenu();
                }

                // UpgradeAutobuyerも同時に更新
                if (window.UpgradeAutobuyer && typeof window.UpgradeAutobuyer.addOptionsMenu === "function") {
                  window.UpgradeAutobuyer.addOptionsMenu();
                }
              }, 100);
            }
          };
        }

        return true;
      },
    });
  }
})(CMBuildingAutobuyer);

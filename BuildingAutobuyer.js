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

  // 設定データ
  BuildingAutobuyer.config = {
    // 設定のヘッダー名
    header: "CMAutobuyer",
    // 設定項目
    settings: {
      BuildingAutobuyer: {
        label: ["オフ", "オン"],
        desc: "建物自動購入：PP最短の建物を自動的に購入",
        type: "bool",
        toggle: true,
        func: function () {
          if (Game.prefs.BuildingAutobuyer) {
            BuildingAutobuyer.start();
          } else {
            BuildingAutobuyer.stop();
          }
        },
      },
      BuildingAutobuyerAmount: {
        label: ["最適な量", "単一購入", "10個購入", "100個購入"],
        desc: "購入数量設定：自動購入する建物の数量",
        type: "bool",
        toggle: false,
        func: function () {
          BuildingAutobuyer.setBuyAmount(Game.prefs.BuildingAutobuyerAmount || 0);
        },
      },
    },
  };

  BuildingAutobuyer.targetBuilding = null; // 購入待ちの建物を保存

  // デバッグログ
  BuildingAutobuyer.log = function (message) {
    if (BuildingAutobuyer.debug) {
      console.log(`[CM-BA] ${message}`);
    }
  };

  // Game.prefsにデフォルト設定を追加
  BuildingAutobuyer.setupPrefs = function () {
    // すでに設定があれば何もしない
    if (Game.prefs.BuildingAutobuyer !== undefined) return;

    // デフォルト設定を追加
    Game.prefs.BuildingAutobuyer = 0;
    Game.prefs.BuildingAutobuyerAmount = 0;
  };

  // 設定メニューにオプションを追加
  BuildingAutobuyer.addOptionsMenu = function () {
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

          // 設定項目を追加
          // 建物自動購入設定
          const listing1 = document.createElement("div");
          listing1.className = "listing";

          const buildingAutoLabel = document.createElement("a");
          buildingAutoLabel.className = "option" + (Game.prefs.BuildingAutobuyer ? "" : " off");
          buildingAutoLabel.textContent = Game.prefs.BuildingAutobuyer ? "オン" : "オフ";
          buildingAutoLabel.onclick = function () {
            Game.Toggle("BuildingAutobuyer", "buildingAutoLabel", ["オフ", "オン"], function () {
              if (Game.prefs.BuildingAutobuyer) {
                BuildingAutobuyer.start();
              } else {
                BuildingAutobuyer.stop();
              }
            });
          };

          listing1.appendChild(buildingAutoLabel);
          listing1.appendChild(document.createTextNode(" 建物自動購入：PP最短の建物を自動的に購入"));
          cmSection.appendChild(listing1);

          // 購入数量設定
          const listing2 = document.createElement("div");
          listing2.className = "listing";

          const amountLabels = ["最適な量", "単一購入", "10個購入", "100個購入"];

          const amountLabel = document.createElement("a");
          amountLabel.className = "option";
          amountLabel.textContent = amountLabels[Game.prefs.BuildingAutobuyerAmount || 0];
          amountLabel.onclick = function () {
            let amount = Game.prefs.BuildingAutobuyerAmount || 0;
            amount = (amount + 1) % 4;
            Game.prefs.BuildingAutobuyerAmount = amount;
            amountLabel.textContent = amountLabels[amount];
            BuildingAutobuyer.setBuyAmount(amount);
          };

          listing2.appendChild(amountLabel);
          listing2.appendChild(document.createTextNode(" 購入数量設定：自動購入する建物の数量"));
          cmSection.appendChild(listing2);

          // アップグレード自動購入設定
          if (window.CMUpgradeAutobuyer) {
            const listing3 = document.createElement("div");
            listing3.className = "listing";

            const upgradeAutoLabel = document.createElement("a");
            upgradeAutoLabel.className = "option" + (Game.prefs.UpgradeAutobuyer ? "" : " off");
            upgradeAutoLabel.textContent = Game.prefs.UpgradeAutobuyer ? "オン" : "オフ";
            upgradeAutoLabel.onclick = function () {
              Game.Toggle("UpgradeAutobuyer", "upgradeAutoLabel", ["オフ", "オン"], function () {
                if (Game.prefs.UpgradeAutobuyer) {
                  CMUpgradeAutobuyer.start();
                } else {
                  CMUpgradeAutobuyer.stop();
                }
              });
            };

            listing3.appendChild(upgradeAutoLabel);
            listing3.appendChild(document.createTextNode(" アップグレード自動購入：PP最短のアップグレードを自動的に購入"));
            cmSection.appendChild(listing3);

            // スイッチ系除外設定
            const listing4 = document.createElement("div");
            listing4.className = "listing";

            const switchesLabel = document.createElement("a");
            switchesLabel.className = "option" + (Game.prefs.UpgradeExcludeSwitches ? "" : " off");
            switchesLabel.textContent = Game.prefs.UpgradeExcludeSwitches ? "オン" : "オフ";
            switchesLabel.onclick = function () {
              Game.Toggle("UpgradeExcludeSwitches", "switchesLabel", ["オフ", "オン"], function () {
                CMUpgradeAutobuyer.excludeSwitches = Game.prefs.UpgradeExcludeSwitches;
              });
            };

            listing4.appendChild(switchesLabel);
            listing4.appendChild(document.createTextNode(" スイッチ系除外：Golden Switch/Shimmering Veil などを除外"));
            cmSection.appendChild(listing4);

            // 研究除外設定
            const listing5 = document.createElement("div");
            listing5.className = "listing";

            const researchLabel = document.createElement("a");
            researchLabel.className = "option" + (Game.prefs.UpgradeExcludeResearch ? "" : " off");
            researchLabel.textContent = Game.prefs.UpgradeExcludeResearch ? "オン" : "オフ";
            researchLabel.onclick = function () {
              Game.Toggle("UpgradeExcludeResearch", "researchLabel", ["オフ", "オン"], function () {
                CMUpgradeAutobuyer.excludeResearch = Game.prefs.UpgradeExcludeResearch;
              });
            };

            listing5.appendChild(researchLabel);
            listing5.appendChild(document.createTextNode(" 研究除外：負の効果を持つ可能性のある研究アップグレードを除外"));
            cmSection.appendChild(listing5);

            // 契約系除外設定
            const listing6 = document.createElement("div");
            listing6.className = "listing";

            const covenantsLabel = document.createElement("a");
            covenantsLabel.className = "option" + (Game.prefs.UpgradeExcludeCovenants ? "" : " off");
            covenantsLabel.textContent = Game.prefs.UpgradeExcludeCovenants ? "オン" : "オフ";
            covenantsLabel.onclick = function () {
              Game.Toggle("UpgradeExcludeCovenants", "covenantsLabel", ["オフ", "オン"], function () {
                CMUpgradeAutobuyer.excludeCovenants = Game.prefs.UpgradeExcludeCovenants;
              });
            };

            listing6.appendChild(covenantsLabel);
            listing6.appendChild(document.createTextNode(" 契約系除外：Elder Covenantなどの契約系アップグレードを除外"));
            cmSection.appendChild(listing6);
          }

          // メニューに追加
          prefsSection.parentNode.insertBefore(cmSection, prefsSection.nextSibling);
        }
      }
    };
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
    // Game.prefsにも設定
    Game.prefs.BuildingAutobuyerAmount = amount;
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
        BuildingAutobuyer.log(`保存された建物 "${BuildingAutobuyer.targetBuilding.name}" が見つかりません。`);
        BuildingAutobuyer.targetBuilding = null;
        return false;
      }

      // 現在選択されている建物とモードが正しく反映されるよう設定
      const oldBuyMode = Game.buyMode;
      const oldBuyBulk = Game.buyBulk;

      // 購入モードを設定（1=建物購入モード）
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

        BuildingAutobuyer.log(
          `購入成功: ${BuildingAutobuyer.targetBuilding.name} x${BuildingAutobuyer.targetBuilding.bulkAmount} (PP: ${BuildingAutobuyer.targetBuilding.pp.toFixed(
            2
          )}, 価格: ${bulkPrice.toLocaleString()})`
        );

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

      // 価格が足りない場合は待機メッセージ
      BuildingAutobuyer.log(
        `待機中: ${BuildingAutobuyer.targetBuilding.name} x${BuildingAutobuyer.targetBuilding.bulkAmount} (必要: ${bulkPrice.toLocaleString()}, 現在: ${Game.cookies.toLocaleString()})`
      );
      return false;
    }

    // 新しいベスト購入を見つける
    const best = BuildingAutobuyer.findBestPurchase();
    if (!best) return false;

    const building = Game.Objects[best.name];
    if (!building) {
      BuildingAutobuyer.log(`建物 "${best.name}" が見つかりません。`);
      return false;
    }

    // 現在選択されている建物とモードが正しく反映されるよう設定
    const oldBuyMode = Game.buyMode;
    const oldBuyBulk = Game.buyBulk;

    // 購入モードを設定（1=建物購入モード）
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

      BuildingAutobuyer.log(`購入成功: ${best.name} x${best.bulkAmount} (PP: ${best.pp.toFixed(2)}, 価格: ${bulkPrice.toLocaleString()})`);

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

    BuildingAutobuyer.log(`待機対象を設定: ${best.name} x${best.bulkAmount} (必要: ${bulkPrice.toLocaleString()}, 現在: ${Game.cookies.toLocaleString()})`);
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
      BuildingAutobuyer.log("建物自動購入は既に実行中です。");
      return;
    }
    BuildingAutobuyer.isRunning = true;
    // Game.prefsにも設定
    Game.prefs.BuildingAutobuyer = 1;
    // タイマー開始
    BuildingAutobuyer.timerId = setInterval(BuildingAutobuyer.check, BuildingAutobuyer.interval);
    Game.Notify("建物自動購入", "PP最短の建物を自動的に購入します", [16, 5], 1);
    BuildingAutobuyer.log("建物自動購入を開始しました。");
    setTimeout(BuildingAutobuyer.check, BuildingAutobuyer.interval);

    // 現在オプション画面を表示中なら更新
    if (Game.onMenu === "prefs") {
      Game.UpdateMenu();
    }
  };

  // 自動購入を停止
  BuildingAutobuyer.stop = function () {
    if (!BuildingAutobuyer.isRunning) {
      BuildingAutobuyer.log("建物自動購入は実行されていません。");
      return;
    }
    BuildingAutobuyer.isRunning = false;
    // Game.prefsにも設定
    Game.prefs.BuildingAutobuyer = 0;
    if (BuildingAutobuyer.timerId) {
      clearInterval(BuildingAutobuyer.timerId);
      BuildingAutobuyer.timerId = null;
    }
    // ターゲット建物をクリア
    BuildingAutobuyer.targetBuilding = null;
    Game.Notify("建物自動購入", "自動購入を停止しました", [17, 5], 1);
    BuildingAutobuyer.log("建物自動購入を停止しました。");

    // 現在オプション画面を表示中なら更新
    if (Game.onMenu === "prefs") {
      Game.UpdateMenu();
    }
  };

  // 自動購入の状態を切り替え
  BuildingAutobuyer.toggle = function () {
    BuildingAutobuyer.isRunning ? BuildingAutobuyer.stop() : BuildingAutobuyer.start();
  };

  // 初期化処理
  BuildingAutobuyer.init = function () {
    // Game.prefsに設定を追加
    BuildingAutobuyer.setupPrefs();

    // オプションメニューに設定を追加
    BuildingAutobuyer.addOptionsMenu();

    // 既存の設定から状態復元
    if (Game.prefs.BuildingAutobuyer) {
      BuildingAutobuyer.start();
    }

    // 購入数量を設定
    if (typeof Game.prefs.BuildingAutobuyerAmount === "number") {
      BuildingAutobuyer.setBuyAmount(Game.prefs.BuildingAutobuyerAmount);
    }

    // メニューを更新
    Game.UpdateMenu();
  };

  // 初期化時のメッセージ
  console.log("Cookie Monster - 建物自動購入 (CM-BuildingAutobuyer) が読み込まれました。");
  console.log("使用方法: CMBuildingAutobuyer.start() で開始、CMBuildingAutobuyer.stop() で停止");
  console.log("購入数量設定: CMBuildingAutobuyer.setBuyAmount(数量) で変更（0:最適な量, 1:単一, 2:10個, 3:100個）");
  console.log("購入数量確認: CMBuildingAutobuyer.getBuyAmount() で現在の設定を確認できます");
  console.log("設定はCookie Clickerのオプション画面からも変更できます");
  Game.Notify("CM-BuildingAutobuyer", "建物自動購入スクリプトが読み込まれました", [4, 6], 5);

  // 初期化を実行（Game.ready後に行う）
  if (Game && Game.ready) {
    BuildingAutobuyer.init();
  } else {
    const checkGameLoaded = setInterval(function () {
      if (Game && Game.ready) {
        clearInterval(checkGameLoaded);
        BuildingAutobuyer.init();
      }
    }, 1000);
  }

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

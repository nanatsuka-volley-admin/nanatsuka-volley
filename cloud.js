
(function () {
  "use strict";

  const SUPABASE_URL =
    "https://wpxqmspnwwjelhjogpds.supabase.co";
  const SUPABASE_KEY =
    "sb_publishable_T_A0I67ODLCEh0O7JT1Eyg_BMvnb97x";

  let client;
  let user = null;
  let syncEnabled = false;
  let timer = null;
  let syncing = false;

  const panel = document.createElement("section");
  panel.className = "card";
  panel.id = "cloud-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <h2>☁️ クラウド保存</h2>
    <p id="cloud-status">接続を確認中...</p>
    <div id="cloud-controls" class="row"></div>
  `;
  const main = document.querySelector("main");
  const cloudEntry = document.getElementById("cloud-entry");
  const openButton = document.getElementById("cloud-open-button");
  if (!cloudEntry || !openButton || !main) return;
  openButton.setAttribute("aria-expanded", "false");
  openButton.setAttribute("aria-controls", "cloud-panel");
  cloudEntry.after(panel);

  const status = document.getElementById("cloud-status");
  const controls = document.getElementById("cloud-controls");

  function message(text) {
    status.textContent = text;
  }

  function addButton(label, callback) {
    const button = document.createElement("button");
    button.textContent = label;
    button.addEventListener("click", callback);
    controls.appendChild(button);
  }

  function getLocalData() {
    return {
      players: data.players,
      matches: data.matches,
      current: data.current ?? null
    };
  }

  function validData(value) {
    return value &&
      Array.isArray(value.players) &&
      Array.isArray(value.matches);
  }

  async function getCloudData() {
    const response = await client
      .from("volley_data")
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle();

    if (response.error) throw response.error;
    return response.data?.data ?? null;
  }

  async function saveCloud() {
    if (!user || syncing) return;

    syncing = true;
    try {
      const response = await client
        .from("volley_data")
        .upsert({
          user_id: user.id,
          data: getLocalData(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: "user_id"
        });

      if (response.error) throw response.error;

      syncEnabled = true;
      message("☁️ クラウド保存済み");
      return true;
    } catch (error) {
      message("保存エラー: " + error.message);
    } finally {
      syncing = false;
    }
  }

  async function loadCloud() {
    try {
      const cloudData = await getCloudData();

      if (!validData(cloudData)) {
        message("クラウドに記録がありません");
        return;
      }

      if (!confirm(
        "端末の記録をクラウドの記録で置き換えます。バックアップ済みですか？"
      )) return;

      data = {
        players: cloudData.players,
        matches: cloudData.matches,
        current: cloudData.current ?? null
      };

      localStorage.setItem(KEY, JSON.stringify(data));
      draw();

      syncEnabled = true;
      message("☁️ クラウドから読み込みました");
    } catch (error) {
      message("読み込みエラー: " + error.message);
    }
  }

  function showControls() {
    controls.replaceChildren();

    if (!user) {
      syncEnabled = false;
      message("ログインするとクラウド保存を利用できます");

      const email = document.createElement("input");
      email.type = "email";
      email.placeholder = "メールアドレス";

      const password = document.createElement("input");
      password.type = "password";
      password.placeholder = "パスワード";

      controls.append(email, password);

      addButton("ログイン", async () => {
        const response = await client.auth.signInWithPassword({
          email: email.value.trim(),
          password: password.value
        });

        if (response.error) {
          message("ログインエラー: " + response.error.message);
        }
      });

      addButton("パスワード再設定", async () => {
        if (!email.value.trim()) {
          message("メールアドレスを入力してください");
          return;
        }

        const response = await client.auth.resetPasswordForEmail(
          email.value.trim(),
          { redirectTo: location.origin + location.pathname }
        );

        message(response.error
          ? "送信エラー: " + response.error.message
          : "再設定メールを送信しました");
      });

      return;
    }

    message("ログイン済み。保存方法を選んでください");

    addButton("端末の記録をクラウドに保存", async () => {
      try {
        const existing = await getCloudData();

        if (existing && !confirm(
          "クラウドの既存データを上書きします。よろしいですか？"
        )) return;

        await saveCloud();
      } catch (error) {
        message("確認エラー: " + error.message);
      }
    });

    addButton("クラウドの記録を端末に読み込む", loadCloud);

    addButton("⌚ Watch連携を設定", async () => {
      if (!data.current || !data.matches.some(m => String(m.id) === String(data.current))) {
        message("先に記録する試合を開いてください"); return;
      }
      if (!confirm("現在開いている試合にApple Watchを連携します。以前のWatch連携キーは無効になります。続けますか？")) return;
      try {
        const session = (await client.auth.getSession()).data.session;
        if (!session) throw new Error("再ログインしてください");
        const response = await fetch(SUPABASE_URL + "/functions/v1/watch-point", {
          method: "POST", headers: {"Content-Type":"application/json","Authorization":"Bearer "+session.access_token},
          body: JSON.stringify({action:"register",match_id:String(data.current)})
        });
        const result = await response.json();
        if (!response.ok || !result.token) throw new Error(result.error || "連携できません");
        const url = SUPABASE_URL + "/functions/v1/watch-point";
        const box = document.createElement("textarea");
        box.readOnly = true; box.rows = 3; box.style.width = "100%";
        box.value = result.token;
        controls.appendChild(box);
        addButton("連携キーをコピー", () => navigator.clipboard.writeText(result.token).then(() => message("キーをコピーしました")).catch(() => message("上のキーを長押ししてコピーしてください")));
        message("⌚ 連携キーを発行しました。ショートカットのURL: " + url + " ／キーは他人に見せないでください。");
      } catch (error) { message("Watch連携エラー: " + error.message); }
    });

    addButton("⌚ Watchの記録を取り込む", async () => {
      if (!syncEnabled) { message("先に「端末の記録をクラウドに保存」を押してください"); return; }
      try {
        const response = await client.from("watch_events").select("id,side,reason,player_id,match_id,created_at").order("created_at",{ascending:true}).limit(100);
        if (response.error) throw response.error;
        const events = response.data || [];
        if (!events.length) { message("未取込のWatch記録はありません"); return; }
        const m = data.matches.find(x => String(x.id) === String(data.current));
        if (!m || events.some(x => String(x.match_id) !== String(m.id))) {
          message("Watchの記録先と開いている試合が違います。該当試合を開いてから取り込んでください"); return;
        }
        if (!confirm("Watchの" + events.length + "件を現在の試合へ反映しますか？")) return;
        let count = 0;
        for (const e of events) {
          if (typeof setFinished === "function" && (setFinished(m) || courtChangeDue(m))) break;
          if (!m.serving || (m.serveOrder||[]).filter(x => x!=null).length !== 6) break;
          const before = (m.pointEvents||[]).length;
          score(e.side,1,e.reason,e.player_id ?? null,"Apple Watch");
          if ((m.pointEvents||[]).length === before) break;
          count++;
        }
        if (!count) { message("取込できません。サーブ順・サーブ権・セット状態を確認してください"); return; }
        const saved = await saveCloud();
        if (saved !== true) { message("端末には" + count + "件反映しましたがクラウド保存に失敗。再取込せず、通信を確認してください"); return; }
        const ids = events.slice(0,count).map(e => e.id);
        const del = await client.from("watch_events").delete().in("id",ids);
        message(del.error ? "記録は保存済みですが受付一覧の削除に失敗: "+del.error.message : "⌚ "+count+"件を取り込みました");
      } catch(error) { message("取込エラー: "+error.message); }
    });

    addButton("ログアウト", async () => {
      syncEnabled = false;
      await client.auth.signOut();
    });
  }

  window.queueCloudSave = function () {
    if (!syncEnabled || !user) return;

    clearTimeout(timer);
    timer = setTimeout(() => {
      if (syncing) {
        window.queueCloudSave();
      } else {
        saveCloud();
      }
    }, 1500);
  };

  if (!window.supabase) {
    message("Supabaseライブラリが読み込まれていません");
    return;
  }

  client = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  client.auth.onAuthStateChange((event, session) => {
    user = session?.user ?? null;

    if (event === "PASSWORD_RECOVERY") {
      const password = prompt(
        "新しいパスワードを入力してください（8文字以上）"
      );

      if (password && password.length >= 8) {
        setTimeout(async () => {
          const result = await client.auth.updateUser({
            password
          });
          message(result.error
            ? "設定エラー: " + result.error.message
            : "パスワードを設定しました");
        }, 0);
      }
      return;
    }

    if (event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "INITIAL_SESSION") {
      showControls();
    }
  });
})();


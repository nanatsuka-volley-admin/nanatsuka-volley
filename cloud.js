
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
  const cloudEntry = document.createElement("div");
  cloudEntry.style.cssText = "text-align:center;margin:18px 0 24px";
  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.textContent = "☁️ クラウド保存・ログイン";
  openButton.style.cssText = "width:100%;font-weight:700";
  openButton.setAttribute("aria-expanded", "false");
  openButton.setAttribute("aria-controls", "cloud-panel");
  openButton.addEventListener("click", () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    openButton.textContent = opening ? "☁️ クラウド保存を閉じる" : "☁️ クラウド保存・ログイン";
    openButton.setAttribute("aria-expanded", String(opening));
    if (opening) panel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  cloudEntry.appendChild(openButton);
  main.append(cloudEntry, panel);

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


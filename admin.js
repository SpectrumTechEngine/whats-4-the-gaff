/* =========================================================
   What's 4 the Gaff — owner tools (The Spectrum Tech Engine)

   Hidden from everyone else: tap the "Created by The Spectrum Tech
   Engine" badge 5 times quickly and enter the code to unlock this
   device. The database rules check the code, not this file.

   Also, for everyone:
   - app notices (pop-ups) and the maintenance banner
   - a daily tally of items added and ticked off (numbers only)
   - feature switches: window.featureOn(name, gaffCode)

   Never reads what's on anyone's list. The only time list entries
   are touched is when a house is deleted on request, and then they
   are deleted without being shown.
   ========================================================= */
(() => {
  const STE_ALT = "Created by The Spectrum Tech Engine";
  const TAPS = 5, TAP_WINDOW = 2500;
  const MAX_WRONG = 5, LOCKOUT = 60 * 60 * 1000;
  const DAYMS = 24 * 60 * 60 * 1000;

  const live = () => S.backend && S.backend.mode === "live" && S.uid;
  const fs = () => firebase.firestore();
  const FV = () => firebase.firestore.FieldValue;
  const h = (s) => (typeof esc === "function" ? esc(s) : String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const dublinDay = (ms = Date.now()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(new Date(ms));
  const fmtDate = (ms) => ms ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(ms)) : "–";
  const local = {
    get(k, d) { try { const v = localStorage.getItem("w4tg-adm-" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { v == null ? localStorage.removeItem("w4tg-adm-" + k) : localStorage.setItem("w4tg-adm-" + k, JSON.stringify(v)); } catch (e) {} },
  };
  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  /* ---------------- styles ---------------- */
  const css = document.createElement("style");
  css.textContent = `
  .adm-layer { position: fixed; inset: 0; z-index: 90; background: rgba(28,22,18,.55); display: grid; place-items: center; padding: 1rem; }
  .adm-card { width: min(100%, 26rem); max-height: 86dvh; overflow-y: auto; background: var(--cream); color: var(--ink); border-radius: 1.1rem; padding: 1.25rem 1.2rem; box-shadow: 0 24px 60px -18px rgba(0,0,0,.6); font-family: var(--ui); }
  .adm-card.wide { width: min(100%, 34rem); }
  .adm-card h2 { margin: 0 0 .6rem; font-size: 1.25rem; font-weight: 800; }
  .adm-card h3 { margin: 1.1rem 0 .45rem; font-size: .72rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .adm-card p { margin: .3rem 0; }
  .adm-muted { color: var(--muted); font-size: .85rem; }
  .adm-card input[type=text], .adm-card input[type=password], .adm-card input[type=date], .adm-card textarea, .adm-card select {
    width: 100%; box-sizing: border-box; font: inherit; color: var(--ink); background: #fff; border: 1.5px solid var(--rule); border-radius: .7rem; padding: .6rem .7rem; }
  .adm-card textarea { min-height: 6rem; resize: vertical; }
  .adm-row { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .6rem; }
  .adm-btn { font: inherit; font-weight: 800; font-size: .9rem; border: 1.5px solid var(--rule); background: #fff; color: var(--ink); border-radius: 999px; padding: .5rem .95rem; cursor: pointer; }
  .adm-btn.go { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
  .adm-btn.danger { color: var(--accent); border-color: var(--accent); }
  .adm-btn:disabled { opacity: .5; cursor: default; }
  .adm-tabs { display: flex; flex-wrap: wrap; gap: .35rem; margin: .2rem 0 .4rem; }
  .adm-tabs button { font: inherit; font-weight: 800; font-size: .82rem; border: 0; background: var(--paper); color: var(--ink); border-radius: 999px; padding: .4rem .8rem; cursor: pointer; }
  .adm-tabs button[aria-selected=true] { background: var(--ink); color: var(--cream); }
  .adm-top { display: flex; justify-content: space-between; align-items: center; gap: .5rem; }
  .adm-x { font: inherit; font-size: 1.4rem; line-height: 1; border: 0; background: none; cursor: pointer; color: var(--muted); padding: .2rem .4rem; }
  .adm-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr)); gap: .5rem; }
  .adm-stat { background: var(--paper); border-radius: .8rem; padding: .6rem .7rem; }
  .adm-stat b { display: block; font-size: 1.5rem; font-variant-numeric: tabular-nums; }
  .adm-stat span { font-size: .78rem; color: var(--muted); }
  .adm-list { list-style: none; margin: 0; padding: 0; display: grid; gap: .5rem; }
  .adm-list > li { background: #fff; border: 1px solid var(--rule); border-radius: .8rem; padding: .6rem .75rem; }
  .adm-list .head { display: flex; justify-content: space-between; gap: .5rem; flex-wrap: wrap; }
  .adm-list .head strong { overflow-wrap: anywhere; }
  .adm-people { list-style: none; margin: .5rem 0 0; padding: 0; display: grid; gap: .3rem; }
  .adm-people li { display: flex; justify-content: space-between; align-items: center; gap: .5rem; font-size: .9rem; }
  .adm-msg { margin-top: .5rem; font-size: .85rem; color: var(--muted); min-height: 1.2em; }
  .adm-confirm { margin-top: .6rem; padding: .6rem .7rem; border: 1.5px solid var(--accent); border-radius: .8rem; font-size: .9rem; }
  .adm-flag { display: flex; justify-content: space-between; align-items: center; gap: .5rem; flex-wrap: wrap; }
  .adm-flag select { width: auto; }
  /* app notice (pop-up) */
  .gaff-notice { width: min(100%, 24rem); background: var(--paper); color: var(--ink); border-radius: 1rem; padding: 1.2rem 1.2rem 1rem; box-shadow: 0 24px 60px -18px rgba(0,0,0,.6); font-family: var(--ui); }
  .gaff-notice .gn-head { display: flex; align-items: center; gap: .6rem; margin-bottom: .7rem; }
  .gaff-notice .gn-head img { width: 2.4rem; height: 2.4rem; border-radius: .6rem; }
  .gaff-notice .gn-head strong { font-size: 1.05rem; font-weight: 800; }
  .gaff-notice .gn-body { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 1rem; line-height: 1.5; margin: 0 0 1rem; }
  .gaff-notice .adm-btn { width: 100%; }
  /* maintenance banner */
  .gaff-banner { position: fixed; left: 0; right: 0; top: 0; z-index: 80; padding: calc(.45rem + env(safe-area-inset-top, 0px)) 1rem .45rem; background: var(--tape); color: var(--ink); font-family: var(--ui); font-weight: 700; font-size: .88rem; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,.2); }
  body.has-gaff-banner { padding-top: 2.4rem; }
  `;
  document.head.append(css);

  function layer(html, cls = "adm-card") {
    const wrap = document.createElement("div");
    wrap.className = "adm-layer";
    wrap.innerHTML = `<div class="${cls}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.append(wrap);
    return wrap;
  }

  /* ---------------- wait for the app to be ready ---------------- */
  function whenReady(fn) {
    const t = setInterval(() => {
      if (S.backend && S.uid && S.profile !== undefined && window.firebase) { clearInterval(t); fn(); }
    }, 300);
  }

  /* ================= For everyone ================= */

  /* Daily numbers only: how many items were added and ticked off, and which houses were active. */
  const touched = {};
  window.gaffStats = {
    added(code) { bump("added", code); },
    ticked(code) { bump("ticked", code); },
  };
  function bump(field, code) {
    if (!live()) return;
    fs().doc("stats/" + dublinDay()).set({ [field]: FV().increment(1), gaffs: FV().arrayUnion(code) }, { merge: true }).catch(() => {});
    // remember when each house was last used (at most every 10 minutes per house)
    if (!touched[code] || Date.now() - touched[code] > 10 * 60 * 1000) {
      touched[code] = Date.now();
      fs().doc("gaffs/" + code).update({ lastActiveAt: Date.now() }).catch(() => {});
    }
  }

  /* Feature switches: off, on for the owner's own houses only, or on for everyone. */
  let FLAGS = {};
  window.featureOn = (name, code) => {
    const f = FLAGS[name];
    if (!f) return false;
    if (f.mode === "all") return true;
    return f.mode === "mine" && !!code && (f.gaffs || []).includes(code);
  };

  /* Maintenance banner */
  function showBanner(b) {
    let el = document.querySelector(".gaff-banner");
    const on = b && b.on && b.text;
    document.body.classList.toggle("has-gaff-banner", !!on);
    if (!on) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("div"); el.className = "gaff-banner"; el.setAttribute("role", "status"); document.body.append(el); }
    el.textContent = b.text;
  }

  /* App notices: the newest one meant for this person, shown once, next time they open the app. */
  let noticeShown = false;
  async function checkNotices() {
    if (noticeShown || !live() || !S.profile) return;
    try {
      const seen = new Set(S.profile.seenNotices || []);
      const now = Date.now();
      const lists = [await fs().collection("notices").get()];
      for (const c of (S.profile.gaffs || [])) lists.push(await fs().collection(`gaffs/${c}/notices`).get().catch(() => null));
      const all = [];
      lists.forEach(q => q && q.forEach(d => all.push({ id: d.id, ...d.data() })));
      const n = all.filter(x => !x.withdrawn && (!x.until || x.until > now) && !seen.has(x.id)).sort((a, b) => b.at - a.at)[0];
      if (!n) return;
      noticeShown = true;
      showNotice(n.text, () => fs().doc("users/" + S.uid).set({ seenNotices: FV().arrayUnion(n.id) }, { merge: true }).catch(() => {}));
    } catch (e) { console.warn("notices", e); }
  }
  function showNotice(text, onClose) {
    const w = layer(`
      <div class="gn-head"><img src="whats4thegafficon.png" alt=""><strong>What's 4 the Gaff</strong></div>
      <p class="gn-body"></p>
      <button class="adm-btn go" type="button">Close</button>`, "gaff-notice");
    w.querySelector(".gn-body").textContent = text;
    const close = () => { w.remove(); onClose && onClose(); };
    w.querySelector("button").onclick = close;
    w.addEventListener("click", e => { if (e.target === w) close(); });
    w.querySelector("button").focus();
  }

  whenReady(() => {
    if (!live()) return;
    fs().doc("config/banner").onSnapshot(s => showBanner(s.exists ? s.data() : null), () => {});
    fs().doc("config/flags").onSnapshot(s => { FLAGS = (s.exists && s.data().flags) || {}; }, () => {});
    // wait until the person has a name (past the welcome screen) before showing a notice
    const t = setInterval(() => { if (S.profile && S.profile.name) { clearInterval(t); checkNotices(); } }, 1000);
    // refresh whether this device is unlocked
    fs().doc("admins/" + S.uid).get().then(s => local.set("on", s.exists)).catch(() => {});
  });

  /* ================= Owner only ================= */

  /* 5 quick taps on the STE badge */
  let taps = [];
  document.addEventListener("click", (e) => {
    const img = e.target.closest && e.target.closest(`img[alt="${STE_ALT}"]`);
    if (!img) return;
    const now = Date.now();
    taps = taps.filter(t => now - t < TAP_WINDOW).concat(now);
    if (taps.length < TAPS) return;
    taps = [];
    if (!live()) return;
    if (local.get("on", false)) openAdmin();
    else askCode();
  }, true);

  function askCode() {
    if (Date.now() < local.get("lockUntil", 0)) return;   // too many wrong tries: stay quiet for an hour
    const w = layer(`
      <form>
        <p style="margin:0 0 .6rem;font-weight:800">Enter code</p>
        <input type="password" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Code">
        <div class="adm-row"><button class="adm-btn go" type="submit">OK</button><button class="adm-btn" type="button" data-x>Cancel</button></div>
      </form>`);
    const input = w.querySelector("input");
    input.focus();
    w.querySelector("[data-x]").onclick = () => w.remove();
    w.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const code = input.value.trim();
      w.remove();
      if (!code) return;
      try {
        await fs().doc("admins/" + S.uid).set({ key: await sha256(code), at: Date.now() });
        local.set("on", true); local.set("wrong", 0);
        openAdmin();
      } catch (err) {
        const wrong = local.get("wrong", 0) + 1;
        local.set("wrong", wrong);
        if (wrong >= MAX_WRONG) { local.set("lockUntil", Date.now() + LOCKOUT); local.set("wrong", 0); }
      }
    };
  }

  /* ---------------- the admin panel ---------------- */
  let panel = null, tab = "popups";
  const TABS = [["popups", "Pop-ups"], ["houses", "Houses"], ["stats", "Stats"], ["banner", "Banner"], ["features", "Features"]];

  function openAdmin() {
    if (panel) panel.remove();
    panel = layer(`
      <div class="adm-top"><h2>Owner tools</h2><button class="adm-x" type="button" aria-label="Close" data-close>&times;</button></div>
      <div class="adm-tabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}">${l}</button>`).join("")}</div>
      <div data-body></div>
      <div class="adm-row" style="margin-top:1.2rem"><button class="adm-btn go" type="button" data-ste>All-app numbers</button><button class="adm-btn" type="button" data-lock>Lock owner tools on this device</button></div>
      <p class="adm-msg" data-msg aria-live="polite"></p>`, "adm-card wide");
    panel.querySelector("[data-close]").onclick = closeAdmin;
    panel.addEventListener("click", e => { if (e.target === panel) closeAdmin(); });
    panel.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; showTab(); });
    // the numbers shared by every Spectrum Tech Engine app (ste-owner.js), unlocked with the STE owner code
    panel.querySelector("[data-ste]").onclick = () => {
      if (window.STE && window.STE.openOwner) { closeAdmin(); window.STE.openOwner(); }
      else msg("The shared numbers haven't loaded yet. Try again in a moment.");
    };
    panel.querySelector("[data-lock]").onclick = async () => {
      try { await fs().doc("admins/" + S.uid).delete(); } catch (e) {}
      local.set("on", false); closeAdmin();
    };
    showTab();
  }
  function closeAdmin() { if (panel) panel.remove(); panel = null; }
  const body = () => panel.querySelector("[data-body]");
  const msg = (t) => { if (panel) panel.querySelector("[data-msg]").textContent = t || ""; };
  function showTab() {
    panel.querySelectorAll("[data-tab]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    msg("");
    ({ popups: tabPopups, houses: tabHouses, stats: tabStats, banner: tabBanner, features: tabFeatures })[tab]();
  }
  function confirmIn(el, text, yesLabel, run) {
    el.querySelector(".adm-confirm")?.remove();
    const c = document.createElement("div");
    c.className = "adm-confirm";
    c.innerHTML = `<p style="margin:0 0 .5rem"></p><div class="adm-row" style="margin:0"><button class="adm-btn go" type="button">${h(yesLabel)}</button><button class="adm-btn" type="button">Cancel</button></div>`;
    c.querySelector("p").textContent = text;
    const [yes, no] = c.querySelectorAll("button");
    no.onclick = () => c.remove();
    yes.onclick = async () => { yes.disabled = true; try { await run(); } finally { c.remove(); } };
    el.append(c);
  }

  /* houses, read once per panel visit */
  async function loadHouses() {
    const q = await fs().collection("gaffs").get();
    return q.docs.map(d => ({ code: d.id, ...d.data() })).sort((a, b) => (b.lastActiveAt || b.createdAt || 0) - (a.lastActiveAt || a.createdAt || 0));
  }
  async function loadMembers(code) {
    const q = await fs().collection(`gaffs/${code}/members`).get();
    return q.docs.map(d => ({ uid: d.id, ...d.data() }));
  }

  /* ---- Pop-ups ---- */
  async function tabPopups(prefillGaff) {
    body().innerHTML = `
      <h3>New pop-up</h3>
      <textarea data-text maxlength="1000" placeholder="What should everyone see next time they open the app?"></textarea>
      <div class="adm-row">
        <select data-to style="flex:1 1 12rem"><option value="">Everyone</option></select>
        <input type="date" data-until style="flex:1 1 9rem" aria-label="Stop showing after (optional)">
      </div>
      <p class="adm-muted">The date is optional: the pop-up stops showing after that day. Pop-ups look like they come from the app, not from a person.</p>
      <div class="adm-row"><button class="adm-btn" type="button" data-preview>Preview</button><button class="adm-btn go" type="button" data-send>Send</button></div>
      <div data-confirm-here></div>
      <h3>Sent</h3><ul class="adm-list" data-sent><li class="adm-muted">Loading…</li></ul>`;
    const b = body();
    const to = b.querySelector("[data-to]");
    let houses = [];
    try { houses = await loadHouses(); } catch (e) { console.warn(e); }
    houses.forEach(g => { const o = document.createElement("option"); o.value = g.code; o.textContent = `Only ${g.name} (${g.code})`; to.append(o); });
    if (prefillGaff) to.value = prefillGaff;
    const draft = () => {
      const text = b.querySelector("[data-text]").value.trim();
      if (!text) { msg("Write the message first."); return null; }
      const u = b.querySelector("[data-until]").value;
      const until = u ? new Date(u + "T23:59:59").getTime() : null;
      if (until && until < Date.now()) { msg("That date has already passed."); return null; }
      return { text, gaff: to.value || null, until };
    };
    b.querySelector("[data-preview]").onclick = () => { const d = draft(); if (d) showNotice(d.text); };
    b.querySelector("[data-send]").onclick = () => {
      const d = draft(); if (!d) return;
      const who = d.gaff ? `everyone in ${houses.find(x => x.code === d.gaff)?.name || d.gaff}` : "everyone";
      confirmIn(b.querySelector("[data-confirm-here]"), `Send this pop-up to ${who}? They'll see it next time they open the app.`, "Yes, send it", async () => {
        try {
          const ref = d.gaff ? fs().collection(`gaffs/${d.gaff}/notices`) : fs().collection("notices");
          await ref.add({ text: d.text, until: d.until, at: Date.now(), withdrawn: false, gaff: d.gaff });
          msg("Pop-up sent."); tabPopups();
        } catch (e) { console.warn(e); msg("It didn't send. Check your connection and try again."); }
      });
    };
    // everything sent, newest first
    const sent = b.querySelector("[data-sent]");
    try {
      const q = await fs().collectionGroup("notices").get();
      const all = q.docs.map(d => ({ ref: d.ref, id: d.id, ...d.data() })).sort((a, c) => c.at - a.at).slice(0, 30);
      if (!all.length) { sent.innerHTML = `<li class="adm-muted">Nothing sent yet.</li>`; return; }
      const now = Date.now();
      sent.innerHTML = "";
      all.forEach(n => {
        const liveNow = !n.withdrawn && (!n.until || n.until > now);
        const li = document.createElement("li");
        const where = n.gaff ? (houses.find(x => x.code === n.gaff)?.name || n.gaff) : "Everyone";
        li.innerHTML = `<div class="head"><span class="adm-muted">${h(fmtDate(n.at))} · ${h(where)}</span><span class="adm-muted">${n.withdrawn ? "Withdrawn" : liveNow ? (n.until ? "Showing until " + h(fmtDate(n.until)) : "Showing") : "Ended"}</span></div><p></p>`;
        li.querySelector("p").textContent = n.text;
        if (liveNow) {
          const w = document.createElement("button");
          w.className = "adm-btn danger"; w.type = "button"; w.textContent = "Withdraw";
          w.onclick = async () => {
            if (w.dataset.armed !== "1") { w.dataset.armed = "1"; w.textContent = "Tap again to withdraw"; return; }
            w.disabled = true;
            try { await n.ref.update({ withdrawn: true }); tabPopups(); } catch (e) { msg("Couldn't withdraw it. Try again."); w.disabled = false; }
          };
          li.append(w);
        }
        sent.append(li);
      });
    } catch (e) { console.warn(e); sent.innerHTML = `<li class="adm-muted">Couldn't load sent pop-ups.</li>`; }
  }

  /* ---- Houses: names, who's in them, remove a person, delete a house ---- */
  async function tabHouses() {
    body().innerHTML = `<p class="adm-muted">House names and who's in them. What's on their lists is never shown.</p>
      <input type="text" data-find placeholder="Find a house by name or code" style="margin:.4rem 0 .6rem">
      <ul class="adm-list" data-houses><li class="adm-muted">Loading…</li></ul>`;
    let houses;
    try { houses = await loadHouses(); } catch (e) { console.warn(e); body().querySelector("[data-houses]").innerHTML = `<li class="adm-muted">Couldn't load the houses.</li>`; return; }
    const list = body().querySelector("[data-houses]");
    const draw = (filter) => {
      const f = (filter || "").trim().toLowerCase();
      const shown = houses.filter(g => !f || (g.name || "").toLowerCase().includes(f) || g.code.toLowerCase().includes(f));
      list.innerHTML = shown.length ? "" : `<li class="adm-muted">No houses match.</li>`;
      shown.forEach(g => {
        const li = document.createElement("li");
        li.innerHTML = `<div class="head"><strong></strong><span class="adm-muted">${h(g.code)}</span></div>
          <p class="adm-muted">Started ${h(fmtDate(g.createdAt))} · Last used ${h(fmtDate(g.lastActiveAt))}</p>
          <ul class="adm-people"><li class="adm-muted">Loading people…</li></ul>
          <div class="adm-row"><button class="adm-btn" type="button" data-pop>Send a pop-up to this house</button><button class="adm-btn danger" type="button" data-del>Delete house</button></div>`;
        li.querySelector("strong").textContent = g.name || "(no name)";
        list.append(li);
        loadMembers(g.code).then(ms => {
          const ul = li.querySelector(".adm-people");
          ul.innerHTML = ms.length ? "" : `<li class="adm-muted">Nobody left in this house.</li>`;
          ms.forEach(m => {
            const p = document.createElement("li");
            p.innerHTML = `<span></span><button class="adm-btn danger" type="button">Remove</button>`;
            p.querySelector("span").textContent = `${m.display || "Someone"} · joined ${fmtDate(m.joinedAt)}`;
            p.querySelector("button").onclick = () => confirmIn(li, `Remove ${m.display || "this person"} from ${g.name}? They'll stop seeing the list. Anything they added stays.`, "Remove", async () => {
              try {
                if (g.trips && g.trips[m.uid]) await fs().doc("gaffs/" + g.code).update({ ["trips." + m.uid]: FV().delete() }).catch(() => {});
                await fs().doc(`gaffs/${g.code}/members/${m.uid}`).delete();
                p.remove(); msg(`${m.display || "They"} removed from ${g.name}.`);
              } catch (e) { console.warn(e); msg("Couldn't remove them. Try again."); }
            });
            ul.append(p);
          });
        }).catch(() => { li.querySelector(".adm-people").innerHTML = `<li class="adm-muted">Couldn't load people.</li>`; });
        li.querySelector("[data-pop]").onclick = () => { tab = "popups"; panel.querySelectorAll("[data-tab]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === tab))); tabPopups(g.code); };
        li.querySelector("[data-del]").onclick = () => confirmIn(li, `Delete ${g.name} for good? The list, everyone in it and its pop-ups are erased. This can't be undone.`, "Delete for good", async () => {
          try { await deleteHouse(g.code); houses = houses.filter(x => x.code !== g.code); draw(body().querySelector("[data-find]")?.value); msg(`${g.name} deleted.`); }
          catch (e) { console.warn(e); msg("The house couldn't be fully deleted. Try again."); }
        });
      });
    };
    draw("");
    body().querySelector("[data-find]").oninput = (e) => draw(e.target.value);
  }

  // Erase a house: mark it as closing (which lets the rules allow it), then remove items, notices, people and the house.
  async function deleteHouse(code) {
    const g = fs().doc("gaffs/" + code);
    await g.update({ closing: true });
    for (const sub of ["items", "notices", "members"]) {
      const q = await fs().collection(`gaffs/${code}/${sub}`).get();
      let batch = fs().batch(), n = 0;
      for (const d of q.docs) {
        batch.delete(d.ref);
        if (++n === 400) { await batch.commit(); batch = fs().batch(); n = 0; }
      }
      if (n) await batch.commit();
    }
    await g.delete();
  }

  /* ---- Stats: numbers only ---- */
  async function tabStats() {
    body().innerHTML = `<p class="adm-muted">Loading…</p>`;
    try {
      const houses = await loadHouses();
      const counts = await Promise.all(houses.map(g => fs().collection(`gaffs/${g.code}/members`).get().then(q => q.size).catch(() => 0)));
      const people = counts.reduce((a, b) => a + b, 0);
      const weekAgo = Date.now() - 7 * DAYMS;
      const activeHouses = houses.filter(g => (g.lastActiveAt || 0) > weekAgo).length;
      const days = [...Array(7)].map((_, i) => dublinDay(Date.now() - i * DAYMS));
      const snaps = await Promise.all(days.map(d => fs().doc("stats/" + d).get().catch(() => null)));
      const day = snaps.map(s => (s && s.exists ? s.data() : {}));
      const sum = (k) => day.reduce((a, d) => a + (d[k] || 0), 0);
      const newWeek = houses.filter(g => (g.createdAt || 0) > weekAgo).length;
      const tile = (n, label) => `<div class="adm-stat"><b>${n}</b><span>${h(label)}</span></div>`;
      body().innerHTML = `
        <h3>Right now</h3>
        <div class="adm-stats">${tile(houses.length, "houses")}${tile(people, "people in houses")}${tile(activeHouses, "houses used this week")}${tile(newWeek, "new houses this week")}</div>
        <h3>Today</h3>
        <div class="adm-stats">${tile(day[0].added || 0, "items added")}${tile(day[0].ticked || 0, "items ticked off")}${tile((day[0].gaffs || []).length, "houses active")}</div>
        <h3>Last 7 days</h3>
        <div class="adm-stats">${tile(sum("added"), "items added")}${tile(sum("ticked"), "items ticked off")}</div>
        <p class="adm-muted" style="margin-top:.8rem">Counts only. Item and tick totals started being kept when the owner tools were added.</p>`;
    } catch (e) { console.warn(e); body().innerHTML = `<p class="adm-muted">Couldn't load the stats.</p>`; }
  }

  /* ---- Maintenance banner ---- */
  async function tabBanner() {
    let cur = {};
    try { const s = await fs().doc("config/banner").get(); cur = s.exists ? s.data() : {}; } catch (e) {}
    body().innerHTML = `
      <p class="adm-muted">A strip across the top of the app for everyone, until you turn it off.</p>
      <textarea data-text maxlength="200" placeholder="We're making some improvements tonight. The list may be slow for a few minutes."></textarea>
      <div class="adm-row"><button class="adm-btn go" type="button" data-on>Show banner</button><button class="adm-btn" type="button" data-off>Turn banner off</button></div>
      <p class="adm-muted" data-state></p>`;
    const b = body();
    b.querySelector("[data-text]").value = cur.text || "";
    b.querySelector("[data-state]").textContent = cur.on ? "The banner is showing now." : "The banner is off.";
    b.querySelector("[data-on]").onclick = async () => {
      const text = b.querySelector("[data-text]").value.trim();
      if (!text) { msg("Write the banner text first."); return; }
      try { await fs().doc("config/banner").set({ on: true, text, at: Date.now() }); msg("Banner is showing for everyone."); tabBanner(); }
      catch (e) { msg("Couldn't update the banner. Try again."); }
    };
    b.querySelector("[data-off]").onclick = async () => {
      try { await fs().doc("config/banner").set({ on: false }, { merge: true }); msg("Banner turned off."); tabBanner(); }
      catch (e) { msg("Couldn't update the banner. Try again."); }
    };
  }

  /* ---- Feature switches ---- */
  async function tabFeatures() {
    let flags = {};
    try { const s = await fs().doc("config/flags").get(); flags = (s.exists && s.data().flags) || {}; } catch (e) {}
    const mine = (S.profile && S.profile.gaffs) || [];
    body().innerHTML = `
      <p class="adm-muted">Turn a new feature on for your own house first, check it, then switch it on for everyone. New features are added here as they're built.</p>
      <ul class="adm-list" data-flags></ul>
      <div class="adm-row"><input type="text" data-name placeholder="New switch name, e.g. meal-planner" style="flex:1 1 12rem"><button class="adm-btn" type="button" data-add>Add switch</button></div>`;
    const ul = body().querySelector("[data-flags]");
    const names = Object.keys(flags).sort();
    if (!names.length) ul.innerHTML = `<li class="adm-muted">No switches yet.</li>`;
    const save = async (next, note) => {
      try { await fs().doc("config/flags").set({ flags: next }); msg(note); tabFeatures(); }
      catch (e) { msg("Couldn't save the switch. Try again."); }
    };
    names.forEach(n => {
      const li = document.createElement("li");
      li.className = "adm-flag";
      li.innerHTML = `<strong></strong><select aria-label="Who gets it"><option value="off">Off</option><option value="mine">My house only</option><option value="all">Everyone</option></select>`;
      li.querySelector("strong").textContent = n;
      const sel = li.querySelector("select");
      sel.value = flags[n].mode || "off";
      sel.onchange = () => save({ ...flags, [n]: { mode: sel.value, gaffs: sel.value === "mine" ? mine : [] } },
        sel.value === "mine" ? `${n} is on for your house only.` : sel.value === "all" ? `${n} is on for everyone.` : `${n} is off.`);
      ul.append(li);
    });
    body().querySelector("[data-add]").onclick = () => {
      const n = body().querySelector("[data-name]").value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
      if (!n) { msg("Give the switch a short name."); return; }
      if (flags[n]) { msg("That switch already exists."); return; }
      save({ ...flags, [n]: { mode: "off", gaffs: [] } }, `${n} added. It's off until you switch it on.`);
    };
  }
})();

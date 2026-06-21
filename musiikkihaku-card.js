/* Musiikkihaku-kortti — Spotify-tyylinen biisihaku + jono (Music Assistant)
   Haku kirjoittaessa, autocorrect estetty, napauta soittaaksesi / + jonoon.
   Jono-osio: nyt soi / seuraavaksi / jonossa N kpl + ohita/sekoita/tyhjennä.
   Atte Keloneva / lennonjohtotorni. v2 */
class MusiikkihakuCard extends HTMLElement {
  setConfig(config) {
    this._config = config || {};
    this._player = this._config.player || "media_player.sonos_2";
    this._entry = this._config.config_entry_id || "01KVDKGPFQQZXSY88JK13YYVM4";
    this._limit = this._config.limit || 8;
    this._seq = 0;
    if (!this._built) this._build();
  }
  set hass(hass) { this._hass = hass; if (!this._qInit) { this._qInit = true; this._refreshQueue(); } }
  getCardSize() { return 6; }
  connectedCallback() { this._qTimer = setInterval(() => this._refreshQueue(), 10000); }
  disconnectedCallback() { clearInterval(this._qTimer); }

  _build() {
    this._built = true;
    this.innerHTML = `
      <style>
        .mh { background:#1b1e24; border:1px solid #2a2e36; border-radius:18px; padding:12px; font-family:inherit; }
        .mh-row { display:flex; gap:8px; align-items:center; }
        .mh-input { flex:1; background:#0e1014; color:#f2f3f5; border:1px solid #3a3f4a;
          border-radius:14px; padding:14px 16px; font-size:1.15em; outline:none; }
        .mh-input::placeholder { color:#7b828d; }
        .mh-clear { background:#2a2e36; color:#f2f3f5; border:none; border-radius:12px;
          width:48px; height:48px; font-size:1.1em; cursor:pointer; flex:none; }
        .mh-status { color:#9aa0aa; font-size:0.95em; min-height:18px; margin:8px 2px 4px; }
        .mh-item { display:flex; align-items:center; gap:10px; padding:12px 8px;
          border-top:1px solid #262a32; min-height:56px; }
        .mh-meta { flex:1; min-width:0; cursor:pointer; }
        .mh-title { color:#f2f3f5; font-weight:600; font-size:1.05em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .mh-artist { color:#9aa0aa; font-size:0.9em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .mh-btn { border:none; border-radius:12px; width:50px; height:50px; font-size:1.3em; cursor:pointer; flex:none; }
        .mh-play { background:linear-gradient(135deg,#1DB954,#17a347); color:#fff; }
        .mh-queue { background:#2a2e36; color:#9ad; }
        .mh-q { margin-top:14px; padding-top:12px; border-top:1px solid #2a2e36; }
        .mh-q-h { color:#7b828d; font-size:0.8em; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px; }
        .mh-q-now { color:#1DB954; font-weight:600; font-size:1.0em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .mh-q-next { color:#f2f3f5; font-size:0.98em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px; }
        .mh-q-count { color:#9aa0aa; font-size:0.85em; margin-top:2px; }
        .mh-q-btns { display:flex; gap:8px; margin-top:10px; }
        .mh-q-btns button { flex:1; background:#2a2e36; color:#dfe3ea; border:none; border-radius:12px; padding:11px 6px; font-size:0.92em; cursor:pointer; }
        .mh-q-btns button.on { background:#1DB95433; color:#1DB954; }
      </style>
      <div class="mh">
        <div class="mh-row">
          <input class="mh-input" type="text" inputmode="search" enterkeyhint="search"
                 placeholder="Hae kappale tai artisti…"
                 autocorrect="off" autocapitalize="off" spellcheck="false" autocomplete="off" />
          <button class="mh-clear" title="Tyhjennä haku">✕</button>
        </div>
        <div class="mh-status"></div>
        <div class="mh-results"></div>
        <div class="mh-q">
          <div class="mh-q-h">Jono</div>
          <div class="mh-q-now">—</div>
          <div class="mh-q-next"></div>
          <div class="mh-q-count"></div>
          <div class="mh-q-btns">
            <button data-act="skip">⏭ Ohita</button>
            <button data-act="shuffle">🔀 Sekoita</button>
            <button data-act="clear">🗑 Tyhjennä</button>
          </div>
        </div>
      </div>`;
    this._input = this.querySelector(".mh-input");
    this._status = this.querySelector(".mh-status");
    this._results = this.querySelector(".mh-results");
    this._qNow = this.querySelector(".mh-q-now");
    this._qNext = this.querySelector(".mh-q-next");
    this._qCount = this.querySelector(".mh-q-count");
    this._input.addEventListener("input", () => this._onInput());
    this._input.addEventListener("keydown", (e) => { if (e.key === "Enter") { clearTimeout(this._t); this._search(this._input.value.trim()); } });
    this.querySelector(".mh-clear").addEventListener("click", () => {
      this._input.value = ""; this._results.innerHTML = ""; this._status.textContent = ""; this._input.focus();
    });
    this.querySelectorAll(".mh-q-btns button").forEach((b) =>
      b.addEventListener("click", () => this._queueAction(b.dataset.act)));
  }

  _onInput() {
    clearTimeout(this._t);
    const q = this._input.value.trim();
    if (q.length < 2) { this._results.innerHTML = ""; this._status.textContent = ""; return; }
    this._status.textContent = "Haetaan…";
    this._t = setTimeout(() => this._search(q), 400);
  }

  async _search(q) {
    if (!q || q.length < 2 || !this._hass) return;
    const seq = ++this._seq;
    try {
      const res = await this._hass.callWS({
        type: "call_service", domain: "music_assistant", service: "search",
        service_data: { config_entry_id: this._entry, name: q, media_type: ["track"], limit: this._limit },
        return_response: true,
      });
      if (seq !== this._seq) return;
      const tracks = (res && res.response && res.response.tracks) || [];
      this._render(tracks);
    } catch (err) {
      if (seq !== this._seq) return;
      this._status.textContent = "Haku ei onnistunut"; this._results.innerHTML = "";
    }
  }

  _render(tracks) {
    this._results.innerHTML = "";
    if (!tracks.length) { this._status.textContent = "Ei tuloksia"; return; }
    this._status.textContent = "";
    tracks.forEach((t) => {
      const artist = (t.artists && t.artists[0] && t.artists[0].name) || "";
      const title = t.name || ""; const uri = t.uri;
      const row = document.createElement("div");
      row.className = "mh-item";
      row.innerHTML =
        `<div class="mh-meta"><div class="mh-title"></div><div class="mh-artist"></div></div>` +
        `<button class="mh-btn mh-play" title="Soita">▶</button>` +
        `<button class="mh-btn mh-queue" title="Jonoon">+</button>`;
      row.querySelector(".mh-title").textContent = title;
      row.querySelector(".mh-artist").textContent = artist;
      row.querySelector(".mh-meta").addEventListener("click", () => this._play(uri, artist, title, false));
      row.querySelector(".mh-play").addEventListener("click", () => this._play(uri, artist, title, false));
      row.querySelector(".mh-queue").addEventListener("click", () => this._play(uri, artist, title, true));
      this._results.appendChild(row);
    });
  }

  _play(uri, artist, title, queue) {
    if (!uri || !this._hass) return;
    const data = { media_id: uri, entity_id: this._player };
    if (queue) data.enqueue = "add";
    this._hass.callService("music_assistant", "play_media", data);
    this._status.textContent = (queue ? "Lisätty jonoon: " : "Soitetaan: ") + artist + " - " + title;
    setTimeout(() => this._refreshQueue(), 1500);
  }

  async _refreshQueue() {
    if (!this._hass || !this._qNow) return;
    try {
      const res = await this._hass.callWS({
        type: "call_service", domain: "music_assistant", service: "get_queue",
        service_data: { entity_id: this._player }, return_response: true,
      });
      const q = res && res.response && res.response[this._player];
      if (!q) { this._qNow.textContent = "—"; this._qNext.textContent = ""; this._qCount.textContent = ""; return; }
      this._qNow.textContent = q.current_item ? "▶ " + q.current_item.name : "—";
      this._qNext.textContent = q.next_item ? "⏭ Seuraavaksi: " + q.next_item.name : "";
      const n = typeof q.items === "number" ? q.items : 0;
      this._qCount.textContent = n ? "Jonossa " + n + " kappaletta" : "";
      this._shuffleOn = !!q.shuffle_enabled;
      const sb = this.querySelector('[data-act="shuffle"]');
      if (sb) sb.classList.toggle("on", this._shuffleOn);
    } catch (e) { /* jono ei saatavilla */ }
  }

  _queueAction(act) {
    if (!this._hass) return;
    if (act === "skip") this._hass.callService("media_player", "media_next_track", { entity_id: this._player });
    else if (act === "shuffle") this._hass.callService("media_player", "shuffle_set", { entity_id: this._player, shuffle: !this._shuffleOn });
    else if (act === "clear") this._hass.callService("media_player", "clear_playlist", { entity_id: this._player });
    setTimeout(() => this._refreshQueue(), 1200);
  }
}
customElements.define("musiikkihaku-card", MusiikkihakuCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "musiikkihaku-card", name: "Musiikkihaku", description: "Spotify-tyylinen biisihaku + jono (Music Assistant)" });

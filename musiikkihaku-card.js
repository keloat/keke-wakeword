/* Musiikkihaku-kortti — Spotify-tyylinen biisihaku Home Assistant Voice / Music Assistant
   Haku kirjoittaessa (debounce), autocorrect estetty, napauta soittaaksesi / + jonoon.
   Atte Keloneva / lennonjohtotorni. v1 */
class MusiikkihakuCard extends HTMLElement {
  setConfig(config) {
    this._config = config || {};
    this._player = this._config.player || "media_player.sonos_2";
    this._entry = this._config.config_entry_id || "01KVDKGPFQQZXSY88JK13YYVM4";
    this._limit = this._config.limit || 8;
    this._seq = 0;
    if (!this._built) this._build();
  }
  set hass(hass) { this._hass = hass; }
  getCardSize() { return 5; }

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
          width:48px; height:48px; font-size:1.1em; cursor:pointer; }
        .mh-status { color:#9aa0aa; font-size:0.95em; min-height:18px; margin:8px 2px 4px; }
        .mh-item { display:flex; align-items:center; gap:10px; padding:12px 8px;
          border-top:1px solid #262a32; min-height:56px; }
        .mh-meta { flex:1; min-width:0; cursor:pointer; }
        .mh-title { color:#f2f3f5; font-weight:600; font-size:1.05em; white-space:nowrap;
          overflow:hidden; text-overflow:ellipsis; }
        .mh-artist { color:#9aa0aa; font-size:0.9em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .mh-btn { border:none; border-radius:12px; width:50px; height:50px; font-size:1.3em;
          cursor:pointer; flex:none; }
        .mh-play { background:linear-gradient(135deg,#1DB954,#17a347); color:#fff; }
        .mh-queue { background:#2a2e36; color:#9ad; }
      </style>
      <div class="mh">
        <div class="mh-row">
          <input class="mh-input" type="search" inputmode="search" enterkeyhint="search"
                 placeholder="Hae kappale tai artisti…"
                 autocorrect="off" autocapitalize="off" spellcheck="false" autocomplete="off" />
          <button class="mh-clear" title="Tyhjennä">✕</button>
        </div>
        <div class="mh-status"></div>
        <div class="mh-results"></div>
      </div>`;
    this._input = this.querySelector(".mh-input");
    this._status = this.querySelector(".mh-status");
    this._results = this.querySelector(".mh-results");
    this._input.addEventListener("input", () => this._onInput());
    this._input.addEventListener("keydown", (e) => { if (e.key === "Enter") { clearTimeout(this._t); this._search(this._input.value.trim()); } });
    this.querySelector(".mh-clear").addEventListener("click", () => {
      this._input.value = ""; this._results.innerHTML = ""; this._status.textContent = ""; this._input.focus();
    });
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
      this._status.textContent = "Haku ei onnistunut";
      this._results.innerHTML = "";
    }
  }

  _render(tracks) {
    this._results.innerHTML = "";
    if (!tracks.length) { this._status.textContent = "Ei tuloksia"; return; }
    this._status.textContent = "";
    tracks.forEach((t) => {
      const artist = (t.artists && t.artists[0] && t.artists[0].name) || "";
      const title = t.name || "";
      const uri = t.uri;
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
  }
}
customElements.define("musiikkihaku-card", MusiikkihakuCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "musiikkihaku-card", name: "Musiikkihaku", description: "Spotify-tyylinen biisihaku (Music Assistant)" });

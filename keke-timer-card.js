// keke-timer-card — iso live-laskuri keittiötaululle ja lennonjohtotorniin.
// Näyttää aktiiviset ajastimet (timer.ajastin_1..3) ja valmiit (VALMIS) + Lopeta-napin.
// Piiloutuu kokonaan kun yhtään ajastinta ei ole päällä eikä soimassa.
class KekeTimerCard extends HTMLElement {
  setConfig(config) {
    this._slots = config && config.slots ? config.slots : [1, 2, 3];
    this._names = { 1: "Ykkösajastin", 2: "Kakkosajastin", 3: "Kolmosajastin" };
  }
  set hass(hass) {
    this._hass = hass;
    this._render();
    if (!this._iv) this._iv = setInterval(() => this._render(), 1000);
  }
  disconnectedCallback() { if (this._iv) { clearInterval(this._iv); this._iv = null; } }

  _fmt(totalSec) {
    if (totalSec < 0) totalSec = 0;
    const s = Math.floor(totalSec % 60);
    const m = Math.floor((totalSec / 60) % 60);
    const h = Math.floor(totalSec / 3600);
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }
  _parseHMS(str) {
    if (!str) return 0;
    const p = String(str).split(":").map(Number);
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : 0;
  }
  _label(slot) {
    const st = this._hass.states[`input_text.ajastin_${slot}_label`];
    const v = st ? st.state : "";
    return v && v !== "unknown" && v !== "unavailable" ? v : "";
  }

  _lopeta(slot) {
    this._hass.callService("script", "ajastin_lopeta_slot", { slot: String(slot) });
  }

  _render() {
    if (!this._hass) return;
    const rows = [];
    for (const slot of this._slots) {
      const t = this._hass.states[`timer.ajastin_${slot}`];
      if (!t) continue;
      const label = this._label(slot);
      if (t.state === "active" || t.state === "paused") {
        let rem;
        if (t.state === "active" && t.attributes.finishes_at) {
          rem = (Date.parse(t.attributes.finishes_at) - Date.now()) / 1000;
        } else {
          rem = this._parseHMS(t.attributes.remaining);
        }
        rows.push({ slot, label, ringing: false, text: this._fmt(rem), paused: t.state === "paused" });
      } else if (t.state === "idle" && label) {
        // valmis, odottaa kuittausta
        rows.push({ slot, label, ringing: true, text: "VALMIS" });
      }
    }

    if (rows.length === 0) { this.style.display = "none"; this.innerHTML = ""; return; }
    this.style.display = "block";

    const multi = rows.length > 1;
    const card = `
      <ha-card style="background:#15171c;border:none;box-shadow:none;border-radius:20px;padding:14px 16px;">
        ${rows.map((r) => `
          <div style="display:flex;align-items:center;gap:14px;${multi ? "padding:10px 0;border-bottom:1px solid #ffffff14;" : ""}">
            <div style="font-size:34px;line-height:1;">${r.ringing ? "🔔" : "⏲️"}</div>
            <div style="flex:1;min-width:0;">
              <div style="color:#f2f3f5;font-weight:700;font-size:${multi ? "1.05em" : "1.2em"};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${this._names[r.slot] || ("Ajastin " + r.slot)}${r.label ? ` <span style="color:#9aa0aa;font-weight:600;">· ${r.label}</span>` : ""}
              </div>
              <div style="font-variant-numeric:tabular-nums;font-weight:800;letter-spacing:1px;${r.ringing
                ? "color:#4FD088;font-size:" + (multi ? "1.8em" : "2.4em") + ";animation:kekeblink 1s steps(2,start) infinite;"
                : (r.paused ? "color:#E0A93B;" : "color:#47B2F7;") + "font-size:" + (multi ? "2.2em" : "3.2em") + ";line-height:1.05;"}">
                ${r.text}${r.paused ? " ⏸" : ""}
              </div>
            </div>
            <button data-slot="${r.slot}" style="background:${r.ringing ? "#27AE60" : "#3a2326"};color:#fff;border:none;border-radius:14px;padding:14px 18px;font-size:1.05em;font-weight:700;cursor:pointer;white-space:nowrap;">
              ${r.ringing ? "OK, sammuta" : "Lopeta"}
            </button>
          </div>`).join("")}
      </ha-card>
      <style>@keyframes kekeblink{50%{opacity:0.35;}}</style>`;
    this.innerHTML = card;
    this.querySelectorAll("button[data-slot]").forEach((b) =>
      b.addEventListener("click", () => this._lopeta(b.getAttribute("data-slot")))
    );
  }
  getCardSize() { return 2; }
}
customElements.define("keke-timer-card", KekeTimerCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "keke-timer-card", name: "Keke Timer Card", description: "Iso live-laskuri ajastimille" });

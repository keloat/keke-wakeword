// Nord Pool -hintakortti Kornettipihalle. Hakee tuntihinnat nordpool.get_prices_for_date -palvelusta
// ja piirtää palkit (tänään tästä eteenpäin + huomenna). Hinta EUR/MWh -> snt/kWh sis. ALV.
class NordpoolCard extends HTMLElement {
  setConfig(config){
    this._config = config || {};
    this._ce = this._config.config_entry || "01KVP5WS2CBPZMFMC8A18YHH06";
    this._vat = (this._config.vat !== undefined) ? this._config.vat : 1.255;
  }
  set hass(hass){
    this._hass = hass;
    const h = new Date().getHours();
    if(!this._loaded || this._lastHour !== h){
      this._loaded = true; this._lastHour = h;
      this._load();
    }
  }
  async _getDay(date){
    try{
      const res = await this._hass.callWS({type:"call_service",domain:"nordpool",service:"get_prices_for_date",
        service_data:{config_entry:this._ce, date:date}, return_response:true});
      const arr = (res && res.response && res.response.FI) || [];
      return arr.map(x => ({start:new Date(x.start), price:x.price}));
    }catch(e){ return null; }
  }
  _hourly(items){
    if(!items) return null;
    const m = {};
    for(const it of items){
      const d = it.start;
      const k = d.getFullYear()+"_"+d.getMonth()+"_"+d.getDate()+"_"+d.getHours();
      if(!m[k]) m[k] = {h:new Date(d.getFullYear(),d.getMonth(),d.getDate(),d.getHours()), s:0, n:0};
      m[k].s += it.price; m[k].n++;
    }
    return Object.values(m).map(o => ({h:o.h, price:o.s/o.n})).sort((a,b)=>a.h-b.h);
  }
  _snt(p){ return p/10*this._vat; }            // EUR/MWh -> snt/kWh sis. ALV
  _col(s){ return s<5?"#2e9e4f":(s<10?"#e0a93a":(s<20?"#e07b39":"#d23b3b")); }
  _fmt(s){ return s.toFixed(1).replace(".",","); }
  _section(title, hours, now){
    if(hours === null) return `<div class="np-sec"><div class="np-st">${title}</div><div class="np-empty">Hintoja ei vielä saatavilla — julkaistaan n. klo 14</div></div>`;
    if(!hours.length) return "";
    const vals = hours.map(x=>this._snt(x.price));
    const max = Math.max(...vals, 0.1);
    const minV = Math.min(...vals);
    let rows = "";
    hours.forEach(x => {
      const s = this._snt(x.price);
      const w = Math.max(5, Math.round(s/max*100));
      const cur = (x.h.getHours()===now.getHours() && x.h.getDate()===now.getDate());
      const star = (s===minV) ? ' <span class="np-star">⭐</span>' : '';
      rows += `<div class="np-row${cur?' np-cur':''}">
        <div class="np-hr">${String(x.h.getHours()).padStart(2,'0')}</div>
        <div class="np-bw"><div class="np-bar" style="width:${w}%;background:${this._col(s)}"></div></div>
        <div class="np-pr">${this._fmt(s)}${star}</div></div>`;
    });
    return `<div class="np-sec"><div class="np-st">${title}</div>${rows}</div>`;
  }
  _render(now, today, tomo){
    let curSnt = 0;
    if(today){
      const cur = today.find(x => x.h.getHours()===now.getHours() && x.h.getDate()===now.getDate());
      curSnt = cur ? this._snt(cur.price) : (today.length ? this._snt(today[today.length-1].price) : 0);
    }
    const lvl = curSnt<5?"Halpaa":(curSnt<10?"Kohtuullista":(curSnt<20?"Kallista":"Erittäin kallista"));
    const upToday = today ? today.filter(x => !(x.h.getDate()===now.getDate() && x.h.getHours()<now.getHours()) && x.h.getDate()>=now.getDate()) : null;
    this.innerHTML = `
    <ha-card>
      <style>
        ha-card{padding:14px 14px 16px;background:#1b1e24;border:none;border-radius:18px;color:#f2f3f5;font-family:-apple-system,Roboto,sans-serif;}
        .np-now{display:flex;align-items:baseline;gap:6px;}
        .np-big{font-size:2.6em;font-weight:800;color:${this._col(curSnt)};line-height:1;}
        .np-unit{font-size:1em;color:#aab;}
        .np-lvl{margin:2px 0 12px;color:#cfd3da;font-size:1.05em;}
        .np-sec{margin-top:10px;}
        .np-st{font-size:0.8em;letter-spacing:1.5px;text-transform:uppercase;color:#8a909a;font-weight:700;margin:10px 0 6px;border-bottom:1px solid #2c2f36;padding-bottom:4px;}
        .np-row{display:flex;align-items:center;gap:8px;height:24px;}
        .np-row.np-cur{background:rgba(255,255,255,0.07);border-radius:6px;}
        .np-hr{width:26px;font-variant-numeric:tabular-nums;color:#cfd3da;font-size:0.95em;}
        .np-bw{flex:1;background:#23272f;border-radius:5px;height:14px;overflow:hidden;}
        .np-bar{height:100%;border-radius:5px;transition:width .3s;}
        .np-pr{width:56px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;font-size:0.95em;}
        .np-star{font-size:0.85em;}
        .np-empty{color:#8a909a;font-style:italic;padding:6px 0;}
        .np-foot{margin-top:10px;color:#6b7079;font-size:0.75em;}
      </style>
      <div class="np-now"><span class="np-big">${this._fmt(curSnt)}</span><span class="np-unit">snt/kWh</span></div>
      <div class="np-lvl">⚡ ${lvl} nyt &middot; sis. ALV 25,5 %</div>
      ${this._section("Tänään (tästä eteenpäin)", upToday, now)}
      ${this._section("Huomenna", tomo, now)}
      <div class="np-foot">⭐ = vuorokauden halvin tunti &middot; Nord Pool spot</div>
    </ha-card>`;
  }
  async _load(){
    if(!this._hass) return;
    const now = new Date();
    const ds = (off)=>{ const d=new Date(now); d.setDate(d.getDate()+off);
      return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
    const today = this._hourly(await this._getDay(ds(0)));
    const tomo  = this._hourly(await this._getDay(ds(1)));
    this._render(now, today, tomo);
  }
  getCardSize(){ return 14; }
}
customElements.define("nordpool-card", NordpoolCard);
window.customCards = window.customCards || [];
window.customCards.push({type:"nordpool-card", name:"Nord Pool hinta", description:"Sähkön spot-hinta tuleville tunneille ja huomiselle"});

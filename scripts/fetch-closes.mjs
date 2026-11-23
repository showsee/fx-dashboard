// Yahoo Financeの1時間足から、TradingViewと同じNY17時区切りの日足終値を作り data/closes.json に保存する
import { writeFileSync, mkdirSync } from "node:fs";

const PAIRS = {
  USDJPY: "JPY=X", EURUSD: "EURUSD=X", AUDJPY: "AUDJPY=X", GBPJPY: "GBPJPY=X",
  EURJPY: "EURJPY=X", AUDUSD: "AUDUSD=X", GBPUSD: "GBPUSD=X", EURGBP: "EURGBP=X",
};
const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
});
const nextDay = d => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };

async function sessions(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=2y&interval=1h`;
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) throw new Error(`${sym} HTTP ${res.status}`);
      const r = (await res.json()).chart.result[0];
      const ts = r.timestamp, c = r.indicators.quote[0].close, out = {};
      for (let k = 0; k < ts.length; k++) {
        if (c[k] == null) continue;
        const p = Object.fromEntries(fmt.formatToParts(new Date(ts[k] * 1000)).map(x => [x.type, x.value]));
        let d = `${p.year}-${p.month}-${p.day}`;
        if (+p.hour % 24 >= 17) d = nextDay(d);         // NY17時以降は翌営業日のセッション
        out[d] = c[k];                                   // 各セッションの最後の値 = 終値
      }
      const wd = d => new Date(d + "T00:00:00Z").getUTCDay();
      const days = Object.keys(out).sort().filter(d => wd(d) >= 1 && wd(d) <= 5).slice(-420);
      return { d: days, c: days.map(d => +out[d].toFixed(6)) };
    } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 3000)); }
  }
  throw lastErr;
}

const data = { updated: new Date().toISOString(), source: "Yahoo Finance 1h → NY 17:00 close", pairs: {} };
for (const [k, s] of Object.entries(PAIRS)) data.pairs[k] = await sessions(s);
mkdirSync("data", { recursive: true });
writeFileSync("data/closes.json", JSON.stringify(data));
console.log("ok", Object.entries(data.pairs).map(([k, v]) => `${k}:${v.d.at(-1)}=${v.c.at(-1)}`).join(" "));

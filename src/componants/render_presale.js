// componants/render_presale.js
// ---------------------------------------------------------------------------
// WE33 — WE Token fair launch presale page
//
//   renderPresale(data)                       <- what main.js does
//   renderPresale(account, saleData, options) <- explicit form
//
// Layout is the standalone presale page: hero, one sale card, details, steps.
// Typography, weights, sizing steps and corner radii follow render_spot.js so
// the two pages read as the same site:
//   type      clamp() on container width, --mono for every number,
//             600 / 700 weights only, uppercase .18em labels in mint
//   radii     999px pills for anything you press, clamp(10px,1.3cqw,13px)
//             tiles, clamp(12px,1.6cqw,15px) blocks,
//             clamp(14px,1.8cqw,20px) panels, 20px modals
//
// Context object from main.js
//   {
//     wallet, account, usdtBalance, referrerAddress,
//     presale: {                              // mockupPresaledata
//       islive, hardcap, totalRaised, totalBuyers, saleTokens, listingPrice,
//       startTime, endTime, minBuy, maxBuy, finalized
//     },
//     user: {                                 // mockupUserdata
//       contributed, tokenAllocate, claimed
//     },
//     token: { name, symbol, supply, chain, address }   // optional overrides
//   }
//
//   islive     presale open or not. The page also closes itself once the raise
//              reaches the hardcap, when endTime passes, or once finalized.
//   contributed     USDT this wallet put in
//   tokenAllocate   WE this wallet gets after the round. Computed fair launch
//                   style when the field is not supplied.
//
// Fair launch maths — one settlement price for everybody
//   price now     = totalRaised / saleTokens
//   final price   = hardcap     / saleTokens     ($33,000 / 400M = $0.0000825)
//   your WE       = contributed / totalRaised * saleTokens
//
// Listing prices — the round can close under the hardcap, so the listing price
// tracks the money actually raised:
//   ratio         = listingPrice / final price   (1.25x by default)
//   listing now   = price now * ratio            what listing looks like today
//   target price  = listingPrice                 the ceiling, hit at the hardcap
//
// Money values are uint256 with 18 decimals (USDT on BSC is 18 decimals).
//
// App hooks — inline calls are guarded, nothing breaks until you define them
//   connectWallet()                     navbar + buy box [data-action="connect-wallet"]
//   buyPresale(amountUsdt, referrerAddress)  buy button  [data-action="buy"]
//   claimTokens()                       claim button     [data-action="claim"]
//   refreshPresale()                    optional. Called after a confirmed buy
//                                       or claim, when the status dialog is
//                                       closed, so the page can re-read the
//                                       contract and render again. Without it
//                                       the page falls back to location.reload().
//   [data-action="copy-link"]           data-link holds the referral url
//   [data-address]                      full address, for copy handlers
// ---------------------------------------------------------------------------

const ZERO = '0x0000000000000000000000000000000000000000';
const REF_BASE = 'https://presale.we33.online?ref=';
const LOGO_URL = 'https://www.we33.online/logo.png';

const WAD = 10n ** 18n;

const TOKEN = {
  name: 'WE Token',
  symbol: 'WE',
  supply: 1_000_000_000n * WAD,
  chain: 'BNB Smart Chain',
  address: '',
};

const HARDCAP = 33_000n * WAD;
const SALE_TOKENS = 400_000_000n * WAD;     // 40% of supply, $33,000 / 400M = $0.0000825
// Target listing price, the ceiling reached when the round fills:
// $0.000103125 = 1.25x the $0.0000825 price at the full hardcap.
const LISTING_PRICE = 103_125_000_000_000n;

/** Supply split, 1,000,000,000 WE. */
const ALLOCATION = [
  { label: 'Presale', pct: 40, note: 'Sold at one fair price' },
  { label: 'Ecosystem', pct: 25, note: 'Rewards and world pool' },
  { label: 'Marketing', pct: 10, note: 'Growth and campaigns' },
  { label: 'Liquidity', pct: 8, note: 'Paired and locked at listing' },
  { label: 'CEX listing', pct: 7, note: 'Exchange reserve' },
  { label: 'Team and investor', pct: 6, note: 'Vested' },
  { label: 'Referral reward', pct: 4, note: 'Paid to referrers' },
];

const TRUST = [
  'One settlement price for every buyer',
  'Liquidity paired and locked at listing',
  'Fixed supply, no mint after launch',
];

const STEPS = [
  { title: 'Connect your wallet', body: 'Any wallet on BNB Smart Chain works. Keep a little BNB for gas.' },
  { title: 'Hold USDT', body: 'The round is paid in USDT. Buy or bridge it before the round closes.' },
  { title: 'Enter an amount', body: 'Type what you want to spend. The page shows the WE you would receive at the current raise.' },
  { title: 'Claim after the close', body: 'Tokens are claimable from this page once the round is finalised.' },
];

let __uid = 0;

/* ------------------------------- terms ---------------------------------- */

const TERMS_HTML = /*html*/`
<h4>WE Token presale risk warning, agreement and participation terms</h4>
<p class="wp-date">Date: August 25, 2026</p>
<p>Please read and fully understand the following before buying WE tokens in the presale. Buying is a
   voluntary decision made by each participant. Participants should carefully study the information and
   assess the risks before making any decision.</p>

<h5>Fair launch</h5>
<p>A fixed amount of WE tokens is offered to every participant at the same settlement price. The price is
   the total amount raised divided by the tokens offered, so the price shown during the round changes as
   the amount raised changes and is not final until the round closes or the hardcap is reached.</p>

<h5>No guarantee of value, price or return</h5>
<p>WE33 does not guarantee the value, price, liquidity, listing, or return of WE tokens. The listing price
   shown is a planned reference only and does not guarantee that WE tokens can be sold or exchanged at that
   price, or at any price. Participants may lose all or part of the value of their digital assets.</p>

<h5>Payment and settlement</h5>
<p>Purchases are settled on chain in USDT. Transactions cannot be reversed by WE33 once confirmed. Tokens
   are allocated after the round is finalised, subject to the platform's applicable terms, conditions, rules
   and system status at the relevant time.</p>

<h5>Hardcap</h5>
<p>The round closes when the hardcap is reached or when the sale period ends, whichever comes first.
   Contributions above the remaining hardcap are not accepted. If the round ends below the hardcap, the
   settlement price is lower and participants receive proportionally more tokens for the same contribution.</p>

<h5>Own decision</h5>
<p>Buying WE tokens is entirely voluntary and is the sole decision of each participant. Buying does not
   guarantee income, profit, rewards, or any return. Participants should consider their own financial
   circumstances and risk tolerance before making a decision.</p>

<p class="wp-warn">Digital assets involve a high level of risk. Their value and price may fluctuate, and
   participants may lose all or part of their value. Please carefully study the information and assess the
   risks before deciding to participate.</p>`;

/* ------------------------------ runtime --------------------------------- */

const RUNTIME = `if(!window.__wp){window.__wp={
q:function(r,n){return document.getElementById(r+'-'+n)},
lock:function(on){document.body.style.overflow=on?'hidden':''},
open:function(r,n){var e=this.q(r,n);if(e){e.classList.add('is-open');this.lock(1)}},
close:function(r,n){var e=this.q(r,n);if(e){e.classList.remove('is-open');this.lock(0)}
if(n==='status'&&this.dirty){this.dirty=0;this.refresh()}},
refresh:function(){
var f=this.pick(['refreshPresale','refreshApp','reloadApp']);
if(!f){location.reload();return}
try{Promise.resolve(f()).catch(function(){location.reload()})}catch(e){location.reload()}},
pick:function(names){for(var i=0;i<names.length;i++){var f=window[names[i]];if(typeof f==='function')return f}return null},
set:function(r,state,title,msg,tx){
var m=this.q(r,'status');if(!m)return;
m.setAttribute('data-state',state);
var t=this.q(r,'status-title');if(t)t.textContent=title;
var g=this.q(r,'status-msg');if(g)g.textContent=msg||'';
var x=this.q(r,'status-tx');if(x){x.textContent=tx||'';x.style.display=tx?'':'none';x.setAttribute('data-copy',tx||'')}
m.classList.add('is-open');this.lock(1)},
run:function(r,names,args,label){
var f=this.pick(names),s=this;
if(!f){s.set(r,'error',label+' unavailable','This action is not connected yet.');return}
s.set(r,'pending',label+' in progress','Confirm the transaction in your wallet and keep this tab open.');
Promise.resolve().then(function(){return f.apply(window,args)}).then(function(res){
res=res||{};
if(res.result){s.dirty=1;s.set(r,'done',label+' complete','The transaction was confirmed on chain. Closing this will refresh the page data.',res.txhash||'')}
else{s.set(r,'error',label+' failed',res.error||res.message||'The transaction did not go through.',res.txhash||'')}
}).catch(function(e){s.set(r,'error',label+' failed',(e&&e.message)?e.message:String(e))})},
copy:function(el){var v=el.getAttribute('data-copy')||el.getAttribute('data-link')||'';
if(navigator.clipboard&&v){navigator.clipboard.writeText(v);el.classList.add('is-copied');setTimeout(function(){el.classList.remove('is-copied')},1400)}},
n:function(v,d){return v.toLocaleString('en-US',{minimumFractionDigits:d||0,maximumFractionDigits:d||0})},
price:function(x){if(!(x>0))return '—';return '$'+x.toFixed(10)},
review:function(r){
var a=this.q(r,'amt');if(!a)return;
var v=parseFloat(a.value||'0');
if(!(v>0)){this.set(r,'error','Amount missing','Enter how much USDT you want to spend.');return}
var raised=parseFloat(a.dataset.raised),sale=parseFloat(a.dataset.sale),
cap=parseFloat(a.dataset.hardcap),mine=parseFloat(a.dataset.mine),sym=a.dataset.sym;
var after=raised+v;if(after>cap)after=cap;
var s=this,put=function(k,t){var e=s.q(r,k);if(e)e.textContent=t};
put('r-pay',s.n(v,2)+' USDT');
put('r-p0',s.price(raised>0?raised/sale:0)+' / '+sym);
put('r-p1',s.price(after>0?after/sale:0)+' / '+sym);
put('r-now',s.n(after>0?(v/after)*sale:0,0)+' '+sym);
put('r-full',s.n(cap>0?((mine+v)/cap)*sale:0,0)+' '+sym);
this.open(r,'terms')},
sync:function(r){
var a=this.q(r,'amt');if(!a)return;
var b=this.q(r,'buy'),e=this.q(r,'est'),n=this.q(r,'note');
var v=parseFloat(a.value||'0');if(!(v>0))v=0;
var lo=parseFloat(a.dataset.min),hi=parseFloat(a.dataset.cap);
var raised=parseFloat(a.dataset.raised),sale=parseFloat(a.dataset.sale);
var ok=v>=lo&&v<=hi;
if(b)b.disabled=!ok;
if(e)e.textContent=v>0?this.n((v/(raised+v))*sale,0):'0';
if(n){n.className='wp-note'+((v&&!ok)?' wp-note--warn':'');
if(!v)n.textContent='Minimum '+this.n(lo,0)+' USDT per buy';
else if(v<lo)n.textContent='Below the '+this.n(lo,0)+' USDT minimum';
else if(v>hi)n.textContent='Above your limit of '+this.n(hi,2)+' USDT';
else n.textContent='Settles at the final round price, the same for everyone'}},
buy:function(r){
var a=this.q(r,'amt');if(!a||!a.value){this.set(r,'error','Amount missing','Enter how much USDT you want to spend.');return}
this.close(r,'terms');this.run(r,['buyPresale','buyPresaleExt','buyWEExt'],[a.value,a.dataset.ref||''],'Purchase')},
clock:function(r,ts){
var s=this,t=null,f=function(){
var d=ts-Math.floor(Date.now()/1000);if(d<0)d=0;
var p=function(x){return('0'+x).slice(-2)},put=function(k,v){var e=s.q(r,k);if(e)e.textContent=v};
put('dd',p(Math.floor(d/86400)));put('hh',p(Math.floor(d%86400/3600)));
put('mm',p(Math.floor(d%3600/60)));put('ss',p(d%60));
if(!d&&t)clearInterval(t)};
t=setInterval(f,1000);f()}
}}`;

/* ------------------------------- helpers -------------------------------- */

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const call = (fn, arg = '') => esc(`typeof ${fn}==='function'&&${fn}(${arg})`);

const big = (v) => {
  if (typeof v === 'number') { try { return BigInt(Math.trunc(v)); } catch { return 0n; } }
  try { return BigInt(v ?? 0); } catch { return 0n; }
};

/** 0x1234…9abc */
export function shortAddress(addr, head = 6, tail = 4) {
  const a = String(addr ?? '');
  if (!/^0x[0-9a-fA-F]{8,}$/.test(a)) return '—';
  return `${a.slice(0, 2 + head)}…${a.slice(-tail)}`;
}

/** uint256 with 18 decimals -> "1,234.56". BigInt only, no precision loss. */
export function formatUnits(value, decimals = 2, unit = 18) {
  let v = big(value);
  const neg = v < 0n;
  if (neg) v = -v;
  const whole = v / 10n ** BigInt(unit);
  const frac = (v % 10n ** BigInt(unit)) / 10n ** BigInt(unit - decimals);
  const w = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + w + (decimals ? `.${frac.toString().padStart(decimals, '0')}` : '');
}

const formatUsd = (v, d = 2) => `$${formatUnits(v, d)}`;

/** Prices are tiny, so every price on the page carries ten decimals. */
function formatPrice(value) {
  const v = big(value);
  if (v <= 0n) return '—';
  return `$${formatUnits(v, 10)}`;
}

function formatCompact(value) {
  const n = Number(big(value) / WAD);
  if (n >= 1_000_000_000) return `${+(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-US');
}

const formatCount = (v) => big(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const toNum = (v) => Number(big(v) / 10n ** 14n) / 10000;

const at = (o, name, idx) => {
  if (o == null) return undefined;
  const byName = o[name];
  return byName !== undefined ? byName : o[idx];
};

/* SaleSchema: islive, hardcap, totalRaised, totalBuyers, saleTokens,
               listingPrice, startTime, endTime, minBuy, maxBuy, finalized */
const SALE_FIELDS = {
  islive: 0, hardcap: 1, totalRaised: 2, totalBuyers: 3, saleTokens: 4,
  listingPrice: 5, startTime: 6, endTime: 7, minBuy: 8, maxBuy: 9, finalized: 10,
};

/**
 * Field names this page understands. The first match wins, so the contract can
 * hand back totalRised, totalRaised or raised and it all lands in one place.
 */
const SALE_ALIASES = {
  islive: ['islive', 'isLive', 'live', 'active'],
  hardcap: ['hardcap', 'hardCap'],
  totalRaised: ['totalRaised', 'totalRised', 'raised', 'totalRaise'],
  totalBuyers: ['totalBuyers', 'totalUser', 'totalUsers', 'buyers'],
  saleTokens: ['saleTokens', 'tokensForSale', 'totalSaleToken'],
  listingPrice: ['listingPrice', 'targetPrice', 'targetListingPrice'],
  startTime: ['startTime', 'start'],
  endTime: ['endTime', 'end'],
  minBuy: ['minBuy', 'minimumBuy'],
  maxBuy: ['maxBuy', 'maximumBuy'],
  finalized: ['finalized', 'isFinalized'],
};

const USER_ALIASES = {
  contributed: ['contributed', 'contribution', 'userContribution', 'userUSDTBought'],
  tokenAllocate: ['tokenAllocate', 'userTokenAllocate', 'tokenAllocation', 'allocation'],
  claimed: ['claimed', 'userIsClaimed', 'userClaimed', 'isClaimed'],
  usdtBalance: ['usdtBalance', 'userUSDTHas', 'userUsdtBalance', 'usdt'],
};

const pickAlias = (src, names) => {
  if (!src) return undefined;
  for (const n of names) {
    const v = src[n];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
};

/**
 * Accepts renderPresale(ctx) as well as renderPresale(account, sale, options).
 * Sale and user fields may sit inside ctx.presale / ctx.user, or flat on ctx
 * itself the way a contract read spreads out, e.g.
 * { totalUser, totalRised, userUSDTHas, userUSDTBought, userIsClaimed }.
 */
function normalizeArgs(a, b, c) {
  if (typeof a === 'string' || a == null) {
    return { account: a ?? ZERO, sale: b ?? null, opt: c ?? {} };
  }
  const ctx = a;
  const account = ctx.account ?? ctx.wallet?.address ?? ZERO;
  const presale = ctx.presale ?? ctx.presaleData ?? ctx.sale ?? null;
  const user = ctx.user ?? ctx.userData ?? ctx.userdata ?? null;

  // flat sale fields only fill the gaps the presale object left open
  const sale = {};
  for (const [key, names] of Object.entries(SALE_ALIASES)) {
    if (pickAlias(presale, names) !== undefined) continue;
    const v = pickAlias(ctx, names);
    if (v !== undefined) sale[key] = v;
  }

  const me = {};
  for (const [key, names] of Object.entries(USER_ALIASES)) {
    const v = pickAlias(user, names) ?? pickAlias(ctx, names);
    if (v !== undefined) me[key] = v;
  }

  return {
    account,
    sale: presale,
    opt: {
      ...(ctx.options ?? {}),
      ...sale,
      token: ctx.token,
      logoUrl: ctx.logoUrl,
      refBase: ctx.refBase,
      referrerAddress: ctx.referrerAddress ?? ctx.sponsorId ?? ctx.ref,
      usdtBalance: me.usdtBalance ?? ctx.balances?.usdt ?? 0,
      user: me,
    },
  };
}

/** The five numbers a member sees about themselves. */
function readUser(u = {}, o = {}) {
  const g = (...names) => {
    for (const n of names) {
      if (u[n] !== undefined && u[n] !== null && u[n] !== '') return u[n];
      if (o[n] !== undefined && o[n] !== null && o[n] !== '') return o[n];
    }
    return undefined;
  };
  return {
    contributed: big(g('contributed', 'contribution', 'userContribution') ?? 0),
    allocate: g('tokenAllocate', 'tokenAllocation', 'allocation'),
    claimed: Boolean(g('claimed', 'userClaimed', 'isClaimed')),
  };
}

function readSale(d, o = {}) {
  const g = (name) => {
    const fromOpt = o[name];
    if (fromOpt !== undefined && fromOpt !== null) return fromOpt;
    return at(d, name, SALE_FIELDS[name]);
  };
  const or = (name, fallback) => {
    const v = g(name);
    return v === undefined || v === null || v === '' ? fallback : big(v);
  };

  // A zero or missing hardcap would read as "already full", so fall back.
  let hardcap = or('hardcap', HARDCAP);
  if (hardcap <= 0n) hardcap = HARDCAP;
  let saleTokens = or('saleTokens', SALE_TOKENS);
  if (saleTokens <= 0n) saleTokens = SALE_TOKENS;
  let raised = or('totalRaised', 0n);
  if (raised > hardcap) raised = hardcap;

  // Unix seconds is what the contract returns, but Date.now() style values in
  // milliseconds are easy to pass by accident. Accept both.
  const seconds = (v) => {
    let n = Number(or(v, 0n));
    if (!Number.isFinite(n) || n <= 0) return 0;
    if (n > 1e12) n = Math.floor(n / 1000);
    return n;
  };

  // islive under any of the usual names; open unless told otherwise
  let live = g('islive');
  if (live === undefined) live = g('isLive');
  if (live === undefined) live = g('live');
  if (live === undefined) live = g('active');
  if (live === undefined && g('paused') !== undefined) live = !g('paused');
  if (live === undefined) live = true;
  if (live === 'false' || live === '0' || live === 0) live = false;

  return {
    live: Boolean(live),
    hardcap,
    saleTokens,
    raised,
    buyers: or('totalBuyers', 0n),
    listing: or('listingPrice', LISTING_PRICE),
    start: seconds('startTime'),
    end: seconds('endTime'),
    minBuy: or('minBuy', 1n * WAD),
    maxBuy: or('maxBuy', 0n),
    finalized: Boolean(g('finalized')),
  };
}

const isConnected = (account) => {
  const a = String(account ?? '').toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(a) && a !== ZERO;
};

const priceOf = (raised, saleTokens) =>
  (saleTokens > 0n ? (big(raised) * WAD) / saleTokens : 0n);

const tokensFor = (part, raised, saleTokens) =>
  (raised > 0n ? (big(part) * saleTokens) / raised : 0n);

function pctOf(value, total) {
  if (total <= 0n) return 0;
  const p = Number((big(value) * 10000n) / total) / 100;
  return Math.max(0, Math.min(100, p));
}

/* -------------------------------- styles -------------------------------- */

function styles(rid) {
  const R = `#${rid}`;

  return /*html*/`<style>
${R}{
  --mint:#2FE884;
  --gold:#F2E85C;
  --cyan:#22C9E8;
  --live:#2FE884;
  --bg:#070908;
  --hair:rgba(255,255,255,.10);
  --ink:#F3F5F3;
  --ink-dim:rgba(243,245,243,.55);
  --ink-faint:rgba(243,245,243,.34);
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;
  --grad:linear-gradient(135deg,#4BF092,#25DD8B 45%,var(--cyan));
  --tile:clamp(10px,1.3cqw,13px);
  --block:clamp(12px,1.6cqw,15px);
  --panel:clamp(14px,1.8cqw,20px);
  container-type:inline-size;container-name:wp;
  display:block;position:relative;isolation:isolate;overflow:hidden;width:100%;max-width:100%;
  color:var(--ink);background:var(--bg);font-feature-settings:"tnum" 1;
  padding:0 clamp(12px,2.6cqw,30px) clamp(26px,4cqw,52px);border-radius:var(--panel);
}
${R} *{box-sizing:border-box;min-width:0}
${R} .wp-glow{
  position:absolute;left:50%;top:clamp(-200px,-20cqw,-120px);width:min(900px,150%);height:clamp(340px,44cqw,540px);
  transform:translateX(-50%);pointer-events:none;z-index:0;filter:blur(clamp(56px,8cqw,92px));opacity:.46;
  background:radial-gradient(45% 50% at 34% 50%,rgba(47,232,132,.48),transparent 70%),
             radial-gradient(45% 50% at 68% 44%,rgba(34,201,232,.3),transparent 72%);
}
${R} .wp-mesh{
  position:absolute;inset:0 0 auto;height:clamp(380px,50cqw,620px);z-index:0;pointer-events:none;
  background-image:linear-gradient(rgba(255,255,255,.022) 1px,transparent 1px),
                   linear-gradient(90deg,rgba(255,255,255,.022) 1px,transparent 1px);
  background-size:clamp(24px,4cqw,38px) clamp(24px,4cqw,38px);
  -webkit-mask-image:radial-gradient(72% 70% at 50% 0%,#000,transparent 78%);
          mask-image:radial-gradient(72% 70% at 50% 0%,#000,transparent 78%);
}
${R} .wp-wrap{position:relative;z-index:1;max-width:1080px;margin:0 auto}

/* ---------- shared type, same scale as the dashboard ---------- */
${R} .wp-label{font-size:clamp(8px,1.3cqw,9.5px);letter-spacing:.18em;text-transform:uppercase;color:var(--mint);white-space:nowrap}
${R} .wp-label--dim{color:var(--ink-faint)}
${R} .wp-num{font-family:var(--mono);font-weight:600;letter-spacing:-.01em}
${R} .wp-live{
  width:clamp(4px,.7cqw,6px);height:clamp(4px,.7cqw,6px);border-radius:50%;flex:none;display:inline-block;
  background:var(--live);box-shadow:0 0 0 2px rgba(47,232,132,.16),0 0 6px rgba(47,232,132,.55);
}
${R} .wp-h2{margin:0;font-size:clamp(15px,2.6cqw,21px);line-height:1.1;font-weight:600;letter-spacing:-.01em}
${R} .wp-sub{margin:7px 0 0;font-size:clamp(9.5px,1.3cqw,11.5px);line-height:1.6;color:var(--ink-faint);max-width:48ch}
${R} .wp-quiet{margin:0;font-size:clamp(9.5px,1.4cqw,11px);line-height:1.6;color:var(--ink-faint)}

/* ---------- buttons ---------- */
${R} .wp-cta{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;border:0;flex:none;
  white-space:nowrap;padding:9px clamp(13px,1.7cqw,20px);border-radius:999px;color:#06301A;font:inherit;font-weight:700;
  font-size:clamp(10.5px,1.4cqw,12.5px);letter-spacing:.06em;text-transform:uppercase;background:var(--grad);
  box-shadow:0 0 0 1px rgba(255,255,255,.22) inset,0 12px 26px -12px rgba(34,201,232,.9);
  transition:transform .16s ease,filter .16s ease;
}
${R} .wp-cta:hover{transform:translateY(-1px);filter:saturate(1.1)}
${R} .wp-cta:disabled{cursor:not-allowed;opacity:.4;transform:none;box-shadow:none;filter:none}
${R} .wp-wallet{
  display:inline-flex;align-items:center;gap:8px;flex:none;cursor:pointer;white-space:nowrap;
  padding:7px clamp(11px,1.4cqw,15px);border-radius:999px;border:1px solid rgba(47,232,132,.3);
  background:rgba(255,255,255,.035);box-shadow:0 1px 0 rgba(255,255,255,.05) inset;
  font-family:var(--mono);font-size:clamp(10px,1.4cqw,12.5px);color:var(--ink);
  transition:border-color .16s ease,background .16s ease;
}
${R} .wp-wallet:hover{border-color:rgba(47,232,132,.7);background:rgba(47,232,132,.08)}
${R} button:focus-visible,${R} input:focus-visible{outline:2px solid var(--mint);outline-offset:3px}

/* ---------- nav ---------- */
${R} .wp-nav{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:clamp(14px,2cqw,20px) 0 clamp(20px,3.4cqw,42px)}
${R} .wp-brand{display:flex;align-items:center;gap:9px;min-width:0}
${R} .wp-brand-mark{
  width:clamp(26px,3.4cqw,34px);height:clamp(26px,3.4cqw,34px);display:grid;place-items:center;flex:none;
  border:1px solid rgba(47,232,132,.35);border-radius:clamp(9px,1.2cqw,12px);
  background:linear-gradient(160deg,rgba(255,255,255,.07),rgba(34,201,232,.07));
}
${R} .wp-brand-mark img{width:76%;height:76%;display:block;object-fit:contain}
${R} .wp-brand b{display:block;font-size:clamp(13px,1.7cqw,16px);font-weight:700;letter-spacing:.06em;line-height:1.1}
${R} .wp-brand i{display:block;font-style:normal;font-size:clamp(7.5px,1cqw,9px);letter-spacing:.28em;text-transform:uppercase;color:var(--ink-faint)}
${R} .wp-nav-short{display:none}
@container wp (max-width:430px){
  ${R} .wp-brand i{display:none}
  ${R} .wp-nav-long{display:none}
  ${R} .wp-nav-short{display:inline}
}

/* ---------- hero ---------- */
${R} .wp-hero{text-align:center;padding-bottom:clamp(20px,3cqw,36px)}
${R} .wp-badge{
  display:inline-flex;align-items:center;gap:8px;padding:5px clamp(11px,1.5cqw,15px);border-radius:999px;
  border:1px solid rgba(47,232,132,.32);background:rgba(47,232,132,.09);
  font-size:clamp(8.5px,1.3cqw,10px);letter-spacing:.16em;text-transform:uppercase;color:var(--mint);
}
${R} .wp-hero h1{margin:clamp(12px,1.8cqw,18px) 0 0;font-size:clamp(26px,5.6cqw,46px);line-height:1.05;font-weight:600;letter-spacing:-.025em}
${R} .wp-hero h1 em{
  font-style:normal;background:linear-gradient(100deg,#6CF7AE,#2FE884 42%,var(--cyan));
  -webkit-background-clip:text;background-clip:text;color:transparent;
}
${R} .wp-hero p{margin:clamp(10px,1.4cqw,14px) auto 0;max-width:56ch;font-size:clamp(11px,1.6cqw,13.5px);line-height:1.6;color:var(--ink-dim)}
${R} .wp-contract{
  display:inline-flex;align-items:center;gap:8px;margin-top:clamp(12px,1.8cqw,18px);
  padding:5px 5px 5px clamp(11px,1.5cqw,15px);border-radius:999px;
  border:1px solid var(--hair);background:rgba(255,255,255,.03);
  font-family:var(--mono);font-size:clamp(9.5px,1.3cqw,11.5px);color:var(--ink-dim);
}
${R} .wp-copy{
  flex:none;display:inline-flex;align-items:center;gap:6px;cursor:pointer;border:0;border-radius:999px;
  padding:6px clamp(10px,1.4cqw,14px);color:#06301A;font:inherit;font-weight:700;
  font-size:clamp(9.5px,1.3cqw,11px);letter-spacing:.06em;text-transform:uppercase;background:var(--grad);
  box-shadow:0 0 0 1px rgba(255,255,255,.22) inset,0 8px 20px -10px rgba(34,201,232,.9);
  transition:transform .16s ease,filter .16s ease;
}
${R} .wp-copy:hover{transform:translateY(-1px);filter:saturate(1.1)}
${R} .wp-copy:disabled{cursor:not-allowed;opacity:.4;transform:none;box-shadow:none}
${R} .wp-copy .wp-done{display:none}
${R} .wp-copy.is-copied .wp-idle{display:none}
${R} .wp-copy.is-copied .wp-done{display:inline}

/* ---------- countdown ---------- */
${R} .wp-clock{display:flex;justify-content:center;gap:clamp(5px,.9cqw,9px);margin-top:clamp(16px,2.4cqw,28px)}
${R} .wp-unit{
  min-width:clamp(58px,8.6cqw,84px);padding:clamp(8px,1.3cqw,13px) 8px;border-radius:var(--block);
  border:1px solid var(--hair);background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.012));
}
${R} .wp-unit b{display:block;font-family:var(--mono);font-size:clamp(17px,3cqw,27px);font-weight:600;letter-spacing:-.03em;line-height:1}
${R} .wp-unit span{display:block;margin-top:6px;font-size:clamp(7px,1cqw,8.5px);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-faint)}

/* ---------- sale card ---------- */
${R} .wp-card{
  position:relative;max-width:640px;margin:0 auto;padding:clamp(14px,2.2cqw,24px);
  border:1px solid rgba(47,232,132,.26);border-radius:var(--panel);
  background:
    radial-gradient(130% 85% at 50% -12%,rgba(47,232,132,.15),transparent 62%),
    linear-gradient(180deg,#101613 0%,#0A0E0C 58%,#070908 100%);
  box-shadow:0 1px 0 rgba(255,255,255,.06) inset,0 50px 92px -60px rgba(47,232,132,.6),0 30px 70px -50px #000;
}
${R} .wp-id{display:flex;align-items:center;flex-wrap:wrap;gap:clamp(8px,1.3cqw,13px);padding-bottom:clamp(12px,1.8cqw,17px);border-bottom:1px solid var(--hair)}
${R} .wp-id-mark{
  width:clamp(34px,4.8cqw,46px);height:clamp(34px,4.8cqw,46px);display:grid;place-items:center;flex:none;
  border:1px solid rgba(59,238,140,.5);border-radius:var(--block);
  background:linear-gradient(160deg,rgba(47,232,132,.2),rgba(255,255,255,.02) 65%,rgba(34,201,232,.12));
  box-shadow:0 0 30px -12px rgba(47,232,132,.85);
}
${R} .wp-id-mark img{width:72%;height:72%;display:block;object-fit:contain}
${R} .wp-id-text{flex:1 1 150px;min-width:0}
${R} .wp-id-text b{display:block;font-size:clamp(13px,2cqw,17px);font-weight:600;letter-spacing:-.01em;line-height:1.2}
${R} .wp-id-text span{display:block;margin-top:2px;font-family:var(--mono);font-size:clamp(9px,1.3cqw,11px);color:var(--ink-dim)}
${R} .wp-status{
  display:inline-flex;align-items:center;gap:6px;flex:none;padding:3px clamp(9px,1.3cqw,12px);border-radius:999px;
  font-size:clamp(8.5px,1.3cqw,10px);font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  color:#06301A;background:var(--grad);
}
${R} .wp-status--off{background:rgba(255,255,255,.05);color:var(--ink-dim);box-shadow:0 0 0 1px var(--hair) inset}
${R} .wp-status--off .wp-live{background:var(--ink-faint);box-shadow:none}

${R} .wp-raised{margin-top:clamp(13px,1.9cqw,18px);font-family:var(--mono);font-size:clamp(26px,5cqw,40px);font-weight:600;letter-spacing:-.035em;line-height:1;color:var(--gold)}
${R} .wp-of{margin-top:6px;font-family:var(--mono);font-size:clamp(9.5px,1.4cqw,11.5px);color:var(--ink-dim)}
${R} .wp-of b{color:var(--ink);font-weight:600}

${R} .wp-bar{
  position:relative;height:clamp(9px,1.2cqw,13px);margin-top:clamp(13px,1.8cqw,17px);border-radius:999px;overflow:hidden;
  background:rgba(255,255,255,.06);box-shadow:0 1px 0 rgba(255,255,255,.05) inset;
}
${R} .wp-bar i{
  position:absolute;top:0;bottom:0;left:0;width:var(--pct);border-radius:999px;
  background:linear-gradient(90deg,#28E36F,#2FE884 40%,var(--cyan));box-shadow:0 0 18px rgba(47,232,132,.55);
  animation:wp-grow .9s cubic-bezier(.2,.75,.3,1) both;
}
${R} .wp-bar u{position:absolute;top:0;bottom:0;width:1px;background:rgba(16,20,16,.75);text-decoration:none}
${R} .wp-scale{display:flex;justify-content:space-between;margin-top:6px;font-size:clamp(7.5px,1.1cqw,9px);letter-spacing:.1em;color:var(--ink-faint)}
${R} .wp-scale b{color:var(--mint);font-weight:600}

${R} .wp-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(6px,.9cqw,9px);margin-top:clamp(13px,1.8cqw,17px)}
${R} .wp-tile{
  display:flex;flex-direction:column;padding:clamp(7px,1.1cqw,11px) clamp(8px,1.2cqw,12px);
  border:1px solid var(--hair);border-radius:var(--tile);background:rgba(255,255,255,.025);
}
${R} .wp-tile .wp-label{white-space:normal;line-height:1.35}
${R} .wp-tile .wp-num{display:block;margin-top:3px;font-size:clamp(12px,1.8cqw,15px);color:var(--ink);overflow:hidden;text-overflow:ellipsis}
${R} .wp-tile--gold .wp-num{color:var(--gold)}
${R} .wp-tile--mint .wp-num{color:var(--mint)}
${R} .wp-tile--lift{border-color:rgba(47,232,132,.24);background:rgba(47,232,132,.06)}
${R} .wp-tile em{display:block;margin-top:3px;font-style:normal;font-size:clamp(7.5px,1.1cqw,9px);color:var(--ink-faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${R} .wp-mini{
  margin-top:8px;width:100%;cursor:pointer;border-radius:999px;font:inherit;font-weight:700;border:0;
  font-size:clamp(9px,1.2cqw,10.5px);letter-spacing:.1em;text-transform:uppercase;padding:5px 10px;color:#06301A;
  background:var(--grad);box-shadow:0 0 0 1px rgba(255,255,255,.2) inset,0 8px 16px -10px rgba(47,232,132,1);
  transition:transform .16s ease,filter .16s ease;
}
${R} .wp-mini:hover{transform:translateY(-1px);filter:saturate(1.1)}
${R} .wp-mini:disabled{cursor:not-allowed;opacity:.4;transform:none;box-shadow:none}

/* ---------- buy ---------- */
${R} .wp-buy{margin-top:clamp(15px,2.2cqw,22px);padding-top:clamp(14px,2cqw,20px);border-top:1px solid var(--hair)}
${R} .wp-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;flex-wrap:wrap}
${R} .wp-field{
  display:flex;align-items:center;gap:8px;
  padding:5px 5px 5px clamp(12px,1.6cqw,18px);border-radius:999px;
  border:1px solid var(--hair);background:rgba(255,255,255,.035);
  box-shadow:0 1px 0 rgba(255,255,255,.05) inset;transition:border-color .18s ease,box-shadow .18s ease;
}
${R} .wp-field:focus-within{border-color:rgba(47,232,132,.5);box-shadow:0 1px 0 rgba(255,255,255,.06) inset,0 0 0 3px rgba(47,232,132,.12)}
${R} .wp-field-main{flex:1;display:flex;align-items:center;gap:8px;min-width:0}
${R} .wp-field input{
  flex:1;min-width:0;border:0;background:transparent;color:var(--ink);outline:none;padding:8px 0;
  font-family:var(--mono);font-size:clamp(14px,2.2cqw,18px);font-weight:600;letter-spacing:-.02em;
}
${R} .wp-field input::placeholder{color:var(--ink-faint);font-weight:400;letter-spacing:.04em}
${R} .wp-field input::-webkit-outer-spin-button,${R} .wp-field input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
${R} .wp-denom{flex:none;font-family:var(--mono);font-size:clamp(9.5px,1.3cqw,11.5px);color:var(--ink-faint);padding-right:4px}
/* narrow: the pill holds the input only and the button sits under it */
@container wp (max-width:520px){
  ${R} .wp-field{display:block;padding:0;border:0;background:none;box-shadow:none}
  ${R} .wp-field:focus-within{border:0;box-shadow:none}
  ${R} .wp-field-main{
    padding:4px clamp(13px,3.4cqw,18px);border-radius:999px;
    border:1px solid var(--hair);background:rgba(255,255,255,.035);
    box-shadow:0 1px 0 rgba(255,255,255,.05) inset;transition:border-color .18s ease,box-shadow .18s ease;
  }
  ${R} .wp-field-main:focus-within{border-color:rgba(47,232,132,.5);box-shadow:0 1px 0 rgba(255,255,255,.06) inset,0 0 0 3px rgba(47,232,132,.12)}
  ${R} .wp-field .wp-cta{display:flex;width:100%;margin-top:8px;padding:12px 16px}
}
${R} .wp-get{
  display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px 10px;margin-top:9px;
  padding:clamp(8px,1.2cqw,11px) clamp(11px,1.5cqw,15px);border-radius:var(--tile);
  border:1px solid rgba(47,232,132,.22);background:rgba(47,232,132,.06);
}
${R} .wp-get .wp-num{font-size:clamp(11px,1.7cqw,14px);color:var(--gold)}
${R} .wp-get small{font-size:clamp(7.5px,1.1cqw,9px);font-weight:400;color:var(--ink-faint);margin-left:5px;font-family:inherit}
${R} .wp-note{display:block;margin-top:8px;font-size:clamp(8.5px,1.2cqw,10px);color:var(--ink-faint);text-align:center}
${R} .wp-note--warn{color:var(--gold)}
${R} .wp-closed{
  display:flex;flex-direction:column;align-items:center;text-align:center;gap:clamp(8px,1.2cqw,12px);
  padding:clamp(10px,1.6cqw,18px) 0 clamp(4px,.8cqw,8px);
}
${R} .wp-closed h3{margin:0;font-size:clamp(13px,2.2cqw,18px);font-weight:600;letter-spacing:-.01em}
${R} .wp-closed p{margin:0;max-width:40ch;font-size:clamp(9.5px,1.4cqw,11.5px);line-height:1.55;color:var(--ink-dim)}

/* ---------- your position ---------- */
${R} .wp-ref{
  display:flex;align-items:center;gap:8px;margin-top:9px;padding:5px 5px 5px clamp(10px,1.4cqw,14px);
  border:1px solid var(--hair);border-radius:999px;background:rgba(255,255,255,.03);
  box-shadow:0 1px 0 rgba(255,255,255,.04) inset;
}
${R} .wp-ref-url{
  flex:1;font-family:var(--mono);font-size:clamp(9.5px,1.3cqw,11.5px);color:var(--ink-dim);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}

/* ---------- trust ---------- */
${R} .wp-trust{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin:clamp(14px,2cqw,22px) auto 0;max-width:640px}
${R} .wp-trust span{
  display:inline-flex;align-items:center;gap:7px;padding:5px clamp(10px,1.4cqw,14px);border-radius:999px;
  border:1px solid var(--hair);background:rgba(255,255,255,.025);
  font-size:clamp(9px,1.25cqw,11px);color:var(--ink-dim);
}
${R} .wp-tick{width:clamp(11px,1.4cqw,13px);height:clamp(11px,1.4cqw,13px);flex:none;color:var(--mint)}

/* ---------- details ---------- */
${R} .wp-split{display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(20px,3cqw,34px);margin-top:clamp(28px,4.4cqw,54px)}
@container wp (min-width:820px){${R} .wp-split{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
${R} .wp-table{margin-top:clamp(12px,1.7cqw,16px);border-top:1px dashed rgba(255,255,255,.07)}
${R} .wp-tr{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:clamp(7px,1cqw,9px) 2px;border-bottom:1px dashed rgba(255,255,255,.07)}
${R} .wp-tr span{font-size:clamp(9.5px,1.4cqw,11.5px);color:var(--ink-dim)}
${R} .wp-tr b{font-family:var(--mono);font-size:clamp(10px,1.5cqw,12.5px);font-weight:600;letter-spacing:-.01em;text-align:right}
${R} .wp-tr b.gold{color:var(--gold)}

${R} .wp-alloc{display:flex;flex-direction:column;gap:clamp(10px,1.5cqw,15px);margin-top:clamp(12px,1.7cqw,16px)}
${R} .wp-alloc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
${R} .wp-alloc-head b{font-size:clamp(10.5px,1.5cqw,12.5px);font-weight:600}
${R} .wp-alloc-head i{display:block;font-style:normal;font-size:clamp(8.5px,1.2cqw,10px);color:var(--ink-faint);margin-top:2px}
${R} .wp-alloc-head em{font-style:normal;font-family:var(--mono);font-size:clamp(9.5px,1.4cqw,11.5px);color:var(--ink-dim);white-space:nowrap}
${R} .wp-alloc-bar{height:clamp(5px,.8cqw,7px);margin-top:7px;border-radius:999px;background:rgba(255,255,255,.055);overflow:hidden}
${R} .wp-alloc-bar i{display:block;height:100%;width:var(--pct);border-radius:999px;background:linear-gradient(90deg,rgba(40,227,111,.9),#22C9E8);opacity:var(--a,1)}


/* ---------- steps ---------- */
${R} .wp-steps{display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(8px,1.1cqw,12px);margin-top:clamp(12px,1.7cqw,16px)}
@container wp (min-width:640px){${R} .wp-steps{grid-template-columns:repeat(2,minmax(0,1fr))}}
@container wp (min-width:940px){${R} .wp-steps{grid-template-columns:repeat(4,minmax(0,1fr))}}
${R} .wp-step{padding:clamp(11px,1.6cqw,16px);border-radius:var(--block);border:1px solid var(--hair);background:rgba(255,255,255,.022)}
${R} .wp-step em{
  display:grid;place-items:center;width:clamp(22px,3cqw,27px);height:clamp(22px,3cqw,27px);border-radius:999px;
  font-style:normal;font-family:var(--mono);font-size:clamp(10.5px,1.4cqw,12.5px);font-weight:700;color:#06301A;background:var(--grad);
  box-shadow:0 0 0 1px rgba(255,255,255,.25) inset,0 5px 12px -6px rgba(47,232,132,1);
}
${R} .wp-step b{display:block;margin:clamp(8px,1.2cqw,12px) 0 5px;font-size:clamp(11px,1.6cqw,13.5px);font-weight:600}
${R} .wp-step p{margin:0;font-size:clamp(9.5px,1.35cqw,11.5px);line-height:1.55;color:var(--ink-dim)}

/* ---------- footer ---------- */
${R} .wp-foot{
  display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;
  margin-top:clamp(26px,3.6cqw,46px);padding-top:clamp(14px,2cqw,20px);border-top:1px solid var(--hair);
}
${R} .wp-foot p{margin:0;max-width:64ch;font-size:clamp(8.5px,1.2cqw,10.5px);line-height:1.65;color:var(--ink-faint)}
${R} .wp-link{cursor:pointer;border:0;background:none;padding:0;font:inherit;font-size:clamp(9.5px,1.3cqw,11.5px);font-weight:600;color:var(--mint);text-decoration:underline;text-underline-offset:3px}

/* ---------- modals ---------- */
${R} .wp-modal{position:fixed;inset:0;z-index:70;display:none;align-items:center;justify-content:center;padding:16px}
${R} .wp-modal.is-open{display:flex}
${R} .wp-bg{position:absolute;inset:0;background:rgba(3,6,4,.78);backdrop-filter:blur(6px)}
${R} .wp-dialog{
  position:relative;width:100%;max-width:520px;max-height:88vh;display:flex;flex-direction:column;
  border:1px solid rgba(47,232,132,.2);border-radius:20px;padding:18px;color:var(--ink);
  background:
    radial-gradient(100% 70% at 50% -10%, rgba(47,232,132,.14), transparent 60%),
    radial-gradient(70% 55% at 105% 108%, rgba(34,201,232,.10), transparent 70%),
    linear-gradient(180deg,#101613 0%, #0B100D 60%, #070908 100%);
  box-shadow:0 1px 0 rgba(255,255,255,.06) inset,0 40px 90px -40px rgba(0,0,0,1);
}
${R} .wp-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
${R} .wp-dialog-head h3{margin:4px 0 0;font-size:17px;font-weight:600;letter-spacing:-.01em}
${R} .wp-eyebrow{margin:0;font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:var(--mint)}
${R} .wp-x{flex:none;width:30px;height:30px;border-radius:999px;cursor:pointer;border:1px solid var(--hair);background:rgba(255,255,255,.03);color:var(--ink-dim);font-size:15px;line-height:1}
${R} .wp-x:hover{color:var(--ink);border-color:rgba(47,232,132,.5)}
${R} .wp-review{margin-bottom:12px;padding:6px 14px;border-radius:13px;border:1px solid rgba(47,232,132,.24);background:rgba(47,232,132,.07)}
${R} .wp-review > div{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px dashed rgba(255,255,255,.08)}
${R} .wp-review > div:last-child{border-bottom:0}
${R} .wp-review span{font-size:11.5px;color:var(--ink-dim)}
${R} .wp-review b{font-family:var(--mono);font-size:12.5px;font-weight:600;letter-spacing:-.01em;text-align:right;color:var(--ink)}
${R} .wp-review > div:first-child b,${R} .wp-review > div:nth-child(4) b{color:var(--gold)}
${R} .wp-review-ref{color:var(--mint)!important;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${R} .wp-doc{
  overflow-y:auto;padding:14px 16px;margin-bottom:12px;border:1px solid var(--hair);border-radius:14px;
  background:rgba(255,255,255,.02);font-size:12px;line-height:1.65;color:var(--ink-dim);
  scrollbar-width:thin;scrollbar-color:rgba(47,232,132,.3) transparent;
}
${R} .wp-doc::-webkit-scrollbar{width:5px}
${R} .wp-doc::-webkit-scrollbar-thumb{background:rgba(47,232,132,.28);border-radius:999px}
${R} .wp-doc h4{margin:0 0 4px;font-size:13.5px;color:var(--ink);font-weight:600}
${R} .wp-doc h5{margin:16px 0 4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--mint)}
${R} .wp-doc p{margin:0 0 8px}
${R} .wp-date{font-family:var(--mono);font-size:10.5px;color:var(--ink-faint)}
${R} .wp-warn{margin-top:14px;padding-top:12px;border-top:1px dashed rgba(255,255,255,.1);color:var(--gold)}
${R} .wp-check{display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:11px 13px;border-radius:13px;border:1px solid var(--hair);background:rgba(255,255,255,.025);font-size:11.5px;line-height:1.5;color:var(--ink-dim)}
${R} .wp-check input{width:17px;height:17px;flex:none;margin:1px 0 0;accent-color:#2FE884;cursor:pointer}
${R} .wp-dialog-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}
${R} .wp-btn{
  cursor:pointer;border-radius:999px;padding:11px 20px;font:inherit;font-weight:700;font-size:11.5px;
  letter-spacing:.07em;text-transform:uppercase;border:1px solid var(--hair);color:var(--ink-dim);
  background:rgba(255,255,255,.03);transition:color .16s ease,border-color .16s ease;
}
${R} .wp-btn:hover{color:var(--ink);border-color:rgba(47,232,132,.45)}

${R} .wp-dialog--status{max-width:400px;text-align:center;align-items:center}
${R} .wp-orb{width:62px;height:62px;margin:6px auto 14px;border-radius:999px;display:grid;place-items:center;font-size:26px;line-height:1;color:#06301A}
${R} [data-state="pending"] .wp-orb{background:conic-gradient(from 0deg,transparent 0turn,#2FE884 .55turn,var(--cyan) .85turn,transparent 1turn);animation:wp-spin 1s linear infinite}
${R} [data-state="pending"] .wp-orb span{display:block;width:48px;height:48px;border-radius:999px;background:#0A0E0C}
${R} [data-state="done"] .wp-orb{background:var(--grad);box-shadow:0 0 40px -8px rgba(47,232,132,.8)}
${R} [data-state="error"] .wp-orb{background:rgba(255,255,255,.06);border:1px solid rgba(255,120,120,.5);color:#FF8B8B}
${R} [data-state="pending"] .wp-dialog-foot{display:none}
${R} .wp-msg{margin:0;font-size:12px;line-height:1.6;color:var(--ink-dim)}
${R} .wp-tx{
  display:inline-block;max-width:100%;margin-top:12px;padding:8px 14px;border-radius:999px;cursor:pointer;
  border:1px solid var(--hair);background:rgba(255,255,255,.03);font-family:var(--mono);font-size:11px;
  color:var(--ink-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
${R} .wp-tx:hover{color:var(--ink);border-color:rgba(47,232,132,.45)}
${R} .wp-tx.is-copied::after{content:' — copied';color:var(--mint)}

@keyframes wp-spin{to{transform:rotate(1turn)}}
@keyframes wp-grow{from{width:0}to{width:var(--pct)}}
@media (prefers-reduced-motion:reduce){${R} *{transition:none!important;animation:none!important}}
</style>`;
}

/* --------------------------------- main --------------------------------- */

const TICK = /*html*/`<svg class="wp-tick" viewBox="0 0 16 16" fill="none" aria-hidden="true">
<path d="M3 8.5 6.3 11.8 13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/**
 * @param {any} a context object, or the account address
 * @param {any} [b] sale data when the explicit form is used
 * @param {any} [c] options when the explicit form is used
 * @returns {string} HTML
 */
export function renderPresale(a, b, c) {
  const { account, sale: saleData, opt: options } = normalizeArgs(a, b, c);

  const { refBase = REF_BASE, logoUrl: logo = LOGO_URL } = options;
  const token = { ...TOKEN, ...(options.token || {}) };
  token.supply = big(token.supply);

  const rid = `wp-${++__uid}`;
  const s = readSale(saleData, options);
  const me = readUser(options.user, options);
  const usdt = big(options.usdtBalance);
  const connected = isConnected(account);

  const remaining = s.hardcap > s.raised ? s.hardcap - s.raised : 0n;
  const soldOut = remaining === 0n;
  const expired = s.end > 0 && s.end * 1000 < Date.now();
  // islive from the contract, but the hardcap, the clock and finalize all win.
  const open = s.live && !soldOut && !expired && !s.finalized;

  // Closed rounds are easy to cause by accident, so say which check failed.
  const closedReason = open ? ''
    : (!s.live ? 'islive is false'
      : (soldOut ? 'totalRaised reached the hardcap'
        : (s.finalized ? 'finalized is true'
          : `endTime ${s.end} has passed (${new Date(s.end * 1000).toISOString()})`)));

  const priceNow = priceOf(s.raised, s.saleTokens);
  const priceFinal = priceOf(s.hardcap, s.saleTokens);
  const myTokens = me.allocate !== undefined
    ? big(me.allocate)
    : tokensFor(me.contributed, s.raised, s.saleTokens);
  const pct = pctOf(s.raised, s.hardcap);

  // What this wallet can still spend: hardcap left, wallet balance, per wallet cap.
  let cap = remaining;
  if (usdt > 0n && usdt < cap) cap = usdt;
  if (s.maxBuy > 0n) {
    const left = s.maxBuy > me.contributed ? s.maxBuy - me.contributed : 0n;
    if (left < cap) cap = left;
  }

  // s.listing is the target, reached only at the hardcap. The live listing
  // price keeps the same multiple against whatever has been raised so far.
  const ratio = priceFinal > 0n ? (s.listing * WAD) / priceFinal : 0n;
  const listingNow = (priceNow * ratio) / WAD;
  const multiple = ratio > 0n ? `${Number(ratio / 10n ** 14n) / 10000}x sale price` : `per ${token.symbol}`;

  const referrer = options.referrerAddress != null && options.referrerAddress !== 'nothing'
    ? String(options.referrerAddress) : '';
  const refLink = connected ? `${refBase}${account}` : '';

  const openTerms = `__wp.open('${rid}','terms')`;
  const openReview = `__wp.review('${rid}')`;
  const doBuy = `__wp.buy('${rid}')`;
  const doClaim = `__wp.run('${rid}',['claimTokens','claimWEExt'],[],'Claim')`;

  /* ------------------------------ pieces ------------------------------- */

  const clock = /*html*/`
      <div class="wp-clock">
        ${[['dd', 'Days'], ['hh', 'Hours'], ['mm', 'Mins'], ['ss', 'Secs']].map(([k, l]) => `
        <div class="wp-unit"><b id="${rid}-${k}">00</b><span>${l}</span></div>`).join('')}
      </div>`;

  const tile = (label, value, o = {}) => `
        <div class="wp-tile${o.gold ? ' wp-tile--gold' : ''}${o.mint ? ' wp-tile--mint' : ''}${o.lift ? ' wp-tile--lift' : ''}">
          <span class="wp-label${o.dim ? ' wp-label--dim' : ''}">${esc(label)}</span>
          <span class="wp-num">${esc(value)}</span>
          ${o.note ? `<em>${esc(o.note)}</em>` : ''}
          ${o.action ? `<button type="button" class="wp-mini" data-action="${o.action}" onclick="${o.js}"${o.disabled ? ' disabled' : ''}>${esc(o.cta)}</button>` : ''}
        </div>`;

  const buyBox = /*html*/`
          <div class="wp-row">
            <span class="wp-label">Amount to spend</span>
            <span class="wp-label wp-label--dim">Balance ${formatUnits(usdt)} USDT</span>
          </div>

          <div class="wp-field">
            <div class="wp-field-main">
              <input id="${rid}-amt" type="number" inputmode="decimal" min="0" step="any" placeholder="0.00"
                     aria-label="Amount in USDT"
                     data-min="${toNum(s.minBuy)}" data-cap="${toNum(cap)}"
                     data-raised="${toNum(s.raised)}" data-sale="${toNum(s.saleTokens)}"
                     data-hardcap="${toNum(s.hardcap)}" data-mine="${toNum(me.contributed)}"
                     data-sym="${esc(token.symbol)}" data-ref="${esc(referrer)}"
                     oninput="__wp.sync('${rid}')">
              <span class="wp-denom">USDT</span>
            </div>
            <button type="button" class="wp-cta" id="${rid}-buy" data-action="buy" onclick="${openReview}" disabled>
              Buy ${esc(token.symbol)}
            </button>
          </div>

          <div class="wp-get">
            <span class="wp-label">You receive</span>
            <span class="wp-num"><span id="${rid}-est">0</span> ${esc(token.symbol)}<small>estimated</small></span>
          </div>
          <span class="wp-note" id="${rid}-note">Minimum ${formatUnits(s.minBuy, 0)} USDT per buy</span>`;

  const buyConnect = /*html*/`
          <div class="wp-closed">
            <h3>Connect to buy ${esc(token.symbol)}</h3>
            <p>The round is open. Connect a wallet on ${esc(token.chain)} holding USDT to take part.</p>
            <button type="button" class="wp-cta" data-action="connect-wallet" style="width:100%;padding:13px"
                    onclick="${call('connectWallet')}">Connect wallet</button>
          </div>`;

  const closedNote = soldOut
    ? 'The hardcap is filled. Allocations settle at the final round price.'
    : (s.finalized ? 'The round is finalised. Claim your allocation below.'
      : (expired ? 'The sale period has ended. Allocations settle at the final round price.'
        : 'The presale is not open right now. Check back when the next round starts.'));

  const buyClosed = /*html*/`
          <div class="wp-closed">
            <h3>${soldOut ? 'Hardcap reached' : (s.finalized ? 'Round finalised' : 'Presale closed')}</h3>
            <p>${closedNote}</p>
            <div class="wp-get" style="width:100%;max-width:340px">
              <span class="wp-label">Final raise</span>
              <span class="wp-num">${formatUsd(s.raised)}</span>
            </div>
          </div>`;

  const tr = (label, value, gold) =>
    `<div class="wp-tr"><span>${esc(label)}</span><b${gold ? ' class="gold"' : ''}>${esc(value)}</b></div>`;

  const allocTop = Math.max(...ALLOCATION.map((x) => x.pct));
  const allocRows = ALLOCATION.map((al, i) => `
        <div>
          <div class="wp-alloc-head">
            <div><b>${esc(al.label)}</b><i>${esc(al.note)}</i></div>
            <em>${formatCompact((token.supply * BigInt(al.pct)) / 100n)} · ${al.pct}%</em>
          </div>
          <div class="wp-alloc-bar"><i style="--pct:${((al.pct / allocTop) * 100).toFixed(1)}%;--a:${Math.max(0.45, 1 - i * 0.09).toFixed(2)}"></i></div>
        </div>`).join('');

  const stepCards = STEPS.map((st, i) => `
        <div class="wp-step">
          <em>${i + 1}</em>
          <b>${esc(st.title)}</b>
          <p>${esc(st.body)}</p>
        </div>`).join('');

  const initJs = `${RUNTIME};__wp.sync('${rid}')`
    + (s.end > 0 && open ? `;__wp.clock('${rid}',${s.end})` : '')
    + (closedReason ? `;console.warn('[presale] round shows as closed: ${closedReason.replace(/'/g, '')}')` : '');

  return /*html*/`
<section id="${rid}">
  ${styles(rid)}
  <div class="wp-glow" aria-hidden="true"></div>
  <div class="wp-mesh" aria-hidden="true"></div>

  <div class="wp-wrap">

    <nav class="wp-nav">
      <div class="wp-brand">
        <span class="wp-brand-mark"><img src="${esc(logo)}" alt="" width="34" height="34" loading="lazy" decoding="async"></span>
        <div><b>WE33</b><i>token presale</i></div>
      </div>
      ${connected
        ? `<button type="button" class="wp-wallet" data-action="connect-wallet" title="${esc(account)}"
                   data-address="${esc(account)}" onclick="${call('connectWallet')}">
             <i class="wp-live" aria-hidden="true"></i>
             <span class="wp-nav-long">${esc(shortAddress(account, 6, 6))}</span>
             <span class="wp-nav-short">${esc(shortAddress(account, 3, 4))}</span>
           </button>`
        : `<button type="button" class="wp-cta" data-action="connect-wallet" onclick="${call('connectWallet')}">
             <span class="wp-nav-long">Connect wallet</span><span class="wp-nav-short">Connect</span>
           </button>`}
    </nav>

    <header class="wp-hero">
      <span class="wp-badge"><i class="wp-live" aria-hidden="true"></i>Fair launch · one price for everyone</span>
      <h1>${esc(token.name)} presale<br><em>is ${open ? 'live' : 'closed'}</em></h1>
      <p>${formatCompact(s.saleTokens)} ${esc(token.symbol)} is offered to the whole round. Whatever is raised gets
         divided by that fixed amount, so every buyer settles at exactly the same price when the round ends.</p>
      ${token.address ? `
      <span class="wp-contract">
        ${esc(shortAddress(token.address, 10, 8))}
        <button type="button" class="wp-copy" data-copy="${esc(token.address)}" onclick="__wp.copy(this)">
          <span class="wp-idle">Copy</span><span class="wp-done">Copied</span>
        </button>
      </span>` : ''}
      ${s.end > 0 && open ? clock : ''}
    </header>

    <!-- sale card -->
    <div class="wp-card">
      <div class="wp-id">
        <span class="wp-id-mark"><img src="${esc(logo)}" alt="" width="46" height="46" loading="lazy" decoding="async"></span>
        <span class="wp-id-text">
          <b>${esc(token.name)}</b>
          <span>${esc(token.symbol)} · ${esc(token.chain)} · paid in USDT</span>
        </span>
        <span class="wp-status${open ? '' : ' wp-status--off'}">
          <i class="wp-live" aria-hidden="true"></i>${soldOut ? 'Hardcap reached' : (open ? 'Live now' : 'Closed')}
        </span>
      </div>

      <div class="wp-raised">${formatUsd(s.raised)}</div>
      <div class="wp-of">raised of <b>${formatUsd(s.hardcap, 0)}</b> hardcap · <b>${formatCount(s.buyers)}</b> ${s.buyers === 1n ? 'buyer' : 'buyers'}</div>

      <div class="wp-bar">
        <i style="--pct:${pct.toFixed(2)}%"></i>
        <u style="left:25%"></u><u style="left:50%"></u><u style="left:75%"></u>
      </div>
      <div class="wp-scale">
        <span>$0</span><b>${pct.toFixed(2)}% filled</b><span>${formatUsd(s.hardcap, 0)}</span>
      </div>

      <div class="wp-tiles">
        ${tile('Price now', formatPrice(priceNow), { mint: true, lift: true, note: `per ${token.symbol}` })}
        ${tile('Listing price', formatPrice(listingNow), { gold: true, note: `${multiple}, at today's raise` })}
      </div>

      <div class="wp-buy">
        ${open ? (connected ? buyBox : buyConnect) : buyClosed}

        <div class="wp-tiles" style="margin-top:clamp(15px,2.2cqw,22px)">
          ${tile('Contributed', formatUsd(me.contributed), {
            gold: true,
            note: s.raised > 0n && me.contributed > 0n ? `${pctOf(me.contributed, s.raised).toFixed(2)}% of the round` : 'USDT you put in',
          })}
          ${tile('Token allocate', `${formatCompact(myTokens)} ${token.symbol}`, {
            mint: true,
            note: s.finalized ? (me.claimed ? 'claimed' : 'ready to claim') : 'settles at the close',
            action: 'claim',
            js: doClaim,
            cta: me.claimed ? 'Claimed' : 'Claim',
            disabled: !s.finalized || me.claimed || myTokens === 0n,
          })}
        </div>

        <div class="wp-row" style="margin:clamp(13px,1.8cqw,17px) 0 0">
          <span class="wp-label">Your referral link</span>
          <span class="wp-label wp-label--dim">?ref=wallet</span>
        </div>
        <div class="wp-ref" style="margin-top:7px">
          <span class="wp-ref-url" title="${esc(refLink)}">${esc(connected ? refLink : 'Connect a wallet to get your link')}</span>
          <button type="button" class="wp-copy" data-action="copy-link" data-link="${esc(refLink)}"
                  onclick="__wp.copy(this)"${connected ? '' : ' disabled'}>
            <span class="wp-idle">Copy</span><span class="wp-done">Copied</span>
          </button>
        </div>
        <span class="wp-note">Anyone who buys through this link is registered to your wallet</span>
      </div>
    </div>

    <div class="wp-trust">
      ${TRUST.map((t) => `<span>${TICK}${esc(t)}</span>`).join('')}
    </div>

    <!-- details -->
    <div class="wp-split">
      <div>
        <h2 class="wp-h2">Round details</h2>
        <p class="wp-sub">Everything about this round is fixed before it opens. Only the price moves, and it moves the same way for everyone.</p>
        <div class="wp-table">
          ${tr('Token', `${token.name} (${token.symbol})`)}
          ${tr('Total supply', `${formatCompact(token.supply)} ${token.symbol}`)}
          ${tr('Offered this round', `${formatCompact(s.saleTokens)} ${token.symbol}`)}
          ${tr('Buyers so far', formatCount(s.buyers))}
          ${tr('Sale type', 'Fair launch')}
          ${tr('Payment', 'USDT')}
          ${tr('Hardcap', formatUsd(s.hardcap, 0), true)}
          ${tr('Minimum buy', `${formatUnits(s.minBuy, 0)} USDT`)}
          ${tr('Maximum buy', s.maxBuy > 0n ? `${formatUnits(s.maxBuy, 0)} USDT` : 'No cap per wallet')}
          ${tr('Settlement price', 'Raised ÷ tokens offered')}
          ${tr('Price at hardcap', formatPrice(priceFinal))}
          ${tr('Listing price', `${multiple}, moves with the raise`)}
          ${tr('Target listing price', formatPrice(s.listing), true)}
          ${tr('Claim', s.finalized ? 'Open now' : 'When the round is finalised')}
        </div>
      </div>

      <div>
        <h2 class="wp-h2">Where the supply goes</h2>
        <p class="wp-sub">One third to this round, one third to the pool that trades against it, the rest to the people who use the platform.</p>
        <div class="wp-alloc">${allocRows}</div>
      </div>
    </div>

    <!-- how to buy -->
    <div style="margin-top:clamp(28px,4.4cqw,54px)">
      <h2 class="wp-h2">How to buy</h2>
      <div class="wp-steps">${stepCards}</div>
    </div>

    <footer class="wp-foot">
      <p>Digital assets carry a high level of risk. WE33 gives no guarantee of value, price, listing, income,
         profit or return on WE tokens, and buying is entirely your own voluntary decision.</p>
      <button type="button" class="wp-link" onclick="${openTerms}">Read the full terms</button>
    </footer>
  </div>

  <!-- runtime bootstrap: inline handlers survive innerHTML, script tags do not -->
  <img alt="" aria-hidden="true" src="data:," style="position:fixed;width:0;height:0;opacity:0;pointer-events:none"
       onload="${esc(initJs)}" onerror="${esc(initJs)}">

  <!-- terms -->
  <div class="wp-modal" id="${rid}-terms" role="dialog" aria-modal="true" aria-label="Presale terms">
    <div class="wp-bg" onclick="__wp.close('${rid}','terms')"></div>
    <div class="wp-dialog">
      <div class="wp-dialog-head">
        <div>
          <p class="wp-eyebrow">Before you buy</p>
          <h3>Risk warning and terms</h3>
        </div>
        <button type="button" class="wp-x" aria-label="Close" onclick="__wp.close('${rid}','terms')">✕</button>
      </div>
      <div class="wp-review">
        <div><span>You pay</span><b id="${rid}-r-pay">—</b></div>
        <div><span>Price now</span><b id="${rid}-r-p0">—</b></div>
        <div><span>Price after your buy</span><b id="${rid}-r-p1">—</b></div>
        <div><span>You receive at today's raise</span><b id="${rid}-r-now">—</b></div>
        <div><span>If the round fills (${formatUsd(s.hardcap, 0)})</span><b id="${rid}-r-full">—</b></div>
        <div><span>Your referrer</span><b class="wp-review-ref" title="${esc(referrer || 'No referrer link used')}"
             >${esc(referrer ? shortAddress(referrer, 6, 6) : 'None')}</b></div>
      </div>
      <div class="wp-doc">${TERMS_HTML}</div>
      <label class="wp-check">
        <input type="checkbox" id="${rid}-accept"
               onchange="document.getElementById('${rid}-accept-go').disabled=!this.checked">
        <span>I have read, studied, and fully understood all risk warnings, agreements, and participation terms
              of the ${esc(token.name)} presale. I accept them and understand that buying is entirely voluntary,
              with no guarantee of any price, value, listing, income, profit, or return.</span>
      </label>
      <div class="wp-dialog-foot">
        <button type="button" class="wp-btn" onclick="__wp.close('${rid}','terms')">Cancel</button>
        <button type="button" class="wp-cta" id="${rid}-accept-go" disabled onclick="${doBuy}">Accept and buy</button>
      </div>
    </div>
  </div>

  <!-- transaction status -->
  <div class="wp-modal" id="${rid}-status" data-state="pending" role="dialog" aria-modal="true" aria-live="polite">
    <div class="wp-bg" onclick="__wp.close('${rid}','status')"></div>
    <div class="wp-dialog wp-dialog--status">
      <div class="wp-orb"><span></span></div>
      <h3 id="${rid}-status-title" style="margin:0 0 8px;font-size:16px;font-weight:600">Working</h3>
      <p class="wp-msg" id="${rid}-status-msg"></p>
      <span class="wp-tx" id="${rid}-status-tx" style="display:none" title="Copy transaction hash"
            onclick="__wp.copy(this)"></span>
      <div class="wp-dialog-foot" style="justify-content:center">
        <button type="button" class="wp-cta" onclick="__wp.close('${rid}','status')">Close</button>
      </div>
    </div>
  </div>
</section>`;
}

export default renderPresale;
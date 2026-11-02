#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [, , inputArg, outputArg] = process.argv;
if (!inputArg || !outputArg) {
  console.error('Usage: node generate-report.mjs <input.json> <output.html>');
  process.exit(1);
}

const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);
const data = JSON.parse(readFileSync(inputPath, 'utf8'));

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const safeUrl = (value = '') => {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' ? esc(url.href) : '#';
  } catch {
    return '#';
  }
};

const required = ['meta', 'summary', 'coverage', 'actionNow', 'secondaryReview', 'noAction'];
for (const key of required) {
  if (data[key] == null) throw new Error(`Missing required property: ${key}`);
}

const groupsTotal = data.actionNow.length + data.secondaryReview.length + data.noAction.length;
if (groupsTotal !== Number(data.summary.reviewed)) {
  throw new Error(`Decision groups contain ${groupsTotal} reviews but summary.reviewed is ${data.summary.reviewed}`);
}

const reviewLink = (review, label = 'Open review') =>
  `<a class="review-link" href="${safeUrl(review.url)}" target="_blank" rel="noopener noreferrer">${esc(label)} <span aria-hidden="true">↗</span></a>`;

const coverageRows = data.coverage.rows.map((row) => {
  const ratio = Number(row.estimated) > 0 ? Math.round((Number(row.collected) / Number(row.estimated)) * 100) : 0;
  return `<tr>
    <td><span class="stars">${'★'.repeat(Number(row.stars))}</span><span class="sr-only">${esc(row.stars)} stars</span></td>
    <td>${esc(row.percentage)}%</td><td>${esc(row.estimated)}</td><td>${esc(row.collected)}</td>
    <td><div class="meter" aria-label="${ratio}% written-to-estimated ratio"><span style="width:${Math.min(100, Math.max(0, ratio))}%"></span></div><strong>${ratio}%</strong></td>
  </tr>`;
}).join('');

const actionCards = data.actionNow.map((review) => `<article class="case-card case-card--action">
  <div class="case-topline"><span class="priority priority--high">Action now</span><span>${esc(review.rating)} star · ${esc(review.date)}${review.verified ? ' · Verified Purchase' : ''}</span></div>
  <h3>${esc(review.title)}</h3>
  <p class="review-copy">“${esc(review.text)}”</p>
  <dl class="case-grid">
    <div><dt>Review ID</dt><dd>${esc(review.id)}</dd></div>
    <div><dt>Removal likelihood</dt><dd>${esc(review.likelihood)}</dd></div>
    <div class="span-2"><dt>Policy categories</dt><dd>${review.categories.map((x) => `<span class="tag">${esc(x)}</span>`).join(' ')}</dd></div>
    <div class="span-2"><dt>Why this merits action</dt><dd>${esc(review.reason)}</dd></div>
    <div class="span-2"><dt>Recommended action</dt><dd>${esc(review.recommendedAction)}</dd></div>
  </dl>
  <div class="suggested"><strong>Suggested case language</strong><p>${esc(review.suggestedMessage)}</p></div>
  ${reviewLink(review)}
</article>`).join('');

const secondaryCards = data.secondaryReview.map((review) => `<article class="case-card case-card--secondary">
  <div class="case-topline"><span class="priority priority--medium">Secondary review</span><span>${esc(review.rating)} stars · ${esc(review.date)}${review.verified ? ' · Verified Purchase' : ''}</span></div>
  <h3>${esc(review.title)}</h3>
  <p class="review-copy">“${esc(review.text)}”</p>
  <p><strong>Assessment:</strong> ${esc(review.reason)}</p>
  <p><strong>Recommendation:</strong> ${esc(review.recommendedAction)}</p>
  ${reviewLink(review)}
</article>`).join('');

const noActionRows = data.noAction.map((review) => `<tr>
  <td data-label="Review"><strong>${esc(review.id)}</strong><span class="rating-pill">${esc(review.rating)} ★</span><small>${esc(review.date)}</small></td>
  <td data-label="Review text"><strong>${esc(review.title)}</strong><p>“${esc(review.text)}”</p></td>
  <td data-label="Assessment"><p>${esc(review.reason)}</p>${reviewLink(review, 'View on Amazon')}</td>
</tr>`).join('');

const list = (items) => items.map((item) => `<li>${esc(item)}</li>`).join('');
const sourceLinks = (data.sources || []).map((source) => `<a href="${safeUrl(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.label)} <span aria-hidden="true">↗</span></a>`).join('');

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="SellerPlex Amazon negative review action report for ${esc(data.meta.requestedAsin)}">
  <title>SellerPlex · Amazon Review Action Report · ${esc(data.meta.requestedAsin)}</title>
  <style>
    :root{--navy:#15264c;--navy-2:#0f1c38;--orange:#ff8b00;--blue:#e4eeff;--muted:#5a6a86;--surface:#f4f7fc;--ink:#17223a;--line:#d9e2f0;--red:#c2410c;--red-bg:#fff3ed;--amber:#a65a00;--amber-bg:#fff8e8;--green:#08795c;--white:#fff;--shadow:0 18px 48px rgba(21,38,76,.12)}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--surface);color:var(--ink);font-family:Montserrat,"Segoe UI",Arial,sans-serif;line-height:1.55}a{color:inherit}a:focus-visible{outline:3px solid var(--orange);outline-offset:3px}.shell{width:min(1180px,calc(100% - 40px));margin:auto}.hero{position:relative;overflow:hidden;background:linear-gradient(135deg,var(--navy-2),var(--navy));color:#fff;padding:34px 0 76px}.hero:after{content:"";position:absolute;right:-120px;top:-170px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(255,139,0,.2),transparent 66%)}.brand{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:62px;position:relative;z-index:1}.wordmark{font-weight:900;font-size:27px;letter-spacing:-1.4px}.wordmark span{color:var(--orange)}.eyebrow{text-transform:uppercase;letter-spacing:.14em;font-size:12px;font-weight:800;color:#c9d6ee}.hero-grid{display:grid;grid-template-columns:1.4fr .75fr;gap:58px;align-items:end;position:relative;z-index:1}.hero h1{font-size:clamp(38px,5vw,68px);line-height:.98;letter-spacing:-.045em;margin:12px 0 22px;max-width:850px}.hero p{font-size:17px;color:#dbe5f7;max-width:760px;margin:0}.hero-meta{border-left:1px solid rgba(255,255,255,.22);padding-left:28px;display:grid;gap:15px}.hero-meta div{display:grid;gap:3px}.hero-meta span{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#aebfda;font-weight:800}.hero-meta strong{font-size:15px}.main{margin-top:-38px;position:relative;z-index:2;padding-bottom:64px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px}.kpi{background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px 22px;box-shadow:var(--shadow)}.kpi b{display:block;font-size:34px;line-height:1;color:var(--navy);margin-bottom:9px}.kpi span{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:800}.kpi--accent{border-top:5px solid var(--orange)}.section{background:#fff;border:1px solid var(--line);border-radius:20px;padding:30px;margin-top:22px;box-shadow:0 10px 28px rgba(21,38,76,.07)}.section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:28px;margin-bottom:22px}.section-kicker{margin:0 0 7px;color:var(--orange);font-size:12px;text-transform:uppercase;letter-spacing:.12em;font-weight:900}.section h2{font-size:29px;line-height:1.1;letter-spacing:-.025em;color:var(--navy);margin:0}.section-intro{max-width:720px;color:var(--muted);margin:7px 0 0}.status{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:var(--amber-bg);color:var(--amber);font-size:11px;font-weight:900;letter-spacing:.05em;white-space:nowrap}.status:before{content:"";width:8px;height:8px;border-radius:50%;background:var(--orange)}table{width:100%;border-collapse:collapse}.coverage-table th,.coverage-table td{padding:14px 12px;border-bottom:1px solid var(--line);text-align:left}.coverage-table th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}.coverage-table tbody tr:last-child td{border-bottom:0}.stars{color:var(--orange);letter-spacing:1px;margin-right:10px}.meter{display:inline-block;width:110px;height:8px;border-radius:99px;background:#e9eef7;overflow:hidden;margin-right:10px;vertical-align:middle}.meter span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--orange),#ffb45a)}.case-card{border:1px solid var(--line);border-radius:17px;padding:24px;margin-top:16px;position:relative;overflow:hidden}.case-card:before{content:"";position:absolute;inset:0 auto 0 0;width:5px}.case-card--action{background:linear-gradient(100deg,var(--red-bg),#fff 42%)}.case-card--action:before{background:var(--red)}.case-card--secondary{background:linear-gradient(100deg,var(--amber-bg),#fff 42%)}.case-card--secondary:before{background:var(--orange)}.case-topline{display:flex;justify-content:space-between;gap:18px;align-items:center;color:var(--muted);font-size:12px;font-weight:700}.priority{display:inline-flex;padding:6px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:.08em;font-size:10px;font-weight:900}.priority--high{background:#fee2d6;color:#a9360f}.priority--medium{background:#ffedbd;color:#7b4700}.case-card h3{font-size:23px;line-height:1.2;color:var(--navy);margin:17px 0 10px}.review-copy{font-family:Georgia,"Times New Roman",serif;font-size:17px;line-height:1.65;color:#37445d}.case-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin:22px 0}.case-grid div{background:rgba(255,255,255,.7);border:1px solid var(--line);border-radius:12px;padding:13px}.case-grid .span-2{grid-column:1/-1}.case-grid dt{text-transform:uppercase;letter-spacing:.08em;font-size:10px;color:var(--muted);font-weight:900;margin-bottom:5px}.case-grid dd{margin:0;font-size:14px}.tag{display:inline-flex;background:var(--blue);color:var(--navy);padding:4px 8px;border-radius:6px;font-size:10px;font-weight:800;margin:2px 4px 2px 0}.suggested{background:var(--navy);color:#fff;border-radius:13px;padding:17px 19px;margin:18px 0}.suggested strong{color:#ffbd69;font-size:11px;text-transform:uppercase;letter-spacing:.08em}.suggested p{margin:7px 0 0;color:#e4ebf8}.review-link{display:inline-flex;align-items:center;gap:6px;color:#0d4bb8;font-weight:800;text-decoration:none;border-bottom:1px solid rgba(13,75,184,.25)}.review-link:hover{color:var(--orange);border-color:var(--orange)}.no-action-wrap{overflow-x:auto}.no-action-table{min-width:900px}.no-action-table th,.no-action-table td{vertical-align:top;padding:18px 16px;border-bottom:1px solid var(--line);text-align:left}.no-action-table th{background:var(--navy);color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.08em}.no-action-table th:first-child{border-radius:10px 0 0 0}.no-action-table th:last-child{border-radius:0 10px 0 0}.no-action-table td:first-child{width:170px}.no-action-table td:nth-child(2){width:49%}.no-action-table tr:last-child td{border-bottom:0}.no-action-table strong{display:block;color:var(--navy);margin-bottom:6px}.no-action-table p{margin:7px 0;color:#3b4963}.no-action-table small{display:block;color:var(--muted);margin-top:6px}.rating-pill{display:inline-block;background:var(--blue);color:var(--navy);font-size:11px;font-weight:900;padding:4px 7px;border-radius:6px}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:22px}.note{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:22px}.note h3{margin:0 0 12px;color:var(--navy)}.note ul{margin:0;padding-left:19px}.note li+li{margin-top:9px}.sources{display:flex;flex-wrap:wrap;gap:10px}.sources a{padding:9px 12px;border-radius:9px;background:var(--blue);color:var(--navy);font-weight:800;text-decoration:none}.footer{background:var(--navy-2);color:#c9d6ee;padding:30px 0;font-size:12px}.footer-inner{display:flex;justify-content:space-between;gap:26px;align-items:center}.footer strong{color:#fff}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    @media(max-width:820px){.hero{padding-bottom:64px}.brand{margin-bottom:40px}.hero-grid,.two-col{grid-template-columns:1fr}.hero-meta{border-left:0;border-top:1px solid rgba(255,255,255,.22);padding:22px 0 0;grid-template-columns:1fr 1fr}.kpis{grid-template-columns:1fr 1fr}.section-heading{display:block}.status{margin-top:14px}.case-grid{grid-template-columns:1fr}.case-grid .span-2{grid-column:auto}.footer-inner{display:block}}
    @media(max-width:560px){.shell{width:min(100% - 24px,1180px)}.hero{padding-top:22px}.brand{align-items:flex-start}.brand .eyebrow{max-width:160px;text-align:right}.hero h1{font-size:38px}.hero-meta{grid-template-columns:1fr}.main{margin-top:-24px}.kpis{grid-template-columns:1fr 1fr;gap:9px}.kpi{padding:16px}.kpi b{font-size:28px}.section{padding:20px;border-radius:15px}.case-topline{align-items:flex-start;flex-direction:column}.no-action-wrap{overflow:visible}.no-action-table{min-width:0}.no-action-table thead{display:none}.no-action-table,.no-action-table tbody,.no-action-table tr,.no-action-table td{display:block;width:100%!important}.no-action-table tr{border:1px solid var(--line);border-radius:13px;margin-bottom:14px;overflow:hidden}.no-action-table td{border-bottom:1px solid var(--line);padding:14px}.no-action-table td:last-child{border-bottom:0}.no-action-table td:before{content:attr(data-label);display:block;text-transform:uppercase;letter-spacing:.08em;font-size:9px;color:var(--muted);font-weight:900;margin-bottom:6px}}
    @media print{body{background:#fff}.hero{padding:22px 0 38px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.main{margin-top:-20px}.section,.kpi{box-shadow:none;break-inside:avoid}.case-card,tr{break-inside:avoid}.review-link{color:var(--navy)}.footer{background:#fff;color:var(--muted);border-top:1px solid var(--line)}}
  </style>
</head>
<body>
  <header class="hero">
    <div class="shell">
      <div class="brand"><div class="wordmark" aria-label="SellerPlex">Seller<span>Plex</span></div><div class="eyebrow">Account Health Intelligence</div></div>
      <div class="hero-grid">
        <div><div class="eyebrow">Amazon compliance · review action report</div><h1>Act on evidence.<br>Protect the listing.</h1><p>An evidence-led review of the negative customer feedback exposed for ${esc(data.meta.requestedAsin)}, separating reportable policy violations from legitimate product criticism.</p></div>
        <div class="hero-meta"><div><span>Requested ASIN</span><strong>${esc(data.meta.requestedAsin)}</strong></div><div><span>Canonical ASIN</span><strong>${esc(data.meta.canonicalAsin)}</strong></div><div><span>Marketplace</span><strong>${esc(data.meta.marketplace)}</strong></div><div><span>Audit window</span><strong>${esc(data.meta.dateWindow)}</strong></div></div>
      </div>
    </div>
  </header>
  <main class="main shell">
    <section class="kpis" aria-label="Executive summary">
      <div class="kpi"><b>${esc(data.summary.reviewed)}</b><span>Reviews audited</span></div>
      <div class="kpi kpi--accent"><b>${esc(data.summary.actNow)}</b><span>Action now</span></div>
      <div class="kpi"><b>${esc(data.summary.secondary)}</b><span>Secondary review</span></div>
      <div class="kpi"><b>${esc(data.summary.noAction)}</b><span>No action</span></div>
    </section>

    <section class="section" aria-labelledby="coverage-heading">
      <div class="section-heading"><div><p class="section-kicker">Coverage control</p><h2 id="coverage-heading">What Amazon exposed vs. what the histogram implies</h2><p class="section-intro">${esc(data.coverage.note)}</p></div><span class="status">${esc(data.coverage.status)}</span></div>
      <div class="no-action-wrap"><table class="coverage-table"><thead><tr><th>Rating</th><th>Displayed share</th><th>Estimated ratings</th><th>Written reviews</th><th>Written / estimated</th></tr></thead><tbody>${coverageRows}</tbody></table></div>
      <p class="section-intro"><strong>${esc(data.coverage.globalRatings)} global ratings.</strong> Histogram estimates are a coverage baseline, not a promise of an equal number of retrievable written reviews.</p>
    </section>

    <section class="section" aria-labelledby="action-heading"><div class="section-heading"><div><p class="section-kicker">Priority queue</p><h2 id="action-heading">Action recommended</h2><p class="section-intro">The strongest evidence-backed candidate in the audited set. No Amazon action has been taken automatically.</p></div></div>${actionCards || '<p>No immediate action candidates.</p>'}</section>

    <section class="section" aria-labelledby="secondary-heading"><div class="section-heading"><div><p class="section-kicker">Human judgment</p><h2 id="secondary-heading">Secondary review</h2><p class="section-intro">Mixed or lower-confidence content that should not be escalated automatically.</p></div></div>${secondaryCards || '<p>No secondary-review cases.</p>'}</section>

    <section class="section" aria-labelledby="no-action-heading"><div class="section-heading"><div><p class="section-kicker">Protected legitimate feedback</p><h2 id="no-action-heading">No action recommended</h2><p class="section-intro">These reviews contain relevant product, quality, performance, composition, or value feedback. The complete review text is retained for auditability.</p></div></div><div class="no-action-wrap"><table class="no-action-table"><thead><tr><th>Review</th><th>Full review text</th><th>Assessment</th></tr></thead><tbody>${noActionRows}</tbody></table></div></section>

    <section class="section" aria-labelledby="controls-heading"><div class="section-heading"><div><p class="section-kicker">Quality controls</p><h2 id="controls-heading">Workflow reconciliation and limitations</h2></div></div><div class="two-col"><div class="note"><h3>Workflow reconciliation</h3><ul>${list(data.workflowReconciliation || [])}</ul></div><div class="note"><h3>Evidence limits</h3><ul>${list(data.limitations || [])}</ul></div></div><div class="sources" style="margin-top:22px">${sourceLinks}</div></section>
  </main>
  <footer class="footer"><div class="shell footer-inner"><div><strong>SellerPlex Account Health</strong><br>Evidence-led Amazon operations.</div><div>Prepared ${esc(data.meta.reviewedAt)} · Recommendations only · Amazon makes the final removal decision.</div></div></footer>
</body>
</html>`;

writeFileSync(outputPath, html, 'utf8');
console.log(outputPath);


export const appTemplate = `
<div class="drawer-overlay" id="drawerOverlay"></div>

<div class="agent-drawer" id="agentDrawer">
  <div class="drawer-header">
    <button class="drawer-close" id="drawerClose" aria-label="Close agent detail">x</button>
    <div class="drawer-agent-name" id="drawerAgentName">Agent</div>
    <div class="drawer-agent-sub" id="drawerAgentSub">Performance detail</div>
    <div class="drawer-kpis" id="drawerKpis"></div>
  </div>
  <div class="drawer-body" id="drawerBody"></div>
</div>

<div class="agent-drawer day-drawer" id="dayDrawer">
  <div class="drawer-header">
    <button class="drawer-close" id="dayDrawerClose" aria-label="Close day detail">x</button>
    <button class="drawer-back" id="dayDrawerBack" style="display:none;">Back to Daily List</button>
    <div class="drawer-agent-name" id="dayDrawerTitle">Date</div>
    <div class="drawer-agent-sub" id="dayDrawerSub">Daily SLA Trend & Root Cause Breakdown</div>
    <div class="drawer-kpis" id="dayDrawerKpis"></div>
  </div>
  <div class="drawer-body" id="dayDrawerBody"></div>
</div>

<div class="analytics-overlay" id="analyticsOverlay">
  <div class="analytics-topbar">
    <div class="logo"><span class="logo-letter">S</span><span class="logo-letter">L</span><span class="logo-letter">A</span></div>
    <h2>Analytics · SLA Insights</h2>
    <span class="a-badge">INTERNAL / RESTRICTED</span>
    <button class="analytics-close" id="analyticsClose">Back to SLA Insights</button>
  </div>

  <div class="date-filter-strip">
    <label for="filterFrom">From</label>
    <input type="date" id="filterFrom" />
    <label for="filterTo">To</label>
    <input type="date" id="filterTo" />
    <button class="df-btn" id="applyFilter">Apply</button>
    <button class="df-btn ghost" id="clearFilter">Clear</button>
    <span class="filter-info" id="filterInfo">All data</span>
  </div>

  <nav class="analytics-tabs" aria-label="Analytics sections">
    <button class="a-tab active" data-atab="insights">Top Insights</button>
    <button class="a-tab" data-atab="days">Days Performance</button>
    <button class="a-tab" data-atab="agents">Agent Performance</button>
    <button class="a-tab" data-atab="queues">Queue Health</button>
    <button class="a-tab" data-atab="patterns">Call Patterns</button>
  </nav>

  <div class="analytics-body">
    <div class="a-tab-panel active" id="atab-insights">
      <div class="insights-grid">
        <div class="insight-panel full">
          <h3>Top Performers</h3>
          <div id="leaderboardWrap">
            <div class="empty-state"><div class="ei">Trophy</div><p>Upload a CSV on the main screen to load data.</p></div>
          </div>
        </div>
        <div class="insight-panel full">
          <h3>Heatmap - Date vs Hour</h3>
          <div class="range-filter heatmap-filter" aria-label="Weekly heatmap filter">
            <div class="range-filter-group">
              <label for="heatmapFromDate">From Date</label>
              <div class="range-input date-segments" data-date-target="heatmapFromDate">
                <span class="range-token">DATE</span>
                <input class="date-part" data-part="day" inputmode="numeric" maxlength="2" placeholder="DD" aria-label="From day" />
                <span class="date-sep">/</span>
                <input class="date-part" data-part="month" inputmode="numeric" maxlength="2" placeholder="MM" aria-label="From month" />
                <span class="date-sep">/</span>
                <input class="date-part year" data-part="year" inputmode="numeric" maxlength="4" placeholder="YYYY" aria-label="From year" />
                <input type="hidden" id="heatmapFromDate" />
              </div>
            </div>
            <div class="range-filter-group">
              <label for="heatmapFromTime">From Time</label>
              <div class="range-input"><span class="range-token">TIME</span><input type="time" id="heatmapFromTime" /></div>
            </div>
            <div class="range-filter-group">
              <label for="heatmapToDate">To Date</label>
              <div class="range-input date-segments" data-date-target="heatmapToDate">
                <span class="range-token">DATE</span>
                <input class="date-part" data-part="day" inputmode="numeric" maxlength="2" placeholder="DD" aria-label="To day" />
                <span class="date-sep">/</span>
                <input class="date-part" data-part="month" inputmode="numeric" maxlength="2" placeholder="MM" aria-label="To month" />
                <span class="date-sep">/</span>
                <input class="date-part year" data-part="year" inputmode="numeric" maxlength="4" placeholder="YYYY" aria-label="To year" />
                <input type="hidden" id="heatmapToDate" />
              </div>
            </div>
            <div class="range-filter-group">
              <label for="heatmapToTime">To Time</label>
              <div class="range-input"><span class="range-token">TIME</span><input type="time" id="heatmapToTime" /></div>
            </div>
            <button class="df-btn" id="applyHeatmapFilter">Apply</button>
            <button class="df-btn ghost" id="clearHeatmapFilter">Clear</button>
            <span class="filter-info" id="heatmapFilterInfo">All heatmap data</span>
          </div>
          <div id="weeklyHeatmap">
            <div class="empty-state"><div class="ei">Heat</div><p>No data yet.</p></div>
          </div>
        </div>
        <div class="insight-panel full">
          <h3>SLA Breach Root-Cause Analysis</h3>
          <div class="range-filter rca-filter" aria-label="SLA breach root-cause filter">
            <div class="range-filter-group">
              <label for="breachFromDate">From Date</label>
              <div class="range-input date-segments" data-date-target="breachFromDate">
                <span class="range-token">DATE</span>
                <input class="date-part" data-part="day" inputmode="numeric" maxlength="2" placeholder="DD" aria-label="From day" />
                <span class="date-sep">/</span>
                <input class="date-part" data-part="month" inputmode="numeric" maxlength="2" placeholder="MM" aria-label="From month" />
                <span class="date-sep">/</span>
                <input class="date-part year" data-part="year" inputmode="numeric" maxlength="4" placeholder="YYYY" aria-label="From year" />
                <input type="hidden" id="breachFromDate" />
              </div>
            </div>
            <div class="range-filter-group">
              <label for="breachFromTime">From Time</label>
              <div class="range-input"><span class="range-token">TIME</span><input type="time" id="breachFromTime" /></div>
            </div>
            <div class="range-filter-group">
              <label for="breachToDate">To Date</label>
              <div class="range-input date-segments" data-date-target="breachToDate">
                <span class="range-token">DATE</span>
                <input class="date-part" data-part="day" inputmode="numeric" maxlength="2" placeholder="DD" aria-label="To day" />
                <span class="date-sep">/</span>
                <input class="date-part" data-part="month" inputmode="numeric" maxlength="2" placeholder="MM" aria-label="To month" />
                <span class="date-sep">/</span>
                <input class="date-part year" data-part="year" inputmode="numeric" maxlength="4" placeholder="YYYY" aria-label="To year" />
                <input type="hidden" id="breachToDate" />
              </div>
            </div>
            <div class="range-filter-group">
              <label for="breachToTime">To Time</label>
              <div class="range-input"><span class="range-token">TIME</span><input type="time" id="breachToTime" /></div>
            </div>
            <button class="df-btn" id="applyBreachFilter">Apply</button>
            <button class="df-btn ghost" id="clearBreachFilter">Clear</button>
            <span class="filter-info" id="breachFilterInfo">All RCA data</span>
          </div>
          <div class="mini-kpis collapsed-empty" id="breachKpis" style="grid-template-columns:repeat(2,1fr);">
            <div class="empty-state"><div class="ei">RCA</div><p>Upload a CSV on the main screen to load data.</p></div>
          </div>
          <div id="breachInsight"></div>
        </div>
        <div class="insight-panel breach-detail-panel is-hidden">
          <h3>Breaches by Queue</h3>
          <div id="breachQueueChart"><div class="empty-state"><p>No data yet.</p></div></div>
        </div>
        <div class="insight-panel breach-detail-panel is-hidden">
          <h3>Breaches by Disconnect Reason</h3>
          <div id="breachDisconnectChart"><div class="empty-state"><p>No data yet.</p></div></div>
        </div>
        <div class="insight-panel breach-detail-panel is-hidden">
          <h3>Breaches by Agent</h3>
          <div id="breachAgentChart"><div class="empty-state"><p>No data yet.</p></div></div>
        </div>
        <div class="insight-panel breach-detail-panel is-hidden">
          <h3>Breaches by Hour of Day</h3>
          <div id="breachHourChart"><div class="empty-state"><p>No data yet.</p></div></div>
        </div>
      </div>
    </div>

    <div class="a-tab-panel" id="atab-days">
      <div class="insights-grid">
        <div class="insight-panel full">
          <h3>Daily Performance Breakdown - click a date to inspect GOS drops</h3>
          <div id="dayTableWrap">
            <div class="empty-state"><div class="ei">Date</div><p>Upload a CSV on the main screen to load data.</p></div>
          </div>
        </div>
        <div class="insight-panel full">
          <h3>Day Comparator</h3>
          <div id="dayComparatorWrap">
            <div class="empty-state"><div class="ei">Compare</div><p>Upload a CSV on the main screen to load data.</p></div>
          </div>
        </div>
      </div>
    </div>

    <div class="a-tab-panel" id="atab-agents">
      <div class="insights-grid">
        <div class="insight-panel full">
          <h3>Agent Overview</h3>
          <div id="agentTableWrap">
            <div class="empty-state"><div class="ei">Agent</div><p>Upload a CSV on the main screen to load data.</p></div>
          </div>
        </div>
        <div class="insight-panel">
          <h3>Avg Handle Time by Agent</h3>
          <div id="agentHandleChart"><div class="empty-state"><p>No data yet.</p></div></div>
        </div>
        <div class="insight-panel">
          <h3>SLA Compliance by Agent</h3>
          <div id="agentSlaChart"><div class="empty-state"><p>No data yet.</p></div></div>
        </div>
      </div>
    </div>

    <div class="a-tab-panel" id="atab-queues">
      <div class="insights-grid">
        <div class="insight-panel">
          <h3>Volume by Queue</h3>
          <div id="queueVolumeChart"><div class="empty-state"><p>No data yet.</p></div></div>
        </div>
        <div class="insight-panel">
          <h3>Abandon Rate by Queue</h3>
          <div id="queueAbandonChart"><div class="empty-state"><p>No data yet.</p></div></div>
        </div>
        <div class="insight-panel">
          <h3>Avg Wait Time by Queue</h3>
          <div id="queueWaitChart"><div class="empty-state"><p>No data yet.</p></div></div>
        </div>
        <div class="insight-panel">
          <h3>Disconnect Reasons</h3>
          <div id="disconnectChart"><div class="empty-state"><p>No data yet.</p></div></div>
        </div>
      </div>
    </div>

    <div class="a-tab-panel" id="atab-patterns">
      <div class="insights-grid">
        <div class="insight-panel full">
          <h3>Calls by Hour of Day</h3>
          <div id="hourlyChart"><div class="empty-state"><p>No data yet.</p></div></div>
        </div>
        <div class="insight-panel full">
          <h3>Handle Time Distribution (Voice, Handled)</h3>
          <div id="handleBuckets"><div class="empty-state"><p>No data yet.</p></div></div>
        </div>
        <div class="insight-panel full">
          <h3>Media Type Mix</h3>
          <div id="mediaChart"><div class="empty-state"><p>No data yet.</p></div></div>
        </div>
      </div>
    </div>
  </div>
</div>

<main class="app">
  <aside class="rail" aria-label="Application information">
    <div class="brand">
      <div class="logo" id="logo"><span class="logo-letter">S</span><span class="logo-letter">L</span><span class="logo-letter">A</span></div>
      <div class="brand-title">
        <h1>SLA Insights</h1>
        <p>internal / v2.0</p>
      </div>
    </div>
    <div class="scope-chip">Internal Use</div>
    <section class="side-metrics">
      <div class="side-head"><h2>Operational Breakdown</h2><span>MTD</span></div>
      <div class="metric-list">
        <div class="side-card accent"><label>Calls Offered</label><strong id="sOffered">-</strong></div>
        <div class="side-card"><label>Callbacks</label><strong id="sCallbacks">-</strong></div>
        <div class="side-card"><label>Handled Calls</label><strong id="sHandled">-</strong></div>
        <div class="side-card"><label>Handled In SLA</label><strong id="sInSla">-</strong></div>
        <div class="side-card"><label>Handled Out SLA</label><strong id="sOutSla">-</strong></div>
        <div class="side-card"><label>Fast Abandons</label><strong id="sFastAb">-</strong></div>
        <div class="side-card accent"><label>Abandon Excl. Fast</label><strong id="sAbExFast">-</strong></div>
        <div class="side-card"><label>Peak Hour</label><strong id="sPeakHour">-</strong></div>
      </div>
    </section>
    <section class="credit">built by <b><span class="credit-word">Tanmay</span> <span class="credit-word">Kalbande</span></b></section>
  </aside>

  <section class="main">
    <header class="header">
      <div>
        <h1>SLA Update Generator</h1>
        <p>Upload Interactions CSV: daily + MTD metrics calculated automatically.</p>
      </div>
      <label class="upload-box" id="uploadBox" for="fileInput">
        <span class="upload-kicker">CSV Upload</span>
        <span class="file-btn">Choose File</span>
        <strong class="upload-title">Drop Interactions.csv here</strong>
        <span class="file-name" id="fileName">no file selected</span>
        <input id="fileInput" type="file" accept=".csv,text/csv" aria-label="Upload Interactions CSV" />
      </label>
    </header>

    <section class="workspace">
      <section class="panel kpi-panel">
        <div class="panel-head"><h2>KPI Summary</h2><span class="badge" id="rowsBadge">Waiting</span></div>
        <div class="kpis">
          <article class="kpi"><div class="kpi-label">Report Date</div><div class="kpi-value" id="kDate">-</div><div class="kpi-sub">Latest date in CSV</div></article>
          <article class="kpi"><div class="kpi-label">Volume Today</div><div class="kpi-value" id="kVol">-</div><div class="kpi-sub">Total records today</div></article>
          <article class="kpi"><div class="kpi-label">Call GOS Today</div><div class="kpi-value" id="kGosToday">-</div><div class="kpi-sub">Handled in SLA / handled</div></article>
          <article class="kpi clickable" id="kpiGosMtd"><div class="kpi-label">Call GOS MTD</div><div class="kpi-value" id="kGosMtd">-</div><div class="kpi-sub">Month to date</div></article>
          <article class="kpi"><div class="kpi-label">Abandon Today</div><div class="kpi-value" id="kAbToday">-</div><div class="kpi-sub">Excluding fast abandons</div></article>
          <article class="kpi"><div class="kpi-label">Abandon MTD</div><div class="kpi-value" id="kAbMtd">-</div><div class="kpi-sub">Abandon excl. fast / offered</div></article>
          <article class="kpi"><div class="kpi-label">AHT Today</div><div class="kpi-value" id="kAhtToday">-</div><div class="kpi-sub">Avg handle time</div></article>
          <article class="kpi"><div class="kpi-label">AHT MTD</div><div class="kpi-value" id="kAhtMtd">-</div><div class="kpi-sub">Month to date</div></article>
          <article class="kpi"><div class="kpi-label">ASA Today</div><div class="kpi-value" id="kAsaToday">-</div><div class="kpi-sub">Avg speed of answer</div></article>
          <article class="kpi"><div class="kpi-label">Handled Today</div><div class="kpi-value" id="kHandledToday">-</div><div class="kpi-sub">Voice calls handled</div></article>
          <article class="kpi"><div class="kpi-label">Agents Today</div><div class="kpi-value" id="kAgentsToday">-</div><div class="kpi-sub">Unique agents logged</div></article>
          <article class="kpi"><div class="kpi-label">Avg Offered/Day</div><div class="kpi-value" id="kAvgOffered">-</div><div class="kpi-sub">MTD daily average</div></article>
        </div>
        <div class="validation" aria-label="Data validation summary">
          <div class="check" id="checkUpload"><span>Upload</span><strong>Waiting</strong></div>
          <div class="check" id="checkColumns"><span>Columns</span><strong>Not checked</strong></div>
          <div class="check" id="checkDates"><span>Dates</span><strong>Not checked</strong></div>
        </div>
      </section>

      <section class="panel message-panel">
        <div class="panel-head"><h2>Generated Output</h2><span class="badge">Output</span></div>
        <textarea id="message" readonly>Upload Interactions.csv to generate the SLA update.</textarea>
        <details class="rules">
          <summary>Calculation rules</summary>
          <div>
            <span>Call GOS = handled voice calls in SLA / handled voice calls.</span>
            <span>Abandon rate = abandoned voice calls over 20 seconds / total offered records.</span>
            <span>Today is based on the latest date found in the uploaded CSV.</span>
          </div>
        </details>
        <div class="actions">
          <button class="btn" id="copyBtn">Copy msg</button>
          <button class="btn info" id="insightsBtn">Insights</button>
          <button class="btn secondary" id="downloadBtn">.txt</button>
          <button class="btn ghost" id="summaryBtn">Summary CSV</button>
          <div class="status" id="status">idle</div>
        </div>
      </section>
    </section>
  </section>
</main>

<div id="chartTooltip"></div>
<div id="toastContainer" aria-live="assertive" aria-atomic="false"></div>
`;

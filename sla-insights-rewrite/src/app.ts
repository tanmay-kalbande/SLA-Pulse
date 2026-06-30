// @ts-nocheck
import './styles.css';
import { appTemplate } from './template';

document.body.innerHTML = appTemplate;

    // ── CONSTANTS ──
    const ANSWER_SLA_MS = 20000;
    const FAST_ABANDON_MS = 20000;
    const PASSWORD_HASH = 'ce89bb1424d8f4872f1b3786c44077396cabd1872e5b784b46e62afe8150af44'; // sha-256 salted
    const _s = 'slapulse_x7KmQ9vR2pL4wN8jT3bZ6qY';
    const COLUMN_ALIASES = {
      date:['Date','Start Date','Conversation Start','Interaction Date','Created Date'],
      mediaType:['Media Type','Media','Channel','Interaction Type'],
      abandoned:['Abandoned','Abandon','Was Abandoned','Is Abandoned'],
      totalQueue:['Total Queue','Queue Time','Queue Time MS','Total Queue Time','Queue Duration','Total Queue (ms)'],
      totalHandle:['Total Handle','Handle Time','Total Handle Time','Handle Duration'],
      totalHold:['Total Hold','Hold Time','Total Hold Time','Hold Duration'],
      wrapup:['Wrap-up','Wrap Up','Wrapup','WrapUp Code','Wrap-up Code'],
      users:['Users','Agent','Agent Name','User','Username'],
      disconnectType:['Disconnect Type','Disconnect','End Reason','Disconnect Reason'],
      queue:['Queue','Queue Name','Skill','Skill Name']
    };
    let parsedRows = [];
    let activeColumns = {};
    let latestSummary = null;
    let analyticsBuilt = false;
    let allMappedRows = [];
    let currentFilterFrom = null;
    let currentFilterTo = null;

    // ── NEW CHART PALETTE ──
    // Purposeful: green=good/GOS, red=bad/abandon, blue/purple/teal=neutral categories
    const CHART = {
      blue:   '#3B82F6',
      indigo: '#6366F1',
      purple: '#8B5CF6',
      teal:   '#0D9488',
      cyan:   '#0891B2',
      green:  '#10B981',
      amber:  '#F59E0B',
      red:    '#EF4444',
      slate:  '#64748B',
    };
    // Multi-agent / multi-queue sequential palette
    const MULTI = [CHART.blue, CHART.indigo, CHART.purple, CHART.teal, CHART.cyan, CHART.amber, CHART.slate];

    // ── HELPERS ──
    function parseCSV(text){
      const rows=[]; let row=[], cur='', inQuotes=false;
      for(let i=0;i<text.length;i++){
        const ch=text[i], next=text[i+1];
        if(ch==='"'){ if(inQuotes&&next==='"'){ cur+='"'; i++; } else inQuotes=!inQuotes; }
        else if(ch===','&&!inQuotes){ row.push(cur); cur=''; }
        else if((ch==='\n'||ch==='\r')&&!inQuotes){
          if(ch==='\r'&&next==='\n') i++;
          row.push(cur); cur='';
          if(row.some(v=>String(v).trim()!='')) rows.push(row);
          row=[];
        } else cur+=ch;
      }
      row.push(cur); if(row.some(v=>String(v).trim()!='')) rows.push(row);
      if(!rows.length) return [];
      const headers=rows[0].map(h=>String(h).trim().replace(/^\uFEFF/,''));
      return rows.slice(1).map(r=>{ const obj={}; headers.forEach((h,i)=>obj[h]=(r[i]??'').trim()); return obj; });
    }
    function parseDate(value){
      if(!value) return null;
      const v=String(value).trim();
      const m=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if(m){
        let[,mo,day,yr,hr,min,ampm]=m; mo=+mo;day=+day;yr=+yr;hr=+hr;min=+min;
        if(yr<100)yr+=2000;
        if(ampm){ if(ampm.toUpperCase()==='PM'&&hr!==12)hr+=12; if(ampm.toUpperCase()==='AM'&&hr===12)hr=0; }
        return new Date(yr,mo-1,day,hr,min);
      }
      const d=new Date(v); return isNaN(d)?null:d;
    }
    function cleanKey(v){ return String(v||'').toLowerCase().replace(/[^a-z0-9]/g,''); }
    function resolveColumns(row){
      const keys=Object.keys(row||{});
      const normalized=keys.map(k=>[k,cleanKey(k)]);
      return Object.fromEntries(Object.entries(COLUMN_ALIASES).map(([name,aliases])=>{
        const choices=aliases.map(cleanKey);
        const match=normalized.find(([,key])=>choices.includes(key));
        return [name,match?match[0]:null];
      }));
    }
    function cell(row,name){ return row[activeColumns[name]]??''; }
    function dateKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
    function dateLabel(d){ return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).replace(/ /g,' '); }
    function shortDate(d){ return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}).replace(/ /g,' '); }
    function dayLabel(d){ return d.toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short'}); }
    function pct(v){ return isFinite(v)?(v*100).toFixed(2).replace(/\.00$/,'')+'%':'n/a'; }
    function num(v){ const n=Number(String(v??'').replace(/,/g,'')); return isNaN(n)?0:n; }
    function fmt(n){ return Number(n||0).toLocaleString(); }
    function fmtSec(ms){ const s=ms/1000; if(s<60)return`${s.toFixed(0)}s`; const m=s/60; return`${m.toFixed(1)}m`; }
    function isVoice(r){ return String(cell(r,'mediaType')).toLowerCase()==='voice'; }
    function isCallback(r){ return String(cell(r,'mediaType')).toLowerCase()==='callback'; }
    function isHandled(r){ return String(cell(r,'abandoned')).toUpperCase()==='NO'; }
    function isAbandoned(r){ return String(cell(r,'abandoned')).toUpperCase()==='YES'; }
    function setStatus(t,c=''){ const s=document.getElementById('status'); s.textContent=t; s.className='status '+c; }
    function setBadge(t){ document.getElementById('rowsBadge').textContent=t; }
    function setCheck(id,t,c=''){ const el=document.getElementById(id); el.className='check '+c; el.querySelector('strong').textContent=t; }
    function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    // ── DATE FILTER ──
    function getFilteredRows(rows){
      if(!currentFilterFrom && !currentFilterTo) return rows;
      return rows.filter(r=>{
        if(!r._dt) return false;
        if(currentFilterFrom && r._dt < currentFilterFrom) return false;
        if(currentFilterTo && r._dt > currentFilterTo) return false;
        return true;
      });
    }
    document.getElementById('applyFilter').addEventListener('click',()=>{
      const fv = document.getElementById('filterFrom').value;
      const tv = document.getElementById('filterTo').value;
      currentFilterFrom = fv ? new Date(fv+'T00:00:00') : null;
      currentFilterTo   = tv ? new Date(tv+'T23:59:59') : null;
      const filtered = getFilteredRows(allMappedRows);
      const fi = document.getElementById('filterInfo');
      if(!currentFilterFrom && !currentFilterTo){ fi.textContent='All data'; }
      else { fi.textContent = filtered.length+' rows in range'; }
      rebuildAnalytics(filtered);
    });
    document.getElementById('clearFilter').addEventListener('click',()=>{
      currentFilterFrom = null; currentFilterTo = null;
      document.getElementById('filterFrom').value='';
      document.getElementById('filterTo').value='';
      document.getElementById('filterInfo').textContent='All data';
      rebuildAnalytics(allMappedRows);
    });


    // ── TOAST HELPER ──
    function showToast(msg){
      const container=document.getElementById('toastContainer');
      // remove any existing toast first
      const old=container.querySelector('.toast');
      if(old) old.remove();
      const t=document.createElement('div');
      t.className='toast';
      t.setAttribute('role','alert');
      t.setAttribute('aria-live','assertive');
      t.innerHTML=`
        <span class="toast-icon">⚠️</span>
        <div class="toast-content">
          <div class="toast-title">No data for today</div>
          <div class="toast-msg">${msg}</div>
        </div>
        <button class="toast-dismiss" title="Dismiss" aria-label="Dismiss">✕</button>`;
      container.appendChild(t);
      // slide in
      requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));
      // dismiss button — manual only
      t.querySelector('.toast-dismiss').addEventListener('click',()=>dismissToast(t));
    }
    function dismissToast(t){
      t.classList.add('hide');
      setTimeout(()=>t.remove(),300);
    }

    // ── ANALYTICS OVERLAY ──
    function openAnalytics(){
      document.getElementById('analyticsOverlay').classList.add('open');
      if(allMappedRows.length && !analyticsBuilt){
        rebuildAnalytics(getFilteredRows(allMappedRows));
        analyticsBuilt=true;
      }
    }
    document.getElementById('analyticsClose').addEventListener('click',()=>{
      document.getElementById('analyticsOverlay').classList.remove('open');
    });

    document.querySelectorAll('.a-tab').forEach(btn=>{
      btn.addEventListener('click',()=>{
        document.querySelectorAll('.a-tab').forEach(b=>b.classList.remove('active'));
        document.querySelectorAll('.a-tab-panel').forEach(p=>p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('atab-'+btn.dataset.atab).classList.add('active');
      });
    });

    // ── AGENT DRAWER ──
    document.getElementById('drawerClose').addEventListener('click', closeDrawer);
    document.getElementById('drawerOverlay').addEventListener('click', ()=>{ closeDrawer(); closeDayDrawer(); });
    function closeDrawer(){
      document.getElementById('agentDrawer').classList.remove('open');
      if (!document.getElementById('dayDrawer').classList.contains('open')) {
        document.getElementById('drawerOverlay').classList.remove('open');
      }
    }

    // ── DAY DRILLDOWN DRAWER ──
    function closeDayDrawer(){
      document.getElementById('dayDrawer').classList.remove('open');
      if (!document.getElementById('agentDrawer').classList.contains('open')) {
        document.getElementById('drawerOverlay').classList.remove('open');
      }
    }
    document.getElementById('dayDrawerClose').addEventListener('click', closeDayDrawer);
    document.getElementById('dayDrawerBack').addEventListener('click', () => {
      openDailyGosPanel();
    });

    // ── CLICKABLE GOS MTD KPI → Daily GOS Panel ──
    document.getElementById('kpiGosMtd').addEventListener('click', openDailyGosPanel);

    function openDailyGosPanel(){
      if(!allMappedRows.length) return;
      const rows = allMappedRows;
      // Group by day
      const dayMap = {};
      rows.forEach(r => {
        const k = dateKey(r._dt);
        if(!dayMap[k]) dayMap[k] = {dt:r._dt, rows:[]};
        dayMap[k].rows.push(r);
      });
      const days = Object.entries(dayMap).sort((a,b) => a[0] < b[0] ? -1 : 1);
      // Ensure _dayMap is set for openDayDrawer drill-down
      window._dayMap = dayMap;

      // Compute MTD totals
      const allVoice = rows.filter(isVoice);
      const allHandled = allVoice.filter(isHandled);
      const allInSla = allHandled.filter(r => num(cell(r,'totalQueue')) <= ANSWER_SLA_MS);
      const mtdGos = allHandled.length ? allInSla.length / allHandled.length : 0;
      const mtdGosClass = mtdGos >= 0.8 ? 'ok' : mtdGos >= 0.6 ? 'warn' : 'err';

      // Calculate Average Speed of Answer (ASA) for handled calls
      const waitMs = allHandled.map(r => num(cell(r,'totalQueue'))).filter(v => v >= 0);
      const avgWait = waitMs.length ? waitMs.reduce((s,v)=>s+v,0)/waitMs.length : 0;

      document.getElementById('dayDrawerTitle').textContent = 'Daily GOS Breakdown';
      document.getElementById('dayDrawerSub').textContent = days.length + ' days · Month to Date performance';
      document.getElementById('dayDrawerBack').style.display = 'none'; // Hide back button on daily list page
      document.getElementById('dayDrawerKpis').innerHTML = [
        {label:'Total Days', value:days.length, sub:'in range'},
        {label:'MTD GOS', value:pct(mtdGos), sub:allInSla.length+'/'+allHandled.length},
        {label:'Avg Speed of Answer', value:avgWait ? fmtSec(avgWait) : '-', sub:'ASA for handled'},
        {label:'Handled', value:allHandled.length, sub:'voice calls'},
        {label:'In SLA', value:allInSla.length, sub:'≤ 20s'},
        {label:'Out SLA', value:allHandled.length - allInSla.length, sub:'> 20s'},
      ].map(k => `<div class="drawer-kpi"><div class="drawer-kpi-label">${k.label}</div><div class="drawer-kpi-value">${k.value}</div><div class="drawer-kpi-sub">${k.sub}</div></div>`).join('');

      // Build daily table + mini running GOS
      let cumH = 0, cumS = 0;
      let body = `<div class="drawer-section"><h4>Daily Performance — click a date for deep insights</h4>
        <table class="day-table"><thead><tr>
          <th>Date</th><th>Offered</th><th>Handled</th><th>Day GOS</th><th>Running GOS</th><th>Δ</th><th>Agents</th>
        </tr></thead><tbody>`;

      days.forEach(([k, {dt, rows: dayRows}]) => {
        const voice = dayRows.filter(isVoice);
        const handled = voice.filter(isHandled);
        const inSla = handled.filter(r => num(cell(r,'totalQueue')) <= ANSWER_SLA_MS);
        const dayGos = handled.length ? inSla.length / handled.length : null;
        const gosClass = dayGos === null ? 'neutral' : dayGos >= 0.8 ? 'ok' : dayGos >= 0.6 ? 'warn' : 'err';

        // Unique agents who handled voice calls on this day
        const dayUniqueAgents = new Set();
        handled.forEach(r => {
          const uStr = String(cell(r, 'users') || '').trim();
          if (uStr) {
            uStr.split(';').forEach(u => {
              const name = u.trim();
              if (name) dayUniqueAgents.add(name);
            });
          }
        });

        const prevRunGos = cumH > 0 ? cumS / cumH : null;
        cumH += handled.length;
        cumS += inSla.length;
        const runGos = cumH > 0 ? cumS / cumH : null;
        const delta = prevRunGos !== null && runGos !== null ? runGos - prevRunGos : null;
        const runClass = runGos === null ? 'neutral' : runGos >= 0.8 ? 'ok' : runGos >= 0.6 ? 'warn' : 'err';

        let deltaHtml = '-';
        if(delta !== null){
          const arrow = delta > 0.001 ? '↑' : delta < -0.001 ? '↓' : '→';
          const dClass = delta > 0.001 ? 'ok' : delta < -0.001 ? 'err' : 'neutral';
          deltaHtml = `<span class="pill ${dClass}">${arrow} ${(delta*100).toFixed(2)}%</span>`;
        }

        body += `<tr class="clickable-row" onclick="openDayDrawer('${k}', true)">
          <td style="font-weight:600;color:var(--ink)">${dayLabel(dt)} 🔍</td>
          <td>${dayRows.length}</td><td>${handled.length}</td>
          <td><span class="pill ${gosClass}">${dayGos !== null ? pct(dayGos) : '-'}</span></td>
          <td><span class="pill ${runClass}">${runGos !== null ? pct(runGos) : '-'}</span></td>
          <td>${deltaHtml}</td>
          <td><strong style="color:var(--chart-indigo)">${dayUniqueAgents.size}</strong></td>
        </tr>`;
      });
      body += '</tbody></table></div>';

      // Add a mini running GOS SVG chart
      if(days.length > 1){
        const svgW = 500, svgH = 110, padL = 38, padR = 14, padT = 18, padB = 24;
        const chartW = svgW - padL - padR, chartH = svgH - padT - padB;
        const n = days.length;
        const xStep = n > 1 ? chartW / (n - 1) : chartW;

        let svgContent = '';
        // Grid lines
        [{v:100,l:'100%'},{v:80,l:'80%'},{v:0,l:'0%'}].forEach(g => {
          const y = padT + chartH - (g.v / 100) * chartH;
          const dc = g.v === 80 ? CHART.green : 'var(--line)';
          svgContent += `<line x1="${padL}" y1="${y}" x2="${svgW-padR}" y2="${y}" stroke="${dc}" stroke-width="${g.v===80?'1.5':'0.7'}" stroke-dasharray="${g.v===80?'4,3':'2,4'}" opacity="${g.v===80?'0.6':'0.3'}"/>`;
          svgContent += `<text x="${padL-6}" y="${y+3}" text-anchor="end" fill="var(--muted)" font-size="8" font-family="var(--mono)">${g.l}</text>`;
        });

        const labelStep = Math.max(1, Math.ceil(n / 6)); // Target ~6 labels on X axis
        let polyline = '', cH2 = 0, cS2 = 0;
        days.forEach(([k, {dt, rows: dayRows}], i) => {
          const voice = dayRows.filter(isVoice);
          const handled = voice.filter(isHandled);
          const inSla = handled.filter(r => num(cell(r,'totalQueue')) <= ANSWER_SLA_MS);
          cH2 += handled.length; cS2 += inSla.length;
          const rg = cH2 > 0 ? cS2 / cH2 : 0;
          const x = padL + (n > 1 ? i * xStep : chartW / 2);
          const y = padT + chartH - (rg * 100 / 100) * chartH;
          polyline += `${x},${y} `;
          
          const dotClr = rg >= 0.8 ? CHART.green : rg >= 0.6 ? CHART.amber : CHART.red;
          const dayGosActual = handled.length ? (inSla.length / handled.length) : null;
          const dayGosText = dayGosActual !== null ? pct(dayGosActual) : 'N/A';
          const dayGosClr = dayGosActual === null ? 'var(--muted)' : dayGosActual >= 0.8 ? CHART.green : dayGosActual >= 0.6 ? CHART.amber : CHART.red;
          
          svgContent += `<circle cx="${x}" cy="${y}" r="3.5" fill="${dotClr}" stroke="#fff" stroke-width="1.5" class="mtd-gos-dot" data-daykey="${k}" data-date="${dayLabel(dt)}" data-gos="${dayGosText}" data-rungos="${pct(rg)}" data-color="${dayGosClr}" style="cursor:pointer;"/>`;
          
          // Smart label step to prevent overlaps (removes GOS % text above the dots)
          const showLabel = (i % labelStep === 0 && (n - 1 - i) >= Math.ceil(labelStep / 2)) || (i === n - 1);
          if (showLabel) {
            let align = "middle";
            let xOffset = 0;
            if (i === 0) { align = "start"; xOffset = 2; }
            else if (i === n - 1) { align = "end"; xOffset = -2; }
            
            svgContent += `<text x="${x + xOffset}" y="${svgH - 4}" text-anchor="${align}" fill="var(--muted)" font-size="7.5" font-family="var(--mono)">${shortDate(dt)}</text>`;
          }
        });
        svgContent = `<polyline points="${polyline.trim()}" fill="none" stroke="${CHART.blue}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.6"/>` + svgContent;

        body += `<div class="drawer-section"><h4>MTD Running GOS Trend</h4>
        <div class="cum-gos-wrap"><svg class="cum-gos-svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid meet">${svgContent}</svg></div></div>`;
      }

      document.getElementById('dayDrawerBody').innerHTML = body;
      document.getElementById('dayDrawerBody').scrollTop = 0;
      
      // Click & Hover tooltips on daily line dot
      document.querySelectorAll('.mtd-gos-dot').forEach(dot => {
        dot.addEventListener('click', () => {
          document.getElementById('chartTooltip').style.display = 'none';
          openDayDrawer(dot.dataset.daykey, true);
        });
        
        dot.addEventListener('mouseenter', () => {
          const tt = document.getElementById('chartTooltip');
          tt.innerHTML = `<div style="font-weight:700;color:#fff;margin-bottom:3px;">${dot.dataset.date}</div>
                           <div style="font-size:10.5px;margin-bottom:2px;">Day GOS: <strong style="color:${dot.dataset.color}">${dot.dataset.gos}</strong></div>
                           <div style="font-size:10.5px;opacity:0.85;">MTD GOS: <strong style="color:var(--chart-blue)">${dot.dataset.rungos}</strong></div>`;
          tt.style.display = 'block';
        });
        dot.addEventListener('mousemove', (e) => {
          const tt = document.getElementById('chartTooltip');
          const ttWidth = tt.offsetWidth || 180;
          let left = e.pageX + 12;
          if (e.clientX + ttWidth + 12 > window.innerWidth) {
            left = e.pageX - ttWidth - 12;
          }
          tt.style.left = left + 'px';
          tt.style.top = (e.pageY - 12) + 'px';
        });
        dot.addEventListener('mouseleave', () => {
          document.getElementById('chartTooltip').style.display = 'none';
        });
      });

      document.getElementById('dayDrawer').classList.add('open');
      document.getElementById('drawerOverlay').classList.add('open');
    }

    function getShortName(fullName) {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length === 1) return parts[0];
      const first = parts[0];
      const last = parts[parts.length - 1];
      return `${first} ${last.charAt(0)}.`;
    }

    function openDayDrawer(dateKey, fromGOSList = false){
      const d = window._dayMap && window._dayMap[dateKey];
      if(!d) return;
      
      const backBtn = document.getElementById('dayDrawerBack');
      if (fromGOSList) {
        backBtn.style.display = 'inline-flex';
      } else {
        backBtn.style.display = 'none';
      }
      const rows = d.rows;
      const voice = rows.filter(isVoice);
      const handled = voice.filter(isHandled);
      const handledInSla = handled.filter(r=>num(cell(r,'totalQueue'))<=ANSWER_SLA_MS);
      const handledOutSla = handled.filter(r=>num(cell(r,'totalQueue'))>ANSWER_SLA_MS);
      const abandonExFast = voice.filter(r=>isAbandoned(r)&&num(cell(r,'totalQueue'))>FAST_ABANDON_MS);
      const fastAb = voice.filter(r=>isAbandoned(r)&&num(cell(r,'totalQueue'))<=FAST_ABANDON_MS);
      const dayGos = handled.length ? handledInSla.length / handled.length : 0;
      const totalMisses = handledOutSla.length + abandonExFast.length;

      // Calculate Average Speed of Answer (ASA) for daily handled calls
      const dayWaitMs = handled.map(r => num(cell(r,'totalQueue'))).filter(v => v >= 0);
      const dayAvgWait = dayWaitMs.length ? dayWaitMs.reduce((s,v)=>s+v,0)/dayWaitMs.length : 0;

      // Unique agents who handled voice calls for the day
      const dayUniqueAgents = new Set();
      handled.forEach(r => {
        const uStr = String(cell(r, 'users') || '').trim();
        if (uStr) {
          uStr.split(';').forEach(u => {
            const name = u.trim();
            if (name) dayUniqueAgents.add(name);
          });
        }
      });

      document.getElementById('dayDrawerTitle').textContent = dayLabel(d.dt);
      document.getElementById('dayDrawerSub').textContent = rows.length + ' total interactions · intraday deep dive';

      const gosClass = dayGos >= 0.8 ? 'ok' : dayGos >= 0.6 ? 'warn' : 'err';
      document.getElementById('dayDrawerKpis').innerHTML = [
        {label:'Avg Speed of Answer', value:dayAvgWait ? fmtSec(dayAvgWait) : '-', sub:'ASA for handled'},
        {label:'Handled', value:handled.length, sub:'calls'},
        {label:'Day GOS', value:pct(dayGos), sub:'in SLA'},
        {label:'In SLA', value:handledInSla.length, sub:'<= 20s'},
        {label:'SLA Misses', value:totalMisses, sub:'out SLA'},
        {label:'Abandons', value:abandonExFast.length, sub:'excl. fast'},
        {label:'Active Agents', value:dayUniqueAgents.size, sub:'took calls'},
      ].map(k=>`<div class="drawer-kpi"><div class="drawer-kpi-label">${k.label}</div><div class="drawer-kpi-value">${k.value}</div><div class="drawer-kpi-sub">${k.sub}</div></div>`).join('');

      let body = '';

      // 1. Graphical Root Cause Analysis
      const ansLatePct = totalMisses > 0 ? ((handledOutSla.length / totalMisses) * 100).toFixed(1) : 0;
      const abLatePct = totalMisses > 0 ? ((abandonExFast.length / totalMisses) * 100).toFixed(1) : 0;

      let takeaway = '';
      if(totalMisses === 0) {
        takeaway = '<span style="color:var(--ok)">🎯 Stellar performance! 100% GOS achieved with zero SLA threshold violations.</span>';
      } else if(abandonExFast.length > handledOutSla.length) {
        takeaway = `<span style="color:var(--err)">⚠️ High Abandonment Impact: ${abLatePct}% of SLA drops were caused by customers hanging up (>20s) before reaching an agent.</span>`;
      } else {
        takeaway = `<span style="color:var(--warn)">⚠️ Agent Queue Delay: ${ansLatePct}% of SLA drops were answered, but exceeded the 20-second threshold.</span>`;
      }

      body += `<div class="rc-card">
        <div class="rc-title"><span>GOS Drop Root Cause Breakdown</span><span class="pill ${gosClass}">${pct(dayGos)} GOS</span></div>
        <div class="rc-meter-track">
          <div class="rc-meter-fill" style="width:${ansLatePct}%;background:${CHART.amber}" title="Answered Out SLA: ${handledOutSla.length}"></div>
          <div class="rc-meter-fill" style="width:${abLatePct}%;background:${CHART.red}" title="Abandoned Out SLA: ${abandonExFast.length}"></div>
        </div>
        <div class="rc-legend">
          <div class="rc-legend-item"><div class="rc-dot" style="background:${CHART.amber}"></div><span>Answered >20s</span><span class="rc-val">${handledOutSla.length} (${ansLatePct}%)</span></div>
          <div class="rc-legend-item"><div class="rc-dot" style="background:${CHART.red}"></div><span>Abandoned >20s</span><span class="rc-val">${abandonExFast.length} (${abLatePct}%)</span></div>
        </div>
        <div style="margin-top:10px;font-size:11px;font-family:var(--mono);line-height:1.4;background:var(--surface);padding:8px 10px;border-radius:4px;border:1px solid var(--line);">${takeaway}</div>
      </div>`;

      // 1b. Active Agents List for the Day
      const dayAgentCalls = {};
      handled.forEach(r => {
        const uStr = String(cell(r, 'users') || '').trim();
        if (uStr) {
          uStr.split(';').forEach(u => {
            const name = u.trim();
            if (name) {
              dayAgentCalls[name] = (dayAgentCalls[name] || 0) + 1;
            }
          });
        }
      });
      const sortedAgents = Object.entries(dayAgentCalls).sort((a,b) => b[1] - a[1]);
      
      body += `<div class="drawer-section" style="margin-top:14px;">
        <h4>Active Agents Today (${sortedAgents.length})</h4>
        <div style="display:flex;flex-wrap:wrap;gap:6px;background:var(--surface-2);border:1px solid var(--line);border-radius:6px;padding:10px;">`;
      if (sortedAgents.length === 0) {
        body += `<span style="font-size:11px;color:var(--muted);font-family:var(--mono);">No active agents took calls today.</span>`;
      } else {
        sortedAgents.forEach(([name, count]) => {
          body += `<span class="pill neutral" style="font-size:11px;font-family:var(--mono);padding:4px 8px;border:1px solid var(--line);border-radius:4px;display:inline-flex;align-items:center;gap:6px;user-select:none;">
            👤 <strong>${escHtml(name)}</strong>
          </span>`;
        });
      }
      body += `</div></div>`;

      // 2. Hourly stats
      const hourStats = Array.from({length:24}, (_,h)=>({hour:h, offered:0, handled:0, inSla:0, outSla:0, abExFast:0, fastAb:0, agents: new Set()}));
      voice.forEach(r => {
        if(!r._dt) return;
        const h = r._dt.getHours();
        const hs = hourStats[h];
        hs.offered++;
        if(isHandled(r)){
          hs.handled++;
          if(num(cell(r,'totalQueue')) <= ANSWER_SLA_MS) hs.inSla++;
          else hs.outSla++;

          // Track agents who handled a call in this hour
          const uStr = String(cell(r, 'users') || '').trim();
          if (uStr) {
            uStr.split(';').forEach(u => {
              const name = u.trim();
              if (name) hs.agents.add(name);
            });
          }
        } else if(isAbandoned(r)){
          if(num(cell(r,'totalQueue')) > FAST_ABANDON_MS) hs.abExFast++;
          else hs.fastAb++;
        }
      });

      const activeHours = hourStats.filter(hs => hs.offered > 0);

      // Build cumulative running stats
      let cumHandled = 0, cumInSla = 0;
      const cumPoints = [];
      activeHours.forEach(hs => {
        const prevGos = cumHandled > 0 ? cumInSla / cumHandled : null;
        cumHandled += hs.handled;
        cumInSla += hs.inSla;
        const runGos = cumHandled > 0 ? cumInSla / cumHandled : null;
        cumPoints.push({...hs, cumHandled, cumInSla, runGos, prevGos, delta: prevGos !== null && runGos !== null ? runGos - prevGos : null});
      });

      if(activeHours.length){

        // ── 2a. Cumulative Running GOS Progression (SVG line chart) ──
        const svgW = 500, svgH = 140, padL = 38, padR = 14, padT = 22, padB = 24;
        const chartW = svgW - padL - padR, chartH = svgH - padT - padB;
        const n = cumPoints.length;
        const xStep = n > 1 ? chartW / (n - 1) : chartW;

        let svgContent = '';
        // Grid lines at 80% and 60%
        const gridLines = [{v:100,l:'100%'},{v:80,l:'80%'},{v:60,l:'60%'},{v:0,l:'0%'}];
        gridLines.forEach(g => {
          const y = padT + chartH - (g.v / 100) * chartH;
          const dashColor = g.v === 80 ? CHART.green : g.v === 60 ? CHART.amber : 'var(--line)';
          svgContent += `<line x1="${padL}" y1="${y}" x2="${svgW-padR}" y2="${y}" stroke="${dashColor}" stroke-width="${g.v===80||g.v===60?'1.5':'0.7'}" stroke-dasharray="${g.v===80||g.v===60?'4,3':'2,4'}" opacity="${g.v===80||g.v===60?'0.6':'0.3'}"/>`;
          svgContent += `<text x="${padL-6}" y="${y+3}" text-anchor="end" fill="var(--muted)" font-size="8" font-family="var(--mono)">${g.l}</text>`;
        });

        const labelStep = Math.max(1, Math.ceil(n / 8)); // Target ~8 labels on X axis
        // Build polyline points and dots
        let polyline = '';
        cumPoints.forEach((cp, i) => {
          const x = padL + (n > 1 ? i * xStep : chartW / 2);
          const gosPct = cp.runGos !== null ? cp.runGos * 100 : 0;
          const y = padT + chartH - (gosPct / 100) * chartH;
          polyline += `${x},${y} `;
          
          const lbl = String(cp.hour).padStart(2,'0');
          const dotColor = cp.runGos >= 0.8 ? CHART.green : cp.runGos >= 0.6 ? CHART.amber : CHART.red;
          const hGosVal = cp.handled ? cp.inSla / cp.handled : null;
          const hGosText = hGosVal !== null ? pct(hGosVal) : 'N/A';
          const hGosClr = hGosVal === null ? 'var(--muted)' : hGosVal >= 0.8 ? CHART.green : hGosVal >= 0.6 ? CHART.amber : CHART.red;
          
          // Dot
          svgContent += `<circle cx="${x}" cy="${y}" r="4" fill="${dotColor}" stroke="#fff" stroke-width="1.5" class="cum-gos-dot" data-hidx="${i}" data-hour="${lbl}:00" data-gos="${hGosText}" data-rungos="${pct(cp.runGos)}" data-color="${hGosClr}" data-agents="${cp.agents.size}" style="cursor:pointer;"/>`;
          
          // Smart label step to prevent overlaps (removes GOS % text above the dots)
          const showLabel = (i % labelStep === 0 && (n - 1 - i) >= Math.ceil(labelStep / 2)) || (i === n - 1);
          if (showLabel) {
            let align = "middle";
            let xOffset = 0;
            if (i === 0) { align = "start"; xOffset = 2; }
            else if (i === n - 1) { align = "end"; xOffset = -2; }
            
            // Hour label on x-axis
            svgContent += `<text x="${x + xOffset}" y="${svgH - 4}" text-anchor="${align}" fill="var(--muted)" font-size="8" font-family="var(--mono)">${lbl}</text>`;
          }
          // Delta arrows for drops
          if(cp.delta !== null && cp.delta < -0.01){
            svgContent += `<text x="${x}" y="${y + 14}" text-anchor="middle" fill="${CHART.red}" font-size="7" font-weight="600" font-family="var(--mono)">▼${Math.abs(cp.delta*100).toFixed(1)}%</text>`;
          }
        });
        // Polyline path
        svgContent = `<polyline points="${polyline.trim()}" fill="none" stroke="${CHART.blue}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.6"/>` + svgContent;

        body += `<div class="drawer-section"><h4>Running GOS Progression — How GOS built up through the day</h4>
        <div class="cum-gos-wrap"><svg class="cum-gos-svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid meet">${svgContent}</svg></div>
        <div style="display:flex;gap:14px;font-size:10px;font-family:var(--mono);color:var(--muted);margin-bottom:4px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:4px"><div class="rc-dot" style="background:${CHART.blue}"></div>Cumulative GOS line</div>
          <div style="display:flex;align-items:center;gap:4px"><div class="rc-dot" style="background:${CHART.green}"></div>≥ 80% target</div>
          <div style="display:flex;align-items:center;gap:4px"><div class="rc-dot" style="background:${CHART.amber}"></div>60% warning</div>
          <div style="display:flex;align-items:center;gap:4px;color:${CHART.red}">▼ = GOS drop</div>
        </div></div>`;

        // ── 2b. Intraday Hourly GOS Timeline (clickable bars) ──
        body += `<div class="drawer-section"><h4>Intraday Hourly GOS — click a bar for details</h4>
        <div class="hourly-gos-chart" id="gosChart">`;
        activeHours.forEach((hs,i) => {
          const hGos = hs.handled ? hs.inSla / hs.handled : 0;
          const heightPct = hs.handled ? Math.max((hGos * 100).toFixed(0), 6) : 0;
          const color = hs.handled === 0 ? 'var(--line-strong)' : hGos >= 0.8 ? CHART.green : hGos >= 0.6 ? CHART.amber : CHART.red;
          const lbl = String(hs.hour).padStart(2,'0');
          body += `<div class="h-gos-col" data-hidx="${i}" title="${lbl}:00 — ${hs.agents.size} agent${hs.agents.size !== 1 ? 's' : ''} active — Click for details">
            <span class="h-gos-val">${hs.handled?Math.round(hGos*100)+'%':'-'}</span>
            <div class="h-gos-bar" style="height:${heightPct}%;background:${color}"></div>
            <span class="h-gos-lbl">${lbl}</span>
          </div>`;
        });
        body += `</div>
        <div style="display:flex;gap:12px;font-size:10px;font-family:var(--mono);color:var(--muted);margin-bottom:4px">
          <div style="display:flex;align-items:center;gap:4px"><div class="rc-dot" style="background:${CHART.green}"></div>GOS ≥ 80%</div>
          <div style="display:flex;align-items:center;gap:4px"><div class="rc-dot" style="background:${CHART.amber}"></div>GOS 60–79%</div>
          <div style="display:flex;align-items:center;gap:4px"><div class="rc-dot" style="background:${CHART.red}"></div>GOS < 60%</div>
          <div style="margin-left:auto;font-style:italic">Click any bar ↑</div>
        </div>
        <div class="hour-detail" id="hourDetailPanel"></div>
        </div>`;

        // 3. Hourly SLA Misses Breakdown (Stacked Chart - clickable)
        const maxMiss = Math.max(...activeHours.map(hs => hs.outSla + hs.abExFast), 1);
        body += `<div class="drawer-section"><h4>Hourly SLA Misses (Answered vs Abandoned Late)</h4>
        <div class="hourly-miss-chart" id="missChart">`;
        activeHours.forEach((hs,i) => {
          const totalM = hs.outSla + hs.abExFast;
          const hPct = maxMiss > 0 ? Math.max((totalM / maxMiss) * 80, 0) : 0;
          const ansH = totalM > 0 ? ((hs.outSla / totalM) * 100).toFixed(0) : 0;
          const abH = totalM > 0 ? ((hs.abExFast / totalM) * 100).toFixed(0) : 0;
          const lbl = String(hs.hour).padStart(2,'0');
          body += `<div class="h-miss-col" data-hidx="${i}" title="${lbl}:00 — ${hs.agents.size} agent${hs.agents.size !== 1 ? 's' : ''} active — Click for details">
            <span class="h-miss-val">${totalM > 0 ? totalM : ''}</span>
            <div class="h-miss-stack" style="height:${hPct}%;">
              ${hs.outSla > 0 ? `<div class="h-miss-seg" style="height:${ansH}%;background:${CHART.amber}"></div>` : ''}
              ${hs.abExFast > 0 ? `<div class="h-miss-seg" style="height:${abH}%;background:${CHART.red}"></div>` : ''}
            </div>
            <span class="h-gos-lbl">${lbl}</span>
          </div>`;
        });
        body += `</div>
        <div style="display:flex;gap:12px;font-size:10px;font-family:var(--mono);color:var(--muted);margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:4px"><div class="rc-dot" style="background:${CHART.amber}"></div>Answered > 20s</div>
          <div style="display:flex;align-items:center;gap:4px"><div class="rc-dot" style="background:${CHART.red}"></div>Abandoned > 20s</div>
        </div></div>`;
      }

      // Inject HTML then wire up click handlers
      document.getElementById('dayDrawerBody').innerHTML = body;

      // ── Wire up clickable hour bars ──
      if(activeHours.length){
        const detailPanel = document.getElementById('hourDetailPanel');
        function showHourDetail(idx){
          const cp = cumPoints[idx];
          if(!cp) return;
          const lbl = String(cp.hour).padStart(2,'0');
          const hGos = cp.handled ? cp.inSla / cp.handled : null;
          const runGosPct = cp.runGos !== null ? (cp.runGos * 100).toFixed(2) : '-';
          const hGosPct = hGos !== null ? (hGos * 100).toFixed(2) : '-';
          const gosClass2 = cp.runGos >= 0.8 ? 'ok' : cp.runGos >= 0.6 ? 'warn' : 'err';

          // Build narrative
          let narrative = `<strong>${lbl}:00</strong> — `;
          if(cp.offered === 0){
            narrative += 'No voice calls this hour.';
          } else {
            narrative += `${cp.offered} voice call${cp.offered>1?'s':''} offered. `;
            if(cp.handled > 0) narrative += `${cp.handled} handled (${cp.inSla} in SLA, ${cp.outSla} out of SLA). `;
            if(cp.abExFast > 0) narrative += `<span class="down">${cp.abExFast} abandoned after >20s</span>. `;
            if(cp.fastAb > 0) narrative += `${cp.fastAb} fast abandon${cp.fastAb>1?'s':''} (<20s). `;

            if(cp.delta !== null){
              if(cp.delta < -0.005){
                narrative += `<br>↳ Running GOS <span class="down">dropped by ${Math.abs(cp.delta*100).toFixed(2)}%</span> to <strong>${runGosPct}%</strong>.`;
                if(cp.outSla > 0 && cp.abExFast > 0) narrative += ` Cause: ${cp.outSla} answered late + ${cp.abExFast} abandoned late.`;
                else if(cp.outSla > 0) narrative += ` Cause: ${cp.outSla} call${cp.outSla>1?'s':''} answered beyond 20s threshold.`;
                else if(cp.abExFast > 0) narrative += ` Cause: ${cp.abExFast} customer${cp.abExFast>1?'s':''} abandoned after waiting >20s.`;
              } else if(cp.delta > 0.005){
                narrative += `<br>↳ Running GOS <span class="up">recovered by +${(cp.delta*100).toFixed(2)}%</span> to <strong>${runGosPct}%</strong>. All ${cp.inSla} handled calls met SLA.`;
              } else {
                narrative += `<br>↳ Running GOS <span class="flat">held steady</span> at <strong>${runGosPct}%</strong>.`;
              }
            } else {
              narrative += `<br>↳ Running GOS started at <strong>${runGosPct}%</strong>.`;
            }
          }

          detailPanel.innerHTML = `
            <div class="hour-detail-title"><span>🕐 ${lbl}:00 — Hour Detail</span><span class="pill ${gosClass2}">Running GOS: ${runGosPct}%</span></div>
            <div class="hour-detail-grid">
              <div class="hd-stat"><div class="hd-stat-label">Offered</div><div class="hd-stat-value">${cp.offered}</div><div class="hd-stat-sub">this hour</div></div>
              <div class="hd-stat"><div class="hd-stat-label">In SLA</div><div class="hd-stat-value" style="color:${CHART.green}">${cp.inSla}</div><div class="hd-stat-sub">≤ 20s</div></div>
              <div class="hd-stat"><div class="hd-stat-label">Out SLA</div><div class="hd-stat-value" style="color:${CHART.amber}">${cp.outSla}</div><div class="hd-stat-sub">> 20s answered</div></div>
              <div class="hd-stat"><div class="hd-stat-label">Abandoned</div><div class="hd-stat-value" style="color:${CHART.red}">${cp.abExFast}</div><div class="hd-stat-sub">> 20s dropped</div></div>
              <div class="hd-stat"><div class="hd-stat-label">Hour GOS</div><div class="hd-stat-value">${hGosPct}%</div><div class="hd-stat-sub">this hour only</div></div>
              <div class="hd-stat"><div class="hd-stat-label">Cumul. GOS</div><div class="hd-stat-value">${runGosPct}%</div><div class="hd-stat-sub">${cp.cumInSla}/${cp.cumHandled} total</div></div>
              <div class="hd-stat" style="grid-column: span 3; text-align: left;"><div class="hd-stat-label">Active Agents (${cp.agents.size})</div><div class="hd-stat-sub" style="font-size: 11px; margin-top: 4px; color: var(--ink); font-family: var(--sans);">${Array.from(cp.agents).sort().join(', ') || 'None'}</div></div>
            </div>
            <div class="hd-narrative">${narrative}</div>`;
          detailPanel.classList.add('open');

          // Highlight active bar
          document.querySelectorAll('#gosChart .h-gos-col').forEach(c=>c.classList.remove('active'));
          const activeCol = document.querySelector('#gosChart .h-gos-col[data-hidx="'+idx+'"]');
          if(activeCol) activeCol.classList.add('active');
        }

        // Click on GOS bar
        document.querySelectorAll('#gosChart .h-gos-col').forEach(col=>{
          col.addEventListener('click', ()=> showHourDetail(+col.dataset.hidx));
        });
        // Click on miss bar
        document.querySelectorAll('#missChart .h-miss-col').forEach(col=>{
          col.addEventListener('click', ()=> showHourDetail(+col.dataset.hidx));
        });
        // Click & Hover tooltips on hourly line dot
        document.querySelectorAll('.cum-gos-dot').forEach(dot=>{
          dot.addEventListener('click', ()=> {
            document.getElementById('chartTooltip').style.display = 'none';
            showHourDetail(+dot.dataset.hidx);
          });
          
          dot.addEventListener('mouseenter', () => {
            const tt = document.getElementById('chartTooltip');
            tt.innerHTML = `<div style="font-weight:700;color:#fff;margin-bottom:3px;">${dot.dataset.hour}</div>
                             <div style="font-size:10.5px;margin-bottom:2px;">Hour GOS: <strong style="color:${dot.dataset.color}">${dot.dataset.gos}</strong></div>
                             <div style="font-size:10.5px;opacity:0.85;margin-bottom:2px;">Running GOS: <strong style="color:var(--chart-blue)">${dot.dataset.rungos}</strong></div>
                             <div style="font-size:10.5px;opacity:0.85;">Active Agents: <strong style="color:var(--chart-indigo)">${dot.dataset.agents}</strong></div>`;
            tt.style.display = 'block';
          });
          dot.addEventListener('mousemove', (e) => {
            const tt = document.getElementById('chartTooltip');
            const ttWidth = tt.offsetWidth || 180;
            let left = e.pageX + 12;
            if (e.clientX + ttWidth + 12 > window.innerWidth) {
              left = e.pageX - ttWidth - 12;
            }
            tt.style.left = left + 'px';
            tt.style.top = (e.pageY - 12) + 'px';
          });
          dot.addEventListener('mouseleave', () => {
            document.getElementById('chartTooltip').style.display = 'none';
          });
        });
      }

      document.getElementById('dayDrawerBody').scrollTop = 0;
      document.getElementById('dayDrawer').classList.add('open');
      document.getElementById('drawerOverlay').classList.add('open');
    }
    function openAgentDrawer(name){
      return false;
      if (!window._agentMap) return;
      
      const targetName = String(name || '').trim().toLowerCase();
      const matchedKey = Object.keys(window._agentMap).find(k => k.trim().toLowerCase() === targetName);
      
      let a = matchedKey ? window._agentMap[matchedKey] : null;
      
      if(!a) {
        // Fallback: build a temporary agent profile from all rows
        const agentRows = allMappedRows.filter(r => {
          const uStr = String(cell(r, 'users') || '').trim();
          return uStr.split(';').map(u => u.trim().toLowerCase()).includes(targetName);
        });
        if (agentRows.length === 0) return;
        
        const handledRows = agentRows.filter(isHandled);
        const handledInSla = handledRows.filter(r => isVoice(r) && num(cell(r,'totalQueue')) <= ANSWER_SLA_MS);
        const handleMs = handledRows.map(r => num(cell(r,'totalHandle'))).filter(v => v > 0);
        const holdMs = handledRows.map(r => num(cell(r,'totalHold'))).filter(v => v > 0);
        
        let timeout = 0, wrapOk = 0, wrapMissing = 0;
        agentRows.forEach(r => {
          const wu = String(cell(r, 'wrapup') || '').trim();
          if(wu === 'ININ-WRAP-UP-TIMEOUT') timeout++;
          else if(wu) wrapOk++;
          else wrapMissing++;
        });

        a = {
          total: agentRows.length,
          handled: handledRows.length,
          handledInSla: handledInSla.length,
          handleMs,
          holdMs,
          timeout,
          wrapOk,
          wrapMissing,
          rows: agentRows
        };
      }

      const avgH = a.handleMs.length ? a.handleMs.reduce((s,v)=>s+v,0)/a.handleMs.length : 0;
      const avgHo = a.holdMs.length ? a.holdMs.reduce((s,v)=>s+v,0)/a.holdMs.length : 0;
      const eff = a.total ? a.handled/a.total : 0;
      const slaRate = a.handled ? a.handledInSla/a.handled : 0;

      document.getElementById('drawerAgentName').textContent = name;
      document.getElementById('drawerAgentSub').textContent = a.total+' interactions · filtered range';

      document.getElementById('drawerKpis').innerHTML = [
        {label:'Calls',value:a.total,sub:'total'},
        {label:'Handled',value:a.handled,sub:pct(eff)+' eff.'},
        {label:'Avg Handle',value:avgH?fmtSec(avgH):'-',sub:'per call'},
        {label:'Avg Hold',value:avgHo?fmtSec(avgHo):'-',sub:'per call'},
        {label:'SLA %',value:pct(slaRate),sub:'in SLA'},
        {label:'In SLA',value:a.handledInSla,sub:'of '+a.handled+' handled'},
      ].map(k=>`<div class="drawer-kpi"><div class="drawer-kpi-label">${k.label}</div><div class="drawer-kpi-value">${k.value}</div><div class="drawer-kpi-sub">${k.sub}</div></div>`).join('');

      // Body
      let body = '';

      // Daily breakdown
      const dayAgentMap = {};
      a.rows.forEach(r=>{
        const k=dateKey(r._dt);
        if(!dayAgentMap[k]) dayAgentMap[k]={dt:r._dt,total:0,handled:0};
        dayAgentMap[k].total++;
        if(isHandled(r)) dayAgentMap[k].handled++;
      });
      const dayEntries = Object.entries(dayAgentMap).sort((a,b)=>a[0]<b[0]?-1:1);
      if(dayEntries.length){
        body += `<div class="drawer-section"><h4>Daily Activity</h4>
          <table class="day-table"><thead><tr><th>Date</th><th>Calls</th><th>Handled</th><th>Efficiency</th></tr></thead><tbody>`;
        dayEntries.forEach(([k,d])=>{
          const e2=d.total?d.handled/d.total:0;
          const ec=e2>0.8?'ok':e2>0.5?'warn':'err';
          body+=`<tr><td style="font-weight:600;color:var(--ink)">${dayLabel(d.dt)}</td><td>${d.total}</td><td>${d.handled}</td><td><span class="pill ${ec}">${pct(e2)}</span></td></tr>`;
        });
        body += '</tbody></table></div>';
      }

      // Queue breakdown
      const qMap = {};
      a.rows.forEach(r=>{ const q=String(cell(r,'queue')||'Unknown').trim(); qMap[q]=(qMap[q]||0)+1; });
      const qEntries = Object.entries(qMap).sort((a,b)=>b[1]-a[1]);
      if(qEntries.length){
        const maxQ = qEntries[0][1];
        body += `<div class="drawer-section"><h4>Queue Distribution</h4>`;
        qEntries.forEach(([qn,count],i)=>{
          const w=(count/maxQ)*100;
          const shortQ=qn.replace('GL MATALAN ','').replace(' EN','');
          body+=`<div class="bar-row"><div class="bar-label" title="${escHtml(qn)}">${escHtml(shortQ)}</div><div class="bar-track"><div class="bar-fill" style="width:${w.toFixed(0)}%;background:${MULTI[i%MULTI.length]}"></div></div><div class="bar-val">${count}</div></div>`;
        });
        body += '</div>';
      }

      document.getElementById('drawerBody').innerHTML = body;
      document.getElementById('drawerBody').scrollTop = 0;
      document.getElementById('agentDrawer').classList.add('open');
      document.getElementById('drawerOverlay').classList.add('open');
    }

    // ── MAIN CALCULATE ──
    function calculate(){
      if(!parsedRows.length){
        resetOutput(); setStatus('waiting for CSV.'); setBadge('Waiting');
        setCheck('checkUpload','Waiting'); setCheck('checkColumns','Not checked'); setCheck('checkDates','Not checked');
        return;
      }
      setCheck('checkUpload',`${parsedRows.length.toLocaleString()} rows`,'ok');
      activeColumns=resolveColumns(parsedRows[0]);
      const required={date:'Date',mediaType:'Media Type',abandoned:'Abandoned',totalQueue:'Total Queue'};
      const missing=Object.entries(required).filter(([key])=>!activeColumns[key]).map(([,label])=>label);
      if(missing.length){
        resetKPIs(); setCheck('checkColumns','Missing: '+missing.join(', '),'err');
        setCheck('checkDates','Blocked','err'); setStatus('Missing required columns: '+missing.join(', '),'err'); setBadge('Error'); return;
      }
      setCheck('checkColumns','Ready','ok');
      const mappedRows=parsedRows.map(r=>({...r,_dt:parseDate(cell(r,'date'))}));
      const rows=mappedRows.filter(r=>r._dt);
      if(!rows.length){
        resetKPIs(); setCheck('checkDates','Could not parse','err');
        setStatus('Date column could not be parsed.','err'); setBadge('Error'); return;
      }
      const skippedDates=mappedRows.length-rows.length;
      setCheck('checkDates',skippedDates?`${skippedDates} skipped`:'Ready',skippedDates?'':'ok');
      rows.sort((a,b)=>a._dt-b._dt);
      allMappedRows = rows;
      const latest=rows[rows.length-1]._dt;
      const latestKey=dateKey(latest);

      // ── TODAY AWARENESS: only alert when CSV is exactly 1 day behind ──
      const today=new Date(); today.setHours(0,0,0,0);
      const latestMidnight=new Date(latest); latestMidnight.setHours(0,0,0,0);
      const diffDays=Math.round((today-latestMidnight)/(1000*60*60*24));
      if(diffDays===1){
        const todayFmt=today.toLocaleDateString('en-GB',{day:'2-digit',month:'short'});
        showToast(`No calls recorded for <strong>${todayFmt}</strong> yet. Showing data from <strong>${dateLabel(latest)}</strong>. Upload a fresh export once today's calls come in.`);
      }

      const todayRows=rows.filter(r=>dateKey(r._dt)===latestKey);
      const mtdRows=rows.filter(r=>r._dt.getFullYear()===latest.getFullYear()&&r._dt.getMonth()===latest.getMonth()&&r._dt<=new Date(latest.getFullYear(),latest.getMonth(),latest.getDate(),23,59,59));
      function calc(all){
        const voice=all.filter(isVoice);
        const callbacks=all.filter(isCallback);
        const handled=voice.filter(isHandled);
        const handledInSla=handled.filter(r=>num(cell(r,'totalQueue'))<=ANSWER_SLA_MS);
        const handledOutSla=handled.filter(r=>num(cell(r,'totalQueue'))>ANSWER_SLA_MS);
        const fastAbandons=voice.filter(r=>isAbandoned(r)&&num(cell(r,'totalQueue'))<=FAST_ABANDON_MS);
        const abandonExFast=voice.filter(r=>isAbandoned(r)&&num(cell(r,'totalQueue'))>FAST_ABANDON_MS);
        
        let peakHourStr = '-';
        if (all.length > 0) {
          const hourCounts = Array(24).fill(0);
          all.forEach(r => {
            if (r._dt) {
              hourCounts[r._dt.getHours()]++;
            }
          });
          let maxCount = 0;
          let peakHour = 0;
          for (let h = 0; h < 24; h++) {
            if (hourCounts[h] > maxCount) {
              maxCount = hourCounts[h];
              peakHour = h;
            }
          }
          if (maxCount > 0) {
            const startHour = String(peakHour).padStart(2, '0');
            peakHourStr = `${startHour}:00 (${maxCount})`;
          }
        }

        return {offered:all.length,voice:voice.length,callbacks:callbacks.length,handled:handled.length,handledInSla:handledInSla.length,handledOutSla:handledOutSla.length,fastAbandons:fastAbandons.length,abandonExFast:abandonExFast.length,gos:handled.length?handledInSla.length/handled.length:0,abandonRate:all.length?abandonExFast.length/all.length:0,peakHour:peakHourStr};
      }
      const t=calc(todayRows),m=calc(mtdRows);
      const now=new Date();
      const ist=now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Kolkata'});
      const bst=now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Europe/London'});
      const msg=`SLA Update | ${shortDate(latest)} | ${ist} IST / ${bst} BST\n--------------------------------------------\n- Call GOS Today: ${pct(t.gos)}\n- Call GOS MTD: ${pct(m.gos)}\n- Volume Today: ${fmt(t.offered)}\n- Abandon Today: ${fmt(t.abandonExFast)}\n- Abandon MTD: ${pct(m.abandonRate)}\n--------------------------------------------`;
      document.getElementById('kDate').textContent=dateLabel(latest);
      document.getElementById('kVol').textContent=fmt(t.offered);
      document.getElementById('kGosToday').textContent=pct(t.gos);
      document.getElementById('kGosMtd').textContent=pct(m.gos);
      document.getElementById('kAbToday').textContent=fmt(t.abandonExFast);
      document.getElementById('kAbMtd').textContent=pct(m.abandonRate);
      document.getElementById('message').value=msg;
      document.getElementById('sOffered').textContent=fmt(m.offered);
      document.getElementById('sCallbacks').textContent=fmt(m.callbacks);
      document.getElementById('sHandled').textContent=fmt(m.handled);
      document.getElementById('sInSla').textContent=fmt(m.handledInSla);
      document.getElementById('sOutSla').textContent=fmt(m.handledOutSla);
      document.getElementById('sFastAb').textContent=fmt(m.fastAbandons);
      document.getElementById('sAbExFast').textContent=fmt(m.abandonExFast);
      document.getElementById('sPeakHour').textContent=m.peakHour;
      latestSummary={latest,today:t,mtd:m,rows:rows.length,skippedDates};
      analyticsBuilt=false;
      setBadge(rows.length.toLocaleString()+' rows');
      setStatus('ready — '+dateLabel(latest)+'.','ok');
    }

    function resetKPIs(){
      latestSummary=null; allMappedRows=[];
      ['kDate','kVol','kGosToday','kGosMtd','kAbToday','kAbMtd','sOffered','sCallbacks','sHandled','sInSla','sOutSla','sFastAb','sAbExFast','sPeakHour'].forEach(id=>document.getElementById(id).textContent='-');
      document.getElementById('message').value='Upload Interactions.csv to generate the SLA update.';
    }
    function resetOutput(){ resetKPIs(); }

    // ── REBUILD ANALYTICS (respects date filter) ──
    function rebuildAnalytics(rows){
      if(!rows||!rows.length) return;
      buildDayInsights(rows);
      buildAgentInsights(rows);
      buildQueueInsights(rows);
      buildPatternInsights(rows);
    }

    // ── DAYS PERFORMANCE ──
    function buildDayInsights(rows){
      const dayMap={};
      rows.forEach(r=>{
        const k=dateKey(r._dt);
        if(!dayMap[k]) dayMap[k]={dt:r._dt,rows:[]};
        dayMap[k].rows.push(r);
      });
      const days=Object.entries(dayMap).sort((a,b)=>a[0]<b[0]?-1:1);

      function calcDay(all){
        const voice=all.filter(isVoice);
        const handled=voice.filter(isHandled);
        const handledInSla=handled.filter(r=>num(cell(r,'totalQueue'))<=ANSWER_SLA_MS);
        const fastAbandons=voice.filter(r=>isAbandoned(r)&&num(cell(r,'totalQueue'))<=FAST_ABANDON_MS);
        const abandonExFast=voice.filter(r=>isAbandoned(r)&&num(cell(r,'totalQueue'))>FAST_ABANDON_MS);
        const handleMs=handled.map(r=>num(cell(r,'totalHandle'))).filter(v=>v>0);
        const avgHandle=handleMs.length?handleMs.reduce((s,v)=>s+v,0)/handleMs.length:0;

        // Unique agents who handled voice calls on this day
        const dayUniqueAgents = new Set();
        handled.forEach(r => {
          const uStr = String(cell(r, 'users') || '').trim();
          if (uStr) {
            uStr.split(';').forEach(u => {
              const name = u.trim();
              if (name) dayUniqueAgents.add(name);
            });
          }
        });

        return {
          offered:all.length,voice:voice.length,handled:handled.length,
          handledInSla:handledInSla.length,fastAbandons:fastAbandons.length,
          abandonExFast:abandonExFast.length,
          gos:handled.length?handledInSla.length/handled.length:null,
          abandonRate:all.length?abandonExFast.length/all.length:null,
          avgHandle,
          uniqueAgents: dayUniqueAgents.size
        };
      }

      window._dayMap = dayMap;
      // Table
      const tw=document.getElementById('dayTableWrap');
      let html=`<table class="day-table"><thead><tr>
        <th>Date</th><th>Offered</th><th>Handled</th><th>Call GOS</th>
        <th>Abandon Rate</th><th>Abandon Count</th><th>Avg Handle</th><th>Agents</th>
      </tr></thead><tbody>`;
      days.forEach(([k,{dt,rows}])=>{
        const d=calcDay(rows);
        const gosClass=d.gos===null?'neutral':d.gos>=0.8?'ok':d.gos>=0.6?'warn':'err';
        const abClass=d.abandonRate===null?'neutral':d.abandonRate<=0.05?'ok':d.abandonRate<=0.1?'warn':'err';

        // Unique agent names for the day to show on hover
        const voice = rows.filter(isVoice);
        const handled = voice.filter(isHandled);
        const dayUniqueAgents = new Set();
        handled.forEach(r => {
          const uStr = String(cell(r, 'users') || '').trim();
          if (uStr) {
            uStr.split(';').forEach(u => {
              const name = u.trim();
              if (name) dayUniqueAgents.add(name);
            });
          }
        });
        const agentNamesList = Array.from(dayUniqueAgents).sort().join(', ');

        html+=`<tr class="clickable-row" onclick="openDayDrawer('${k}')">
          <td style="font-weight:600;color:var(--ink)">${dayLabel(dt)} 🔍</td>
          <td>${d.offered}</td><td>${d.handled}</td>
          <td><span class="pill ${gosClass}">${d.gos!==null?pct(d.gos):'-'}</span></td>
          <td><span class="pill ${abClass}">${d.abandonRate!==null?pct(d.abandonRate):'-'}</span></td>
          <td>${d.abandonExFast}</td>
          <td>${d.avgHandle?fmtSec(d.avgHandle):'-'}</td>
          <td title="Active Agents: ${agentNamesList || 'None'}"><strong style="color:var(--chart-indigo)">${d.uniqueAgents}</strong></td>
        </tr>`;
      });
      tw.innerHTML=html+'</tbody></table>';

      // Day Comparator
      const compEl=document.getElementById('dayComparatorWrap');
      if(days.length<2){
        compEl.innerHTML='<div class="empty-state"><div class="ei">\u2696\uFE0F</div><p>Need at least 2 days to compare.</p></div>';
      } else {
        const dayCompData=Object.fromEntries(days.map(([k,{dt,rows}])=>[k,{dt,stats:calcDay(rows)}]));
        const opts=days.map(([k,{dt}])=>`<option value="${k}">${dayLabel(dt)}</option>`).join('');
        compEl.innerHTML=`<div class="comparator-controls">
          <div class="comp-select-group"><label>Day A</label><select id="compDayA">${opts}</select></div>
          <div class="comp-vs">VS</div>
          <div class="comp-select-group"><label>Day B</label><select id="compDayB">${opts}</select></div>
          <button class="df-btn" id="compareDays">Compare</button>
        </div><div id="compResult"></div>`;
        document.getElementById('compDayB').selectedIndex=days.length-1;
        function doCompare(){
          const kA=document.getElementById('compDayA').value;
          const kB=document.getElementById('compDayB').value;
          const da=dayCompData[kA], db=dayCompData[kB];
          if(!da||!db) return;
          const metrics=[
            {label:'Offered',vA:da.stats.offered,vB:db.stats.offered,f:v=>fmt(v),hi:'neutral'},
            {label:'Handled',vA:da.stats.handled,vB:db.stats.handled,f:v=>fmt(v),hi:'good'},
            {label:'Call GOS',vA:da.stats.gos,vB:db.stats.gos,f:v=>v!==null?pct(v):'-',hi:'good',isP:true},
            {label:'Abandon Rate',vA:da.stats.abandonRate,vB:db.stats.abandonRate,f:v=>v!==null?pct(v):'-',hi:'bad',isP:true},
            {label:'Abandon Count',vA:da.stats.abandonExFast,vB:db.stats.abandonExFast,f:v=>fmt(v),hi:'bad'},
            {label:'Avg Handle',vA:da.stats.avgHandle,vB:db.stats.avgHandle,f:v=>v?fmtSec(v):'-',hi:'neutral'},
            {label:'Active Agents',vA:da.stats.uniqueAgents,vB:db.stats.uniqueAgents,f:v=>fmt(v),hi:'neutral'},
          ];
          let h=`<div class="comp-header">
            <div class="comp-metric-label"></div>
            <div class="comp-day-label" style="color:var(--chart-blue)">${dayLabel(da.dt)}</div>
            <div class="comp-day-label" style="opacity:.5">DELTA</div>
            <div class="comp-day-label" style="color:var(--chart-teal)">${dayLabel(db.dt)}</div>
          </div><div class="comp-grid">`;
          metrics.forEach(m=>{
            const delta=(m.vB||0)-(m.vA||0);
            let ds;
            if(m.isP) ds=(delta>0?'+':'')+(delta*100).toFixed(2)+'%';
            else ds=(delta>0?'+':'')+Math.round(delta);
            let dc=delta===0?'neutral':m.hi==='good'?(delta>0?'improved':'declined'):m.hi==='bad'?(delta>0?'declined':'improved'):'neutral';
            const ar=delta>0?'\u2191':delta<0?'\u2193':'\u2192';
            h+=`<div class="comp-metric-row">
              <div class="comp-metric-label">${m.label}</div>
              <div class="comp-val a">${m.f(m.vA)}</div>
              <div class="comp-delta ${dc}">${ar} ${ds}</div>
              <div class="comp-val b">${m.f(m.vB)}</div>
            </div>`;
          });
          h+='</div>';
          document.getElementById('compResult').innerHTML=h;
        }
        document.getElementById('compareDays').addEventListener('click',doCompare);
        doCompare();
      }
    }

    // ── AGENT INSIGHTS ──
    function buildAgentInsights(rows){
      const soloRows=rows.filter(r=>{ const u=String(cell(r,'users')||'').trim(); return u&&!u.includes(';'); });
      const agentMap={};
      soloRows.forEach(r=>{
        const agent=String(cell(r,'users')).trim();
        if(!agent) return;
        if(!agentMap[agent]) agentMap[agent]={total:0,handled:0,handledInSla:0,handleMs:[],holdMs:[],timeout:0,wrapOk:0,wrapMissing:0,rows:[]};
        const a=agentMap[agent];
        a.total++; a.rows.push(r);
        if(isHandled(r)){
          a.handled++;
          if(isVoice(r) && num(cell(r,'totalQueue'))<=ANSWER_SLA_MS) a.handledInSla++;
          const h=num(cell(r,'totalHandle')); if(h>0) a.handleMs.push(h);
          const ho=num(cell(r,'totalHold')); if(ho>0) a.holdMs.push(ho);
        }
        const wu=String(cell(r,'wrapup')||'').trim();
        if(wu==='ININ-WRAP-UP-TIMEOUT') a.timeout++;
        else if(wu) a.wrapOk++;
        else a.wrapMissing++;
      });
      window._agentMap = agentMap;
      const agents=Object.entries(agentMap).sort((a,b)=>b[1].total-a[1].total);
      const avgHandle=a=>a.handleMs.length?a.handleMs.reduce((s,v)=>s+v,0)/a.handleMs.length:0;
      const maxHandle=Math.max(...agents.map(([,a])=>avgHandle(a)),1);

      // Table — clickable rows
      const tw=document.getElementById('agentTableWrap');
      if(!agents.length){ tw.innerHTML='<div class="empty-state"><div class="ei">👤</div><p>No individual agent data found.</p></div>'; }
      else {
        let html=`<table class="agent-table"><thead><tr><th>Agent</th><th>Calls</th><th>Handled</th><th>Avg Handle</th><th>Avg Hold</th><th>SLA %</th><th>Efficiency</th></tr></thead><tbody>`;
        agents.forEach(([name,a])=>{
          const slaR=a.handled?a.handledInSla/a.handled:0;
          const avgH=avgHandle(a);
          const avgHo=a.holdMs.length?a.holdMs.reduce((s,v)=>s+v,0)/a.holdMs.length:0;
          const efficiency=a.total?a.handled/a.total:0;
          const sClass=slaR>=0.8?'ok':slaR>=0.6?'warn':'err';
          const eClass=efficiency>0.8?'ok':efficiency>0.5?'warn':'err';
          html+=`<tr>
            <td><span class="agent-name">${escHtml(name)}</span></td>
            <td>${a.total}</td><td>${a.handled}</td>
            <td>${avgH?fmtSec(avgH):'-'}</td><td>${avgHo?fmtSec(avgHo):'-'}</td>
            <td><span class="pill ${sClass}">${pct(slaR)}</span></td>
            <td><span class="pill ${eClass}">${pct(efficiency)}</span></td>
          </tr>`;
        });
        tw.innerHTML=html+'</tbody></table>';
      }

      // Handle time — distinct color per agent from MULTI palette
      const hEl=document.getElementById('agentHandleChart');
      if(!agents.length){ hEl.innerHTML='<div class="empty-state"><p>No data.</p></div>'; }
      else {
        let h='';
        agents.forEach(([name,a],i)=>{
          const avg=avgHandle(a); const w=maxHandle>0?(avg/maxHandle)*100:0;
          const shortName=name.split(' ')[0];
          h+=`<div class="bar-row"><div class="bar-label" title="${escHtml(name)}">${escHtml(shortName)}</div><div class="bar-track"><div class="bar-fill" style="width:${w.toFixed(1)}%;background:${MULTI[i%MULTI.length]}"></div></div><div class="bar-val">${avg?fmtSec(avg):'-'}</div></div>`;
        });
        hEl.innerHTML=h;
      }

      // SLA Compliance by Agent
      const slaEl=document.getElementById('agentSlaChart');
      if(!agents.length){ slaEl.innerHTML='<div class="empty-state"><p>No data.</p></div>'; }
      else {
        let h='';
        agents.forEach(([name,a],i)=>{
          const slaR=a.handled?a.handledInSla/a.handled:0;
          const w=(slaR*100).toFixed(1);
          const color=slaR>=0.8?CHART.green:slaR>=0.6?CHART.amber:CHART.red;
          const shortName=name.split(' ')[0];
          h+=`<div class="bar-row"><div class="bar-label" title="${escHtml(name)}">${escHtml(shortName)}</div><div class="bar-track"><div class="bar-fill" style="width:${w}%;background:${color}"></div></div><div class="bar-val">${pct(slaR)}</div></div>`;
        });
        slaEl.innerHTML=h;
      }
    }

    // ── QUEUE INSIGHTS ──
    function buildQueueInsights(rows){
      const queueMap={};
      rows.forEach(r=>{
        const q=String(cell(r,'queue')||'Unknown').trim();
        if(!queueMap[q]) queueMap[q]={total:0,abandoned:0,waitMs:[],handleMs:[]};
        const a=queueMap[q]; a.total++;
        if(isAbandoned(r)) a.abandoned++;
        const tw=num(cell(r,'totalQueue')); if(tw>0&&isHandled(r)) a.waitMs.push(tw);
        const th=num(cell(r,'totalHandle')); if(th>0&&isHandled(r)) a.handleMs.push(th);
      });
      const queues=Object.entries(queueMap).sort((a,b)=>b[1].total-a[1].total);
      const totalVol=queues.reduce((s,[,q])=>s+q.total,0);
      const maxAbRate=Math.max(...queues.map(([,q])=>q.total?q.abandoned/q.total:0),0.001);
      const maxWait=Math.max(...queues.map(([,q])=>q.waitMs.length?q.waitMs.reduce((s,v)=>s+v,0)/q.waitMs.length:0),1);

      function shortQ(n){ return n.replace('GL MATALAN ','').replace(' EN',''); }

      // Volume — multi-color
      const vEl=document.getElementById('queueVolumeChart');
      let h='';
      queues.forEach(([name,q],i)=>{
        const w=totalVol?(q.total/totalVol)*100:0;
        h+=`<div class="bar-row"><div class="bar-label" title="${escHtml(name)}">${escHtml(shortQ(name))}</div><div class="bar-track"><div class="bar-fill" style="width:${w.toFixed(1)}%;background:${MULTI[i%MULTI.length]}"></div></div><div class="bar-val">${q.total}</div></div>`;
      });
      vEl.innerHTML=h||'<div class="empty-state"><p>No data.</p></div>';

      // Abandon — red/amber/green
      const aEl=document.getElementById('queueAbandonChart');
      h='';
      queues.forEach(([name,q])=>{
        const rate=q.total?q.abandoned/q.total:0;
        const w=(rate/maxAbRate)*100;
        const color=rate>0.2?CHART.red:rate>0.1?CHART.amber:CHART.green;
        h+=`<div class="bar-row"><div class="bar-label">${escHtml(shortQ(name))}</div><div class="bar-track"><div class="bar-fill" style="width:${w.toFixed(1)}%;background:${color}"></div></div><div class="bar-val">${pct(rate)}</div></div>`;
      });
      aEl.innerHTML=h||'<div class="empty-state"><p>No data.</p></div>';

      // Wait time — red/amber/green
      const wEl=document.getElementById('queueWaitChart');
      h='';
      queues.forEach(([name,q])=>{
        const avg=q.waitMs.length?q.waitMs.reduce((s,v)=>s+v,0)/q.waitMs.length:0;
        const w=maxWait>0?(avg/maxWait)*100:0;
        const color=avg>120000?CHART.red:avg>60000?CHART.amber:CHART.green;
        h+=`<div class="bar-row"><div class="bar-label">${escHtml(shortQ(name))}</div><div class="bar-track"><div class="bar-fill" style="width:${w.toFixed(1)}%;background:${color}"></div></div><div class="bar-val">${avg?fmtSec(avg):'-'}</div></div>`;
      });
      wEl.innerHTML=h||'<div class="empty-state"><p>No data.</p></div>';

      // Disconnect donut — meaningful colors
      const discMap={};
      rows.forEach(r=>{ const d=String(cell(r,'disconnectType')||'Unknown').trim(); discMap[d]=(discMap[d]||0)+1; });
      const discs=Object.entries(discMap).sort((a,b)=>b[1]-a[1]);
      const totalDisc=discs.reduce((s,[,v])=>s+v,0);
      const dcColors={External:CHART.green, Agent:CHART.amber, System:CHART.red};
      const dEl=document.getElementById('disconnectChart');
      if(!discs.length){ dEl.innerHTML='<div class="empty-state"><p>No data.</p></div>'; }
      else {
        const sz=90; let angle=-Math.PI/2, paths='';
        const leg=discs.map(([name,count],i)=>{
          const slice=(count/totalDisc)*Math.PI*2;
          const x1=sz/2+(sz/2-8)*Math.cos(angle), y1=sz/2+(sz/2-8)*Math.sin(angle);
          angle+=slice;
          const x2=sz/2+(sz/2-8)*Math.cos(angle), y2=sz/2+(sz/2-8)*Math.sin(angle);
          const large=slice>Math.PI?1:0;
          const color=dcColors[name]||MULTI[i%MULTI.length];
          if(discs.length===1) paths+=`<circle cx="${sz/2}" cy="${sz/2}" r="${sz/2-8}" fill="${color}"/>`;
          else paths+=`<path d="M${sz/2},${sz/2} L${x1},${y1} A${sz/2-8},${sz/2-8} 0 ${large},1 ${x2},${y2} Z" fill="${color}"/>`;
          return `<div class="legend-row"><div class="legend-dot" style="background:${color}"></div><div class="legend-label">${escHtml(name)}</div><div class="legend-val">${count}</div></div>`;
        }).join('');
        dEl.innerHTML=`<div class="donut-wrap"><svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" style="flex-shrink:0">${paths}</svg><div class="donut-legend">${leg}</div></div>`;
      }
    }

    // ── PATTERN INSIGHTS ──
    function buildPatternInsights(rows){
      const hourMap={}, hourAbMap={};
      for(let h=0;h<24;h++){hourMap[h]=0;hourAbMap[h]=0;}
      rows.forEach(r=>{ const h=r._dt.getHours(); hourMap[h]++; if(isAbandoned(r)) hourAbMap[h]++; });
      const allHours=Object.keys(hourMap).map(Number).filter(h=>hourMap[h]>0);
      const hEl=document.getElementById('hourlyChart');
      if(!allHours.length){ hEl.innerHTML='<div class="empty-state"><p>No data.</p></div>'; }
      else {
        const minH=Math.min(...allHours), maxH=Math.max(...allHours);
        const span=Array.from({length:maxH-minH+1},(_,i)=>i+minH);
        const maxV=Math.max(...span.map(h=>hourMap[h]),1);
        let h=`<div style="margin-bottom:6px;font-size:10px;font-family:var(--mono);color:var(--muted)">${rows.length} interactions</div><div class="hourly-wrap">`;
        span.forEach(hr=>{
          const total=hourMap[hr]||0, ab=hourAbMap[hr]||0, handled=total-ab;
          const hPct=maxV>0?(handled/maxV)*80:0, aPct=maxV>0?(ab/maxV)*80:0;
          h+=`<div class="h-bar-col">
            ${ab>0?`<div class="h-bar-abandoned" style="height:${aPct.toFixed(0)}%" title="${ab} abandoned"></div>`:''}
            <div class="h-bar-handled" style="height:${hPct.toFixed(0)}%" title="${handled} handled"></div>
            <div class="h-label">${String(hr).padStart(2,'0')}</div>
          </div>`;
        });
        h+='</div>';
        h+=`<div style="display:flex;gap:12px;margin-top:8px"><div class="wu-leg-item"><div class="wu-leg-dot" style="background:${CHART.blue}"></div>Handled</div><div class="wu-leg-item"><div class="wu-leg-dot" style="background:${CHART.red}"></div>Abandoned</div></div>`;
        hEl.innerHTML=h;
      }

      // Handle time buckets — meaningful colors
      const voiceHandled=rows.filter(r=>isVoice(r)&&isHandled(r));
      const buckets={'<2 min':0,'2–5 min':0,'5–10 min':0,'10+ min':0};
      voiceHandled.forEach(r=>{ const s=num(cell(r,'totalHandle'))/1000; if(s<120)buckets['<2 min']++; else if(s<300)buckets['2–5 min']++; else if(s<600)buckets['5–10 min']++; else buckets['10+ min']++; });
      const bEl=document.getElementById('handleBuckets');
      if(!voiceHandled.length){ bEl.innerHTML='<div class="empty-state"><p>No handled voice data.</p></div>'; }
      else {
        const colors={'<2 min':CHART.green,'2–5 min':CHART.blue,'5–10 min':CHART.amber,'10+ min':CHART.red};
        let h='<div class="bucket-grid">';
        Object.entries(buckets).forEach(([label,count])=>{
          const pv=voiceHandled.length?(count/voiceHandled.length*100).toFixed(0):0;
          h+=`<div class="bucket-card"><div class="bucket-val" style="color:${colors[label]}">${count}</div><div class="bucket-label">${label}</div><div class="bucket-sub">${pv}% of handled</div></div>`;
        });
        h+='</div>';
        bEl.innerHTML=h;
      }

      // Media type — distinct colors per type
      const mediaMap={};
      rows.forEach(r=>{ const m=String(cell(r,'mediaType')||'Unknown').toLowerCase(); mediaMap[m]=(mediaMap[m]||0)+1; });
      const medias=Object.entries(mediaMap).sort((a,b)=>b[1]-a[1]);
      const totalMedia=medias.reduce((s,[,v])=>s+v,0);
      const mColors={voice:CHART.blue, callback:CHART.green, chat:CHART.teal, email:CHART.amber};
      const mEl=document.getElementById('mediaChart');
      let h='';
      medias.forEach(([name,count],i)=>{
        const w=totalMedia?(count/totalMedia)*100:0;
        const color=mColors[name]||MULTI[i%MULTI.length];
        h+=`<div class="bar-row"><div class="bar-label" style="text-transform:capitalize">${escHtml(name)}</div><div class="bar-track"><div class="bar-fill" style="width:${w.toFixed(1)}%;background:${color}"></div></div><div class="bar-val">${count} (${pct(count/totalMedia)})</div></div>`;
      });
      mEl.innerHTML=h||'<div class="empty-state"><p>No data.</p></div>';
    }

    // ── FILE HANDLING ──
    async function handleFile(file){
      if(!file) return;
      document.getElementById('fileName').textContent=file.name;
      setStatus('reading…'); setBadge('Loading');
      setCheck('checkUpload','Reading'); setCheck('checkColumns','Checking'); setCheck('checkDates','Checking');
      parsedRows=parseCSV(await file.text());
      activeColumns=resolveColumns(parsedRows[0]||{});
      calculate();
    }
    document.getElementById('fileInput').addEventListener('change',e=>handleFile(e.target.files[0]));
    const uploadBox=document.getElementById('uploadBox');
    uploadBox.addEventListener('dragover',e=>{ e.preventDefault(); uploadBox.classList.add('dragging'); });
    uploadBox.addEventListener('dragleave',()=>uploadBox.classList.remove('dragging'));
    uploadBox.addEventListener('drop',e=>{ e.preventDefault(); uploadBox.classList.remove('dragging'); handleFile(e.dataTransfer.files[0]); });

    // ── EXPORT BUTTONS ──
    function downloadText(filename,text,type='text/plain'){
      const blob=new Blob([text],{type});
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href);
    }
    function csvCell(value){ return `"${String(value??'').replace(/"/g,'""')}"`; }

    document.getElementById('copyBtn').addEventListener('click',async()=>{
      const text=document.getElementById('message').value;
      if(!latestSummary){ setStatus('Upload CSV before copying.','err'); return; }
      try{ await navigator.clipboard.writeText(text); setStatus('copied.','ok'); }
      catch{ const ta=document.getElementById('message'); ta.select(); document.execCommand('copy'); setStatus('copied.','ok'); }
    });
    document.getElementById('downloadBtn').addEventListener('click',()=>{
      if(!latestSummary){ setStatus('Upload CSV before downloading.','err'); return; }
      downloadText('SLA_Update.txt',document.getElementById('message').value);
    });
    document.getElementById('summaryBtn').addEventListener('click',()=>{
      if(!latestSummary){ setStatus('Upload CSV before downloading summary.','err'); return; }
      const{latest,today,mtd,rows,skippedDates}=latestSummary;
      const summary=[
        ['Metric','Today','MTD'].map(csvCell).join(','),
        ['Report Date',dateLabel(latest),dateLabel(latest)].map(csvCell).join(','),
        ['Parsed Rows',rows,rows].map(csvCell).join(','),
        ['Calls Offered',today.offered,mtd.offered].map(csvCell).join(','),
        ['Voice Records',today.voice,mtd.voice].map(csvCell).join(','),
        ['Callbacks',today.callbacks,mtd.callbacks].map(csvCell).join(','),
        ['Handled Calls',today.handled,mtd.handled].map(csvCell).join(','),
        ['Handled In SLA',today.handledInSla,mtd.handledInSla].map(csvCell).join(','),
        ['Handled Out SLA',today.handledOutSla,mtd.handledOutSla].map(csvCell).join(','),
        ['Fast Abandons',today.fastAbandons,mtd.fastAbandons].map(csvCell).join(','),
        ['Abandon Excl. Fast',today.abandonExFast,mtd.abandonExFast].map(csvCell).join(','),
        ['Call GOS',pct(today.gos),pct(mtd.gos)].map(csvCell).join(','),
        ['Abandon Rate',pct(today.abandonRate),pct(mtd.abandonRate)].map(csvCell).join(',')
      ].join('\n');
      downloadText('SLA_Summary.csv',summary,'text/csv');
    });

Object.assign(window, { openDayDrawer });

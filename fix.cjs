const fs = require('fs');
let content = fs.readFileSync('src/template.ts', 'utf8');

const p1 = '<div class=\\"insight-panel full\\"><h3>🏆 Top Performers</h3><div id=\\"leaderboardWrap\\"><div class=\\"empty-state\\"><div class=\\"ei\\">🏆</div><p>Upload a CSV on the main screen to load data.</p></div></div></div>';

const p2 = '<div class=\\"insight-panel full\\"><h3>Weekly Heatmap — Day vs Hour (find your busiest slots)</h3><div id=\\"weeklyHeatmap\\"><div class=\\"empty-state\\"><div class=\\"ei\\">🔥</div><p>No data yet.</p></div></div></div>';

const p3 = '<div class=\\"insight-panel full\\"><h3>SLA Breach Root-Cause Analysis</h3><div class=\\"mini-kpis\\" id=\\"breachKpis\\" style=\\"grid-template-columns:repeat(4,1fr);\\"><div class=\\"empty-state\\"><div class=\\"ei\\">🧭</div><p>Upload a CSV on the main screen to load data.</p></div></div><div id=\\"breachInsight\\"></div></div><div class=\\"insight-panel\\"><h3>Breaches by Queue</h3><div id=\\"breachQueueChart\\"><div class=\\"empty-state\\"><div class=\\"ei\\">📊</div><p>No data yet.</p></div></div></div><div class=\\"insight-panel\\"><h3>Breaches by Disconnect Reason</h3><div id=\\"breachDisconnectChart\\"><div class=\\"empty-state\\"><div class=\\"ei\\">📵</div><p>No data yet.</p></div></div></div><div class=\\"insight-panel\\"><h3>Breaches by Wrap-up Code</h3><div id=\\"breachWrapupChart\\"><div class=\\"empty-state\\"><div class=\\"ei\\">🏷️</div><p>No data yet.</p></div></div></div><div class=\\"insight-panel\\"><h3>Breaches by Hour of Day</h3><div id=\\"breachHourChart\\"><div class=\\"empty-state\\"><div class=\\"ei\\">🕐</div><p>No data yet.</p></div></div></div>';

const btnString = '<button class=\\"btn\\" id=\\"analyticsBtn\\" style=\\"background-color:#6366F1;color:white;border:none;margin-left:8px;\\">📊 Analytics Dashboard</button>';
content = content.replace(btnString, '');

const breachTab = '<button class=\\"a-tab\\" data-atab=\\"breach\\">SLA Breach</button>';
const breachPanel = '<div class=\\"a-tab-panel\\" id=\\"atab-breach\\"><div class=\\"insights-grid\\">' + p3 + '</div></div>';

content = content.replace(breachTab, '');
content = content.replace(breachPanel, '');
content = content.replace(p1, '');
content = content.replace(p2, '');

const p3Grid = '<div class=\\"insight-panel full\\"><h3>SLA Breach Root-Cause Analysis</h3><div class=\\"mini-kpis\\" id=\\"breachKpis\\" style=\\"grid-template-columns:repeat(4,1fr);\\"><div class=\\"empty-state\\"><div class=\\"ei\\">🧭</div><p>Upload a CSV on the main screen to load data.</p></div></div><div id=\\"breachInsight\\"></div></div><div class=\\"insights-grid\\"><div class=\\"insight-panel\\"><h3>Breaches by Queue</h3><div id=\\"breachQueueChart\\"><div class=\\"empty-state\\"><div class=\\"ei\\">📊</div><p>No data yet.</p></div></div></div><div class=\\"insight-panel\\"><h3>Breaches by Disconnect Reason</h3><div id=\\"breachDisconnectChart\\"><div class=\\"empty-state\\"><div class=\\"ei\\">📵</div><p>No data yet.</p></div></div></div><div class=\\"insight-panel\\"><h3>Breaches by Wrap-up Code</h3><div id=\\"breachWrapupChart\\"><div class=\\"empty-state\\"><div class=\\"ei\\">🏷️</div><p>No data yet.</p></div></div></div><div class=\\"insight-panel\\"><h3>Breaches by Hour of Day</h3><div id=\\"breachHourChart\\"><div class=\\"empty-state\\"><div class=\\"ei\\">🕐</div><p>No data yet.</p></div></div></div></div>';

const featuresHtml = '<section class=\\"workspace features-workspace\\" style=\\"display:flex;flex-direction:column;gap:12px;margin-top:12px;overflow:visible;padding-bottom:24px;\\">' + p1 + p2 + p3Grid + '</section>';

content = content.replace('</section></section></main>', '</section>' + featuresHtml + '</section></main>');

fs.writeFileSync('src/template.ts', content);

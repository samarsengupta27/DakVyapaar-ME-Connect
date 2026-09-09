import "./styles.css";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "firebase/auth";
import { auth } from "./firebase.js";
import { getMyProfile, subscribeDashboard, subscribeCustomers, subscribeFollowUps, subscribeLeads, subscribeTargets,
  createLead, recordVisit, scheduleFollowUp, onboardCustomer, uploadBillingFile, createTarget } from "./services.js";

let profile=null, unsubscribers=[], dashboardData={billing:[],customers:[],followups:[],leads:[],targets:[]};

const app=document.querySelector("#app");

function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function money(n){return "₹"+Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:0});}
function pct(a,b){return b?((a/b)*100).toFixed(1):"0.0";}

function loginView(error=""){
app.innerHTML=`<div class="login"><div class="login-card">
<div class="logo">IP</div><h1>Dak Vyapaar</h1><p>ME Connect — Customer Relationship & Revenue Management System</p>
${error?`<div class="error">${esc(error)}</div>`:""}
<div class="field"><label>Email</label><input id="email" type="email" autocomplete="username"></div>
<div class="field"><label>Password</label><input id="password" type="password" autocomplete="current-password"></div>
<button class="btn primary" id="loginBtn" style="width:100%">Sign in</button>
<p class="notice" style="margin-top:14px">Firebase configuration and user provisioning are intentionally left to the department administrator.</p>
</div></div>`;
document.querySelector("#loginBtn").onclick=async()=>{
try{await signInWithEmailAndPassword(auth,document.querySelector("#email").value,document.querySelector("#password").value)}
catch(e){loginView(e.message)}
};
}

function shell(){
app.innerHTML=`<div class="app">
<aside class="sidebar"><div class="brand"><div class="logo">IP</div><div><b>Dak Vyapaar</b><small>ME Connect</small></div></div>
<nav class="nav">
<a class="active" data-page="dashboard"><span class="ico">⌂</span><span>Dashboard</span></a>
<a data-page="customers"><span class="ico">♟</span><span>Leads & Customers</span></a>
<a data-page="diary"><span class="ico">▣</span><span>Visits / Relationship Diary</span></a>
<a data-page="revenue"><span class="ico">▥</span><span>Revenue Achievement</span></a>
<a data-page="targets"><span class="ico">◎</span><span>Targets</span></a>
<a data-page="billing"><span class="ico">▤</span><span>Billing Upload</span></a>
<a data-page="reports"><span class="ico">▥</span><span>Reports & MIS</span></a>
<a data-page="sop"><span class="ico">▱</span><span>SOP / Help</span></a>
</nav></aside>
<main class="main"><header class="top"><div class="title"><h1>Dak Vyapaar</h1><p id="crumb">Loading profile…</p></div>
<div class="user"><div class="avatar">${esc((profile.name||"IP").split(" ").map(x=>x[0]).join("").slice(0,2))}</div><span>${esc(profile.name||"User")}</span><button class="btn secondary" id="logout">Sign out</button></div></header>
<section class="content" id="page"></section><footer class="footer"><span>Department of Posts · Ministry of Communications · Government of India</span><span>Production Firebase application</span></footer></main></div>`;
document.querySelector("#logout").onclick=()=>signOut(auth);
document.querySelectorAll(".nav a").forEach(a=>a.onclick=()=>navigate(a.dataset.page));
}

function navigate(page){document.querySelectorAll(".nav a").forEach(a=>a.classList.toggle("active",a.dataset.page===page)); if(page==="dashboard") renderDashboard(); else if(page==="customers") renderCustomers(); else if(page==="diary") renderDiary(); else if(page==="billing") renderBilling(); else if(page==="targets") renderTargets(); else if(page==="revenue") renderRevenue(); else if(page==="reports") renderReports(); else renderSOP();}

function startRealtime(){
unsubscribers.forEach(x=>x&&x());unsubscribers=[];
const period=document.querySelector("#period")?.value||"2026-08";
const err=e=>console.error(e);
unsubscribers.push(subscribeDashboard(profile,period,x=>{dashboardData.billing=x.billing||[];renderDashboard();},err));
unsubscribers.push(subscribeCustomers(profile,x=>{dashboardData.customers=x;renderDashboard();},err));
unsubscribers.push(subscribeLeads(profile,x=>{dashboardData.leads=x;renderDashboard();},err));
unsubscribers.push(subscribeTargets(profile,period,x=>{dashboardData.targets=x;renderDashboard();},err));
unsubscribers.push(subscribeFollowUps(profile,x=>{dashboardData.followups=x;renderDashboard();},err));
}

function renderDashboard(){
const p=profile, b=dashboardData.billing, c=dashboardData.customers, f=dashboardData.followups;
const achievement=b.reduce((s,x)=>s+Number(x.amount||0),0);
const target=dashboardData.targets.reduce((s,x)=>s+Number(x.targetAmount||0),0);
const active=c.filter(x=>x.status==="ACTIVE").length;
const newCustomers=c.filter(x=>x.createdPeriod==="2026-08").length;
document.querySelector("#crumb").textContent=`${p.circleName||p.circleId||""} › ${p.regionName||p.regionId||""} › ${p.divisionName||p.divisionId||""} › ${p.role}`;
document.querySelector("#page").innerHTML=`
<div class="filters"><div><label>Period</label><select id="period"><option value="2026-08">Aug 2026</option><option value="2026-07">Jul 2026</option><option value="2026-06">Jun 2026</option></select></div><div><label>Division</label><select><option>${esc(p.divisionName||"Current scope")}</option></select></div><div><label>ME</label><select><option>${esc(p.meName||"All permitted MEs")}</option></select></div><div><label>Product</label><select><option>All Products</option></select></div><button class="btn primary" id="apply">Apply</button><button class="btn secondary" id="reset">Reset</button></div>
<div class="kpis">
<div class="kpi"><div class="label">Revenue Target</div><div class="val">${money(target)}</div><div class="sub">Selected period</div></div>
<div class="kpi"><div class="label">Revenue Achieved</div><div class="val good">${money(achievement)}</div><div class="sub">Live billing records</div></div>
<div class="kpi"><div class="label">Achievement</div><div class="val ${Number(pct(achievement,target))>=80?"good":"warn"}">${pct(achievement,target)}%</div><div class="sub">${money(Math.max(0,target-achievement))} balance</div></div>
<div class="kpi"><div class="label">Active Customers</div><div class="val">${active}</div><div class="sub">Live customer master</div></div>
<div class="kpi"><div class="label">New Customers</div><div class="val">${newCustomers}</div><div class="sub">Selected month</div></div>
<div class="kpi"><div class="label">Follow-ups Due</div><div class="val bad">${f.length}</div><div class="sub">Live pending list</div></div>
<div class="kpi"><div class="label">Billing Records</div><div class="val">${b.length}</div><div class="sub">Selected month</div></div>
</div>
<div class="grid g3">
<div class="card"><div class="head"><h3>Revenue Target vs Achievement</h3><a>Live Firestore</a></div>
<div class="chart"><svg viewBox="0 0 620 220" preserveAspectRatio="none"><g stroke="#e9ecf1"><line x1="48" y1="30" x2="600" y2="30"/><line x1="48" y1="80" x2="600" y2="80"/><line x1="48" y1="130" x2="600" y2="130"/><line x1="48" y1="180" x2="600" y2="180"/></g><rect x="160" y="55" width="120" height="125" fill="#f2c7c9"/><rect x="190" y="${Math.max(55,180-Math.min(125,(achievement/target)*125))}" width="60" height="${Math.min(125,(achievement/target)*125)}" fill="#b51d28"/><text x="220" y="205" text-anchor="middle" font-size="12" fill="#667085">Selected Period</text><text x="220" y="45" text-anchor="middle" font-size="12" fill="#475467">${pct(achievement,target)}%</text></svg></div><div class="legend"><span><i class="dot" style="background:#f2c7c9"></i>Target</span><span><i class="dot" style="background:#b51d28"></i>Achievement</span></div></div>
<div class="card"><div class="head"><h3>Revenue by Product</h3><a>Live</a></div>${productBars(b)}</div>
<div class="card"><div class="head"><h3>Customer Funnel</h3><a>Leads</a></div><div class="funnel">${funnelHtml()}</div></div>
</div>
<div class="grid g2"><div class="card"><div class="head"><h3>Recent Billing / Revenue</h3><a>View all</a></div>${billingTable(b.slice(0,8))}</div><div class="card"><div class="head"><h3>Follow-ups Due</h3><a>View all</a></div>${followTable(f.slice(0,8))}</div></div>
<div class="grid g3"><div class="card"><div class="head"><h3>Customer Relationship Diary</h3><a>View all</a></div><ul class="timeline">${c.slice(0,5).map(x=>`<li><i class="t-dot"></i><div><div class="time">${x.lastVisitDate||"No visit date"}</div><b>${esc(x.name)}</b> · ${esc(x.status||"")}</div></li>`).join("")||"<li>No customers available.</li>"}</ul></div>
<div class="card"><div class="head"><h3>Billing Status</h3><a>Details</a></div><div class="status"><div><span>Advance</span><b>${b.filter(x=>x.billingType==="ADVANCE").length}</b></div><div><span>BNPL</span><b>${b.filter(x=>x.billingType==="BNPL").length}</b></div><div><span>Valid Amount</span><b class="good">${money(achievement)}</b></div><div><span>Pending Follow-ups</span><b class="bad">${f.length}</b></div></div></div>
<div class="card"><div class="head"><h3>Quick Actions</h3></div><div class="actions"><button class="action primary" id="newLead"><b>＋ New Lead</b><span>Add prospect</span></button><button class="action" id="visit"><b>▣ Record Visit</b><span>Relationship diary</span></button><button class="action" id="upload"><b>↥ Upload Billing</b><span>Monthly Excel</span></button><button class="action" id="target"><b>◎ Target</b><span>Review target</span></button></div></div></div>`;
document.querySelector("#apply").onclick=startRealtime;document.querySelector("#reset").onclick=()=>location.reload();
document.querySelector("#newLead").onclick=()=>leadModal();document.querySelector("#visit").onclick=()=>visitModal();document.querySelector("#upload").onclick=()=>billingModal();document.querySelector("#target").onclick=()=>targetModal();
}

function productBars(rows){const m={};rows.forEach(x=>m[x.product||"Other"]=(m[x.product||"Other"]||0)+Number(x.amount||0));const vals=Object.entries(m).sort((a,b)=>b[1]-a[1]);const max=vals[0]?.[1]||1;return vals.slice(0,6).map(([k,v])=>`<div class="barrow"><span>${esc(k)}</span><div class="barbg"><div class="bar" style="width:${(v/max)*100}%"></div></div><b>${money(v)}</b></div>`).join("")||"<p class='notice'>No billing data for this period.</p>";}
function funnelHtml(){return `<div class="fstep f1">${dashboardData.leads?.length||0}</div><div class="flabel">Approached</div><div class="fstep f2">${dashboardData.followups?.length||0}</div><div class="flabel">Follow-up</div><div class="fstep f3">${dashboardData.customers?.filter(x=>x.createdPeriod==="2026-08").length||0}</div><div class="flabel">Onboarded</div>`}
function billingTable(rows){return `<table><thead><tr><th>Customer</th><th>Product</th><th>Type</th><th>Amount</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.customerName||x.customerId)}</td><td>${esc(x.product||"")}</td><td>${esc(x.billingType||"")}</td><td>${money(x.amount)}</td></tr>`).join("")||"<tr><td colspan='4'>No records</td></tr>"}</tbody></table>`}
function followTable(rows){return `<table><thead><tr><th>Customer</th><th>Next Visit</th><th>Status</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.customerName||x.customerId)}</td><td>${esc(x.nextVisitDate||"")}</td><td><span class="pill">DUE</span></td></tr>`).join("")||"<tr><td colspan='3'>No pending follow-ups</td></tr>"}</tbody></table>`}

function modal(title,body,onSave){const el=document.createElement("div");el.className="modal";el.innerHTML=`<div class="modal-card"><div class="modal-head"><h3>${title}</h3><button>×</button></div>${body}</div>`;el.querySelector(".modal-head button").onclick=()=>el.remove();document.body.appendChild(el);el.querySelector("[data-save]")?.addEventListener("click",async()=>{try{await onSave(el);el.remove();alert("Saved successfully.");}catch(e){alert(e.message)}});}

function leadModal(){modal("New Lead",`<div class="form-grid"><div class="field"><label>Customer Name</label><input id="name"></div><div class="field"><label>Contact</label><input id="contact"></div><div class="field"><label>Customer Category</label><input id="category"></div><div class="field"><label>Customer Segment</label><input id="segment"></div><div class="field"><label>Current Courier</label><input id="courier"></div><div class="field"><label>Estimated Monthly Business</label><input id="potential" type="number"></div><div class="field full"><label>Products of Interest</label><input id="products" placeholder="Speed Post, India Post Parcel"></div><div class="field full"><label>Remarks</label><input id="remarks"></div></div><button class="btn primary" data-save>Create Lead</button>`,async el=>createLead(profile,{name:el.querySelector("#name").value,contact:el.querySelector("#contact").value,category:el.querySelector("#category").value,segment:el.querySelector("#segment").value,currentCourier:el.querySelector("#courier").value,potential:Number(el.querySelector("#potential").value||0),products:el.querySelector("#products").value.split(",").map(x=>x.trim()).filter(Boolean),remarks:el.querySelector("#remarks").value}));}
function visitModal(){modal("Record Customer Visit",`<div class="form-grid"><div class="field"><label>Customer ID</label><input id="cid" required></div><div class="field"><label>Interaction Type</label><select id="type"><option>PHYSICAL_VISIT</option><option>PHONE</option><option>EMAIL</option><option>MEETING</option></select></div><div class="field full"><label>Discussion / Feedback</label><input id="notes"></div><div class="field"><label>Next Visit Date</label><input id="next" type="date"></div><div class="field"><label>Action Required</label><input id="action"></div></div><button class="btn primary" data-save>Save Visit</button>`,async el=>recordVisit(profile,{customerId:el.querySelector("#cid").value,type:el.querySelector("#type").value,notes:el.querySelector("#notes").value,nextVisitDate:el.querySelector("#next").value,action:el.querySelector("#action").value}));}
function billingModal(){modal("Upload Monthly Billing",`<p class="notice">Upload the monthly Excel exported from the Billing Application. The browser validates the required columns and writes billing records directly to Firestore. Official Customer IDs are not generated here.</p><div class="field"><label>Billing Period</label><input id="period" value="2026-08"></div><div class="field"><label>Excel File</label><input id="file" type="file" accept=".xlsx,.xls,.csv"></div><button class="btn primary" data-save>Upload & Process</button>`,async el=>{const file=el.querySelector("#file").files[0];if(!file)throw new Error("Select a billing file.");return uploadBillingFile(profile,file,el.querySelector("#period")?.value || "2026-08")});}
function targetModal(){modal("Set / Review Target",`<div class="form-grid"><div class="field"><label>ME ID</label><input id="meId" value="${esc(profile.meId||"")}"></div><div class="field"><label>Period</label><input id="period" value="2026-08"></div><div class="field"><label>Product</label><input id="product" value="All Products"></div><div class="field"><label>Target Amount</label><input id="amount" type="number"></div></div><button class="btn primary" data-save>Save Target</button>`,async el=>createTarget(profile,{meId:el.querySelector("#meId").value,period:el.querySelector("#period").value,product:el.querySelector("#product").value,targetAmount:Number(el.querySelector("#amount").value||0)}));}


function onboardModal(){
modal("Onboard New Customer",`<div class="form-grid">
<div class="field"><label>Customer Name</label><input id="name" required></div>
<div class="field"><label>Contact</label><input id="contact"></div>
<div class="field"><label>Email</label><input id="email" type="email"></div>
<div class="field"><label>Customer Category</label><input id="category"></div>
<div class="field"><label>Customer Segment</label><input id="segment"></div>
<div class="field"><label>Billing Type</label><select id="billingType"><option>BNPL</option><option>ADVANCE</option></select></div>
<div class="field"><label>Nodal Billing Office ID</label><input id="nodal" value="${esc(profile.nodalOfficeId||"")}"></div>
<div class="field"><label>ME ID</label><input id="meId" value="${esc(profile.meId||"")}"></div>
<div class="field full"><label>Products</label><input id="products" placeholder="Speed Post, India Post Parcel"></div>
<div class="field full"><label>Address</label><input id="address"></div>
</div>
<div class="notice" style="margin:10px 0">Official Customer ID is assigned by the Billing Application. Dak Vyapaar will record it when supplied; it is not generated here.</div>
<button class="btn primary" data-save>Onboard Customer</button>`,async el=>{
const result=await onboardCustomer(profile,{
name:el.querySelector("#name").value,contact:el.querySelector("#contact").value,email:el.querySelector("#email").value,
category:el.querySelector("#category").value,segment:el.querySelector("#segment").value,
billingType:el.querySelector("#billingType").value,nodalOfficeId:el.querySelector("#nodal").value,
meId:el.querySelector("#meId").value,products:el.querySelector("#products").value.split(",").map(x=>x.trim()).filter(Boolean),
address:el.querySelector("#address").value
});
alert(`Customer onboarded. Status: ONBOARDING_PENDING. Official Customer ID will be supplied by the Billing Application.`);
});
}

function renderCustomers(){document.querySelector("#page").innerHTML=`<div class="card"><div class="head"><h3>Customers</h3><button class="btn primary" id="newC">New Customer</button></div><p class="notice">Official Customer IDs are assigned by the Billing Application. Dak Vyapaar does not generate Customer IDs.</p>${billingTable(dashboardData.customers.map(x=>({customerName:`${x.customerId} · ${x.name}`,product:(x.products||[]).join(", "),billingType:x.billingType,amount:0})))}</div>`;document.querySelector("#newC").onclick=()=>onboardModal();}
function renderDiary(){document.querySelector("#page").innerHTML=`<div class="card"><h3>Relationship Diary</h3><p class="notice">Use Record Visit from the dashboard. Each interaction is permanently associated with the ME and Customer ID and can be audited.</p></div>`}
function renderBilling(){document.querySelector("#page").innerHTML=`<div class="card"><h3>Billing Upload</h3><p class="notice">Nodal Billing Office users upload the monthly Excel. In the Spark-only version, the file is parsed in the browser and validated before Firestore write; Cloud Functions and Cloud Storage are not required.</p><button class="btn primary" id="up">Upload Excel</button></div>`;document.querySelector("#up").onclick=()=>billingModal();}
function renderTargets(){document.querySelector("#page").innerHTML=`<div class="card"><h3>Targets</h3><p class="notice">Targets are stored by period, ME and product. Use Set / Review Target from the dashboard.</p><button class="btn primary" id="tg">Set Target</button></div>`;document.querySelector("#tg").onclick=targetModal();}
function renderRevenue(){renderDashboard();}
function renderReports(){document.querySelector("#page").innerHTML=`<div class="card"><h3>Reports & MIS</h3><p class="notice">The dashboard is live from Firestore. Downloadable Excel and PDF reports will be generated within the application.</p></div>`}
function renderSOP(){document.querySelector("#page").innerHTML=`<div class="card"><h3>SOP / Help</h3><ol><li>Create or identify a lead.</li><li>Record every customer interaction.</li><li>Set the next visit when follow-up is required.</li><li>Onboard the customer; the customer remains ONBOARDING_PENDING until the Billing Application supplies the official Customer ID.</li><li>Nodal Billing Office uploads monthly billing.</li><li>Review target vs achievement and exceptions.</li></ol></div>`}

onAuthStateChanged(auth,async user=>{
if(!user){profile=null;loginView();return;}
try{profile=await getMyProfile(user.uid);shell();startRealtime();}
catch(e){await signOut(auth);loginView(e.message);}
});

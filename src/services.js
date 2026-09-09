import {
  collection, query, where, orderBy, limit, onSnapshot, addDoc, updateDoc,
  doc, getDoc, getDocs, serverTimestamp, writeBatch, setDoc
} from "firebase/firestore";
import { db } from "./firebase.js";

export async function getMyProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) throw new Error("User profile is not configured in Firestore.");
  return { id: snap.id, ...snap.data() };
}

function scopedQuery(profile, collectionName, sortField="createdAt", max=500) {
  const base = collection(db, collectionName);
  const r = profile.role;
  let q;
  if (r === "ME") q = query(base, where("meId","==",profile.meId), orderBy(sortField,"desc"), limit(max));
  else if (r === "NODAL") q = query(base, where("nodalOfficeId","==",profile.nodalOfficeId), orderBy(sortField,"desc"), limit(max));
  else if (r === "DO") q = query(base, where("divisionId","==",profile.divisionId), orderBy(sortField,"desc"), limit(max));
  else if (r === "RO") q = query(base, where("regionId","==",profile.regionId), orderBy(sortField,"desc"), limit(max));
  else q = query(base, where("circleId","==",profile.circleId), orderBy(sortField,"desc"), limit(max));
  return q;
}

export function subscribeDashboard(profile, period, callbacks) {
  const base = collection(db, "billingRecords");
  const r = profile.role;
  let q;
  if (r === "ME") q=query(base,where("meId","==",profile.meId),where("period","==",period),limit(500));
  else if (r === "NODAL") q=query(base,where("nodalOfficeId","==",profile.nodalOfficeId),where("period","==",period),limit(1000));
  else if (r === "DO") q=query(base,where("divisionId","==",profile.divisionId),where("period","==",period),limit(2000));
  else if (r === "RO") q=query(base,where("regionId","==",profile.regionId),where("period","==",period),limit(5000));
  else q=query(base,where("circleId","==",profile.circleId),where("period","==",period),limit(10000));
  return onSnapshot(q, snap => callbacks({billing:snap.docs.map(d=>({id:d.id,...d.data()}))}), callbacks.error);
}

export function subscribeCustomers(profile, callbacks) {
  return onSnapshot(scopedQuery(profile,"customers"), snap =>
    callbacks(snap.docs.map(d=>({id:d.id,...d.data()}))), callbacks.error);
}

export function subscribeLeads(profile, callbacks) {
  return onSnapshot(scopedQuery(profile,"leads"), snap =>
    callbacks(snap.docs.map(d=>({id:d.id,...d.data()}))), callbacks.error);
}

export function subscribeTargets(profile, period, callbacks) {
  const base=collection(db,"targets");
  let q;
  if(profile.role==="ME") q=query(base,where("meId","==",profile.meId),where("period","==",period),limit(100));
  else if(profile.role==="DO") q=query(base,where("divisionId","==",profile.divisionId),where("period","==",period),limit(500));
  else if(profile.role==="RO") q=query(base,where("regionId","==",profile.regionId),where("period","==",period),limit(1000));
  else q=query(base,where("circleId","==",profile.circleId),where("period","==",period),limit(2000));
  return onSnapshot(q, snap => callbacks(snap.docs.map(d=>({id:d.id,...d.data()}))), callbacks.error);
}

export function subscribeFollowUps(profile, callbacks) {
  const base=collection(db,"followUps");
  let q;
  if(profile.role==="ME") q=query(base,where("meId","==",profile.meId),where("status","==","DUE"),orderBy("nextVisitDate","asc"),limit(100));
  else if(profile.role==="DO") q=query(base,where("divisionId","==",profile.divisionId),where("status","==","DUE"),orderBy("nextVisitDate","asc"),limit(300));
  else if(profile.role==="RO") q=query(base,where("regionId","==",profile.regionId),where("status","==","DUE"),orderBy("nextVisitDate","asc"),limit(500));
  else q=query(base,where("circleId","==",profile.circleId),where("status","==","DUE"),orderBy("nextVisitDate","asc"),limit(1000));
  return onSnapshot(q,snap=>callbacks(snap.docs.map(d=>({id:d.id,...d.data()}))),callbacks.error);
}

export async function createLead(profile,payload) {
  return addDoc(collection(db,"leads"),{
    ...payload,circleId:profile.circleId,regionId:profile.regionId,divisionId:profile.divisionId,
    meId:profile.meId||null,createdBy:profile.id,status:"APPROACHED",
    createdAt:serverTimestamp(),updatedAt:serverTimestamp()
  });
}

export async function recordVisit(profile,payload) {
  return addDoc(collection(db,"visits"),{
    ...payload,circleId:profile.circleId,regionId:profile.regionId,divisionId:profile.divisionId,
    meId:profile.meId,createdBy:profile.id,createdAt:serverTimestamp()
  });
}

export async function scheduleFollowUp(profile,payload) {
  return addDoc(collection(db,"followUps"),{
    ...payload,circleId:profile.circleId,regionId:profile.regionId,divisionId:profile.divisionId,
    meId:profile.meId,status:"DUE",createdBy:profile.id,createdAt:serverTimestamp()
  });
}

/* Official Customer ID is NOT generated here. It is supplied by the Billing Application. */
export async function onboardCustomer(profile,payload) {
  const ref = doc(collection(db,"customers"));
  const data = {
    ...payload, customerId:null, customerIdSource:"BILLING_APPLICATION",
    status:"ONBOARDING_PENDING", circleId:profile.circleId,regionId:profile.regionId,
    divisionId:profile.divisionId,meId:profile.meId||null,
    createdBy:profile.id,createdAt:serverTimestamp(),updatedAt:serverTimestamp()
  };
  await setDoc(ref,data);
  return {id:ref.id,...data};
}

export async function createTarget(profile,payload) {
  if (!["ADMIN","CO","RO","DO"].includes(profile.role))
    throw new Error("Only ADMIN, CO, RO or DO users can set targets.");
  const id = `${payload.meId}_${payload.period}_${String(payload.product||"ALL").replace(/[^A-Za-z0-9_-]/g,"_")}`;
  await setDoc(doc(db,"targets",id),{
    ...payload,circleId:profile.circleId,regionId:profile.regionId,divisionId:profile.divisionId,
    updatedBy:profile.id,updatedAt:serverTimestamp()
  },{merge:true});
  return {id};
}

/* Browser-side Excel processing for Spark-only deployment. */
export async function uploadBillingFile(profile,file,period) {
  if (!["ADMIN","NODAL"].includes(profile.role))
    throw new Error("Only Nodal Office or ADMIN users can upload billing.");
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf,{type:"array"});
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet,{defval:""});
  if (!rows.length) throw new Error("The Excel file contains no rows.");

  const required = ["Customer ID","Bill Number","Amount","Product"];
  const keys = Object.keys(rows[0]);
  const missing = required.filter(x=>!keys.includes(x));
  if (missing.length) throw new Error("Missing required column(s): "+missing.join(", "));

  let written=0, skipped=0;
  const chunks=[];
  for(let i=0;i<rows.length;i+=400) chunks.push(rows.slice(i,i+400));

  for(const chunk of chunks){
    const batch=writeBatch(db);
    for(const row of chunk){
      const customerId=String(row["Customer ID"]).trim();
      const billNo=String(row["Bill Number"]).trim();
      const amount=Number(row["Amount"]||0);
      if(!customerId || !billNo || !Number.isFinite(amount)) { skipped++; continue; }
      const billingKey=`${customerId}_${billNo}_${period}`.replace(/[^A-Za-z0-9_-]/g,"_");
      const ref=doc(db,"billingRecords",billingKey);
      batch.set(ref,{
        customerId,billNumber:billNo,amount,product:String(row["Product"]).trim(),
        period,billingType:String(row["Billing Type"]||"").trim()||"ADVANCE",
        meId:String(row["ME ID"]||profile.meId||"").trim(),
        nodalOfficeId:String(row["Nodal Office ID"]||profile.nodalOfficeId||"").trim(),
        circleId:profile.circleId,regionId:profile.regionId,divisionId:profile.divisionId,
        uploadedBy:profile.id,uploadedAt:serverTimestamp(),billingKey
      },{merge:false});
      written++;
    }
    try { await batch.commit(); } catch(e) {
      throw new Error("Billing upload stopped. A duplicate or invalid record may exist. "+e.message);
    }
  }
  return {written,skipped};
}

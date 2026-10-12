import type { Page } from "@playwright/test";
import { workBookingsFixture, workBooking, bookingId } from "./work-bookings";
export { bookingId };
export const slotRecord = (n = 1) => {
  const booking = workBooking(n);
  return {id:bookingId(700+n), branchId:bookingId(101), serviceId:bookingId(100), staffId:bookingId(601), startsAt:`2027-01-01T${String(8+n).padStart(2,"0")}:00:00Z`, endsAt:`2027-01-01T${String(9+n).padStart(2,"0")}:00:00Z`, version:1, status:n===3?"CLOSED":"OPEN", service:booking.service, branch:booking.branch!, staff:booking.assignedStaff};
};
export async function workSlotsFixture(page: Page, role = "ADMIN") {
  const base = await workBookingsFixture(page,role);
  const service={...workBooking().service,isActive:true};
  const branch={id:bookingId(101),name:"Stadium Road workshop",code:"QA",isActive:true};
  const state={role,mode:"normal",profile:true,choicesMode:"normal",outcome:"success",records:[slotRecord(1),slotRecord(2),slotRecord(3),slotRecord(4),slotRecord(5)],reads:[] as URL[],writes:[] as {path:string;body:Record<string,unknown>}[],held:undefined as (()=>void)|undefined};
  await page.route("**/api/v1/**",async route=>{
    const url=new URL(route.request().url());const path=url.pathname.replace("/api/v1","");
    const ok=(data:unknown)=>route.fulfill({json:{success:true,data,message:"QA",meta:{requestId:"work-slots-qa"}}});
    const fail=(status:number,code:string)=>route.fulfill({status,json:{success:false,error:{code}}});
    if(path==="/auth/csrf")return ok({csrfToken:"slot-qa-csrf-token-".repeat(3)});
    if(path==="/staff/profile")return ok({id:bookingId(302),email:"workshop@example.test",role,status:"ACTIVE",capabilities:[],staffProfile:state.profile?{id:bookingId(601),firstName:"Ada",lastName:"Okoro",branchId:branch.id}:null});
    if(path.startsWith("/public/branches")){if(state.choicesMode==="error")return fail(503,"DATABASE_UNAVAILABLE");return ok(path===`/public/branches/${branch.id}`?branch:{items:[branch,{...branch,id:bookingId(102),name:"Other branch"}]})}
    if(["/public/services","/admin/services"].includes(path)){if(state.choicesMode==="error")return fail(503,"DATABASE_UNAVAILABLE");return ok({items:[service]})}
    if(path==="/staff/booking-slots" && route.request().method()==="GET"){
      state.reads.push(url);if(state.mode==="hold")await new Promise<void>(resolve=>{state.held=resolve});
      if(state.mode==="error")return fail(503,"DATABASE_UNAVAILABLE");if(state.mode==="denied")return fail(403,"FORBIDDEN");if(state.mode==="malformed")return ok({items:[{id:"invalid"}]});
      let items=state.mode==="empty"?[]:state.records;
      for(const key of ["status","branchId","serviceId","staffId"] as const){const value=url.searchParams.get(key);if(value)items=items.filter(item=>item[key]===value)}
      const from=url.searchParams.get("startsFrom"),to=url.searchParams.get("startsTo");if(from)items=items.filter(item=>Date.parse(item.startsAt)>=Date.parse(from));if(to)items=items.filter(item=>Date.parse(item.startsAt)<Date.parse(to));
      return ok(url.searchParams.has("cursor")?{items:items.slice(3)}:{items:items.slice(0,3),...(items.length>3?{nextCursor:items[2].id}:{})});
    }
    if(path.startsWith("/staff/booking-slots")&&["POST","PATCH"].includes(route.request().method())){
      const body=route.request().postDataJSON();state.writes.push({path,body});if(state.outcome==="conflict")return fail(409,"STALE_SERVICE_OPERATION");
      if(route.request().method()==="POST"){const item=slotRecord(10);item.startsAt=body.startsAt;item.endsAt=new Date(Date.parse(body.startsAt)+3600000).toISOString();state.records.unshift(item)}else{const item=state.records.find(item=>path.endsWith(item.id));if(item){item.status=body.status;item.version++}}
      if(state.outcome==="uncertain")return route.abort("failed");return ok({});
    }
    return route.fallback();
  });return{state,base};
}

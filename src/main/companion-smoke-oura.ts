import {addCalendarDays} from '../shared/companion-calendar';
import type {OuraResource} from '../shared/companion-oura';

export function createSmokeOura(){
 const state={synced:false,requests:[] as OuraResource[],authorizationError:''};
 const dependencies={demo:true,interval:1250,
  authorize:async()=>{
   if(state.authorizationError)throw Error(state.authorizationError);
   return{accessToken:'oura-fixture-token',expiresAt:Date.now()+3600_000};
  },
  read:async(resource:OuraResource,_start:string,end:string)=>{
   state.requests.push(resource);
   const today=addCalendarDays(end,-1),prior=addCalendarDays(today,-1);
   const night=(day:string,seconds:number,type='long_sleep')=>({day,bedtime_end:day+'T07:30:00+01:00',type,total_sleep_duration:seconds});
   if(resource==='sleep')return [night(prior,25_200),night(today,1200,'late_nap'),...(state.synced?[night(today,27_120)]:[])];
   if(resource==='daily_sleep')return [{day:prior,score:80},...(state.synced?[{day:today,score:88}]:[])];
   if(resource==='daily_readiness')return [{day:today,score:84}];
   return [{day:today,steps:920,score:76}];
  },
 };
 return {state,dependencies};
}

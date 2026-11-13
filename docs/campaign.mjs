import {validDate,localToday} from './tracker.mjs';
import {batchProgress} from './batch.mjs';
// Submission dates survive later rejections and interviews. Outcome dates are not submissions.
export function dailyProgress(records,target=50,date=localToday()){
 if(!validDate(date))throw Error('Invalid campaign date');
 let applied=0;
 for(const record of Object.values(records)){
  if(!record.application_snapshot||record.status==='Delivery failed')continue;
  const history=record.history||[],lastFailure=history.map(e=>e.to).lastIndexOf('Delivery failed');
  const dates=history.slice(lastFailure+1).filter(e=>e.to==='Applied'&&validDate(e.event_date)).map(e=>e.event_date).sort();
  const submitted=dates[0]||(record.status==='Applied'&&validDate(record.event_date)?record.event_date:null);
  if(submitted===date)applied++;
 }
 return {date,applied,target,remaining:Math.max(0,target-applied),lifetime:batchProgress(records,target).applied};
}

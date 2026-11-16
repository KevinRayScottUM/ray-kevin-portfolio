import {StudioError} from './security.js';
export const VISITOR_LIMIT=3,GLOBAL_BUDGET=1000,RESERVATION=40;
export const utcDay=now=>new Date(now).toISOString().slice(0,10);
export async function reserve(db,{id,visitor,hash,day=utcDay(Date.now())}){
  // One conditional SQLite INSERT is the reservation transaction: both scopes are checked
  // in the same write statement. Pending and failed attempts remain charged conservatively.
  const result=await db.prepare(`INSERT INTO studio_reservations(id,visitor,day,input_hash,units,state)
    SELECT ?1,?2,?3,?4,?5,'reserved'
    WHERE NOT EXISTS(SELECT 1 FROM studio_reservations WHERE id=?1)
    AND (SELECT count(*) FROM studio_reservations WHERE day=?3 AND visitor=?2)< ?6
    AND COALESCE((SELECT sum(units) FROM studio_reservations WHERE day=?3),0)+?5<=?7
    RETURNING id`).bind(id,visitor,day,hash,RESERVATION,VISITOR_LIMIT,GLOBAL_BUDGET).first();
  if(!result){const existing=await db.prepare('SELECT visitor,input_hash FROM studio_reservations WHERE id=?1').bind(id).first();if(existing)throw new StudioError(existing.visitor===visitor&&existing.input_hash===hash?'duplicate':'idempotency',409);throw new StudioError('quota',429);}return id;
}
export async function settle(db,id,state){await db.prepare('UPDATE studio_reservations SET state=?1 WHERE id=?2 AND state=\'reserved\'').bind(state,id).run();}
export async function remaining(db,visitor){const row=await db.prepare('SELECT count(*) AS count FROM studio_reservations WHERE day=?1 AND visitor=?2').bind(utcDay(Date.now()),visitor).first();return Math.max(0,VISITOR_LIMIT-(row?.count||0));}
export async function reserveUpload(db,visitor,id){
  const result=await db.prepare(`INSERT INTO studio_upload_limits(id,visitor,day)
    SELECT ?1,?2,?3 WHERE NOT EXISTS(SELECT 1 FROM studio_upload_limits WHERE id=?1)
    AND (SELECT count(*) FROM studio_upload_limits WHERE day=?3 AND visitor=?2)<20
    AND (SELECT count(*) FROM studio_upload_limits WHERE day=?3)<200 RETURNING id`).bind(id,visitor,utcDay(Date.now())).first();
  if(!result)throw new StudioError('quota',429);
}

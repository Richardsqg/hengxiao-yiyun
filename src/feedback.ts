import { database, json, allowSubmission } from './storage.mjs';
import { validateFeedback, sameOrigin } from './validation.mjs';
export async function POST(request: Request) {
 if(!sameOrigin(request))return json({error:'请从展馆页面提交。'},403);
 if(Number(request.headers.get('content-length')||0)>16000)return json({error:'内容过长。'},413);
 let input;try { const raw=await request.text();if(raw.length>16000)throw new Error('内容过长。'); input=validateFeedback(JSON.parse(raw)); } catch(e){return json({error:e instanceof Error?e.message:'请检查填写内容。'},400);}
 try { const db=database();if(await db.prepare('SELECT id FROM feedback WHERE id=?').bind(input.id).first())return json({ok:true,id:input.id});
 if(!await allowSubmission(request))return json({error:'当前网络提交较多，请10分钟后再试。'},429);
 await db.prepare('INSERT OR IGNORE INTO feedback (id,created_at,nickname,rating,favorite,topics,message,status) VALUES (?,?,?,?,?,?,?,?)').bind(input.id,new Date().toISOString(),input.nickname,input.rating,input.favorite,JSON.stringify(input.topics),input.message,'unread').run();return json({ok:true,id:input.id});
 } catch {return json({error:'暂时无法保存，您填写的内容已保留在页面，请稍后重试。'},503);}
}

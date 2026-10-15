import { database, bucket, isAdmin, json, gallery, saveSetting } from './storage.mjs';
import { sameOrigin, FAVORITES, TOPICS } from './validation.mjs';
import { createWorkbook } from './xlsx.mjs';
export async function GET(request:Request){
 if(!isAdmin(request))return json({error:'管理员登录已过期，请重新登录。'},401);
 try{
 const db=database();const query=new URL(request.url).searchParams;const q=(query.get('q')||'').slice(0,100);const status=query.get('status')||'';
 const clauses:string[]=[];const args:string[]=[];if(q){clauses.push('(nickname LIKE ? OR message LIKE ?)');args.push('%'+q+'%','%'+q+'%');}if(['unread','reviewed'].includes(status)){clauses.push('status=?');args.push(status);}const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
 const count=await db.prepare('SELECT COUNT(*) AS total FROM feedback'+where).bind(...args).first<{total:number}>();
 const stats=await db.prepare("SELECT COUNT(*) AS total, AVG(rating) AS average, SUM(CASE WHEN rating=5 THEN 1 ELSE 0 END) AS excellent, SUM(CASE WHEN status='unread' THEN 1 ELSE 0 END) AS unread FROM feedback").first();
 const favorites=(await db.prepare("SELECT CASE WHEN favorite='广彩与珐琅' THEN '文化寻根' ELSE favorite END AS favorite,COUNT(*) AS count FROM feedback GROUP BY CASE WHEN favorite='广彩与珐琅' THEN '文化寻根' ELSE favorite END").all()).results;
 const ratings=(await db.prepare('SELECT rating,COUNT(*) AS count FROM feedback GROUP BY rating').all()).results;
 const topicRows=(await db.prepare('SELECT topics FROM feedback').all<{topics:string}>()).results;
 const topicCounts=TOPICS.map(t=>({topic:t,count:topicRows.filter(r=>{try{return JSON.parse(r.topics).includes(t)}catch{return false}}).length}));
 const page=Math.max(1,Number(query.get('page'))||1);const exporting=query.get('export')==='xlsx';const limit=exporting?20000:40;
 const rows=(await db.prepare('SELECT * FROM feedback'+where+' ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(...args,limit,exporting?0:(page-1)*40).all()).results;
 if(exporting){const bytes=createWorkbook([
 {name:'观展留言',rows:[['编号','提交时间（北京时间）','昵称','体验评分','最喜欢展区','想了解的内容','观展留言','处理状态'],...rows.map((r:any)=>[r.id,new Date(r.created_at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}),r.nickname,r.rating,r.favorite,JSON.parse(r.topics).join('、'),r.message,r.status==='reviewed'?'已阅':'未读'])]},
 {name:'问卷统计',rows:[['统计项目','数值'],['统计范围','所有已提交问卷'],['总问卷数',stats?.total],['平均评分',Number(Number(stats?.average||0).toFixed(2))],['五星评价',stats?.excellent||0],['未读留言',stats?.unread||0],...FAVORITES.map(f=>[f,(favorites.find((r:any)=>r.favorite===f) as any)?.count||0]),...ratings.map((r:any)=>[r.rating+'星',r.count]),...topicCounts.map(r=>['想了解：'+r.topic,r.count]),['留言导出范围',q||status?'当前筛选结果':'全部留言'],['本次导出条数',rows.length],['单次导出上限',20000]]}]);
 return new Response(bytes,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':"attachment; filename=visitor-feedback.xlsx; filename*=UTF-8''"+encodeURIComponent('琴小匠彩_观展留言_'+new Date().toISOString().slice(0,10)+'.xlsx'),'Cache-Control':'no-store'}});}
 return json({rows,count:count?.total||0,page,stats,favorites,ratings,topicCounts,...await gallery()});
 }catch{return json({error:'后台数据暂时无法读取，请稍后重试。'},503);}
}
export async function POST(request:Request){
 if(!isAdmin(request))return json({error:'管理员身份验证失败。'},401);if(!sameOrigin(request))return json({error:'请求来源不正确。'},403);
 try{
 const query=new URL(request.url).searchParams;const action=query.get('action');
 if(action==='frame'){
 const type=request.headers.get('content-type')||'';const ext=type==='image/jpeg'?'jpg':type==='image/png'?'png':type==='image/webp'?'webp':null;if(!ext)return json({error:'仅支持 JPG、PNG、WebP 图片。'},400);
 if(Number(request.headers.get('content-length')||0)>8*1024*1024)return json({error:'每张图片不能超过8MB。'},413);const bytes=await request.arrayBuffer();if(bytes.byteLength>8*1024*1024)return json({error:'每张图片不能超过8MB。'},413);
 const b=new Uint8Array(bytes);const valid=ext==='jpg'?b[0]===255&&b[1]===216:ext==='png'?b[0]===137&&b[1]===80:new TextDecoder().decode(b.slice(8,12))==='WEBP';if(!valid)return json({error:'图片格式无法识别。'},400);
 const key='frames/'+crypto.randomUUID()+'.'+ext;await bucket().put(key,bytes,{httpMetadata:{contentType:type}});return json({url:'/api/media/'+key});}
 if(action==='video-part'){
 const key=query.get('key')||'',id=query.get('id')||'',part=Number(query.get('part'));if(!/^videos\/[a-zA-Z0-9-]+\.mp4$/.test(key)||!id||!Number.isInteger(part)||part<1||part>64)return json({error:'上传参数无效。'},400);
 if(Number(request.headers.get('content-length')||0)>9*1024*1024)return json({error:'上传片段过大。'},413);const bytes=await request.arrayBuffer();if(bytes.byteLength>9*1024*1024)return json({error:'上传片段过大。'},413);return json(await bucket().resumeMultipartUpload(key,id).uploadPart(part,bytes));}
 const raw=await request.text();if(raw.length>50000)return json({error:'提交内容过长。'},413);const input=JSON.parse(raw);
 if(action==='delete-feedback'){if(typeof input.id!=='string'||!/^[a-zA-Z0-9-]{20,64}$/.test(input.id))return json({error:'留言编号无效'},400);const row=await database().prepare('SELECT id FROM feedback WHERE id=?').bind(input.id).first();if(!row)return json({error:'留言不存在或已删除'},404);await database().prepare('DELETE FROM feedback WHERE id=?').bind(input.id).run();return json({ok:true});}
 if(action==='review'){if(!['unread','reviewed'].includes(input.status))return json({error:'状态无效'},400);await database().prepare('UPDATE feedback SET status=? WHERE id=?').bind(input.status,input.id).run();return json({ok:true});}
 if(action==='frames'){
 const slot=input.slot??1;if(!Number.isInteger(slot)||slot<1||slot>8)return json({error:'展位无效'},400);
 if(!Array.isArray(input.frames)||input.frames.length<24||input.frames.length>120||input.frames.some((v:any)=>typeof v!=='string'||!/^\/api\/media\/frames\/[a-zA-Z0-9-]+\.(jpg|png|webp)$/.test(v)))return json({error:'请上传按环绕顺序排列的24至120张照片。'},400);
 for(const url of input.frames){if(!await bucket().head(url.replace('/api/media/','')))return json({error:'部分照片未上传成功，请重试。'},400);}await saveSetting('crown-frames-'+slot,input.frames);if(slot===1)await saveSetting('frames',input.frames);return json({ok:true});}
 if(action==='video-begin'){if(!Number.isFinite(input.size)||input.size<=0||input.size>400*1024*1024)return json({error:'视频需小于400MB。'},400);const key='videos/'+crypto.randomUUID()+'.mp4';const upload=await bucket().createMultipartUpload(key,{httpMetadata:{contentType:'video/mp4'},expectedSize:input.size});return json({key,uploadId:upload.uploadId});}
 if(action==='video-complete'){
 if(![1,2,3].includes(input.slot)||!/^videos\/[a-zA-Z0-9-]+\.mp4$/.test(input.key)||!Array.isArray(input.parts)||input.parts.length>50||!input.parts.length)return json({error:'上传参数无效'},400);
 await bucket().resumeMultipartUpload(input.key,input.uploadId).complete(input.parts);const previous=(await gallery()).videos.find((v:any)=>v.slot===input.slot);const value={hidden:previous?.hidden||false,captions:'',slot:input.slot,title:String(input.title||'展馆影像').slice(0,60),description:String(input.description||'').slice(0,300),url:'/api/media/'+input.key,poster:previous?.poster||'/assets/film-poster.jpg'};await saveSetting('video-'+input.slot,value);return json({ok:true});}
 if(action==='video-abort'){if(!/^videos\/[a-zA-Z0-9-]+\.mp4$/.test(input.key))return json({error:'参数无效'},400);await bucket().resumeMultipartUpload(input.key,input.uploadId).abort();return json({ok:true});}
 return json({error:'操作不存在'},400);
 }catch{return json({error:'操作未完成，请检查网络后重试。'},503);}
}

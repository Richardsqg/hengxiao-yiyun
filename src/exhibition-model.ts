import initial from './exhibition.json';
export const initialDocument:any=initial;
export function normalizeDocument(doc:any){return {...initial,...doc,title:!doc?.title||['凤华 · 匠彩','琴小匠彩','琴小匠'].includes(doc.title)?initial.title:doc.title,courses:initial.courses.map((base:any)=>({...base,...doc?.courses?.find((course:any)=>course.id===base.id)})),crowns:doc?.crowns||initial.crowns};}
export async function validateExhibition(input:any,checkImage:(url:string)=>Promise<unknown>){
 if(!input||typeof input!=='object')throw new Error('内容格式不正确');
 const images=new Set<string>();
 function walk(value:any,base:any,key:string):any{
  if(typeof base==='string'){
   const max=['intro','curriculumSummary','text','definition','goals'].includes(key)?2400:key==='title'?120:600;
   if(typeof value!=='string'||value.length>max)throw new Error('文字未填写完整或超过长度限制');
   if(key==='src'||key==='image'){if(!/^\/assets\/[a-zA-Z0-9_-]+\.(webp|jpg|png)$/.test(value)&&!/^\/api\/media\/frames\/[a-f0-9-]+\.(webp|jpg|png)$/.test(value))throw new Error('请选择站内图片');images.add(value)}
   if(key==='sourceUrl'&&value&&!/^https:\/\//.test(value))throw new Error('来源链接必须使用 HTTPS');
   return value.trim();
  }
  if(Array.isArray(base)){
   if(!Array.isArray(value))throw new Error('内容列表不完整');
   if(key==='images'){if(value.length>12)throw new Error('每个展位最多12张鉴赏照片');return value.map(v=>walk(v,'','src'))}
   if(value.length!==base.length)throw new Error('课程结构不完整');return value.map((v,i)=>walk(v,base[i],key));
  }
  if(typeof base==='object'&&base){if(!value||typeof value!=='object')throw new Error('内容不完整');const result:any={};for(const k of Object.keys(base))result[k]=['id','slot'].includes(k)?base[k]:walk(value[k],base[k],k);return result}
  if(typeof value!==typeof base)throw new Error('选项无效');return value;
 }
 const doc=normalizeDocument(input);if(!doc.title.trim()||doc.title.length>6)throw new Error('展馆名称请控制在1至6个字');
 for(const date of [doc.startDate,doc.endDate])if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))throw new Error('展期日期无效');
 if(doc.startDate&&doc.endDate&&doc.startDate>doc.endDate)throw new Error('结束日期不能早于开始日期');
 const result=walk({...doc,videos:initial.videos,sources:initial.sources},initial,'document');
 for(const image of images)await checkImage(image);
 return result;
}

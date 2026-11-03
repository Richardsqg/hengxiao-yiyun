// Served as an external script so the existing strict CSP remains intact.
export const networkCheckScript = `(() => {
 const button=document.getElementById('run-check'),output=document.getElementById('check-result');
 if(!button||!output)return;
 if(location.protocol==='file:'){button.disabled=true;output.textContent='请先点击“打开网页连接自检”，不要在本地HTML文件中运行。';return;}
 async function get(path,range){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000),start=performance.now();
  try{const r=await fetch(path,{cache:'no-store',signal:controller.signal,headers:range?{Range:'bytes=0-65535'}:{}});
   if(!r.ok||(range&&r.status!==206)){await r.body?.cancel();throw new Error('HTTP '+r.status+(range?'，视频应返回206分段响应':''));}
   const bytes=await r.arrayBuffer();return {bytes,ms:Math.round(performance.now()-start),type:r.headers.get('content-type'),range:r.headers.get('content-range')};
  }finally{clearTimeout(timer);}
 }
 button.addEventListener('click',async()=>{
  button.disabled=true;output.textContent='正在检查，请稍候…';const lines=[];
  const show=()=>{output.textContent=lines.join('\\n');};
  try{
   const health=await get('/api/health');const h=JSON.parse(new TextDecoder().decode(health.bytes));if(h.ok!==true)throw new Error('健康接口响应不正确');
   lines.push('服务连接：正常（'+health.ms+'毫秒）');show();
   const response=await get('/api/gallery');const catalog=JSON.parse(new TextDecoder().decode(response.bytes));
   lines.push('展馆资料：正常');show();
   const image=catalog.crownFrames?.['1']?.[0]||catalog.frames?.[0]||'/assets/crown-front.webp';
   try{const r=await get(image);if(!r.type?.startsWith('image/'))throw new Error('返回的不是图片');lines.push('图片读取：正常，'+r.bytes.byteLength+'字节 / '+r.ms+'毫秒');}
   catch(e){lines.push('图片读取失败：'+e.message);}show();
   const video=catalog.videos?.find(v=>v.url&&!v.hidden);
   if(video){try{const r=await get(video.url,true);if(!r.type?.startsWith('video/')||!r.range?.startsWith('bytes '))throw new Error('视频响应类型或分段头不正确');lines.push('视频分段：正常，'+r.bytes.byteLength+'字节 / '+r.ms+'毫秒');}catch(e){lines.push('视频读取失败：'+e.message);}}
   else lines.push('暂无开放的影片。');
   lines.push('本检查不代表多人播放流畅。若仍慢，请检查无线信号、电脑网线和网段隔离。');show();
  }catch(e){lines.push('连接检查失败：'+(e.name==='AbortError'?'12秒内未能完成读取':e.message),'请确认电脑开机、不休眠、服务窗口开启，手机所在楼层允许访问当前电脑IP和端口。');show();}
  finally{button.disabled=false;}
 });
})();`;

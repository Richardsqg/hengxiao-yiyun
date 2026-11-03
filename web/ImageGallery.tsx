'use client';
import { useRef, useState } from 'react';
import { Maximize2, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import Modal from './Modal';
import ZoomStage from './ZoomStage';
export type Picture={src:string;alt:string;title:string;note:string;sourceUrl?:string;licenseUrl?:string};
export default function ImageGallery({images,label,kind='museum'}:{images:Picture[];label:string;kind?:'museum'|'classroom'}) {
  const rail=useRef<HTMLDivElement>(null),gesture=useRef({x:0,y:0,moved:false});
  const [full,setFull]=useState<number|null>(null),[edges,setEdges]=useState({start:true,end:false}),[retries,setRetries]=useState<Record<string,number>>({}),[failed,setFailed]=useState<Record<string,boolean>>({});
  const retry=(src:string)=>{setFailed(current=>({...current,[src]:false}));setRetries(current=>({...current,[src]:(current[src]||0)+1}));};
  const item=full===null?null:images[full];
  function scroll(direction:number){const el=rail.current;if(!el)return;const cards=el.querySelectorAll<HTMLElement>('.rail-card');const step=cards.length>1?cards[1].offsetLeft-cards[0].offsetLeft:el.clientWidth;el.scrollBy({left:step*direction,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}
  function changeFull(direction:number){setFull(i=>i===null?null:(i+direction+images.length)%images.length)}
  return <div className={'picture-gallery gallery-'+kind}>
    <div className="gallery-rail-heading"><span>{label}</span><span>左右滑动 · 点击细览 <ArrowRight size={14}/></span></div>
    <div className="image-rail" ref={rail} role="region" aria-label={label+'横向图片列表'} tabIndex={0} onScroll={e=>{const el=e.currentTarget;setEdges({start:el.scrollLeft<2,end:el.scrollLeft+el.clientWidth>=el.scrollWidth-2})}} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();scroll(e.key==='ArrowRight'?1:-1)}}} onPointerDown={e=>{gesture.current={x:e.clientX,y:e.clientY,moved:false}}} onPointerMove={e=>{if(Math.hypot(e.clientX-gesture.current.x,e.clientY-gesture.current.y)>8)gesture.current.moved=true}} onPointerCancel={()=>{gesture.current.moved=true}}>
      {images.map((picture,index)=><figure className="rail-card" key={picture.src+index}><button className="rail-picture" aria-label={(failed[picture.src]?'重试图片：':'放大查看：')+picture.title} onClick={e=>{if(e.detail===0||!gesture.current.moved){if(failed[picture.src])retry(picture.src);else setFull(index)}}}><img src={picture.src+(retries[picture.src]?'?image_retry='+retries[picture.src]:'')} alt={picture.alt} loading="lazy" decoding="async" draggable={false} onError={()=>{if(!retries[picture.src])retry(picture.src);else setFailed(current=>({...current,[picture.src]:true}));}}/>{failed[picture.src]?<span className="rail-retry">图片未载入 · 点击重试</span>:<span className="rail-expand"><Maximize2 size={14}/></span>}</button><figcaption><span className="rail-number">{String(index+1).padStart(2,'0')}</span><strong>{picture.title}</strong></figcaption></figure>)}
    </div>
    <div className="rail-navigation"><span>{images.length} 幅{kind==='museum'?'文化影像':'课堂记录'}</span><div className="picture-arrows"><button disabled={edges.start} onClick={()=>scroll(-1)} aria-label={label+'向右滑动'}><ChevronLeft/></button><button disabled={edges.end} onClick={()=>scroll(1)} aria-label={label+'向左滑动'}><ChevronRight/></button></div></div>
    {item&&full!==null&&<Modal title={item.title} onClose={()=>setFull(null)}><ZoomStage key={item.src+full} sources={[item.src]} alt={item.alt} large/><div className="lightbox-caption"><p>{item.note}</p>{item.sourceUrl&&<a href={item.sourceUrl} target="_blank" rel="noreferrer">图片来源 ↗</a>}{item.licenseUrl&&<a href={item.licenseUrl} target="_blank" rel="noreferrer" style={{marginLeft:16}}>图片使用许可 ↗</a>}<div className="picture-arrows"><button aria-label="上一张大图" onClick={()=>changeFull(-1)}><ChevronLeft/></button><span>{full+1} / {images.length}</span><button aria-label="下一张大图" onClick={()=>changeFull(1)}><ChevronRight/></button></div></div></Modal>}
  </div>;
}

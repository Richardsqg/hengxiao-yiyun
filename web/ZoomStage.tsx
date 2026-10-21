'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Minus, RotateCcw, Maximize2, Pause, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import Modal from './Modal';
import { Bounds, Point, Transform, identity, constrain, pinchAt, zoomAt } from './zoom-geometry';

export default function ZoomStage({sources,spin=false,alt,large=false}:{sources:string[];spin?:boolean;alt:string;large?:boolean}) {
  const [index,setIndex]=useState(0),[view,setView]=useState<Transform>(identity),[auto,setAuto]=useState(false),[full,setFull]=useState(false),[ready,setReady]=useState(false),[failed,setFailed]=useState(false),[dragMode,setDragMode]=useState<'rotate'|'pan'>('rotate');
  const rotateDrag=spin&&(view.scale<=1||dragMode==='rotate');
  const stage=useRef<HTMLDivElement>(null),picture=useRef<HTMLImageElement>(null),transform=useRef<Transform>(identity);
  const pointers=useRef(new Map<number,Point>()),single=useRef<Point>({x:0,y:0}),pinch=useRef<{view:Transform;a:Point;b:Point}|null>(null),hadPinch=useRef(false);
  const bounds=useRef<Bounds>({width:1,height:1,imageWidth:1,imageHeight:1});
  const apply=useCallback((next:Transform)=>{transform.current=next;setView(next)},[]);
  const measure=useCallback(()=>{const box=stage.current,img=picture.current;if(!box||!img?.naturalWidth)return;const width=box.clientWidth,height=box.clientHeight,ratio=Math.min(width*.95/img.naturalWidth,height*.95/img.naturalHeight);bounds.current={width,height,imageWidth:img.naturalWidth*ratio,imageHeight:img.naturalHeight*ratio};apply(constrain(transform.current,bounds.current))},[apply]);
  const reset=()=>{apply({...identity});setAuto(false);setDragMode('rotate')};
  const change=(i:number)=>{setIndex((i+sources.length)%sources.length);setAuto(false);if(!spin)reset()};
  const zoom=(scale:number,anchor:Point={x:0,y:0})=>{setAuto(false);apply(zoomAt(transform.current,scale,anchor,bounds.current))};
  const choosePan=()=>{
    setDragMode('pan');setAuto(false);
    if(transform.current.scale<=1){
      // Start with useful movement in both directions, including a wide desktop stage.
      measure();
      const b=bounds.current,scale=picture.current?.naturalWidth?Math.max(1.5,(b.width+80)/b.imageWidth,(b.height+80)/b.imageHeight):1.5;
      zoom(Math.ceil(scale*4)/4);
    }
  };
  const local=(x:number,y:number):Point=>{const r=stage.current!.getBoundingClientRect();return {x:x-r.left-r.width/2,y:y-r.top-r.height/2}};
  useEffect(()=>{const el=stage.current;if(!el)return;const observer=new ResizeObserver(measure);observer.observe(el);return()=>observer.disconnect()},[measure]);
  useEffect(()=>{const el=stage.current;if(!el)return;const wheel=(e:WheelEvent)=>{e.preventDefault();const rect=el.getBoundingClientRect();const anchor={x:e.clientX-rect.left-rect.width/2,y:e.clientY-rect.top-rect.height/2};setAuto(false);apply(zoomAt(transform.current,transform.current.scale*Math.exp(-e.deltaY*.002),anchor,bounds.current))};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel)},[apply]);
  useEffect(()=>{setReady(false);setFailed(false);if(!spin)return;let cancelled=false,next=0;const load=async()=>{while(next<sources.length&&!cancelled){const src=sources[next++];await new Promise<void>(resolve=>{const img=new Image();img.onload=()=>resolve();img.onerror=()=>{if(!cancelled)setFailed(true);resolve()};img.src=src})}};Promise.all(Array.from({length:4},load)).then(()=>{if(!cancelled)setReady(true)});return()=>{cancelled=true}},[sources,spin]);
  useEffect(()=>{if(!auto||!spin||!ready||failed)return;const timer=setInterval(()=>setIndex(i=>(i+1)%sources.length),120);return()=>clearInterval(timer)},[auto,spin,ready,failed,sources.length]);
  function down(e:React.PointerEvent<HTMLDivElement>) {
    if(e.pointerType==='mouse'&&e.button!==0)return;
    if(pointers.current.size>=2)return;
    e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);setAuto(false);
    const point=local(e.clientX,e.clientY);pointers.current.set(e.pointerId,point);
    if(pointers.current.size===1){single.current=point;hadPinch.current=false}
    if(pointers.current.size===2){const [a,b]=[...pointers.current.values()];pinch.current={view:{...transform.current},a:{...a},b:{...b}};hadPinch.current=true}
  }
  function move(e:React.PointerEvent<HTMLDivElement>) {
    if(!pointers.current.has(e.pointerId))return;e.preventDefault();
    const point=local(e.clientX,e.clientY);pointers.current.set(e.pointerId,point);
    const [a,b]=[...pointers.current.values()];
    if(b&&pinch.current){const start=pinch.current;apply(pinchAt(start.view,start.a,start.b,a,b,bounds.current));return}
    // After lifting one pinch finger, wait for both fingers to release. This avoids jumps or accidental spin.
    if(hadPinch.current)return;
    const dx=point.x-single.current.x,dy=point.y-single.current.y;
    if(rotateDrag){if(Math.abs(dx)>=7){const steps=Math.trunc(dx/7);setIndex(i=>(i+steps%sources.length+sources.length)%sources.length);single.current=point}}
    else if(transform.current.scale>1){apply(constrain({...transform.current,x:transform.current.x+dx,y:transform.current.y+dy},bounds.current));single.current=point}
  }
  function up(e:React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);if(pointers.current.size<2)pinch.current=null;
    if(pointers.current.size===0)hadPinch.current=false;
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  }
  return <div className={'zoom-viewer '+(large?'is-large':'')}>
    <div className="zoom-stage" ref={stage} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} tabIndex={0} onKeyDown={e=>{if(e.key==='+'||e.key==='='){e.preventDefault();zoom(transform.current.scale+.25)}if(e.key==='-'){e.preventDefault();zoom(transform.current.scale-.25)}if(e.key==='0')reset();if(spin&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();change(index+(e.key==='ArrowRight'?1:-1))}}} role="group" aria-label={alt+(spin?'，双指缩放，放大后仍可拖动旋转，可切换平移':'，双指以触点中心缩放，放大后可拖动')}>
      <img ref={picture} src={sources[index]||sources[0]} alt={alt} draggable={false} onLoad={measure} onError={()=>setFailed(true)} style={{transform:`translate3d(${view.x}px,${view.y}px,0) scale(${view.scale})`}}/>
    </div>
    <div className="compact-tools"><span className="view-mode">{spin?'360° 环绕实拍':sources.length>1?'多角度照片':'图片细览'}</span><div><button onClick={()=>zoom(transform.current.scale-.25)} disabled={view.scale<=1} aria-label="缩小"><Minus size={18}/></button><span>{Math.round(view.scale*100)}%</span><button onClick={()=>zoom(transform.current.scale+.25)} disabled={view.scale>=6} aria-label="放大"><Plus size={18}/></button><button onClick={reset} aria-label="重置视角"><RotateCcw size={17}/></button>{spin&&<button disabled={!ready||failed} onClick={()=>setAuto(!auto)} aria-label={auto?'暂停旋转':'自动旋转'}>{auto?<Pause size={17}/>:<Play size={17}/>}</button>}{!large&&<button onClick={()=>{setAuto(false);setFull(true)}} aria-label="全屏查看"><Maximize2 size={17}/></button>}</div></div>
    {spin&&<div className="spin-drag-tools" role="group" aria-label="图片拖动方式"><button aria-pressed={rotateDrag} onClick={()=>{setDragMode('rotate');setAuto(false)}}>拖动旋转</button><button aria-pressed={!rotateDrag} onClick={choosePan}>拖动平移</button></div>}
    {sources.length>1&&<div className="angle-controls"><button aria-label="上一角度" onClick={()=>change(index-1)}><ChevronLeft size={17}/></button>{spin?<input aria-label="旋转角度" type="range" min={0} max={sources.length-1} value={index} onChange={e=>change(+e.target.value)}/>:sources.map((src,i)=><button key={src} className={i===index?'selected':''} onClick={()=>change(i)} aria-label={'查看角度 '+(i+1)}><span className="dot"/></button>)}<span>{index+1} / {sources.length}</span><button aria-label="下一角度" onClick={()=>change(index+1)}><ChevronRight size={17}/></button></div>}
    <p className="zoom-hint" role="status" aria-live="polite">{failed?'图片未完整加载，请刷新重试。':spin?rotateDrag?view.scale<=1?'单指或鼠标拖动旋转 · 双指或滚轮缩放 · 点击“拖动平移”会先放大':'当前拖动旋转 · 可切换平移 · 双指或滚轮缩放':'当前拖动平移 · 单指或鼠标移动图片 · 可切换旋转':'双指以触点中心缩放 · 放大后拖动 · 切图请用下方箭头'}</p>
    {full&&<Modal title={alt} onClose={()=>setFull(false)}><ZoomStage sources={sources} spin={spin} alt={alt} large/></Modal>}
  </div>;
}

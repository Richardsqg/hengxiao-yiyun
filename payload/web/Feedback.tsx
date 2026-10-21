'use client';
import {useState,useRef} from 'react';
import {Check,ArrowRight,Star,LoaderCircle,ArrowUpRight} from 'lucide-react';
import {FAVORITES,TOPICS} from '../src/validation';
import {createUuid} from './uuid';
export default function Feedback(){
 const [rating,setRating]=useState(0),[favorite,setFavorite]=useState(''),[topics,setTopics]=useState<string[]>([]),[nickname,setNickname]=useState(''),[message,setMessage]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(false);const id=useRef(''),submittedContent=useRef(''),inFlight=useRef(false);
 async function submit(e:React.FormEvent){
  e.preventDefault();if(inFlight.current)return;setError('');
  if(!rating||!favorite||!consent){setError('请完成评分、展区选择，并勾选反馈使用说明。');return;}
  inFlight.current=true;setBusy(true);let timedOut=false,timer:ReturnType<typeof setTimeout>|undefined;
  try{
   const content={rating,favorite,topics,nickname,message,consent,website:''},signature=JSON.stringify(content);
   if(!id.current||submittedContent.current!==signature){id.current=createUuid();submittedContent.current=signature;}
   const controller=new AbortController();timer=setTimeout(()=>{timedOut=true;controller.abort()},20000);
   const res=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({id:id.current,...content})});
   let result:any;try{result=await res.json()}catch{throw new Error('暂时无法确认提交结果。内容已保留，原样重试不会重复保存；修改内容会作为新反馈提交。')}
   if(!res.ok)throw new Error(typeof result?.error==='string'?result.error:'暂时无法保存。内容已保留，请稍后重试。');
   if(result?.ok!==true||result.id!==id.current)throw new Error('暂时无法确认提交结果。内容已保留，原样重试不会重复保存；修改内容会作为新反馈提交。');
   setSuccess(true);
  }catch(e){
   setError(timedOut?'提交响应超时，结果尚未确认。内容已保留，原样重试不会重复保存；修改内容会作为新反馈提交。':e instanceof TypeError?'网络连接暂时中断，提交结果尚未确认。内容已保留，原样重试不会重复保存；修改内容会作为新反馈提交。':e instanceof Error?e.message:'暂时无法确认提交结果。内容已保留，请稍后重试。');
  }finally{if(timer!==undefined)clearTimeout(timer);inFlight.current=false;setBusy(false)}
 }
 if(success)return <div className="success-panel"><div className="success-seal"><Check size={42}/></div><p className="eyebrow">感谢观展</p><h2>你的回响，已被珍藏。</h2><p>问卷与留言已提交给展馆管理员。<br/>感谢你，让传统工艺被更多人看见。</p><button className="button light" onClick={()=>{setSuccess(false);setMessage('');setRating(0);setFavorite('');setTopics([]);setConsent(false);id.current='';submittedContent.current='';}}>再写一份反馈 <ArrowRight size={16}/></button></div>;
 return <form className="feedback-form" aria-busy={busy} onSubmit={submit}>
 <fieldset disabled={busy}><legend><span>01</span>这次观展，感觉如何？<em>必选</em></legend><div className="rating-stars" role="radiogroup" aria-label="体验评分">{[1,2,3,4,5].map(n=><button type="button" key={n} role="radio" aria-checked={n===rating} aria-label={n+'星'} onClick={()=>setRating(n)}><Star size={34} fill={n<=rating?'currentColor':'none'}/></button>)}<span>{['点亮星星，为展览评分','还需改进','一般','不错','很喜欢','非常喜欢'][rating]}</span></div></fieldset>
 <fieldset disabled={busy}><legend><span>02</span>哪个展区让你印象最深？<em>必选</em></legend><div className="choice-row">{FAVORITES.map(f=><button type="button" key={f} aria-pressed={favorite===f} className={'choice '+(favorite===f?'chosen':'')} onClick={()=>setFavorite(f)}>{f}{favorite===f&&<Check size={14}/>}</button>)}</div></fieldset>
 <fieldset disabled={busy}><legend><span>03</span>还想了解什么？<em>可多选</em></legend><div className="choice-row">{TOPICS.map(t=><button type="button" key={t} aria-pressed={topics.includes(t)} className={'choice '+(topics.includes(t)?'chosen':'')} onClick={()=>setTopics(topics.includes(t)?topics.filter(v=>v!==t):[...topics,t])}>{t}</button>)}</div></fieldset>
 <label className="field-label" htmlFor="visitor-message"><span>04</span>留下一点感受，或一个建议。<em>选填</em></label><textarea id="visitor-message" disabled={busy} rows={4} maxLength={1000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="哪一处细节打动了你？你希望下一次看到什么？"/><div className="char-count">{message.length} / 1000</div>
 <label className="nickname">你的称呼 <input disabled={busy} maxLength={30} value={nickname} onChange={e=>setNickname(e.target.value)} placeholder="可不填，匿名也欢迎"/></label>
 <label className="consent"><input type="checkbox" disabled={busy} checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>同意将本次反馈交给展馆管理员，用于课程与展览改进。留言不公开展示，请勿填写手机号等个人敏感信息。</span></label>
 {error&&<p className="error" role="alert">{error}</p>}<button className="button light submit-button" disabled={busy} type="submit">{busy?<><LoaderCircle className="spin" size={18}/>正在提交</>:<>留下我的回响 <ArrowUpRight size={18}/></>}</button>
 </form>
}

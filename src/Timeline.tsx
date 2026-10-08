import {useEffect,useMemo,useRef,useState} from 'react';
import type {MouseEvent} from 'react';
import {Play,Pause,Expand,RotateCcw} from 'lucide-react';
import type {PR,Checkpoint,Bound} from './types';
import {shortSci,time,date} from './format';
interface Props {prs:PR[];history:Checkpoint[];leaderId?:string;maxPR:number;baseline:number;selected:PR|Checkpoint|null;onSelect:(p:PR|Checkpoint)=>void;expanded?:boolean;onExpand?:()=>void;setCutoff:(n:number)=>void}
interface Event {id:string;createdAt:string;kind:'pr'|'openai'|'checkpoint';bound:Bound;source:PR|Checkpoint}
export default function Timeline({prs,history,leaderId,maxPR,baseline,selected,onSelect,expanded,onExpand,setCutoff}:Props){
 const [scale,setScale]=useState('log'),[mode,setMode]=useState('all'),[hover,setHover]=useState<Event|null>(null),[recent,setRecent]=useState(false),[position,setPosition]=useState(999999),[playing,setPlaying]=useState(false);
 const chartRef=useRef<HTMLDivElement>(null);const [width,setWidth]=useState(900);const previousTotal=useRef(0);
 useEffect(()=>{if(!chartRef.current)return;const observer=new ResizeObserver(entries=>setWidth(Math.max(300,entries[0].contentRect.width)));observer.observe(chartRef.current);return()=>observer.disconnect();},[]);
 const all=useMemo<Event[]>(()=>[
  ...history.map(p=>({id:p.id,createdAt:p.createdAt,kind:p.kind,bound:p.bound,source:p})),
  ...prs.filter(p=>p.bound).map(p=>({id:p.id,createdAt:p.createdAt,kind:'pr' as const,bound:p.bound!,source:p}))
 ].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)),[prs,history]);
 useEffect(()=>{const previous=previousTotal.current;setPosition(n=>n===999999||n>=previous?all.length:Math.min(n,all.length));previousTotal.current=all.length;setPlaying(false);},[all]);
 const through=Math.min(position,all.length);
 useEffect(()=>{if(through===all.length){setCutoff(maxPR);return;}const end=through?Date.parse(all[through-1].createdAt):-Infinity;setCutoff(Math.max(0,...prs.filter(p=>p.repo==='CrocSwap/integer-mult-bounds'&&Date.parse(p.createdAt)<=end).map(p=>p.number)));},[through,all,prs,maxPR,setCutoff]);
 useEffect(()=>{if(!playing)return;const timer=setInterval(()=>setPosition(n=>Math.min(n+1,all.length)),650);return()=>clearInterval(timer);},[playing,all.length]);
 useEffect(()=>{if(through>=all.length)setPlaying(false);},[through,all.length]);
 const events=all.slice(0,through),recentPRs=events.filter(p=>p.kind==='pr'),visible=recent&&recentPRs.length?recentPRs.slice(-12):events;
 const W=width,H=expanded?400:width<500?300:285,L=width<500?50:58,R=25,T=55,B=45;
 const minX=visible.length?Date.parse(visible[0].createdAt):0,maxX=visible.length>1?Date.parse(visible.at(-1)!.createdAt):minX+3600000;
 const vals=visible.map(p=>p.bound.value),domain=recent&&vals.length?vals:[baseline,...vals],low=Math.min(...domain),high=Math.max(...domain);
 const logLow=Math.log10(low),logHigh=Math.log10(high),padding=Math.max(.08,(logHigh-logLow)*.12);
 const minY=scale==='log'?(recent?logLow-padding:Math.floor(logLow)):(recent?low*.92:0),maxY=scale==='log'?(recent?logHigh+padding:Math.ceil(logHigh)):high*1.1;
 const x=(p:Event)=>L+(Date.parse(p.createdAt)-minX)/(maxX-minX||1)*(W-L-R);
 const y=(value:number)=>T+(1-((scale==='log'?Math.log10(value):value)-minY)/(maxY-minY||1))*(H-T-B);
 let best=0;const frontier=events.filter(p=>{if(p.bound.value>best){best=p.bound.value;return true;}return false;}).filter(p=>visible.includes(p));
 const plot=mode==='frontier'?frontier:visible;
 const path=frontier.map((p,i)=>`${i?'L':'M'}${x(p)},${y(p.bound.value)}`).join(' ');
 const ticks=Array.from({length:5},(_,i)=>scale==='log'&&!recent?Math.round(maxY-(maxY-minY)*i/4):maxY-(maxY-minY)*i/4);
 const exponent=(n:number)=>n===0?'⁰':(n<0?'⁻':'')+String(Math.abs(n)).split('').map(c=>'⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join('');
 const labels=plot.filter(p=>p.kind==='openai'||p.id===leaderId);
 const active=hover??visible.find(p=>p.id===selected?.id);const activeVisible=active&&visible.some(p=>p.id===active.id);
 const ref=(p:Event)=>p.kind==='pr'?`#${(p.source as PR).number}`:p.kind==='openai'?'Original result':p.source.title;
 const pick=(event:MouseEvent<SVGSVGElement>)=>{const rect=event.currentTarget.getBoundingClientRect();const px=(event.clientX-rect.left)*W/rect.width,py=(event.clientY-rect.top)*H/rect.height;let closest:Event|null=null,distance=18;for(const p of plot){const d=Math.hypot(x(p)-px,y(p.bound.value)-py);if(d<distance){distance=d;closest=p;}}return closest;};
 const dateRange=maxX-minX>=86400000;
 return <section className={'panel timeline '+(expanded?'expanded':'')}>
  <div className="panel-head"><div><h2>κ over time <span className="subtle-pill">{all.length} claims</span></h2><p>Conditional exponent saving · higher is better</p></div><div className="panel-actions"><select aria-label="Timeline scale" value={scale} onChange={e=>setScale(e.target.value)}><option value="log">Log scale</option><option value="linear">Linear scale</option></select>{onExpand&&<button className="icon-btn" aria-label="Expand timeline" onClick={onExpand}><Expand size={16}/></button>}</div></div>
  <div className="chart-options"><div className="segmented small"><button className={mode==='all'?'active':''} onClick={()=>setMode('all')}>All claims</button><button className={mode==='frontier'?'active':''} onClick={()=>setMode('frontier')}>Frontier</button></div><button className={'text-btn '+(recent?'accent-text':'')} onClick={()=>setRecent(!recent)}>{recent?'Show full history':'Latest 12 PRs'}</button></div>
  <div className="chart-wrap" ref={chartRef}><svg viewBox={`0 0 ${W} ${H}`} onMouseMove={e=>setHover(pick(e))} onMouseLeave={()=>setHover(null)} onClick={e=>{const p=pick(e);if(p)onSelect(p.source);}} role="group" aria-label="Kappa timeline from the original OpenAI publication, through repository commits and pull requests. Select a point to inspect its source.">
   <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#b9f582" stopOpacity=".13"/><stop offset="1" stopColor="#b9f582" stopOpacity="0"/></linearGradient></defs>
   {ticks.map((v,i)=>{const yy=y(scale==='log'?10**v:v);return <g key={i}><line x1={L} x2={W-R} y1={yy} y2={yy} className="gridline"/><text x={L-10} y={yy+4} textAnchor="end" className="axis-label">{scale==='log'?(recent?shortSci(10**v):`10${exponent(v)}`):v===0?'0':shortSci(v)}</text></g>;})}
   {baseline>=Math.min(...vals)&&baseline<=Math.max(...vals)&&<g><line x1={L} x2={W-R} y1={y(baseline)} y2={y(baseline)} stroke="#667078" strokeDasharray="4 6"/><text x={W-R} y={y(baseline)-7} textAnchor="end" className="axis-label">main {shortSci(baseline)}</text></g>}
   {frontier.length>1&&<><path d={path+` L${x(frontier.at(-1)!)},${H-B} L${x(frontier[0])},${H-B} Z`} fill="url(#area)"/><path d={path} fill="none" stroke="#b9f582" strokeWidth="2.5" strokeLinejoin="round"/></>}
   {plot.map(p=>{const highlight=p.kind==='openai'||p.id===leaderId,fill=p.kind==='openai'?'#87cbea':p.id===leaderId?'#b9f582':'#89969c',draft=p.kind==='pr'&&(p.source as PR).draft;return <g key={p.id} tabIndex={0} role="button" aria-label={`${ref(p)}, ${p.source.author}, kappa ${shortSci(p.bound.value)}${draft?', draft':''}`} onFocus={()=>setHover(p)} onBlur={()=>setHover(null)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(p.source);}}} className="chart-point"><circle cx={x(p)} cy={y(p.bound.value)} r="11" fill="transparent"/>{p.kind==='checkpoint'?<rect x={x(p)-3.5} y={y(p.bound.value)-3.5} width="7" height="7" fill={fill} stroke="#141a1f" strokeWidth="1.5"/>:<circle cx={x(p)} cy={y(p.bound.value)} r={selected?.id===p.id||highlight?5:3} fill={draft?'#141a1f':fill} stroke={draft?fill:'#141a1f'} strokeWidth="1.6" opacity={highlight?1:.75}/>}</g>;})}
   {labels.map(p=><g key={p.id} pointerEvents="none"><text x={x(p)+(p.kind==='openai'?9:-7)} y={y(p.bound.value)-18} textAnchor={p.kind==='openai'?'start':'end'} className={'point-label '+(p.kind==='openai'?'openai-label':'')} >{p.kind==='openai'?'OpenAI':p.source.author}<tspan className="point-ref">{p.kind==='pr'?` #${(p.source as PR).number}`:''}</tspan><tspan x={x(p)+(p.kind==='openai'?9:-7)} dy="14" className="point-ref">{`κ ${p.bound.kind==='lower'?'>':'='} ${p.kind==='openai'?p.bound.expression.replace(/(2|10)\^(-?\d+)/g,(_,base,power)=>base+exponent(+power)):shortSci(p.bound.value)}`}</tspan></text></g>)}
   {Array.from({length:W<500?3:5},(_,i)=>{const n=W<500?3:5,d=new Date(minX+(maxX-minX)*i/(n-1)).toISOString();return <text key={i} x={L+(W-L-R)*i/(n-1)} y={H-15} textAnchor={i===0?'start':i===n-1?'end':'middle'} className="axis-label">{dateRange?`${date(d)} · ${time(d)}`:`${i===0||i===n-1?date(d)+' · ':''}${time(d)}`}</text>;})}
   {active&&activeVisible&&<g pointerEvents="none"><line x1={x(active)} x2={x(active)} y1={T} y2={H-B} stroke="#b9f582" opacity=".35" strokeDasharray="3 4"/><circle cx={x(active)} cy={y(active.bound.value)} r="8" fill="none" stroke="#b9f582"/></g>}
  </svg>{active&&activeVisible&&<div className="chart-tooltip"><span className="accent-text">{active.kind==='pr'?ref(active):active.kind==='openai'?'OpenAI':'Repository checkpoint'}</span>{active.kind==='pr'&&active.source.author}<b>{active.bound.kind==='lower'&&'> '}{shortSci(active.bound.value)}</b><span>{active.source.methods[0]?.name}</span><span>{date(active.createdAt)}, {time(active.createdAt)} UTC</span>{active.kind==='pr'&&(active.source as PR).draft&&<span>Draft</span>}</div>}
  {!visible.length&&<div className="chart-empty">No κ claims match these filters.</div>}</div>
  <div className="chart-bottom"><div className="chart-legend"><span><i className="legend-line"/>Claim frontier</span><span><i className="legend-square"/>Repo checkpoint</span><span><i className="legend-ring"/>Draft</span></div><span className="meta">UTC · published / opened</span></div>
  <div className="playback"><button className="icon-btn" aria-label={playing?'Pause timeline':'Play timeline'} onClick={()=>{if(through>=all.length){setPosition(1);setRecent(false);}setPlaying(!playing);}}>{playing?<Pause size={15}/>:<Play size={15}/>}</button><input type="range" aria-label="Timeline through contribution" min="1" max={Math.max(1,all.length)} value={Math.max(1,through)} onChange={e=>{setPlaying(false);setPosition(+e.target.value);}}/><span className="meta">{through} / {all.length}</span><button className="icon-btn" aria-label="Reset timeline" onClick={()=>{setPosition(all.length);setPlaying(false);setRecent(false);}}><RotateCcw size={14}/></button></div>
 </section>;
}

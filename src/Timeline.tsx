import {useEffect,useId,useMemo,useRef,useState} from 'react';
import type {MouseEvent,PointerEvent,KeyboardEvent} from 'react';
import {Play,Pause,Expand,RotateCcw,Minus,Plus,Scan} from 'lucide-react';
import {FULL_VIEW,MAX_ZOOM,panViewport,zoomViewport} from '../lib/timeline-viewport.mjs';
import type {Viewport} from '../lib/timeline-viewport.mjs';
import type {PR,Checkpoint,Bound} from './types';
import {shortSci,time,date} from './format';
import {selectionReference,selectionSources} from '../lib/maintainer.mjs';
interface Props {prs:PR[];history:Checkpoint[];leaderId?:string;hasSelection:boolean;maxPR:number;baseline:number;selected:PR|Checkpoint|null;onSelect:(p:PR|Checkpoint)=>void;expanded?:boolean;onExpand?:()=>void;setCutoff:(n:number)=>void}
interface Event {id:string;createdAt:string;kind:'pr'|'openai'|'checkpoint'|'reviewed';bound:Bound;source:PR|Checkpoint}
interface Point {x:number;y:number}
interface Gesture {origin:Point;distance:number;view:Viewport}
export default function Timeline({prs,history,leaderId,hasSelection,maxPR,baseline,selected,onSelect,expanded,onExpand,setCutoff}:Props){
 const [scale,setScale]=useState('log'),[mode,setMode]=useState('maintainer'),[hover,setHover]=useState<Event|null>(null),[recent,setRecent]=useState(false),[position,setPosition]=useState(999999),[playing,setPlaying]=useState(false);
 const [view,setView]=useState<Viewport>(FULL_VIEW),[dragging,setDragging]=useState(false);
 const chartRef=useRef<HTMLDivElement>(null),svgRef=useRef<SVGSVGElement>(null);const [width,setWidth]=useState(900);const previousTotal=useRef(0);
 const pointers=useRef(new Map<number,Point>()),gesture=useRef<Gesture|null>(null),skipClick=useRef(false);
 const chartId=useId(),clipId=`${chartId}-clip`,areaId=`${chartId}-area`;
 useEffect(()=>{if(!chartRef.current)return;const observer=new ResizeObserver(entries=>setWidth(Math.max(300,entries[0].contentRect.width)));observer.observe(chartRef.current);return()=>observer.disconnect();},[]);
 const all=useMemo<Event[]>(()=>[
  ...history.map(p=>({id:p.id,createdAt:p.createdAt,kind:p.kind,bound:p.bound,source:p})),
  ...(mode==='claims'?prs.filter(p=>p.bound).map(p=>({id:p.id,createdAt:p.createdAt,kind:'pr' as const,bound:p.bound!,source:p})):[])
 ].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)),[prs,history,mode]);
 useEffect(()=>{const previous=previousTotal.current;setPosition(n=>n===999999||n>=previous?all.length:Math.min(n,all.length));previousTotal.current=all.length;setPlaying(false);},[all]);
 const through=Math.min(position,all.length);
 useEffect(()=>{if(through===all.length){setCutoff(maxPR);return;}const end=through?Date.parse(all[through-1].createdAt):-Infinity;setCutoff(Math.max(0,...prs.filter(p=>p.repo==='CrocSwap/integer-mult-bounds'&&Date.parse(p.createdAt)<=end).map(p=>p.number)));},[through,all,prs,maxPR,setCutoff]);
 useEffect(()=>{if(!playing)return;const timer=setInterval(()=>setPosition(n=>Math.min(n+1,all.length)),650);return()=>clearInterval(timer);},[playing,all.length]);
 useEffect(()=>{if(through>=all.length)setPlaying(false);},[through,all.length]);
 const events=all.slice(0,through),visible=recent?events.slice(-12):events;
 const W=width,H=expanded?400:width<500?300:285,L=view.height<.01?104:width<500?74:82,R=25,T=55,B=45;
 const fullMinX=visible.length?Date.parse(visible[0].createdAt):0,fullMaxX=Math.max(fullMinX+1,visible.length>1?Date.parse(visible.at(-1)!.createdAt):fullMinX+3600000);
 const vals=visible.map(p=>p.bound.value),domain=recent&&vals.length?vals:[baseline,...vals],low=Math.min(...domain),high=Math.max(...domain);
 const logLow=Math.log10(low),logHigh=Math.log10(high),padding=Math.max(.08,(logHigh-logLow)*.12);
 const fullMinY=scale==='log'?(recent?logLow-padding:Math.floor(logLow)):(recent?low*.92:0),fullMaxY=scale==='log'?(recent?logHigh+padding:Math.ceil(logHigh)):high*1.1;
 const minX=fullMinX+(fullMaxX-fullMinX)*view.x,maxX=minX+(fullMaxX-fullMinX)*view.width;
 const minY=fullMinY+(fullMaxY-fullMinY)*view.y,maxY=minY+(fullMaxY-fullMinY)*view.height;
 const plotW=W-L-R,plotH=H-T-B;
 useEffect(()=>{setView(FULL_VIEW);setHover(null);},[recent,scale,all]);
 const x=(p:Event)=>L+(Date.parse(p.createdAt)-minX)/(maxX-minX||1)*(W-L-R);
 const y=(value:number)=>T+(1-((scale==='log'?Math.log10(value):value)-minY)/(maxY-minY||1))*(H-T-B);
 const frontier=events.filter(p=>p.kind!=='pr').filter((p,i,points)=>i===0||p.bound.value!==points[i-1].bound.value||p.id===leaderId);
 const plot=visible;
 const path=frontier.map((p,i)=>`${i?'L':'M'}${x(p)},${y(p.bound.value)}`).join(' ');
 const ticks=Array.from({length:5},(_,i)=>scale==='log'&&!recent&&view.height===1?Math.round(maxY-(maxY-minY)*i/4):maxY-(maxY-minY)*i/4);
 const axisValue=(value:number)=>{const span=scale==='log'?10**maxY-10**minY:maxY-minY,digits=Math.min(9,Math.max(2,Math.ceil(-Math.log10(span/(Math.abs(value)||1)))+1));return value.toExponential(digits).replace(/(\.\d*?[1-9])0+(?=e)|\.0+(?=e)/,'$1');};
 const exponent=(n:number)=>n===0?'⁰':(n<0?'⁻':'')+String(Math.abs(n)).split('').map(c=>'⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join('');
 const inView=(p:Event)=>x(p)>=L-.01&&x(p)<=W-R+.01&&y(p.bound.value)>=T-.01&&y(p.bound.value)<=H-B+.01;
 const shown=plot.filter(inView),labels=shown.filter(p=>p.kind==='openai'||p.id===leaderId);
 const active=hover??visible.find(p=>p.id===selected?.id);const activeVisible=active&&visible.some(p=>p.id===active.id)&&inView(active);
 const ref=(p:Event)=>p.kind==='pr'?`#${(p.source as PR).number}`:p.kind==='openai'?'Original result':(p.source as Checkpoint).review?selectionReference(p.source as Checkpoint):p.source.title;
 const coords=(clientX:number,clientY:number)=>{const rect=svgRef.current!.getBoundingClientRect();return {x:(clientX-rect.left)*W/rect.width,y:(clientY-rect.top)*H/rect.height};};
 const pick=(event:MouseEvent<SVGSVGElement>)=>{const point=coords(event.clientX,event.clientY);if(point.x<L||point.x>W-R||point.y<T||point.y>H-B)return null;let closest:Event|null=null,distance=18;for(const p of shown){const d=Math.hypot(x(p)-point.x,y(p.bound.value)-point.y);if(d<distance){distance=d;closest=p;}}return closest;};
 const anchor=(point:Point)=>({x:(point.x-L)/plotW,y:1-(point.y-T)/plotH});
 const resetZoom=()=>{setView(FULL_VIEW);setHover(null);};
 const zoom=(factor:number)=>{const focus=active&&inView(active)?active:shown.find(p=>p.id===leaderId)??shown.at(-1),at=focus?anchor({x:x(focus),y:y(focus.bound.value)}):{x:.5,y:.5};setView(v=>zoomViewport(v,factor,at.x,at.y));setHover(null);};
 const setTimeWindow=(start:number,end:number)=>{
  setPlaying(false);setHover(null);
  if(start<=fullMinX&&end>=fullMaxX){setView(FULL_VIEW);return;}
  const timespan=fullMaxX-fullMinX,values=visible.filter(p=>Date.parse(p.createdAt)>=start&&Date.parse(p.createdAt)<=end).map(p=>scale==='log'?Math.log10(p.bound.value):p.bound.value);
  let yStart=view.y,height=view.height;
  if(values.length){const low=Math.min(...values),high=Math.max(...values),pad=high>low?(high-low)*.12:scale==='log'?.08:Math.abs(high)*.05,span=fullMaxY-fullMinY||1;
   yStart=Math.max(0,(low-pad-fullMinY)/span);const yEnd=Math.min(1,(high+pad-fullMinY)/span);height=Math.max(1e-12,yEnd-yStart);yStart=Math.min(yStart,1-height);
  }
  setView({x:(start-fullMinX)/timespan,width:(end-start)/timespan,y:yStart,height});
 };
 const rangeKeyDown=(event:KeyboardEvent<HTMLInputElement>,handle:'start'|'end')=>{
  const value=handle==='start'?minX:maxX,step=(fullMaxX-fullMinX)/1000;
  const next=event.key==='Home'?fullMinX:event.key==='End'?fullMaxX:event.key==='PageUp'?value+step*100:event.key==='PageDown'?value-step*100:event.key==='ArrowRight'||event.key==='ArrowUp'?value+step:event.key==='ArrowLeft'||event.key==='ArrowDown'?value-step:null;
  if(next===null)return;event.preventDefault();
  if(handle==='start')setTimeWindow(Math.max(fullMinX,Math.min(next,maxX-(fullMaxX-fullMinX)/MAX_ZOOM)),maxX);
  else setTimeWindow(minX,Math.min(fullMaxX,Math.max(next,minX+(fullMaxX-fullMinX)/MAX_ZOOM)));
 };
 useEffect(()=>{
  const svg=svgRef.current;if(!svg)return;
  const onWheel=(event:WheelEvent)=>{
   if(!event.ctrlKey&&!event.metaKey)return;
   const point=coords(event.clientX,event.clientY);if(!visible.length||point.x<L||point.x>W-R||point.y<T||point.y>H-B)return;
   event.preventDefault();const at=anchor(point),delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?H:1);
   if(Math.abs(event.deltaX)>Math.abs(event.deltaY)&&!event.ctrlKey&&!event.metaKey)setView(v=>panViewport(v,event.deltaX/plotW,0));
   else setView(v=>zoomViewport(v,Math.exp(-Math.max(-240,Math.min(240,delta))*.005),at.x,at.y));
   setHover(null);
  };
  svg.addEventListener('wheel',onWheel,{passive:false});return()=>svg.removeEventListener('wheel',onWheel);
 },[W,H,L,R,T,B,visible.length]);
 const beginGesture=()=>{const points=[...pointers.current.values()],a=points[0],b=points[1];gesture.current=a?{origin:b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2}:a,distance:b?Math.hypot(a.x-b.x,a.y-b.y):0,view}:null;};
 const pointerDown=(event:PointerEvent<SVGSVGElement>)=>{
  if(event.button!==0)return;const point=coords(event.clientX,event.clientY);if(point.x<L||point.x>W-R||point.y<T||point.y>H-B)return;
  skipClick.current=pointers.current.size>0;pointers.current.set(event.pointerId,point);event.currentTarget.setPointerCapture(event.pointerId);beginGesture();
 };
 const pointerMove=(event:PointerEvent<SVGSVGElement>)=>{
  if(!pointers.current.has(event.pointerId)||!gesture.current){if(event.pointerType!=='touch')setHover(pick(event));return;}
  pointers.current.set(event.pointerId,coords(event.clientX,event.clientY));const points=[...pointers.current.values()],a=points[0],b=points[1],start=gesture.current;
  const mid=b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2}:a,dx=(start.origin.x-mid.x)/plotW,dy=(mid.y-start.origin.y)/plotH;
  if(b&&start.distance>0){const at=anchor(start.origin),factor=Math.hypot(a.x-b.x,a.y-b.y)/start.distance;setView(panViewport(zoomViewport(start.view,Math.max(.01,factor),at.x,at.y),dx,dy));skipClick.current=true;}
  else if(Math.hypot(mid.x-start.origin.x,mid.y-start.origin.y)>4||skipClick.current){setView(panViewport(start.view,dx,dy));skipClick.current=true;}
  if(skipClick.current){setDragging(true);setHover(null);}
 };
 const pointerEnd=(event:PointerEvent<SVGSVGElement>)=>{pointers.current.delete(event.pointerId);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);beginGesture();if(!pointers.current.size)setDragging(false);};
 const keyDown=(event:KeyboardEvent<SVGSVGElement>)=>{
  if(event.target!==event.currentTarget)return;
  if(event.key==='+'||event.key==='=')zoom(2);else if(event.key==='-')zoom(.5);else if(event.key==='Home'||event.key==='0')resetZoom();
  else if(event.key.startsWith('Arrow')){const dx=event.key==='ArrowRight'?.15:event.key==='ArrowLeft'?-.15:0,dy=event.key==='ArrowUp'?.15:event.key==='ArrowDown'?-.15:0;setView(v=>panViewport(v,dx,dy));setHover(null);}else return;
  event.preventDefault();
 };
 const dateRange=maxX-minX>=86400000;
 const clock=(iso:string)=>maxX-minX<240000?new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'UTC'}).format(new Date(iso)):time(iso);
 const startISO=new Date(minX).toISOString(),endISO=new Date(maxX).toISOString();
 return <section className={'panel timeline '+(expanded?'expanded':'')}>
  <div className="panel-head"><div><h2>κ over time <span className="subtle-pill">{all.length} points</span></h2><p>{mode==='claims'?"Submitted PR claims · line follows upstream selections":"Upstream README history → maintainer record"}</p></div><div className="panel-actions"><select aria-label="Timeline scale" value={scale} onChange={e=>setScale(e.target.value)}><option value="log">Log scale</option><option value="linear">Linear scale</option></select>{onExpand&&<button className="icon-btn" aria-label="Expand timeline" onClick={onExpand}><Expand size={16}/></button>}</div></div>
  <div className="chart-options"><div className="segmented small"><button aria-pressed={mode==='maintainer'} className={mode==='maintainer'?'active':''} onClick={()=>setMode('maintainer')}>Maintainer</button><button aria-pressed={mode==='claims'} className={mode==='claims'?'active':''} onClick={()=>setMode('claims')}>PR claims</button></div><button className={'text-btn '+(recent?'accent-text':'')} onClick={()=>setRecent(!recent)}>{recent?'Show full history':'Latest 12 points'}</button><div className="timeline-zoom" role="group" aria-label="Timeline zoom controls"><button className="icon-btn" aria-label="Zoom out timeline" title="Zoom out" disabled={(view.width===1&&view.height===1)||!visible.length} onClick={()=>zoom(.5)}><Minus size={15}/></button><output className="meta" aria-label="Timeline zoom level">{+(1/view.width).toFixed(1)}×</output><button className="icon-btn" aria-label="Zoom in timeline" title="Zoom in" disabled={(view.width<=1/MAX_ZOOM&&view.height<=1/MAX_ZOOM)||!visible.length} onClick={()=>zoom(2)}><Plus size={15}/></button><button className="icon-btn" aria-label="Reset timeline zoom" title="Fit timeline" disabled={view.width===1&&view.height===1} onClick={resetZoom}><Scan size={15}/></button></div></div>
  <div className={'chart-wrap '+(dragging?'is-panning':'')} ref={chartRef}><svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onPointerLeave={()=>setHover(null)} onClick={e=>{if(skipClick.current){skipClick.current=false;return;}const p=pick(e);if(p)onSelect(p.source);}} onDoubleClick={e=>{const at=anchor(coords(e.clientX,e.clientY));setView(v=>zoomViewport(v,2,at.x,at.y));setHover(null);}} onKeyDown={keyDown} tabIndex={0} role="group" aria-label="Kappa timeline from the original OpenAI publication, through repository commits and pull requests. Hold Ctrl or Command and scroll to zoom, or pinch. Drag to pan. Use plus or minus to zoom, arrow keys to pan, Home to reset. Select a point to inspect its source.">
   <title>Ctrl/⌘ + scroll or pinch to zoom · drag to pan</title>
   <defs><clipPath id={clipId}><rect x={L-6} y={T-6} width={plotW+12} height={plotH+12}/></clipPath><linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#b9f582" stopOpacity=".13"/><stop offset="1" stopColor="#b9f582" stopOpacity="0"/></linearGradient></defs>
   {ticks.map((v,i)=>{const yy=y(scale==='log'?10**v:v);return <g key={i}><line x1={L} x2={W-R} y1={yy} y2={yy} className="gridline"/><text x={L-10} y={yy+4} textAnchor="end" className="axis-label">{scale==='log'?(recent||view.height<1?axisValue(10**v):`10${exponent(v)}`):v===0?'0':axisValue(v)}</text></g>;})}
   {mode==='claims'&&hasSelection&&baseline>=Math.min(...vals)&&baseline<=Math.max(...vals)&&y(baseline)>=T&&y(baseline)<=H-B&&<g><line x1={L} x2={W-R} y1={y(baseline)} y2={y(baseline)} stroke="#667078" strokeDasharray="4 6"/><text x={W-R} y={y(baseline)-7} textAnchor="end" className="axis-label">Reviewed {shortSci(baseline)}</text></g>}
   <g clipPath={`url(#${clipId})`}>
   {frontier.length>1&&<><path d={path+` L${x(frontier.at(-1)!)},${H-B} L${x(frontier[0])},${H-B} Z`} fill={`url(#${areaId})`}/><path d={path} fill="none" stroke="#b9f582" strokeWidth="2.5" strokeLinejoin="round"/></>}
   {shown.map(p=>{const highlight=p.kind==='openai'||p.id===leaderId,fill=p.kind==='openai'?'#87cbea':p.id===leaderId?'#b9f582':'#89969c',draft=p.kind==='pr'&&(p.source as PR).draft;return <g key={p.id} tabIndex={0} role="button" aria-label={`${ref(p)}${p.kind==='reviewed'&&selectionSources(p.source as Checkpoint).length>1?'':`, ${p.source.author}`}, kappa ${shortSci(p.bound.value)}${draft?', draft':''}`} onFocus={()=>setHover(p)} onBlur={()=>setHover(null)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(p.source);}}} className="chart-point"><circle cx={x(p)} cy={y(p.bound.value)} r="11" fill="transparent"/>{p.kind==='checkpoint'||p.kind==='reviewed'?<rect x={x(p)-3.5} y={y(p.bound.value)-3.5} width="7" height="7" fill={fill} stroke="#141a1f" strokeWidth="1.5"/>:<circle cx={x(p)} cy={y(p.bound.value)} r={selected?.id===p.id||highlight?5:3} fill={draft?'#141a1f':fill} stroke={draft?fill:'#141a1f'} strokeWidth="1.6" opacity={highlight?1:.75}/>}</g>;})}
   </g>
   {labels.map(p=>{const side=x(p)<L+140?'start':'end',labelX=x(p)+(side==='start'?9:-7);return <g key={p.id} pointerEvents="none"><text x={labelX} y={y(p.bound.value)-18} textAnchor={side} className={'point-label '+(p.kind==='openai'?'openai-label':'')} >{p.kind==='openai'?'OpenAI':p.source.author}<tspan className="point-ref">{p.kind==='pr'?` #${(p.source as PR).number}`:(p.source as Checkpoint).review?selectionSources(p.source as Checkpoint).length>1?` · ${selectionSources(p.source as Checkpoint).length} PRs`:` #${selectionSources(p.source as Checkpoint)[0]?.number}`:''}</tspan><tspan x={labelX} dy="14" className="point-ref">{`κ ${p.bound.kind==='lower'?'>':'='} ${p.kind==='openai'?p.bound.expression.replace(/(2|10)\^(-?\d+)/g,(_,base,power)=>base+exponent(+power)):shortSci(p.bound.value)}`}</tspan></text></g>;})}
   {Array.from({length:W<500?2:5},(_,i)=>{const n=W<500?2:5,d=new Date(minX+(maxX-minX)*i/(n-1)).toISOString();return <text key={i} x={L+(W-L-R)*i/(n-1)} y={H-15} textAnchor={i===0?'start':i===n-1?'end':'middle'} className="axis-label">{dateRange?`${date(d)} · ${clock(d)}`:`${i===0||i===n-1?date(d)+' · ':''}${clock(d)}`}</text>;})}
   {active&&activeVisible&&<g pointerEvents="none"><line x1={x(active)} x2={x(active)} y1={T} y2={H-B} stroke="#b9f582" opacity=".35" strokeDasharray="3 4"/><circle cx={x(active)} cy={y(active.bound.value)} r="8" fill="none" stroke="#b9f582"/></g>}
  </svg>{active&&activeVisible&&<div className="chart-tooltip"><span className="accent-text">{active.kind==='pr'?ref(active):active.kind==='openai'?'OpenAI':active.kind==='reviewed'?`Reviewed ${ref(active)}`:'Repository checkpoint'}</span>{(active.kind==='pr'||active.kind==='reviewed'&&selectionSources(active.source as Checkpoint).length<=1)&&active.source.author}<b>{active.bound.kind==='lower'&&'> '}{shortSci(active.bound.value)}</b><span>{active.source.methods[0]?.name}</span><span>{date(active.createdAt)}, {time(active.createdAt)} UTC</span>{active.kind==='pr'&&(active.source as PR).draft&&<span>Draft</span>}</div>}
  {!visible.length&&<div className="chart-empty">No κ points available.</div>}</div>
  <div className="chart-bottom"><div className="chart-legend"><span><i className="legend-line"/>Upstream selections</span><span><i className="legend-square"/>Source record</span>{mode==='claims'&&<span><i className="legend-ring"/>Draft</span>}</div><span className="meta">{hasSelection?"UTC · published / opened":"No current maintainer selection"}</span></div>
  <div className="playback"><button className="icon-btn" aria-label={playing?'Pause timeline':'Play timeline'} onClick={()=>{if(through>=all.length){setPosition(1);setRecent(false);}resetZoom();setPlaying(!playing);}}>{playing?<Pause size={15}/>:<Play size={15}/>}</button><div className="timeline-range" role="group" aria-label="Timeline time range"><div className="timeline-range-track"><span className="timeline-range-selection" style={{left:`calc(${view.x*100}% + ${9-18*view.x}px)`,width:`calc(${view.width*100}% - ${18*view.width}px)`}}/><input className="timeline-range-start" type="range" onKeyDown={e=>rangeKeyDown(e,'start')} aria-label="Timeline start time" aria-valuetext={`${date(startISO)}, ${clock(startISO)} UTC`} min={fullMinX} max={fullMaxX} step="1" value={Math.round(minX)} disabled={visible.length<2} onChange={e=>setTimeWindow(Math.min(+e.target.value,maxX-(fullMaxX-fullMinX)/MAX_ZOOM),maxX)}/><input className="timeline-range-end" type="range" onKeyDown={e=>rangeKeyDown(e,'end')} aria-label="Timeline end time" aria-valuetext={`${date(endISO)}, ${clock(endISO)} UTC`} min={fullMinX} max={fullMaxX} step="1" value={Math.round(maxX)} disabled={visible.length<2} onChange={e=>setTimeWindow(minX,Math.max(+e.target.value,minX+(fullMaxX-fullMinX)/MAX_ZOOM))}/></div><div className="timeline-range-dates"><span>{date(startISO)} · {clock(startISO)}</span><span>{date(endISO)} · {clock(endISO)}</span></div></div><span className="meta">{through} / {all.length}</span><button className="icon-btn" aria-label="Reset timeline" onClick={()=>{setPosition(all.length);setPlaying(false);setRecent(false);resetZoom();}}><RotateCcw size={14}/></button></div>
 </section>;
}

import type {TimelineBase} from '../lib/timeline-scale.mjs';

interface Props {base:TimelineBase;onChange:(base:TimelineBase)=>void;label:string}

export default function KappaBaseToggle({base,onChange,label}:Props){
 return <div className="segmented small kappa-base" role="group" aria-label={label}><span className="kappa-base-label">Base</span>{([10,2] as const).map(n=><button key={n} aria-label={`Base ${n}`} title={`Base ${n}`} aria-pressed={base===n} className={base===n?'active':''} onClick={()=>onChange(n)}>{n}</button>)}</div>;
}

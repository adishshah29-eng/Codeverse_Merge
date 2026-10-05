import React,{useState} from 'react';

const actions=[
 {id:'crew',label:'Signal the getaway crew',detail:'Transmit the extraction signal.'},
 {id:'locks',label:'Release the vault locks',detail:'Withdraw the mechanical interlocks.'},
 {id:'surveillance',label:'Disable surveillance',detail:'Loop the Mint’s camera feeds.'},
 {id:'passage',label:'Open the extraction passage',detail:'Clear the crew’s route out.'},
 {id:'alarm',label:'Disconnect the vault alarm',detail:'Isolate the door-contact circuit.'},
];
export const correctOrder=['surveillance','alarm','locks','passage','crew'];
export function isCorrectOrder(order){return order.length===correctOrder.length&&order.every((id,i)=>id===correctOrder[i]);}

export default function Sequence({timer,onComplete,onPenalty,onHint,isEventMode=false,attempts,hints}){
 const [order,setOrder]=useState([]),[message,setMessage]=useState('Select the actions in execution order.'),[hint,setHint]=useState(false);
 function submit(){if(isCorrectOrder(order)){onComplete(order);}else{onPenalty(order);setMessage('Sequence rejected. Penalty applied. Review the evidence and try again.');}}
 return <div className="sequence-hud"><div className="sequence-heading"><div><p className="eyebrow">FINAL EXTRACTION / COMMAND SEQUENCE</p><h2>One door. Five commands.</h2><p>Reconstruct the safe order. The vault opens when every step is correct.</p></div><div className="sequence-clock"><span>EXTRACTION WINDOW</span><strong>{timer}</strong><small>LIVE COUNTDOWN</small></div></div>
 <div className="sequence-panels"><section className="sequence-panel actions-panel"><div className="panel-head"><span>01 / SELECT COMMANDS</span><strong>{5-order.length} REMAINING</strong></div><details className="clues" open><summary>Recovered field notes</summary><ul><li>Isolate the door contact after looping the cameras, before moving any lock.</li><li>Release the locks before opening the passage.</li><li>Signal the getaway crew only when the passage is clear.</li></ul></details><div className="action-bank">{actions.filter(a=>!order.includes(a.id)).map(a=><button key={a.id} className="action-card" onClick={()=>setOrder(v=>[...v,a.id])}><strong>{a.label}</strong><span>{a.detail}</span><b aria-hidden="true">＋</b></button>)}{order.length===5&&<p className="bank-complete">All commands queued. Review the order.</p>}</div></section>
 <section className="sequence-panel execution-panel"><div className="panel-head"><span>02 / EXECUTION ORDER</span><strong>{order.length} / 5</strong></div><div className="queue" aria-label="Your extraction sequence">{order.length===0?<p className="empty-queue">Select a command to build the extraction sequence.</p>:<ol>{order.map((id,i)=><li key={id}><span className="queue-index">0{i+1}</span><span>{actions.find(a=>a.id===id).label}</span><button aria-label={'Remove '+actions.find(a=>a.id===id).label} onClick={()=>setOrder(v=>v.filter(x=>x!==id))}>×</button></li>)}</ol>}</div><p className="feedback" role="status">{message}</p><button className="primary execute-button" disabled={order.length!==5} onClick={submit}>Execute extraction <span>→</span></button><div className="sequence-tools"><button className="text-button" onClick={()=>{setOrder([]);setMessage('Sequence cleared. Select the actions in execution order.')}} disabled={!order.length}>Clear sequence</button><button className="text-button" disabled={hint} onClick={()=>{setHint(true);onHint()}}>Reveal hint{isEventMode?'':' · −100 points'}</button></div>{hint&&<p className="hint">Start with surveillance. End with the getaway signal.</p>}<p className="demo-note">{isEventMode?'Wrong sequence penalty: 1.5 points · ':'Wrong order: −30 seconds and −150 points · '}Attempts: {attempts} · Hints: {hints}</p></section></div></div>;
}

import{c as h,u as z,b as D,r,k as t,af as $,B as C,Z as g}from"./index-CFkoNJ2T.js";import{C as F}from"./chevron-down-osbLUfSa.js";/**
 * @license lucide-react v1.77.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m={name:"download",size:24,node:[["path",{d:"M12 15V3",key:"m9g1x1"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["path",{d:"m7 10 5 5 5-5",key:"brsn70"}]]};m.node;const S=h(m);/**
 * @license lucide-react v1.77.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f={name:"file-spreadsheet",size:24,node:[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M8 13h2",key:"yr2amv"}],["path",{d:"M14 13h2",key:"un5t4a"}],["path",{d:"M8 17h2",key:"2yhykz"}],["path",{d:"M14 17h2",key:"10kma7"}]]};f.node;const _=h(f);/**
 * @license lucide-react v1.77.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y={name:"table-2",size:24,node:[["path",{d:"M3 9h18",key:"1pudct"}],["path",{d:"M9 3v18",key:"fh3hqa"}],["rect",{x:"3",y:"3",width:"18",height:"18",rx:"2",key:"h1oib"}]]};y.node;const L=h(y);function N({path:p,name:i,label:k,size:x,extras:v=[]}){const{t:a,err:E}=z(),b=D(),[n,o]=r.useState(!1),[w,u]=r.useState(!1),d=r.useRef(null);r.useEffect(()=>{if(!n)return;const e=s=>{d.current&&!d.current.contains(s.target)&&o(!1)},c=s=>{s.key==="Escape"&&o(!1)};return document.addEventListener("mousedown",e),document.addEventListener("keydown",c),()=>{document.removeEventListener("mousedown",e),document.removeEventListener("keydown",c)}},[n]);const j=async(e,c)=>{o(!1),u(!0);try{await g(e,c)}catch(s){b({text:E(s),tone:"error"})}finally{u(!1)}},l=e=>`${p}${p.includes("?")?"&":"?"}format=${e}`,M=[{label:a("Excel (.xlsx)","Excel (.xlsx)","Excel (.xlsx)"),path:l("xlsx"),file:`${i}.xlsx`,icon:t.jsx(_,{size:16})},{label:a("PDF","PDF","PDF"),path:l("pdf"),file:`${i}.pdf`,icon:t.jsx($,{size:16})},{label:a("CSV","CSV","CSV"),path:l("csv"),file:`${i}.csv`,icon:t.jsx(L,{size:16})},...v];return t.jsxs("div",{className:"export-menu",ref:d,children:[t.jsxs(C,{size:x,icon:t.jsx(S,{size:x==="sm"?14:16}),loading:w,"aria-haspopup":"menu","aria-expanded":n,onClick:()=>o(e=>!e),children:[k||a("Export","एक्सपोर्ट","Export")," ",t.jsx(F,{size:14,"aria-hidden":!0})]}),n&&t.jsx("div",{className:"export-pop",role:"menu",children:M.map(e=>t.jsxs("button",{type:"button",role:"menuitem",className:"export-item",onClick:()=>j(e.path,e.file),children:[e.icon,e.label]},e.file))})]})}export{S as D,N as E};

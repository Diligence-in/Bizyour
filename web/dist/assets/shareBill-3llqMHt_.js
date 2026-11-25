import{v as r,m as n,a2 as i,a4 as d}from"./index-uvua2fP3.js";function $(a,e){const t=e.customerName&&e.customerName.trim().toLowerCase()!=="walk-in"?a(`Namaste ${e.customerName} ji, `,`नमस्ते ${e.customerName} जी, `,`Namaste ${e.customerName} ji, `):a("Namaste, ","नमस्ते, ","Namaste, "),l=`🧾 *${e.shop}* — ${a(`Bill #${e.billNo}`,`बिल #${e.billNo}`,`Bill #${e.billNo}`)}`,s=a(`${t}your bill is ready.
Total: ${n(e.total)} · Balance: ${n(e.balance)}`,`${t}आपका बिल तैयार है।
कुल: ${n(e.total)} · बाकी: ${n(e.balance)}`,`${t}aapka bill tayyar hai.
Kul: ${n(e.total)} · Baaki: ${n(e.balance)}`),c=e.attached?a("The bill PDF is attached with this message. Thank you! 🙏","बिल की PDF इस संदेश के साथ है। धन्यवाद! 🙏","Bill ki PDF is message ke saath hai. Dhanyavaad! 🙏"):e.pdfUrl?a(`Bill PDF: ${e.pdfUrl}
Thank you! 🙏`,`बिल PDF: ${e.pdfUrl}
धन्यवाद! 🙏`,`Bill PDF: ${e.pdfUrl}
Dhanyavaad! 🙏`):a("Thank you! 🙏","धन्यवाद! 🙏","Dhanyavaad! 🙏");return`${l}
${s}
${c}`}async function f(a){const e=await r(`/api/invoices/${a}/bill-link`);return window.location.origin+e.url_path}async function h(a){return d(`/api/invoices/${a}/pdf`)}async function b(a,e){const o=window.open("","_blank");try{const t=await h(a),l=URL.createObjectURL(t);o&&!o.closed?(o.location.href=l,setTimeout(()=>URL.revokeObjectURL(l),6e4)):m(t,`bill-${e??a}.pdf`)}catch(t){throw o&&!o.closed&&o.close(),t}}function m(a,e){const o=document.createElement("a");o.href=URL.createObjectURL(a),o.download=e,document.body.appendChild(o),o.click(),setTimeout(()=>{URL.revokeObjectURL(o.href),o.remove()},4e3)}function p(a,e){const o=i(a);return o?(window.open(`https://wa.me/${o}?text=${encodeURIComponent(e)}`,"_blank","noopener"),!0):!1}const w=a=>i(a||"")!=="";export{p as a,$ as b,f,w as h,b as o};

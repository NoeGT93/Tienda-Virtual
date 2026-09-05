function safeText(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}'use strict';
const products = [
 {id:'top-marfil',name:'Top de punto Esencia',category:'TOP',price:189,color:'Marfil',swatch:'#e6ddc7',cell:1,filter:'none',gender:'Damas',badge:'NUEVO',sizes:['XS','S','M','L'],description:'Tejido suave, cuello redondo y una silueta sencilla para combinar todos los días.'},
 {id:'blazer-arena',name:'Blazer Arena',category:'OUTERWEAR',price:429,color:'Camel',swatch:'#b7936a',cell:2,filter:'none',gender:'Unisex',badge:'ESENCIAL',sizes:['S','M','L','XL'],description:'Una tercera pieza de corte relajado, con solapas clásicas y acabado de sastrería.'},
 {id:'pantalon-grafito',name:'Pantalón de sastre Alba',category:'BOTTOM',price:299,color:'Grafito',swatch:'#454645',cell:3,filter:'none',gender:'Unisex',badge:'',sizes:['XS','S','M','L','XL'],description:'Tiro alto y pierna amplia. Una base versátil para tus looks de oficina o fin de semana.'},
 {id:'falda-cacao',name:'Falda midi Cacao',category:'BOTTOM',price:249,oldPrice:319,color:'Cacao',swatch:'#574338',cell:4,filter:'none',gender:'Damas',badge:'−22%',sizes:['S','M','L'],description:'Línea fluida y largo midi. Su caída ligera aporta movimiento a tu combinación.'},
 {id:'bolso-noche',name:'Bolso de mano Noche',category:'BAG',price:349,color:'Negro',swatch:'#242323',cell:5,filter:'none',gender:'Unisex',badge:'',sizes:['Única'],description:'Formato compacto, asa superior y cierre metálico. Un detalle que completa el look.'},
 {id:'top-oliva',name:'Top de punto Oliva',category:'TOP',price:189,color:'Oliva',swatch:'#81846a',cell:1,filter:'sepia(.45) saturate(.65) brightness(.7) contrast(3)',gender:'Damas',badge:'NUEVO',sizes:['XS','S','M','L'],description:'El básico de punto en un tono oliva sereno. Fácil de llevar con sastrería y faldas.'},
 {id:'blazer-pizarra',name:'Blazer Pizarra',category:'OUTERWEAR',price:449,color:'Pizarra',swatch:'#696966',cell:2,filter:'grayscale(1) brightness(.72) contrast(2.5)',gender:'Unisex',badge:'',sizes:['S','M','L','XL'],description:'Sastrería relajada en gris profundo. Combínalo con tonos claros para un contraste sutil.'},
 {id:'falda-perla',name:'Falda midi Perla',category:'BOTTOM',price:279,color:'Perla',swatch:'#b8b0a2',cell:4,filter:'grayscale(.8) brightness(2.25)',gender:'Damas',badge:'ÚLTIMAS PIEZAS',sizes:['S','M'],description:'Nuestra falda fluida en un acabado claro para combinaciones suaves y naturales.'},
 {id:'pantalon-humo',name:'Pantalón Humo',category:'BOTTOM',price:299,color:'Gris',swatch:'#93938e',cell:3,filter:'brightness(1.7)',gender:'Unisex',badge:'AGOTADO',sizes:[],description:'Silueta amplia y cómoda en gris suave. Puedes probarlo, aunque aún no está disponible para comprar.'}
];
const $ = selector => document.querySelector(selector);
const money = value => new Intl.NumberFormat('es-GT',{style:'currency',currency:'GTQ',minimumFractionDigits:2}).format(value);
const productById = id => products.find(product=>product.id===id);
const hanger = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 6a2 2 0 1 1 3 1.7L12 9v2l9 6a1 1 0 0 1-.6 1.8H3.6A1 1 0 0 1 3 17l9-6"/></svg>';
const spriteStyle = p => p.image && /^\/(assets|uploads)\/[a-zA-Z0-9_.-]+\.(png|webp|jpg|jpeg)$/i.test(p.image) ? `background-image:url('${p.image}');background-size:contain;background-position:center;filter:none` : `background-position:${p.cell%3*50}% ${p.cell>2?100:0}%;filter:none`;
const imageMarkup = (p,cls='') => `<div class="sprite ${cls}" data-fit-thumb="${safeText(p.id)}" style="${spriteStyle(p)}" role="img" aria-label="${safeText(p.name)}, ${safeText(p.color)}"></div>`;
const initialLook = {TOP:'top-marfil',BOTTOM:'pantalon-grafito'};
const state = {equipped:initialLook,history:[],future:[],favorites:[],saved:[],cart:[],category:'Todo',gender:'Todo',query:'',sort:'featured',favoritesOnly:false,mannequin:'standard'};
try {
 const data=JSON.parse(localStorage.getItem('lulos-production-cart-v1')||'null');
 if(data){
  if(Array.isArray(data.favorites))state.favorites=data.favorites.filter(id=>productById(id));
  if(Array.isArray(data.cart))state.cart=data.cart.filter(row=>productById(row.id)?.sizes.includes(row.size)&&Number.isInteger(row.quantity)&&row.quantity>0&&row.quantity<=10);
  if(Array.isArray(data.saved))state.saved=data.saved.slice(0,6).filter(look=>look&&look.items&&Object.values(look.items).every(id=>productById(id)));
  if(data.equipped&&typeof data.equipped==='object')state.equipped=Object.fromEntries(Object.entries(data.equipped).filter(([layer,id])=>productById(id)?.category===layer));
 }
}catch{ /* The demo remains usable when browser storage is unavailable. */ }
const persist=()=>{try{localStorage.setItem('lulos-production-cart-v1',JSON.stringify({equipped:state.equipped,favorites:state.favorites,saved:state.saved,cart:state.cart}));}catch{}};
let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3200);}
function renderProducts(){
 let visible=products.filter(p=>(state.category==='Todo'||p.category===state.category)&&(state.gender==='Todo'||p.gender===state.gender||p.gender==='Unisex')&&(!state.favoritesOnly||state.favorites.includes(p.id))&&`${safeText(p.name)} ${safeText(p.color)}`.toLocaleLowerCase('es').includes(state.query));
 if(state.sort!=='featured')visible.sort((a,b)=>state.sort==='asc'?a.price-b.price:b.price-a.price);
 $('#result-count').textContent=`${visible.length} prendas`;
 $('#products').innerHTML=visible.length?visible.map(p=>`<article class="product-card"><div class="product-image" draggable="true" data-drag="${p.id}">${imageMarkup(p)}<span class="badge">${safeText(p.badge)}</span><button class="favorite ${state.favorites.includes(p.id)?'selected':''}" aria-label="${state.favorites.includes(p.id)?'Quitar de':'Agregar a'} favoritos: ${safeText(p.name)}" aria-pressed="${state.favorites.includes(p.id)}" data-favorite="${p.id}">${state.favorites.includes(p.id)?'♥':'♡'}</button><button class="try-button" data-try="${p.id}" title="Probar ${safeText(p.name)}" aria-label="Probar ${safeText(p.name)}">${hanger}</button></div><button class="product-name" data-detail="${p.id}">${safeText(p.name)}</button><div class="product-meta"><span class="price">${money(p.price)} ${p.oldPrice?`<del>${money(p.oldPrice)}</del>`:''}</span><span class="swatches"><span class="swatch" style="--swatch:${p.swatch}" title="${safeText(p.color)}"></span></span></div></article>`).join(''):'<div class="empty-state">No encontramos prendas con esta selección.<button id="reset-filters">Ver toda la colección</button></div>';
}
function lookProducts(look=state.equipped){return Object.values(look).map(productById).filter(Boolean);}
function total(look=state.equipped){return lookProducts(look).reduce((sum,p)=>sum+p.price,0);}
function renderLook(){
 const selected=lookProducts();
 $('#layers').innerHTML=selected.map(p=>`<button class="sprite garment ${p.category}" style="${spriteStyle(p)}" title="Retirar ${safeText(p.name)}" aria-label="Retirar ${safeText(p.name)}" data-remove="${p.category}"></button>`).join('');
 $('#picks').innerHTML=selected.length?selected.map(p=>`<div class="pick" title="${safeText(p.name)}">${imageMarkup(p)}<button data-remove="${p.category}" aria-label="Retirar ${safeText(p.name)}">×</button></div>`).join(''):'<span class="empty-picks">Tu próxima combinación empieza<br>con una prenda que te guste.</span>';
 $('#look-count').textContent=`${selected.length} prendas`;
 $('#look-total').textContent=money(total());
 $('#stage-caption').textContent=selected.length?'Toca una prenda del maniquí para retirarla':'Elige una prenda y toca la percha';
 $('#undo').disabled=!state.history.length;$('#redo').disabled=!state.future.length;$('#clear').disabled=!selected.length;$('#buy-look').disabled=!selected.length;
 persist();
}
function commitLook(next){state.history.push({...state.equipped});if(state.history.length>20)state.history.shift();state.future=[];state.equipped=next;renderLook();}
function equip(id,origin){
 const p=productById(id);if(!p)return;
 if(state.equipped[p.category]===id){toast('Esta prenda ya está en tu look.');return;}
 const next={...state.equipped,[p.category]:id};
 if(origin&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
  const start=origin.closest('.product-image')?.getBoundingClientRect()||origin.getBoundingClientRect();const end=$('#stage').getBoundingClientRect();
  const flyer=document.createElement('div');flyer.className='sprite flying';flyer.style.cssText=`${spriteStyle(p)};left:${start.left}px;top:${start.top}px;width:${start.width}px;height:${start.height}px`;document.body.append(flyer);
  const dx=end.left+end.width/2-start.left-start.width/2,dy=end.top+end.height/2-start.top-start.height/2;
  const animation=flyer.animate([{transform:'translate(0,0) rotate(0) scale(1)',opacity:.85},{transform:`translate(${dx*.55}px,${dy*.5-70}px) rotate(-9deg) scale(.7)`,opacity:.8,offset:.5},{transform:`translate(${dx}px,${dy}px) rotate(0) scale(.32)`,opacity:0}],{duration:650,easing:'cubic-bezier(.22,1,.36,1)'});
  animation.finished.then(()=>flyer.remove()).catch(()=>flyer.remove());
 }
 commitLook(next);toast(`${safeText(p.name)} en tu look${p.sizes.length?'':' · Actualmente agotado'}`);
}
function openDialog(id){const dialog=$(id);if(!dialog.open)dialog.showModal();}
let detailProduct=null,detailSize=null;
function showDetail(id){const p=productById(id);detailProduct=p;detailSize=null;$('#product-detail').innerHTML=`<div class="detail-grid">${imageMarkup(p,'detail-image')}<div><span class="eyebrow">${p.color.toUpperCase()}</span><h2>${safeText(p.name)}</h2><strong>${money(p.price)}</strong><p>${safeText(p.description)}</p><label class="size-label">Elige tu talla</label><div class="sizes">${p.sizes.length?p.sizes.map(size=>`<button data-size="${safeText(size)}" aria-pressed="false">${safeText(size)}</button>`).join(''):'<span class="muted">Agotado</span>'}</div><button id="detail-try" class="primary">Probar en mi look ↗</button><button id="detail-cart" class="secondary" ${p.sizes.length?'':'disabled'}>Agregar a la bolsa</button><p class="disclaimer">Prenda ilustrativa. Las medidas y existencias definitivas se incorporarán con el catálogo real.</p></div></div>`;openDialog('#product-dialog');}
function addCart(id,size,quantity=1){const p=productById(id);if(!p?.sizes.includes(size))return false;const row=state.cart.find(item=>item.id===id&&item.size===size);if(row){row.quantity=Math.min(10,row.quantity+quantity);}else state.cart.push({id,size,quantity});renderCart();persist();return true;}
function renderCart(){
 $('#cart-count').textContent=state.cart.reduce((sum,row)=>sum+row.quantity,0);
 $('#cart-items').innerHTML=state.cart.length?state.cart.map((row,index)=>{const p=productById(row.id);return `<div class="cart-row">${imageMarkup(p,'cart-thumb')}<div class="cart-info"><h3>${safeText(p.name)}</h3><p>${safeText(p.color)} · Talla ${row.size}</p><p>${money(p.price)}</p><div class="quantity"><button data-quantity="${index}" data-delta="-1" aria-label="Reducir cantidad de ${safeText(p.name)}">−</button><span>${row.quantity}</span><button data-quantity="${index}" data-delta="1" aria-label="Aumentar cantidad de ${safeText(p.name)}" ${row.quantity>=10?'disabled':''}>+</button></div></div><button class="remove" data-cart-remove="${index}">Quitar</button></div>`;}).join(''):'<div class="empty-state">Tu bolsa está vacía.<br>Prueba tus favoritos y encuentra tu combinación.</div>';
 $('#cart-total').textContent=money(state.cart.reduce((sum,row)=>sum+productById(row.id).price*row.quantity,0));$('#checkout').disabled=!state.cart.length;
}
function outfitToCart(){
 const selected=lookProducts();if(!selected.length)return;
 $('#product-detail').innerHTML=`<h2>Las tallas de tu look</h2><p class="muted">Elige una talla para cada prenda antes de agregarla.</p><form id="outfit-form">${selected.map(p=>`<div class="cart-row">${imageMarkup(p,'cart-thumb')}<div class="cart-info"><h3>${safeText(p.name)}</h3><p>${money(p.price)}</p>${p.sizes.length?`<select name="${p.id}" required aria-label="Talla de ${safeText(p.name)}"><option value="">Elegir talla</option>${p.sizes.map(s=>`<option>${s}</option>`).join('')}</select>`:'<span class="muted">Agotado · no se agregará</span>'}</div></div>`).join('')}<button class="primary" style="margin-top:20px" ${selected.some(p=>p.sizes.length)?'':'disabled'}>Agregar prendas disponibles ↗</button></form>`;openDialog('#product-dialog');
 $('#outfit-form').addEventListener('submit',event=>{event.preventDefault();for(const [id,size]of new FormData(event.currentTarget))addCart(id,size);$('#product-dialog').close();toast('Tu combinación está en la bolsa.');openDialog('#cart-dialog');});
}
function showSaved(){
 const looks=[{items:state.equipped,current:true},...state.saved];
 $('#compare-content').innerHTML=looks.map((look,index)=>`<div class="saved-look"><h3>${index===0?'Look actual':`Look guardado ${index}`} · ${lookProducts(look.items).length} prendas · ${money(total(look.items))}</h3><div class="mini-picks">${lookProducts(look.items).map(p=>imageMarkup(p)).join('')}</div>${index?`<button data-restore="${index-1}">Usar este look</button><button data-delete-look="${index-1}">Eliminar</button>`:'<button id="save-current">Guardar esta combinación</button>'}</div>`).join('');openDialog('#compare-dialog');
}
function saveLook(){if(!lookProducts().length){toast('Primero agrega prendas a tu look.');return;}if(state.saved.some(look=>JSON.stringify(look.items)===JSON.stringify(state.equipped))){toast('Este look ya está guardado.');return;}state.saved.unshift({items:{...state.equipped}});state.saved=state.saved.slice(0,6);persist();toast('Look guardado en este navegador.');if($('#compare-dialog').open)showSaved();}
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.hasAttribute('data-close')){button.closest('dialog').close();return;}
 if(button.dataset.try){equip(button.dataset.try,button);return;}
 if(button.dataset.detail){showDetail(button.dataset.detail);return;}
 if(button.dataset.favorite){const id=button.dataset.favorite;state.favorites=state.favorites.includes(id)?state.favorites.filter(item=>item!==id):[...state.favorites,id];renderProducts();persist();return;}
 if(button.dataset.remove){const next={...state.equipped};delete next[button.dataset.remove];commitLook(next);return;}
 if(button.dataset.category){state.category=button.dataset.category;document.querySelectorAll('[data-category]').forEach(b=>b.classList.toggle('active',b===button));renderProducts();return;}
 if(button.dataset.gender){state.gender=button.dataset.gender;document.querySelectorAll('[data-gender]').forEach(b=>b.classList.toggle('active',b===button));renderProducts();return;}
 if(button.dataset.size){detailSize=button.dataset.size;document.querySelectorAll('[data-size]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});return;}
 if(button.dataset.quantity!==undefined){const row=state.cart[Number(button.dataset.quantity)];row.quantity+=Number(button.dataset.delta);state.cart=state.cart.filter(item=>item.quantity>0);renderCart();persist();return;}
 if(button.dataset.cartRemove!==undefined){state.cart.splice(Number(button.dataset.cartRemove),1);renderCart();persist();return;}
 if(button.dataset.restore!==undefined){commitLook({...state.saved[Number(button.dataset.restore)].items});$('#compare-dialog').close();toast('Look recuperado.');return;}
 if(button.dataset.deleteLook!==undefined){state.saved.splice(Number(button.dataset.deleteLook),1);persist();showSaved();return;}
 if(button.id==='detail-try'){equip(detailProduct.id);$('#product-dialog').close();}
 if(button.id==='detail-cart'){if(!detailSize){toast('Elige una talla para continuar.');return;}addCart(detailProduct.id,detailSize);$('#product-dialog').close();toast('Prenda agregada a la bolsa.');}
 if(button.id==='save-current')saveLook();
 if(button.id==='reset-filters'){state.query='';state.category='Todo';state.gender='Todo';state.favoritesOnly=false;$('#search').value='';$('#favorites').textContent='♡';document.querySelectorAll('[data-category],[data-gender]').forEach(b=>b.classList.toggle('active',b.dataset.category==='Todo'||b.dataset.gender==='Todo'));renderProducts();}
});
$('#search').addEventListener('input',event=>{state.query=event.target.value.trim().toLocaleLowerCase('es');renderProducts();});
$('#sort').addEventListener('change',event=>{state.sort=event.target.value;renderProducts();});
$('#favorites').addEventListener('click',()=>{state.favoritesOnly=!state.favoritesOnly;$('#favorites').textContent=state.favoritesOnly?'♥':'♡';$('#favorites').setAttribute('aria-pressed',String(state.favoritesOnly));renderProducts();});
$('#mannequin').addEventListener('change',event=>{state.mannequin=event.target.value;$('#body-frame').className=`body-frame ${state.mannequin}`;toast('Silueta de muestra actualizada. El ajuste es orientativo.');});
$('#clear').addEventListener('click',()=>commitLook({}));
$('#undo').addEventListener('click',()=>{if(state.history.length){state.future.push({...state.equipped});state.equipped=state.history.pop();renderLook();}});
$('#redo').addEventListener('click',()=>{if(state.future.length){state.history.push({...state.equipped});state.equipped=state.future.pop();renderLook();}});
$('#save-look').addEventListener('click',saveLook);$('#compare').addEventListener('click',showSaved);$('#buy-look').addEventListener('click',outfitToCart);$('#open-cart').addEventListener('click',()=>{renderCart();openDialog('#cart-dialog');});
$('#checkout').addEventListener('click',()=>{$('#cart-dialog').close();$('#product-detail').innerHTML=`<span class="eyebrow">RESUMEN DE DEMOSTRACIÓN</span><h2 style="margin:18px 0">Tu look está listo.</h2><p>${state.cart.reduce((sum,row)=>sum+row.quantity,0)} prendas · ${money(state.cart.reduce((sum,row)=>sum+productById(row.id).price*row.quantity,0))}</p><p class="muted">Esta demo termina aquí. No se ha creado ningún pedido ni se ha cobrado nada.</p><p class="muted">El envío, los datos de entrega y el pago se incorporarán en la tienda definitiva.</p><button class="primary" data-close>Seguir combinando ↗</button>`;openDialog('#product-dialog');});
document.addEventListener('dragstart',event=>{const card=event.target.closest('[data-drag]');if(card){event.dataTransfer.setData('text/plain',card.dataset.drag);event.dataTransfer.effectAllowed='copy';}});
$('#stage').addEventListener('dragover',event=>{event.preventDefault();$('#stage').classList.add('drag-over');});$('#stage').addEventListener('dragleave',()=>$('#stage').classList.remove('drag-over'));$('#stage').addEventListener('drop',event=>{event.preventDefault();$('#stage').classList.remove('drag-over');equip(event.dataTransfer.getData('text/plain'));});
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}}));
renderProducts();renderLook();renderCart();



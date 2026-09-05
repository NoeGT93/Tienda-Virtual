/* Shared 2D fitting renderer: one coordinate system for studio and saved looks. */
(() => {
  'use strict';
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet'; stylesheet.href = 'visual-refresh.css?v=4';
  document.head.append(stylesheet);
  const images = new Map(), garments = new Map();
  const profiles = {
    female: { shoulders: .295, waist: .235, shoulderY: .187, waistY: .407, ankleY: .936, jacketY: .158, jacketHem: .534 },
    male: { shoulders: .365, waist: .293, shoulderY: .171, waistY: .427, ankleY: .936, jacketY: .145, jacketHem: .535 }
  };
  function loadImage(url) {
    if (!images.has(url)) images.set(url,new Promise((resolve,reject) => {
      const image = new Image(); image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Imagen no disponible'));image.src=url;
    }));
    return images.get(url);
  }
  const canvas=(width,height)=>Object.assign(document.createElement('canvas'),{width:Math.round(width),height:Math.round(height)});
  // Remove only the light background connected to the edge. Light fabric inside a garment stays opaque.
  function trimBackground(source,removeHoles=false) {
    const ctx=source.getContext('2d',{willReadFrequently:true}), image=ctx.getImageData(0,0,source.width,source.height);
    const {data}=image,w=source.width,h=source.height,seen=new Uint8Array(w*h),queue=new Int32Array(w*h);
    let head=0,tail=0;
    const background=i=>data[i*4+3]<12 || (Math.min(data[i*4],data[i*4+1],data[i*4+2])>238 && Math.max(data[i*4],data[i*4+1],data[i*4+2])-Math.min(data[i*4],data[i*4+1],data[i*4+2])<12);
    const visit=i=>{if(i>=0&&i<w*h&&!seen[i]&&background(i)){seen[i]=1;queue[tail++]=i;}};
    for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x)}
    for(let y=0;y<h;y++){visit(y*w);visit(y*w+w-1)}
    while(head<tail){const i=queue[head++];data[i*4+3]=0;if(i%w)visit(i-1);if(i%w<w-1)visit(i+1);visit(i-w);visit(i+w)}
    if(removeHoles)for(let i=0;i<w*h;i++)if(background(i))data[i*4+3]=0;
    let left=w,top=h,right=0,bottom=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>30){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
    if(right<=left||bottom<=top)throw Error('No se pudo identificar la prenda');
    ctx.putImageData(image,0,0);
    const result=canvas(right-left+1,bottom-top+1);result.getContext('2d').drawImage(source,left,top,result.width,result.height,0,0,result.width,result.height);
    return result;
  }
  function spanAt(source,position) {
    const ctx=source.getContext('2d',{willReadFrequently:true}),y=Math.min(source.height-1,Math.max(0,Math.round(position*source.height)));
    const data=ctx.getImageData(0,y,source.width,1).data;
    let left=source.width,right=0;for(let x=0;x<source.width;x++)if(data[x*4+3]>100){left=Math.min(left,x);right=Math.max(right,x)}
    return Math.max(.25,(right-left+1)/source.width);
  }
  function assetFor(p,mannequin) {return boot?.assets?.find(a=>a.product_id===p.id&&a.mannequin_id===mannequin);}
  function garmentKey(p,mannequin) {const a=assetFor(p,mannequin);return [p.id,a?.image||p.image||p.cell,p.filter||'none'].join('|');}
  async function prepare(p,mannequin) {
    const key=garmentKey(p,mannequin);if(garments.has(key))return garments.get(key);
    const promise=(async()=>{
      const a=assetFor(p,mannequin),url=a?.image||p.image,im=await loadImage(url?cleanPath(url):'/assets/fashion-sheet.png');
      const cw=url?im.naturalWidth:im.naturalWidth/3,ch=url?im.naturalHeight:im.naturalHeight/2;
      const scale=Math.min(1,900/Math.max(cw,ch)),source=canvas(cw*scale,ch*scale);
      source.getContext('2d').drawImage(im,url?0:(p.cell%3)*cw,url?0:Math.floor(p.cell/3)*ch,cw,ch,0,0,source.width,source.height);
      const cut=trimBackground(source,!url&&p.category==='BAG');
      if(!url&&p.filter&&p.filter!=='none'){
        const recolored=canvas(cut.width,cut.height),ctx=recolored.getContext('2d');ctx.drawImage(cut,0,0);
        const pixels=ctx.getImageData(0,0,cut.width,cut.height),d=pixels.data;
        const color=/^#[0-9a-f]{6}$/i.test(p.swatch||'')?p.swatch:'#88887c';
        const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));let sum=0,count=0;
        for(let i=0;i<d.length;i+=4)if(d[i+3]>128){sum+=(d[i]+d[i+1]+d[i+2])/3;count++}
        const mean=sum/Math.max(count,1);
        for(let i=0;i<d.length;i+=4)if(d[i+3]){const shade=((d[i]+d[i+1]+d[i+2])/3)/Math.max(mean,1);for(let c=0;c<3;c++)d[i+c]=Math.min(255,rgb[c]*shade)}
        ctx.putImageData(pixels,0,0);return recolored;
      }
      return cut;
    })();garments.set(key,promise);return promise;
  }
  function fit(p,source,mannequin) {
    const body=profiles[mannequin]||profiles.female,skirt=p.category==='BOTTOM'&&(/falda|skirt/i.test(p.name)||p.cell===4);
    let width,height,y,z=20,x;
    if(p.category==='TOP'){width=body.shoulders/spanAt(source,.12);y=body.shoulderY-.009;height=body.waistY+.065-y;}
    else if(p.category==='OUTERWEAR'){width=body.shoulders/spanAt(source,.115);y=body.jacketY;height=body.jacketHem-y;z=30;}
    else if(p.category==='BOTTOM'){width=body.waist/spanAt(source,.045);y=body.waistY;height=(skirt?.80:body.ankleY)-y;z=10;}
    else if(p.category==='DRESS'){width=body.shoulders/spanAt(source,.12);y=body.shoulderY-.01;height=.83-y;}
    else if(p.category==='BAG'){width=.21;y=.49;height=width*2/3/(source.width/source.height);x=.64;z=40;}
    else if(p.category==='SHOES'){width=.29;y=.925;height=.065;}
    else if(p.category==='ACCESSORY_HEAD'){width=.18;y=.025;height=.11;z=40;}
    else {width=.18;y=.215;height=.12;z=40;}
    width=Math.min(.66,Math.max(.12,width));
    return {x:x??(.5-width/2),y,width,height,z};
  }
  fittedLayer=(p,interactive=false)=>{
    const tag=interactive?'button':'div';
    return `<${tag} class="fit-layer" data-fit-product="${esc(p.id)}" data-fit-mannequin="${esc(liveMannequin)}" ${interactive?`type="button" data-remove="${p.category}" aria-label="Retirar ${esc(p.name)}"`:''}><canvas aria-hidden="true"></canvas></${tag}>`;
  };
  realBody=(items=state.equipped,interactive=false)=>{
    const m=boot.mannequins.find(m=>m.id===liveMannequin);
    return `<div class="real-body precision-body" data-silhouette="${esc(liveMannequin)}"><img class="silhouette-image" src="${cleanPath(m?.image)}" alt="${esc(m?.name||'Maniquí')}" width="1024" height="1536">${lookProducts(items).map(p=>fittedLayer(p,interactive)).join('')}</div>`;
  };
  const pending=new WeakSet();
  async function paint(node) {
    if(pending.has(node))return;pending.add(node);
    const p=productById(node.dataset.fitProduct),mannequin=node.dataset.fitMannequin;if(!p)return;
    try {
      const source=await prepare(p,mannequin);if(!node.isConnected)return;
      const saved=assetFor(p,mannequin),pos=saved?{x:saved.x/100,y:saved.y/100,width:saved.width/100,height:saved.height/100,z:saved.z}:fit(p,source,mannequin);
      Object.assign(node.style,{left:`${pos.x*100}%`,top:`${pos.y*100}%`,width:`${pos.width*100}%`,height:`${pos.height*100}%`,zIndex:pos.z,transform:`rotate(${Number(saved?.rotation)||0}deg)`});
      const c=node.querySelector('canvas');c.width=source.width;c.height=source.height;c.getContext('2d').drawImage(source,0,0);node.classList.add('fit-ready');
    }catch{node.remove();toast('No se pudo cargar una imagen de la prenda. Intenta de nuevo.');}
  }
  let scheduled=false;
  async function paintThumbnail(node){
    if(pending.has(node))return;const p=productById(node.dataset.fitThumb);if(!p||/^mix-/.test(p.id))return;pending.add(node);
    try{const source=await prepare(p,'thumbnail');if(!node.isConnected)return;const c=canvas(source.width,source.height);c.getContext('2d').drawImage(source,0,0);c.setAttribute('aria-hidden','true');node.replaceChildren(c);node.classList.add('clean-thumbnail');}catch{/* Keep the original product photograph if processing fails. */}
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;document.querySelectorAll('[data-fit-product]').forEach(paint);document.querySelectorAll('[data-fit-thumb]').forEach(paintThumbnail)})}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});

  home=()=>`<section class="campaign-hero"><div class="campaign-copy"><span class="eyebrow">LULÓS · QUETZALTENANGO</span><h1>Tu estilo.<br><em>Sin esfuerzo.</em></h1><p>Esenciales que combinan contigo.<br>Explora, prueba y encuentra tu propia forma de llevarlos.</p><div class="campaign-actions"><a class="button-link" href="#tienda">Descubrir la colección <span>↗</span></a><a class="campaign-text-link" href="#tienda">Crear mi look</a></div><div class="campaign-note"><span>01 — ESENCIALES</span><span>Damas & caballeros</span></div></div><figure class="campaign-image"><img src="assets/campaign-editorial.png?v=2" alt="Moda LULÓS para dama y caballero en el Parque Central de Quetzaltenango" width="1024" height="1280" fetchpriority="high"><figcaption><span>Menos piezas.<br>Más posibilidades.</span><span>LULÓS / XELA / 01</span></figcaption></figure></section><section class="collection-strip" aria-label="Colecciones"><a href="#tienda" data-collection="Damas">01 <strong>Para ella</strong><span>↗</span></a><a href="#tienda" data-collection="Caballeros">02 <strong>Para él</strong><span>↗</span></a><a href="#tienda" data-collection="Todo">03 <strong>Tu próxima combinación</strong><span>↗</span></a></section><section class="home-section curated-section"><div class="section-title"><div><span class="eyebrow">LA SELECCIÓN LULOS</span><h2>Bien elegidos.<br><em>Mejor combinados.</em></h2></div><a href="#tienda">Ver todas las prendas ↗</a></div>${cards(products.slice(0,4))}</section><section class="studio-invite"><div><span class="eyebrow">TU PROBADOR PERSONAL</span><h2>Haz espacio<br>para <em>tu estilo.</em></h2></div><div><p>Elige una silueta y combina tus favoritos. Las prendas se colocan automáticamente para que puedas explorar el look completo.</p><a class="button-link" href="#tienda">Entrar al probador ↗</a><small>Vista orientativa en 2D. Consulta las medidas de cada prenda para elegir tu talla.</small></div></section>`;
  document.addEventListener('click',event=>{
    const link=event.target.closest('[data-collection]');if(!link)return;
    const select=document.querySelector('#live-gender');if(select){select.value=link.dataset.collection;select.dispatchEvent(new Event('change',{bubbles:true}));}
    const silhouette=document.querySelector('#mannequin');
    if(silhouette&&link.dataset.collection!=='Todo'){silhouette.value=link.dataset.collection==='Caballeros'?'male':'female';silhouette.dispatchEvent(new Event('change',{bubbles:true}));}
  });
  const originalRender=renderLook;
  renderLook=()=>{originalRender();const caption=document.querySelector('#stage-caption');if(caption)caption.textContent=lookProducts().length?'Ajuste automático · vista frontal':'Elige tus prendas y empieza a combinar';schedule();};
  const note=document.querySelector('.fitting-room>.disclaimer');if(note)note.textContent='Ajuste visual 2D. La talla real se elige con las medidas de la prenda.';
  const status=document.querySelector('.live-dot');if(status)status.textContent='Autoajuste';
  schedule();
})();

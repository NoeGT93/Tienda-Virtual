(()=>{
  'use strict';

  /*
   * Calibración visual del probador publicado en Vercel.
   *
   * La hoja de prendas original fue dibujada como catálogo, no sobre el
   * cuerpo. Por eso una caja genérica por categoría deja hombros, cintura y
   * cadera desalineados. Esta capa usa coordenadas por prenda y por maniquí
   * y mantiene el resto de la lógica del probador intacta.
   */
  const fits={
    female:{
      'top-marfil':      {x:31,y:21,width:38,height:27,z:20},
      'top-oliva':       {x:31,y:21,width:38,height:27,z:20},
      'blazer-arena':    {x:22,y:17,width:56,height:39,z:30},
      'blazer-pizarra':  {x:22,y:17,width:56,height:39,z:30},
      'pantalon-grafito':{x:28,y:40,width:44,height:55,z:10},
      'pantalon-humo':   {x:28,y:40,width:44,height:55,z:10},
      'falda-cacao':     {x:29,y:41,width:42,height:41,z:10},
      'falda-perla':     {x:29,y:41,width:42,height:41,z:10},
      'bolso-noche':     {x:62,y:45,width:24,height:22,z:50,rotation:-2}
    },
    male:{
      'blazer-arena':    {x:20,y:17,width:60,height:40,z:30},
      'blazer-pizarra':  {x:20,y:17,width:60,height:40,z:30},
      'pantalon-grafito':{x:27,y:40,width:46,height:55,z:10},
      'pantalon-humo':   {x:27,y:40,width:46,height:55,z:10},
      'bolso-noche':     {x:63,y:45,width:24,height:22,z:50,rotation:-2}
    }
  };

  const fallback={
    TOP:{x:31,y:21,width:38,height:27,z:20},
    OUTERWEAR:{x:22,y:17,width:56,height:39,z:30},
    BOTTOM:{x:28,y:40,width:44,height:55,z:10},
    BAG:{x:62,y:45,width:24,height:22,z:50},
    DRESS:{x:25,y:20,width:50,height:67,z:20},
    SHOES:{x:31,y:89,width:38,height:10,z:20},
    ACCESSORY_HEAD:{x:34,y:2,width:32,height:13,z:50},
    ACCESSORY:{x:35,y:24,width:30,height:15,z:50}
  };

  const css=document.createElement('style');
  css.textContent=`
    .stage .real-body{overflow:visible}
    .stage .fitted-layer{background-repeat:no-repeat;transition:opacity .18s ease,filter .18s ease;transform-origin:center center}
    .stage .fitted-layer:hover,.stage .fitted-layer:focus-visible{filter:drop-shadow(0 2px 2px rgba(35,37,32,.16))!important;outline:1px dashed rgba(72,78,64,.55);outline-offset:2px}
    .stage-caption{pointer-events:none}
    @media (max-width:720px){
      .stage{height:230px!important}
      .stage .real-body{height:230px!important;width:153px!important}
    }
    @media (max-width:390px){
      .stage{height:215px!important}
      .stage .real-body{height:215px!important;width:143px!important}
    }
  `;
  document.head.append(css);

  /* `fittedLayer` viene de live.js. Se reemplaza antes de que termine el
     bootstrap asíncrono, por lo que el primer render ya usa esta versión. */
  fittedLayer=(p,interactive=false)=>{
    const byProduct=fits[liveMannequin]?.[p.id];
    const fromApi=boot?.assets?.find(a=>a.product_id===p.id&&a.mannequin_id===liveMannequin);
    const pos=byProduct||fromApi||fallback[p.category]||fallback.ACCESSORY;
    const rotation=Number(pos.rotation||0);
    const image=fromApi?.image||p.image;
    const visual=image
      ? `background-image:url('${cleanPath(image)}');background-size:contain;background-position:center;`
      : `${spriteStyle(p)};`;
    const style=`${visual}left:${pos.x}%;top:${pos.y}%;width:${pos.width}%;height:${pos.height}%;transform:rotate(${rotation}deg);z-index:${pos.z}`;
    return `<${interactive?'button':'div'} class="sprite fitted-layer ${image?'':'legacy-cutout'}" style="${style}" ${interactive?`data-remove="${p.category}" aria-label="Retirar ${esc(p.name)}" title="Retirar ${esc(p.name)}"`:''}></${interactive?'button':'div'}>`;
  };
})();

(()=>{
  'use strict';

  /*
   * Ajuste fino SOLO para el probador interactivo.
   * La portada, looks guardados y demás composiciones mantienen las
   * proporciones editoriales originales para no deformar el diseño.
   */
  const precise={
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

  /* Posiciones editoriales originales del proyecto. */
  const editorial={
    TOP:{x:18,y:20,width:64,height:28,z:20},
    BOTTOM:{x:10,y:43,width:80,height:53,z:10},
    OUTERWEAR:{x:4,y:17,width:92,height:39,z:30},
    BAG:{x:61,y:44,width:36,height:24,z:50},
    DRESS:{x:8,y:20,width:84,height:67,z:20},
    SHOES:{x:17,y:88,width:66,height:12,z:20},
    ACCESSORY_HEAD:{x:26,y:0,width:48,height:15,z:50},
    ACCESSORY:{x:28,y:22,width:44,height:17,z:50}
  };

  const fittingFallback={
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
    .stage .real-body{overflow:hidden}
    .stage .fitted-layer{background-repeat:no-repeat;transform-origin:center center;transition:opacity .18s ease,filter .18s ease}
    .stage .fitted-layer:hover,.stage .fitted-layer:focus-visible{filter:drop-shadow(0 2px 2px rgba(35,37,32,.16))!important;outline:1px dashed rgba(72,78,64,.55);outline-offset:2px}
    .stage-caption{pointer-events:none}
    .home-visual .real-body{overflow:hidden}
    @media (max-width:720px){
      .stage{height:205px!important}
      .stage .real-body{height:205px!important;width:136.66px!important}
    }
    @media (max-width:390px){
      .stage{height:185px!important}
      .stage .real-body{height:185px!important;width:123.33px!important}
    }
  `;
  document.head.append(css);

  fittedLayer=(p,interactive=false)=>{
    const pos=interactive
      ? (precise[liveMannequin]?.[p.id]||fittingFallback[p.category]||fittingFallback.ACCESSORY)
      : (editorial[p.category]||editorial.ACCESSORY);
    const rotation=Number(pos.rotation||0);
    const image=p.image;
    const visual=image
      ? `background-image:url('${cleanPath(image)}');background-size:contain;background-position:center;`
      : `${spriteStyle(p)};`;
    const style=`${visual}left:${pos.x}%;top:${pos.y}%;width:${pos.width}%;height:${pos.height}%;transform:rotate(${rotation}deg);z-index:${pos.z}`;
    return `<${interactive?'button':'div'} class="sprite fitted-layer ${image?'':'legacy-cutout'}" style="${style}" ${interactive?`data-remove="${p.category}" aria-label="Retirar ${esc(p.name)}" title="Retirar ${esc(p.name)}"`:''}></${interactive?'button':'div'}>`;
  };
})();

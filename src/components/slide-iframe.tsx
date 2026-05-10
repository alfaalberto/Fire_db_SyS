"use client";

import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import { sanitizeHtml } from '@/lib/sanitize';

function stripBBoxWrappers(input: string): string {
  const pattern = /\\bbox\s*(\[[^\]]*\])?\s*{/g;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(input)) !== null) {
    result += input.slice(lastIndex, match.index);
    let idx = match.index + match[0].length;
    let depth = 1;
    while (idx < input.length && depth > 0) {
      if (input[idx] === '{') depth += 1;
      else if (input[idx] === '}') depth -= 1;
      idx += 1;
    }
    if (depth === 0) {
      result += input.slice(match.index + match[0].length, idx - 1);
      lastIndex = idx;
    } else {
      result += input.slice(match.index, idx);
      lastIndex = idx;
      break;
    }
  }
  result += input.slice(lastIndex);
  return result;
}

function serializeElementAttributes(el: Element | null, excludeNames: string[] = []): string {
  if (!el) return '';
  const excluded = new Set(excludeNames.map((name) => name.toLowerCase()));
  return Array.from(el.attributes)
    .filter((attr) => !excluded.has(attr.name.toLowerCase()))
    .map((attr) => `${attr.name}="${attr.value.replace(/"/g, '&quot;')}"`)
    .join(' ');
}

interface SlideIframeProps {
  content: string;
  title: string;
  presentationMode?: boolean;
  forceFit?: boolean;
  thumbnail?: boolean;
}

export const SlideIframe = forwardRef<HTMLIFrameElement, SlideIframeProps>(({ content, title, presentationMode = false, forceFit = false, thumbnail = false }, ref) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const trustSlides = process.env.NEXT_PUBLIC_TRUST_SLIDES !== 'false';
  const enableMathJax = process.env.NEXT_PUBLIC_ENABLE_MATHJAX === 'true';
  const contentRequestsMathJax = /(?:window\.)?MathJax\s*=|mathjax@|tex-mml-chtml|MathJax-script/i.test(content);
  const allowMathJaxForSlide = enableMathJax || contentRequestsMathJax;
  const injectMathJaxRuntime = enableMathJax && !contentRequestsMathJax;

  const { headHtml, bodyHtml, htmlAttrs, bodyAttrs } = useMemo(() => {
    let html = trustSlides ? content : sanitizeHtml(content);
    html = html.replace(/<script\b[^>]*src=["'][^"']*polyfill\.io[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<!doctype[^>]*>/gi, '');
    if (!allowMathJaxForSlide) {
      html = html.replace(/<script\b[^>]*src=["'][^"']*(mathjax|tex-mml-chtml)\.[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, '');
      html = html.replace(/<script\b[^>]*>\s*(?:window\.)?MathJax\s*=\s*[\s\S]*?<\/script>/gi, '');
    }
    html = stripBBoxWrappers(html);

    let extractedHead = '';
    let extractedBody = '';
    let extractedHtmlAttrs = '';
    let extractedBodyAttrs = '';

    if (typeof window !== 'undefined' && 'DOMParser' in window) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        extractedHtmlAttrs = serializeElementAttributes(doc.documentElement, ['lang']);
        if (doc.head) extractedHead = doc.head.innerHTML || '';
        extractedBodyAttrs = serializeElementAttributes(doc.body);
        if (doc.body && doc.body.innerHTML.trim()) {
          extractedBody = doc.body.innerHTML;
        } else {
          extractedBody = html
            .replace(/<\/?.?html[^>]*>/gi, '')
            .replace(/<\/?.?head[^>]*>/gi, '')
            .replace(/<\/?.?body[^>]*>/gi, '');
        }
      } catch {
        extractedBody = html;
      }
    } else {
      extractedBody = html;
    }

    return { headHtml: extractedHead, bodyHtml: extractedBody, htmlAttrs: extractedHtmlAttrs, bodyAttrs: extractedBodyAttrs };
  }, [content, trustSlides, allowMathJaxForSlide]);

  const baseHref = typeof window !== 'undefined' ? `${window.location.origin}/` : '/';
  const appStylesheetsHtml = useMemo(() => {
    if (typeof document === 'undefined') return '';
    const hrefs = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'))
      .map((l) => (l as HTMLLinkElement).getAttribute('href') || '')
      .filter(Boolean)
      .filter((href) => href.includes('/_next/static/css/'));
    return Array.from(new Set(hrefs)).map((href) => `<link rel="stylesheet" href="${href}">`).join('\n');
  }, []);

  const baseStylesHtml = presentationMode
    ? `<style>
        html, body { margin:0; padding:0; width:100%; height:100%; overflow:hidden; background-color:#0d1b2a; color:#E5E7EB; }
        #__slide_viewport { width:100%; height:100%; overflow:auto; display:flex; justify-content:center; align-items:flex-start; padding:16px; }
        #__slide_frame { display:inline-block; overflow:hidden; min-height:100%; }
        #__slide_scale { display:inline-block; transform-origin:top center; min-height:100%; }
        #__slide_content { width:100%; min-height:100%; }
      </style>`
    : `<link rel="stylesheet" href="/slide-iframe.css">
      <style>
        *, *::before, *::after { box-sizing:border-box; }
        html, body { margin:0; padding:0; width:100%; height:100%; overflow:hidden; background-color:#0d1b2a; color:#E5E7EB; font-family:'Inter',-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; line-height:1.6; }
        #__slide_viewport { width:100%; height:100%; overflow:auto; padding:0; }
        #__slide_frame { display:block; min-height:100%; }
        #__slide_scale { display:block; min-height:100%; }
        #__slide_content { min-height:100%; }
        html[data-thumbnail="true"] #__slide_frame, html[data-thumbnail="true"] #__slide_scale { display:inline-block; }
        html[data-thumbnail="true"] #__slide_viewport { overflow:hidden!important; padding:0!important; align-items:center!important; justify-content:center!important; }
        html[data-thumbnail="true"] #__slide_content, html[data-thumbnail="true"] #__slide_content * { max-width:none!important; }
        a { color:#2dd4bf; } a:visited { color:#a78bfa; }
      </style>`;

  const katexOverridesHtml = `<style>
    .katex { font-size:1.1em; color:inherit; }
    .katex-display { overflow-x:auto; overflow-y:hidden; padding:0.5rem 0; margin:0.75rem 0; text-align:center; }
    .katex-display > .katex { display:inline-block; text-align:center; white-space:nowrap; }
    .katex .mord, .katex .mbin, .katex .mrel, .katex .mopen, .katex .mclose, .katex .mpunct, .katex .minner { color:inherit; }
    .katex-html { color:inherit; }
    .katex-error { color:#f87171; font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; font-size:0.85em; background:rgba(248,113,113,0.1); padding:0.125rem 0.25rem; border-radius:0.25rem; }
  </style>`;

  const fullHtml = String.raw`<!DOCTYPE html>
<html lang="es" data-force-fit="${forceFit ? 'true' : 'false'}" data-enable-mathjax="${allowMathJaxForSlide ? 'true' : 'false'}" data-presentation-mode="${presentationMode ? 'true' : 'false'}" data-thumbnail="${thumbnail ? 'true' : 'false'}" ${htmlAttrs}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'unsafe-inline' 'unsafe-eval' https: http: data: blob:; style-src 'unsafe-inline' https: http: data:; img-src https: http: data: blob:; media-src https: http: data: blob:; font-src https: http: data:; connect-src https: http: ws: wss: data:; worker-src blob: https: http: data:; child-src https: http: data: blob:; frame-src https: http: data: blob:; object-src 'none'; base-uri 'self'">
  <base href="${baseHref}">
  ${appStylesheetsHtml}
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.css">
  ${katexOverridesHtml}
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/contrib/auto-render.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/contrib/mathtex-script-type.min.js"></script>
  ${injectMathJaxRuntime ? String.raw`
  <script>
    window.MathJax = {
      tex: { inlineMath: [['\\(', '\\)']], displayMath: [['$$', '$$'], ['\\[', '\\]']], processEscapes: true },
      options: { skipHtmlTags: ['script','noscript','style','textarea','pre','code'] },
      startup: { typeset: false }
    };
  </script>
  <script async id="MathJax-script" src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
  ` : ''}
  <script>
    (function(){
      var logWindowStart=Date.now();var logBudget=20;
      function send(l,a){
        if(l==='log'){
          var now=Date.now();
          if(now-logWindowStart>2000){logWindowStart=now;logBudget=20;}
          if(logBudget<=0)return;
          logBudget-=1;
        }
        try{parent.postMessage({__slideLog:true,level:l,args:Array.prototype.slice.call(a).map(function(x){try{return x.stack||x.message||String(x)}catch(e){return String(x)}})},"*");}catch(e){}
      }
      var levels=['log','warn','error'];
      for(var i=0;i<levels.length;i++){(function(n){var o=console[n];console[n]=function(){send(n,arguments);if(o) o.apply(console,arguments);};})(levels[i]);}
      window.addEventListener('error',function(e){
        var msg=e.message||'';
        if(msg&&(msg.indexOf('ResizeObserver loop')!==-1))return;
        if(msg==='Script error.'&&(!e.filename||e.filename==='')&&(e.lineno===0||e.lineno===undefined))return;
        send('error',[e.message,e.filename,e.lineno,e.colno]);
      });
      window.addEventListener('unhandledrejection',function(e){send('error',['unhandledrejection',e.reason&&(e.reason.stack||e.reason.message||String(e.reason))]);});
    })();
  </script>
  <script>
    (function(){
      function loadScript(src){return new Promise(function(res,rej){var s=document.createElement('script');s.src=src;s.async=true;s.onload=res;s.onerror=function(e){console.error('Failed to load',src,e);rej(e)};document.head.appendChild(s);});}
      var LIBS={
        plotly:{url:'https://cdn.plot.ly/plotly-2.30.0.min.js',global:'Plotly'},
        chartjs:{url:'https://cdn.jsdelivr.net/npm/chart.js',global:'Chart'},
        echarts:{url:'https://cdn.jsdelivr.net/npm/echarts',global:'echarts'},
        d3:{url:'https://d3js.org/d3.v7.min.js',global:'d3'},
        three:{url:'https://unpkg.com/three@0.160.0/build/three.min.js',global:'THREE'}
      };
      function detectRequested(){
        var req=new Set();
        [].slice.call(document.querySelectorAll('[data-libs]')).forEach(function(n){(n.getAttribute('data-libs')||'').split(',').map(function(s){return s.trim().toLowerCase();}).filter(Boolean).forEach(function(k){req.add(k)});});
        [['plotly','[data-plotly],.plotly'],['chartjs','[data-chartjs],canvas.chartjs'],['echarts','[data-echarts],.echarts'],['d3','[data-d3],.d3-root'],['three','[data-three],.three,canvas.three']].forEach(function(p){if(document.querySelector(p[1]))req.add(p[0]);});
        return Array.from(req);
      }
      async function ensureLibs(){var want=detectRequested();for(var i=0;i<want.length;i++){var k=want[i];var L=LIBS[k];if(!L)continue;if(!(window)[L.global]){try{await loadScript(L.url);console.log('[SLIDE] loaded',k);}catch(e){}}}}
      if(document.readyState==='complete'||document.readyState==='interactive')setTimeout(ensureLibs,0);else document.addEventListener('DOMContentLoaded',ensureLibs);
    })();
  </script>
  <script>
    (function(){
      function initMermaid(){
        if(!(window).mermaid)return;
        try{(window).mermaid.initialize({startOnLoad:false,securityLevel:'loose'});}catch(e){}
        var blocks=[].slice.call(document.querySelectorAll('pre code.language-mermaid')).concat([].slice.call(document.querySelectorAll('pre code.mermaid'))).concat([].slice.call(document.querySelectorAll('div.mermaid')));
        for(var i=0;i<blocks.length;i++){var el=blocks[i];var code=el.textContent||el.innerText||'';var id='mermaid-'+i+'-'+Math.random().toString(36).slice(2);(window).mermaid.render(id,code).then(function(res){var wrap=document.createElement('div');wrap.innerHTML=res.svg;var svg=wrap.firstElementChild;if(el.parentElement&&el.tagName.toLowerCase()==='code'&&el.parentElement.tagName.toLowerCase()==='pre'){el.parentElement.replaceWith(svg);}else{el.replaceWith(svg);}}).catch(function(err){try{console.error('Mermaid render error',err);}catch(e){}});}
      }
      if(document.readyState==='complete'||document.readyState==='interactive')setTimeout(initMermaid,0);else document.addEventListener('DOMContentLoaded',initMermaid);
    })();
  </script>
  ${headHtml}
  ${baseStylesHtml}
  ${!bodyAttrs ? '<style>#__slide_content { padding: 1.5rem; }</style>' : ''}
  <script>
    (function(){
      var forceFit=false;var isThumbnail=false;
      try{forceFit=(document.documentElement.getAttribute('data-force-fit')==='true');}catch(e){}
      try{isThumbnail=(document.documentElement.getAttribute('data-thumbnail')==='true');}catch(e){}
      function dims(el){try{var r=el&&el.getBoundingClientRect?el.getBoundingClientRect():null;var w=Math.max(el&&el.scrollWidth?el.scrollWidth:0,el&&el.offsetWidth?el.offsetWidth:0,r?r.width:0);var h=Math.max(el&&el.scrollHeight?el.scrollHeight:0,el&&el.offsetHeight?el.offsetHeight:0,r?r.height:0);return{w:w,h:h};}catch(e){return{w:0,h:0};}}
      function fit(){
        try{
          var viewport=document.getElementById('__slide_viewport');var frameEl=document.getElementById('__slide_frame');var scaleEl=document.getElementById('__slide_scale');var contentEl=document.getElementById('__slide_content');
          if(!viewport||!frameEl||!scaleEl||!contentEl)return;
          var isPresentation=false;try{isPresentation=(document.documentElement.getAttribute('data-presentation-mode')==='true');}catch(e){}
          scaleEl.style.transform='';scaleEl.style.width='';scaleEl.style.height='';
          try{contentEl.style.width='';}catch(e){}try{contentEl.style.height='';}catch(e){}try{contentEl.style.overflow='';}catch(e){}
          frameEl.style.width='';frameEl.style.height='';frameEl.style.overflow='';
          if(isThumbnail){try{viewport.style.overflow='hidden';}catch(e){}try{viewport.style.padding='0px';}catch(e){}}
          var vw=viewport.clientWidth||0;var vh=viewport.clientHeight||0;if(vw<=0||vh<=0)return;
          var padX=0;var padY=0;try{var cs=window.getComputedStyle(viewport);padX=(parseFloat(cs.paddingLeft||'0')||0)+(parseFloat(cs.paddingRight||'0')||0);padY=(parseFloat(cs.paddingTop||'0')||0)+(parseFloat(cs.paddingBottom||'0')||0);}catch(e){}
          var aw=Math.max(0,vw-padX);var ah=Math.max(0,vh-padY);if(aw<=0||ah<=0)return;
          if(isThumbnail){var baseW=1280;var baseH=720;var s0=Math.min(1,aw/baseW,ah/baseH);if(!isFinite(s0)||s0<=0)return;try{contentEl.style.width=baseW+'px';}catch(e){}try{contentEl.style.height=baseH+'px';}catch(e){}try{contentEl.style.overflow='hidden';}catch(e){}scaleEl.style.width=baseW+'px';scaleEl.style.height=baseH+'px';scaleEl.style.transformOrigin='top left';scaleEl.style.transform='scale('+s0+')';frameEl.style.width=Math.max(1,Math.round(baseW*s0))+'px';frameEl.style.height=Math.max(1,Math.round(baseH*s0))+'px';frameEl.style.overflow='hidden';return;}
          var kids=Array.prototype.slice.call(contentEl.children||[]).filter(function(n){try{var tag=(n&&n.tagName)?String(n.tagName).toUpperCase():'';return tag&&tag!=='SCRIPT'&&tag!=='STYLE';}catch(e){return false;}});
          var target=(kids.length===1)?kids[0]:contentEl;var d=dims(target);var w=d.w,h=d.h;if(!w||!h){var d2=dims(contentEl);w=w||d2.w;h=h||d2.h;}
          if(!w||!h)return;
          var s=Math.min(1,aw/w);
          if(!isFinite(s)||s<=0||s>=0.999)return;if(s<0.2)s=0.2;
          var sw=Math.max(1,Math.round(w*s));var sh=Math.max(1,Math.round(h*s));
          frameEl.style.width=sw+'px';frameEl.style.height=sh+'px';frameEl.style.overflow='visible';
          try{viewport.style.alignItems='flex-start';}catch(e){}
          scaleEl.style.width=w+'px';scaleEl.style.height=h+'px';scaleEl.style.transformOrigin='top left';scaleEl.style.transform='scale('+s+')';
        }catch(e){}
      }
      var raf=0;var timer=null;function run(){raf=0;fit();}
      function schedule(delay){try{if(timer)clearTimeout(timer);}catch(e){}if(delay&&delay>0){timer=setTimeout(function(){timer=null;schedule();},delay);return;}if(raf)return;raf=(window.requestAnimationFrame||function(cb){return setTimeout(cb,16);})(run);}
      window.__fitSlideToViewport=fit;
      window.__scheduleSlideFit=schedule;
      try{if(document.readyState!=='loading')schedule(60);else document.addEventListener('DOMContentLoaded',function(){schedule(60);});}catch(e){}
      try{window.addEventListener('load',schedule);}catch(e){}
      try{window.addEventListener('resize',schedule);}catch(e){}
      try{document.addEventListener('load',function(ev){var t=ev&&ev.target;var tag=t&&t.tagName?String(t.tagName).toUpperCase():'';if(tag==='IMG'||tag==='VIDEO'||tag==='IFRAME')schedule(80);},true);}catch(e){}
      try{setTimeout(function(){schedule();},200);setTimeout(function(){schedule();},800);setTimeout(function(){schedule();},2000);}catch(e){}
      try{var mo=new MutationObserver(function(muts){for(var i=0;i<muts.length;i++){if((muts[i].addedNodes&&muts[i].addedNodes.length)||(muts[i].removedNodes&&muts[i].removedNodes.length)){schedule(140);break;}}});var root=document.getElementById('__slide_content')||document.body;if(root)mo.observe(root,{childList:true});setTimeout(function(){try{mo.disconnect();}catch(e){}},5000);}catch(e){}
      try{if(typeof ResizeObserver==='function'){var ro=new ResizeObserver(function(){schedule(80);});var vp=document.getElementById('__slide_viewport');if(vp)ro.observe(vp);}}catch(e){}
    })();
  </script>
  <script>
    (function(){
      function start(){
        var rendering=false;var scheduled=null;
        var rendered=false;
        var allowMathJax=false;
        try{allowMathJax=(document.documentElement.getAttribute('data-enable-mathjax')==='true');}catch(e){}

        function getAutoRender(){try{return(typeof renderMathInElement==='function')?renderMathInElement:(window&&window['renderMathInElement']);}catch(e){return null;}}

        function nodeMayContainMath(node){
          try{
            if(!node)return false;
            if(node.nodeType===3){
              var text=node.nodeValue||'';
              return /\\\(|\\\[|\$\$|<script|math\/tex/i.test(text);
            }
            if(node.nodeType!==1)return false;
            var el=node;var tag=(el.tagName||'').toUpperCase();
            if(tag==='SCRIPT'){return /math\/tex/i.test(el.getAttribute('type')||'');}
            if(tag==='STYLE'||tag==='NOSCRIPT'||tag==='TEXTAREA'||tag==='PRE'||tag==='CODE'||tag==='CANVAS'||tag==='SVG')return false;
            if(el.classList&&(el.classList.contains('katex')||el.classList.contains('MathJax')))return false;
            var textContent=el.textContent||'';if(textContent.length>5000)textContent=textContent.slice(0,5000);
            return /\\\(|\\\[|\$\$/.test(textContent);
          }catch(e){return false;}
        }

        function mutationsMayContainMath(muts){
          try{
            for(var i=0;i<muts.length;i++){
              var nodes=muts[i].addedNodes||[];
              for(var j=0;j<nodes.length&&j<20;j++){if(nodeMayContainMath(nodes[j]))return true;}
            }
          }catch(e){}
          return false;
        }

        function normalizeDoubleEscapedDelimiters(root){
          try{
            var bs=String.fromCharCode(92);var dbl=bs+bs;
            var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:function(node){try{var p=node&&node.parentElement;if(!p)return NodeFilter.FILTER_REJECT;var tag=p.tagName;if(tag==='SCRIPT'||tag==='STYLE'||tag==='NOSCRIPT'||tag==='TEXTAREA')return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_ACCEPT;}catch(e){return NodeFilter.FILTER_REJECT;}}});
            var n;while((n=walker.nextNode())){var v=n.nodeValue||'';if(v.indexOf(dbl)===-1)continue;var next=v.split(dbl+'(').join(bs+'(').split(dbl+')').join(bs+')').split(dbl+'[').join(bs+'[').split(dbl+']').join(bs+']');if(next!==v)n.nodeValue=next;}
          }catch(e){}
        }

        function renderAll(force){
          if(rendering||rendered&&!force)return;rendering=true;
          try{
            var body=document.getElementById('__slide_content')||document.body;
            normalizeDoubleEscapedDelimiters(body);
            var autoRender=getAutoRender();
            var didWork=false;
            if(autoRender){
              try{
                autoRender(body,{
                  delimiters:[{left:'$$',right:'$$',display:true},{left:'\\(',right:'\\)',display:false},{left:'\\[',right:'\\]',display:true},{left:'$',right:'$',display:false}],
                  throwOnError:false,strict:'ignore',trust:true,
                  macros:{'\\\\R':'\\\\mathbb{R}','\\\\N':'\\\\mathbb{N}','\\\\Z':'\\\\mathbb{Z}','\\\\C':'\\\\mathbb{C}','\\\\F':'\\\\mathcal{F}','\\\\Laplace':'\\\\mathcal{L}','\\\\fourier':'\\\\mathfrak{F}','\\\\Re':'\\\\operatorname{Re}','\\\\Im':'\\\\operatorname{Im}'}
                });
                didWork=true;
              }catch(e){try{console.warn('[SLIDE] KaTeX autoRender error',e);}catch(e2){}}
            }
            if(allowMathJax&&window.MathJax&&window.MathJax.typesetPromise){try{didWork=true;window.MathJax.typesetPromise([body]).catch(function(e){try{console.warn('[SLIDE] MathJax typeset error',e);}catch(e2){}});}catch(e){}}
            if(didWork)rendered=true;
            try{if(window.__scheduleSlideFit)window.__scheduleSlideFit(80);else if(window.__fitSlideToViewport)window.__fitSlideToViewport();}catch(e){}
          }catch(e){}
          rendering=false;
        }

        function scheduleRender(delay,force){if(scheduled)clearTimeout(scheduled);scheduled=setTimeout(function(){scheduled=null;renderAll(!!force);},delay||120);}
        window.__renderSlideMath=function(){scheduleRender(80,true);};

        if(document.readyState==='complete'||document.readyState==='interactive'){scheduleRender(120,false);setTimeout(function(){scheduleRender(0,false);},600);setTimeout(function(){scheduleRender(0,false);},1600);}
        else{document.addEventListener('DOMContentLoaded',function(){scheduleRender(120,false);setTimeout(function(){scheduleRender(0,false);},600);setTimeout(function(){scheduleRender(0,false);},1600);});}
        window.addEventListener('load',function(){scheduleRender(120,false);});

        try{var mo2=new MutationObserver(function(muts){if(!rendering&&mutationsMayContainMath(muts))scheduleRender(180,true);});var root2=document.getElementById('__slide_content')||document.body;if(root2)mo2.observe(root2,{childList:true,subtree:true});}catch(e){}
      }
      if(document.readyState==='complete'||document.readyState==='interactive')setTimeout(start,0);else document.addEventListener('DOMContentLoaded',start);
    })();
  </script>
  <script>
    (function(){
      try{
        var isPresentation=(document.documentElement.getAttribute('data-presentation-mode')==='true');
        if(!isPresentation)return;
        var viewport=document.getElementById('__slide_viewport');if(!viewport)return;
        function isEditable(el){try{if(!el)return false;var tag=(el.tagName||'').toUpperCase();if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return true;if(el.isContentEditable)return true;}catch(e){}return false;}
        var origScrollTo=window.scrollTo;var origScrollBy=window.scrollBy;
        window.scrollTo=function(a,b){try{if(a&&typeof a==='object'){viewport.scrollTo({left:a.left||0,top:a.top||0,behavior:a.behavior||'auto'});return;}viewport.scrollTo({left:Number(a)||0,top:Number(b)||0,behavior:'auto'});}catch(e){try{if(origScrollTo)origScrollTo(a,b);}catch(e2){}}};
        window.scrollBy=function(a,b){try{if(a&&typeof a==='object'){viewport.scrollBy({left:a.left||0,top:a.top||0,behavior:a.behavior||'auto'});return;}viewport.scrollBy({left:Number(a)||0,top:Number(b)||0,behavior:'auto'});}catch(e){try{if(origScrollBy)origScrollBy(a,b);}catch(e2){}}};
        try{window.addEventListener('wheel',function(ev){try{if(!ev||ev.ctrlKey||ev.metaKey||ev.altKey)return;var dy=Number(ev.deltaY)||0;var dx=Number(ev.deltaX)||0;if(ev.deltaMode===1){dy*=16;dx*=16;}if(!dx&&!dy)return;viewport.scrollBy({left:dx,top:dy,behavior:'auto'});ev.preventDefault();}catch(e){}},{capture:true,passive:false});}catch(e){}
        try{window.addEventListener('keydown',function(ev){try{if(!ev||ev.metaKey||ev.ctrlKey||ev.altKey)return;var ael=document.activeElement;if(ael&&isEditable(ael))return;var k=ev.key;var step=Math.max(40,Math.round((viewport.clientHeight||800)*0.12));var page=Math.max(200,Math.round((viewport.clientHeight||800)*0.85));if(k==='ArrowDown'){viewport.scrollBy({top:step,left:0,behavior:'auto'});ev.preventDefault();}else if(k==='ArrowUp'){viewport.scrollBy({top:-step,left:0,behavior:'auto'});ev.preventDefault();}else if(k==='PageDown'||k===' '){viewport.scrollBy({top:page,left:0,behavior:'auto'});ev.preventDefault();}else if(k==='PageUp'){viewport.scrollBy({top:-page,left:0,behavior:'auto'});ev.preventDefault();}else if(k==='Home'){viewport.scrollTo({top:0,left:0,behavior:'auto'});ev.preventDefault();}else if(k==='End'){viewport.scrollTo({top:viewport.scrollHeight||0,left:0,behavior:'auto'});ev.preventDefault();}}catch(e){}},{capture:true});}catch(e){}
      }catch(e){}
    })();
  </script>
</head>
<body ${bodyAttrs}>
  <div id="__slide_viewport">
    <div id="__slide_frame">
      <div id="__slide_scale">
        <div id="__slide_content">${bodyHtml}</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  return (
    <iframe
      ref={ref}
      title={title}
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-pointer-lock allow-downloads"
      className="w-full h-full border-0"
      srcDoc={mounted ? fullHtml : undefined}
      suppressHydrationWarning
    />
  );
});

SlideIframe.displayName = 'SlideIframe';

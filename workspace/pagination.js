'use strict';
(function(root){
  function createHistory(){
    const seen=new Set();let oldest=null,newest=null,hasOlder=false;
    return {
      merge(page,direction){
        const fresh=page.items.filter(m=>{const id=String(m.id);if(seen.has(id))return false;seen.add(id);return true;})
          .sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1);
        for(const m of fresh){const id=String(m.id);if(oldest===null||BigInt(id)<BigInt(oldest))oldest=id;if(newest===null||BigInt(id)>BigInt(newest))newest=id;}
        if(direction!=='newer')hasOlder=page.has_more;
        return fresh;
      },get oldest(){return oldest;},get newest(){return newest;},get hasOlder(){return hasOlder;}
    };
  }
  function anchoredScroll(oldHeight,oldTop,newHeight){return oldTop+newHeight-oldHeight;}
  const exported={createHistory,anchoredScroll};if(typeof module!=='undefined')module.exports=exported;else root.WorkspacePagination=exported;
})(typeof window==='undefined'?globalThis:window);

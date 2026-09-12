// Presentation vocabulary only. Source records and exported provenance are unchanged.
export function displayCopy(value){
 return String(value).replace(/\bsynt(?:h)?etic\b/gi,word=>word===word.toUpperCase()?'SIMULATED':word[0]===word[0].toUpperCase()?'Simulated':'simulated');
}
export function formatDisplayCopy(root){
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 while(walker.nextNode())walker.currentNode.nodeValue=displayCopy(walker.currentNode.nodeValue);
 root.querySelectorAll('[aria-label],[aria-valuetext],[title],[placeholder]').forEach(el=>{
  for(const attribute of ['aria-label','aria-valuetext','title','placeholder'])if(el.hasAttribute(attribute))el.setAttribute(attribute,displayCopy(el.getAttribute(attribute)));
 });
}

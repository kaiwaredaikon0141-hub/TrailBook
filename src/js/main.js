import {pickFolder} from "./file/FolderScanner.js";
const tree=document.getElementById("tree");
document.getElementById("selectFolder").addEventListener("click",async()=>{
 try{
   const dir=await pickFolder();
   if(!dir)return;
   tree.textContent="📁 "+dir.name+"\n\n(Sprint3でツリー表示を実装)";
   document.getElementById("status").textContent="Folder selected: "+dir.name;
 }catch(e){
   console.error(e);
 }
});
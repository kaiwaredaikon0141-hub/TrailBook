export async function pickFolder(){
 if(!window.showDirectoryPicker){
   alert("このブラウザはFile System Access APIに対応していません。");
   return null;
 }
 return await window.showDirectoryPicker();
}
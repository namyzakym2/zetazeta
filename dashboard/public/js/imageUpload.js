(() => {
  async function upload(file){
    const fd=new FormData(); fd.append('image',file);
    const r=await fetch('/api/upload',{method:'POST',body:fd});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.url) throw new Error(j.error||'فشل رفع الصورة');
    return j.url;
  }
  window.zetaUploadImage=upload;
})();
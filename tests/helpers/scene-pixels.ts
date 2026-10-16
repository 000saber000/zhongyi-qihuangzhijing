import type {Page} from '@playwright/test';

// Compare visible RGB content, allowing only tiny GPU compositing roundoff.
export async function changedScenePixels(page:Page,a:Buffer,b:Buffer){
 return page.evaluate(async({a,b})=>{
  const decode=async(value:string)=>{
   const image=await createImageBitmap(new Blob([Uint8Array.from(atob(value),c=>c.charCodeAt(0))],{type:'image/png'}));
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   const context=canvas.getContext('2d')!;context.drawImage(image,0,0);image.close();return context.getImageData(0,0,canvas.width,canvas.height).data;
  };
  const first=await decode(a),second=await decode(b);if(first.length!==second.length)throw Error('scene dimensions changed');let count=0;
  for(let i=0;i<first.length;i+=4)if(Math.max(...[0,1,2].map(c=>Math.abs(first[i+c]-second[i+c])))>2)count++;
  return count;
 },{a:a.toString('base64'),b:b.toString('base64')});
}

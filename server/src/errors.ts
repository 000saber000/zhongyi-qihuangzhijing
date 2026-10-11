export class HttpError extends Error {
  constructor(public status:number,public code:string,message:string){super(message);}
}
export const invalid=()=>new HttpError(400,'BAD_INPUT','输入格式不正确，请检查后重试。');

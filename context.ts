import { Request, Response } from "express"

class NExpressContext {
  private req;
  private res;
  constructor(request: Request, response: Response) {
    this.raw = request;
    this.res = response;
  }
  
  html(str: string) {
    
  }
  
  get url() {
    return this.raw.url
  }

  

function createNExpressCtx(request: Request, response: Response) {
  return new NExpressContext(request, response)
}

export {
  createNExpressCtx
}
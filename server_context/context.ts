import { Request, Response } from "express"
import { cleanString, html } from "../html"
import { STATUS_CODES } from "./validations/response";

import { OutgoingHttpHeader, OutgoingHttpHeaders } from "http";

type StatusCode = typeof STATUS_CODES

export interface NxResponseType<R> {
  name: string;
  response: R;
  status: keyof StatusCode | StatusCode[keyof StatusCode]
}


class NExpressContext {
  private raw: Request;
  private _res: Response;
  constructor(request: Request, response: Response) {
    this.raw = request;
    this._res = response;
  }

  get statusCode() {
    return this._res.statusCode as keyof StatusCode;
  }
  
  set statusCode(code: keyof StatusCode) {
    this._res.status(code)
    this._res.statusCode = code
  }

  status(codeOrMessage: keyof StatusCode | StatusCode[keyof StatusCode]) {
    if (typeof codeOrMessage === "string") {
      const kvs = Object.entries(STATUS_CODES)

      for (const [k, v] of kvs) {
        if (v === codeOrMessage) {
          this.statusCode = Number(k) as keyof StatusCode
          break
        }
      }
    } else if (typeof codeOrMessage === "number") {
      this.statusCode = codeOrMessage
    }
    return this
  }

  send(...args: any[]) {
    this._res.send(...args)
    return this
  }

  json(body: any) {
    this._res.json(body)
    return this
  }

  
  html(str: string) {
    const h = html`${str}`

    if (h instanceof Promise) {
      h.then(str => {
        this._res.send(cleanString(str))
      })
    } else {
      this._res.send(cleanString(h))
    }
  }

  get req(): typeof this.raw {
    return this.raw
  }
  
  get url() {
    return this.raw.url
  }

  get body() {
    return this.raw.body
  }

  get params(): typeof this.req.params {
    return this.req.params
  }
  
  get path(): typeof this.req.path {
    return this.req.path
  }
  
  writeHeader(statusCode: keyof StatusCode, statusMessage?: StatusCode[keyof StatusCode] ,headers?: OutgoingHttpHeaders | OutgoingHttpHeader[]) {
    this._res.writeHead(statusCode, statusMessage, headers)
    return this
  }
}
  
function createNExpressCtx(request: Request, response: Response) {
  return new NExpressContext(request, response)
}

export {
  createNExpressCtx,
  type NExpressContext
}
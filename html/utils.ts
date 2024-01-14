import { raw } from "./shared.js"

export type StringBuffer = (string | Promise<string>)[];

var escapeRgx = /[&<>'"]/;

async function stringBufferToString (buffer: StringBuffer) {
  let str = "";
  const callbacks = [];
  
  for (let i = buffer.length - 1; ; i--) {
    str += buffer[i];
    i--;
    
    if (i < 0) {
      break;
    }
    
    let r = await buffer[i];
    
    if (typeof r === "object") {
      callbacks.push(...r.callbacks || []);
    }
    
    const isEscaped = r.isEscaped;
    r = await (typeof r === "object" ? r.toString() : r);
    
    if (typeof r === "object") {
      callbacks.push(...r.callbacks || []);
    }
    
    if (r.isEscaped ?? isEscaped) {
      str += r;
    } else {
      const buf = [str];
      escapeToBuffer(r, buf);
      str = buf[0];
    }
  }
  
  return raw(str, callbacks);
};


function escapeToBuffer (str: string, buffer: StringBuffer) {

  const match = str.search(escapeRgx);
  if (match === -1) {
    buffer[0] += str;
    return;
  }
  let escape;
  let index;
  let lastIndex = 0;
  
  for (index = match; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      case 34:
        escape = "&quot;";
        break;
      case 39:
        escape = "&#39;";
        break;
      case 38:
        escape = "&amp;";
        break;
      case 60:
        escape = "&lt;";
        break;
      case 62:
        escape = "&gt;";
        break;
      default:
        continue;
    }
    
    buffer[0] += str.substring(lastIndex, index) + escape;
    lastIndex = index + 1;
  }
  
  buffer[0] += str.substring(lastIndex, index);
};

export {
  stringBufferToString,
  escapeToBuffer
}
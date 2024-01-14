import { escapeToBuffer, stringBufferToString } from "./utils.js"
import { raw } from "./shared.js"

function html (strings, ...values: unknown[]) {
  const buffer: (string | Promise<string>)[] = [""];
  
  for (let idx = 0, len = strings.length - 1; idx < len; idx++) {
    buffer[0] += strings[idx];
    const children = values[idx] instanceof Array ? values[idx].flat(Infinity) : [values[idx]];
    
    for (let idx_2 = 0, len2 = children.length; idx_2 < len2; idx_2++) {
      const child = children[idx_2];
      
      if (typeof child === "string") {
        escapeToBuffer(child, buffer);
      } else if (typeof child === "boolean" || child === null || child === void 0) {
        continue;
      } else if (typeof child === "object" && child.isEscaped || typeof child === "number") {
        const tmp = child.toString();
        if (tmp instanceof Promise) {
          buffer.unshift("", tmp);
        } else {
          buffer[0] += tmp;
        }
      } else if (child instanceof Promise) {
        buffer.unshift("", child);
      } else {
        escapeToBuffer(child.toString(), buffer);
      }
    }
  }
  
  buffer[0] += strings[strings.length - 1];
  
  return buffer.length === 1 ? raw(buffer[0]) : stringBufferToString(buffer);
};

export {
  html,
  raw,
  escapeToBuffer,
  stringBufferToString
}
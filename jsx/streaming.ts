import { Readable } from "node:stream"
import { raw } from "../html/index.js";
import { HtmlEscapedCallbackPhase, resolveCallback } from "../html/utils.js";
import { childrenToString } from "./components.js";

let suspenseCounter = 0;

async function Suspense ({ children, fallback }) {
  if (!children) {
    return fallback.toString();
  }
  if (!Array.isArray(children)) {
    children = [children];
  }
  let resArray = [];
  try {
    resArray = children.map((child) => child.toString());
  } catch (err) {
    if (err instanceof Promise) {
      resArray = [err.then(() => childrenToString(children))];
    } else {
      throw err;
    }
  }
  
  if (resArray.some((res) => res instanceof Promise)) {
    const index = suspenseCounter++;
    const fallbackStr = await fallback.toString();
    return raw(`<template id="H:${index}"></template>${fallbackStr}<!--/$-->`, [
      ...fallbackStr.callbacks || [],
      ({ phase, buffer, context }) => {
        if (phase === HtmlEscapedCallbackPhase.BeforeStream) {
          return;
        }
        return Promise.all(resArray).then(async (htmlArray) => {
          htmlArray = htmlArray.flat();
          const content = htmlArray.join("");
          if (buffer) {
            buffer[0] = buffer[0].replace(
              new RegExp(`<template id="H:${index}"></template>.*?<!--/\\$-->`),
              content
            );
          }
          let html = buffer ? "" : `<template>${content}</template><script>
((d,c,n) => {
c=d.currentScript.previousSibling
d=d.getElementById('H:${index}')
if(!d)return
do{n=d.nextSibling;n.remove()}while(n.nodeType!=8||n.nodeValue!='/$')
d.replaceWith(c.content)
})(document)
<\/script>`;
          const callbacks = htmlArray.map((html2) => html2.callbacks || []).flat();
          if (!callbacks.length) {
            return html;
          }
          if (phase === HtmlEscapedCallbackPhase.Stream) {
            html = await resolveCallback(html, HtmlEscapedCallbackPhase.BeforeStream, true, context);
          }
          return raw(html, callbacks);
        });
      }
    ]);
  } else {
    return raw(resArray.join(""));
  }
};


const textEncoder = new TextEncoder();

// function renderToReadableStream (str) {
//   const reader = new ReadableStream({
//     async start(controller) {
//       const tmp = str instanceof Promise ? await str : await str.toString();
//       const context = typeof tmp === "object" ? tmp : {};
//       const resolved = await resolveCallback(
//         tmp,
//         HtmlEscapedCallbackPhase.BeforeStream,
//         true,
//         context
//       );
//       controller.enqueue(textEncoder.encode(resolved));
//       let resolvedCount = 0;
//       const callbacks = [];
//       const then = (promise) => {
//         callbacks.push(
//           promise.catch((err) => {
//             console.trace(err);
//             return "";
//           }).then(async (res) => {
//             res = await resolveCallback(res, HtmlEscapedCallbackPhase.BeforeStream, true, context);
//             res.callbacks?.map((c) => c({ phase: HtmlEscapedCallbackPhase.Stream, context })).filter(Boolean).forEach(then);
//             resolvedCount++;
//             controller.enqueue(textEncoder.encode(res));
//           })
//         );
//       };
//       resolved.callbacks?.map((c) => c({ phase: HtmlEscapedCallbackPhase.Stream, context })).filter(Boolean).forEach(then);
//       while (resolvedCount !== callbacks.length) {
//         await Promise.all(callbacks);
//       }
//       controller.close();
//     }
//   });
  
//   return reader;
// };


function renderToReadableStream(str) {
  return new Readable({
    async read(size) {
      try {
        const tmp = str instanceof Promise ? await str : await str.toString();
        const context = typeof tmp === "object" ? tmp : {};
        const resolved = await resolveCallback(
          tmp,
          HtmlEscapedCallbackPhase.BeforeStream,
          true,
          context
        );

        // Check if the stream has been destroyed before pushing data
        if (!this.destroyed) {
          this.push(Buffer.from(textEncoder.encode(resolved)));

          let resolvedCount = 0;
          const callbacks = [];

          const then = (promise) => {
            callbacks.push(
              promise.catch((err) => {
                console.trace(err);
                return "";
              }).then(async (res) => {
                res = await resolveCallback(res, HtmlEscapedCallbackPhase.BeforeStream, true, context);
                res.callbacks?.map((c) => c({ phase: HtmlEscapedCallbackPhase.Stream, context })).filter(Boolean).forEach(then);
                resolvedCount++;

                // Check if the stream has been destroyed before pushing data
                if (!this.destroyed) {
                  this.push(Buffer.from(res));
                }
              })
            );
          };

          resolved.callbacks?.map((c) => c({ phase: HtmlEscapedCallbackPhase.Stream, context })).filter(Boolean).forEach(then);

          while (resolvedCount !== callbacks.length) {
            await Promise.all(callbacks);
          }

          // Check if the stream has been destroyed before pushing null to end the stream
          if (!this.destroyed) {
            this.push(null);
          }
        }
      } catch (error) {
        // Handle errors appropriately
        console.error(error);
        this.destroy(error);
      }
    }
  });
}


export {
  Suspense,
  renderToReadableStream
};

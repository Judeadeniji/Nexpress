import path from "node:path"
import fs from "node:fs"
import { Fragment, jsx } from "./index.js"
import { global_ctx } from "../server_context/context.js"
import { route_map } from "../router.js"
import { raw } from "../html/index.js";
import { HtmlEscapedCallbackPhase, resolveCallback } from "../html/utils.js";

let errorBoundaryCounter = 0;

async function childrenToString (children) {
  try {
    return children.map((child) => child.toString());
  } catch (err) {
    if (err instanceof Promise) {
      await err;
      return childrenToString(children);
    } else {
      throw err;
    }
  }
};


async function ErrorBoundary ({ children, fallback, fallbackRender, onError }) {
  if (!children) {
    return raw("");
  }
  
  if (!Array.isArray(children)) {
    children = [children];
  }
  
  let fallbackStr;
  
  const fallbackRes = (error) => {
    onError?.(error);
    return (fallbackStr || fallbackRender?.(error) || "").toString();
  };
  
  let resArray = [];
  
  try {
    resArray = children.map((child) => child.toString());
  } catch (err) {
    fallbackStr = await fallback?.toString();
    if (err instanceof Promise) {
      resArray = [
        err.then(() => childrenToString(children)).catch((err2) => fallbackRes(err2))
      ];
    } else {
      resArray = [fallbackRes(err)];
    }
  }
  
  if (resArray.some((res) => res instanceof Promise)) {
    fallbackStr || (fallbackStr = await fallback?.toString());
    const index = errorBoundaryCounter++;
    const replaceRe = RegExp(`(<template id="E:${index}"></template>.*?)(.*?)(<!--E:${index}-->)`);
    const caught = false;
    const catchCallback = ({ error, buffer }) => {
      if (caught) {
        return "";
      }
      const fallbackResString = fallbackRes(error);
      if (buffer) {
        buffer[0] = buffer[0].replace(replaceRe, fallbackResString);
      }
      return buffer ? "" : `<template>${fallbackResString}</template><script>
((d,c,n) => {
c=d.currentScript.previousSibling
d=d.getElementById('E:${index}')
if(!d)return
do{n=d.nextSibling;n.remove()}while(n.nodeType!=8||n.nodeValue!='E:${index}')
d.replaceWith(c.content)
})(document)
<\/script>`;
    };
    return raw(`<template id="E:${index}"></template><!--E:${index}-->`, [
      ({ phase, buffer, context }) => {
        if (phase === HtmlEscapedCallbackPhase.BeforeStream) {
          return;
        }
        return Promise.all(resArray).then(async (htmlArray) => {
          htmlArray = htmlArray.flat();
          const content = htmlArray.join("");
          let html = buffer ? "" : `<template>${content}</template><script>
((d,c) => {
c=d.currentScript.previousSibling
d=d.getElementById('E:${index}')
if(!d)return
d.parentElement.insertBefore(c.content,d.nextSibling)
})(document)
<\/script>`;
          if (htmlArray.every((html2) => !html2.callbacks?.length)) {
            if (buffer) {
              buffer[0] = buffer[0].replace(replaceRe, content);
            }
            return html;
          }
          if (buffer) {
            buffer[0] = buffer[0].replace(
              replaceRe,
              (_all, pre, _, post) => `${pre}${content}${post}`
            );
          }
          const callbacks = htmlArray.map((html2) => html2.callbacks || []).flat();
          if (phase === HtmlEscapedCallbackPhase.Stream) {
            html = await resolveCallback(
              html,
              HtmlEscapedCallbackPhase.BeforeStream,
              true,
              context
            );
          }
          let resolvedCount = 0;
          const promises = callbacks.map(
            (c) => (...args) => c(...args)?.then((content2) => {
              resolvedCount++;
              if (buffer) {
                if (resolvedCount === callbacks.length) {
                  buffer[0] = buffer[0].replace(replaceRe, (_all, _pre, content3) => content3);
                }
                buffer[0] += content2;
                return raw("", content2.callbacks);
              }
              return raw(
                content2 + (resolvedCount !== callbacks.length ? "" : `<script>
((d,c,n) => {
d=d.getElementById('E:${index}')
if(!d)return
n=d.nextSibling
do{n=n.nextSibling}while(n.nodeType!=8||n.nodeValue!='E:${index}')
n.remove()
d.remove()
})(document)
<\/script>`),
                content2.callbacks
              );
            }).catch((error) => catchCallback({ error, buffer }))
          );
          return raw(html, promises);
        }).catch((error) => catchCallback({ error, buffer }));
      }
    ]);
  } else {
    return raw(resArray.join(""));
  }
};

interface HtmlDocumentHeaderProps {
  children?: JSX.Element[]
}

function HtmlDocumentHeader(props: HtmlDocumentHeaderProps) {
  return (
    jsx('head', {
      ...props
    })
  )
}

function HtmlDocument({ children }: { children?: JSX.Element[]; }) {
  return (
    jsx(Fragment, {
      children: [
        jsx('html', {
          lang: "en",
          children
        }),
      ]
    })
  )
}

function useRoute() {
  if (!global_ctx.req) {
    throw new Error("Cannot use useRoute() before initial render.")
  }
  const { route, params } = global_ctx.req
  
  return {
    path: route.path,
    params: {...params}
  }
}

function StyleTag() {
  const css_path = path.join(route_map.get(useRoute().path), "styles.css")
  let css_string = ""
  try {
    css_string = fs.readFileSync(css_path, "utf-8")
  } catch (e) {
    console.error(e)
  }
  
  return jsx("style", {
    dangerouslySetInnerHTML: {
      __html: css_string.trim()
    },
    children: []
  })
}

export { Suspense } from "./streaming-2.js"

export {
  ErrorBoundary,
  HtmlDocument,
  HtmlDocumentHeader,
  HtmlDocumentHeaderProps,
  StyleTag,
  childrenToString
}
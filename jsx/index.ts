// /jsx/index.ts

import { raw, html, escapeToBuffer, stringBufferToString } from "../html/index.js";
import { StringBuffer } from "../html/utils.js";
import { JSXTag } from "../types.js";

const VOIDTAGS = [
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
] as const;

const BOOLEANATTRIBUTES = [
  "allowfullscreen",
  "async",
  "autofocus",
  "autoplay",
  "checked",
  "controls",
  "default",
  "defer",
  "disabled",
  "formnovalidate",
  "hidden",
  "inert",
  "ismap",
  "itemscope",
  "loop",
  "multiple",
  "muted",
  "nomodule",
  "novalidate",
  "open",
  "playsinline",
  "readonly",
  "required",
  "reversed",
  "selected"
] as const;

function childrenToStringToBuffer (children: JSX.JSXProps['children'], buffer: StringBuffer) {
  if (!children) {
    throw new Error("No children provided, this is a bug in Nexpress. Please report it.");
  }

  if (!Array.isArray(children)) {
    children = [children]
  }

  for (let i = 0, len = children.length; i < len; i++) {
    const child = children[i];
    if ((typeof child === "string") || child.constructor?.name?.toLowerCase?.() === "string") {
      escapeToBuffer(child as any, buffer);
    } else if (typeof child === "boolean" || child === null || child === undefined) {
      continue;
    } else if (child instanceof JSXNode) {
      child.toStringToBuffer(buffer);
    } else if (typeof child === "number" || (child instanceof JSXNode) && child.isEscaped) {
      ;
      buffer[0] += child;
    } else if (child instanceof Promise) {
      buffer.unshift("", child);
    } else {
      childrenToStringToBuffer(child as any, buffer);
    }
  }
};

class JSXNode  {
  isEscaped: boolean;
  tag: JSXTag;
  props: JSX.JSXProps;
  children: any;
  
  constructor(tag: JSXTag, jsxProps: JSX.JSXProps) {
    this.isEscaped = true;
    this.tag = tag;
    this.props = jsxProps;
    this.children = jsxProps.children || [];
    delete this.props["children"]
  }
  
  toString() {
    const buffer = [""];
    this.toStringToBuffer(buffer);
    return buffer.length === 1 ? buffer[0] : stringBufferToString(buffer);
  }
  
  toStringToBuffer(buffer: StringBuffer) {

    const tag = this.tag;
    const props = this.props;
    let { children } = this;
    buffer[0] += `<${tag}`;
    const propsKeys = Object.keys(props || {});
    for (let i = 0, len = propsKeys.length; i < len; i++) {
      const key = propsKeys[i];
      const v = props[key];
      if (key === "style" && typeof v === "object") {
        const styles = Object.keys(v).map((k) => {
          const property = k.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
          return `${property}:${v[k]}`;
        }).join(";");
        buffer[0] += ` style="${styles}"`;
      } else if (typeof v === "string") {
        buffer[0] += ` ${key}="`;
        escapeToBuffer(v, buffer);
        buffer[0] += '"';
      } else if (v === null || v === undefined) {
      } else if (typeof v === "number" || v.isEscaped) {
        buffer[0] += ` ${key}="${v}"`;
      } else if (typeof v === "boolean" && BOOLEANATTRIBUTES.includes(key as any)) {
        if (v) {
          buffer[0] += ` ${key}=""`;
        }
      } else if (key === "dangerouslySetInnerHTML") {
        if (children.length > 0) {
          throw "Can only set one of `children` or `props.dangerouslySetInnerHTML`.";
        }
        children = [raw(v.__html)];
      } else if (v instanceof Promise) {
        buffer[0] += ` ${key}="`;
        buffer.unshift('"', v);
      } else {
        buffer[0] += ` ${key}="`;
        escapeToBuffer(v.toString(), buffer);
        buffer[0] += '"';
      }
    }
    if (VOIDTAGS.includes(tag as any)) {
      buffer[0] += "/>";
      return;
    }
    buffer[0] += ">";
    childrenToStringToBuffer(children, buffer);
    buffer[0] += `</${tag}>`;
  }
};

class JSXFunctionNode extends JSXNode {
  //@ts-ignore
  tag!: (props: JSX.JSXProps) => JSXNode | Promise<JSXNode>;
  props!: JSX.JSXProps;
  toStringToBuffer(buffer: StringBuffer) {
    const { children } = this;
    const res = this.tag.call(null, {
      ...this.props,
      children: children.length <= 1 ? children[0] : children
    });
    if (res instanceof Promise) {
      buffer.unshift("", res);
    } else if (res instanceof JSXNode) {
      res.toStringToBuffer(buffer);
      // @ts-ignore
    } else if (typeof res === "number" || res.isEscaped) {
      buffer[0] += res;
    } else {
      escapeToBuffer(res, buffer);
    }
  }
};

 class JSXFragmentNode extends JSXNode {
  toStringToBuffer(buffer: StringBuffer) {
    childrenToStringToBuffer(this.children, buffer);
  }
};

function jsxFn(tag: JSXTag, props: JSX.JSXProps) {
  if (typeof tag === "function") {
    return new JSXFunctionNode(tag, props);
  } else {
    return new JSXNode(tag, props);
  }
};

function jsxAttr (name: string, value: any) {
  return raw(name + '="' + html`${value}` + '"');
}

const jsxEscape = (value: any) => value;

const shallowEqual = (a, b) => {
  if (a === b) {
    return true;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (let i = 0, len = aKeys.length; i < len; i++) {
    if (a[aKeys[i]] !== b[aKeys[i]]) {
      return false;
    }
  }
  return true;
};

function memo(component, propsAreEqual = shallowEqual) {
  let computed = undefined;
  let prevProps = undefined;
  return (props) => {
    if (prevProps && !propsAreEqual(prevProps, props)) {
      computed = undefined;
    }
    prevProps = props;
    return computed || (computed = component(props));
  };
};

function Fragment (props) {
  return new JSXFragmentNode("", {  children: props.children ? [props.children] : [] });
};

function createContext<CtxType>(defaultValue: CtxType) {
  const values: CtxType[] = [defaultValue];
  return {
    values,
    Provider(props: JSX.JSXProps & { value: CtxType }) {
      values.push(props.value);
      const string: any = props.children ? (Array.isArray(props.children) ? new JSXFragmentNode("", { children: props.children }) : props.children).toString() : "";
      values.pop();
      //@ts-ignore
      if (string instanceof Promise) {
        return Promise.resolve().then(async () => {
          values.push(props.value);
          const awaited = await string;
          const promiseRes = raw(awaited, awaited.callbacks);
          values.pop();
          return promiseRes;
        });
      } else {
        return raw(string);
      }
    }
  };
};

function useContext(context: ReturnType<typeof createContext>) {
  return context.values[context.values.length - 1];
};

export { renderToReadableStream } from "./streaming.js"

export {
  Fragment,
  JSXNode,
  createContext,
  jsxFn as jsx,
  jsxFn as jsxDev,
  jsxFn as jsxs,
  jsxAttr,
  jsxEscape,
  memo,
  useContext
};
// export * from "./jsx-runtime.js"
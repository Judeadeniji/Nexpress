// /jsx/index.ts

import { raw, html, escapeToBuffer, stringBufferToString } from "../html/index.js";
import { ErrorBoundary } from "./components.js";

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
];

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
];

var childrenToStringToBuffer = (children, buffer) => {
  for (let i = 0, len = children.length; i < len; i++) {
    const child = children[i];
    if (typeof child === "string") {
      escapeToBuffer(child, buffer);
    } else if (typeof child === "boolean" || child === null || child === void 0) {
      continue;
    } else if (child instanceof JSXNode) {
      child.toStringToBuffer(buffer);
    } else if (typeof child === "number" || child.isEscaped) {
      ;
      buffer[0] += child;
    } else if (child instanceof Promise) {
      buffer.unshift("", child);
    } else {
      childrenToStringToBuffer(child, buffer);
    }
  }
};

var JSXNode = class {
  
  constructor(tag, jsxProps) {
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
  
  toStringToBuffer(buffer) {
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
      } else if (v === null || v === void 0) {
      } else if (typeof v === "number" || v.isEscaped) {
        buffer[0] += ` ${key}="${v}"`;
      } else if (typeof v === "boolean" && BOOLEANATTRIBUTES.includes(key)) {
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
    if (VOIDTAGS.includes(tag)) {
      buffer[0] += "/>";
      return;
    }
    buffer[0] += ">";
    childrenToStringToBuffer(children, buffer);
    buffer[0] += `</${tag}>`;
  }
};

var JSXFunctionNode = class extends JSXNode {
  toStringToBuffer(buffer) {
    const { children } = this;
    const res = this.tag.call(null, {
      ...this.props,
      children: children.length <= 1 ? children[0] : children
    });
    if (res instanceof Promise) {
      buffer.unshift("", res);
    } else if (res instanceof JSXNode) {
      res.toStringToBuffer(buffer);
    } else if (typeof res === "number" || res.isEscaped) {
      buffer[0] += res;
    } else {
      escapeToBuffer(res, buffer);
    }
  }
};
var JSXFragmentNode = class extends JSXNode {
  toStringToBuffer(buffer) {
    childrenToStringToBuffer(this.children, buffer);
  }
};

var jsxFn = (tag, props, c) => {
  if (typeof tag === "function") {
    return new JSXFunctionNode(tag, props);
  } else {
    return new JSXNode(tag, props);
  }
};
var jsxAttr = (name, value) => raw(name + '="' + html`${value}` + '"');
var jsxEscape = (value) => value;

var shallowEqual = (a, b) => {
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

var memo = (component, propsAreEqual = shallowEqual) => {
  let computed = void 0;
  let prevProps = void 0;
  return (props) => {
    if (prevProps && !propsAreEqual(prevProps, props)) {
      computed = void 0;
    }
    prevProps = props;
    return computed || (computed = component(props));
  };
};

var Fragment = (props) => {
  return new JSXFragmentNode("", {  children: props.children ? [props.children] : [] });
};

var createContext = (defaultValue) => {
  const values = [defaultValue];
  return {
    values,
    Provider(props) {
      values.push(props.value);
      const string = props.children ? (Array.isArray(props.children) ? new JSXFragmentNode("", { children: props.children }) : props.children).toString() : "";
      values.pop();
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

var useContext = (context) => {
  return context.values[context.values.length - 1];
};

export {
  ErrorBoundary,
  Fragment,
  JSXNode,
  createContext,
  jsxFn as jsx,
  jsxFn as jsxDev,
  jsxFn as jsxs,
  memo,
  useContext
};
// export * from "./jsx-runtime.js"
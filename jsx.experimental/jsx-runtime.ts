
const VOIDTAGS = [
  "area", "base", "br", "col", "embed", "hr", "img", "input", "keygen",
  "link", "meta", "param", "source", "track", "wbr",
] as const;

const BOOLEANATTRIBUTES = [
  "allowfullscreen", "async", "autofocus", "autoplay", "checked", "controls",
  "default", "defer", "disabled", "formnovalidate", "hidden", "inert", "ismap",
  "itemscope", "loop", "multiple", "muted", "nomodule", "novalidate", "open",
  "playsinline", "readonly", "required", "reversed", "selected"
] as const;

type VoidTags = typeof VOIDTAGS;

type BooleanAttributes = typeof BOOLEANATTRIBUTES;

type IntrinsicElementsDefined = HTMLElement & {
    [x in keyof HTMLElementTagNameMap]?: HTMLElementTagNameMap[x] | JSX.JSXProps;
} & {
    [x in keyof HTMLElementDeprecatedTagNameMap]?: HTMLElementDeprecatedTagNameMap[x];
};

declare global {
  namespace JSX {
    interface Element extends JSXNode {}
    interface ElementAttributesProperty {
      props: {
        children?: any[]
      };
    }
    interface IntrinsicAttributes {
      key?: string | number;
    }
    interface JSXProps {
      [key: string]: any;
      children?: any[];
    }
    interface IntrinsicElements extends IntrinsicElementsDefined {}
  }
}

export type BufferItem = string | Promise<string | JSXNode[]>;

class JSXNode {
  tag: string | ((props: JSX.JSXProps) => any);
  props: JSX.JSXProps;
  children: (JSXNode | string | number | Promise<any>)[];

  constructor(tag: string, props: JSX.JSXProps, ...children: (JSXNode | string | Promise<JSXNode | string>)[]) {
    this.tag = tag;
    this.props = props;
    this.children = children.flat();
  }

  toString(serializer?: Function): BufferItem {
    const buffer: BufferItem[] = [""];
    this.toStringToBuffer(buffer);
    return buffer.length === 1 ? buffer[0] : serializer ? serializer(buffer) : stringBufferToString(buffer);
  }

  toStringToBuffer(buffer: BufferItem[]): void {
    const { tag, props } = this;

    buffer[0] += `<${tag}`;

    for (const key in props) {
      if (key === "children" || typeof props[key] === "function") continue;
      const value = props[key];

      if (key === "style" && typeof value === "object") {
        const styles = Object.entries(value).map(([k, v]) => {
          const property = k.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
          return `${property}:${v}`;
        }).join("; ");
        buffer[0] += ` ${key}="${styles.trim()}"`;
      } else if (key.startsWith('bind:')) {
        bindPropsToBuffer.call(this, key.split(":")[1], value, buffer);
      } else if (value === null || value === undefined) {
      } else if (typeof value === "number" || value.isEscaped) {
        buffer[0] += ` ${key}="${value}"`;
      } else if (typeof value === "boolean" && BOOLEANATTRIBUTES.includes(key as any)) {
        if (value) {
          buffer[0] += ` ${key}=""`;
        }
      } else {
        buffer[0] += ` ${key}="${value}"`;
      }
    }

    if (VOIDTAGS.includes(tag as any)) {
      buffer[0] += " />";
      return;
    }

    buffer[0] += ">";

    childrenToStringToBuffer(this.children, buffer);

    buffer[0] += `</${tag}>`;
  }
}

class JSXFunctionNode extends JSXNode {
  toStringToBuffer(buffer: BufferItem[]) {
    const { children, props } = this;

    const res = (this.tag as Function).call(this, { ...props, children });

    if (res instanceof Promise) {
      buffer.unshift("", res);
    } else if (res instanceof JSXNode) {
      res.toStringToBuffer(buffer);
    } else if (Array.isArray(res)) {
      childrenToStringToBuffer(res, buffer);
    } else {
      buffer[0] += res;
    }
  }
}

class JSXFragmentNode extends JSXNode {
  toStringToBuffer(buffer: BufferItem[]) {
    childrenToStringToBuffer(this.children, buffer);
  }
}

function Fragment (props: { children : any[] }) {
  return new JSXFragmentNode("", {}, ...props.children);
};


function jsxAttr (name: string, value: any) {
  return raw(name + '="' + /*html*/`${value}` + '"');
}

const jsxEscape = (value: any) => value;


function jsx(tag: string | ((props: JSX.JSXProps) => JSXNode), props: JSX.JSXProps): JSXNode {
  const { children, ...p } = props
  const node = typeof tag === "function" ?
    new JSXFunctionNode(tag as any, props, ...[children].flat()) :
    new JSXNode(tag, props, ...[children].flat());

  return node;
}

async function stringBufferToString(buffer: BufferItem[]): Promise<string> {
  let str = '';

  for (const buf of buffer.reverse()) {
    if (typeof buf === 'string') {
      str += buf;
    } else if (buf instanceof Promise) {
      const res = await buf;

      if (typeof res === "string") {
        str += await res;
      } else if (res instanceof JSXNode) {
        str += await res.toString();
      }
    }
  }

  return str;
}

function childrenToStringToBuffer(children: any[], buffer: BufferItem[]): void {
  for (const child of children) {
    if (!child) continue;
    if (child instanceof JSXNode) {
      child.toStringToBuffer(buffer);
    } else if (child instanceof Promise) {
      buffer.unshift("", child);
    } else {
      buffer[0] += child;
    }
  }
}

function bindPropsToBuffer(this: JSXNode, key: string, value: unknown, buffer: BufferItem[]): void {
  if (key === "html") {
    const html = raw(value);
    if (this.children.length > 0) {
      throw "Can only set one of `children` or `bind:html`.";
    }
    this.children = [raw(html) as string];
  }
}

function raw(value: unknown) {
  const escapedString = new String(value);
  // @ts-ignore
  escapedString.isEscaped = true;
  return escapedString;
}

function renderToString(j: JSXNode, cb: (str: string) => void) {
  const str = j.toString()
  
  if (str instanceof Promise) {
    str.then(s => cb(s as string))
    return;
  }
  
  cb(str)
}

export {
  jsx,
  jsx as jsxDEV,
  jsx as jsxDEV2,
  jsxEscape,
  jsxAttr,
  jsx as jsxs,
  raw,
  Fragment,
  renderToString,
  stringBufferToString,
  JSXNode
}
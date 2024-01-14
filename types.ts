import { JSXNode } from "./jsx/index.js";
import { type NExpressContext } from "./server_context/index.js"

// declare a global JSX namespace
declare global {
    namespace JSX {
        type IntrinsicElements = HTMLElement & {
            [x in keyof HTMLElementTagNameMap]: HTMLElementTagNameMap[x];
        } & {
            [x in keyof HTMLElementDeprecatedTagNameMap]: HTMLElementDeprecatedTagNameMap[x];
        };
        interface Element {}
        interface JSXProps {
            children?: (JSX.Element| typeof JSXNode | string)[];
            [x: string]: any;
        }
    }
}

type Handler = (ctx: NExpressContext) => void

export type MethodExport = Handler | Handler[];

export interface MethodExports {
    get?: MethodExport;
    post?: MethodExport;
    put?: MethodExport;
    patch?: MethodExport;
    delete?: MethodExport;
    head?: MethodExport;
    connect?: MethodExport;
    options?: MethodExport;
    trace?: MethodExport;

    [x: string]: MethodExport | undefined;
}

export type Exports = MethodExports & {
    default?: any;
};

export interface RouterOptions {
    directory?: string;
}

export interface File {
    name: string;
    path: string;
    rel: string;
}

export interface Route {
    url: string;
    priority: number;
    exports: Exports;
}

export type JSXTag = string | ((props: any) => JSX.Element);

export {
    JSX
}
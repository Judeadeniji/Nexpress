export declare const HtmlEscapedCallbackPhase: {
  readonly Stringify: 1;
  readonly BeforeStream: 2;
  readonly Stream: 3;
};

type HtmlEscapedCallbackOpts = {
  buffer?: [string];
  phase: typeof HtmlEscapedCallbackPhase[keyof typeof HtmlEscapedCallbackPhase];
  context: object;
};

export type HtmlEscapedCallback = (opts: HtmlEscapedCallbackOpts) => Promise<string> | undefined;

export type HtmlEscaped = {
  isEscaped: true;
  callbacks?: HtmlEscapedCallback[];
};

export type HtmlEscapedString = string & HtmlEscaped;


function raw(value: unknown, callbacks?: HtmlEscapedCallback[]) {
  const escapedString = new String(value) as HtmlEscapedString;

  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;

  return escapedString as HtmlEscapedString;
};

export {
  raw
}
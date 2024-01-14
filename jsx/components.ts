import { Fragment, jsx } from "./index.js"

function ErrorBoundary() {}

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

export {
  ErrorBoundary,
  HtmlDocument,
  HtmlDocumentHeader,
  HtmlDocumentHeaderProps
}
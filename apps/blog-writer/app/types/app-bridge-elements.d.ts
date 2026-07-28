/**
 * The App Bridge save bar element, which the admin defines at runtime.
 * `@shopify/app-bridge-react` declares it on the deprecated global JSX namespace only, which React 19 no longer
 * resolves, so the element is declared here where the React namespace can see it.
 */
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "ui-save-bar": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        discardconfirmation?: boolean
        id?: string
      }
    }
  }
}

export {}

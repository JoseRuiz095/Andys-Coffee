declare namespace JSX {
  interface IntrinsicElements {
    'l-bouncy': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      size?: string
      speed?: string
      color?: string
    }
  }
}
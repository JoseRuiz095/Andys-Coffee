import React from 'react'

interface IngredientIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number
}

export function IngredientIcon({ size = 24, ...props }: IngredientIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6 4h12v10H6z" />
      <path d="M6 14h12c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2z" />
      <path d="M10 7v4" />
      <path d="M14 7v4" />
      <path d="M6 16h12" />
    </svg>
  )
}

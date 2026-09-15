import React from 'react'

interface SupplierIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number
}

export function SupplierIcon({ size = 24, ...props }: SupplierIconProps) {
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
      <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7" />
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2" />
      <path d="M9 3v4" />
      <path d="M15 3v4" />
      <path d="M7 13h10" />
      <path d="M7 17h10" />
    </svg>
  )
}

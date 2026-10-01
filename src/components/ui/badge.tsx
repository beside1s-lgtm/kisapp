import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-2xs",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-2xs",
        pointRed:
          "border-transparent bg-[#b01e23] text-white hover:bg-[#93181d] shadow-2xs",
        subGold:
          "border-transparent bg-[#c49832] text-white hover:bg-[#a88127] shadow-2xs",
        subtleBlue:
          "border border-[#2471b2]/30 bg-[#eef6fc] text-[#2471b2] font-semibold",
        subtleGold:
          "border border-[#c49832]/30 bg-[#fcf8ee] text-[#8a681c] font-semibold",
        subtleRed:
          "border border-[#b01e23]/30 bg-[#fdf2f2] text-[#b01e23] font-semibold",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

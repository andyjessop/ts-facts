import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "../../lib/utils";

const badgeVariants = cva(
	"inline-flex items-center border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
	{
		variants: {
			variant: {
				default:
					"border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
				secondary:
					"border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
				destructive:
					"border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
				outline: "text-foreground",
				person: "border-transparent bg-chart-1 text-white hover:bg-chart-1/80",
				team: "border-transparent bg-chart-2 text-white hover:bg-chart-2/80",
				system:
					"border-transparent bg-chart-3 text-secondary-foreground hover:bg-chart-3/80",
				concept:
					"border-transparent bg-chart-4 text-secondary-foreground hover:bg-chart-4/80",
				decision:
					"border-transparent bg-chart-5 text-white hover:bg-chart-5/80",
				success: "border-transparent bg-chart-1 text-white hover:bg-chart-1/80",
				warning: "border-transparent bg-chart-2 text-white hover:bg-chart-2/80",
				info: "border-transparent bg-chart-5 text-white hover:bg-chart-5/80",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<div className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}

export { Badge, badgeVariants };

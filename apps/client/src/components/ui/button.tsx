import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-1 whitespace-nowrap border text-xs font-bold tracking-wide uppercase transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default:
					"border-primary bg-card text-primary hover:bg-primary hover:text-primary-foreground",
				destructive:
					"border-destructive bg-card text-destructive hover:bg-destructive hover:text-destructive-foreground",
				outline: "border-input bg-background text-foreground hover:bg-muted",
				secondary:
					"border-border bg-secondary text-secondary-foreground hover:bg-muted",
				ghost:
					"border-transparent text-foreground hover:border-border hover:bg-muted",
				link: "border-transparent p-0 text-primary underline-offset-4 hover:underline",
			},
			size: {
				default: "h-8 px-3 py-1",
				sm: "h-7 px-2 py-1 text-[11px]",
				lg: "h-9 px-4 py-1.5",
				icon: "h-8 w-8",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		);
	},
);
Button.displayName = "Button";

export { Button, buttonVariants };

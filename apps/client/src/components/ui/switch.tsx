import * as React from "react";
import { cn } from "../../lib/utils";

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
	checked?: boolean;
	onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
	({ className, checked, onCheckedChange, disabled, ...props }, ref) => {
		return (
			<label
				className={cn(
					"peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center border border-input bg-card transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
					checked ? "border-primary bg-primary/20" : "border-input bg-card",
					className,
				)}
			>
				<input
					type="checkbox"
					className="sr-only"
					ref={ref}
					checked={checked}
					onChange={(e) => onCheckedChange?.(e.target.checked)}
					disabled={disabled}
					{...props}
				/>
				<span
					className={cn(
						"pointer-events-none block h-4 w-4 bg-foreground ring-0 transition-transform",
						checked ? "translate-x-4 bg-primary" : "translate-x-0",
					)}
				/>
			</label>
		);
	},
);
Switch.displayName = "Switch";

export { Switch };

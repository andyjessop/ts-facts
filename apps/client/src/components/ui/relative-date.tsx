import { formatDistanceToNow } from "date-fns";

interface RelativeDateProps {
	date: string | number | Date;
	className?: string;
}

export function RelativeDate({ date, className }: RelativeDateProps) {
	const d = new Date(date);
	// Ensure valid date
	if (Number.isNaN(d.getTime())) return null;

	return (
		<span
			className={`cursor-default underline decoration-dotted decoration-muted-foreground/30 underline-offset-2 ${className}`}
		>
			{formatDistanceToNow(d, { addSuffix: true })}
		</span>
	);
}

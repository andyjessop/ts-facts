export type ApproveInvoiceInput = {
	id: string;
};

export type ApproveInvoiceResult = {
	approved: boolean;
};

export const approveInvoice = (
	input: ApproveInvoiceInput,
): ApproveInvoiceResult => {
	return { approved: true };
};

const rejectInvoice = function (
	input: ApproveInvoiceInput,
): ApproveInvoiceResult {
	return { approved: false };
};

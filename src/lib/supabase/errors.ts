/**
 * Turns database errors into messages a shopkeeper can understand.
 * Our SQL functions raise readable messages (e.g. "Not enough stock for ...");
 * those are passed through. Technical errors get a friendly generic text.
 */
interface DbError { code?: string; message: string; details?: string }

export function friendlyDbError(error: DbError): string {
  const message = error.message ?? "";
  switch (error.code) {
    case "42501":
      return "You do not have permission to do this.";
    case "23505":
      if (message.includes("sku")) return "A product with this SKU already exists.";
      if (message.includes("barcode")) return "This barcode is already used by another product.";
      if (message.includes("name")) return "This name already exists.";
      return "This record already exists.";
    case "23503":
      return "This item is used by other records (sales, purchases or stock history), so it cannot be deleted. Archive or deactivate it instead.";
    case "23514":
      return "Some values are not allowed. Please check the amounts and try again.";
    case "22P02":
    case "22007":
      return "Some values are in the wrong format. Please check the form.";
    case "P0002":
      return "The record was not found. It may have been deleted.";
    case "P0001":
      // Messages written by our own functions. Remove technical prefixes.
      return message.replace(/^PLAN_(LIMIT|FEATURE):\s*/, "");
    default:
      // Unknown: keep details in the server log, show a calm message.
      console.error("Database error:", error);
      return "Something went wrong while saving. Please try again.";
  }
}

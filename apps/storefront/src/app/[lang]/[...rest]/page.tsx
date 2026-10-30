import { notFound } from "next/navigation";

/** Unknown addresses under a language, so they get the store's own "not found" page with its header and footer. */
export default function UnknownPage() {
  notFound();
}

import { redirect } from "next/navigation";
import { defaultLanguage } from "@capella/shared";

export default function RootPage() {
  redirect(`/${defaultLanguage}`);
}

import { Share } from "react-native";
import { useLang } from "@/lib/lang";
import { Button } from "@/components/ui/button";
export function ShareButton({ title, url }: { title: string; url: string }) {
  const { dict } = useLang();
  return <Button label={dict.common.share} variant="outline" onPress={async () => {
    const destination = new URL(url);
    if (destination.protocol !== "https:" || destination.username || destination.password) throw new Error("Invalid public link");
    await Share.share({ title, url: destination.href, message: `${title}\n${destination.href}` });
  }} />;
}

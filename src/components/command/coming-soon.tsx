import { Construction } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description: string;
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
      <Construction className="size-8 text-muted-foreground" />
      <h1 className="font-heading text-xl font-semibold">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

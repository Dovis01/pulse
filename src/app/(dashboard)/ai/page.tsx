import { AiTabs } from "@/components/news/ai-tabs";

export const revalidate = 60; // ISR: instant navigation, fresh every minute
export const metadata = { title: "AI Intelligence" };

export default function AIPage() {
  return (
    <div className="px-6 pb-16 md:px-10">
      <header className="pt-10 md:pt-14">
        <h1 className="display-headline text-foreground">AI</h1>
        <p className="meta-mono mt-2 text-[11.5px]">
          Models, research, infrastructure and the companies building them.
        </p>
      </header>
      <AiTabs />
    </div>
  );
}

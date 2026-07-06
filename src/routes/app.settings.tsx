import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import type { Lang } from "@/lib/i18n";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "הגדרות · Lamdan AI" }] }),
  component: Settings,
});

function Settings() {
  const { lang, setLang, theme, setTheme } = useApp();
  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <PageHeader title="הגדרות" subtitle="פרופיל, שפה, מראה וממשק לימוד" />

      <Card className="p-6 bg-card border-border mb-4">
        <h3 className="font-semibold mb-4">פרופיל</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div><Label>שם מלא</Label><Input defaultValue="דוד לוי" className="mt-1.5 bg-surface border-border" /></div>
          <div><Label>אימייל</Label><Input defaultValue="david@student.biu.ac.il" className="mt-1.5 bg-surface border-border" /></div>
          <div><Label>מוסד</Label><Input defaultValue="אוניברסיטת בר-אילן" className="mt-1.5 bg-surface border-border" /></div>
          <div><Label>שנה נוכחית</Label>
            <Select defaultValue="2"><SelectTrigger className="mt-1.5 bg-surface border-border"><SelectValue /></SelectTrigger>
              <SelectContent>{[1,2,3,4].map(n => <SelectItem key={n} value={String(n)}>שנה {n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-card border-border mb-4">
        <h3 className="font-semibold mb-4">שפה ומראה</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div><Label>שפת ממשק</Label>
            <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
              <SelectTrigger className="mt-1.5 bg-surface border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="he">עברית</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ru">Русский</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-surface p-3 mt-6">
            <div>
              <div className="font-medium">מצב כהה</div>
              <div className="text-xs text-muted-foreground">Obsidian style · ברירת מחדל</div>
            </div>
            <Switch checked={theme === "dark"} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} />
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-card border-border">
        <h3 className="font-semibold mb-4">אזור הסכנה</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline">ייצא את כל הנתונים</Button>
          <Button variant="destructive">מחק את חשבוני</Button>
        </div>
      </Card>
    </div>
  );
}

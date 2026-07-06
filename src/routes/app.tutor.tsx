import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, BookOpen, HelpCircle, Layers, Network, Languages, Shield } from "lucide-react";

export const Route = createFileRoute("/app/tutor")({
  head: () => ({ meta: [{ title: "מורה AI · Lamdan AI" }] }),
  component: Tutor,
});

interface Msg { role: "user" | "ai"; text: string; }

function Tutor() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "ai", text: "שלום דוד! אני המורה שלך. אתה נמצא כרגע בקורס 'מבוא לבינה מלאכותית'. במה נעזור היום? אני יכול להסביר, לתרגל אותך, לפשט טקסטים אקדמיים או ליצור סיכומים – בעברית, ברוסית, בערבית או באנגלית." },
    { role: "user", text: "תסביר לי מה זה A* בפשטות" },
    { role: "ai", text: "בטח 👌\n\nA* הוא כמו GPS למרחב חיפוש: הוא לוקח בחשבון גם *כמה כבר צעדנו* (g), וגם *כמה משוער שנשאר* (h). הוא תמיד יבחר בצומת עם ה-**f(n) = g(n) + h(n)** הנמוך ביותר.\n\nרוצה שנעשה תרגיל קצר על מבוך?" },
  ]);
  const [text, setText] = useState("");
  const [grounded, setGrounded] = useState(true);

  const send = () => {
    if (!text.trim()) return;
    setMessages((m) => [
      ...m,
      { role: "user", text },
      { role: "ai", text: "מעולה, בואו נצלול לזה יחד. (התשובה תיווצר על ידי מודל AI בגרסה מלאה – כעת זו סימולציה מבוססת החומר שלך.)" },
    ]);
    setText("");
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="p-4 lg:p-6 border-b border-border">
        <PageHeader title="מורה AI" subtitle="מסביר, מתרגל ופושט – מקובע לחומר של הקורס שלך" actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setGrounded(!grounded)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${grounded ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground"}`}>
              <Shield className="h-3 w-3" /> מצב מקובע {grounded ? "פעיל" : "כבוי"}
            </button>
          </div>
        } />
      </div>

      <div className="flex-1 grid lg:grid-cols-[1fr_260px] min-h-0">
        <div className="flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${m.role === "user" ? "bg-surface-2" : "gradient-primary text-primary-foreground"}`}>
                  {m.role === "user" ? "ד" : <Sparkles className="h-4 w-4" />}
                </div>
                <div className={`rounded-2xl px-4 py-3 max-w-xl text-sm leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-primary/15" : "bg-surface"}`}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border p-4">
            <div className="flex gap-2 items-end">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="שאל את המורה כל שאלה על החומר..."
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                className="min-h-12 max-h-40 bg-surface border-border resize-none" />
              <Button onClick={send} className="gradient-primary h-12"><Send className="h-4 w-4" /></Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["הסבר בפשטות", "הסבר ברוסית", "תן דוגמאות", "בחן אותי", "צור כרטיסיות", "סיכום שיעור", "מונחי מפתח", "מפת מושגים"].map((c) => (
                <Badge key={c} variant="outline" className="text-[10px] cursor-pointer hover:border-primary">{c}</Badge>
              ))}
            </div>
          </div>
        </div>

        <aside className="hidden lg:block border-s border-border p-4 bg-surface/30 space-y-4 overflow-y-auto">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">הקשר נוכחי</div>
            <div className="rounded-lg bg-surface p-3 text-sm">
              <div className="font-mono text-[10px] text-muted-foreground">167</div>
              <div className="font-semibold">מבוא לבינה מלאכותית</div>
              <div className="text-xs text-muted-foreground">נושא: A* Search</div>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">מצבי מורה</div>
            <div className="space-y-1">
              {[
                { i: BookOpen, l: "הסבר את זה" },
                { i: Sparkles, l: "פשט לעברית אקדמית" },
                { i: Languages, l: "תרגם לרוסית" },
                { i: HelpCircle, l: "בחן אותי" },
                { i: Layers, l: "צור כרטיסיות" },
                { i: Network, l: "בנה מפת מושגים" },
              ].map((m) => (
                <button key={m.l} className="w-full text-start flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-surface">
                  <m.i className="h-3.5 w-3.5 text-primary" /> {m.l}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

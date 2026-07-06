import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { demoProgram, findCourse, demoAssignments, demoExams, demoFlashcards } from "@/lib/demo-data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HelpCircle, Layers, Sparkles, FileText, Target, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/app/courses/$courseId")({
  loader: ({ params }) => {
    const course = findCourse(params.courseId);
    if (!course) throw notFound();
    return { course };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.course.titleHe} · Lamdan AI` : "קורס · Lamdan AI" }],
  }),
  component: CoursePage,
  notFoundComponent: () => (
    <div className="p-8 text-center text-muted-foreground">קורס לא נמצא</div>
  ),
});

function CoursePage() {
  const { course } = Route.useLoaderData();
  const assignments = demoAssignments.filter((a) => a.courseId === course.id);
  const exams = demoExams.filter((e) => e.courseId === course.id);
  const flash = demoFlashcards.filter((f) => f.courseId === course.id);
  const related = demoProgram.courses.filter((c) => c.prerequisites.includes(course.id) || course.prerequisites.includes(c.id));

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Link to="/app/courses" className="hover:text-foreground">קורסים</Link>
          <span>/</span><span>{course.number}</span>
        </div>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono bg-primary/10 text-primary rounded px-2 py-0.5">{course.number}</span>
              <Badge variant="secondary" className="text-[10px]">{course.type}</Badge>
              <Badge variant="outline" className="text-[10px]">{course.credits} נ״ז</Badge>
              <Badge variant="outline" className="text-[10px]">שנה {course.year} · סמ׳ {course.semester}׳</Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">{course.titleHe}</h1>
            {course.titleEn && <p className="text-muted-foreground mt-1">{course.titleEn}</p>}
            <p className="text-sm text-muted-foreground mt-1">{demoProgram.institution} · {demoProgram.faculty}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="gradient-primary shadow-glow"><Sparkles className="me-2 h-4 w-4" /> יצירת ערכת לימוד</Button>
            <Link to="/app/quizzes"><Button variant="outline"><HelpCircle className="me-2 h-4 w-4" /> צור בוחן</Button></Link>
            <Link to="/app/flashcards"><Button variant="outline"><Layers className="me-2 h-4 w-4" /> כרטיסיות</Button></Link>
            <Link to="/app/tutor"><Button variant="outline"><Sparkles className="me-2 h-4 w-4" /> מורה AI</Button></Link>
          </div>
        </div>
        <div className="mt-6 grid md:grid-cols-4 gap-3">
          <Mini label="התקדמות" value={`${course.progress}%`} progress={course.progress} />
          <Mini label="נושאים" value={course.topics.length} />
          <Mini label="מטלות פתוחות" value={assignments.filter((a) => a.status !== "graded" && a.status !== "submitted").length} />
          <Mini label="ביטחון עצמי" value="68/100" />
        </div>
      </div>

      <Tabs defaultValue="topics">
        <TabsList className="bg-surface">
          <TabsTrigger value="topics">נושאים</TabsTrigger>
          <TabsTrigger value="notes">הערות</TabsTrigger>
          <TabsTrigger value="assignments">מטלות</TabsTrigger>
          <TabsTrigger value="exams">מבחנים</TabsTrigger>
          <TabsTrigger value="flashcards">כרטיסיות</TabsTrigger>
          <TabsTrigger value="grade">ציון</TabsTrigger>
        </TabsList>

        <TabsContent value="topics" className="mt-4">
          {course.topics.length === 0 ? (
            <EmptyState msg="עדיין לא זוהו נושאים לקורס זה." cta="צור נושאים אוטומטית מהסילבוס" />
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {course.topics.map((t: any) => (
                <Link key={t.id} to={`/app/topics/${t.id}` as never}>
                  <Card className="p-4 bg-card border-border hover:border-primary/50 transition">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold">{t.title}</div>
                      {t.weak && <Badge variant="destructive" className="text-[10px]">נושא חלש</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{t.short}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>ביטחון: {t.confidence}%</span>
                      <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                    </div>
                    <Progress value={t.confidence} className="mt-1.5 h-1" />
                  </Card>
                </Link>
              ))}
            </div>
          )}
          {related.length > 0 && (
            <div className="mt-6">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">קורסים קשורים</div>
              <div className="flex flex-wrap gap-2">
                {related.map((c) => (
                  <Link key={c.id} to={`/app/courses/${c.id}` as never} className="text-xs rounded-full border border-border bg-surface px-3 py-1 hover:border-primary">
                    <span className="font-mono text-muted-foreground me-2">{c.number}</span>{c.titleHe}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <EmptyState msg="עדיין לא נוצרו הערות לקורס זה." cta="צור הערה חדשה" />
        </TabsContent>

        <TabsContent value="assignments" className="mt-4">
          <div className="space-y-2">
            {assignments.length === 0 ? <EmptyState msg="אין מטלות פעילות" /> :
              assignments.map((a) => (
                <Card key={a.id} className="p-4 bg-card border-border flex items-center gap-4">
                  <FileText className="h-4 w-4 text-primary" />
                  <div className="flex-1">
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-muted-foreground">דדליין: {a.due} · משקל: {a.weight}% · ~{a.estimatedHours} שעות</div>
                  </div>
                  <Badge variant={a.status === "todo" ? "destructive" : "secondary"} className="text-[10px]">{a.status}</Badge>
                </Card>
              ))
            }
          </div>
        </TabsContent>

        <TabsContent value="exams" className="mt-4">
          <div className="grid md:grid-cols-2 gap-3">
            {exams.map((e) => (
              <Card key={e.id} className="p-4 bg-card border-border">
                <div className="flex items-center justify-between">
                  <Badge className="gradient-primary text-primary-foreground">מועד {e.moed}׳</Badge>
                  <span className="text-xs text-muted-foreground">משקל {e.weight}%</span>
                </div>
                <div className="text-2xl font-bold mt-2">{e.date}</div>
                <Link to="/app/exam-prep"><Button size="sm" className="mt-3 w-full" variant="outline"><Target className="me-2 h-3.5 w-3.5" /> תוכנית הכנה</Button></Link>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="flashcards" className="mt-4">
          <div className="grid md:grid-cols-2 gap-3">
            {flash.map((f) => (
              <Card key={f.id} className="p-4 bg-card border-border">
                <div className="font-medium">{f.front}</div>
                <div className="text-sm text-muted-foreground mt-1">{f.back}</div>
                <Badge variant="outline" className="mt-2 text-[10px]">{f.status}</Badge>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="grade" className="mt-4">
          <Card className="p-6 bg-card border-border">
            <div className="text-sm font-semibold mb-3">נוסחת ציון סופי</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>מטלות בית</span><span>30%</span></div>
              <div className="flex justify-between"><span>בוחן אמצע</span><span>20%</span></div>
              <div className="flex justify-between"><span>מבחן סופי (מועד א׳)</span><span>50%</span></div>
              <div className="flex justify-between pt-2 border-t border-border font-semibold"><span>ציון מוערך</span><span className="text-primary">82</span></div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Mini({ label, value, progress }: { label: string; value: any; progress?: number }) {
  return (
    <Card className="p-3 bg-card border-border">
      <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
      {typeof progress === "number" && <Progress value={progress} className="mt-2 h-1" />}
    </Card>
  );
}
function EmptyState({ msg, cta }: { msg: string; cta?: string }) {
  return (
    <div className="text-center py-10 border border-dashed border-border rounded-xl">
      <p className="text-sm text-muted-foreground">{msg}</p>
      {cta && <Button size="sm" className="mt-3 gradient-primary">{cta}</Button>}
    </div>
  );
}

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const sourcePath = new URL("./run-exam-engine-browser-e2e.mjs", import.meta.url);
const directory = await mkdtemp(join(tmpdir(), "lamdan-exam-planning-"));
const scriptPath = join(directory, "run-exam-planning-proof.mjs");

try {
  const source = await readFile(sourcePath, "utf8");
  const topicsAnchor = "    topics: [],";
  const topicsReplacement = `    topics: [
      {
        id: "topic_exam_1",
        courseId: "crs_exam",
        title: "Constitutional review",
        status: "learning",
        order: 0,
        createdAt: now
      },
      {
        id: "topic_exam_2",
        courseId: "crs_exam",
        title: "Legislation",
        status: "learning",
        order: 1,
        createdAt: now
      }
    ],`;
  const storageAnchor = `      localStorage.setItem("lamdan.exam-engine.v1", JSON.stringify({ version: 1, blueprints: [], sessions: [] }));`;
  const storageReplacement = `${storageAnchor}
      localStorage.setItem("lamdan.exam-planning.v1", JSON.stringify({ version: 1, profiles: [], plans: [] }));`;
  const flowAnchor = `    await page.navigate("/app/exam-engine");
    await page.waitForText("Source-grounded экзамены");
    await page.waitForText("2/2");`;
  const flowReplacement = `    await page.navigate("/app/exam-engine");
    await page.waitForText("Source-grounded экзамены");
    await page.waitForText("План подготовки");
    const configured = await page.evaluate(\`(() => {
      const section = [...document.querySelectorAll("section")].find((item) =>
        item.textContent?.includes("План подготовки")
      );
      if (!section) return false;
      const setValue = (input, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter.call(input, String(value));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const date = new Date();
      date.setUTCDate(date.getUTCDate() + 14);
      const dateValue = date.toISOString().slice(0, 10);
      const dateInput = section.querySelector('input[type="date"]');
      const numbers = [...section.querySelectorAll('input[type="number"]')];
      if (!dateInput || numbers.length < 4) return false;
      setValue(dateInput, dateValue);
      setValue(numbers[0], 60);
      setValue(numbers[1], 25);
      setValue(numbers[2], 5);
      setValue(numbers[3], 1);
      return true;
    })()\`);
    assert(configured, "Could not configure the exam planning profile.");
    await page.clickText("Создать план");
    await page.waitFor(\`(() => {
      const data = JSON.parse(localStorage.getItem("lamdan.exam-planning.v1"));
      return data?.profiles?.length === 1 && data?.plans?.length === 1;
    })()\`, 30_000);
    const planningProof = await page.evaluate(\`(() => {
      const data = JSON.parse(localStorage.getItem("lamdan.exam-planning.v1"));
      const plan = data.plans[0];
      return {
        profileCount: data.profiles.length,
        planCount: data.plans.length,
        days: plan.days.length,
        dailyBounded: plan.days.every((day) => day.totalMinutes <= 60),
        sessionsBounded: plan.days.every((day) => day.tasks.every((task) => task.minutes <= 25)),
        highWeightMinutes: plan.topicTotals.topic_exam_1,
        normalWeightMinutes: plan.topicTotals.topic_exam_2,
        totalMinutes: plan.totalMinutes
      };
    })()\`);
    assert(planningProof.profileCount === 1, "Planning profile was not persisted.");
    assert(planningProof.planCount === 1, "Planning plan was not persisted.");
    assert(planningProof.days > 0, "Planning generated no available days.");
    assert(planningProof.dailyBounded, "A planning day exceeded its minute budget.");
    assert(planningProof.sessionsBounded, "A planning task exceeded its session limit.");
    assert(
      planningProof.highWeightMinutes > planningProof.normalWeightMinutes * 3,
      "Topic weights did not affect the allocated time."
    );
    await page.waitForText("2/2");`;
  const startAnchor = `    await page.evaluate("window.confirm = () => true");
    await page.clickText("Сохранить и начать");
    await page.waitForText("Замороженная экзаменационная сессия");`;
  const startReplacement = `    await page.evaluate("window.confirm = () => true");
    await page.clickText("Сохранить и начать");
    await page.waitFor(\`(() => {
      const exams = JSON.parse(localStorage.getItem("lamdan.exam-engine.v1"));
      return exams?.sessions?.some((session) => session.status === "active");
    })()\`, 10_000).catch(async (error) => {
      const snapshot = await page.evaluate(\`(() => ({
        exams: JSON.parse(localStorage.getItem("lamdan.exam-engine.v1")),
        body: document.body?.innerText?.slice(0, 12000),
        buttons: [...document.querySelectorAll("button")].filter((button) => button.getClientRects().length > 0).map((button) => ({ text: button.textContent?.replace(/\\s+/g, " ").trim(), disabled: button.disabled }))
      }))()\`);
      console.error("EXAM_START_DIAGNOSTICS", JSON.stringify(snapshot, null, 2));
      throw error;
    });
    await page.waitForText("Замороженная экзаменационная сессия").catch(async (error) => {
      const snapshot = await page.evaluate(\`(() => ({
        exams: JSON.parse(localStorage.getItem("lamdan.exam-engine.v1")),
        body: document.body?.innerText?.slice(0, 12000),
        buttons: [...document.querySelectorAll("button")].filter((button) => button.getClientRects().length > 0).map((button) => ({ text: button.textContent?.replace(/\\s+/g, " ").trim(), disabled: button.disabled }))
      }))()\`);
      console.error("EXAM_RENDER_DIAGNOSTICS", JSON.stringify(snapshot, null, 2));
      throw error;
    });`;
  const persistenceAnchor = `    assert(persisted.recognitionEvents === 2, "Exam concept evidence duplicated or disappeared.");
    console.log("Frozen Exam Engine browser E2E passed.");`;
  const persistenceReplacement = `    assert(persisted.recognitionEvents === 2, "Exam concept evidence duplicated or disappeared.");
    const planningPersisted = await page.evaluate(\`(() => {
      const data = JSON.parse(localStorage.getItem("lamdan.exam-planning.v1"));
      return data?.profiles?.length === 1 && data?.plans?.length === 1;
    })()\`);
    assert(planningPersisted, "Exam planning profile or plan did not survive reload.");
    console.log("Frozen Exam Engine browser E2E passed.");
    console.log("Bounded exam planning browser E2E passed.");`;

  for (const [anchor, replacement, label] of [
    [topicsAnchor, topicsReplacement, "topics"],
    [storageAnchor, storageReplacement, "storage"],
    [flowAnchor, flowReplacement, "flow"],
    [startAnchor, startReplacement, "start"],
    [persistenceAnchor, persistenceReplacement, "persistence"],
  ]) {
    if (!source.includes(anchor)) throw new Error(`Missing exam browser ${label} anchor.`);
  }

  const compatible = source
    .replace("const APP_PORT = 4179;", "const APP_PORT = 4191;")
    .replace("const DEBUG_PORT = 9339;", "const DEBUG_PORT = 9351;")
    .replace(topicsAnchor, topicsReplacement)
    .replace(storageAnchor, storageReplacement)
    .replace(flowAnchor, flowReplacement)
    .replace(startAnchor, startReplacement)
    .replace(persistenceAnchor, persistenceReplacement);
  await writeFile(scriptPath, compatible);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true }).catch(() => undefined);
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { Grid2X2, List, Upload, FileInput, Search } from "lucide-react";
import { FolderCard, RoomHeading, BrassButton, PaperButton } from "@/components/study-room-ui";
import { useData } from "@/lib/store";

export const Route = createFileRoute("/app/materials")({
  component: MaterialsPage,
});

const fallbackRows = [
  ["Week 1 — Introduction", "Sociology", "Lecture notes", "10.07.26", "2.4 MB"],
  ["Social Structure Notes", "Sociology", "PDF", "09.07.26", "1.8 MB"],
  ["Durkheim Reading", "Sociology", "PDF", "08.07.26", "4.2 MB"],
  ["Lecture 2 Slides", "Government", "PPTX", "07.07.26", "8.7 MB"],
  ["Midterm Exam", "Government", "PDF", "01.07.26", "0.9 MB"],
] as const;

function MaterialsPage() {
  const data = useData();
  const rows = data.materials.length
    ? data.materials.slice(0, 8).map((material) => {
        const course = data.courses.find((item) => item.id === material.courseId);
        return [
          material.title,
          course?.title || "General",
          material.fileName?.split(".").pop()?.toUpperCase() || material.type,
          new Date(material.updatedAt).toLocaleDateString("en-GB"),
          material.fileSize ? `${(material.fileSize / 1024 / 1024).toFixed(1)} MB` : "—",
          material.id,
        ] as const;
      })
    : fallbackRows.map((row, index) => [...row, `sample-${index}`] as const);

  return (
    <div className="room-page materials-room">
      <RoomHeading
        eyebrow="The archive"
        title="Materials"
        subtitle="Folders, readings and lecture files — all in one ledger."
        actions={
          <>
            <PaperButton><FileInput size={14} /> Import</PaperButton>
            <BrassButton><Upload size={14} /> Upload</BrassButton>
          </>
        }
      />

      <section className="folder-rack" aria-label="Material folders">
        <FolderCard title="Lecture Notes" count={12} tone="ochre" />
        <FolderCard title="Slides" count={8} tone="green" />
        <FolderCard title="Readings" count={6} tone="rust" />
        <FolderCard title="Exams" count={3} tone="umber" />
        <FolderCard title="Articles" count={5} tone="ochre" />
        <FolderCard title="Other" count={7} tone="cream" />
      </section>

      <div className="materials-toolbar">
        <label><Search size={15} /><input placeholder="Search the archive…" aria-label="Search materials" /></label>
        <div>
          <button type="button" aria-label="List view" className="is-active"><List size={15} /></button>
          <button type="button" aria-label="Grid view"><Grid2X2 size={15} /></button>
        </div>
      </div>

      <section className="material-ledger" aria-label="Material list">
        <div className="material-ledger__clip" aria-hidden="true" />
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Course</th>
              <th>Type</th>
              <th>Date</th>
              <th>Size</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[5]}>
                <td>
                  {data.materials.length ? (
                    <Link to="/app/materials/$materialId" params={{ materialId: row[5] }}>{row[0]}</Link>
                  ) : row[0]}
                </td>
                <td>{row[1]}</td>
                <td><span className="ink-label">{row[2]}</span></td>
                <td>{row[3]}</td>
                <td>{row[4]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <aside className="ledger-note">
          <span>Knowledge</span>
          <strong>stored today<br />is power<br />used tomorrow.</strong>
          <i>❧</i>
        </aside>
      </section>
    </div>
  );
}

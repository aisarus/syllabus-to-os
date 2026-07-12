import { createFileRoute, Link } from "@tanstack/react-router";
import { Grid2X2, List, Upload, FileInput, Search } from "lucide-react";
import { FolderCard, RoomHeading, BrassButton, PaperButton } from "@/components/study-room-ui";
import { useData } from "@/lib/store";
import { useApp } from "@/lib/app-context";

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
  const { t, lang } = useApp();
  const data = useData();
  const locale = lang === "ru" ? "ru-RU" : "en-GB";
  const rows = data.materials.length
    ? data.materials.slice(0, 8).map((material) => {
        const course = data.courses.find((item) => item.id === material.courseId);
        return [
          material.title,
          course?.title || t.generalFolder,
          material.fileName?.split(".").pop()?.toUpperCase() || material.type,
          new Date(material.updatedAt).toLocaleDateString(locale),
          material.fileSize ? `${(material.fileSize / 1024 / 1024).toFixed(1)} MB` : "—",
          material.id,
        ] as const;
      })
    : fallbackRows.map((row, index) => [...row, `sample-${index}`] as const);

  return (
    <div className="room-page materials-room">
      <RoomHeading
        eyebrow={t.archiveEyebrow}
        title={t.materials}
        subtitle={t.materialsSubtitle}
        actions={
          <>
            <PaperButton><FileInput size={14} /> {t.import}</PaperButton>
            <BrassButton><Upload size={14} /> {t.upload}</BrassButton>
          </>
        }
      />

      <section className="folder-rack" aria-label={t.foldersAria}>
        <FolderCard title={t.folderLectureNotes} count={12} tone="ochre" />
        <FolderCard title={t.folderSlides} count={8} tone="green" />
        <FolderCard title={t.folderReadings} count={6} tone="rust" />
        <FolderCard title={t.folderExams} count={3} tone="umber" />
        <FolderCard title={t.folderArticles} count={5} tone="ochre" />
        <FolderCard title={t.folderOther} count={7} tone="cream" />
      </section>

      <div className="materials-toolbar">
        <label><Search size={15} /><input placeholder={t.searchArchivePlaceholder} aria-label={t.searchArchiveAria} /></label>
        <div>
          <button type="button" aria-label={t.listViewAria} className="is-active"><List size={15} /></button>
          <button type="button" aria-label={t.gridViewAria}><Grid2X2 size={15} /></button>
        </div>
      </div>

      <section className="material-ledger" aria-label={t.materialsListAria}>
        <div className="material-ledger__clip" aria-hidden="true" />
        <table>
          <thead>
            <tr>
              <th>{t.colName}</th>
              <th>{t.colCourse}</th>
              <th>{t.type}</th>
              <th>{t.colDate}</th>
              <th>{t.colSize}</th>
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
          <span>{t.ledgerKnowledgeLabel}</span>
          <strong style={{ whiteSpace: "pre-line" }}>{t.ledgerKnowledgeBody}</strong>
          <i>❧</i>
        </aside>
      </section>
    </div>
  );
}

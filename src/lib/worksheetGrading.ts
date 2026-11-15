import type { WorksheetField } from "./pdfWorksheet";

export function isWorksheetGradable(field: WorksheetField): boolean {
  return ["text", "textarea", "mc", "checkbox"].includes(field.type) &&
    field.correct !== undefined && field.correct !== null && field.correct !== "";
}

export function gradeField(field: WorksheetField, answer: unknown): { correct: boolean; score: number } {
  const wrong = { correct: false, score: 0 };
  if (!isWorksheetGradable(field)) return wrong;
  const maxScore = field.score ?? 1;
  const norm = (value: unknown) => {
    let text = String(value ?? "");
    if (field.trim !== false) text = text.trim();
    return field.caseSensitive ? text : text.toLowerCase();
  };
  let correct = false;
  switch (field.type) {
    case "text":
    case "textarea":
      correct = norm(answer) !== "" && String(field.correct).split("|").map(norm).includes(norm(answer));
      break;
    case "mc": {
      if (answer === undefined || answer === null || String(answer).trim() === "") return wrong;
      const selected = Number(answer);
      correct = Number.isInteger(selected) && selected >= 0 && selected < (field.options?.length ?? 0) && selected === Number(field.correct);
      break;
    }
    case "checkbox":
      correct = Boolean(answer) === Boolean(field.correct);
      break;
  }
  return correct ? { correct: true, score: maxScore } : wrong;
}
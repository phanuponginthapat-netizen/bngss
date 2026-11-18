import type { WorksheetField } from "./pdfWorksheet";

export function isWorksheetGradable(field: WorksheetField): boolean {
  if (field.type === "match") return (field.pairs?.length ?? 0) > 0;
  if (field.type === "order") return (field.options?.length ?? 0) > 0;
  return ["text", "textarea", "mc", "checkbox", "select", "multiselect", "number"].includes(field.type) &&
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
    case "mc":
    case "select": {
      if (answer === undefined || answer === null || String(answer).trim() === "") return wrong;
      const selected = Number(answer);
      correct = Number.isInteger(selected) && selected >= 0 && selected < (field.options?.length ?? 0) && selected === Number(field.correct);
      break;
    }
    case "checkbox":
      correct = Boolean(answer) === Boolean(field.correct);
      break;
    case "number": {
      if (answer === null || answer === undefined || String(answer).trim() === "") return wrong;
      const value = Number(answer), expected = Number(field.correct);
      correct = Number.isFinite(value) && Number.isFinite(expected) && Math.abs(value - expected) <= Math.max(0, field.tolerance ?? 0);
      break;
    }
    case "multiselect": {
      if (!Array.isArray(answer) || !Array.isArray(field.correct) || !field.correct.length) return wrong;
      const selected = [...new Set(answer.map(Number))].sort((a, b) => a - b);
      const expected = [...new Set(field.correct.map(Number))].sort((a, b) => a - b);
      correct = selected.every(i => Number.isInteger(i) && i >= 0 && i < (field.options?.length ?? 0)) && JSON.stringify(selected) === JSON.stringify(expected);
      break;
    }
    case "match":
    case "order": {
      const count = field.type === "match" ? field.pairs?.length ?? 0 : field.options?.length ?? 0;
      correct = Array.isArray(answer) && answer.length === count && answer.every((value, i) => value !== null && value !== "" && Number(value) === i);
      break;
    }
  }
  return correct ? { correct: true, score: maxScore } : wrong;
}

export function hasWorksheetAnswer(field: WorksheetField, answer: unknown): boolean {
  if (field.type === "checkbox") return answer === true || answer === false;
  if (field.type === "match" || field.type === "order") {
    const count = field.type === "match" ? field.pairs?.length ?? 0 : field.options?.length ?? 0;
    return Array.isArray(answer) && answer.length === count && answer.every(v => v !== null && v !== undefined && String(v).trim() !== "");
  }
  if (Array.isArray(answer)) return answer.length > 0;
  return answer !== null && answer !== undefined && String(answer).trim() !== "";
}
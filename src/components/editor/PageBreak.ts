import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageBreak: {
      insertPageBreak: () => ReturnType;
    };
  }
}

/** Visible page-break node — survives DOCX/print export via CSS `page-break-before`. */
export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,

  parseHTML() {
    return [
      { tag: 'div[data-page-break="true"]' },
      { tag: 'div.page-break' },
      { tag: 'hr.page-break' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-page-break": "true",
        class: "page-break",
        style:
          "page-break-before: always; break-before: page; border-top: 2px dashed #c7d2fe; margin: 14px 0; height: 0; position: relative;",
      }),
    ];
  },

  addCommands() {
    return {
      insertPageBreak:
        () =>
        ({ chain }) =>
          chain().focus().insertContent({ type: this.name }).insertContent({ type: "paragraph" }).run(),
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Enter": () => this.editor.commands.insertPageBreak(),
    };
  },
});

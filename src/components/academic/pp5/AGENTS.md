- Render PP5 workbook geometry from the privacy-cleared supplied template; export by patching XML cells in its ZIP rather than regenerating sheets, so Excel preserves fonts, drawings, print areas and page breaks.
- Workbook edits are explicit term/subject/classroom drafts with revision-checked writes and a stable stored student-code order; retain local edits on failures and only send reviewed final totals through the shared score writer.
- Never invent detailed scores from aggregates or claim browser font/rendering matches Excel when the original licensed fonts and Excel pagination engine are unavailable.

- Serve the generated large layout through the checked-in Lovable asset pointer; regenerate locally with the extractor and upload a replacement pointer when the source changes.
- Print geometry is shared through pp5PrintLayout and WorkbookPrintDocument: preserve one sheet scale, account for automatic/manual row and column breaks and repeat titles, and await stylesheet/fonts/image decoding before native print.

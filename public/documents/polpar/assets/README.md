PDF template assets
===================

comelec.png and ust.jpg were extracted from the user-provided Form 02 Word template.

DejaVuSerif.ttf and DejaVuSerif-Bold.ttf are redistributed under LICENSE_DEJAVU.
They provide an embedded serif typeface, including accented Filipino names, without
depending on fonts installed on the applicant's computer.

src/lib/polpar/pdf.ts lays out the source forms' letterheads, text, table columns and
signature blocks. Page dimensions follow the Word originals: 8.5 × 13 inches for
Forms 01/03/04, 13 × 8.5 for Forms 02/05, and letter for Forms 06/07. Long entries
and rosters flow to additional pages with repeated headings. This is a PDF layout
of the source templates, not a runtime Microsoft Word rendering. No signatures or
Commission certifications are generated from typed names.

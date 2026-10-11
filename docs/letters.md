# Letter design notes

## Long alternates (Phase 6.6)

`src/glyphs/tables.ts` has `ALTS`: long forms of final noon, yeh, kaf and meem, drawn for this engine's cell grid.
With `style.letter.alternates` on, the justifier uses some of them where a line has room (up to 60% of its slack,
spread along the line) instead of leaving all the slack to stretching. Off, output is unchanged.

Design rules: raised tails stay well under an ascender and curl back toward the letter, so a final noon never reads
as noon + alif; descending tails sit below the baseline like the descending ra.

## Fatimid reference and licensing

Rana Kufi by Khaled Hosny (github.com/aliftype/rana-kufi) follows the Fatimid Kufic measurements of Mohammad Abdul
Qadir. It is licensed **AGPL-3.0** (checked October 2026; its sibling fonts Reem Kufi, Qahiri and Amiri are OFL).
Copying its glyph outlines into this project would make the project a derivative work under the AGPL, which would
apply to the whole app as served. Nothing has been copied. The alternates above are original designs; Rana Kufi may
be looked at as a reference for proportions only. Adopting its outlines (or relicensing this project under the
AGPL) is a decision for the project owner.

A full Fatimid letter set (vector stroke skeletons with an editor) is still to do; see COMPOSITION_ENGINE.md §9.

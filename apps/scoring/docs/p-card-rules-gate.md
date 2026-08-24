# P-card rules gate

No P-card progression is implemented. Every `passivityPenalty.award` command
is rejected with `owner-unavailable` until the rules owner approves a
source-backed P-card table.

The current complete bout snapshot can represent only `none`, `yellow`, and
`red` P-card presentation. The approved table must define applicability,
progression, every score effect, and any black-card or disqualification result
before the reducer can select an outcome. It must arrive as one reviewed
change with the approved rule revision, complete resulting state,
command/event fixtures, and reducer transition table.

This is an intentionally partial RC-07 delivery. Direct penalty-card awards
and Reset Cards are implemented, but P-card awards remain blocked; compensating
undo is separately owned by RC-10 and is not implemented here.

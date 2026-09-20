# Conversation record inspectors

Meeting selection belongs to the presentation that opens it: a record card/group, result list, or inline mention.
The same meeting can appear in several presentations without opening multiple sheets or issuing duplicate detail
loads. The conversation session owns retrieval and its session key, not inspector visibility. Vote inspectors keep
their existing presentation-local ownership.

An open inspector retains its exact result/record reference through answer snapshot updates and list page changes.
Closing clears only that presentation's selection. Card/group and list owners restore focus to the initiating element;
if that element disappeared, they focus the first remaining result control in that presentation. Inline mentions
restore focus to their own button. Removing the owning presentation closes its inspector and aborts its pending read.

The existing `MeetingDetails` lifecycle aborts retrieval on close, owner removal, or selection change and ignores late
results. Retrieval still validates the returned record identity and kind, uses the session-owned result store, and
retains explicit expired/failed states. This ownership fix does not change provenance or paging contracts.

Regression coverage in `ConversationResponse.test.tsx` combines full/compact cards and groups with a list and inline
mention for the same meeting. It checks single loads and dialogs, keyboard activation and focus return, snapshot
continuity, missing-trigger fallback, and cancellation. Browser acceptance additionally exercises desktop/mobile
layout and keyboard behavior through the production conversation UI with synthetic read-only fixtures.

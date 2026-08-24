# Remote workflow actions contract

`RC-09` completes the remaining remote workflow controls without giving the ESP32 scoring authority. Each request is an authenticated `RemoteCommand`; it becomes an accepted applied event only after the STM32 replies with an exact correlated `stm32-workflow-result`.

## Correlated STM32 requests

`scoring.rearm` requests a manual rearm. Modified `scoring.autoRearm.advance` requests the next setting in the fixed cycle: manual, one second, three seconds, five seconds, then manual. `weapon.showOrAdvance` requests the next selected weapon in the fixed epee, foil, sabre cycle. `device.sleep.request` requests safe-idle sleep.

Each pending request retains the remote command ID, intended operation, requested automatic-rearm setting, and requested weapon. The only accepted reply has the exact fields `authority`, `operation`, `requestId`, `result`, `stm32RecordId`, and `type`; it must assert `stm32-scoring`, match both request ID and operation, and carry a nonempty STM32 record ID. A rejection must carry `stm32RecordId: null`. Malformed, mismatched, unknown, or duplicate replies are ignored. Rejected requests create a rejection event and leave the complete snapshot unchanged.

An accepted rearm changes the automatic-rearm setting only when the request was the automatic mode control. An accepted weapon response changes the declared weapon only. Both results are correlated to the immutable STM32 record. `bout.new` retains its existing request and accepted/rejected `stm32-bout-reset-result` path, which creates a distinct `boutId` only after STM32 acceptance.

## Local workflow operations

Modified side swap is allowed only while the ordinary bout clock is stopped and no medical intervention is active. It atomically exchanges the left and right score, yellow card, red-card count, P-card state, last-scored side, and priority side. It neither creates nor rewrites an STM32 scoring record.

Safe-idle sleep is available only while the ordinary bout clock is stopped, with no running medical or passivity clock. The request remains pending until STM32 accepts it. A running, break, overtime, or otherwise unsafe workflow state fails closed with `invalid-mode`.

RC-08 overtime and manual-priority paths remain `owner-unavailable`; this work unit neither creates entropy nor changes that release gate.

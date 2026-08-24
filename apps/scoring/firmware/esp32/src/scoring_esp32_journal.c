#include "scoring_esp32_journal.h"

#include <string.h>

enum {
  JOURNAL_MAGIC = 0x534A3039U,
  JOURNAL_VERSION = 1U
};

static uint32_t crc32c_update(uint32_t crc, const uint8_t *bytes, size_t length) {
  size_t index;
  unsigned int bit;
  for (index = 0U; index < length; ++index) {
    crc ^= bytes[index];
    for (bit = 0U; bit < 8U; ++bit) {
      const uint32_t mask = (uint32_t)(-(int32_t)(crc & 1U));
      crc = (crc >> 1U) ^ (UINT32_C(0x82F63B78) & mask);
    }
  }
  return crc;
}

static uint32_t crc32c_update_u32(uint32_t crc, uint32_t value) {
  const uint8_t encoded[4] = {
    (uint8_t)(value >> 24U),
    (uint8_t)(value >> 16U),
    (uint8_t)(value >> 8U),
    (uint8_t)value
  };
  return crc32c_update(crc, encoded, sizeof(encoded));
}

static uint32_t slot_integrity(const scoring_esp32_journal_slot_t *slot) {
  uint32_t crc = UINT32_MAX;
  uint32_t index;
  if (slot == NULL) {
    return 0U;
  }
  crc = crc32c_update_u32(crc, slot->magic);
  crc = crc32c_update_u32(crc, slot->version);
  crc = crc32c_update_u32(crc, slot->generation);
  crc = crc32c_update_u32(crc, slot->record_count);
  crc = crc32c_update_u32(crc, slot->cursor);
  crc = crc32c_update(crc, &slot->cursor_valid, sizeof(slot->cursor_valid));
  for (index = 0U; index < slot->record_count; ++index) {
    const scoring_esp32_journal_record_t *record = &slot->records[index];
    crc = crc32c_update_u32(crc, record->transport_sequence);
    crc = crc32c_update_u32(crc, record->length);
    crc = crc32c_update(crc, record->bytes, (size_t)record->length);
  }
  return crc ^ UINT32_MAX;
}

static bool slot_is_valid(const scoring_esp32_journal_slot_t *slot, uint32_t max_records) {
  uint32_t index;
  if (slot == NULL || slot->committed != 1U || slot->magic != JOURNAL_MAGIC || slot->version != JOURNAL_VERSION ||
      slot->generation == 0U || slot->cursor_valid > 1U || slot->record_count > max_records ||
      slot->record_count > SCORING_ESP32_JOURNAL_MAX_ENTRIES) {
    return false;
  }
  for (index = 0U; index < slot->record_count; ++index) {
    if (slot->records[index].length > SCORING_ESP32_MAX_TRANSPORT_PAYLOAD_BYTES) {
      return false;
    }
  }
  return slot->integrity == slot_integrity(slot);
}

static scoring_esp32_result_t after_boundary(
  scoring_esp32_journal_storage_t *storage,
  scoring_esp32_journal_write_boundary_t boundary
) {
  if (storage->power_loss_armed && storage->armed_power_loss == boundary) {
    storage->power_loss_armed = false;
    return SCORING_ESP32_RESULT_POWER_LOSS;
  }
  return SCORING_ESP32_RESULT_OK;
}

void scoring_esp32_journal_storage_init(scoring_esp32_journal_storage_t *storage) {
  if (storage == NULL) {
    return;
  }
  (void)memset(storage, 0, sizeof(*storage));
  storage->armed_power_loss = SCORING_ESP32_JOURNAL_PREPARED_HEADER;
}

void scoring_esp32_journal_arm_power_loss(
  scoring_esp32_journal_storage_t *storage,
  scoring_esp32_journal_write_boundary_t boundary
) {
  if (storage == NULL) {
    return;
  }
  storage->armed_power_loss = boundary;
  storage->power_loss_armed = true;
}

scoring_esp32_result_t scoring_esp32_journal_corrupt_committed(
  scoring_esp32_journal_storage_t *storage,
  uint32_t record_index
) {
  uint8_t active = 0U;
  uint32_t generation = 0U;
  uint8_t index;
  if (storage == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  for (index = 0U; index < SCORING_ESP32_JOURNAL_SLOT_COUNT; ++index) {
    const scoring_esp32_journal_slot_t *slot = &storage->slots[index];
    if (slot_is_valid(slot, SCORING_ESP32_JOURNAL_MAX_ENTRIES) && slot->generation >= generation) {
      active = index;
      generation = slot->generation;
    }
  }
  if (!slot_is_valid(&storage->slots[active], SCORING_ESP32_JOURNAL_MAX_ENTRIES)) {
    return SCORING_ESP32_RESULT_JOURNAL_CORRUPT;
  }
  if (record_index >= storage->slots[active].record_count) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  if (storage->slots[active].records[record_index].length == 0U) {
    storage->slots[active].records[record_index].transport_sequence ^= 1U;
  } else {
    storage->slots[active].records[record_index].bytes[0] ^= 1U;
  }
  return SCORING_ESP32_RESULT_OK;
}

static scoring_esp32_result_t select_committed_slot(
  const scoring_esp32_journal_storage_t *storage,
  uint32_t max_records,
  uint8_t *out_slot,
  scoring_esp32_journal_recovery_t *out_recovery
) {
  bool found = false;
  bool saw_committed = false;
  uint8_t selected = 0U;
  uint32_t selected_generation = 0U;
  uint8_t index;
  if (storage == NULL || out_slot == NULL || out_recovery == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  for (index = 0U; index < SCORING_ESP32_JOURNAL_SLOT_COUNT; ++index) {
    const scoring_esp32_journal_slot_t *slot = &storage->slots[index];
    if (slot->committed == 1U) {
      saw_committed = true;
    }
    if (slot_is_valid(slot, max_records) && (!found || slot->generation > selected_generation)) {
      found = true;
      selected = index;
      selected_generation = slot->generation;
    }
  }
  if (!found) {
    if (saw_committed) {
      *out_recovery = SCORING_ESP32_JOURNAL_RECOVERY_CORRUPT;
      return SCORING_ESP32_RESULT_JOURNAL_CORRUPT;
    }
    *out_slot = 0U;
    *out_recovery = SCORING_ESP32_JOURNAL_RECOVERY_EMPTY;
    return SCORING_ESP32_RESULT_OK;
  }
  *out_slot = selected;
  *out_recovery = SCORING_ESP32_JOURNAL_RECOVERY_RECOVERED;
  return SCORING_ESP32_RESULT_OK;
}

static scoring_esp32_result_t journal_state_preflight(
  const scoring_esp32_journal_t *journal,
  const scoring_esp32_journal_slot_t **out_current
) {
  const scoring_esp32_journal_slot_t *current;
  if (journal == NULL || !journal->is_open || journal->storage == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  if (journal->recovery == SCORING_ESP32_JOURNAL_RECOVERY_CORRUPT) {
    return SCORING_ESP32_RESULT_JOURNAL_CORRUPT;
  }
  if (journal->active_slot >= SCORING_ESP32_JOURNAL_SLOT_COUNT) {
    return SCORING_ESP32_RESULT_JOURNAL_CORRUPT;
  }
  current = &journal->storage->slots[journal->active_slot];
  if ((journal->record_count != 0U || journal->cursor_valid) &&
      !slot_is_valid(current, journal->max_records)) {
    return SCORING_ESP32_RESULT_JOURNAL_CORRUPT;
  }
  if (out_current != NULL) {
    *out_current = current;
  }
  return SCORING_ESP32_RESULT_OK;
}

scoring_esp32_result_t scoring_esp32_journal_open(
  scoring_esp32_journal_t *journal,
  scoring_esp32_journal_storage_t *storage,
  size_t max_records
) {
  uint8_t active_slot;
  scoring_esp32_journal_recovery_t recovery;
  scoring_esp32_result_t result;
  if (journal == NULL || storage == NULL || max_records == 0U || max_records > SCORING_ESP32_JOURNAL_MAX_ENTRIES) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  *journal = (scoring_esp32_journal_t){0};
  journal->storage = storage;
  journal->max_records = (uint32_t)max_records;
  result = select_committed_slot(storage, journal->max_records, &active_slot, &recovery);
  journal->recovery = recovery;
  if (result != SCORING_ESP32_RESULT_OK) {
    return result;
  }
  journal->active_slot = active_slot;
  if (recovery == SCORING_ESP32_JOURNAL_RECOVERY_RECOVERED) {
    const scoring_esp32_journal_slot_t *slot = &storage->slots[active_slot];
    journal->generation = slot->generation;
    journal->record_count = slot->record_count;
    journal->cursor_valid = slot->cursor_valid == 1U;
    journal->cursor = slot->cursor;
  }
  journal->is_open = true;
  return SCORING_ESP32_RESULT_OK;
}

scoring_esp32_result_t scoring_esp32_journal_reopen(scoring_esp32_journal_t *journal) {
  scoring_esp32_journal_storage_t *storage;
  size_t max_records;
  if (journal == NULL || journal->storage == NULL || journal->max_records == 0U) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  storage = journal->storage;
  max_records = (size_t)journal->max_records;
  return scoring_esp32_journal_open(journal, storage, max_records);
}

static scoring_esp32_result_t commit_checkpoint(
  scoring_esp32_journal_t *journal,
  bool append_record,
  uint32_t transport_sequence,
  scoring_esp32_bytes_t bytes,
  bool cursor_valid,
  uint32_t cursor
) {
  scoring_esp32_journal_storage_t *storage;
  scoring_esp32_journal_slot_t *next;
  const scoring_esp32_journal_slot_t *current;
  uint8_t next_slot;
  uint32_t index;
  uint32_t next_generation;
  scoring_esp32_result_t result;
  storage = journal->storage;
  current = &storage->slots[journal->active_slot];
  if (journal->record_count + (append_record ? 1U : 0U) > journal->max_records) {
    return SCORING_ESP32_RESULT_BACKPRESSURE;
  }
  if (journal->generation == UINT32_MAX) {
    return SCORING_ESP32_RESULT_BACKPRESSURE;
  }
  next_slot = (uint8_t)(journal->active_slot == 0U ? 1U : 0U);
  next = &storage->slots[next_slot];
  (void)memset(next, 0, sizeof(*next));
  next_generation = journal->generation + 1U;
  next->magic = JOURNAL_MAGIC;
  next->version = JOURNAL_VERSION;
  next->generation = next_generation;
  next->record_count = journal->record_count + (append_record ? 1U : 0U);
  next->cursor = cursor;
  next->cursor_valid = cursor_valid ? 1U : 0U;
  result = after_boundary(storage, SCORING_ESP32_JOURNAL_PREPARED_HEADER);
  if (result != SCORING_ESP32_RESULT_OK) {
    return result;
  }
  for (index = 0U; index < journal->record_count; ++index) {
    next->records[index] = current->records[index];
  }
  if (append_record) {
    next->records[journal->record_count].transport_sequence = transport_sequence;
    next->records[journal->record_count].length = (uint32_t)bytes.length;
    if (bytes.length != 0U) {
      (void)memcpy(next->records[journal->record_count].bytes, bytes.data, bytes.length);
    }
  }
  result = after_boundary(storage, SCORING_ESP32_JOURNAL_PREPARED_RECORDS);
  if (result != SCORING_ESP32_RESULT_OK) {
    return result;
  }
  next->integrity = slot_integrity(next);
  result = after_boundary(storage, SCORING_ESP32_JOURNAL_PREPARED_INTEGRITY);
  if (result != SCORING_ESP32_RESULT_OK) {
    return result;
  }
  next->committed = 1U;
  result = after_boundary(storage, SCORING_ESP32_JOURNAL_COMMIT_MARKER);
  if (result != SCORING_ESP32_RESULT_OK) {
    return result;
  }
  journal->active_slot = next_slot;
  journal->generation = next_generation;
  journal->record_count = next->record_count;
  journal->cursor_valid = cursor_valid;
  journal->cursor = cursor;
  journal->recovery = SCORING_ESP32_JOURNAL_RECOVERY_RECOVERED;
  return SCORING_ESP32_RESULT_OK;
}

scoring_esp32_result_t scoring_esp32_journal_append(
  scoring_esp32_journal_t *journal,
  uint32_t transport_sequence,
  scoring_esp32_bytes_t bytes
) {
  const scoring_esp32_journal_slot_t *current;
  scoring_esp32_result_t result;
  uint32_t index;
  if (bytes.data == NULL && bytes.length != 0U) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  result = journal_state_preflight(journal, &current);
  if (result != SCORING_ESP32_RESULT_OK) {
    return result;
  }
  if (bytes.length > SCORING_ESP32_MAX_TRANSPORT_PAYLOAD_BYTES) {
    return SCORING_ESP32_RESULT_BUFFER_TOO_SMALL;
  }
  for (index = 0U; index < journal->record_count; ++index) {
    const scoring_esp32_journal_record_t *record = &current->records[index];
    if (record->length == bytes.length &&
        (bytes.length == 0U || memcmp(record->bytes, bytes.data, bytes.length) == 0)) {
      /* Opaque records cannot expose recordId here; identical authoritative
       * bytes are therefore treated as a conservative duplicate. */
      return SCORING_ESP32_RESULT_DUPLICATE;
    }
    if (record->transport_sequence == transport_sequence) {
      return SCORING_ESP32_RESULT_CONFLICT;
    }
  }
  if (journal->cursor_valid && transport_sequence <= journal->cursor) {
    return SCORING_ESP32_RESULT_OUT_OF_ORDER;
  }
  return commit_checkpoint(
    journal,
    true,
    transport_sequence,
    bytes,
    true,
    transport_sequence
  );
}

scoring_esp32_result_t scoring_esp32_journal_advance_cursor(
  scoring_esp32_journal_t *journal,
  uint32_t transport_sequence
) {
  const scoring_esp32_result_t preflight = journal_state_preflight(journal, NULL);
  if (preflight != SCORING_ESP32_RESULT_OK) {
    return preflight;
  }
  if (journal->cursor_valid) {
    if (transport_sequence == journal->cursor) {
      return SCORING_ESP32_RESULT_DUPLICATE;
    }
    if (transport_sequence < journal->cursor) {
      return SCORING_ESP32_RESULT_OUT_OF_ORDER;
    }
  }
  return commit_checkpoint(
    journal,
    false,
    0U,
    (scoring_esp32_bytes_t){.data = NULL, .length = 0U},
    true,
    transport_sequence
  );
}

size_t scoring_esp32_journal_count(const scoring_esp32_journal_t *journal) {
  if (journal == NULL || !journal->is_open) {
    return 0U;
  }
  return (size_t)journal->record_count;
}

scoring_esp32_journal_recovery_t scoring_esp32_journal_recovery(const scoring_esp32_journal_t *journal) {
  if (journal == NULL || !journal->is_open) {
    return SCORING_ESP32_JOURNAL_RECOVERY_CORRUPT;
  }
  return journal->recovery;
}

scoring_esp32_result_t scoring_esp32_journal_replay(
  const scoring_esp32_journal_t *journal,
  size_t record_index,
  scoring_esp32_mutable_bytes_t destination,
  size_t *out_length,
  uint32_t *out_transport_sequence
) {
  const scoring_esp32_journal_record_t *record;
  const scoring_esp32_journal_slot_t *slot;
  scoring_esp32_result_t preflight;
  if (journal == NULL || !journal->is_open || out_length == NULL || out_transport_sequence == NULL ||
      (destination.data == NULL && destination.capacity != 0U)) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  *out_length = 0U;
  *out_transport_sequence = 0U;
  preflight = journal_state_preflight(journal, &slot);
  if (preflight != SCORING_ESP32_RESULT_OK) {
    return preflight;
  }
  if (record_index >= (size_t)journal->record_count) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  record = &slot->records[record_index];
  if (record->length > destination.capacity) {
    return SCORING_ESP32_RESULT_BUFFER_TOO_SMALL;
  }
  if (record->length != 0U) {
    (void)memcpy(destination.data, record->bytes, (size_t)record->length);
  }
  *out_length = (size_t)record->length;
  *out_transport_sequence = record->transport_sequence;
  return SCORING_ESP32_RESULT_OK;
}

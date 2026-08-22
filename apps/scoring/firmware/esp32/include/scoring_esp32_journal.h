#ifndef SCORING_ESP32_JOURNAL_H
#define SCORING_ESP32_JOURNAL_H

#include "scoring_esp32_services.h"

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

/*
 * M3-09 bounded host model. The target adapter may replace the medium, but
 * the receiver and replay code depend only on this fixed record contract.
 */
enum {
  SCORING_ESP32_JOURNAL_MAX_ENTRIES = 32,
  SCORING_ESP32_JOURNAL_SLOT_COUNT = 2,
  SCORING_ESP32_JOURNAL_HOST_STORAGE_MIN_BYTES = 262704,
  SCORING_ESP32_JOURNAL_HOST_STORAGE_MAX_BYTES = 262720
};

typedef enum scoring_esp32_journal_write_boundary {
  SCORING_ESP32_JOURNAL_PREPARED_HEADER = 0,
  SCORING_ESP32_JOURNAL_PREPARED_RECORDS,
  SCORING_ESP32_JOURNAL_PREPARED_INTEGRITY,
  SCORING_ESP32_JOURNAL_COMMIT_MARKER
} scoring_esp32_journal_write_boundary_t;

typedef enum scoring_esp32_journal_recovery {
  SCORING_ESP32_JOURNAL_RECOVERY_EMPTY = 0,
  SCORING_ESP32_JOURNAL_RECOVERY_RECOVERED,
  SCORING_ESP32_JOURNAL_RECOVERY_CORRUPT
} scoring_esp32_journal_recovery_t;

typedef struct scoring_esp32_journal_record {
  uint32_t transport_sequence;
  uint32_t length;
  uint8_t bytes[SCORING_ESP32_MAX_TRANSPORT_PAYLOAD_BYTES];
} scoring_esp32_journal_record_t;

typedef struct scoring_esp32_journal_slot {
  uint32_t magic;
  uint32_t version;
  uint32_t generation;
  uint32_t record_count;
  uint32_t integrity;
  /* Last consumed valid STM32 frame, including ignored non-decision frames. */
  uint32_t cursor;
  uint8_t cursor_valid;
  uint8_t committed;
  uint8_t reserved[2];
  scoring_esp32_journal_record_t records[SCORING_ESP32_JOURNAL_MAX_ENTRIES];
} scoring_esp32_journal_slot_t;

typedef struct scoring_esp32_journal_storage {
  scoring_esp32_journal_slot_t slots[SCORING_ESP32_JOURNAL_SLOT_COUNT];
  bool power_loss_armed;
  scoring_esp32_journal_write_boundary_t armed_power_loss;
} scoring_esp32_journal_storage_t;

typedef struct scoring_esp32_journal {
  scoring_esp32_journal_storage_t *storage;
  uint32_t max_records;
  uint32_t generation;
  uint32_t record_count;
  uint8_t active_slot;
  bool is_open;
  bool cursor_valid;
  uint32_t cursor;
  scoring_esp32_journal_recovery_t recovery;
} scoring_esp32_journal_t;

/* Two inline slots are host fault-model storage, not target DRAM evidence. */
_Static_assert(
  sizeof(scoring_esp32_journal_storage_t) >= SCORING_ESP32_JOURNAL_HOST_STORAGE_MIN_BYTES,
  "M3-09 host journal layout unexpectedly shrank"
);
_Static_assert(
  sizeof(scoring_esp32_journal_storage_t) <= SCORING_ESP32_JOURNAL_HOST_STORAGE_MAX_BYTES,
  "M3-09 host journal storage exceeds its bounded host model"
);

void scoring_esp32_journal_storage_init(scoring_esp32_journal_storage_t *storage);
void scoring_esp32_journal_arm_power_loss(
  scoring_esp32_journal_storage_t *storage,
  scoring_esp32_journal_write_boundary_t boundary
);

/* Host-only fault hooks used by the Release and Debug evidence suites. */
scoring_esp32_result_t scoring_esp32_journal_corrupt_committed(
  scoring_esp32_journal_storage_t *storage,
  uint32_t record_index
);

scoring_esp32_result_t scoring_esp32_journal_open(
  scoring_esp32_journal_t *journal,
  scoring_esp32_journal_storage_t *storage,
  size_t max_records
);

/* Re-read only committed slots after an ESP32 application reset. */
scoring_esp32_result_t scoring_esp32_journal_reopen(scoring_esp32_journal_t *journal);

scoring_esp32_result_t scoring_esp32_journal_append(
  scoring_esp32_journal_t *journal,
  uint32_t transport_sequence,
  scoring_esp32_bytes_t bytes
);

/* Commits a valid ignored STM32 frame without retaining a scoring payload. */
scoring_esp32_result_t scoring_esp32_journal_advance_cursor(
  scoring_esp32_journal_t *journal,
  uint32_t transport_sequence
);

size_t scoring_esp32_journal_count(const scoring_esp32_journal_t *journal);
scoring_esp32_journal_recovery_t scoring_esp32_journal_recovery(const scoring_esp32_journal_t *journal);

/* Copies the stored authoritative payload; no scoring or payload decode occurs. */
scoring_esp32_result_t scoring_esp32_journal_replay(
  const scoring_esp32_journal_t *journal,
  size_t record_index,
  scoring_esp32_mutable_bytes_t destination,
  size_t *out_length,
  uint32_t *out_transport_sequence
);

#endif

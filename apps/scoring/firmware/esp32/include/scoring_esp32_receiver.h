#ifndef SCORING_ESP32_RECEIVER_H
#define SCORING_ESP32_RECEIVER_H

#include "scoring_esp32_journal.h"

#include <stdbool.h>
#include <stdint.h>

typedef enum scoring_esp32_receiver_outcome {
  SCORING_ESP32_RECEIVER_ACCEPTED = 0,
  SCORING_ESP32_RECEIVER_IGNORED,
  SCORING_ESP32_RECEIVER_REJECTED
} scoring_esp32_receiver_outcome_t;

typedef struct scoring_esp32_receiver_receipt {
  scoring_esp32_receiver_outcome_t outcome;
  scoring_esp32_result_t result;
  bool has_sequence;
  uint32_t sequence;
  /* Borrowed ingress bytes; valid only until the next receive or reset. */
  scoring_esp32_bytes_t record;
} scoring_esp32_receiver_receipt_t;

typedef struct scoring_esp32_receiver {
  scoring_esp32_app_t ingress;
  scoring_esp32_journal_t journal;
  scoring_esp32_services_t services;
  bool has_expected_sequence;
  bool sequence_exhausted;
  bool link_degraded;
  uint32_t expected_sequence;
  bool application_ready;
  scoring_esp32_identifier_t application_boot_id;
} scoring_esp32_receiver_t;

/* Opens the bounded durable journal and starts one STM32 sender stream. */
scoring_esp32_result_t scoring_esp32_receiver_init(
  scoring_esp32_receiver_t *receiver,
  const scoring_esp32_services_t *services,
  scoring_esp32_journal_storage_t *storage,
  size_t max_records
);

/*
 * ESP32 application lifecycle only. This never calls a reset or control
 * service and has no API through which it could reset the STM32.
 */
scoring_esp32_result_t scoring_esp32_receiver_reset(scoring_esp32_receiver_t *receiver);

scoring_esp32_result_t scoring_esp32_receiver_receive(
  scoring_esp32_receiver_t *receiver,
  scoring_esp32_receiver_receipt_t *out_receipt
);

bool scoring_esp32_receiver_is_link_degraded(const scoring_esp32_receiver_t *receiver);
bool scoring_esp32_receiver_has_expected_sequence(
  const scoring_esp32_receiver_t *receiver,
  uint32_t *out_expected_sequence
);
scoring_esp32_result_t scoring_esp32_receiver_read_application_boot_id(
  const scoring_esp32_receiver_t *receiver,
  scoring_esp32_identifier_t *out_id
);
const scoring_esp32_journal_t *scoring_esp32_receiver_journal(const scoring_esp32_receiver_t *receiver);

#endif

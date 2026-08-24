#include "scoring_esp32_receiver.h"
#include "scoring_esp32_identifier.h"

#include <string.h>

static void clear_receipt(scoring_esp32_receiver_receipt_t *receipt) {
  *receipt = (scoring_esp32_receiver_receipt_t){
    .outcome = SCORING_ESP32_RECEIVER_IGNORED,
    .result = SCORING_ESP32_RESULT_INVALID_ARGUMENT,
    .has_sequence = false,
    .sequence = 0U,
    .record = {.data = NULL, .length = 0U}
  };
}

static void mark_degraded(scoring_esp32_receiver_t *receiver) {
  receiver->link_degraded = true;
}

static bool boot_ids_equal(
  const scoring_esp32_identifier_t *left,
  const scoring_esp32_identifier_t *right
) {
  return left->length == right->length &&
    memcmp(left->bytes, right->bytes, left->length + 1U) == 0;
}

static scoring_esp32_result_t read_boot_id(
  const scoring_esp32_receiver_t *receiver,
  scoring_esp32_identifier_t *out_id
) {
  scoring_esp32_result_t result;
  if (receiver == NULL || out_id == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  *out_id = (scoring_esp32_identifier_t){0};
  result = scoring_esp32_read_boot_id(&receiver->ingress, out_id);
  if (result != SCORING_ESP32_RESULT_OK) {
    return result;
  }
  if (!scoring_esp32_identifier_is_valid(out_id)) {
    *out_id = (scoring_esp32_identifier_t){0};
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  return SCORING_ESP32_RESULT_OK;
}

static void restore_cursor(scoring_esp32_receiver_t *receiver) {
  receiver->has_expected_sequence = false;
  receiver->sequence_exhausted = false;
  receiver->expected_sequence = 0U;
  if (!receiver->journal.cursor_valid) {
    return;
  }
  if (receiver->journal.cursor == UINT32_MAX) {
    receiver->sequence_exhausted = true;
    return;
  }
  receiver->has_expected_sequence = true;
  receiver->expected_sequence = receiver->journal.cursor + 1U;
}

static scoring_esp32_result_t ignore_receipt(
  scoring_esp32_receiver_receipt_t *receipt,
  scoring_esp32_result_t result
) {
  receipt->outcome = SCORING_ESP32_RECEIVER_IGNORED;
  receipt->result = result;
  receipt->has_sequence = false;
  receipt->sequence = 0U;
  receipt->record = (scoring_esp32_bytes_t){.data = NULL, .length = 0U};
  return result;
}

static scoring_esp32_result_t reject_receipt(
  scoring_esp32_receiver_t *receiver,
  scoring_esp32_receiver_receipt_t *receipt,
  scoring_esp32_result_t result,
  uint32_t sequence,
  bool has_sequence,
  bool degrade
) {
  receipt->outcome = SCORING_ESP32_RECEIVER_REJECTED;
  receipt->result = result;
  receipt->has_sequence = has_sequence;
  receipt->sequence = sequence;
  if (degrade) {
    mark_degraded(receiver);
  }
  return result;
}

static scoring_esp32_result_t accepted_receipt(
  scoring_esp32_receiver_receipt_t *receipt,
  const scoring_esp32_transport_frame_t *frame
) {
  receipt->outcome = SCORING_ESP32_RECEIVER_ACCEPTED;
  receipt->result = SCORING_ESP32_RESULT_OK;
  receipt->record = frame->payload;
  return SCORING_ESP32_RESULT_OK;
}

static scoring_esp32_result_t ignored_frame_receipt(scoring_esp32_receiver_receipt_t *receipt) {
  receipt->outcome = SCORING_ESP32_RECEIVER_IGNORED;
  receipt->result = SCORING_ESP32_RESULT_IGNORED;
  receipt->record = (scoring_esp32_bytes_t){.data = NULL, .length = 0U};
  return SCORING_ESP32_RESULT_IGNORED;
}

static scoring_esp32_result_t duplicate_receipt(scoring_esp32_receiver_receipt_t *receipt) {
  receipt->outcome = SCORING_ESP32_RECEIVER_REJECTED;
  receipt->result = SCORING_ESP32_RESULT_DUPLICATE;
  receipt->record = (scoring_esp32_bytes_t){.data = NULL, .length = 0U};
  return SCORING_ESP32_RESULT_DUPLICATE;
}

/* Reads and decodes one complete frame without touching journal or receipt state. */
static scoring_esp32_result_t receive_transport_frame(
  scoring_esp32_receiver_t *receiver,
  scoring_esp32_transport_frame_t *out_frame
) {
  scoring_esp32_result_t result;
  size_t frame_length = 0U;
  if (receiver == NULL || out_frame == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  *out_frame = (scoring_esp32_transport_frame_t){0};
  result = receiver->ingress.services.scoring_link.read_frame(
    receiver->ingress.services.scoring_link.context,
    (scoring_esp32_mutable_bytes_t){
      .data = receiver->ingress.scoring_link_buffer,
      .capacity = sizeof(receiver->ingress.scoring_link_buffer)
    },
    &frame_length
  );
  if (result != SCORING_ESP32_RESULT_OK) {
    return result;
  }
  if (frame_length == 0U) {
    return SCORING_ESP32_RESULT_UNAVAILABLE;
  }
  if (frame_length > sizeof(receiver->ingress.scoring_link_buffer)) {
    return SCORING_ESP32_RESULT_BUFFER_TOO_SMALL;
  }
  return scoring_esp32_decode_transport_frame(
    SCORING_ESP32_TRANSPORT_RECEIVER_ESP32,
    (scoring_esp32_bytes_t){.data = receiver->ingress.scoring_link_buffer, .length = frame_length},
    out_frame
  );
}

static scoring_esp32_result_t classify_sequence(
  const scoring_esp32_receiver_t *receiver,
  const scoring_esp32_transport_frame_t *frame
) {
  if (receiver == NULL || frame == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  if (!receiver->has_expected_sequence) {
    return SCORING_ESP32_RESULT_OK;
  }
  if (frame->sequence < receiver->expected_sequence) {
    return SCORING_ESP32_RESULT_DUPLICATE;
  }
  if (frame->sequence > receiver->expected_sequence) {
    return SCORING_ESP32_RESULT_OUT_OF_ORDER;
  }
  return SCORING_ESP32_RESULT_OK;
}

typedef enum receiver_journal_projection {
  RECEIVER_JOURNAL_REJECTED = 0,
  RECEIVER_JOURNAL_IGNORED,
  RECEIVER_JOURNAL_DUPLICATE,
  RECEIVER_JOURNAL_ACCEPTED
} receiver_journal_projection_t;

typedef struct receiver_journal_transition {
  scoring_esp32_result_t result;
  receiver_journal_projection_t projection;
} receiver_journal_transition_t;

/* Applies an already-decoded frame to the journal without parsing transport bytes. */
static receiver_journal_transition_t project_frame_to_journal(
  scoring_esp32_receiver_t *receiver,
  const scoring_esp32_transport_frame_t *frame
) {
  scoring_esp32_result_t result;
  receiver_journal_transition_t transition = {
    .result = SCORING_ESP32_RESULT_OK,
    .projection = RECEIVER_JOURNAL_ACCEPTED
  };
  if (receiver == NULL || frame == NULL) {
    return (receiver_journal_transition_t){
      .result = SCORING_ESP32_RESULT_INVALID_ARGUMENT,
      .projection = RECEIVER_JOURNAL_REJECTED
    };
  }
  if (frame->message_type != SCORING_ESP32_TRANSPORT_DECISION_RECORD) {
    result = scoring_esp32_journal_advance_cursor(&receiver->journal, frame->sequence);
    if (result == SCORING_ESP32_RESULT_DUPLICATE) {
      restore_cursor(receiver);
      transition.result = SCORING_ESP32_RESULT_IGNORED;
      transition.projection = RECEIVER_JOURNAL_IGNORED;
      return transition;
    }
    if (result != SCORING_ESP32_RESULT_OK) {
      transition.result = result;
      transition.projection = RECEIVER_JOURNAL_REJECTED;
      return transition;
    }
    restore_cursor(receiver);
    transition.projection = RECEIVER_JOURNAL_IGNORED;
    return transition;
  }

  result = scoring_esp32_journal_append(&receiver->journal, frame->sequence, frame->payload);
  if (result == SCORING_ESP32_RESULT_DUPLICATE) {
    result = scoring_esp32_journal_advance_cursor(&receiver->journal, frame->sequence);
    if (result != SCORING_ESP32_RESULT_OK && result != SCORING_ESP32_RESULT_DUPLICATE) {
      transition.result = result;
      transition.projection = RECEIVER_JOURNAL_REJECTED;
      return transition;
    }
    restore_cursor(receiver);
    transition.result = SCORING_ESP32_RESULT_DUPLICATE;
    transition.projection = RECEIVER_JOURNAL_DUPLICATE;
    return transition;
  }
  if (result != SCORING_ESP32_RESULT_OK) {
    transition.result = result;
    transition.projection = RECEIVER_JOURNAL_REJECTED;
    return transition;
  }
  restore_cursor(receiver);
  return transition;
}

static scoring_esp32_result_t forward_authoritative_record(
  const scoring_esp32_receiver_t *receiver,
  const scoring_esp32_transport_frame_t *frame
) {
  scoring_esp32_authoritative_record_t record;
  if (receiver->services.storage.append_authoritative_record == NULL) {
    return SCORING_ESP32_RESULT_OK;
  }
  record = (scoring_esp32_authoritative_record_t){
    .transport_sequence = frame->sequence,
    .bytes = frame->payload
  };
  return receiver->services.storage.append_authoritative_record(receiver->services.storage.context, &record);
}

scoring_esp32_result_t scoring_esp32_receiver_init(
  scoring_esp32_receiver_t *receiver,
  const scoring_esp32_services_t *services,
  scoring_esp32_journal_storage_t *storage,
  size_t max_records
) {
  scoring_esp32_result_t result;
  scoring_esp32_identifier_t boot_id;
  if (receiver == NULL || storage == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  *receiver = (scoring_esp32_receiver_t){0};
  if (services != NULL) {
    receiver->services = *services;
  }
  result = scoring_esp32_app_init(&receiver->ingress, &receiver->services);
  if (result != SCORING_ESP32_RESULT_OK) {
    return result;
  }
  result = read_boot_id(receiver, &boot_id);
  if (result != SCORING_ESP32_RESULT_OK) {
    return result;
  }
  result = scoring_esp32_journal_open(&receiver->journal, storage, max_records);
  if (result != SCORING_ESP32_RESULT_OK) {
    return result;
  }
  receiver->application_boot_id = boot_id;
  receiver->application_ready = true;
  restore_cursor(receiver);
  return SCORING_ESP32_RESULT_OK;
}

scoring_esp32_result_t scoring_esp32_receiver_reset(scoring_esp32_receiver_t *receiver) {
  scoring_esp32_result_t result;
  scoring_esp32_identifier_t next_boot_id;
  if (receiver == NULL || !receiver->journal.is_open) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  receiver->application_ready = false;
  result = read_boot_id(receiver, &next_boot_id);
  if (result != SCORING_ESP32_RESULT_OK) {
    mark_degraded(receiver);
    return result;
  }
  if (boot_ids_equal(&receiver->application_boot_id, &next_boot_id)) {
    mark_degraded(receiver);
    return SCORING_ESP32_RESULT_REJECTED;
  }
  result = scoring_esp32_journal_reopen(&receiver->journal);
  if (result != SCORING_ESP32_RESULT_OK) {
    mark_degraded(receiver);
    return result;
  }
  result = scoring_esp32_app_init(&receiver->ingress, &receiver->services);
  if (result != SCORING_ESP32_RESULT_OK) {
    mark_degraded(receiver);
    return result;
  }
  receiver->application_boot_id = next_boot_id;
  receiver->application_ready = true;
  receiver->link_degraded = false;
  restore_cursor(receiver);
  return SCORING_ESP32_RESULT_OK;
}

scoring_esp32_result_t scoring_esp32_receiver_receive(
  scoring_esp32_receiver_t *receiver,
  scoring_esp32_receiver_receipt_t *out_receipt
) {
  scoring_esp32_result_t result;
  scoring_esp32_transport_frame_t frame;
  receiver_journal_transition_t transition;
  if (receiver == NULL || out_receipt == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  clear_receipt(out_receipt);
  if (!receiver->application_ready) {
    return ignore_receipt(out_receipt, SCORING_ESP32_RESULT_UNAVAILABLE);
  }
  if (receiver->sequence_exhausted) {
    return reject_receipt(receiver, out_receipt, SCORING_ESP32_RESULT_SEQUENCE_EXHAUSTED, 0U, false, true);
  }
  result = receive_transport_frame(receiver, &frame);
  if (result != SCORING_ESP32_RESULT_OK) {
    if (result == SCORING_ESP32_RESULT_UNAVAILABLE) {
      return ignore_receipt(out_receipt, result);
    }
    return reject_receipt(receiver, out_receipt, result, 0U, false, true);
  }
  out_receipt->has_sequence = true;
  out_receipt->sequence = frame.sequence;
  result = classify_sequence(receiver, &frame);
  if (result == SCORING_ESP32_RESULT_DUPLICATE) {
    return reject_receipt(receiver, out_receipt, result, frame.sequence, true, false);
  }
  if (result == SCORING_ESP32_RESULT_OUT_OF_ORDER) {
    return reject_receipt(receiver, out_receipt, result, frame.sequence, true, true);
  }
  if (result != SCORING_ESP32_RESULT_OK) {
    return reject_receipt(receiver, out_receipt, result, frame.sequence, true, true);
  }
  transition = project_frame_to_journal(receiver, &frame);
  if (transition.result != SCORING_ESP32_RESULT_OK &&
      transition.result != SCORING_ESP32_RESULT_IGNORED &&
      transition.result != SCORING_ESP32_RESULT_DUPLICATE) {
    return reject_receipt(receiver, out_receipt, transition.result, frame.sequence, true, true);
  }
  if (transition.projection == RECEIVER_JOURNAL_IGNORED) {
    return ignored_frame_receipt(out_receipt);
  }
  if (transition.projection == RECEIVER_JOURNAL_DUPLICATE) {
    return duplicate_receipt(out_receipt);
  }
  result = forward_authoritative_record(receiver, &frame);
  if (result != SCORING_ESP32_RESULT_OK) {
    return reject_receipt(receiver, out_receipt, result, frame.sequence, true, true);
  }
  return accepted_receipt(out_receipt, &frame);
}

bool scoring_esp32_receiver_is_link_degraded(const scoring_esp32_receiver_t *receiver) {
  return receiver != NULL && receiver->link_degraded;
}

bool scoring_esp32_receiver_has_expected_sequence(
  const scoring_esp32_receiver_t *receiver,
  uint32_t *out_expected_sequence
) {
  if (receiver == NULL || out_expected_sequence == NULL || !receiver->has_expected_sequence) {
    return false;
  }
  *out_expected_sequence = receiver->expected_sequence;
  return true;
}

scoring_esp32_result_t scoring_esp32_receiver_read_application_boot_id(
  const scoring_esp32_receiver_t *receiver,
  scoring_esp32_identifier_t *out_id
) {
  if (receiver == NULL || out_id == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  if (!receiver->application_ready) {
    *out_id = (scoring_esp32_identifier_t){0};
    return SCORING_ESP32_RESULT_UNAVAILABLE;
  }
  *out_id = receiver->application_boot_id;
  return SCORING_ESP32_RESULT_OK;
}

const scoring_esp32_journal_t *scoring_esp32_receiver_journal(const scoring_esp32_receiver_t *receiver) {
  return receiver == NULL ? NULL : &receiver->journal;
}

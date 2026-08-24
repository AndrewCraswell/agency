#include "scoring_esp32_services.h"

#include <string.h>

enum {
  TRANSPORT_MAGIC_FIRST = 0x53,
  TRANSPORT_MAGIC_SECOND = 0x43,
  TRANSPORT_VERSION = 1
};

static uint16_t read_u16_be(const uint8_t *bytes) {
  return (uint16_t)(((uint16_t)bytes[0] << 8U) | (uint16_t)bytes[1]);
}

static uint32_t read_u32_be(const uint8_t *bytes) {
  return ((uint32_t)bytes[0] << 24U) | ((uint32_t)bytes[1] << 16U) | ((uint32_t)bytes[2] << 8U) |
         (uint32_t)bytes[3];
}

static bool is_known_message_type(uint8_t value) {
  return value >= SCORING_ESP32_TRANSPORT_DECISION_RECORD && value <= SCORING_ESP32_TRANSPORT_RESPONSE;
}

static bool is_valid_receiver(scoring_esp32_transport_receiver_t receiver) {
  return receiver == SCORING_ESP32_TRANSPORT_RECEIVER_STM32 || receiver == SCORING_ESP32_TRANSPORT_RECEIVER_ESP32;
}

static bool is_allowed_for_receiver(
  scoring_esp32_transport_receiver_t receiver,
  scoring_esp32_transport_message_type_t message_type
) {
  if (receiver == SCORING_ESP32_TRANSPORT_RECEIVER_STM32) {
    return message_type == SCORING_ESP32_TRANSPORT_REQUEST;
  }
  return message_type == SCORING_ESP32_TRANSPORT_DECISION_RECORD || message_type == SCORING_ESP32_TRANSPORT_STATUS ||
         message_type == SCORING_ESP32_TRANSPORT_RESPONSE;
}

static bool is_valid_identifier(const scoring_esp32_identifier_t *identifier) {
  return identifier != NULL && identifier->length <= SCORING_ESP32_MAX_IDENTIFIER_BYTES &&
         identifier->bytes[identifier->length] == '\0';
}

static scoring_esp32_result_t unavailable_storage(
  void *context,
  const scoring_esp32_authoritative_record_t *record
) {
  (void)context;
  (void)record;
  return SCORING_ESP32_RESULT_UNAVAILABLE;
}

static scoring_esp32_result_t unavailable_read_monotonic(void *context, uint64_t *out_us) {
  (void)context;
  if (out_us != NULL) {
    *out_us = 0U;
  }
  return SCORING_ESP32_RESULT_UNAVAILABLE;
}

static scoring_esp32_result_t unavailable_read_time(void *context, scoring_esp32_time_metadata_t *out_metadata) {
  (void)context;
  if (out_metadata != NULL) {
    *out_metadata = (scoring_esp32_time_metadata_t){
      .is_available = false,
      .source = SCORING_ESP32_WALL_CLOCK_UNAVAILABLE,
      .uncertainty_us = 0U,
      .wall_clock_at_us = 0
    };
  }
  return SCORING_ESP32_RESULT_UNAVAILABLE;
}

static scoring_esp32_result_t unavailable_read_identifier(void *context, scoring_esp32_identifier_t *out_identifier) {
  (void)context;
  if (out_identifier != NULL) {
    *out_identifier = (scoring_esp32_identifier_t){.bytes = {0}, .length = 0U};
  }
  return SCORING_ESP32_RESULT_UNAVAILABLE;
}

static scoring_esp32_result_t unavailable_bytes(void *context, scoring_esp32_bytes_t bytes) {
  (void)context;
  (void)bytes;
  return SCORING_ESP32_RESULT_UNAVAILABLE;
}

static scoring_esp32_result_t unavailable_no_arguments(void *context) {
  (void)context;
  return SCORING_ESP32_RESULT_UNAVAILABLE;
}

static scoring_esp32_result_t unavailable_reset(void *context, scoring_esp32_reset_reason_t reason) {
  (void)context;
  (void)reason;
  return SCORING_ESP32_RESULT_UNAVAILABLE;
}

static scoring_esp32_result_t unavailable_read_frame(
  void *context,
  scoring_esp32_mutable_bytes_t destination,
  size_t *out_frame_length
) {
  (void)context;
  (void)destination;
  if (out_frame_length != NULL) {
    *out_frame_length = 0U;
  }
  return SCORING_ESP32_RESULT_UNAVAILABLE;
}

static scoring_esp32_services_t normalize_services(const scoring_esp32_services_t *services) {
  scoring_esp32_services_t normalized = {0};
  if (services != NULL) {
    normalized = *services;
  }

  if (normalized.storage.append_authoritative_record == NULL) {
    normalized.storage.append_authoritative_record = unavailable_storage;
  }
  if (normalized.clock.read_monotonic_us == NULL) {
    normalized.clock.read_monotonic_us = unavailable_read_monotonic;
  }
  if (normalized.clock.read_time_metadata == NULL) {
    normalized.clock.read_time_metadata = unavailable_read_time;
  }
  if (normalized.identity.read_boot_id == NULL) {
    normalized.identity.read_boot_id = unavailable_read_identifier;
  }
  if (normalized.identity.read_device_id == NULL) {
    normalized.identity.read_device_id = unavailable_read_identifier;
  }
  if (normalized.network.publish_status == NULL) {
    normalized.network.publish_status = unavailable_bytes;
  }
  if (normalized.display.present_status == NULL) {
    normalized.display.present_status = unavailable_bytes;
  }
  if (normalized.audio.play_notification == NULL) {
    normalized.audio.play_notification = unavailable_bytes;
  }
  if (normalized.signed_update.stage_signed_update == NULL) {
    normalized.signed_update.stage_signed_update = unavailable_bytes;
  }
  if (normalized.signed_update.activate_staged_update == NULL) {
    normalized.signed_update.activate_staged_update = unavailable_no_arguments;
  }
  if (normalized.watchdog.feed == NULL) {
    normalized.watchdog.feed = unavailable_no_arguments;
  }
  if (normalized.reset.request_reset == NULL) {
    normalized.reset.request_reset = unavailable_reset;
  }
  if (normalized.scoring_link.read_frame == NULL) {
    normalized.scoring_link.read_frame = unavailable_read_frame;
  }
  return normalized;
}

uint32_t scoring_esp32_calculate_crc32c(scoring_esp32_bytes_t bytes) {
  uint32_t crc = UINT32_MAX;
  size_t index;
  unsigned int bit;
  if (bytes.data == NULL && bytes.length != 0U) {
    return 0U;
  }
  for (index = 0U; index < bytes.length; ++index) {
    crc ^= bytes.data[index];
    for (bit = 0U; bit < 8U; ++bit) {
      const uint32_t mask = (uint32_t)(-(int32_t)(crc & 1U));
      crc = (crc >> 1U) ^ (UINT32_C(0x82F63B78) & mask);
    }
  }
  return crc ^ UINT32_MAX;
}

scoring_esp32_result_t scoring_esp32_decode_transport_frame(
  scoring_esp32_transport_receiver_t receiver,
  scoring_esp32_bytes_t encoded,
  scoring_esp32_transport_frame_t *out_frame
) {
  const uint8_t *bytes;
  uint32_t payload_length;
  size_t payload_end;
  size_t expected_length;
  uint32_t encoded_crc;
  uint32_t calculated_crc;

  if (!is_valid_receiver(receiver) || out_frame == NULL || (encoded.data == NULL && encoded.length != 0U)) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  *out_frame = (scoring_esp32_transport_frame_t){0};
  if (encoded.length < SCORING_ESP32_TRANSPORT_HEADER_BYTES) {
    return SCORING_ESP32_RESULT_FRAME_TRUNCATED;
  }
  if (encoded.length > SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES) {
    return SCORING_ESP32_RESULT_FRAME_INVALID;
  }

  bytes = encoded.data;
  if (bytes[0] != TRANSPORT_MAGIC_FIRST || bytes[1] != TRANSPORT_MAGIC_SECOND || bytes[2] != TRANSPORT_VERSION) {
    return SCORING_ESP32_RESULT_FRAME_INVALID;
  }
  if (!is_known_message_type(bytes[3])) {
    return SCORING_ESP32_RESULT_FRAME_INVALID;
  }
  if (!is_allowed_for_receiver(receiver, (scoring_esp32_transport_message_type_t)bytes[3])) {
    return SCORING_ESP32_RESULT_FRAME_INVALID;
  }

  payload_length = read_u32_be(&bytes[10]);
  if (payload_length > SCORING_ESP32_MAX_TRANSPORT_PAYLOAD_BYTES) {
    return SCORING_ESP32_RESULT_FRAME_INVALID;
  }
  payload_end = SCORING_ESP32_TRANSPORT_HEADER_BYTES + (size_t)payload_length;
  expected_length = payload_end + SCORING_ESP32_TRANSPORT_CRC_BYTES;
  if (encoded.length < expected_length) {
    return SCORING_ESP32_RESULT_FRAME_TRUNCATED;
  }
  if (encoded.length != expected_length) {
    return SCORING_ESP32_RESULT_FRAME_INVALID;
  }
  encoded_crc = read_u32_be(&bytes[payload_end]);
  calculated_crc = scoring_esp32_calculate_crc32c((scoring_esp32_bytes_t){.data = bytes, .length = payload_end});
  if (encoded_crc != calculated_crc) {
    return SCORING_ESP32_RESULT_FRAME_INTEGRITY_FAILURE;
  }

  out_frame->flags = read_u16_be(&bytes[4]);
  out_frame->message_type = (scoring_esp32_transport_message_type_t)bytes[3];
  out_frame->payload = (scoring_esp32_bytes_t){.data = &bytes[SCORING_ESP32_TRANSPORT_HEADER_BYTES], .length = payload_length};
  out_frame->sequence = read_u32_be(&bytes[6]);
  if (out_frame->flags != 0U) {
    *out_frame = (scoring_esp32_transport_frame_t){0};
    return SCORING_ESP32_RESULT_FRAME_INVALID;
  }
  return SCORING_ESP32_RESULT_OK;
}

scoring_esp32_result_t scoring_esp32_app_init(scoring_esp32_app_t *app, const scoring_esp32_services_t *services) {
  if (app == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  *app = (scoring_esp32_app_t){0};
  app->services = normalize_services(services);
  return SCORING_ESP32_RESULT_OK;
}

scoring_esp32_result_t scoring_esp32_read_monotonic_us(const scoring_esp32_app_t *app, uint64_t *out_us) {
  if (app == NULL || out_us == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  return app->services.clock.read_monotonic_us(app->services.clock.context, out_us);
}

scoring_esp32_result_t scoring_esp32_read_time_metadata(
  const scoring_esp32_app_t *app,
  scoring_esp32_time_metadata_t *out_metadata
) {
  if (app == NULL || out_metadata == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  return app->services.clock.read_time_metadata(app->services.clock.context, out_metadata);
}

scoring_esp32_result_t scoring_esp32_read_boot_id(const scoring_esp32_app_t *app, scoring_esp32_identifier_t *out_id) {
  scoring_esp32_result_t result;
  if (app == NULL || out_id == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  result = app->services.identity.read_boot_id(app->services.identity.context, out_id);
  if (result == SCORING_ESP32_RESULT_OK && !is_valid_identifier(out_id)) {
    *out_id = (scoring_esp32_identifier_t){.bytes = {0}, .length = 0U};
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  return result;
}

scoring_esp32_result_t scoring_esp32_read_device_id(const scoring_esp32_app_t *app, scoring_esp32_identifier_t *out_id) {
  scoring_esp32_result_t result;
  if (app == NULL || out_id == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  result = app->services.identity.read_device_id(app->services.identity.context, out_id);
  if (result == SCORING_ESP32_RESULT_OK && !is_valid_identifier(out_id)) {
    *out_id = (scoring_esp32_identifier_t){.bytes = {0}, .length = 0U};
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  return result;
}

scoring_esp32_result_t scoring_esp32_publish_status(const scoring_esp32_app_t *app, scoring_esp32_bytes_t status) {
  if (app == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  return app->services.network.publish_status(app->services.network.context, status);
}

scoring_esp32_result_t scoring_esp32_present_status(const scoring_esp32_app_t *app, scoring_esp32_bytes_t status) {
  if (app == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  return app->services.display.present_status(app->services.display.context, status);
}

scoring_esp32_result_t scoring_esp32_play_notification(const scoring_esp32_app_t *app, scoring_esp32_bytes_t notification) {
  if (app == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  return app->services.audio.play_notification(app->services.audio.context, notification);
}

scoring_esp32_result_t scoring_esp32_stage_signed_update(const scoring_esp32_app_t *app, scoring_esp32_bytes_t bundle) {
  if (app == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  return app->services.signed_update.stage_signed_update(app->services.signed_update.context, bundle);
}

scoring_esp32_result_t scoring_esp32_activate_staged_update(const scoring_esp32_app_t *app) {
  if (app == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  return app->services.signed_update.activate_staged_update(app->services.signed_update.context);
}

scoring_esp32_result_t scoring_esp32_feed_watchdog(const scoring_esp32_app_t *app) {
  if (app == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  return app->services.watchdog.feed(app->services.watchdog.context);
}

scoring_esp32_result_t scoring_esp32_request_reset(const scoring_esp32_app_t *app, scoring_esp32_reset_reason_t reason) {
  if (app == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  return app->services.reset.request_reset(app->services.reset.context, reason);
}

#ifndef SCORING_ESP32_SERVICES_H
#define SCORING_ESP32_SERVICES_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

/*
 * M3-08 service boundary for the non-authoritative ESP32-S3 application
 * processor. These C17 definitions deliberately do not include ESP-IDF,
 * FreeRTOS, storage-driver, or scoring-core headers.
 */

enum {
  SCORING_ESP32_MAX_IDENTIFIER_BYTES = 64,
  SCORING_ESP32_MAX_TRANSPORT_PAYLOAD_BYTES = 4096,
  SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES = 4114,
  SCORING_ESP32_TRANSPORT_HEADER_BYTES = 14,
  SCORING_ESP32_TRANSPORT_CRC_BYTES = 4
};

typedef enum scoring_esp32_result {
  SCORING_ESP32_RESULT_OK = 0,
  SCORING_ESP32_RESULT_INVALID_ARGUMENT,
  SCORING_ESP32_RESULT_UNAVAILABLE,
  SCORING_ESP32_RESULT_BUFFER_TOO_SMALL,
  SCORING_ESP32_RESULT_FRAME_TRUNCATED,
  SCORING_ESP32_RESULT_FRAME_INVALID,
  SCORING_ESP32_RESULT_FRAME_INTEGRITY_FAILURE,
  SCORING_ESP32_RESULT_REJECTED,
  SCORING_ESP32_RESULT_NOT_SUPPORTED,
  SCORING_ESP32_RESULT_DUPLICATE,
  SCORING_ESP32_RESULT_CONFLICT,
  SCORING_ESP32_RESULT_OUT_OF_ORDER,
  SCORING_ESP32_RESULT_BACKPRESSURE,
  SCORING_ESP32_RESULT_POWER_LOSS,
  SCORING_ESP32_RESULT_JOURNAL_CORRUPT,
  SCORING_ESP32_RESULT_SEQUENCE_EXHAUSTED,
  SCORING_ESP32_RESULT_IGNORED
} scoring_esp32_result_t;

typedef struct scoring_esp32_bytes {
  const uint8_t *data;
  size_t length;
} scoring_esp32_bytes_t;

typedef struct scoring_esp32_mutable_bytes {
  uint8_t *data;
  size_t capacity;
} scoring_esp32_mutable_bytes_t;

typedef struct scoring_esp32_identifier {
  char bytes[SCORING_ESP32_MAX_IDENTIFIER_BYTES + 1];
  size_t length;
} scoring_esp32_identifier_t;

typedef enum scoring_esp32_wall_clock_source {
  SCORING_ESP32_WALL_CLOCK_UNAVAILABLE = 0,
  SCORING_ESP32_WALL_CLOCK_RTC,
  SCORING_ESP32_WALL_CLOCK_NETWORK
} scoring_esp32_wall_clock_source_t;

typedef struct scoring_esp32_time_metadata {
  bool is_available;
  int64_t wall_clock_at_us;
  uint64_t uncertainty_us;
  scoring_esp32_wall_clock_source_t source;
} scoring_esp32_time_metadata_t;

typedef struct scoring_esp32_authoritative_record {
  /* STM32 frame sequence, not an ESP application sequence. */
  uint32_t transport_sequence;
  /* Opaque M0-05 record bytes. The ESP32 must not deserialize or alter them here. */
  scoring_esp32_bytes_t bytes;
} scoring_esp32_authoritative_record_t;

typedef enum scoring_esp32_transport_message_type {
  SCORING_ESP32_TRANSPORT_DECISION_RECORD = 1,
  SCORING_ESP32_TRANSPORT_STATUS = 2,
  SCORING_ESP32_TRANSPORT_REQUEST = 3,
  SCORING_ESP32_TRANSPORT_RESPONSE = 4
} scoring_esp32_transport_message_type_t;

typedef enum scoring_esp32_transport_receiver {
  SCORING_ESP32_TRANSPORT_RECEIVER_STM32 = 0,
  SCORING_ESP32_TRANSPORT_RECEIVER_ESP32
} scoring_esp32_transport_receiver_t;

typedef struct scoring_esp32_transport_frame {
  uint16_t flags;
  scoring_esp32_transport_message_type_t message_type;
  scoring_esp32_bytes_t payload;
  uint32_t sequence;
} scoring_esp32_transport_frame_t;

typedef struct scoring_esp32_storage_service {
  void *context;
  scoring_esp32_result_t (*append_authoritative_record)(
    void *context,
    const scoring_esp32_authoritative_record_t *record
  );
} scoring_esp32_storage_service_t;

typedef struct scoring_esp32_clock_service {
  void *context;
  scoring_esp32_result_t (*read_monotonic_us)(void *context, uint64_t *out_us);
  scoring_esp32_result_t (*read_time_metadata)(void *context, scoring_esp32_time_metadata_t *out_metadata);
} scoring_esp32_clock_service_t;

typedef struct scoring_esp32_identity_service {
  void *context;
  scoring_esp32_result_t (*read_boot_id)(void *context, scoring_esp32_identifier_t *out_boot_id);
  scoring_esp32_result_t (*read_device_id)(void *context, scoring_esp32_identifier_t *out_device_id);
} scoring_esp32_identity_service_t;

typedef struct scoring_esp32_network_service {
  void *context;
  scoring_esp32_result_t (*publish_status)(void *context, scoring_esp32_bytes_t status);
} scoring_esp32_network_service_t;

typedef struct scoring_esp32_display_service {
  void *context;
  scoring_esp32_result_t (*present_status)(void *context, scoring_esp32_bytes_t status);
} scoring_esp32_display_service_t;

typedef struct scoring_esp32_audio_service {
  void *context;
  scoring_esp32_result_t (*play_notification)(void *context, scoring_esp32_bytes_t notification);
} scoring_esp32_audio_service_t;

typedef struct scoring_esp32_signed_update_service {
  void *context;
  /* The target adapter owns signature verification and secure storage policy. */
  scoring_esp32_result_t (*stage_signed_update)(void *context, scoring_esp32_bytes_t update_bundle);
  scoring_esp32_result_t (*activate_staged_update)(void *context);
} scoring_esp32_signed_update_service_t;

typedef struct scoring_esp32_watchdog_service {
  void *context;
  scoring_esp32_result_t (*feed)(void *context);
} scoring_esp32_watchdog_service_t;

typedef enum scoring_esp32_reset_reason {
  SCORING_ESP32_RESET_OPERATOR = 0,
  SCORING_ESP32_RESET_RECOVERY,
  SCORING_ESP32_RESET_UPDATE
} scoring_esp32_reset_reason_t;

typedef struct scoring_esp32_reset_service {
  void *context;
  /* Local ESP32 reset only. This boundary exposes no STM32 reset or control path. */
  scoring_esp32_result_t (*request_reset)(void *context, scoring_esp32_reset_reason_t reason);
} scoring_esp32_reset_service_t;

typedef struct scoring_esp32_scoring_link_service {
  void *context;
  /* Read-only STM32-to-ESP32 ingress. There is intentionally no decision write API. */
  scoring_esp32_result_t (*read_frame)(
    void *context,
    scoring_esp32_mutable_bytes_t destination,
    size_t *out_frame_length
  );
} scoring_esp32_scoring_link_service_t;

typedef struct scoring_esp32_services {
  scoring_esp32_audio_service_t audio;
  scoring_esp32_clock_service_t clock;
  scoring_esp32_display_service_t display;
  scoring_esp32_identity_service_t identity;
  scoring_esp32_network_service_t network;
  scoring_esp32_reset_service_t reset;
  scoring_esp32_scoring_link_service_t scoring_link;
  scoring_esp32_signed_update_service_t signed_update;
  scoring_esp32_storage_service_t storage;
  scoring_esp32_watchdog_service_t watchdog;
} scoring_esp32_services_t;

typedef struct scoring_esp32_app {
  scoring_esp32_services_t services;
  uint8_t scoring_link_buffer[SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES];
} scoring_esp32_app_t;

/* M0-06 validation only: the payload remains a borrowed opaque byte view. */
uint32_t scoring_esp32_calculate_crc32c(scoring_esp32_bytes_t bytes);
scoring_esp32_result_t scoring_esp32_decode_transport_frame(
  scoring_esp32_transport_receiver_t receiver,
  scoring_esp32_bytes_t encoded,
  scoring_esp32_transport_frame_t *out_frame
);

/* Missing adapters are normalized to deterministic unavailable services. */
scoring_esp32_result_t scoring_esp32_app_init(scoring_esp32_app_t *app, const scoring_esp32_services_t *services);

/* Accepts only a valid M0-06 decision-record frame and forwards opaque bytes to storage. */
scoring_esp32_result_t scoring_esp32_receive_authoritative_record(
  scoring_esp32_app_t *app,
  scoring_esp32_authoritative_record_t *out_record
);

scoring_esp32_result_t scoring_esp32_read_monotonic_us(const scoring_esp32_app_t *app, uint64_t *out_us);
scoring_esp32_result_t scoring_esp32_read_time_metadata(
  const scoring_esp32_app_t *app,
  scoring_esp32_time_metadata_t *out_metadata
);
scoring_esp32_result_t scoring_esp32_read_boot_id(const scoring_esp32_app_t *app, scoring_esp32_identifier_t *out_id);
scoring_esp32_result_t scoring_esp32_read_device_id(const scoring_esp32_app_t *app, scoring_esp32_identifier_t *out_id);
scoring_esp32_result_t scoring_esp32_publish_status(const scoring_esp32_app_t *app, scoring_esp32_bytes_t status);
scoring_esp32_result_t scoring_esp32_present_status(const scoring_esp32_app_t *app, scoring_esp32_bytes_t status);
scoring_esp32_result_t scoring_esp32_play_notification(const scoring_esp32_app_t *app, scoring_esp32_bytes_t notification);
scoring_esp32_result_t scoring_esp32_stage_signed_update(const scoring_esp32_app_t *app, scoring_esp32_bytes_t bundle);
scoring_esp32_result_t scoring_esp32_activate_staged_update(const scoring_esp32_app_t *app);
scoring_esp32_result_t scoring_esp32_feed_watchdog(const scoring_esp32_app_t *app);
scoring_esp32_result_t scoring_esp32_request_reset(const scoring_esp32_app_t *app, scoring_esp32_reset_reason_t reason);

#endif

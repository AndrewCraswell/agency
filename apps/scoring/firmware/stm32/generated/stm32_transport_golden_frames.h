/* Generated from fixtures/transport-frame-golden.json through dist/transport-frame.js. Do not edit. */
#ifndef STM32_TRANSPORT_GOLDEN_FRAMES_H
#define STM32_TRANSPORT_GOLDEN_FRAMES_H

#include "stm32_transport.h"

typedef struct scoring_stm32_transport_golden_fixture {
  const char *name;
  scoring_stm32_transport_receiver_t receiver;
  scoring_stm32_transport_message_type_t message_type;
  uint32_t sequence;
  const uint8_t *payload;
  size_t payload_length;
  const uint8_t *frame;
  size_t frame_length;
} scoring_stm32_transport_golden_fixture_t;

static const uint8_t SCORING_STM32_TRANSPORT_GOLDEN_0_PAYLOAD[] = { 0x00U, 0x7FU, 0x80U, 0xFFU };
static const uint8_t SCORING_STM32_TRANSPORT_GOLDEN_0_FRAME[] = { 0x53U, 0x43U, 0x01U, 0x01U, 0x00U, 0x00U, 0x01U, 0x02U, 0x03U, 0x04U, 0x00U, 0x00U, 0x00U, 0x04U, 0x00U, 0x7FU, 0x80U, 0xFFU, 0x01U, 0xDEU, 0x6AU, 0xBEU };

static const uint8_t SCORING_STM32_TRANSPORT_GOLDEN_1_PAYLOAD[1] = { 0U };
static const uint8_t SCORING_STM32_TRANSPORT_GOLDEN_1_FRAME[] = { 0x53U, 0x43U, 0x01U, 0x03U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x45U, 0x20U, 0x25U, 0xEAU };

static const uint8_t SCORING_STM32_TRANSPORT_GOLDEN_2_PAYLOAD[] = { 0xA5U };
static const uint8_t SCORING_STM32_TRANSPORT_GOLDEN_2_FRAME[] = { 0x53U, 0x43U, 0x01U, 0x02U, 0x00U, 0x00U, 0xFFU, 0xFFU, 0xFFU, 0xFFU, 0x00U, 0x00U, 0x00U, 0x01U, 0xA5U, 0x2BU, 0x99U, 0x89U, 0xF7U };

static const uint8_t SCORING_STM32_TRANSPORT_GOLDEN_3_PAYLOAD[] = { 0x52U };
static const uint8_t SCORING_STM32_TRANSPORT_GOLDEN_3_FRAME[] = { 0x53U, 0x43U, 0x01U, 0x04U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x07U, 0x00U, 0x00U, 0x00U, 0x01U, 0x52U, 0x69U, 0x4AU, 0x11U, 0x38U };

#define SCORING_STM32_TRANSPORT_GOLDEN_FIXTURE_COUNT 4U
static const scoring_stm32_transport_golden_fixture_t SCORING_STM32_TRANSPORT_GOLDEN_FIXTURES[] = {
  { "decision-record", SCORING_STM32_TRANSPORT_RECEIVER_ESP32, SCORING_STM32_TRANSPORT_DECISION_RECORD, 16909060U, SCORING_STM32_TRANSPORT_GOLDEN_0_PAYLOAD, 4U, SCORING_STM32_TRANSPORT_GOLDEN_0_FRAME, 22U },
  { "request-empty", SCORING_STM32_TRANSPORT_RECEIVER_STM32, SCORING_STM32_TRANSPORT_REQUEST, 0U, SCORING_STM32_TRANSPORT_GOLDEN_1_PAYLOAD, 0U, SCORING_STM32_TRANSPORT_GOLDEN_1_FRAME, 18U },
  { "status-max-sequence", SCORING_STM32_TRANSPORT_RECEIVER_ESP32, SCORING_STM32_TRANSPORT_STATUS, 4294967295U, SCORING_STM32_TRANSPORT_GOLDEN_2_PAYLOAD, 1U, SCORING_STM32_TRANSPORT_GOLDEN_2_FRAME, 19U },
  { "response-boundary-sequence", SCORING_STM32_TRANSPORT_RECEIVER_ESP32, SCORING_STM32_TRANSPORT_RESPONSE, 7U, SCORING_STM32_TRANSPORT_GOLDEN_3_PAYLOAD, 1U, SCORING_STM32_TRANSPORT_GOLDEN_3_FRAME, 19U }
};

#endif

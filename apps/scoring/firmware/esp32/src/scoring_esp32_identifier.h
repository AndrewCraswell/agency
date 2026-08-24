#ifndef SCORING_ESP32_IDENTIFIER_H
#define SCORING_ESP32_IDENTIFIER_H

#include "scoring_esp32_services.h"

static inline bool scoring_esp32_identifier_is_valid(const scoring_esp32_identifier_t *identifier) {
  size_t index;

  if (identifier == NULL || identifier->length == 0U ||
      identifier->length > SCORING_ESP32_MAX_IDENTIFIER_BYTES) {
    return false;
  }
  for (index = 0U; index < identifier->length; ++index) {
    if (identifier->bytes[index] == '\0') {
      return false;
    }
  }
  return identifier->bytes[identifier->length] == '\0';
}

#endif

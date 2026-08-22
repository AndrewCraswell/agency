#include "stm32_scoring_host.h"

#include <stddef.h>
#include <stdint.h>

static scoring_status_t unavailable_now_us(void *context, uint64_t *out_now_us) {
  (void)context;
  (void)out_now_us;
  return SCORING_STATUS_UNAVAILABLE;
}

static scoring_status_t unavailable_read_frame(void *context, scoring_adc_frame_t *out_frame) {
  (void)context;
  (void)out_frame;
  return SCORING_STATUS_UNAVAILABLE;
}

static scoring_status_t unavailable_read_events(
  void *context,
  scoring_comparator_event_t *out_events,
  size_t event_capacity,
  size_t *out_event_count
) {
  (void)context;
  (void)out_events;
  (void)event_capacity;
  (void)out_event_count;
  return SCORING_STATUS_UNAVAILABLE;
}

static scoring_status_t unavailable_pop_frames(
  void *context,
  scoring_adc_frame_t *out_frames,
  size_t frame_capacity,
  size_t *out_frame_count
) {
  (void)context;
  (void)out_frames;
  (void)frame_capacity;
  (void)out_frame_count;
  return SCORING_STATUS_UNAVAILABLE;
}

static scoring_status_t unavailable_read(void *context, uint32_t offset, uint8_t *out_bytes, size_t byte_count) {
  (void)context;
  (void)offset;
  (void)out_bytes;
  (void)byte_count;
  return SCORING_STATUS_UNAVAILABLE;
}

static scoring_status_t unavailable_write(
  void *context,
  uint32_t offset,
  const uint8_t *bytes,
  size_t byte_count
) {
  (void)context;
  (void)offset;
  (void)bytes;
  (void)byte_count;
  return SCORING_STATUS_UNAVAILABLE;
}

static scoring_status_t unavailable_void(void *context) {
  (void)context;
  return SCORING_STATUS_UNAVAILABLE;
}

static scoring_status_t unavailable_publish(void *context, const uint8_t *bytes, size_t byte_count) {
  (void)context;
  (void)bytes;
  (void)byte_count;
  return SCORING_STATUS_UNAVAILABLE;
}

static const scoring_stm32_hardware_t SAFE_HARDWARE = {
  .clock = { .context = NULL, .now_us = unavailable_now_us },
  .adc = { .context = NULL, .read_frame = unavailable_read_frame },
  .comparator = { .context = NULL, .read_events = unavailable_read_events },
  .dma = { .context = NULL, .pop_frames = unavailable_pop_frames },
  .flash = { .context = NULL, .read = unavailable_read, .write = unavailable_write },
  .watchdog = { .context = NULL, .arm = unavailable_void, .service = unavailable_void },
  .transport = { .context = NULL, .publish = unavailable_publish }
};

const scoring_stm32_hardware_t *scoring_stm32_safe_hardware(void) {
  return &SAFE_HARDWARE;
}

scoring_status_t scoring_stm32_validate_hardware(const scoring_stm32_hardware_t *hardware) {
  if (hardware == NULL) {
    return SCORING_STATUS_INVALID_ARGUMENT;
  }

  if (
    hardware->clock.now_us == NULL ||
    hardware->adc.read_frame == NULL ||
    hardware->comparator.read_events == NULL ||
    hardware->dma.pop_frames == NULL ||
    hardware->flash.read == NULL ||
    hardware->flash.write == NULL ||
    hardware->watchdog.arm == NULL ||
    hardware->watchdog.service == NULL ||
    hardware->transport.publish == NULL
  ) {
    return SCORING_STATUS_INVALID_ARGUMENT;
  }

  return SCORING_STATUS_OK;
}

scoring_status_t scoring_stm32_host_init(
  scoring_stm32_host_t *host,
  const scoring_stm32_hardware_t *hardware
) {
  if (host == NULL || hardware == NULL) {
    return SCORING_STATUS_INVALID_ARGUMENT;
  }

  host->hardware = hardware;
  host->state = SCORING_STM32_STATE_UNAVAILABLE;
  host->started_at_us = 0U;
  return SCORING_STATUS_OK;
}

scoring_status_t scoring_stm32_host_start(scoring_stm32_host_t *host) {
  uint64_t started_at_us = 0U;
  scoring_status_t status;

  if (host == NULL || host->hardware == NULL) {
    return SCORING_STATUS_INVALID_ARGUMENT;
  }

  status = scoring_stm32_validate_hardware(host->hardware);
  if (status != SCORING_STATUS_OK) {
    host->state = SCORING_STM32_STATE_FAULTED;
    return status;
  }

  status = host->hardware->clock.now_us(host->hardware->clock.context, &started_at_us);
  if (status != SCORING_STATUS_OK) {
    host->state = SCORING_STM32_STATE_UNAVAILABLE;
    return status;
  }

  status = host->hardware->watchdog.arm(host->hardware->watchdog.context);
  if (status != SCORING_STATUS_OK) {
    host->state = SCORING_STM32_STATE_UNAVAILABLE;
    return status;
  }

  host->started_at_us = started_at_us;
  host->state = SCORING_STM32_STATE_READY;
  return SCORING_STATUS_OK;
}

scoring_status_t scoring_stm32_host_poll(scoring_stm32_host_t *host) {
  scoring_adc_frame_t adc_frame;
  scoring_adc_frame_t dma_frames[SCORING_STM32_MAX_DMA_FRAMES_PER_POLL];
  scoring_comparator_event_t comparator_events[SCORING_STM32_MAX_COMPARATOR_EVENTS_PER_POLL];
  size_t comparator_event_count = 0U;
  size_t dma_frame_count = 0U;
  scoring_status_t status;

  if (host == NULL || host->hardware == NULL) {
    return SCORING_STATUS_INVALID_ARGUMENT;
  }

  if (host->state != SCORING_STM32_STATE_READY) {
    return SCORING_STATUS_NOT_READY;
  }

  status = host->hardware->adc.read_frame(host->hardware->adc.context, &adc_frame);
  if (status != SCORING_STATUS_OK) {
    host->state = SCORING_STM32_STATE_UNAVAILABLE;
    return status;
  }

  status = host->hardware->dma.pop_frames(
    host->hardware->dma.context,
    dma_frames,
    SCORING_STM32_MAX_DMA_FRAMES_PER_POLL,
    &dma_frame_count
  );
  if (status != SCORING_STATUS_OK || dma_frame_count > SCORING_STM32_MAX_DMA_FRAMES_PER_POLL) {
    host->state = SCORING_STM32_STATE_UNAVAILABLE;
    return status == SCORING_STATUS_OK ? SCORING_STATUS_OVERFLOW : status;
  }

  status = host->hardware->comparator.read_events(
    host->hardware->comparator.context,
    comparator_events,
    SCORING_STM32_MAX_COMPARATOR_EVENTS_PER_POLL,
    &comparator_event_count
  );
  if (status != SCORING_STATUS_OK || comparator_event_count > SCORING_STM32_MAX_COMPARATOR_EVENTS_PER_POLL) {
    host->state = SCORING_STM32_STATE_UNAVAILABLE;
    return status == SCORING_STATUS_OK ? SCORING_STATUS_OVERFLOW : status;
  }

  status = host->hardware->watchdog.service(host->hardware->watchdog.context);
  if (status != SCORING_STATUS_OK) {
    host->state = SCORING_STM32_STATE_UNAVAILABLE;
    return status;
  }

  return SCORING_STATUS_OK;
}

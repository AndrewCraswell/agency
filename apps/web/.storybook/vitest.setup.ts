import { setProjectAnnotations } from "@storybook/react-vite"
import { beforeAll } from "vitest"
import * as previewAnnotations from "./preview"

// Wires the React renderer + shared preview annotations into the browser test
// project at runtime. Required because our preview is built by a factory
// (`definePreview()`), which the addon's static auto-provisioning can't read.
const project = setProjectAnnotations([previewAnnotations])

beforeAll(project.beforeAll)

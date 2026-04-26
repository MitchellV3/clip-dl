"use client"

import { ChakraProvider, createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"
import { ColorModeProvider, type ColorModeProviderProps } from "./color-mode"

// 1. Strip globalCss from the default config
const { globalCss: _, ...restConfig } = defaultConfig

// 2. Disable preflight (the reset) and scope variables to the Shadow Host
const customConfig = defineConfig({
  preflight: false,
  // We mount two separate integrated UIs (controls + toast),
  // so emit Chakra vars for both wrapper roots.
  cssVarsRoot: ".clip-dl-ui-wrapper, .clip-dl-toast-wrapper",
})

// 3. Create the custom system
const customSystem = createSystem(restConfig, customConfig)

export function Provider(props: ColorModeProviderProps & { value?: any }) {
  return (
    <ChakraProvider value={customSystem}>
      <ColorModeProvider {...props} />
    </ChakraProvider>
  )
}

"use client"

import {
  Center,
  Toaster as ChakraToaster,
  Portal,
  Stack,
  Toast,
  VStack,
  createToaster,
} from "@chakra-ui/react"
import { CustomSpinner } from "./custom-spinner"

export const toaster = createToaster({
  placement: "bottom-end",
  pauseOnPageIdle: true,
})

export const Toaster = () => {
  return (
    <Portal disabled>
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: "4" }} gap={4}>
        {(toast) => (
          <Toast.Root
            width={"400px"}
            backgroundColor={toast.type === "error" ? "red.800" : toast.type === "success" ? "green.800" : toast.type === "loading" ? "blue.800" : toast.type === "info" ? "gray.800" : "whiteAlpha.800"}
            color={"white"}
            borderRadius={"md"}
            padding={"10px 15px"}
            display={"flex"}
            justifyContent={"space-around"}
            alignItems={"center"}
            gap={"3"}
            boxShadow={"0 4px 8px rgba(0,0,0,0.2)"}
            fontSize={"xl"}
            transition={"all 0.5s ease-in-out"}
            border={"1px solid rgba(255, 255, 255, 0.2)"}
            _hover={{ borderColor: "white" }}
            className="toast-wrapper"
          >
            {toast.type === "loading" ? (
              <CustomSpinner size="lg" />
            ) : (
              <Toast.Indicator />
            )}
            <VStack
              gap="4"
              flex="1"
              maxWidth="80%" alignItems={"flex-start"}
              wordBreak={'break-all'}
              overflow={'hidden'}
            >
              {toast.title &&
                <Toast.Title
                  fontSize={"2xl"}
                >
                  {toast.title}
                </Toast.Title>}
              {toast.description &&
                (
                  <Toast.Description
                    fontSize={"xl"}
                  >
                    {toast.description}
                  </Toast.Description>
                )}
            </VStack>
            {toast.action && (
              <Toast.ActionTrigger
                display={"flex"}
                fontSize={"xl"}
                background={"transparent"}
                padding={'4px 6px'}
                borderRadius={"md"}
                alignItems={"flex-end"}
                justifyContent={"center"}
                border={"1px solid rgba(255, 255, 255, 0.2)"}
                _hover={{ background: "whiteAlpha.200", borderColor: "white" }}
                transition={"background 0.2s ease-in-out, border-color 0.2s ease-in-out"}
                height={'auto'}
                width={'20%'}
              >
                {toast.action.label}
              </Toast.ActionTrigger>
            )}
            {toast.closable &&
              <Toast.CloseTrigger
                fontSize={"xl"}
                background={"transparent"}
                padding={"4px"}
                borderRadius={"md"}
                alignItems={"center"}
                justifyContent={"center"}
                border={"1px solid rgba(255, 255, 255, 0.2)"}
                _hover={{ background: "whiteAlpha.200", borderColor: "white" }}
                transition={"background 0.2s ease-in-out, border-color 0.2s ease-in-out"}
              />}
          </Toast.Root>
        )}
      </ChakraToaster>
    </Portal>
  )
}

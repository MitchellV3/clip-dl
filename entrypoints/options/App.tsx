import { Provider } from '@/components/ui/provider';
import { Box, Button, Checkbox, CheckboxCard, CheckboxGroup, createListCollection, Field, Flex, Grid, Heading, HStack, Input, NativeSelect, Portal, SegmentGroup, Select, Text, VStack } from '@chakra-ui/react';
import { useState } from 'react';
//import './style.css'

export default function TestApp() {
  const [count, setCount] = useState(0);
  const [value, setValue] = useState<string | null>()
  const checkboxItems = [
    { value: "date", title: "Date", description: "(YYYY-MM-DD)" },
    { value: "source", title: "Source", description: "(YouTube/Twitch)" },
  ]


  const filterHistory = createListCollection({
    items: [
      { value: "all", label: "All Statuses" },
      { value: "completed", label: "Completed" },
      { value: "error", label: "Errors" },
      { value: "cancelled", label: "Cancelled" },
    ],
  })

  return (
    <Provider >
      <Box className="settings-wrapper" padding={"10"} borderRadius={"md"} boxShadow={"0 4px 8px rgba(0,0,0,1)"} maxWidth={"600px"} margin={"20px auto"} width={"100rem"} backgroundColor={"whiteAlpha.100"} alignItems={"center"} justifyContent={"center"} textAlign={"center"}>
        <Heading>Organization Options</Heading>

        <Box className="setting-group" display={"flex"} flexDirection={"column"} alignItems={"center"} justifyContent={"center"}>
          <VStack width="full">
            <Field.Root required>
              <Field.Label fontSize={"md"} fontWeight="medium">
                Download Directory:
              </Field.Label>
              <HStack gap="2" width={"100%"}>
                <Input type="text" id="download-directory" placeholder="Default Directory" variant="subtle" size={"md"} border={"1px whiteAlpha.100 solid"} borderRadius={"md"} bg={"whiteAlpha.100"} />
                <Button id="browse" border={"1px whiteAlpha.100 solid"} borderRadius={"md"} size={"lg"} bg={"whiteAlpha.100"} _hover={{ backgroundColor: "whiteAlpha.200" }}>Browse</Button>
              </HStack>
            </Field.Root>
            <Text className="help-text">Leave blank to use the default downloads directory.</Text>
          </VStack>
        </Box>
        <Box className="setting-group" >
          <Box flex={1}>

            <CheckboxGroup defaultValue={["date"]} >
              <Text fontSize="md" fontWeight="medium">
                Organize files by:
              </Text>
              <Grid gap="2" display={"flex"} flexDirection={"row"} >
                {checkboxItems.map((item) => (
                  <CheckboxCard.Root key={item.value} value={item.value} bg={"whiteAlpha.100"} defaultChecked={item.value === "date"} width={"50%"}>
                    <CheckboxCard.HiddenInput />
                    <CheckboxCard.Control>
                      <CheckboxCard.Content>
                        <CheckboxCard.Label>{item.title}</CheckboxCard.Label>
                        <CheckboxCard.Description>
                          {item.description}
                        </CheckboxCard.Description>
                      </CheckboxCard.Content>
                      <CheckboxCard.Indicator />
                    </CheckboxCard.Control>
                  </CheckboxCard.Root>
                ))}
              </Grid>
            </CheckboxGroup>

          </Box>
        </Box>


        <Box className="setting-group">
          <Heading>Hotkey Settings</Heading>
          <Text className="help-text">Click on an input field and press the desired key combination. Press Esc to cancel.</Text>
          <Box alignItems={"center"} justifyContent={"center"} display={"flex"} flexDirection={"column"} gap={"2"}>
            <HStack>
              <VStack>
                <Text fontSize="md" fontWeight="medium">15s Clip (Default: Ctrl+Shift+1):</Text>
                <HStack >
                  <Input type="text" id="hotkey-15s" className="hotkey-input" placeholder="Press keys..." readOnly size={"xs"} bg={"whiteAlpha.100"} />
                  <Button data-for="hotkey-15s" size={"lg"} bg={"whiteAlpha.100"} _hover={{ backgroundColor: "whiteAlpha.200" }}>Reset</Button>
                </HStack>
              </VStack>
              <VStack >
                <Text fontSize="md" fontWeight="medium">30s Clip (Default: Ctrl+Shift+2):</Text>
                <HStack >
                  <Input type="text" id="hotkey-30s" className="hotkey-input" placeholder="Press keys..." readOnly size={"xs"} bg={"whiteAlpha.100"} />
                  <Button data-for="hotkey-30s" size={"lg"} bg={"whiteAlpha.100"} _hover={{ backgroundColor: "whiteAlpha.200" }}>Reset</Button>
                </HStack>
              </VStack>
            </HStack>
            <HStack>
              <VStack >
                <Text fontSize="md" fontWeight="medium">60s Clip (Default: Ctrl+Shift+3):</Text>
                <HStack >
                  <Input type="text" id="hotkey-60s" className="hotkey-input" placeholder="Press keys..." readOnly size={"xs"} bg={"whiteAlpha.100"} />
                  <Button data-for="hotkey-60s" size={"lg"} bg={"whiteAlpha.100"} _hover={{ backgroundColor: "whiteAlpha.200" }}>Reset</Button>
                </HStack>
              </VStack>
              <VStack >
                <Text fontSize="md" fontWeight="medium">Full Video (Default: Ctrl+Shift+4):</Text>
                <HStack >
                  <Input type="text" id="hotkey-60s" className="hotkey-input" placeholder="Press keys..." readOnly size={"xs"} bg={"whiteAlpha.100"} />
                  <Button data-for="hotkey-60s" size={"lg"} bg={"whiteAlpha.100"} _hover={{ backgroundColor: "whiteAlpha.200" }}>Reset</Button>
                </HStack>
              </VStack>
            </HStack>
          </Box>
        </Box>

        <Box className="setting-group">
          <Heading>Clip Length Presets</Heading>
          <Text className="help-text">Drag and drop presets to reorder. Click × to remove a preset.</Text>

          <Box className="presets-section">
            <HStack className="preset-controls">
              <HStack className="preset-input-group">
                <Input type="number" placeholder="Enter duration in seconds" min="1" bg={"whiteAlpha.100"} border={"none"} />
                <Button bg={"whiteAlpha.100"} _hover={{ backgroundColor: "whiteAlpha.200" }} border={"none"} color={"white"}>Add Preset</Button>
              </HStack>
              <Button className="secondary-button" bg={"whiteAlpha.100"} _hover={{ backgroundColor: "whiteAlpha.200" }} border={"none"} color={"white"}>Reset to Defaults</Button>
            </HStack>
          </Box>

        </Box>

        <Box className="setting-group">
          <Heading>Download History</Heading>

          {/*Filter Controls*/}
          <HStack justifyContent={"space-between"} alignItems={"center"} marginBottom={"4"}>
            <Input type="text" placeholder="Filter by URL..." size={"md"} bg={"whiteAlpha.100"} border={"none"} _hover={{ backgroundColor: "whiteAlpha.200" }} />

            <Select.Root collection={filterHistory} size="md" width={"25%"}>
              <Select.HiddenSelect />
              <Select.Control >
                <Select.Trigger bg={"whiteAlpha.100"} border={"none"} _hover={{ backgroundColor: "whiteAlpha.200" }}>
                  <Select.ValueText placeholder="Filter by..." />
                </Select.Trigger>
                <Select.IndicatorGroup>
                  <Select.Indicator />
                </Select.IndicatorGroup>
              </Select.Control>
              <Portal>
                <Select.Positioner>
                  <Select.Content bg={"whiteAlpha.100"} border={"1px whiteAlpha.200 solid"} borderRadius={"md"} boxShadow={"0 4px 8px rgba(0,0,0,0.2)"}>
                    {filterHistory.items.map((filter) => (
                      <Select.Item item={filter} key={filter.value}>
                        {filter.label}
                        <Select.ItemIndicator />
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Positioner>
              </Portal>
            </Select.Root>


          </HStack>

          {/*History Container*/}
          <Box id="history-list" className="history-container">
            {/*Dynamic content from history.js*/}
          </Box>

          {/*Pagination*/}
          <HStack justifyContent={"space-between"} alignItems={"center"} marginTop={"4"}>
            <Box width={"80px"} display={"flex"} justifyContent={"flex-start"}>
              <Button bg={"whiteAlpha.100"} border={"none"} _hover={{ backgroundColor: "whiteAlpha.200" }}>Previous</Button>
            </Box>
            <Box display={"flex"} justifyContent={"center"} alignItems={"center"}>
              <Text >Page 1 of 1</Text>
            </Box>
            <Box width={"80px"} display={"flex"} justifyContent={"flex-end"}>
              <Button bg={"whiteAlpha.100"} border={"none"} _hover={{ backgroundColor: "whiteAlpha.200" }}>Next</Button>
            </Box>
          </HStack>

          {/*Management*/}
          <HStack justifyContent={"space-between"} marginTop={"4"}>
            <Button bg={"whiteAlpha.100"} border={"none"} _hover={{ backgroundColor: "whiteAlpha.200" }}>Clear History</Button>
            <Text className="help-text">Retention: 500 entries max</Text>
          </HStack>
        </Box>


        <Box className="settings-footer">
          <Text>
            Version 1.0
          </Text>
        </Box>

      </Box >
    </Provider >

  );
}

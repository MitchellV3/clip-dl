import { Button } from '@/components/ui/button'
import './style.css'
import { Popover } from "@chakra-ui/react"

export default function Clip() {
    async function makeClip() {
        console.log('Making clip... (not implemented yet)')
    }

    return (
        <Popover.Root>
            <Popover.Trigger asChild>
                <Button
                    className={'h-[80%] px-6 bg-transparent hover:bg-white/10 rounded-full cursor-pointer'}
                    onClick={makeClip}
                >
                    <svg className={"w-10! h-10! bg-transparent"} filter="drop-shadow(0 0 1px rgba(0, 0, 0, .8))" width="256px" height="256px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
                        <path d="M0 0h24v24H0z" fill="none" />
                        <path d="M23 22a2 2 0 0 1-2-2V4a4 4 0 0 0-4-4H6a1 1 0 0 0 0 2a2 2 0 0 1 2 2v6.91a.23.23 0 0 0 .13.21l2.5 1.48a.25.25 0 0 0 .25 0a.25.25 0 0 0 .12-.22V9.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5h-1.93a.26.26 0 0 0-.24.18a.27.27 0 0 0 .11.29l1.33.78c.22.13 1.22 1 1.22 1.25V21a.5.5 0 0 1-.5.5H13a2 2 0 0 1-2-2v-.72a.22.22 0 0 0-.12-.21l-2.5-1.48a.25.25 0 0 0-.25 0a.26.26 0 0 0-.13.21V20a4 4 0 0 0 4 4h11a1 1 0 0 0 0-2M17.49 7h-6a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5H16a2 2 0 0 1 2 2v2a.5.5 0 0 1-.51.5" />
                        <path d="M2.46 11.84L15 19.26a1 1 0 0 0 1-1.72l-10.14-6a.26.26 0 0 1-.13-.19a.3.3 0 0 1 .09-.22a3.3 3.3 0 0 0 .74-.92A3.5 3.5 0 1 0 0 8.5a3.5 3.5 0 0 0 .45 1.73a3.52 3.52 0 0 0 2.01 1.61M3.51 7A1.5 1.5 0 0 1 5 8.5a1.4 1.4 0 0 1-.17.68A1.5 1.5 0 0 1 2 8.57V8.5A1.5 1.5 0 0 1 3.51 7m0 7A3.5 3.5 0 1 0 7 17.5A3.5 3.5 0 0 0 3.51 14m0 5A1.5 1.5 0 1 1 5 17.5A1.5 1.5 0 0 1 3.51 19" />
                    </svg>
                    <svg className={"w-10! h-10! bg-transparent"} filter="drop-shadow(0 0 1px rgba(0, 0, 0, .8))" width="200" height="200" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff">
                        <g fill="none" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
                            <path d="M.763 8.25a2.25 2.25 0 1 0 4.5 0a2.25 2.25 0 0 0-4.5 0m0 8.196a2.25 2.25 0 1 0 4.499 0a2.25 2.25 0 0 0-4.499 0" />
                            <path d="m2.34 10.397l7.391 4.381l4.201 2.489M2.34 14.3l4.317-2.559m3.08.259V2.25a1.5 1.5 0 0 1 1.5-1.5h12m0 22.5h-12a1.5 1.5 0 0 1-1.5-1.5V18m4.5-8.25v-9m0 22.5v-3m-4.5-15h4.5m9 9V.75m0 22.5v-9m-13.5-4.5h13.5m-7.5 4.5h7.5" />
                        </g>
                    </svg>
                </Button>
            </Popover.Trigger>
            <Popover.Positioner>
                <Popover.Content>
                    <Popover.CloseTrigger />
                    <Popover.Arrow>
                        <Popover.ArrowTip />
                    </Popover.Arrow>
                    <Popover.Body>
                        <Popover.Title />
                    </Popover.Body>
                </Popover.Content>
            </Popover.Positioner>
        </Popover.Root>


    )
}
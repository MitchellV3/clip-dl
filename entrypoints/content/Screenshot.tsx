import { Box, Button } from '@chakra-ui/react'
import saveAs from 'file-saver'
import dayjs from 'dayjs'
import './style.css'


export default function Screenshot() {
    async function onTakeScreenshot() {
        const video = document.querySelector('#movie_player video') as HTMLVideoElement
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(video, 0, 0)
        const blob = (await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png', 1)))!

        const data = [new ClipboardItem({ [blob.type]: blob })]
        await navigator.clipboard.write(data)

        const filename = `Youtube-Screenshot_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.png` // Results in something like Youtube-Screenshot_2026-01-14_09-49-06.png
        saveAs(blob, filename)
    }

    return (
        <Button
            className={' ytp-button  '}
            onClick={onTakeScreenshot}
            height={"full"}
            width={"full"}
            display={"flex"}
            alignItems={"center"}
            justifyContent={"center"}

        >
            <Box
                display={"flex"}
                alignItems={"center"}
                justifyContent={"center"} height={"100%"}

            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000000" style={{
                    height: "60%",
                    width: "auto"
                }}><path d="M21 6h-3.2L16 4h-6v2h5.1L17 8h4v12H5v-9H3v9c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2M8 14c0 4.45 5.39 6.69 8.54 3.54S17.45 9 13 9c-2.76 0-5 2.24-5 5m5-3a3.09 3.09 0 0 1 3 3a3.09 3.09 0 0 1-3 3a3.09 3.09 0 0 1-3-3a3.09 3.09 0 0 1 3-3M5 6h3V4H5V1H3v3H0v2h3v3h2" filter='invert(100%)' /></svg>
            </Box>
        </Button>

    )
}
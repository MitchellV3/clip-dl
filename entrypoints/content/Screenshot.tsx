import { Button } from '@/components/ui/button'
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
            className={'h-[80%] px-6 bg-transparent hover:bg-white/10 rounded-full cursor-pointer'}
            onClick={onTakeScreenshot}
        >
            <svg className={"w-10! h-10! bg-transparent"} width="256px" height="256px" viewBox="0 0 24.00 24.00" fill="none" xmlns="http://www.w3.org/2000/svg" transform="rotate(0)">    <g id="SVGRepo_bgCarrier" strokeWidth="0" filter="drop-shadow(0 0 1px rgba(0, 0, 0, .8))">
            </g>
                <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round" stroke="#CCCCCC" strokeWidth="0.288">
                </g>
                <g id="SVGRepo_iconCarrier">
                    <circle cx="12" cy="13" r="3" stroke="#ffffff" strokeWidth="2.4">
                    </circle>
                    <path d="M9.77778 21H14.2222C17.3433 21 18.9038 21 20.0248 20.2646C20.51 19.9462 20.9267 19.5371 21.251 19.0607C22 17.9601 22 16.4279 22 13.3636C22 10.2994 22 8.76721 21.251 7.6666C20.9267 7.19014 20.51 6.78104 20.0248 6.46268C19.3044 5.99013 18.4027 5.82123 17.022 5.76086C16.3631 5.76086 15.7959 5.27068 15.6667 4.63636C15.4728 3.68489 14.6219 3 13.6337 3H10.3663C9.37805 3 8.52715 3.68489 8.33333 4.63636C8.20412 5.27068 7.63685 5.76086 6.978 5.76086C5.59733 5.82123 4.69555 5.99013 3.97524 6.46268C3.48995 6.78104 3.07328 7.19014 2.74902 7.6666C2 8.76721 2 10.2994 2 13.3636C2 16.4279 2 17.9601 2.74902 19.0607C3.07328 19.5371 3.48995 19.9462 3.97524 20.2646C5.09624 21 6.65675 21 9.77778 21Z" stroke="#ffffff" strokeWidth="2.4">
                    </path>
                    <path d="M19 10H18" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round">
                    </path>
                </g>
            </svg>

            <svg className={"w-12! h-12! bg-transparent"} xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 21 21" fill="#ffffff" filter="drop-shadow(0 0 1px rgba(0, 0, 0, .8))">

                <g fill="none" fillRule="evenodd">
                    <path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" d="M2.5 14.5v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2z" />
                    <path fill="#ffffff" d="M17 9a1 1 0 1 0-2 0a1 1 0 0 0 2 0z" />
                    <path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" d="M13.5 11.5a3 3 0 1 0-6 0a3 3 0 0 0 6 0zm-4-7h2a1 1 0 0 1 1 1v1h-4v-1a1 1 0 0 1 1-1z" />
                </g>
            </svg>
        </Button>

    )
}